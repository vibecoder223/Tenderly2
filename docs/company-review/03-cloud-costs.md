# Propello — cloud hosting and cost plan

Principle up front: **a founder should not over-engineer before customers.** Propello's
stack is already serverless (Next.js + Supabase + LLM APIs). The correct move at 0–20 users
is to keep it, pay ~$50/month, and spend zero hours on infrastructure. Kubernetes, AWS
accounts, and multi-region come when revenue demands them.

## Provider decision

The app is a Next.js monolith with Supabase (Postgres + auth + storage) and API-based LLMs.
Comparing on: cost at 20 users, ops burden for a solo founder, and fit for the existing code.

| Option | Cost at 20 users | Ops burden | Fit with current code | Verdict |
|---|---|---|---|---|
| **Vercel + Supabase** | ~$45–70/mo | Near zero | 1:1 — it's what the code targets | **Chosen** |
| AWS (Amplify/ECS + RDS + Cognito) | ~$150–300/mo | High — VPC, IAM, RDS sizing | Requires rebuilding auth/storage | No — pay more to work more |
| Google Cloud (Cloud Run + Cloud SQL) | ~$80–150/mo | Medium | Requires replacing Supabase or self-hosting it | No — Cloud SQL alone (~$50+) exceeds the whole Vercel+Supabase bill |
| Azure (App Service + Azure SQL) | ~$150+/mo | Medium-high | Worst Next.js fit of the three | No — relevant later only if Gulf gov customers demand Azure region hosting |
| Hetzner/Fly.io self-host | ~$20/mo | High (you are the SRE) | Possible | No — saves $30/mo, costs founder-days |

**Why Vercel + Supabase wins:** the code already targets it, both have genuinely usable free
tiers, both scale by changing a plan not an architecture, and the founder's time is the
scarcest resource. The one caveat: background job draining via HTTP route needs Vercel's
function timeout limits respected (see audit doc 04).

One decision to make deliberately later, not now: **data residency.** Gulf government
customers may require in-region hosting. Supabase offers region selection at project
creation — if most early customers are Qatar/UAE, create the production project in a
nearby region (e.g. AWS me-south / eu-central) from day one, because migrating regions
later is a real project.

## Architecture (all stages)

```
Browser ── Vercel (Next.js app + API routes + cron)
              │
              ├── Supabase: Postgres (+pgvector), Auth, Storage (uploaded RFPs)
              ├── LLM API (Mistral, OpenAI-compatible / provider-agnostic): extraction, drafting
              ├── Embeddings API: chunk + query embeddings
              └── Email (Resend): auth + notification email
```

This covers every requirement: AI document processing (API-based, no GPUs to rent),
authentication (Supabase Auth), database (Postgres + pgvector), file storage (Supabase
Storage), API backend (Next.js routes), background jobs (job table + drain route + cron),
email (Resend), monitoring (Vercel logs + Sentry free tier + UptimeRobot free).

## Stage 1 — MVP, 0–20 users

| Service | Plan | $/month |
|---|---|---|
| Vercel | Pro (needed for cron + team + longer function timeouts) | $20 |
| Supabase | Pro (daily backups, no project pausing, 8GB DB, 100GB storage) | $25 |
| Resend (email) | Free tier (3k emails/mo) | $0 |
| Mistral LLM API | Pay-as-you-go (paid tier), ~200 documents/mo | $5–30 |
| Embeddings | Pay-as-you-go | $1–5 |
| Sentry + UptimeRobot | Free tiers | $0 |
| Domain + Cloudflare DNS | — | ~$2 |
| **Total** | | **~$55–85/month** |

LLM cost reality check: a 65-page RFP with 255 questions costs roughly $0.10–0.50 to
process end to end on Mistral pricing (extraction + drafting + embeddings). Even at
100 RFPs/month that is under $50. AI cost is not the problem at this stage; deliverability,
reliability, and onboarding are.

Limitations accepted at this stage (deliberately): single region, function timeout caps on
very large documents (mitigated by chunked job processing), no SLA to customers beyond
best-effort, no SOC 2.

## Stage 2 — growth, 20–100 users

What changes (config, not architecture):

- **Supabase Pro compute add-on** ($10–50/mo) as Postgres CPU grows with pgvector queries;
  add read indexes, tune vector index (HNSW), enable PITR backups (+$10).
- **Vercel** stays Pro; watch function invocation and bandwidth overages (~$20–50/mo extra).
- **Dedicated queue if job volume outgrows the drain route:** move background jobs to
  Inngest or Trigger.dev (free → $20/mo) for retries, concurrency control, and observability
  instead of hand-rolled drain. This is the first real architectural improvement to buy.
- **Email** → Resend paid ($20/mo) with a dedicated domain and DMARC.
- **Monitoring** → Sentry Team ($26/mo), plus a status page.
- **AI cost optimization begins to matter:** cache extraction results per document hash,
  reuse answer-library hits before calling the LLM (the product already wants this),
  batch embeddings.

**Total: ~$150–350/month.** Still no DevOps hire, no containers.

## Stage 3 — scale, 100–1,000 users

Now, and only now, architecture changes are justified:

1. **Database:** Supabase scales to large compute tiers (or migrate to dedicated Postgres —
   AWS RDS / Crunchy) with a read replica for analytics; pgvector may split into a dedicated
   vector store (e.g. pgvector on its own instance, or Turbopuffer/Qdrant) if corpus size
   demands it.
2. **Processing tier:** document ingestion and generation move off serverless functions into
   containerized workers (Fly.io / Cloud Run / ECS) consuming a real queue — this removes
   timeout ceilings and lets you control LLM concurrency and rate limits centrally.
3. **Caching:** Redis (Upstash) for session-hot data, retrieval caches, and rate limiting.
4. **Load balancing / regions:** Vercel handles the web tier; workers scale horizontally.
   Multi-region only if Gulf data-residency contracts require it — then a second Supabase
   project in-region, not a global active-active build.
5. **AI cost optimization at scale:** model tiering (cheap model for extraction and
   classification, stronger model only for final drafting), answer-library-first retrieval so
   repeat questions cost $0, per-customer token budgets, and renegotiated committed-use LLM
   pricing.
6. **Compliance:** SOC 2 Type I (~$20–40k with an automation vendor like Vanta ~$10k/yr)
   once enterprise contracts require it.

**Total: ~$1,500–4,000/month at 1,000 users** — roughly 3–5% of the revenue those users
represent, which is a healthy infrastructure ratio for AI SaaS.

## Cost per customer summary

| Stage | Users | Infra $/mo | Infra per user |
|---|---|---|---|
| MVP | 20 | ~$70 | ~$3.50 |
| Growth | 100 | ~$250 | ~$2.50 |
| Scale | 1,000 | ~$2,500 | ~$2.50 |

At $149/seat pricing, infrastructure is ~2% of revenue at every stage. The margin story
holds; the founder's job is customers, not clusters.
