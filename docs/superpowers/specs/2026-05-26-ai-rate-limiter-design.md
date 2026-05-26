# AI Rate Limiter + Failure Surfacing

**Date:** 2026-05-26
**Status:** Approved for implementation

## Problem

Document processing intermittently breaks because of rate-limit 429s from Groq (LLM) and Voyage (embeddings/rerank). Failures are silent: zero vectors get stored, extraction returns empty arrays, rerank degrades to identity scores. The doc looks "processed" but retrieval and answers are garbage. Users hit retry, retry storms make 429s worse, the cycle repeats.

Four AI providers are wired (Groq, OpenRouter, Jina, Voyage). Two are dead weight (OpenRouter unused post-Groq-migration, Voyage redundant since Jina was wired up).

## Decisions

1. **Drop OpenRouter and Voyage** — remove env keys, code paths, fallback chains.
2. **Two providers only:** Groq (LLM) + Jina (embeddings, reranking).
3. **No provider fallbacks.** Without fallback, the limiter must prevent failures instead of catching them.
4. **One central rate limiter** wraps every external AI call.
5. **Surface failures loudly.** No more silent zero-vectors, no more empty extractions moving forward.

## Architecture

### Provider stack (final)

| Role | Provider | Model |
|---|---|---|
| Fast LLM (extraction, retrieval expansion) | Groq | `llama-3.1-8b-instant` |
| Quality LLM (response generation) | Groq | `llama-3.3-70b-versatile` |
| Embeddings | Jina | `jina-embeddings-v3` (1024-dim) |
| Reranking | Jina | `jina-reranker-v2-base-multilingual` |

### Rate limiter (`lib/rate-limiter.ts`)

Generic token-bucket + FIFO queue, keyed by provider name. Per-key config: RPM, TPM, max concurrent.

**Bucket config (free tier defaults):**

| Key | RPM | TPM | Concurrent |
|---|---|---|---|
| `groq-70b` | 30 | 6000 | 2 |
| `groq-8b` | 30 | 120000 | 4 |
| `jina-embed` | 60 | 1000000 | 4 |
| `jina-rerank` | 60 | 1000000 | 2 |

All values override via env vars (`RATE_LIMIT_<KEY>_RPM`, etc.) so paid tier can lift caps with no code change.

### Behavior

1. **Throttle proactively.** Before each call, estimate tokens (input chars / 4). If next call would exceed RPM or TPM window, queue caller and sleep until budget refills.
2. **FIFO queue.** When budget exhausted, queued callers wake in arrival order.
3. **Adaptive 429 backoff.** If API returns 429 despite throttling, parse `retry-after`, freeze entire bucket for that duration, then resume queue. Jitter ±20% to avoid lock-step retries when multiple processes share the limiter.
4. **Update bucket with real usage.** After response, replace token estimate with actual `usage.prompt_tokens + completion_tokens` to keep accounting honest.
5. **Terminal failure.** After 3 consecutive 429s on the same call, throw a `RateLimitError`. Callers must catch and persist a failure state — no silent degradation.

### Failure surfacing

| Old behavior | New behavior |
|---|---|
| Embedding fails → zero vectors stored | Throw → caller sets `documents.status = "embedding_failed"`, `last_error` populated |
| Extraction returns empty after retries | Throw → `status = "extraction_failed"`, halt pipeline |
| Rerank fails | Skip rerank step, log warning, continue (degraded but not broken) |

**DB migration:** Add `last_error TEXT NULL` column to `documents` table.

**Status enum addition:** Add `embedding_failed`, `extraction_failed`, `generation_failed` to allowed `documents.status` values.

**UI:** Document row shows red badge on failed status, retry button hits existing process endpoint.

### Code layout

```
lib/rate-limiter.ts         (new) Token-bucket + queue, generic
lib/groq.ts                 (refactor) Routes through limiter; drops manual retry loop
lib/embeddings.ts           (refactor) Jina-only; routes through limiter; removes Voyage
lib/agents.ts               (refactor) Drops manual concurrency knobs; trusts limiter
lib/rag.ts                  (cleanup) Removes OpenRouter gate check
lib/retrieval.ts            (cleanup) Removes OpenRouter gate check
app/api/questions/[id]/regenerate/route.ts  (cleanup) Removes OpenRouter gate check
db/migrations/0009_documents_last_error.sql (new) DB column + status enum
```

## Implementation phases

1. **Cleanup** — remove OpenRouter + Voyage references everywhere
2. **Rate limiter** — build `lib/rate-limiter.ts`
3. **Wire Groq** — refactor `lib/groq.ts` to use limiter
4. **Wire Jina** — refactor `lib/embeddings.ts` to use limiter; remove Voyage
5. **Simplify agents** — drop hand-tuned concurrency, trust limiter
6. **DB migration** — `last_error` column, expanded status enum
7. **Surface failures** — update agent error handlers to persist failure status
8. **UI retry** — badge on failed docs, retry button

## Out of scope

- Idempotent resume from mid-batch failure (separate work)
- Migration to paid LLM/embedding tiers (user decision, no code work)
- Switching to OpenAI/Anthropic (not chosen)

## Risk

Rate limiter introduces a queueing layer; bugs here block all AI traffic. Mitigations:
- Bucket parameters env-tunable so prod can adjust without redeploy.
- Limiter has a kill-switch env var `RATE_LIMITER_DISABLED=1` to bypass entirely.
- Conservative defaults; logging on every queue/wait/throttle event.
