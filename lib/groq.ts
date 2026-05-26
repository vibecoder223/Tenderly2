/**
 * LLM client — Cerebras Inference API (OpenAI-compatible).
 *
 * Cerebras runs Llama and GPT-OSS models 2-3× faster than Groq on their
 * wafer-scale chips. Free tier: 30 RPM / 60K TPM / 1M tokens per day per
 * model. We fire requests without artificial throttling and react to real
 * 429s with a single retry that honours the `retry-after` header.
 *
 * Filename and exported names kept as "groq*" so the rest of the codebase
 * doesn't need to change — only the upstream provider swaps.
 */

const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";

// Quality model — response generation, complex extraction.
export const MODEL      = "gpt-oss-120b";
// Fast/cheap — extraction batches, query expansion, confidence scoring.
export const MODEL_FAST = "llama3.1-8b";

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
  const k = process.env.CEREBRAS_API_KEY;
  if (!k) throw new Error("CEREBRAS_API_KEY not set.");
  return k;
}

// Cerebras calls drive the Deals pipeline (extraction + response gen). We
// fail fast on 429 instead of waiting — the doc lands in *_failed and the UI
// Retry button drives the recovery. KB ingestion uses Jina, which keeps its
// own retry budget in lib/embeddings.ts.
const MAX_RETRY_WAIT_MS = 0;
const MAX_RETRIES = 0;

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

  let attempt = 0;
  while (true) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    let res: Response;
    try {
      res = await fetch(CEREBRAS_URL, {
        method:  "POST",
        headers: {
          Authorization:  `Bearer ${getKey()}`,
          "Content-Type": "application/json",
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
        console.warn(`[cerebras] 429 on ${model} (attempt ${attempt + 1}) — retrying in ${Math.round(jitter / 1000)}s`);
        await new Promise((r) => setTimeout(r, jitter));
        attempt++;
        continue;
      }
      throw new RateLimitError(
        `Cerebras 429 on ${model} after ${MAX_RETRIES} retries — last retry-after ${Math.round(base / 1000)}s`,
        base,
      );
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Cerebras ${res.status}: ${txt.slice(0, 300)}`);
    }

    const j   = await res.json();
    const raw = j.choices?.[0]?.message?.content ?? "";
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
    if (!m) throw new Error(`Cerebras response not valid JSON: ${cleaned.slice(0, 200)}`);
    try {
      parsed = JSON.parse(m[0]);
    } catch (e: any) {
      // Truncated-array salvage: trim back to the last well-formed object
      // and close the array. Cerebras sometimes hits max_tokens mid-array.
      const salvaged = salvageTruncatedArray(m[0]);
      if (salvaged !== null) {
        parsed = salvaged;
      } else {
        throw new Error(`Cerebras response not parseable JSON (${e.message}): ${m[0].slice(0, 200)}`);
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
