/**
 * Embeddings + reranking — Jina AI only.
 *
 * Embedding model: jina-embeddings-v3 @ 1024 dimensions. Matches our DB column.
 * Rerank model:    jina-reranker-v2-base-multilingual.
 *
 * All calls route through the central rate limiter. embedTexts throws if
 * Jina is missing or fails — callers must catch and mark the document as
 * failed. No silent zero-vector fallback (that hid broken docs).
 */

import { withRateLimit, estimateTokens } from "./rate-limiter";

const JINA_URL = "https://api.jina.ai/v1";

const JINA_EMBED_MODEL  = process.env.JINA_EMBED_MODEL  || "jina-embeddings-v3";
const JINA_RERANK_MODEL = process.env.JINA_RERANK_MODEL || "jina-reranker-v2-base-multilingual";

export const EMBED_DIMS = 1024;

const JINA_BATCH_SIZE = 100;

function hasJina() { return !!process.env.JINA_API_KEY; }

/** True if any embedding provider is available. */
export function hasEmbeddings() { return hasJina(); }

/** Legacy alias — kept so older callers compile. Routes to hasJina. */
export const hasVoyage = hasJina;

// ─── Embeddings ──────────────────────────────────────────────

async function embedJinaBatch(
  batch: string[],
  inputType: "document" | "query"
): Promise<number[][]> {
  const task = inputType === "query" ? "retrieval.query" : "retrieval.passage";
  const estimate = batch.reduce((s, t) => s + estimateTokens(t), 0);

  return await withRateLimit("jina-embed", estimate, async () => {
    const res = await fetch(`${JINA_URL}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.JINA_API_KEY}`,
      },
      body: JSON.stringify({
        model: JINA_EMBED_MODEL,
        input: batch,
        task,
        dimensions: EMBED_DIMS,
        embedding_type: "float",
      }),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "10");
      return {
        actualTokens: 0,
        retryAfterMs: Math.min(60_000, Math.max(2_000, retryAfter * 1000)),
        value: null as any,
      };
    }

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Jina embed failed: ${res.status} ${t.slice(0, 300)}`);
    }

    const j = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
      usage?: { total_tokens?: number };
    };
    const result: number[][] = new Array(batch.length);
    j.data
      .sort((a, b) => a.index - b.index)
      .forEach((d, localIdx) => {
        result[localIdx] = d.embedding;
      });

    return {
      actualTokens: j.usage?.total_tokens ?? estimate,
      value: result,
    };
  });
}

/**
 * Embed a list of texts.
 * Throws if Jina is not configured or the call fails. Callers must catch
 * and mark the document/chunk as failed.
 */
export async function embedTexts(
  texts: string[],
  inputType: "document" | "query" = "document"
): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!hasJina()) {
    throw new Error("Embeddings unavailable: JINA_API_KEY not set in .env.local.");
  }

  const out: number[][] = new Array(texts.length);
  const batches: { start: number; texts: string[] }[] = [];
  for (let i = 0; i < texts.length; i += JINA_BATCH_SIZE) {
    batches.push({ start: i, texts: texts.slice(i, i + JINA_BATCH_SIZE) });
  }

  // Batches run in parallel; limiter handles pacing/queueing.
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
  const estimate =
    estimateTokens(opts.query) +
    opts.documents.reduce((s, d) => s + estimateTokens(d), 0);

  return await withRateLimit("jina-rerank", estimate, async () => {
    const res = await fetch(`${JINA_URL}/rerank`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.JINA_API_KEY}`,
      },
      body: JSON.stringify({
        model: JINA_RERANK_MODEL,
        query: opts.query,
        documents: opts.documents,
        top_n: opts.topK,
      }),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "10");
      return {
        actualTokens: 0,
        retryAfterMs: Math.min(60_000, Math.max(2_000, retryAfter * 1000)),
        value: null as any,
      };
    }

    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Jina rerank failed: ${res.status} ${t.slice(0, 300)}`);
    }

    const j = (await res.json()) as {
      results: { index: number; relevance_score: number }[];
      usage?: { total_tokens?: number };
    };
    return {
      actualTokens: j.usage?.total_tokens ?? estimate,
      value: j.results.map((d) => ({ index: d.index, score: d.relevance_score })),
    };
  });
}

/**
 * Rerank documents. Returns identity ordering with score 0.5 if Jina is
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

  if (hasJina()) {
    try {
      return await rerankJina({ ...opts, topK });
    } catch (e: any) {
      console.warn(`[embeddings] Jina rerank failed: ${e.message}`);
    }
  }

  return opts.documents.map((_, i) => ({ index: i, score: 0.5 }));
}
