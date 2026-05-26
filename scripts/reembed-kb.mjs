#!/usr/bin/env node
/**
 * One-off: find document_chunks belonging to knowledge_documents whose
 * embeddings are NULL and re-embed them via Jina. Fixes the legacy "Stored
 * without embeddings — VOYAGE_API_KEY not configured" docs from before the
 * Jina migration.
 *
 * Usage: node scripts/reembed-kb.mjs
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

// Pull all chunks tied to a knowledge_document that have NULL embeddings.
const { rows: chunks } = await client.query(`
  select dc.id, dc.text_for_embedding, dc.knowledge_document_id
    from document_chunks dc
   where dc.knowledge_document_id is not null
     and dc.embedding is null
   order by dc.knowledge_document_id, dc.chunk_index
`);

if (chunks.length === 0) {
  console.log("No KB chunks need re-embedding.");
  await client.end();
  process.exit(0);
}

console.log(`Re-embedding ${chunks.length} KB chunk(s)...`);

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

  // Update each chunk with its embedding. pgvector accepts the array as text.
  await Promise.all(
    batch.map((c, idx) => {
      const vec = `[${ordered[idx].embedding.join(",")}]`;
      return client.query("update document_chunks set embedding = $1::vector where id = $2", [vec, c.id]);
    })
  );

  done += batch.length;
  console.log(`  ${done}/${chunks.length} done`);
}

// Make sure the parent docs are flagged ready with a clean error_message.
await client.query(`
  update knowledge_documents
     set error_message = null
   where ingestion_status = 'ready'
     and error_message ilike '%Stored without embeddings%'
`);

console.log(`✓ Re-embedded ${done} chunks.`);
await client.end();
