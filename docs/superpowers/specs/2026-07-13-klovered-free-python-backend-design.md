# Klovered Free — Python backend migration (design)

Date: 2026-07-13. Status: **design for review — nothing built.**

Decision context: the free tool ([[klovered-free-public-tool]]) currently has a
TypeScript backend (Next.js API routes + `lib/*` pipeline). The founder wants the
free version's **backend in Python** to align with the enterprise direction
([enterprise architecture spec](2026-07-07-enterprise-architecture-design.md)),
while the **frontend stays Next.js**. Data + auth layer stays on Supabase for the
free tool (Option A, chosen for safety — see "Isolation").

## Goals

1. Move the free tool's document/RAG/export pipeline from TypeScript to a Python
   (FastAPI) service, matching the enterprise spec's library choices so the code
   is a stepping stone, not a throwaway.
2. Keep the Next.js app as a thin client: it renders the 3 screens and owns only
   Supabase-coupled concerns (guest-session bootstrap, Google-link callback).
3. **Never regress cross-tenant isolation** — the highest-severity risk for a
   public tool where strangers upload confidential RFPs into a shared database.
4. Ship incrementally (strangler): the TS routes keep serving until each Python
   slice is proven, so the tool is never broken mid-migration.

## Non-goals

- Rewriting the frontend. The three ported screens (`KnowledgeView`,
  `RfpUpload`, `AnswersList`) and `globals.css` stay exactly as they are.
- Leaving Supabase. The free tool keeps Supabase Postgres + Storage + anonymous
  Auth. Own-Postgres/Keycloak is the *enterprise* end-state, not this.
- Replacing the queue model. Same `jobs` table + enqueue→claim→drain semantics,
  reimplemented in Python.
- Kubernetes / multi-region. One container is enough at free-tier scale.

## Repository layout

Backend lives **inside `klovered-free`** as a sibling of the Next.js app:

```
klovered-free/
  app/            # Next.js (unchanged screens + the routes that STAY)
  components/     # unchanged
  lib/            # TS pipeline — deleted slice-by-slice as Python takes over
  backend/        # NEW — FastAPI service
    app/
      main.py             # FastAPI app + router registration
      config.py           # env (LLM_*, SUPABASE_*, CRON_SECRET), pydantic-settings
      auth.py             # verify Supabase JWT (JWKS), resolve org from claims
      supabase_rest.py    # PostgREST client bound to a caller's JWT (RLS path)
      db.py               # service-role Postgres/PostgREST client (worker path)
      routers/            # documents, knowledge, answers, exports, jobs
      pipeline/           # parse, chunk, embed, extract, structure, generate
      queue/              # enqueue / claim / drain (port of lib/jobs.ts)
      mistral.py          # LLM module (port of lib/mistral.ts, same env contract)
    pyproject.toml
    Dockerfile
    tests/
```

Local dev runs two processes: `next dev -p 3100` and `uvicorn` on `:8000`. Next
proxies `/api/pipeline/*` to the Python service (rewrite in `next.config`), or
the browser calls the Python origin directly via `NEXT_PUBLIC_API_URL`. Default:
**Next rewrite proxy**, so the browser keeps one origin and cookies flow.

## The auth / data boundary (what moves, what stays)

Two classes of backend work, split by trust level:

**Stays in Next.js** (Supabase-SSR-coupled, small, not worth porting):
- `GET/POST /api/session` — guest bootstrap (anonymous sign-in + org provision).
- `GET /api/auth/callback` — Google `linkIdentity` redirect handler.
- Supabase client cookie wiring (`utils/supabase/*`, middleware).

**Moves to Python** (the actual pipeline + its request surface):
- `documents/upload`, `documents/process`, `documents/[id]`
- `knowledge`, `knowledge/upload`, `knowledge/[id]`
- `answers`
- `exports/generate`, `exports/[id]/download`
- `jobs/drain`, `cron/cleanup`
- everything in `lib/` (parse, chunk, embeddings, extract, agents, rag,
  retrieval, ingest, jobs, mistral, docx-export, answer-library, rate-limit,
  safe-fetch).

### Isolation (Option A — the safe one)

Two DB access paths in Python, mirroring today's TS split:

1. **Request path (user-facing reads/writes)** — the browser sends the guest's
   Supabase access-token (already in a cookie) to the Python endpoint; Python
   forwards it as the `Authorization: Bearer` to **PostgREST**. Postgres RLS
   enforces org isolation exactly as it does today — a query bug cannot leak
   another guest's rows because the database refuses them. Python additionally
   verifies the JWT signature locally (JWKS) and resolves `org_id` from
   `team_members` for enqueue metadata.

2. **Worker path (pipeline stages)** — the drain/worker uses the service-role
   key and bypasses RLS, exactly as `lib/jobs.ts` does today via the admin
   client. This is trusted background code operating on a document whose
   `org_id` was fixed at enqueue time; it never mixes tenants because each job
   row carries its own `document_id` + `org_id`.

This preserves the property verified in [[klovered-free-public-tool]] (guest B
cannot read guest A's data) with the database as the backstop, not app code.

## Pipeline port — library mapping

Same behavior, Python equivalents (matching the enterprise spec):

| TS (`lib/`)        | Python                          |
|--------------------|---------------------------------|
| `parse.ts` (pdf-parse, mammoth) | PyMuPDF (`fitz`), `mammoth` |
| `chunk.ts`         | pure Python port                |
| `embeddings.ts` (Jina) | `httpx` call, same API contract |
| `extract.ts` / `agents.ts` | pure port; prompts moved verbatim |
| `rag.ts` / `retrieval.ts` | pure port; pgvector query via PostgREST/SQL |
| `mistral.ts`       | `mistralai` SDK, same `LLM_*` env + rate gate |
| `docx-export.ts` (docxtemplater) | `docxtpl` — **template re-authored** |
| `jobs.ts`          | port; same `jobs` table + RPCs (`claim_jobs`, `recover_stuck_jobs`) |
| `rate-limit.ts`    | port; same Postgres-backed counters |
| `safe-fetch.ts`    | `httpx` + IP validation (SSRF guard) |

No schema changes — Python reads/writes the same Supabase tables and calls the
same Postgres RPCs. The `.docx` template is the one artifact needing manual
re-authoring (docxtemplater `{tags}` → docxtpl Jinja syntax), diff-tested against
current output.

## Migration order (strangler — TS keeps serving throughout)

Each phase is independently shippable and reversible. A phase "cuts over" by
flipping the Next rewrite for those paths from the TS route to the Python service.

1. **Scaffold** — `backend/` FastAPI skeleton, `config.py`, `auth.py` (JWT verify
   + org resolve), `supabase_rest.py`, `db.py`, Dockerfile, health check.
   Verify: guest JWT verified, `/health` green, no route cutover yet.
2. **Parsing + export** (lowest blast radius, pure functions): port `parse`,
   `docx-export`; move `documents/[id]` read + `exports/*`. Re-author the docx
   template; diff-test the exported file byte-for-content against TS output.
3. **RAG pipeline**: port `chunk`, `embeddings`, `extract`, `agents`, `rag`,
   `retrieval`, `ingest`. Gate cutover on **eval parity** — Python answers must
   match TS metrics on the existing eval set before flipping `documents/process`.
4. **Queue + workers**: port `jobs`; move `jobs/drain` + `cron/cleanup` to a
   Python worker loop (same `jobs` table semantics, same RPCs).
5. **Request surface**: move `documents/upload`, `knowledge*`, `answers` to
   Python (JWT-forwarded RLS path). Delete the corresponding TS routes + `lib/`.
6. **Cleanup**: remove dead `lib/` modules; Next keeps only session + callback.

Auth/session and the Google callback **never move** (they stay in Next.js), so
the enterprise spec's riskiest step (auth cutover) is out of scope here.

## Testing & gates

- **Two-tenant isolation test** (highest priority): automated test that guest B's
  JWT cannot read/download/export guest A's document via any Python endpoint. Runs
  in CI; must pass before any request-surface cutover (phase 5).
- **Eval parity** before phase 3 cutover: `npm run eval` equivalent — Python RAG
  output vs. TS baseline on the current eval set.
- **Export diff test** before phase 2 cutover: generated `.docx` content matches.
- **Rate-limit tests**: doc cap, upload/hr, RFP/session, session/IP — same
  thresholds verified in [[klovered-free-public-tool]], re-verified against Python.
- Each phase keeps the existing over-HTTP guardrail checks green.

## Risks

- **RLS via forwarded JWT** must actually reach PostgREST with the right token on
  every request-path query. Mitigation: single `supabase_rest.py` chokepoint; the
  two-tenant test is the gate.
- **docx template re-authoring** — syntax differs; diff-test before cutover.
- **RAG quality drift** — eval-parity gate.
- **Two languages during migration** — mitigated by the strangler order; only one
  path is authoritative per route at a time (the Next rewrite decides which).
- **Local dev friction** (two processes) — a `dev` script / Procfile starts both.

## Cost / ops

One extra always-on container (uvicorn) next to the Next.js app. At free-tier
scale this is a single small instance; the worker loop can share it initially and
split out only if drain latency demands. Azure-later path is unchanged from the
enterprise spec (push the same image, swap endpoints).
