#!/usr/bin/env node
/**
 * One-off migration: re-embed EVERY document_chunk with Jina
 * (jina-embeddings-v3 @ 1024 dims). Run once after switching the embedding
 * provider from Voyage to Jina — existing vectors live in voyage-3 space and
 * are incompatible with Jina query embeddings, so the whole index must be
 * rebuilt in one consistent space.
 *
 * Idempotent: re-running just overwrites with fresh Jina vectors.
 *
 * Usage: node scripts/reembed-all.mjs
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const pg = require("pg");

const env = {};
for (const line of (await readFile("./.env.local", "utf8")).split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m) env[m[1]] = m[2];
}

const JINA_KEY = env.JINA_API_KEY;
const DB_URL = env.SUPABASE_DB_URL;
if (!JINA_KEY) throw new Error("JINA_API_KEY missing");
if (!DB_URL) throw new Error("SUPABASE_DB_URL missing");

const client = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

const { rows: chunks } = await client.query(`
  select id, text_for_embedding
    from document_chunks
   where text_for_embedding is not null
   order by id
`);

if (chunks.length === 0) {
  console.log("No chunks to embed.");
  await client.end();
  process.exit(0);
}

console.log(`Re-embedding ${chunks.length} chunk(s) with Jina (jina-embeddings-v3, 1024d)...`);

const BATCH = 100;
let done = 0;

for (let i = 0; i < chunks.length; i += BATCH) {
  const batch = chunks.slice(i, i + BATCH);
  const texts = batch.map((c) => c.text_for_embedding || "");

  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${JINA_KEY}`,
    },
    body: JSON.stringify({
      model: "jina-embeddings-v3",
      input: texts,
      task: "retrieval.passage",
      dimensions: 1024,
      embedding_type: "float",
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error(`Batch ${i / BATCH + 1} failed: ${res.status} ${t.slice(0, 300)}`);
    process.exitCode = 1;
    break;
  }

  const j = await res.json();
  const ordered = j.data.sort((a, b) => a.index - b.index);

  await Promise.all(
    batch.map((c, idx) => {
      const vec = `[${ordered[idx].embedding.join(",")}]`;
      return client.query("update document_chunks set embedding = $1::vector where id = $2", [vec, c.id]);
    })
  );

  done += batch.length;
  console.log(`  ${done}/${chunks.length} done`);
}

console.log(`✓ Re-embedded ${done} chunks with Jina.`);
await client.end();
