# Enterprise architecture migration — design

Date: 2026-07-07. Status: **design for founder review — nothing here is built.**
Decision context: founder wants a Python backend, region control, private
networking, an indexer, and independence from Supabase's hosted tier, at a
lower cost than Azure, with a later lift to Azure kept cheap.

## Goals

1. Python backend (FastAPI) — the team's working language for AI.
2. Private networking: database and internal services unreachable from the
   public internet; one hardened public entry point.
3. Region control and portability: everything in containers, no service that
   can't be re-homed (cheap cloud today, Azure later as a redeploy).
4. Nothing breaks during migration: the current app keeps serving users while
   pieces move (strangler pattern), guarded by the eval harness.

## Non-goals

- Rewriting the frontend (Next.js web tier stays; it becomes a thin client of
  the Python API).
- Kubernetes. Container Apps/ECS/Compose-level orchestration is enough.
- Multi-region HA. Single region + backups until customers demand more.

## Target architecture

```
Internet
  │
Cloudflare (CDN / WAF / DDoS)                ← public edge
  │
Load balancer → Web container (Next.js)     ← only public service
  │  private network (VPC) — nothing below has a public IP
  ├─ api        FastAPI (Python) — auth, deals, questions, exports
  ├─ workers    Python — ingest → chunk/embed → extract → structure → generate
  ├─ postgres   managed Postgres + pgvector (private subnet)
  ├─ queue      RabbitMQ (or pgmq to start) — replaces cron drain
  ├─ search     pgvector now; Qdrant/OpenSearch when hybrid ranking is needed
  ├─ storage    S3-compatible (R2/Spaces) via presigned URLs
  ├─ identity   Keycloak (SSO, MFA, SCIM) — replaces Supabase Auth
  └─ secrets    provider secret manager now; Vault when self-hosting matters
```

Hosting: DigitalOcean or AWS (VPC + managed Postgres + container service).
Azure later = push the same images to ACR, run on Container Apps, swap
Postgres/Blob/Service Bus endpoints. No code changes beyond config.

## Component decisions and rationale

| Concern | Choice | Rationale |
|---|---|---|
| API framework | FastAPI + pydantic | Team language; OpenAPI comes free (generates TS client types, replacing the shared-type safety lost by leaving one language) |
| DB | Postgres 16 + pgvector | Schema and migrations port as-is from Supabase; RLS policies re-created verbatim |
| Tenant isolation | Postgres RLS, enforced via per-request `SET ROLE` + JWT claims | Same model as today; the one piece that must not regress (see risks) |
| Queue | Start pgmq (Postgres), move RabbitMQ if volume demands | Preserves the existing enqueue→claim→run→successors job model from `lib/jobs.ts` |
| Auth | Keycloak | Enterprise checklist items (SSO/SAML, MFA, SCIM) that Supabase Auth lacks |
| Doc processing | PyMuPDF, python-mammoth, docxtpl, reportlab | Python equivalents of pdf-parse/mammoth/docxtemplater/pdfkit; templates need re-authoring in docxtpl syntax |
| LLM | Mistral Python SDK behind one module (port of `lib/mistral.ts`) | Same env contract (`LLM_BASE_URL`, `LLM_MODEL`, rate gates) |

## Migration order (strangler — current app keeps running throughout)

1. **Containerize the current Next.js app** (Dockerfile, no code change) —
   proves the deploy pipeline, exits Vercel when convenient.
2. **Stand up the VPC skeleton**: Postgres (private), storage bucket, empty
   FastAPI service behind the LB. Mirror Supabase schema via migrations.
3. **Move document parsing + export generation to Python** — self-contained,
   pure-function domains; validates the pattern with lowest blast radius.
4. **Move the RAG pipeline** (chunk/embed/extract/structure/generate) —
   gate on `npm run eval` parity: Python output must match TS metrics before
   cutover.
5. **Move the job queue to Python workers** (pgmq) — same table semantics.
6. **Move auth last**: Keycloak up, dual-accept sessions during transition,
   re-create RLS with explicit cross-tenant tests before flipping.
7. **Decommission Supabase** once reads/writes are fully off it.

Each step is independently shippable and reversible; the eval harness and
cross-tenant tests are the regression gates.

## Risks

- **RLS re-implementation** is the highest-severity risk (cross-tenant leak
  if wrong). Mitigation: port policies verbatim, add automated two-tenant
  isolation tests that run in CI before any auth cutover.
- **RAG quality drift** — mitigated by eval-parity gate (step 4).
- **DNS rebinding / SSRF class** — keep `safeFetch`-equivalent guards in the
  Python scrape path (httpx with IP validation).
- **docx template re-authoring** — docxtemplater and docxtpl tag syntaxes
  differ; existing customer templates must be converted and diff-tested.

## Cost sketch (monthly, launch scale)

DigitalOcean: ~$95 (LB $12, 2× app containers $30, managed PG $30, Spaces $5,
worker droplet $18) + Cloudflare free tier. AWS comparable at ~1.5×. Azure
later: expect ~2× DO, paid for by enterprise deals that require it.
