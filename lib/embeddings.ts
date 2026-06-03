/**
 * Embeddings + reranking — Jina AI (single provider).
 *
 * Embeddings: jina-embeddings-v3 @ 1024 dims (Matryoshka-truncated). Matches the
 *   DB pgvector(1024) column and match_chunks(p_embedding vector(1024)) RPC.
 *   task = retrieval.passage for stored docs, retrieval.query for queries.
 * Rerank:     jina-reranker-v2-base-multilingual.
 *
 * Jina's free tier allows high request rates, so calls run in parallel — no
 * process-wide throttle. On a 429 we honour `retry-after` with exponential
 * backoff before surfacing a hard failure.
 */

const JINA_EMBED_URL  = "https://api.jina.ai/v1/embeddings";
const JINA_RERANK_URL = "https://api.jina.ai/v1/rerank";

const JINA_EMBED_MODEL  = process.env.JINA_EMBED_MODEL  || "jina-embeddings-v3";
const JINA_RERANK_MODEL = process.env.JINA_RERANK_MODEL || "jina-reranker-v2-base-multilingual";

export const EMBED_DIMS = 1024;

const JINA_BATCH_SIZE = 128;      // max inputs per embed call
const MAX_RETRY_WAIT_MS = 30_000;
const MAX_RETRIES = 4;

function hasJinaKey() { return !!process.env.JINA_API_KEY; }

/** True if an embedding/rerank provider is available. */
export function hasEmbeddings() { return hasJinaKey(); }

export class JinaRateLimitError extends Error {
  constructor(message: string, public retryAfterMs: number) {
    super(message);
    this.name = "JinaRateLimitError";
  }
}

// Shared POST with retry/backoff on 429. No throttle — Jina tolerates parallel
// calls at our volume, so callers fan out freely.
async function jinaFetch(url: string, body: any): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.JINA_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "5");
      const base = Math.max(1_000, retryAfter * 1000);
      const backoff = Math.min(MAX_RETRY_WAIT_MS, base * Math.pow(2, attempt));
      if (attempt < MAX_RETRIES) {
        const jitter = backoff * (0.7 + Math.random() * 0.6);
        console.warn(`[jina] 429 on ${url} (attempt ${attempt + 1}) — retrying in ${Math.round(jitter / 1000)}s`);
        await new Promise((r) => setTimeout(r, jitter));
        attempt++;
        continue;
      }
      throw new JinaRateLimitError(`Jina 429 on ${url} after ${MAX_RETRIES} retries`, base);
    }

    return res;
  }
}

// ─── Embeddings ──────────────────────────────────────────────

async function embedJinaBatch(
  batch: string[],
  inputType: "document" | "query"
): Promise<number[][]> {
  const res = await jinaFetch(JINA_EMBED_URL, {
    model: JINA_EMBED_MODEL,
    input: batch,
    task: inputType === "query" ? "retrieval.query" : "retrieval.passage",
    dimensions: EMBED_DIMS,
    embedding_type: "float",
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Jina embed failed: ${res.status} ${t.slice(0, 300)}`);
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
 * Throws if Jina is not configured or the call fails. Callers must catch and
 * mark the document/chunk as failed.
 */
export async function embedTexts(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!hasJinaKey()) {
    throw new Error("Embeddings unavailable: JINA_API_KEY not set in .env.local.");
  }

  const out: number[][] = new Array(texts.length);
  const batches: { start: number; texts: string[] }[] = [];
  for (let i = 0; i < texts.length; i += JINA_BATCH_SIZE) {
    batches.push({ start: i, texts: texts.slice(i, i + JINA_BATCH_SIZE) });
  }

  // Batches run in parallel — Jina's free tier handles this for solo workloads.
  await Promise.all(
    batches.map(async ({ start, texts: batch }) => {
      const embs = await embedJinaBatch(batch, inputType);
      embs.forEach((e, i) => {
        out[start + i] = e;
      });
    })
  );

  return out;
}

// ─── Reranking ────────────────────────────────────────────────

export type RerankResult = { index: number; score: number };

async function rerankJina(opts: {
  query: string;
  documents: string[];
  topK: number;
}): Promise<RerankResult[]> {
  const res = await jinaFetch(JINA_RERANK_URL, {
    model: JINA_RERANK_MODEL,
    query: opts.query,
    documents: opts.documents,
    top_n: opts.topK,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Jina rerank failed: ${res.status} ${t.slice(0, 300)}`);
  }

  const j = (await res.json()) as {
    results: { index: number; relevance_score: number }[];
  };
  return j.results.map((d) => ({ index: d.index, score: d.relevance_score }));
}

/**
 * Rerank documents. Degrades to identity ordering (score 0.5) if Jina is
 * unavailable or errors — rerank is a quality boost, not a hard requirement, so
 * we never fail the whole request on it.
 */
export async function rerank(opts: {
  query: string;
  documents: string[];
  topK?: number;
}): Promise<RerankResult[]> {
  if (opts.documents.length === 0) return [];
  const topK = opts.topK ?? Math.min(opts.documents.length, 10);

  if (hasJinaKey()) {
    try {
      return await rerankJina({ ...opts, topK });
    } catch (e: any) {
      console.warn(`[embeddings] Jina rerank failed: ${e.message}`);
    }
  }

  return opts.documents.map((_, i) => ({ index: i, score: 0.5 }));
}
