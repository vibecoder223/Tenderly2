/**
 * Agent pipeline: ingestion → chunking → extraction → structuring → response generation.
 * Each step persists results to Supabase and records an `agent_runs` entry with usage/cost.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { callClaudeJson, callClaudeText, estimateCost } from "./anthropic";
import { extractText } from "./extract";

type Doc = {
  id: string;
  deal_id: string;
  filename: string;
  file_path: string;
  mime_type: string | null;
  extracted_text: string | null;
};

const MAX_CHUNK_CHARS = 8000;

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
// Agent 1: Ingestion — download file from Storage, extract raw text
// ============================================================
export async function runIngestionAgent(supabase: SupabaseClient, doc: Doc) {
  const startedAt = Date.now();
  await setStatus(supabase, doc.id, "extracting");
  try {
    const { data, error } = await supabase.storage.from("documents").download(doc.file_path);
    if (error) throw error;
    const buf = Buffer.from(await data.arrayBuffer());
    const text = await extractText(buf, doc.mime_type, doc.filename);
    if (!text.trim()) throw new Error("No text could be extracted from this document.");
    await supabase.from("documents").update({ extracted_text: text }).eq("id", doc.id);
    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "ingestion",
      status: "completed",
      result: { chars: text.length },
      startedAt,
    });
    return text;
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
// Agent 2: Chunking — split by headings, cap chunk size
// ============================================================
export async function runChunkingAgent(supabase: SupabaseClient, doc: Doc, text: string) {
  const startedAt = Date.now();
  await setStatus(supabase, doc.id, "chunked");
  try {
    const chunks = chunkText(text);
    // Wipe & insert (idempotent if re-run)
    await supabase.from("document_chunks").delete().eq("document_id", doc.id);
    if (chunks.length > 0) {
      await supabase.from("document_chunks").insert(
        chunks.map((c, i) => ({
          document_id: doc.id,
          chunk_index: i,
          section_title: c.title,
          raw_text: c.text,
          cleaned_text: c.text,
        }))
      );
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

function chunkText(text: string): { title: string | null; text: string }[] {
  // Split by likely section headers; then break long sections by size.
  const lines = text.split("\n");
  const sections: { title: string | null; lines: string[] }[] = [{ title: null, lines: [] }];

  const headerRe = /^(?:\s*(?:section\s+\d+|chapter\s+\d+|appendix\s+[A-Z]|[A-Z][A-Z0-9 ,&\-]{4,}|\d+(?:\.\d+)*\s+[A-Z]))[^.]{0,160}$/i;

  for (const line of lines) {
    if (headerRe.test(line.trim()) && line.trim().length < 200) {
      sections.push({ title: line.trim(), lines: [] });
    } else {
      sections[sections.length - 1].lines.push(line);
    }
  }

  const out: { title: string | null; text: string }[] = [];
  for (const sec of sections) {
    const body = sec.lines.join("\n").trim();
    if (!body) continue;
    if (body.length <= MAX_CHUNK_CHARS) {
      out.push({ title: sec.title, text: body });
    } else {
      let i = 0;
      while (i < body.length) {
        out.push({ title: sec.title, text: body.slice(i, i + MAX_CHUNK_CHARS) });
        i += MAX_CHUNK_CHARS;
      }
    }
  }
  return out;
}

// ============================================================
// Agent 3: Requirement extraction (LLM)
// ============================================================
type ExtractedRequirement = {
  requirement_id: string;
  title: string;
  description: string;
  category: "technical" | "compliance" | "commercial" | "operational";
  priority: "low" | "medium" | "high" | "critical";
  is_mandatory: boolean;
};

export async function runExtractionAgent(
  supabase: SupabaseClient,
  doc: Doc,
  chunks: { title: string | null; text: string }[]
) {
  const startedAt = Date.now();
  await setStatus(supabase, doc.id, "analyzing");

  const allReqs: ExtractedRequirement[] = [];
  let totalIn = 0;
  let totalOut = 0;

  try {
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      const sys = `You are an expert RFP analyst. Extract every requirement, question, and compliance item from the given RFP section. Be exhaustive but de-duplicate.

For each requirement, output a JSON object with:
- requirement_id: a stable identifier like "Q2.3", "R-4.1", or "REQ-${i + 1}-N"
- title: short summary (max 120 chars)
- description: the full requirement text, paraphrased if needed
- category: one of "technical" | "compliance" | "commercial" | "operational"
- priority: one of "low" | "medium" | "high" | "critical"
- is_mandatory: boolean — true if marked must / shall / required

Return ONLY a JSON array, no prose, no markdown fences.`;

      const user = `Section${c.title ? ` — ${c.title}` : ""}:\n\n${c.text}`;
      const { data, usage } = await callClaudeJson<ExtractedRequirement[]>({
        system: sys,
        user,
        maxTokens: 4096,
      });
      totalIn += usage.input_tokens;
      totalOut += usage.output_tokens;
      if (Array.isArray(data)) {
        for (const r of data) {
          if (r && typeof r === "object" && r.title) allReqs.push(r);
        }
      }
    }

    // Persist (replace any prior run)
    await supabase.from("extracted_requirements").delete().eq("document_id", doc.id);
    if (allReqs.length > 0) {
      await supabase.from("extracted_requirements").insert(
        allReqs.map((r) => ({
          document_id: doc.id,
          requirement_id: r.requirement_id ?? null,
          title: r.title,
          description: r.description ?? null,
          category: r.category ?? null,
          priority: r.priority ?? "medium",
          is_mandatory: !!r.is_mandatory,
        }))
      );
    }

    await recordRun(supabase, {
      document_id: doc.id,
      agent_type: "extraction",
      status: "completed",
      input_tokens: totalIn,
      output_tokens: totalOut,
      result: { count: allReqs.length },
      startedAt,
    });
    return allReqs;
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
// Agent 4: Structuring — build compliance matrix + questions
// ============================================================
export async function runStructuringAgent(
  supabase: SupabaseClient,
  doc: Doc,
  reqs: ExtractedRequirement[]
) {
  const startedAt = Date.now();
  await setStatus(supabase, doc.id, "structured");
  try {
    // Compliance matrix: one row per requirement, status "pending" by default
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
      // Questions: one per requirement, status pending
      await supabase.from("questions").insert(
        reqs.map((r) => ({
          document_id: doc.id,
          requirement_id: r.requirement_id,
          question_text: `${r.title}${r.description ? `\n\n${r.description}` : ""}`,
          category: r.category,
          priority: r.priority,
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
// Agent 5: Response generation (LLM, per question) — initial drafts
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
    const { data: questions } = await supabase
      .from("questions")
      .select("id, question_text, category")
      .eq("document_id", doc.id);

    if (!questions || questions.length === 0) {
      await recordRun(supabase, {
        document_id: doc.id,
        agent_type: "generation",
        status: "completed",
        result: { count: 0 },
        startedAt,
      });
      return;
    }

    // Reuse library responses from same org for context
    const { data: deal } = await supabase
      .from("deals")
      .select("org_id")
      .eq("id", doc.deal_id)
      .single();
    const { data: library } = deal
      ? await supabase
          .from("response_library")
          .select("category, keyword, response_text")
          .eq("org_id", deal.org_id)
          .limit(20)
      : { data: [] as any[] };

    const tone = opts.tone || "technical";
    const libraryContext = (library ?? [])
      .map((l) => `[${l.category ?? "general"}${l.keyword ? ` / ${l.keyword}` : ""}] ${l.response_text}`)
      .join("\n\n")
      .slice(0, 6000);

    for (const q of questions) {
      const sys = `You are a senior solutions engineer drafting a response for an RFP. Write a clear, ${tone} response in 150–300 words. Be specific, avoid filler, address the requirement directly. Do not invent capabilities — if context is missing, say what would need to be confirmed.`;
      const user = `Company: ${opts.orgName}

${libraryContext ? `Relevant prior responses for context:\n${libraryContext}\n\n` : ""}Question / requirement:
${q.question_text}

Draft the response now. Output only the response text.`;
      const { text, usage } = await callClaudeText({ system: sys, user, maxTokens: 800 });
      totalIn += usage.input_tokens;
      totalOut += usage.output_tokens;

      // Upsert response (one draft per question)
      const { data: existing } = await supabase
        .from("responses")
        .select("id")
        .eq("question_id", q.id)
        .limit(1)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("responses")
          .update({ ai_generated_draft: text, draft_text: text, tone })
          .eq("id", existing.id);
      } else {
        await supabase.from("responses").insert({
          question_id: q.id,
          ai_generated_draft: text,
          draft_text: text,
          tone,
          status: "draft",
        });
      }
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
    const text = await runIngestionAgent(supabase, doc);
    const chunks = await runChunkingAgent(supabase, doc, text);
    const reqs = await runExtractionAgent(supabase, doc, chunks);
    await runStructuringAgent(supabase, doc, reqs);
    await runResponseGenerationAgent(supabase, doc, opts);
  } catch (e: any) {
    await setStatus(supabase, documentId, "failed", e.message);
    throw e;
  }
}
