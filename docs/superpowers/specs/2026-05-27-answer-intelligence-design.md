# Answer Intelligence — Design Spec
**Date:** 2026-05-27  
**Scope:** 4 features: feedback loop, duplicate detection, answer versioning, due-date alerts

---

## 1. Feedback Loop: Approval → Reusable Answers

### Problem
Approved answers vanish after approval. The AI never learns from good past work. Reusable Answers is a dead manual-entry page.

### Design

**On approval**, `POST /api/responses/[id]/approve` (decision=approve) also:
1. Reads `final_text`, `question_text` (via join), `category` from the question
2. Upserts a row into `response_library` with `question_text`, `response_text = final_text`, `category`, `source = "approved"`, `source_question_id`, `embedding` (embed `question_text + " " + final_text` via Jina)
3. Increments nothing — fresh insert unless same `source_question_id` already exists (upsert on that column)

**Schema addition to `response_library`:**
```sql
ALTER TABLE response_library
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual',       -- 'manual' | 'approved'
  ADD COLUMN IF NOT EXISTS source_question_id uuid REFERENCES questions(id),
  ADD COLUMN IF NOT EXISTS question_text text,
  ADD COLUMN IF NOT EXISTS embedding vector(1024);
```

**Reusable Answers page** — upgrade from dead form to live library:
- Remove manual add form (or keep as secondary "Add manually" action)
- Show list: question text + answer text + category + source badge (Manual vs Auto-approved) + deal name
- Searchable by keyword
- Delete button per row

---

## 2. Duplicate/Similar Answer Detection (Inline Panel)

### Problem
Same question appears across multiple RFPs. Team re-answers from scratch every time.

### Design

**In `QuestionDetail`**, add a collapsible "Similar past answers" panel (right side or below question text, collapsed by default).

**On panel open**, client calls `GET /api/library/similar?q=<question_text_urlencoded>`:
- Embeds `question_text` via Jina
- Does cosine similarity search against `response_library.embedding` (top 3, threshold ≥ 0.75)
- Returns `{ id, question_text, response_text, category, deal_name, similarity }`

**Panel UI:**
- "Similar answers (N)" expand toggle
- Each result: question text (truncated), answer preview (2 lines), similarity %, "Use this" button
- "Use this" → inserts `response_text` into the draft textarea

**No auto-injection** — user explicitly picks. Avoids overwriting AI draft silently.

---

## 3. Answer Versioning

### Problem
Regenerate wipes the current draft. No history, no diff.

### Design

**New table `response_versions`:**
```sql
CREATE TABLE response_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES responses(id) ON DELETE CASCADE,
  draft_text text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  trigger text -- 'manual_save' | 'regenerate' | 'approval'
);
```

**Write a version** at two points:
1. Before `generateAndPersistAnswer` overwrites `draft_text` in `regenerate` route — snapshot current value first
2. On manual save in `QuestionDetail` autosave — snapshot before overwrite (debounced, not every keystroke)

**UI in `QuestionDetail`:**
- "History (N)" toggle below the draft editor
- List of versions: timestamp + trigger label + first 80 chars
- Click version → shows full text in a read-only panel beside current draft
- "Restore" button on each version → sets draft textarea to that text (doesn't save, user still saves manually)

No inline diff needed for MVP — side-by-side view is sufficient.

---

## 4. Due-Date Alerts (In-App)

### Problem
Deal and question due dates exist in DB but nothing alerts anyone. Deals miss deadlines silently.

### Design

**Deal cards** (deals list + dashboard) — add urgency badge:
- Red "X days overdue" if `due_date < now`
- Amber "Due in Xd" if `due_date` within 3 days
- No badge otherwise

**My Queue page** — already shows assigned questions. Add:
- Sort by `due_date ASC NULLS LAST` as default (currently no sort)
- Urgency color on due date: red if overdue, amber if ≤ 3 days
- Count badge on sidebar nav: questions overdue or due within 24h

**No email/push for MVP** — in-app only. Email requires infra not present.

---

## Architecture: How Reusable Answers + RAG Interact

Reusable Answers is NOT added to the KB vector store. It stays as its own table queried separately. Reasons:
- KB chunks are unstructured text fragments; library entries are structured Q&A pairs
- Library retrieval is exact-use (insert verbatim); KB retrieval is context (AI synthesizes)
- Separate table = separate quality control

The AI pipeline (`lib/rag.ts`) is NOT changed for MVP. Similar answers are a human-facing suggestion, not an AI input. This keeps the AI output predictable.

Future: library entries could be prepended as few-shot examples to the AI prompt — out of scope here.

---

## Files Touched

| File | Change |
|---|---|
| `app/api/responses/[id]/approve/route.ts` | Add library upsert + embedding on approve |
| `app/api/library/similar/route.ts` | New: similarity search endpoint |
| `app/(app)/library/page.tsx` | Redesign: remove manual form, show structured list |
| `app/(app)/library/LibraryForm.tsx` | Remove or demote to secondary action |
| `app/(app)/deals/[id]/questions/[qid]/QuestionDetail.tsx` | Add similar answers panel + version history |
| `app/(app)/deals/page.tsx` | Add urgency badges to deal cards |
| `app/(app)/my-queue/page.tsx` | Sort by due date, add urgency colors |
| `components/Sidebar.tsx` | Add overdue count badge on My Queue nav item |
| `migrations/` | `response_library` columns + `response_versions` table |

---

## Out of Scope
- Email/push notifications
- AI prompt injection from library
- Inline diff view (side-by-side is sufficient)
- Bulk export of library
