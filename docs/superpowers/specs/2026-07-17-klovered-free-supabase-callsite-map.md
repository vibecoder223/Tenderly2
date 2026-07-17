# klovered-free: Supabase call-site → Python `/api/*` map

**Date:** 2026-07-17
**Purpose:** Turn Phase 1 (tool rewire off Supabase) into a placeholder-free
plan, and pin down exactly which backend endpoints are still missing.
**Source:** `grep -rn 'supabase|createClient|.from(|.auth.|.storage.'` over
`klovered-free` → 155 hits across 31 files.

## The key framing (this is not a 155-call rewrite)

`klovered-free` is today a **full-stack** Next.js app: its `app/api/*` routes and
`lib/*` modules run the whole RAG pipeline server-side against Supabase. In the
target architecture the **Python `api` container owns all of that**. So the
rewire is not "translate 155 Supabase calls to psycopg" — it is:

- **DELETE** the tool's server-side pipeline (`app/api/*`, `lib/*`, the server
  Supabase clients). The Python backend already reimplements it
  (`app/pipeline/*`, `app/routers/*`).
- **REWIRE** only the tool's *client-side* Supabase calls into
  `fetch('/api/*', { credentials: 'include' })` against the Python backend.
- The tool becomes a **thin client**: pages + components + a small `lib/api.ts`.

## Table A — client-side files to REWIRE → Python `/api/*`

| File | Current Supabase use | Replace with | Backend endpoint | Status |
|---|---|---|---|---|
| `lib/use-session.ts` | `auth.getSession()`, `auth.signInAnonymously()`, then `POST /api/session` | one call to bootstrap/read a guest | `POST /api/auth/guest`, `GET /api/auth/me` | **exists** |
| `components/AuthModal.tsx` | `auth.updateUser` (signup upgrade), `auth.signInWithPassword`, `auth.linkIdentity` (Google) | email/pw + Google, guest-upgrade | `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/google/start` | **exists** (signup upgrade added Gate 0 Task 1/2) |
| `components/AuthButton.tsx` | reads session, sign-out | session badge + logout | `GET /api/auth/me`, `POST /api/auth/logout` | **exists** |
| `components/KnowledgeView.tsx` | knowledge list/upload/delete (via fetch to its own `app/api/knowledge/*`, some direct client reads) | fetch Python knowledge routes | `GET /api/knowledge`, `POST /api/knowledge/upload`, `DELETE /api/knowledge/{id}` | **exists** |
| `utils/supabase/client.ts` | browser client factory | **delete**; `lib/api.ts` fetch helper | — | replace |
| `utils/auth.ts`, `utils/activity.ts` | client auth/activity helpers | fold into `lib/api.ts` or delete | `GET /api/auth/me` | **exists** |

The tool's own **page/flow** files (`app/page.tsx`, `app/knowledge/page.tsx`,
`app/rfp/page.tsx`, `app/answers/page.tsx`) call the tool's *own* `app/api/*`
routes today; after the rewire they call the Python `/api/*` routes instead
(directly or through `lib/api.ts`).

## Table B — server-side files to DELETE (Python already replaces them)

| Tool file(s) | Python replacement |
|---|---|
| `app/api/session/route.ts` | `POST /api/auth/guest` |
| `app/api/auth/callback/route.ts` | `GET /api/auth/google/callback` |
| `app/api/documents/upload/route.ts` | `POST /api/pipeline/documents/upload` |
| `app/api/documents/process/route.ts` | `POST /api/pipeline/documents/process` (kicks drain in-process) |
| `app/api/documents/[id]/route.ts` (status GET, delete) | **GAP — see Table C #3** |
| `app/api/knowledge/route.ts` (list) | `GET /api/knowledge` |
| `app/api/knowledge/upload/route.ts` | `POST /api/knowledge/upload` |
| `app/api/knowledge/[id]/route.ts` (delete) | `DELETE /api/knowledge/{id}` |
| `app/api/answers/route.ts` (read requirements+responses+citations) | **GAP — see Table C #1** |
| `app/api/exports/generate` + `app/api/exports/[id]/download` | **GAP — see Table C #2** |
| `app/api/jobs/drain/route.ts` | `POST /api/pipeline/jobs/drain` (cron-gated; tool no longer needs to call it — process kicks drain itself) |
| `app/api/cron/cleanup/route.ts` | `POST /api/cron/cleanup` (server cron, not client-called) |
| `lib/agents.ts, rag.ts, retrieval.ts, jobs.ts, ingest.ts, chunk.ts, embeddings.ts, mistral.ts` | `app/pipeline/*` (ported) |
| `lib/answer-library.ts, docx-template-fill.ts, safe-fetch.ts` | deferred ports (see migration memory) |
| `utils/supabase/{server,admin,middleware}.ts` | psycopg `db.user_tx` / `db.admin_tx` in the backend |

## Table C — Backend GAPS to build before Phase 1 can finish

These are the only genuinely missing backend capabilities. They become the
"Backend gaps" plan that runs after Gate 0 and before/with Phase 1.

1. **Read answers for a deal** — replaces `app/api/answers/route.ts`.
   `GET /api/pipeline/deals/{deal_id}/answers` (RLS via `user_tx`): returns the
   deal's `extracted_requirements` joined to `questions`/`responses` +
   `citations` (answer text, confidence, gap flag, cited chunks), plus each
   document's `processing_status` so the tool can poll progress. Shape must
   match what `app/answers/page.tsx` renders — spec the exact JSON in the gaps
   plan by reading that page.
2. **`.docx` export** — replaces `app/api/exports/*`. `POST /api/pipeline/deals/
   {deal_id}/export` → returns/streams a `.docx`. Needs the deferred `docx`
   port (`lib/docx-export.ts` / `docx-template-fill.ts` → `docxtpl`). Largest
   gap; may ship after a v1 that offers copy/download-as-text if we want the
   tool live sooner.
3. **Document status + delete** — replaces `app/api/documents/[id]/route.ts`.
   Confirm whether the tool polls document `processing_status` via this route
   or via the answers read (#1). If a standalone probe/delete is needed:
   `GET /api/pipeline/documents/{id}` (status) and `DELETE /api/pipeline/
   documents/{id}` (remove the RFP, freeing the one-per-session cap). Low effort.

## Endpoints that already exist and need no work

`/api/auth/{guest,signup,login,logout,me}`, `/api/auth/google/{start,callback}`,
`/api/knowledge` (GET), `/api/knowledge/upload`, `/api/knowledge/{id}`
(GET/DELETE), `/api/pipeline/documents/{upload,process}`, `/api/pipeline/parse`,
`/api/pipeline/whoami`, `/api/pipeline/jobs/drain`, `/api/cron/cleanup`.

## Consequence for Phase 1 sequencing

1. Build Table C gaps (#1 required, #3 likely, #2 possibly deferred) on the
   Python backend — own small plan, TDD, verified on the Droplet/CI.
2. Then rewire the tool: add `lib/api.ts`; rewire the Table A client files;
   delete the Table B server files; drop `@supabase/*` deps. Verify locally
   against the backend (guest → knowledge → RFP → answers; signup-preserves-work;
   isolation).
