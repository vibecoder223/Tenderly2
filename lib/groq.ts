/**
 * LLM client — now backed by OpenRouter (was Groq). Export names kept
 * (`callGroqJson`, `callGroqText`, `MODEL`, `MODEL_FAST`) so callers don't
 * need to change.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Quality model — response generation. Claude Haiku: coherent, good at citations.
export const MODEL      = "anthropic/claude-3.5-haiku";
// Fast/cheap — extraction, query expansion, confidence. Llama 8B on LPU = blazing.
export const MODEL_FAST = "meta-llama/llama-3.1-8b-instruct";

// Rough USD/MTok for Haiku (varies by model); used to display cost only.
const INPUT_PRICE_PER_MTOK = 0.80;
const OUTPUT_PRICE_PER_MTOK = 4.00;

export function estimateCost(input: number, output: number): number {
  return (input / 1_000_000) * INPUT_PRICE_PER_MTOK + (output / 1_000_000) * OUTPUT_PRICE_PER_MTOK;
}

export type Usage = { input_tokens: number; output_tokens: number };

function getKey(): string {
  const k = process.env.OPENROUTER_API_KEY;
  if (!k) throw new Error("OPENROUTER_API_KEY not set.");
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
      { role: "user", content: opts.user },
    ],
    max_tokens: opts.maxTokens ?? 1500,
    temperature: 0.2,
  };
  if (opts.json) body.response_format = { type: "json_object" };

  // Route llama models to fast LPU providers — much faster than standard GPU.
  if (/llama/i.test(model)) {
    body.provider = {
      order: ["Cerebras", "SambaNova"],
      allow_fallbacks: true,
    };
  }

  let res: Response;
  let attempts = 0;
  while (true) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 90_000);
    try {
      res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getKey()}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://tenderly.app",
          "X-Title": "TenderOps",
        },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.status !== 429 || attempts >= 4) break;
    const retryAfter = res.headers.get("retry-after");
    const waitSec = retryAfter ? Number(retryAfter) : 8;
    const wait = Math.min(30, Math.max(2, waitSec)) * 1000 + 500;
    console.warn(`[openrouter] 429 — retrying in ${Math.round(wait / 1000)}s (attempt ${attempts + 1})`);
    await new Promise((r) => setTimeout(r, wait));
    attempts++;
  }
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${txt.slice(0, 300)}`);
  }
  const j = await res.json();
  const raw = j.choices?.[0]?.message?.content ?? "";
  return {
    raw,
    usage: {
      input_tokens: j.usage?.prompt_tokens ?? 0,
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
  const sys = /json/i.test(opts.system) ? opts.system : `${opts.system}\n\nReturn valid JSON.`;
  const { raw, usage } = await call({ ...opts, system: sys, json: true, maxTokens: opts.maxTokens ?? 4096 });

  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (!m) throw new Error(`OpenRouter response not valid JSON: ${cleaned.slice(0, 200)}`);
    parsed = JSON.parse(m[0]);
  }
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
