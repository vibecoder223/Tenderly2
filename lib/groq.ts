/**
 * LLM client — Cerebras Inference API (OpenAI-compatible).
 *
 * Cerebras runs Llama models 2-3× faster than Groq on their wafer-scale chips,
 * with more generous free-tier limits (60K TPM vs Groq's 6K on 70B).
 *
 * Filename and exported names kept as "groq*" so the rest of the codebase
 * doesn't need to change — only the upstream provider swaps.
 *
 * All calls route through the central rate limiter.
 */

import { withRateLimit, estimateTokens, RateLimitError } from "./rate-limiter";

const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";

// Quality model — response generation, complex extraction.
export const MODEL      = "gpt-oss-120b";
// Fast/cheap — extraction batches, query expansion, confidence scoring.
export const MODEL_FAST = "llama3.1-8b";

// Rough USD/MTok for cost display only (Cerebras pricing similar to Groq).
const INPUT_PRICE_PER_MTOK  = 0.85;
const OUTPUT_PRICE_PER_MTOK = 1.20;

export function estimateCost(input: number, output: number): number {
  return (input / 1_000_000) * INPUT_PRICE_PER_MTOK + (output / 1_000_000) * OUTPUT_PRICE_PER_MTOK;
}

export type Usage = { input_tokens: number; output_tokens: number };

function getKey(): string {
  const k = process.env.CEREBRAS_API_KEY;
  if (!k) throw new Error("CEREBRAS_API_KEY not set.");
  return k;
}

function bucketKey(model: string): string {
  return model === MODEL_FAST ? "cerebras-8b" : "cerebras-120b";
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

  // Pre-call estimate: input prompt tokens + worst-case output.
  const estimate = estimateTokens(opts.system) + estimateTokens(opts.user) + maxTokens;

  return await withRateLimit(bucketKey(model), estimate, async () => {
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
      const retryAfter = Number(res.headers.get("retry-after") ?? "8");
      const retryAfterMs = Math.min(60_000, Math.max(2_000, retryAfter * 1000));
      return { actualTokens: 0, retryAfterMs, value: null as any };
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Cerebras ${res.status}: ${txt.slice(0, 300)}`);
    }

    const j   = await res.json();
    const raw = j.choices?.[0]?.message?.content ?? "";
    const usage: Usage = {
      input_tokens:  j.usage?.prompt_tokens     ?? 0,
      output_tokens: j.usage?.completion_tokens ?? 0,
    };

    return {
      actualTokens: usage.input_tokens + usage.output_tokens,
      value: { raw, usage },
    };
  });
}

export async function callGroqJson<T = unknown>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  model?: string;
}): Promise<{ data: T; usage: Usage; raw: string }> {
  const sys = /json/i.test(opts.system)
    ? opts.system
    : `${opts.system}\n\nReturn valid JSON.`;

  const { raw, usage } = await call({
    ...opts,
    system:    sys,
    json:      true,
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
    parsed = JSON.parse(m[0]);
  }

  // Unwrap single-key object wrapping an array: { "items": [...] } → [...]
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const values = Object.values(parsed);
    if (values.length === 1 && Array.isArray(values[0])) parsed = values[0];
  }

  return { data: parsed as T, usage, raw };
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

export { RateLimitError };
