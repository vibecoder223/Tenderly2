/**
 * Agent pipeline.
 *
 * RFP-side pipeline (M3 repaired): ingestion → chunking (page-aware) →
 * requirement extraction (zod-validated) → structuring (compliance matrix
 * + questions) → response generation (handled separately by lib/rag.ts).
 *
 * Each step persists results to Supabase and records an `agent_runs` entry
 * with token usage + estimated cost.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { callClaudeJson, callClaudeText, estimateCost } from "./anthropic";
import { parseDocument, type ParsedDoc } from "./parse";
import { chunkBlocks, type ProducedChunk } from "./chunk";
import { embedTexts, hasVoyage } from "./embeddings";
import { generateAndPersistAnswer } from "./rag";

type Doc = {
  id: string;
  deal_id: string;
  filename: string;
  file_path: string;
  mime_type: string | null;
  extracted_text: string | null;
};

async function recordRun(
  supabase: SupabaseClient,
  args: {
    document_id: string;
    agent_type: string;
    status: "completed" | "failed";
    input_tokens?: number;
    output_tokens?: number;
    error_message?: string;
    result?: unknown;
    startedAt: number;
  }
) {
  await supabase.from("agent_runs").insert({
    document_id: args.document_id,
    agent_type: args.agent_type,
    status: args.status,
    input_tokens: args.input_tokens ?? null,
    output_tokens: args.output_tokens ?? null,
    cost:
      args.input_tokens != null && args.output_tokens != null
        ? estimateCost(args.input_tokens, args.output_tokens)
        : null,
    error_message: args.error_message ?? null,
    result: (args.result as object) ?? null,
    started_at: new Date(args.startedAt).toISOString(),
    completed_at: new Date().toISOString(),
  });
}

async function setStatus(
  supabase: SupabaseClient,
  documentId: string,
  status: string,
  errorMessage?: string
) {
  await supabase
    .from("documents")
    .update({
      processing_status: status,
      error_message: errorMessage ?? null,
    })
    .eq("id", documentId);
}

// ============================================================
// Agent 1: Ingestion — download from Storage, parse to typed blocks.
// Now uses lib/parse.ts (page-aware).
// ============================================================
export async function runIngestionAgent(
  supabase: SupabaseClient,
  doc: Doc
): Promise<ParsedDoc> {
  const startedAt = Date.now();
  await setStatus(supabase, doc.id, "extracting");
  try {
    const { data, error } = await supabase.storage.from("documents").download(doc.file_path);
    if (error) throw error;
    const buf = Buffer.from(await data.arrayBuffer());
    const parsed = await parseDocument(buf, doc.mime_type, doc.filename);
    if (!parsed.blocks.length) throw new Error("No content extracted from this document.");
    await supabase
      .from("documents")
      .update({ extracted_text: parsed.raw_text })
      .eq("id", doc.id);
    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "ingestion",
      status: "completed",
      result: { chars: parsed.raw_text.length, pages: parsed.page_count, blocks: parsed.blocks.length },
      startedAt,
    });
    return parsed;
  } catch (e: any) {
    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "ingestion",
      status: "failed",
      error_message: e.message,
      startedAt,
    });
    throw e;
  }
}

// ============================================================
// Agent 2: Chunking — token-aware, page-aware. Also embeds + writes the
// RFP's own chunks into the same `document_chunks` table the KB uses, so
// the RFP can be searched as part of its own context if useful.
// ============================================================
export async function runChunkingAgent(
  supabase: SupabaseClient,
  doc: Doc,
  parsed: ParsedDoc
): Promise<ProducedChunk[]> {
  const startedAt = Date.now();
  await setStatus(supabase, doc.id, "chunked");
  try {
    const chunks = chunkBlocks({ blocks: parsed.blocks, filename: doc.filename });

    // Resolve org_id once for storage.
    const { data: deal } = await supabase
      .from("deals")
      .select("org_id")
      .eq("id", doc.deal_id)
      .single();
    const orgId = deal?.org_id ?? null;

    // Embed (no-op zero vectors if Voyage key missing).
    const embeddings = await embedTexts(
      chunks.map((c) => c.text_for_embedding),
      "document"
    );

    await supabase.from("document_chunks").delete().eq("document_id", doc.id);
    if (chunks.length > 0) {
      const rows = chunks.map((c, i) => ({
        document_id: doc.id,
        org_id: orgId,
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
      for (let i = 0; i < rows.length; i += 50) {
        const { error } = await supabase
          .from("document_chunks")
          .insert(rows.slice(i, i + 50));
        if (error) throw new Error(`Chunk insert failed: ${error.message}`);
      }
    }
    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "chunking",
      status: "completed",
      result: { chunk_count: chunks.length },
      startedAt,
    });
    return chunks;
  } catch (e: any) {
    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "chunking",
      status: "failed",
      error_message: e.message,
      startedAt,
    });
    throw e;
  }
}

// ============================================================
// Agent 3: Requirement extraction (LLM, zod-validated, with retry).
// ============================================================
const RequirementSchema = z.object({
  requirement_id: z.string().min(1),
  section: z.string().optional().nullable(),
  text: z.string().min(1),
  classification: z.enum(["must", "should", "info"]).default("must"),
  topic: z
    .enum(["security", "legal", "pricing", "technical", "commercial"])
    .default("technical"),
  source_page: z.number().int().nullable().optional(),
});
const RequirementArraySchema = z.array(RequirementSchema);

type ExtractedRequirement = z.infer<typeof RequirementSchema>;

export async function runExtractionAgent(
  supabase: SupabaseClient,
  doc: Doc,
  chunks: ProducedChunk[]
): Promise<ExtractedRequirement[]> {
  const startedAt = Date.now();
  await setStatus(supabase, doc.id, "analyzing");
  const allReqs: ExtractedRequirement[] = [];
  let totalIn = 0;
  let totalOut = 0;

  try {
    for (const c of chunks) {
      const sys = `You are an expert RFP analyst. Extract every distinct requirement, question, or compliance item from the given RFP section. Be exhaustive but de-duplicate.

Return a JSON array. Each item:
{
  "requirement_id": "Q2.3" | "R-4.1" | "REQ-N",   // stable identifier, prefer the document's own numbering
  "section": "4.2" | "Section 4.2 Security",        // section identifier or title if visible
  "text": "<the full requirement text, paraphrased if needed>",
  "classification": "must" | "should" | "info",     // must = shall/required/mandatory; should = should/preferred; info = informational
  "topic": "security" | "legal" | "pricing" | "technical" | "commercial",
  "source_page": <integer page number from the supplied page hint, or null>
}

Return ONLY the JSON array. No prose, no markdown fences.`;

      const user = `Section: ${c.section_path || "Body"}
Source page: ${c.page_start}${c.page_end !== c.page_start ? `–${c.page_end}` : ""}

${c.text}`;

      let parsed: ExtractedRequirement[] | null = null;
      let lastErr: string | null = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data, usage } = await callClaudeJson<unknown>({
            system: sys,
            user:
              attempt === 0
                ? user
                : `${user}\n\n[Previous response failed validation: ${lastErr}. Return ONLY a JSON array matching the schema.]`,
            maxTokens: 4096,
          });
          totalIn += usage.input_tokens;
          totalOut += usage.output_tokens;
          const validated = RequirementArraySchema.safeParse(data);
          if (validated.success) {
            parsed = validated.data;
            break;
          }
          lastErr = validated.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
        } catch (e: any) {
          lastErr = e.message;
        }
      }
      if (!parsed) {
        // Skip this chunk — don't fail the entire run on one bad section.
        continue;
      }
      for (const r of parsed) {
        // Fill source_page from chunk if model didn't provide one.
        if (r.source_page == null) r.source_page = c.page_start;
        allReqs.push(r);
      }
    }

    // Dedup by (requirement_id, text)
    const seen = new Set<string>();
    const deduped = allReqs.filter((r) => {
      const k = `${r.requirement_id}::${r.text.slice(0, 100)}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    await supabase.from("extracted_requirements").delete().eq("document_id", doc.id);
    if (deduped.length > 0) {
      await supabase.from("extracted_requirements").insert(
        deduped.map((r) => ({
          document_id: doc.id,
          requirement_id: r.requirement_id,
          title: r.text.slice(0, 120),
          description: r.text,
          // Legacy columns (kept for back-compat with existing UI):
          category: r.topic,
          priority: r.classification === "must" ? "high" : r.classification === "should" ? "medium" : "low",
          is_mandatory: r.classification === "must",
          // New spec-aligned columns:
          section: r.section ?? null,
          source_page: r.source_page ?? null,
          classification: r.classification,
          topic: r.topic,
        }))
      );
    }

    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "extraction",
      status: "completed",
      input_tokens: totalIn,
      output_tokens: totalOut,
      result: { count: deduped.length },
      startedAt,
    });
    return deduped;
  } catch (e: any) {
    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "extraction",
      status: "failed",
      input_tokens: totalIn,
      output_tokens: totalOut,
      error_message: e.message,
      startedAt,
    });
    throw e;
  }
}

// ============================================================
// Agent 4: Structuring — build compliance matrix + questions.
// ============================================================
export async function runStructuringAgent(
  supabase: SupabaseClient,
  doc: Doc,
  reqs: ExtractedRequirement[]
) {
  const startedAt = Date.now();
  await setStatus(supabase, doc.id, "structured");
  try {
    await supabase.from("compliance_matrix").delete().eq("document_id", doc.id);
    await supabase.from("questions").delete().eq("document_id", doc.id);

    if (reqs.length > 0) {
      await supabase.from("compliance_matrix").insert(
        reqs.map((r) => ({
          document_id: doc.id,
          requirement_id: r.requirement_id,
          our_capability: null,
          compliance_status: "pending",
        }))
      );
      await supabase.from("questions").insert(
        reqs.map((r) => ({
          document_id: doc.id,
          requirement_id: r.requirement_id,
          question_text: r.text,
          category: r.topic,
          priority:
            r.classification === "must"
              ? "high"
              : r.classification === "should"
              ? "medium"
              : "low",
          status: "pending",
        }))
      );
    }

    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "structuring",
      status: "completed",
      result: { count: reqs.length },
      startedAt,
    });
  } catch (e: any) {
    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "structuring",
      status: "failed",
      error_message: e.message,
      startedAt,
    });
    throw e;
  }
}

// ============================================================
// Agent 5: Response generation. Now delegates to lib/rag.ts which runs
// retrieval + grounded generation + confidence scoring per requirement.
// ============================================================
export async function runResponseGenerationAgent(
  supabase: SupabaseClient,
  doc: Doc,
  opts: { orgName: string; tone?: string }
) {
  const startedAt = Date.now();
  let totalIn = 0;
  let totalOut = 0;
  try {
    const { data: deal } = await supabase
      .from("deals")
      .select("org_id")
      .eq("id", doc.deal_id)
      .single();
    if (!deal) throw new Error("Deal not found for response generation");

    const { data: questions } = await supabase
      .from("questions")
      .select("id, question_text, category, requirement_id")
      .eq("document_id", doc.id);

    if (!questions || questions.length === 0) {
      await setStatus(supabase, doc.id, "completed");
      await recordRun(supabase, {
        document_id: doc.id,
        agent_type: "generation",
        status: "completed",
        result: { count: 0 },
        startedAt,
      });
      return;
    }

    for (const q of questions) {
      const usage = await generateAndPersistAnswer(supabase, {
        question_id: q.id,
        question_text: q.question_text,
        org_id: deal.org_id,
        org_name: opts.orgName,
        tone: opts.tone || "technical",
      });
      totalIn += usage.input_tokens;
      totalOut += usage.output_tokens;
    }

    await setStatus(supabase, doc.id, "completed");
    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "generation",
      status: "completed",
      input_tokens: totalIn,
      output_tokens: totalOut,
      result: { count: questions.length },
      startedAt,
    });
  } catch (e: any) {
    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "generation",
      status: "failed",
      input_tokens: totalIn,
      output_tokens: totalOut,
      error_message: e.message,
      startedAt,
    });
    throw e;
  }
}

// ============================================================
// Orchestrator
// ============================================================
export async function runFullPipeline(
  supabase: SupabaseClient,
  documentId: string,
  opts: { orgName: string; tone?: string }
) {
  const { data: doc, error } = await supabase
    .from("documents")
    .select("id, deal_id, filename, file_path, mime_type, extracted_text")
    .eq("id", documentId)
    .single();
  if (error || !doc) throw new Error(error?.message || "Document not found");

  try {
    const parsed = await runIngestionAgent(supabase, doc);
    const chunks = await runChunkingAgent(supabase, doc, parsed);
    const reqs = await runExtractionAgent(supabase, doc, chunks);
    await runStructuringAgent(supabase, doc, reqs);
    await runResponseGenerationAgent(supabase, doc, opts);
  } catch (e: any) {
    await setStatus(supabase, documentId, "failed", e.message);
    throw e;
  }
}
