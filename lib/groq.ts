/**
 * LLM client — Groq API (fast, free tier).
 * Export names unchanged so all callers stay compatible.
 */

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

// Quality model — response generation, complex extraction.
export const MODEL      = "llama-3.3-70b-versatile";
// Fast/cheap — extraction batches, query expansion, confidence scoring.
export const MODEL_FAST = "llama-3.1-8b-instant";

// Rough USD/MTok for cost display only.
const INPUT_PRICE_PER_MTOK  = 0.59;
const OUTPUT_PRICE_PER_MTOK = 0.79;

export function estimateCost(input: number, output: number): number {
  return (input / 1_000_000) * INPUT_PRICE_PER_MTOK + (output / 1_000_000) * OUTPUT_PRICE_PER_MTOK;
}

export type Usage = { input_tokens: number; output_tokens: number };

function getKey(): string {
  const k = process.env.GROQ_API_KEY;
  if (!k) throw new Error("GROQ_API_KEY not set.");
  return k;
}

async function call(opts: {
  system: string;
  user: string;
  maxTokens?: number;
  json?: boolean;
  model?: string;
}): Promise<{ raw: string; usage: Usage }> {
  const model = opts.model ?? MODEL;
  const body: any = {
    model,
    messages: [
      { role: "system", content: opts.system },
      { role: "user",   content: opts.user },
    ],
    max_tokens:  opts.maxTokens ?? 1500,
    temperature: 0.2,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  let res: Response;
  let attempts = 0;
  while (true) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      res = await fetch(GROQ_URL, {
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
    if (res.status !== 429 || attempts >= 4) break;
    const retryAfter = res.headers.get("retry-after");
    const waitSec    = retryAfter ? Number(retryAfter) : 8;
    const wait       = Math.min(30, Math.max(2, waitSec)) * 1000 + 500;
    console.warn(`[groq] 429 — retrying in ${Math.round(wait / 1000)}s (attempt ${attempts + 1})`);
    await new Promise((r) => setTimeout(r, wait));
    attempts++;
  }

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Groq ${res.status}: ${txt.slice(0, 300)}`);
  }

  const j   = await res.json();
  const raw = j.choices?.[0]?.message?.content ?? "";
  return {
    raw,
    usage: {
      input_tokens:  j.usage?.prompt_tokens    ?? 0,
      output_tokens: j.usage?.completion_tokens ?? 0,
    },
  };
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
    if (!m) throw new Error(`Groq response not valid JSON: ${cleaned.slice(0, 200)}`);
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
