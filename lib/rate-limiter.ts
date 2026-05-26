/**
 * Central rate limiter for outbound AI API calls.
 *
 * One token-bucket + FIFO queue per provider key. Callers wrap their fetch
 * through {@link withRateLimit}; the limiter throttles proactively so the
 * upstream API (Groq, Jina, etc.) never sees a request that would 429.
 *
 * Three knobs per bucket:
 *   - rpm:        requests/min ceiling (rolling 60s window)
 *   - tpm:        tokens/min ceiling (rolling 60s window, input + output combined)
 *   - concurrent: max in-flight calls at once
 *
 * Defaults match free-tier limits. Override via env:
 *   RATE_LIMIT_<KEY>_RPM, RATE_LIMIT_<KEY>_TPM, RATE_LIMIT_<KEY>_CONCURRENT
 *   (where <KEY> is upper-snake-case, e.g. GROQ_70B for "groq-70b")
 *
 * Kill switch: RATE_LIMITER_DISABLED=1 bypasses the limiter entirely.
 */

export class RateLimitError extends Error {
  constructor(message: string, public providerKey: string, public retryAfterMs: number) {
    super(message);
    this.name = "RateLimitError";
  }
}

type BucketCfg = {
  rpm: number;
  tpm: number;
  concurrent: number;
};

const DEFAULTS: Record<string, BucketCfg> = {
  "groq-70b":    { rpm: 30, tpm: 6_000,     concurrent: 2 },
  "groq-8b":     { rpm: 30, tpm: 120_000,   concurrent: 4 },
  "jina-embed":  { rpm: 60, tpm: 1_000_000, concurrent: 4 },
  "jina-rerank": { rpm: 60, tpm: 1_000_000, concurrent: 2 },
};

function envOverride(key: string, suffix: "RPM" | "TPM" | "CONCURRENT"): number | null {
  const envKey = `RATE_LIMIT_${key.replace(/-/g, "_").toUpperCase()}_${suffix}`;
  const v = process.env[envKey];
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function getCfg(key: string): BucketCfg {
  const base = DEFAULTS[key] ?? { rpm: 60, tpm: 1_000_000, concurrent: 4 };
  return {
    rpm:        envOverride(key, "RPM")        ?? base.rpm,
    tpm:        envOverride(key, "TPM")        ?? base.tpm,
    concurrent: envOverride(key, "CONCURRENT") ?? base.concurrent,
  };
}

/** A single completed call's timestamp + token cost — used for rolling-window accounting. */
type CallRecord = { at: number; tokens: number };

class Bucket {
  private records: CallRecord[] = [];
  private inFlight = 0;
  private waiters: (() => void)[] = [];
  /** If set in the future, all callers must wait until this timestamp. */
  private frozenUntil = 0;

  constructor(public readonly key: string, public cfg: BucketCfg) {}

  /** Prune records older than the rolling window. */
  private trim(now: number) {
    const cutoff = now - 60_000;
    while (this.records.length && this.records[0].at < cutoff) this.records.shift();
  }

  /** Returns ms to wait before the requested budget can be served, or 0 if free. */
  private waitMs(estimatedTokens: number, now: number): number {
    if (now < this.frozenUntil) return this.frozenUntil - now;
    this.trim(now);

    if (this.inFlight >= this.cfg.concurrent) return 50;

    if (this.records.length >= this.cfg.rpm) {
      const oldest = this.records[0].at;
      return Math.max(50, 60_000 - (now - oldest));
    }

    const used = this.records.reduce((s, r) => s + r.tokens, 0);
    if (used + estimatedTokens > this.cfg.tpm) {
      if (this.records.length === 0) return 50;
      const oldest = this.records[0].at;
      return Math.max(50, 60_000 - (now - oldest));
    }

    return 0;
  }

  /** Acquire a slot. Resolves only when both RPM, TPM and concurrent budgets allow. */
  async acquire(estimatedTokens: number): Promise<void> {
    while (true) {
      const now = Date.now();
      const wait = this.waitMs(estimatedTokens, now);
      if (wait === 0) {
        this.inFlight++;
        return;
      }
      // Sleep, then re-check. New arrivals queue behind us via waiters[].
      const jitter = wait * (0.9 + Math.random() * 0.2);
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          const idx = this.waiters.indexOf(resolve);
          if (idx >= 0) this.waiters.splice(idx, 1);
          resolve();
        }, jitter);
        this.waiters.push(() => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  }

  /** Record the actual tokens used and release the slot. */
  release(actualTokens: number) {
    this.records.push({ at: Date.now(), tokens: Math.max(0, actualTokens) });
    this.inFlight = Math.max(0, this.inFlight - 1);
    const next = this.waiters.shift();
    if (next) next();
  }

  /** Freeze the entire bucket for the given duration — used after a real 429. */
  freeze(durationMs: number) {
    this.frozenUntil = Math.max(this.frozenUntil, Date.now() + durationMs);
    console.warn(
      `[rate-limiter] ${this.key} frozen for ${Math.round(durationMs / 1000)}s`
    );
  }
}

const buckets = new Map<string, Bucket>();

function getBucket(key: string): Bucket {
  let b = buckets.get(key);
  if (!b) {
    b = new Bucket(key, getCfg(key));
    buckets.set(key, b);
  }
  return b;
}

/** Disabled flag — set RATE_LIMITER_DISABLED=1 to bypass for debugging. */
function isDisabled() {
  return process.env.RATE_LIMITER_DISABLED === "1";
}

/**
 * Run `fn` under the named bucket's rate limit.
 *
 * @param providerKey  bucket identifier (e.g. "groq-70b")
 * @param estimateTokens  pre-call token estimate (chars/4 is fine)
 * @param fn  the actual fetch. Must return { actualTokens, retryAfterMs?, value }.
 *            - actualTokens: real usage from API response (replaces estimate)
 *            - retryAfterMs: if set, signals upstream 429 — freezes bucket
 *
 * Bubbles RateLimitError after 3 consecutive 429s on the same logical call.
 */
export async function withRateLimit<T>(
  providerKey: string,
  estimateTokens: number,
  fn: () => Promise<{ actualTokens: number; retryAfterMs?: number; value: T }>
): Promise<T> {
  if (isDisabled()) {
    const r = await fn();
    return r.value;
  }

  const bucket = getBucket(providerKey);
  let attempts = 0;

  while (true) {
    await bucket.acquire(estimateTokens);
    let result: { actualTokens: number; retryAfterMs?: number; value: T };
    try {
      result = await fn();
    } catch (e) {
      bucket.release(estimateTokens);
      throw e;
    }

    if (result.retryAfterMs && result.retryAfterMs > 0) {
      bucket.release(0);
      bucket.freeze(result.retryAfterMs);
      attempts++;
      if (attempts >= 3) {
        throw new RateLimitError(
          `Persistent 429 on ${providerKey} after ${attempts} attempts.`,
          providerKey,
          result.retryAfterMs
        );
      }
      continue;
    }

    bucket.release(result.actualTokens);
    return result.value;
  }
}

/** Rough token estimate: ~1 token per 4 chars for English. Cheap and good enough. */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
