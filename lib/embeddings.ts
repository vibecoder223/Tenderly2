/**
 * Embeddings + reranking — Voyage AI (primary).
 *
 * Voyage AI: voyage-3-large @ 1024 dimensions. Matches our DB column.
 *   Set VOYAGE_API_KEY in .env.local.
 *
 * If the key is missing, zero vectors are written so the chunk row is stored
 * but won't match anything until re-embedded.
 */

const VOYAGE_URL = "https://api.voyageai.com/v1";
const VOYAGE_EMBED_MODEL  = process.env.VOYAGE_EMBED_MODEL  || "voyage-3-large";
const VOYAGE_RERANK_MODEL = process.env.VOYAGE_RERANK_MODEL || "rerank-2";

export const EMBED_DIMS = 1024; // Voyage 3 large native dimension

function hasVoyage() { return !!process.env.VOYAGE_API_KEY; }

/** True if any embedding provider is available. */
export function hasEmbeddings() { return hasVoyage(); }

/** Legacy export kept for callers that import hasVoyage directly. */
export { hasVoyage };

// ─── Embeddings ──────────────────────────────────────────────

// ── Voyage concurrency gate ───────────────────────────────────
// Voyage paid tier handles ~2000 RPM. Cap at 6 concurrent calls.
let voyageInFlight = 0;
const voyageWaiters: (() => void)[] = [];
const VOYAGE_MAX_CONCURRENT = 6;
const VOYAGE_BATCH_SIZE = 128; // Voyage accepts up to 128 inputs per call.

async function withVoyageSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (voyageInFlight >= VOYAGE_MAX_CONCURRENT) {
    await new Promise<void>((resolve) => voyageWaiters.push(resolve));
  }
  voyageInFlight++;
  try {
    return await fn();
  } finally {
    voyageInFlight--;
    const next = voyageWaiters.shift();
    if (next) next();
  }
}

async function embedVoyage(texts: string[], inputType: "document" | "query"): Promise<number[][]> {
  // Split into batches and fire them all in parallel (gated by the semaphore).
  const batches: { start: number; texts: string[] }[] = [];
  for (let i = 0; i < texts.length; i += VOYAGE_BATCH_SIZE) {
    batches.push({ start: i, texts: texts.slice(i, i + VOYAGE_BATCH_SIZE) });
  }
  const out: number[][] = new Array(texts.length);
  await Promise.all(
    batches.map(async ({ start, texts: batch }) => {
      const res = await withVoyageSlot(() =>
        fetch(`${VOYAGE_URL}/embeddings`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
          },
          body: JSON.stringify({
            model: VOYAGE_EMBED_MODEL,
            input: batch,
            input_type: inputType,
            // Use Voyage's native dimension (1024) — matches our DB column.
          }),
        })
      );
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`Voyage embed failed: ${res.status} ${t.slice(0, 300)}`);
      }
      const j = await res.json() as { data: { embedding: number[]; index: number }[] };
      // Write embeddings into out[] at the correct absolute index.
      j.data
        .sort((a, b) => a.index - b.index)
        .forEach((d, localIdx) => {
          out[start + localIdx] = d.embedding;
        });
    })
  );
  return out;
}

export async function embedTexts(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];

  if (hasVoyage()) {
    try {
      return await embedVoyage(texts, inputType);
    } catch (e: any) {
      console.warn(`[embeddings] Voyage failed (${e.message}). Using zero vectors — retrieval will not work for this batch.`);
    }
  }

  console.warn("[embeddings] No embedding provider configured. Set VOYAGE_API_KEY in .env.local.");
  return texts.map(() => new Array(EMBED_DIMS).fill(0));
}

// ─── Reranking ────────────────────────────────────────────────

export type RerankResult = { index: number; score: number };

async function rerankVoyage(opts: { query: string; documents: string[]; topK: number }): Promise<RerankResult[]> {
  const res = await withVoyageSlot(() =>
    fetch(`${VOYAGE_URL}/rerank`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: VOYAGE_RERANK_MODEL,
        query: opts.query,
        documents: opts.documents,
        top_k: opts.topK,
      }),
    })
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Voyage rerank failed: ${res.status} ${t.slice(0, 300)}`);
  }
  const j = await res.json() as { data: { index: number; relevance_score: number }[] };
  return j.data.map((d) => ({ index: d.index, score: d.relevance_score }));
}

export async function rerank(opts: {
  query: string;
  documents: string[];
  topK?: number;
}): Promise<RerankResult[]> {
  if (opts.documents.length === 0) return [];
  const topK = opts.topK ?? Math.min(opts.documents.length, 10);

  if (hasVoyage()) {
    try { return await rerankVoyage({ ...opts, topK }); }
    catch (e: any) { console.warn(`[embeddings] Voyage rerank failed: ${e.message}`); }
  }

  // Identity ordering — no reranker available
  return opts.documents.map((_, i) => ({ index: i, score: 0.5 }));
}
