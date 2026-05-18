import Anthropic from "@anthropic-ai/sdk";

let _client: Anthropic | null = null;

export function getAnthropic() {
  if (_client) return _client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set — required for the agent pipeline.");
  _client = new Anthropic({ apiKey: key });
  return _client;
}

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
export const HAIKU_MODEL = process.env.ANTHROPIC_HAIKU_MODEL || "claude-haiku-4-5";

// Pricing per 1M tokens (Sonnet 4.6 list). Used for cost telemetry.
const INPUT_PRICE_PER_MTOK = 3;
const OUTPUT_PRICE_PER_MTOK = 15;

export function estimateCost(input: number, output: number): number {
  return (input / 1_000_000) * INPUT_PRICE_PER_MTOK + (output / 1_000_000) * OUTPUT_PRICE_PER_MTOK;
}

export type Usage = { input_tokens: number; output_tokens: number };

/**
 * Call Claude expecting JSON-only output. Strips ```json fences if present.
 */
export async function callClaudeJson<T = unknown>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{ data: T; usage: Usage; raw: string }> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });

  const textBlock = resp.content.find((b) => b.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "";
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let data: T;
  try {
    data = JSON.parse(cleaned);
  } catch (e) {
    // Try to find the first {...} or [...] block
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (m) {
      data = JSON.parse(m[0]);
    } else {
      throw new Error(`Claude response was not valid JSON: ${cleaned.slice(0, 200)}`);
    }
  }

  return {
    data,
    usage: { input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens },
    raw,
  };
}

export async function callClaudeText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{ text: string; usage: Usage }> {
  return callClaudeTextWithModel(MODEL, opts);
}

export async function callClaudeHaikuText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{ text: string; usage: Usage }> {
  return callClaudeTextWithModel(HAIKU_MODEL, opts);
}

async function callClaudeTextWithModel(
  model: string,
  opts: { system: string; user: string; maxTokens?: number }
): Promise<{ text: string; usage: Usage }> {
  const client = getAnthropic();
  const resp = await client.messages.create({
    model,
    max_tokens: opts.maxTokens ?? 1500,
    system: opts.system,
    messages: [{ role: "user", content: opts.user }],
  });
  const textBlock = resp.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
  return {
    text,
    usage: { input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens },
  };
}
