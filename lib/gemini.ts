import { GoogleGenerativeAI } from "@google/generative-ai";

let _client: GoogleGenerativeAI | null = null;

export function getGemini() {
  if (_client) return _client;
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new Error("GOOGLE_AI_API_KEY not set.");
  _client = new GoogleGenerativeAI(key);
  return _client;
}

export const MODEL = "gemini-2.0-flash";

// Approx pricing: $0.10/1M input, $0.40/1M output
const INPUT_PRICE_PER_MTOK = 0.10;
const OUTPUT_PRICE_PER_MTOK = 0.40;

export function estimateCost(input: number, output: number): number {
  return (input / 1_000_000) * INPUT_PRICE_PER_MTOK + (output / 1_000_000) * OUTPUT_PRICE_PER_MTOK;
}

export type Usage = { input_tokens: number; output_tokens: number };

export async function callGeminiJson<T = unknown>(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{ data: T; usage: Usage; raw: string }> {
  const client = getGemini();
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: opts.system,
    generationConfig: {
      responseMimeType: "application/json",
      maxOutputTokens: opts.maxTokens ?? 4096,
    },
  });

  const result = await model.generateContent(opts.user);
  const raw = result.response.text();
  const usage: Usage = {
    input_tokens: result.response.usageMetadata?.promptTokenCount ?? 0,
    output_tokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
  };

  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let data: T;
  try {
    data = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (m) {
      data = JSON.parse(m[0]);
    } else {
      throw new Error(`Gemini response was not valid JSON: ${cleaned.slice(0, 200)}`);
    }
  }

  return { data, usage, raw };
}

export async function callGeminiText(opts: {
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<{ text: string; usage: Usage }> {
  const client = getGemini();
  const model = client.getGenerativeModel({
    model: MODEL,
    systemInstruction: opts.system,
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 1500,
    },
  });

  const result = await model.generateContent(opts.user);
  const text = result.response.text().trim();
  const usage: Usage = {
    input_tokens: result.response.usageMetadata?.promptTokenCount ?? 0,
    output_tokens: result.response.usageMetadata?.candidatesTokenCount ?? 0,
  };

  return { text, usage };
}
