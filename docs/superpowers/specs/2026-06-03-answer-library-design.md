# Answer Library — Design Spec

**Date:** 2026-06-03
**Scope:** Turn the orphaned `response_library` into a working answer library with
auto-capture (on approval) and suggest-on-question reuse.
**Supersedes:** §1 (Feedback Loop) and §2 (Duplicate Detection) of
`2026-05-27-answer-intelligence-design.md`. Versioning and due-date alerts from
that doc are out of scope here.

---

## Problem

`response_library` exists (`org_id, category, keyword, response_text, usage_count`)
with a `/library` page that writes to it — but **nothing reads it**. It has no
question text and no embedding, so it can never be matched to an incoming RFP
question. It is dead weight.

Meanwhile the same questions recur across RFPs ("Do you support SSO?", "Where is
data hosted?"). Today every one is re-drafted from scratch via KB retrieval + LLM
— slow, non-deterministic, and inconsistent across proposals.

## Goal

A self-filling library of approved Q→A pairs that:
- captures every approved answer automatically (closed loop), and
- surfaces high-confidence matches as a 1-click **Reuse** before the user spends
  an AI generation — verbatim reuse, no LLM redraw, no re-citation.

## Non-goals

- No auto-fill. Reuse is always an explicit click (human in the loop).
- No answer versioning, no due-date alerts (separate scope).
- No cross-org sharing. Library is strictly org-scoped (RLS).

---

## Why a distinct library, not "just put it in the Knowledge base"

| | Knowledge base | Answer library |
|---|---|---|
| Holds | unstructured docs (past proposals, policies, security) | curated Q→A pairs |
| Match | question → **chunk** (fuzzy, for context) | question → **question** (exact reuse) |
| AI use | retrieve material → LLM generates new prose | reuse approved answer verbatim |
| Workflow | ingest + index | approve + capture |

Folding Q/A pairs into the KB chunks them as prose and loses the verbatim-reuse
guarantee + the approve workflow. Keep the behavior distinct; storage/embedding
infra is shared (same Jina 1024-dim model, same pgvector).

---

## Architecture

### 1. Schema — migration `0012_answer_library.sql`

Extend `response_library` (do not create a new table):

```sql
alter table response_library
  add column if not exists question_text      text,
  add column if not exists embedding          vector(1024),  -- of question_text
  add column if not exists source             text default 'manual',  -- 'manual' | 'approved'
  add column if not exists source_question_id uuid references questions(id) on delete set null,
  add column if not exists last_used_at       timestamptz;

create index if not exists idx_library_embedding
  on response_library using ivfflat (embedding vector_cosine_ops) with (lists = 100);
```

`response_text` (answer) and `usage_count` are reused as-is. `category`/`keyword`
remain for manual entries.

**Embedding decision:** embed `question_text` **only**, not question+answer. We
match an incoming question against stored questions; mixing answer prose into the
vector dilutes question-to-question similarity. (This is the one deviation from
the 2026-05-27 spec.) Rows with a null embedding — e.g. legacy/manual entries
saved before this ships, or saved while the Jina key is absent — are simply not
returned by `match_answers`; a backfill is optional, see Open Questions.

### 2. Match RPC — `match_answers`

Mirror `match_chunks`, org-scoped, over `response_library.embedding`:

```sql
create or replace function match_answers(
  p_embedding vector(1024),
  p_org_id    uuid,
  p_limit     int default 5
) returns table (
  id uuid, question_text text, response_text text,
  usage_count int, last_used_at timestamptz, similarity float
)
language sql stable as $$
  select l.id, l.question_text, l.response_text,
         l.usage_count, l.last_used_at,
         1 - (l.embedding <=> p_embedding) as similarity
  from response_library l
  where l.org_id = p_org_id and l.embedding is not null
  order by l.embedding <=> p_embedding
  limit p_limit;
$$;
```

### 3. Capture — on approval

In `POST /api/responses/[id]/approve`, when `decision === "approve"`, after the
existing `final_text`/status writes:

1. Join to get `question_text` + `org_id` for the response's question.
2. Embed `question_text` (Jina). If no embeddings key, skip capture silently —
   approval must still succeed.
3. **Dedupe:** call `match_answers(embedding, org_id, 1)`. If top `similarity ≥
   0.92`, **update** that row (`response_text = final_text`, refresh
   `source_question_id`, `embedding`) instead of inserting. Else insert a new row
   with `source = 'approved'`.
4. Return `{ ok: true, captured: { id, action: 'inserted' | 'updated' } }` so the
   client can show an undo affordance.

Capture is best-effort: wrap in try/catch so an embedding failure never blocks
approval. The write uses the admin client (mirrors `regenerate`) so RLS on a
service path is consistent.

**Undo:** the question view shows a `Saved to answer library · Undo` toast on
approve when `captured` is present. Undo → `DELETE /api/library/[id]` (for an
inserted row). For an `updated` row, Undo is suppressed (we don't have the prior
text to restore, and the merge is the desired behavior) — the toast reads
`Updated library answer` with no Undo in that case.

### 4. Suggest — reuse before generate

- New endpoint `GET /api/questions/[id]/suggestions`:
  - loads the question, embeds `question_text`, calls `match_answers(.., org_id,
    3)`, returns matches with `similarity`.
  - returns `[]` if embeddings unavailable or KB/library empty.
- Question view (the answer drafting UI) renders a **Reuse card** when the top
  match has `similarity ≥ 0.85`:
  - shows the stored question, a snippet of the answer, and the match % badge.
  - **Reuse** button → writes the stored `response_text` as the draft via the
    existing `POST /api/questions/[id]/respond` (status `draft`), then
    `usage_count += 1` and `last_used_at = now()` on the library row.
  - The AI-draft button remains the default/primary action below the card.
- Below 0.85: no card; normal KB generate path is unchanged.

### 5. `/library` page becomes real

Upgrade `app/(app)/library/page.tsx` + `LibraryForm.tsx`:
- List Q→A rows: question, answer (truncated), `source` badge
  (`auto` vs `manual`), `usage_count`, `last_used_at`.
- Client-side search over question + answer text.
- Manual add still supported (your KB-manual-entry idea): typing a Q/A pair saves
  it and embeds `question_text` on save (`source = 'manual'`).
- Edit + delete per row. Edit re-embeds if `question_text` changed.
- Empty state explains the auto-capture loop.

---

## Data flow

```
Approve answer ──► embed(question) ──► match_answers(top1)
                                         │
                          sim ≥ 0.92 ────┴──► update existing row
                          else        ───────► insert row (source=approved)
                                         │
                                         └──► toast: Saved · Undo

Open question ──► GET /suggestions ──► embed(question) ──► match_answers(top3)
                                         │
                          sim ≥ 0.85 ────┴──► Reuse card (1-click → draft)
                          else        ───────► no card (AI generate as today)
```

---

## Thresholds (single source of truth)

| Constant | Value | Meaning |
|---|---|---|
| `LIBRARY_SUGGEST_MIN` | 0.85 | show Reuse card at/above this question-similarity |
| `LIBRARY_DEDUPE_MIN`  | 0.92 | on capture, update existing row instead of inserting |

Define once in `lib/answer-library.ts` and import everywhere. Tunable later.

---

## Files touched

**New**
- `migrations/0012_answer_library.sql` — columns + ivfflat index + `match_answers`.
- `app/api/questions/[id]/suggestions/route.ts` — GET matches.
- `lib/answer-library.ts` — thresholds + `captureApprovedAnswer()` +
  `suggestAnswers()` helpers (embedding + RPC calls), shared by routes.

**Modified**
- `app/api/responses/[id]/approve/route.ts` — capture on approve, return `captured`.
- `app/api/library/route.ts` — embed `question_text` on manual insert; accept
  `question_text`; add GET (list) if not present; add `[id]` route for delete/edit.
- `app/(app)/library/page.tsx` + `LibraryForm.tsx` — real list/search/edit UI.
- Question drafting view — Reuse card + undo toast (locate exact component during
  implementation; it is the client that calls `respond`/`regenerate`/`approve`).

---

## Security / privacy

- All reads/writes org-scoped; `match_answers` filters on `p_org_id` and the
  existing `lib_all` RLS policy on `response_library` stays in force.
- Capture uses the admin client only for the library write, same pattern as
  `regenerate`; the org_id is derived server-side from the question join, never
  from the client.
- No cross-tenant exposure: a suggestion can only return rows for the caller's org.
- Approval is never blocked by capture failure (best-effort, try/catch).

## Testing

- Migration applies; `match_answers` returns ordered rows for a seeded org.
- Approve a drafted answer → row appears in `response_library` with embedding;
  approving a near-identical question updates rather than duplicates (>0.92).
- `/suggestions` returns the captured pair for a paraphrased question ≥0.85;
  returns `[]` for an unrelated question.
- Reuse writes the draft + bumps `usage_count`/`last_used_at`.
- Embeddings key absent → approve still succeeds, suggestions return `[]`.
- `tsc --noEmit` clean; lint clean.

## Open questions

1. **Backfill:** embed existing manual `response_library` rows that have
   `response_text` but no `question_text`? Proposal: skip — they lack a question
   to match on; surface them in the list as "manual, unmatched" and let the user
   add a question to activate them. (Low effort, no migration data risk.)
2. **Suggestions trigger:** fetch on question open (simple) vs. only when the user
   focuses the answer field (fewer embeds). Proposal: on open; cost is negligible.
