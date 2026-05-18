/**
 * Knowledge-base ingestion: download → parse → chunk → embed → store.
 * Returns the chunk count on success, throws on failure. Status transitions
 * are managed by the caller via knowledge_documents.ingestion_status.
 */

import crypto from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseDocument } from "./parse";
import { chunkBlocks } from "./chunk";
import { embedTexts, EMBED_DIMS, hasVoyage } from "./embeddings";

type KDoc = {
  id: string;
  org_id: string;
  filename: string;
  file_path: string;
  mime_type: string | null;
};

export async function ingestKnowledgeDocument(
  supabase: SupabaseClient,
  doc: KDoc
): Promise<{ chunk_count: number; page_count: number; dedup: boolean }> {
  await supabase
    .from("knowledge_documents")
    .update({ ingestion_status: "processing", error_message: null })
    .eq("id", doc.id);

  // 1. Download
  const { data: blob, error: dlErr } = await supabase.storage
    .from("knowledge")
    .download(doc.file_path);
  if (dlErr || !blob) throw new Error(`Storage download failed: ${dlErr?.message ?? "no data"}`);
  const buf = Buffer.from(await blob.arrayBuffer());

  // 2. Parse
  const parsed = await parseDocument(buf, doc.mime_type, doc.filename);
  if (!parsed.blocks.length) throw new Error("No content extracted from document.");

  // 3. Hash for dedup
  const textHash = crypto.createHash("sha256").update(parsed.raw_text).digest("hex");

  // If the same hash already ingested in this org, skip re-chunking.
  const { data: existing } = await supabase
    .from("knowledge_documents")
    .select("id, ingestion_status")
    .eq("org_id", doc.org_id)
    .eq("text_hash", textHash)
    .neq("id", doc.id)
    .maybeSingle();
  if (existing && existing.ingestion_status === "ready") {
    // Mark current as ready and link to the existing chunks logically by hash.
    // (We don't try to literally re-point — the user has two rows, which is fine.)
    await supabase
      .from("knowledge_documents")
      .update({
        ingestion_status: "ready",
        text_hash: textHash,
        page_count: parsed.page_count,
        error_message: "Deduplicated against a previously ingested document with identical text.",
      })
      .eq("id", doc.id);
    return { chunk_count: 0, page_count: parsed.page_count, dedup: true };
  }

  // 4. Chunk
  const chunks = chunkBlocks({ blocks: parsed.blocks, filename: doc.filename });
  if (chunks.length === 0) throw new Error("Chunker produced 0 chunks (document may be empty).");

  // 5. Embed (batched inside embedTexts)
  const embeddings = await embedTexts(
    chunks.map((c) => c.text_for_embedding),
    "document"
  );

  // 6. Persist — wipe any prior chunks for this KB doc (idempotent re-ingest)
  await supabase.from("document_chunks").delete().eq("knowledge_document_id", doc.id);

  const rows = chunks.map((c, i) => ({
    knowledge_document_id: doc.id,
    org_id: doc.org_id,
    chunk_index: i,
    section_title: c.section_path,
    section_path: c.section_path,
    page_start: c.page_start,
    page_end: c.page_end,
    raw_text: c.text,
    cleaned_text: c.text,
    text_for_embedding: c.text_for_embedding,
    embedding: hasVoyage() ? embeddings[i] : null,
    sparse_terms: c.sparse_terms,
  }));

  // Insert in slices — Postgres has practical limits on row size for vector columns.
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase.from("document_chunks").insert(rows.slice(i, i + 50));
    if (error) throw new Error(`Chunk insert failed: ${error.message}`);
  }

  await supabase
    .from("knowledge_documents")
    .update({
      ingestion_status: "ready",
      page_count: parsed.page_count,
      text_hash: textHash,
      error_message: hasVoyage()
        ? null
        : "Stored without embeddings — VOYAGE_API_KEY not configured. Set it and re-ingest to enable retrieval.",
    })
    .eq("id", doc.id);

  return { chunk_count: chunks.length, page_count: parsed.page_count, dedup: false };
}
