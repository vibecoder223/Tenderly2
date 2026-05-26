/**
 * Embeddings + reranking — Jina AI only.
 *
 * Embedding model: jina-embeddings-v3 @ 1024 dimensions. Matches our DB column.
 * Rerank model:    jina-reranker-v2-base-multilingual.
 *
 * Calls fire without artificial throttling. On a real 429 we honour the
 * `retry-after` header and retry once. Persistent 429 bubbles a real error
 * so callers can mark the document failed instead of waiting forever.
 */

const JINA_URL = "https://api.jina.ai/v1";

const JINA_EMBED_MODEL  = process.env.JINA_EMBED_MODEL  || "jina-embeddings-v3";
const JINA_RERANK_MODEL = process.env.JINA_RERANK_MODEL || "jina-reranker-v2-base-multilingual";

export const EMBED_DIMS = 1024;

const JINA_BATCH_SIZE = 100;
const MAX_RETRY_WAIT_MS = 30_000;
const MAX_RETRIES = 3;

function hasJina() { return !!process.env.JINA_API_KEY; }

/** True if any embedding provider is available. */
export function hasEmbeddings() { return hasJina(); }

/** Legacy alias — kept so older callers compile. Routes to hasJina. */
export const hasVoyage = hasJina;

export class JinaRateLimitError extends Error {
  constructor(message: string, public retryAfterMs: number) {
    super(message);
    this.name = "JinaRateLimitError";
  }
}

async function jinaFetch(path: string, body: any): Promise<Response> {
  let attempt = 0;
  while (true) {
    const res = await fetch(`${JINA_URL}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.JINA_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "5");
      // Back off with exponential growth so a thundering herd of parallel
      // batches doesn't all retry on the same tick.
      const base = Math.max(1_000, retryAfter * 1000);
      const backoff = Math.min(MAX_RETRY_WAIT_MS, base * Math.pow(2, attempt));
      if (attempt < MAX_RETRIES) {
        const jitter = backoff * (0.7 + Math.random() * 0.6);
        console.warn(`[jina] 429 on ${path} (attempt ${attempt + 1}) — retrying in ${Math.round(jitter / 1000)}s`);
        await new Promise((r) => setTimeout(r, jitter));
        attempt++;
        continue;
      }
      throw new JinaRateLimitError(
        `Jina 429 on ${path} after ${MAX_RETRIES} retries`,
        base,
      );
    }

    return res;
  }
}

// ─── Embeddings ──────────────────────────────────────────────

async function embedJinaBatch(
  batch: string[],
  inputType: "document" | "query"
): Promise<number[][]> {
  const task = inputType === "query" ? "retrieval.query" : "retrieval.passage";

  const res = await jinaFetch("/embeddings", {
    model: JINA_EMBED_MODEL,
    input: batch,
    task,
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

  // Batches run in parallel — Jina free tier is generous (500 RPM, 1M
  // tokens/month) and we rarely send more than a few batches per doc.
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
  const res = await jinaFetch("/rerank", {
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
