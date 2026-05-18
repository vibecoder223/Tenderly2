# Tenderly — Backend Audit (Phase 0)

**Date:** 2026-05-17
**Auditor:** initial-build engineer
**Status:** awaiting sign-off before any code is written or modified

This audit assesses what currently exists in the Tenderly repo against the
RAG build spec, and proposes the smallest viable plan to satisfy the spec's
definition of done. No code has been modified during this audit.

---

## 0. What this codebase actually is

A **Next.js 14 (App Router) + Supabase** application. The "backend" lives
inside the same project as the frontend — every `app/api/*/route.ts` is a
serverless API endpoint, and every server component runs on Vercel/Node.
There is **no Python / FastAPI service**.

- Backend language: **TypeScript**, not Python.
- Total source: ~4,350 lines (`.ts`, `.tsx`, `.sql`).
- Hosted on Vercel; database on Supabase Postgres (Mumbai, `ap-south-1`).
- `pgvector` is **not** installed. No vector store of any kind currently.

The spec table says *"Python (FastAPI) unless the existing backend is in
another lang."* The existing backend is TypeScript, so the audit
recommends **staying on TypeScript and running the RAG pipeline inside the
Next.js project** (with one optional caveat — see §6). Splitting to Python
would double the deploy surface for no real upside given the small scale.

---

## 1. Frontend audit

### 1a. Endpoints the frontend currently calls

| Caller file | Method | Path | Request shape | Expected response |
|---|---|---|---|---|
| `app/auth/onboarding/form.tsx` | POST | `/api/onboarding` | `{ orgName, name }` | `{ ok, org }` |
| `app/(app)/deals/new/form.tsx` | POST | `/api/deals` | `{ name, client_name, value, due_date }` | `{ deal }` |
| `app/(app)/deals/[id]/UploadCard.tsx` | POST (multipart) | `/api/documents/upload` | `file`, `deal_id` | `{ document }` |
| `app/(app)/deals/[id]/UploadCard.tsx` | POST | `/api/documents/process` | `{ document_id }` | `{ ok }` or `{ ok, skipped, reason }` |
| `app/(app)/deals/[id]/triage/TriageActions.tsx` | POST | `/api/documents/process` | `{ document_id }` | `{ ok }` |
| `app/(app)/deals/[id]/triage/AddQuestion.tsx` | POST | `/api/questions` | `{ document_id, requirement_id, question_text, category, priority }` | `{ question }` |
| (SME workspace) | POST | `/api/questions/[id]/respond` | `{ draft_text, tone, status }` | `{ ok }` |
| (SME workspace) | POST | `/api/questions/[id]/assign` | `{ user_id }` | `{ ok }` |
| (SME workspace) | POST | `/api/questions/[id]/regenerate` | `{ tone }` | `{ draft_text }` |
| (Review) | POST | `/api/responses/[id]/approve` | `{ decision, final_text }` | `{ ok }` |
| `app/(app)/deals/[id]/export/ExportControls.tsx` | POST | `/api/exports/generate` | `{ deal_id, document_id }` | `{ exportId }` |
| (Export page) | GET | `/api/exports/[id]/download` | — | binary PDF |
| `app/(app)/library/LibraryForm.tsx` | POST | `/api/library` | `{ category, keyword, response_text }` | `{ ok }` |
| `app/(app)/settings/SettingsForm.tsx` | POST | `/api/settings` | `{ default_ai_tone, ai_model, max_monthly_tokens }` | `{ ok }` |
| `components/Sidebar.tsx` | POST | `/api/auth/signout` | — | 302 |

### 1b. UI surfaces that display backend data

| Surface | File | Backend it relies on |
|---|---|---|
| Deals list / dashboard | `app/(app)/dashboard/page.tsx`, `app/(app)/deals/page.tsx` | `deals`, `documents`, `questions` tables |
| Deal detail | `app/(app)/deals/[id]/page.tsx` | `deals`, `documents` |
| Triage matrix | `app/(app)/deals/[id]/triage/page.tsx` | `extracted_requirements`, `compliance_matrix`, `agent_runs` |
| SME workspace | `app/(app)/deals/[id]/sme/page.tsx` | `questions`, `responses` |
| Review queue | `app/(app)/deals/[id]/review/page.tsx` | `responses` (status=submitted/approved) |
| Export | `app/(app)/deals/[id]/export/page.tsx` | `exports` table, `documents` storage bucket |
| Library | `app/(app)/library/page.tsx` | `response_library` |
| Analytics | `app/(app)/analytics/page.tsx` | `agent_runs` (token/cost), `deals`, `questions` |
| Team | `app/(app)/team/page.tsx` | `team_members` |
| Settings | `app/(app)/settings/page.tsx` | `org_settings` |

### 1c. UI-implied behaviors the backend may not actually provide

| UI claim | Reality | Severity |
|---|---|---|
| Triage page renders "compliance_status" column | Always `pending`. Nothing populates it. | medium |
| Re-run pipeline button | Works, but does the same flawed pass (no citations, no retrieval). | medium |
| Regenerate-with-Claude button | Calls a one-shot Claude prompt with **library context only** — does not retrieve from any past-proposal knowledge base. | **high** |
| "Confidence" / source citation columns implied by the landing page | **No backend support whatsoever.** No citations exist anywhere in the data model. | **critical** |
| Specialist routing (Legal / Security / Finance) per landing page | Not in this codebase. `category` field exists but there's no per-category routing or assignment logic. | high |
| Branded `.docx` export per landing page | Current export is **PDF only**, via `pdfkit`. No Word output. | **critical** |
| Knowledge base ingestion (SharePoint, Drive, past proposals) | Only thing called "library" is a hand-typed paragraph store. No upload, no chunking, no retrieval. | **critical** |

### 1d. Landing-page promises not modelled at all

From `Tenderly Landing page/index.html`:

- **Inline source citations** (`[Drata, 2025 report]`, `[Vault Security SOC2-2026.pdf]`) — no data model, no extraction.
- **Per-requirement confidence score** — not stored.
- **Knowledge base connectors** (SharePoint, Drive, Confluence, Notion, Highspot, Seismic) — no ingestion path.
- **Topic routing** (Legal / Security / Finance / Tech / Product owners) — partial; `category` exists but no per-org owner mapping.
- **"NO_SOURCE" gap detection** — does not exist; current pipeline always generates an answer.
- **`.docx` export with branded template** — does not exist.

---

## 2. Backend audit (subsystem-by-subsystem)

| Subsystem | Status | Notes |
|---|---|---|
| Document upload (PDF, DOCX, multipart) | **WORKS** | `app/api/documents/upload/route.ts`, uploads to Supabase Storage bucket `documents`, dedup by path. Accepts PDF/DOCX/TXT. |
| PDF parsing — text only | **WORKS** | `lib/extract.ts` via `pdf-parse`. **No page numbers, no structure, no tables.** Returns a single flat string. |
| PDF parsing — page numbers + structure | **MISSING** | The current parser flattens everything. Required for citations. |
| DOCX parsing | **WORKS (partial)** | `mammoth.extractRawText` — flat string, no structure. |
| Document chunking | **PARTIAL** | `lib/agents.ts` `chunkText()` uses a regex header detector + 8000-char hard split. **Token-unaware, splits mid-paragraph and mid-list. No section path. No page range carried because the parser doesn't produce them.** |
| Embedding pipeline | **MISSING** | No embedding code, no Voyage / Cohere / OpenAI integration. |
| Vector storage | **MISSING** | `pgvector` not installed in Supabase. No vector column on `document_chunks`. |
| Sparse / BM25 index | **MISSING** | Nothing. |
| Hybrid retrieval (dense + sparse) | **MISSING** | Nothing. |
| Re-ranker (Voyage / Cohere) | **MISSING** | Nothing. |
| Requirement extraction from RFPs | **WORKS (rough)** | `runExtractionAgent` calls Claude Sonnet per chunk, asks for JSON array of requirements with `category`, `priority`, `is_mandatory`. **Schema is close to spec but uses different field names** (`title` vs `text`, `category` vs `topic`, `priority` vs `classification`). No `source_page` (parser doesn't give pages). No structured retry on schema violation. |
| Answer generation | **PARTIAL** | `runResponseGenerationAgent` writes a draft per question with **no retrieval, no citations**. Just a one-shot Claude prompt with optional library snippets injected via concat. |
| Citation extraction (`[c:UUID]` markers) | **MISSING** | Prompt doesn't ask for it, parser doesn't parse it, data model doesn't store it. |
| Confidence scoring | **MISSING** | Not produced. UI implies it but field doesn't exist on `responses`. |
| Gap detection (`no_source` flag) | **MISSING** | The current generator will always invent something rather than emit a "NO_SOURCE" sentinel. **This is the spec's #1 trust failure mode and currently it ships.** |
| Word/`.docx` export | **MISSING** | `app/api/exports/generate/route.ts` produces PDF via `pdfkit`. No Word. |
| PDF export | **WORKS** | Real PDFs, downloadable. Citations not rendered because they don't exist upstream. |
| Auth, RLS, team/org model | **WORKS** | Supabase Auth + RLS policies in `migrations/0001_init.sql`. Out of scope for the RAG build. |
| Cost telemetry | **WORKS** | `agent_runs` table records tokens + estimated $ per run. Will extend cleanly to new agents. |
| Evals | **MISSING** | No `evals/` directory, no test set, no metric harness. |

---

## 3. Existing data layer

- **DB:** Supabase Postgres, project ref `haeepxlfcmacpopdxunm`, region `ap-south-1`.
- **Vector extension:** `pgvector` **not installed**. The `document_chunks` table has no `embedding` column and no `sparse_terms` column.
- **LLM provider:** Anthropic only. Sonnet 4.6 default, Haiku not yet used. `OPENAI_API_KEY` is not configured. No Voyage/Cohere.
- **Storage:** Supabase Storage bucket `documents` exists, holds uploaded RFPs and generated PDFs.

### Tables (current schema)

Reproduced from `migrations/0001_init.sql`:

```
organizations          (id, name, slug, ...)
team_members           (id, org_id, user_id, role, email, name, avatar_url, ...)
deals                  (id, org_id, name, client_name, status, owner_id, value, due_date, ...)
documents              (id, deal_id, filename, file_path, file_size, mime_type,
                        extracted_text, processing_status, error_message, ...)
document_chunks        (id, document_id, chunk_index, section_title, raw_text,
                        cleaned_text, created_at)
                        -- ❌ no embedding, no sparse_terms, no page numbers
extracted_requirements (id, document_id, requirement_id, title, description,
                        category, priority, is_mandatory, compliance_area, ...)
                        -- ❌ no source_page, no `section`
compliance_matrix      (id, document_id, requirement_id, our_capability,
                        compliance_status, notes, ...)
questions              (id, document_id, requirement_id, question_text, category,
                        assigned_to, status, priority, due_date, ...)
responses              (id, question_id, draft_text, final_text, ai_generated_draft,
                        tone, version, status, submitted_by, approved_by,
                        submitted_at, approved_at, ...)
                        -- ❌ no citations, no confidence, no gap_flag
response_library       (id, org_id, category, keyword, response_text, created_by,
                        usage_count, ...)
                        -- doubles as our weak proxy for a "knowledge base"
agent_runs             (id, document_id, agent_type, status, input_tokens,
                        output_tokens, cost, error_message, result, started_at,
                        completed_at, ...)
activity_log           (id, org_id, user_id, action, entity_type, entity_id, metadata, ...)
exports                (id, deal_id, document_id, file_path, format, created_by, ...)
org_settings           (id, org_id, default_ai_tone, ai_model, max_monthly_tokens,
                        integrations, ...)
```

### How the current schema maps to the spec

| Spec entity | Current closest | Gap |
|---|---|---|
| `KnowledgeDocument` | `response_library` (sort of), or `documents` for RFP-side only | No upload path for knowledge docs; no `doc_type`, `text_hash`, `ingestion_status`, `source_url` |
| `Chunk` (with embedding, page, section_path) | `document_chunks` | Missing: `embedding`, `text_for_embedding`, `sparse_terms`, `page_start/end`, `section_path` |
| `RFPDocument` | `documents` | Mostly compatible; `status` enum needs to grow |
| `Requirement` | `extracted_requirements` | Field renames + new `section`, `source_page`, `topic` |
| `AnswerDraft` | `responses` | Missing: `answer_text_with_markers`, `citations`, `confidence`, `gap_flag`, `generated_by` |
| `Citation` | does not exist | Needs new table |

---

## 4. What the customer is actually getting today (worst-case honest read)

If a user uploads a 50-page RFP into the live deployment right now and clicks
through to export, here is what they receive:

1. The RFP text is flat-extracted (no page numbers).
2. Claude reads the flattened text section-by-section and returns a JSON
   array of "requirements" with no source pages and no exact section IDs.
3. Each requirement becomes a "question" with a draft response generated in
   isolation — **with no retrieval against any knowledge base**, and **no
   citations**. The model draws on its training data and a small amount of
   "response library" plain text if the user happened to seed it manually.
4. Drafts are exported as a generic PDF with no citations, no client
   branding, and no Word format option.

The landing page sells trust, citations, and gap detection. **None of those
three properties are currently delivered by the running code.** The product
demos well because the UI renders confidently; the trust layer is missing.

---

## 5. Proposed build plan

The plan keeps the existing TypeScript / Next.js / Supabase stack. It adds
the RAG pipeline as new modules, leaves the working subsystems alone, and
patches the data model in one additive migration. No frontend code is
rewritten; the existing endpoint paths are preserved and the missing
endpoints are added.

### Stack choices reconciled with the spec

| Spec layer | Spec choice | This plan | Reason |
|---|---|---|---|
| Backend lang | Python (FastAPI) unless existing is other | **TypeScript / Next.js** | Existing backend is TS. Splitting stacks doubles ops. |
| PDF parsing | `unstructured[pdf]` | **One small Python sidecar service** OR `pdfjs-dist` + `mammoth` in TS | `unstructured` is best-in-class but Python-only. See §6 trade-off. |
| Embeddings | Voyage `voyage-3-large` 1024d | Voyage `voyage-3-large` via HTTP from Node | SDK-less HTTP call is trivial in TS. |
| Vector store | pgvector (because Postgres exists) | **pgvector** | Already on Postgres. Install extension + add `embedding vector(1024)` to chunks table. |
| Sparse | `rank_bm25` | TypeScript BM25 in-memory, scoped per workspace + per query | No reason to spin up another store at this scale. |
| Re-ranker | Voyage `rerank-2` or Cohere `rerank-3` | Voyage `rerank-2` (already authed with Voyage) | One vendor for embed + rerank. |
| Generation | Claude Sonnet 4.6 | **Claude Sonnet 4.6** | Already wired. |
| Cheap calls | Claude Haiku 4.5 | **Claude Haiku 4.5** | Add to `lib/anthropic.ts`. |
| Word export | `python-docx` | **`docx` (npm pkg)** — `docx@9.x` | Native TS, same template fidelity for our use. |

### Order of work

**M1 — Data model (1 migration, additive only).**
- Enable `pgvector`.
- New tables: `knowledge_documents`, `citations`.
- Extend `document_chunks` with `embedding vector(1024)`, `text_for_embedding`,
  `sparse_terms text[]`, `page_start int`, `page_end int`, `section_path text`,
  `text_hash text`. Backfill where possible; old chunks get null embeddings
  (re-ingested on next run).
- Extend `extracted_requirements` with `section`, `source_page`, `classification`
  (mirror of existing `is_mandatory`), `topic` (mirror of `category`).
- Extend `responses` with `answer_text_with_markers`, `confidence numeric`,
  `gap_flag text`, `generated_by text`.
- Storage bucket `knowledge` (separate from `documents`).

**M2 — Ingestion pipeline for knowledge base.**
- New routes: `POST /api/knowledge/upload`, `GET /api/knowledge`,
  `DELETE /api/knowledge/[id]`.
- Replace flat `pdf-parse` with a page-aware parser. **Either:**
  - **Option A (recommended):** keep TS, add `pdfjs-dist` to extract per-page
    text + a layout-aware section splitter. Faster to ship, no second runtime.
  - **Option B:** Python sidecar running `unstructured[pdf]`, called over HTTP
    from the Next.js API. Better extraction quality on scanned/multi-column
    PDFs at the cost of a second service to deploy.
- Token-aware chunker (400–600 tokens per chunk, never split mid-paragraph).
- Voyage embeddings, batched 64/call.
- BM25 index per workspace (computed at retrieval time from `sparse_terms`).
- `text_hash` dedup. Status transitions: `pending → processing → ready | failed`.

**M3 — RFP requirement extraction (repair, don't rewrite).**
- Keep current Claude-based extractor.
- Patch prompt to include the spec's exact JSON contract.
- Add **page numbers** to the prompt context (now possible because of M2).
- Add Pydantic-style validation in TS via `zod`, with 2-retry loop on schema
  failure.

**M4 — Retrieval (new).**
- Query expansion via Haiku (2 paraphrases + 5 keywords).
- Dense + sparse retrieval, union/dedup ~30 candidates.
- Voyage `rerank-2`, keep top-6.
- If top-1 reranked score `< 0.40`, set `gap_flag = 'no_source'` and skip
  generation for that requirement.

**M5 — Generation with citations.**
- Replace `runResponseGenerationAgent` with a citation-grounded version using
  the system + user prompts from the spec verbatim.
- Parse `[c:UUID]` markers, persist `citations` rows, store both marker and
  clean text.
- Haiku confidence pass after each generation. Sub-0.7 flips the response to
  `requires_review`.

**M6 — `.docx` export.**
- Add `docx` npm package.
- New `POST /api/exports/generate` branch for format=`docx`.
- Inline citation format: `[Source: filename, p.{page}]` or footnotes per
  export option.

**M7 — Evals.**
- `evals/rag_eval.jsonl` with 30 hand-curated entries (25 positive, 5
  no-source).
- `scripts/eval.mjs` runs the pipeline against the eval set, reports the
  four required metrics. Output committed under `evals/results/`.

**M8 — Handoff doc.**
- `RAG.md` at repo root with pipeline diagram, version-tagged prompts,
  latest eval results, three follow-up suggestions.

### What gets repaired vs left alone

| Area | Action |
|---|---|
| Auth, RLS, onboarding, team, deals CRUD, dashboard, library, settings UI | Left alone. |
| `pdf-parse` flat extraction | Replaced (M2). Old function deleted only after new path is live. |
| `chunkText()` regex chunker | Replaced (M2). |
| `runIngestionAgent` / `runChunkingAgent` on the RFP side | Repaired to use new parser + chunker so RFP-side chunks also get pages + section paths. |
| `runExtractionAgent` | Repaired (M3). |
| `runResponseGenerationAgent` | Rewritten (M4–M5). The new version pulls from retrieval, not from `response_library`. |
| `runStructuringAgent` | Left alone; compliance matrix still derives from extracted requirements. |
| PDF export | Left alone as a fallback. `.docx` added alongside (M6). |
| `app/(app)/library/*` | Kept as a separate manual-snippets table. The new knowledge base is **additional**, not a replacement. |

### Frontend assumptions the new backend will satisfy

The new backend will preserve every endpoint path the frontend currently
calls (§1a), with the same response shape, **plus** add these new endpoints
for the new UI surfaces that don't exist yet:

- `POST /api/knowledge/upload`
- `GET /api/knowledge`
- `DELETE /api/knowledge/[id]`

The first surface that consumes citations + confidence is the SME workspace
and review page; those pages currently render `responses.draft_text` and
will gracefully render the new fields if present, so no UI change is needed
for v1. If the citation **chips** in the landing-page screenshots are
required in the product, that is a UI add and will be raised as a separate
sign-off per the spec's frontend rule.

### Out of scope (explicit, per the spec)

- Multi-step agent loops.
- Fine-tuning.
- Streaming.
- User-facing model selection.
- An embedding cache layer (text_hash dedup suffices).
- Connectors for SharePoint / Drive / Confluence (landing-page promise; not
  in spec definition of done). Upload-only KB for v1.

---

## 6. The one open call — parser choice

The spec mandates `unstructured[pdf]` which is Python. Two ways to satisfy:

**Option A — Pure TS with `pdfjs-dist`.**
- Pros: one runtime, one deploy, faster to ship, fits Vercel serverless cleanly.
- Cons: weaker on scanned PDFs, weaker on complex tables / multi-column layouts.
  Adequate for the bulk of typed RFPs.

**Option B — Python sidecar (FastAPI) with `unstructured[pdf]`.**
- Pros: best-in-class parsing. Matches spec verbatim.
- Cons: second service to deploy and monitor (Vercel doesn't run Python on
  Hobby; we'd use Fly.io / Render / Railway). Extra cost and complexity.

Recommendation: **start with Option A**, ship M1–M8. If eval metrics on
real customer PDFs miss the ≥85% citation accuracy target due to parser
quality, swap in Option B as a drop-in behind the same `parseDocument()`
interface. The boundary is small enough that switching is a 1-day job.

---

## 7. Open questions for sign-off

1. **Parser:** approve Option A (pure TS) for M1, with Option B as a
   contingency? Or go straight to Option B?
2. **Knowledge base scope for v1:** upload-only, or also build a stub
   connector for at least one of SharePoint / Drive (a hard build, ~3
   extra days)?
3. **Frontend citation UI:** the existing SME workspace renders plain text.
   To actually surface citations to the user, the response panel needs new
   chip components and a side panel showing the cited chunk. This is a UI
   change. Approve as part of this build, or surface separately?
4. **Voyage / Cohere API key:** these need to be provisioned. Voyage offers
   a free tier sufficient for development; Cohere similar. Customer to
   create the account or delegate?
5. **`.docx` template:** is there a branded template file to use, or do we
   use a sensible default with Heading 1 / Heading 2 / Body styles?

---

## 8. Awaiting approval

**No code will be written or modified until this audit is signed off.**

Please respond with one of:

- **"Approved — go"** — proceed with the plan as written.
- **"Approved with changes: …"** — list modifications.
- **"Needs more detail on §X"** — I'll dig further.
