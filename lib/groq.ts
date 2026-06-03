/**
 * LLM client — OpenAI-compatible chat completions.
 *
 * Provider is env-driven so it can target OpenRouter, Cerebras, or any
 * OpenAI-compatible endpoint without code changes:
 *   LLM_BASE_URL    base URL, e.g. https://openrouter.ai/api/v1 (default: Cerebras)
 *   OPENROUTER_API_KEY / LLM_API_KEY / CEREBRAS_API_KEY  bearer key (first set wins)
 *   LLM_MODEL       quality model id
 *   LLM_MODEL_FAST  fast/cheap model id
 *
 * Filename and exported names kept as "groq*" so the rest of the codebase
 * doesn't need to change — only the upstream provider swaps.
 */

const BASE_URL = (process.env.LLM_BASE_URL ?? "https://api.cerebras.ai/v1").replace(/\/+$/, "");
const CHAT_URL = `${BASE_URL}/chat/completions`;

// Quality model — response generation, complex extraction.
export const MODEL      = process.env.LLM_MODEL ?? "gpt-oss-120b";
// Fast/cheap — extraction batches, query expansion, confidence scoring.
export const MODEL_FAST = process.env.LLM_MODEL_FAST ?? "llama3.1-8b";

// Rough USD/MTok for cost display only.
const INPUT_PRICE_PER_MTOK  = 0.85;
const OUTPUT_PRICE_PER_MTOK = 1.20;

export function estimateCost(input: number, output: number): number {
  return (input / 1_000_000) * INPUT_PRICE_PER_MTOK + (output / 1_000_000) * OUTPUT_PRICE_PER_MTOK;
}

export type Usage = { input_tokens: number; output_tokens: number };

export class RateLimitError extends Error {
  constructor(message: string, public retryAfterMs: number) {
    super(message);
    this.name = "RateLimitError";
  }
}

function getKey(): string {
  const k =
    process.env.OPENROUTER_API_KEY ??
    process.env.LLM_API_KEY ??
    process.env.CEREBRAS_API_KEY;
  if (!k) throw new Error("No LLM API key set (OPENROUTER_API_KEY / LLM_API_KEY / CEREBRAS_API_KEY).");
  return k;
}

// True if any LLM provider key is configured. Use this for "is the AI pipeline
// enabled" checks instead of testing a single provider's env var.
export function hasLlmKey(): boolean {
  return Boolean(
    process.env.OPENROUTER_API_KEY ||
    process.env.LLM_API_KEY ||
    process.env.CEREBRAS_API_KEY,
  );
}

// 429 handling: the async jobs queue (lib/jobs.ts) already retries failed jobs
// with its own backoff, but a couple of in-call retries smooth over transient
// rate limits without bouncing the whole job. Honour the `retry-after` header.
const MAX_RETRY_WAIT_MS = 30_000;
const MAX_RETRIES = 2;

// ---- Process-wide rate gate -------------------------------------------------
// The drain runs LLM calls in parallel batches. Without coordination, a burst
// of generate jobs overshoots the provider's tokens-per-minute ceiling and gets
// 429'd (free Cerebras gpt-oss-120b ≈ 60k TPM). This gate paces calls across
// the whole process so the burst spends only the budget actually available.
//
// Single-process only (one Next server / one `npm run drain`). For multiple
// workers, move this state to Redis (shared INCR on a per-minute key) — same
// logic, shared counter. Tune via env; set any to 0 to disable that limit.
//
// Defaults match the Cerebras FREE tier for gpt-oss-120b, whose binding
// constraint is requests/min, not tokens (confirmed via x-ratelimit headers):
//   requests-per-minute: 5   tokens-per-minute: 30000
// On a paid tier raise LLM_RPM / LLM_TPM to your plan's limits (or set 0).
//   LLM_RPM              requests-per-minute cap     (default 5)
//   LLM_TPM              tokens-per-minute cap       (default 30000)
//   LLM_MAX_CONCURRENCY  max simultaneous in-flight  (default 4)
const LLM_RPM = Number(process.env.LLM_RPM ?? 5);
const LLM_TPM = Number(process.env.LLM_TPM ?? 30_000);
const LLM_MAX_CONCURRENCY = Number(process.env.LLM_MAX_CONCURRENCY ?? 4);

let inFlight = 0;
const concurrencyWaiters: Array<() => void> = [];
let tokenWindow: Array<{ t: number; tokens: number }> = [];
let requestWindow: number[] = [];

async function acquireConcurrency(): Promise<void> {
  if (!LLM_MAX_CONCURRENCY) return;
  if (inFlight < LLM_MAX_CONCURRENCY) {
    inFlight++;
    return;
  }
  // Queue; the releaser hands us the slot (inFlight stays accounted).
  await new Promise<void>((resolve) => concurrencyWaiters.push(resolve));
}

function releaseConcurrency(): void {
  if (!LLM_MAX_CONCURRENCY) return;
  const next = concurrencyWaiters.shift();
  if (next) next(); // transfer slot, inFlight unchanged
  else inFlight--;
}

function windowTokens(now: number): number {
  tokenWindow = tokenWindow.filter((e) => now - e.t < 60_000);
  return tokenWindow.reduce((s, e) => s + e.tokens, 0);
}

// Block until BOTH the rolling 60s request budget (RPM) and token budget (TPM)
// have room for this call, then reserve a slot in each window.
async function reserveSlot(est: number): Promise<void> {
  if (!LLM_RPM && !LLM_TPM) return;
  for (;;) {
    const now = Date.now();
    requestWindow = requestWindow.filter((t) => now - t < 60_000);
    const reqOk = !LLM_RPM || requestWindow.length < LLM_RPM;
    // A single call larger than the whole token budget would deadlock — exempt.
    const tokOk = !LLM_TPM || est >= LLM_TPM || windowTokens(now) + est <= LLM_TPM;
    if (reqOk && tokOk) {
      requestWindow.push(now);
      if (LLM_TPM) tokenWindow.push({ t: now, tokens: est });
      return;
    }
    // Sleep until the oldest entry in the binding window ages out of the minute.
    const oldestReq = requestWindow[0];
    const oldestTok = tokenWindow[0]?.t;
    const oldest = Math.min(oldestReq ?? now, oldestTok ?? now);
    const wait = Math.max(250, 60_000 - (now - oldest));
    await new Promise((r) => setTimeout(r, Math.min(wait, 5_000)));
  }
}

// ~4 chars/token; count the prompt we send plus the output we've reserved.
function estimateTokens(system: string, user: string, maxTokens: number): number {
  return Math.ceil((system.length + user.length) / 4) + maxTokens;
}

async function call(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  json?: boolean;
  model?: string;
}): Promise<{ raw: string; usage: Usage }> {
  const model     = opts.model ?? MODEL;
  const maxTokens = opts.maxTokens ?? 1500;
  const body: any = {
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user",   content: opts.user },
    ],
    max_tokens:  maxTokens,
    temperature: 0.2,
  };
  if (opts.json) body.response_format = { type: "json_object" };
  // Reasoning models (gpt-oss, glm) otherwise spend the whole token budget on
  // hidden reasoning before emitting an answer — slow, and the visible content
  // can come back empty. "low" keeps them fast and answering. Ignored by
  // non-reasoning providers.
  if (process.env.LLM_REASONING_EFFORT) {
    body.reasoning_effort = process.env.LLM_REASONING_EFFORT;
  }

  // Rate gate: cap simultaneous calls, then wait for token budget. Held for the
  // whole call (including in-call 429 retries) so retries don't re-burst.
  await acquireConcurrency();
  try {
    await reserveSlot(estimateTokens(opts.system, opts.user, maxTokens));
    return await sendWithRetries(body, model);
  } finally {
    releaseConcurrency();
  }
}

async function sendWithRetries(body: any, model: string): Promise<{ raw: string; usage: Usage }> {
  let attempt = 0;
  while (true) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    let res: Response;
    try {
      res = await fetch(CHAT_URL, {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${getKey()}`,
          "Content-Type": "application/json",
          // OpenRouter attribution headers (ignored by other providers).
          "HTTP-Referer":  "https://tenderly.app",
          "X-Title":       "Propello",
        },
        body:   JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "5");
      const base = Math.max(1_000, retryAfter * 1000);

      if (attempt < MAX_RETRIES && base <= MAX_RETRY_WAIT_MS) {
        // Jitter so parallel callers don't all retry on the same tick.
        const jitter = base * (0.7 + Math.random() * 0.6);
        console.warn(`[llm] 429 on ${model} (attempt ${attempt + 1}) — retrying in ${Math.round(jitter / 1000)}s`);
        await new Promise((r) => setTimeout(r, jitter));
        attempt++;
        continue;
      }
      throw new RateLimitError(
        `LLM 429 on ${model} after ${MAX_RETRIES} retries — last retry-after ${Math.round(base / 1000)}s`,
        base,
      );
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`LLM ${res.status}: ${txt.slice(0, 300)}`);
    }

    const j   = await res.json();
    const msg = j.choices?.[0]?.message ?? {};
    // Fall back to the reasoning field if a reasoning model emitted its answer
    // there with an empty content (happens when reasoning consumes the budget).
    const raw = (msg.content && msg.content.trim()) ? msg.content : (msg.reasoning ?? "");
    return {
      raw,
      usage: {
        input_tokens:  j.usage?.prompt_tokens     ?? 0,
        output_tokens: j.usage?.completion_tokens ?? 0,
      },
    };
  }
}

export async function callGroqJson<T = unknown>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  model?: string;
  /**
   * Output mode. Default "json_object" forces `response_format`. Use "text"
   * when you want an array — some Cerebras models (gpt-oss-120b, llama3.1-8b)
   * misbehave under json_object mode for arrays and return either a schema
   * descriptor like {"type":"object"} or a single object instead of the
   * requested array.
   */
  mode?: "json_object" | "text";
}): Promise<{ data: T; usage: Usage; raw: string }> {
  const mode = opts.mode ?? "json_object";
  const sys = /json/i.test(opts.system)
    ? opts.system
    : `${opts.system}\n\nReturn valid JSON.`;

  const { raw, usage } = await call({
    ...opts,
    system:    sys,
    json:      mode === "json_object",
    maxTokens: opts.maxTokens ?? 4096,
  });

  const cleaned = raw.trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (!m) throw new Error(`LLM response not valid JSON: ${cleaned.slice(0, 200)}`);
    try {
      parsed = JSON.parse(m[0]);
    } catch (e: any) {
      // Truncated-array salvage: trim back to the last well-formed object
      // and close the array. Cerebras sometimes hits max_tokens mid-array.
      const salvaged = salvageTruncatedArray(m[0]);
      if (salvaged !== null) {
        parsed = salvaged;
      } else {
        throw new Error(`LLM response not parseable JSON (${e.message}): ${m[0].slice(0, 200)}`);
      }
    }
  }

  // Unwrap object → array. Cerebras often returns { "type": "object",
  // "requirements": [...] } or similar. Find the first array value and use it.
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const arrayValues = Object.values(parsed).filter((v) => Array.isArray(v));
    if (arrayValues.length === 1) parsed = arrayValues[0];
  }

  return { data: parsed as T, usage, raw };
}

/**
 * Best-effort recovery for an unterminated JSON array — walk backwards to the
 * last balanced object and close the array. Returns null if nothing usable.
 */
function salvageTruncatedArray(s: string): any[] | null {
  if (!s.startsWith("[")) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  let lastGoodEnd = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 1 && c === "}") lastGoodEnd = i; // top-level object closed
    }
  }
  if (lastGoodEnd < 0) return null;
  const candidate = s.slice(0, lastGoodEnd + 1) + "]";
  try {
    const v = JSON.parse(candidate);
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export async function callGroqText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  model?: string;
}): Promise<{ text: string; usage: Usage }> {
  const { raw, usage } = await call(opts);
  return { text: raw.trim(), usage };
}
