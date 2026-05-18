/**
 * Voyage AI embeddings + reranking. Both used in the RAG pipeline.
 * Voyage requires VOYAGE_API_KEY. When missing, callers fall back to a
 * deterministic no-op embedding (zero vector) which means the chunk gets
 * stored but won't match anything until re-embedded with a key set.
 */

const VOYAGE_URL = "https://api.voyageai.com/v1";

const EMBED_MODEL = process.env.VOYAGE_EMBED_MODEL || "voyage-3-large";
const RERANK_MODEL = process.env.VOYAGE_RERANK_MODEL || "rerank-2";

export const EMBED_DIMS = 1024;

export function hasVoyage() {
  return !!process.env.VOYAGE_API_KEY;
}

export async function embedTexts(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!hasVoyage()) {
    // Deterministic no-op: zero vectors so callers can still write a chunk row.
    return texts.map(() => new Array(EMBED_DIMS).fill(0));
  }
  const out: number[][] = [];
  // Voyage caps at 128/batch and 320k tokens/batch. We use 64 to be conservative.
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64);
    const res = await fetch(`${VOYAGE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
      },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: batch,
        input_type: inputType,
        output_dimension: EMBED_DIMS,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Voyage embed failed: ${res.status} ${t.slice(0, 300)}`);
    }
    const j = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
    };
    // Voyage returns indices keyed to the batch.
    const sorted = j.data.sort((a, b) => a.index - b.index);
    for (const d of sorted) out.push(d.embedding);
  }
  return out;
}

export type RerankResult = { index: number; score: number };

export async function rerank(opts: {
  query: string;
  documents: string[];
  topK?: number;
}): Promise<RerankResult[]> {
  if (opts.documents.length === 0) return [];
  if (!hasVoyage()) {
    // No rerank available — return identity ordering with neutral scores.
    return opts.documents.map((_, i) => ({ index: i, score: 0.5 }));
  }
  const res = await fetch(`${VOYAGE_URL}/rerank`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query: opts.query,
      documents: opts.documents,
      top_k: opts.topK ?? Math.min(opts.documents.length, 10),
    }),
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
