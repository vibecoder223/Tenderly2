/**
 * Embeddings + reranking — Voyage AI.
 *
 * Embedding model: voyage-3 @ 1024 dimensions. Matches our DB pgvector column.
 * Rerank model:    rerank-2 (multilingual).
 *
 * Voyage free tier: 200M tokens/month. Plenty of headroom for solo dev.
 * On a real 429 we honour `retry-after` with exponential backoff before
 * surfacing a hard failure to callers.
 */

const VOYAGE_URL = "https://api.voyageai.com/v1";

const VOYAGE_EMBED_MODEL  = process.env.VOYAGE_EMBED_MODEL  || "voyage-3";
const VOYAGE_RERANK_MODEL = process.env.VOYAGE_RERANK_MODEL || "rerank-2";

export const EMBED_DIMS = 1024;

const VOYAGE_BATCH_SIZE = 128;        // max inputs per call
const MAX_RETRY_WAIT_MS = 60_000;
const MAX_RETRIES = 8;
// Voyage free tier = 3 RPM. Space serial calls ~20s apart to stay under.
// Paid tier raises this to 2000 RPM; reduce/eliminate via VOYAGE_MIN_GAP_MS env.
const MIN_REQUEST_GAP_MS = Number(process.env.VOYAGE_MIN_GAP_MS ?? 21_000);

function hasVoyageKey() { return !!process.env.VOYAGE_API_KEY; }

/** True if any embedding provider is available. */
export function hasEmbeddings() { return hasVoyageKey(); }

/** Legacy alias — kept so older callers compile. */
export const hasVoyage = hasVoyageKey;

export class VoyageRateLimitError extends Error {
  constructor(message: string, public retryAfterMs: number) {
    super(message);
    this.name = "VoyageRateLimitError";
  }
}

/** Back-compat alias for any code that still imports the old name. */
export const JinaRateLimitError = VoyageRateLimitError;

// Module-level promise chain serializes ALL Voyage calls process-wide so
// we never exceed the per-minute RPM budget. Each call waits for the prior
// to complete + a minimum gap before firing.
let lastCallAt = 0;
let inFlight: Promise<unknown> = Promise.resolve();

async function throttle(): Promise<void> {
  // Chain on prior call so concurrent callers serialize.
  const prior = inFlight;
  let release!: () => void;
  inFlight = new Promise<void>((r) => { release = r; });
  try {
    await prior;
    const wait = Math.max(0, lastCallAt + MIN_REQUEST_GAP_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  } finally {
    release();
  }
}

async function voyageFetch(path: string, body: any): Promise<Response> {
  await throttle();
  let attempt = 0;
  while (true) {
    const res = await fetch(`${VOYAGE_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "5");
      const base = Math.max(1_000, retryAfter * 1000);
      const backoff = Math.min(MAX_RETRY_WAIT_MS, base * Math.pow(2, attempt));
      if (attempt < MAX_RETRIES) {
        const jitter = backoff * (0.7 + Math.random() * 0.6);
        console.warn(`[voyage] 429 on ${path} (attempt ${attempt + 1}) — retrying in ${Math.round(jitter / 1000)}s`);
        await new Promise((r) => setTimeout(r, jitter));
        attempt++;
        continue;
      }
      throw new VoyageRateLimitError(
        `Voyage 429 on ${path} after ${MAX_RETRIES} retries`,
        base,
      );
    }

    return res;
  }
}

// ─── Embeddings ──────────────────────────────────────────────

async function embedVoyageBatch(
  batch: string[],
  inputType: "document" | "query"
): Promise<number[][]> {
  const res = await voyageFetch("/embeddings", {
    model: VOYAGE_EMBED_MODEL,
    input: batch,
    input_type: inputType,
    output_dimension: EMBED_DIMS,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Voyage embed failed: ${res.status} ${t.slice(0, 300)}`);
  }

  const j = (await res.json()) as {
    data: { embedding: number[]; index: number }[];
  };
  const result: number[][] = new Array(batch.length);
  j.data
    .sort((a, b) => a.index - b.index)
    .forEach((d, localIdx) => {
      result[localIdx] = d.embedding;
    });
  return result;
}

/**
 * Embed a list of texts.
 * Throws if Voyage is not configured or the call fails. Callers must catch
 * and mark the document/chunk as failed.
 */
export async function embedTexts(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!hasVoyageKey()) {
    throw new Error("Embeddings unavailable: VOYAGE_API_KEY not set in .env.local.");
  }

  const out: number[][] = new Array(texts.length);
  const batches: { start: number; texts: string[] }[] = [];
  for (let i = 0; i < texts.length; i += VOYAGE_BATCH_SIZE) {
    batches.push({ start: i, texts: texts.slice(i, i + VOYAGE_BATCH_SIZE) });
  }

  // Batches run in parallel — Voyage free tier (200M tokens/mo, 2000 RPM)
  // tolerates this comfortably for solo workloads.
  await Promise.all(
    batches.map(async ({ start, texts: batch }) => {
      const embs = await embedVoyageBatch(batch, inputType);
      embs.forEach((e, i) => {
        out[start + i] = e;
      });
    })
  );

  return out;
}

// ─── Reranking ────────────────────────────────────────────────

export type RerankResult = { index: number; score: number };

async function rerankVoyage(opts: {
  query: string;
  documents: string[];
  topK: number;
}): Promise<RerankResult[]> {
  const res = await voyageFetch("/rerank", {
    model: VOYAGE_RERANK_MODEL,
    query: opts.query,
    documents: opts.documents,
    top_k: opts.topK,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Voyage rerank failed: ${res.status} ${t.slice(0, 300)}`);
  }

  const j = (await res.json()) as {
    data: { index: number; relevance_score: number }[];
  };
  return j.data.map((d) => ({ index: d.index, score: d.relevance_score }));
}

/**
 * Rerank documents. Returns identity ordering with score 0.5 if Voyage is
 * unavailable — rerank is a quality boost, not a hard requirement, so we
 * degrade rather than fail the whole request.
 */
export async function rerank(opts: {
  query: string;
  documents: string[];
  topK?: number;
}): Promise<RerankResult[]> {
  if (opts.documents.length === 0) return [];
  const topK = opts.topK ?? Math.min(opts.documents.length, 10);

  if (hasVoyageKey()) {
    try {
      return await rerankVoyage({ ...opts, topK });
    } catch (e: any) {
      console.warn(`[embeddings] Voyage rerank failed: ${e.message}`);
    }
  }

  return opts.documents.map((_, i) => ({ index: i, score: 0.5 }));
}
