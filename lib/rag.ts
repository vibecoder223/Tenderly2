/**
 * Generation with citations + confidence scoring. The grounded answer
 * generator. Persists to `responses` + `citations`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { callGroqText, MODEL_FAST, hasLlmKey } from "./groq";
import { isNoSource, retrieveForQuery, type Candidate } from "./retrieval";

const PROMPTS = {
  generator_system_v1: `You are a proposal writer at the customer's company. You write answers to RFP requirements in the customer's own voice, drawing exclusively from the source chunks provided. You never invent facts. You never speculate. You never use external knowledge.

Rules:
1. Every factual claim must be supported by a chunk in <sources>. If a claim is not supported, do not make it.
2. Cite every supported claim inline using [c:N], where N is the chunk's number from <sources> (e.g. [c:1], [c:3]). No quotes, no extra brackets, no UUIDs.
3. Write in business prose: confident, specific, concise. If voice examples are provided, match their tone.
4. If sources contradict each other, prefer the more recent document and note the discrepancy in a closing sentence.
5. If the sources do not cover the requirement, output exactly:
   "NO_SOURCE: The knowledge base does not contain content sufficient to answer this requirement."
   Do not draft a partial or hedged answer.
6. Length: match the requirement. "Describe" gets 100-200 words. "Confirm" gets one sentence. Do not pad.`,
  confidence_system_v1: `Score this answer's grounding 0.0-1.0.

- 1.0: every claim is directly supported by a cited chunk.
- 0.7: mostly supported; minor unsupported phrasing.
- 0.4: partially supported; weak source coverage on some claims.
- 0.0: not grounded.

Output a single decimal number, nothing else.`,
};

export type GenerationUsage = { input_tokens: number; output_tokens: number };

export async function generateAndPersistAnswer(
  supabase: SupabaseClient,
  args: {
    question_id: string;
    question_text: string;
    org_id: string;
    org_name: string;
    tone?: string;
  }
): Promise<GenerationUsage> {
  let totalIn = 0;
  let totalOut = 0;

  // 1. Retrieve
  const retrieval = await retrieveForQuery(supabase, {
    org_id: args.org_id,
    query: args.question_text,
    topK: 6,
  });
  totalIn += retrieval.usage.input_tokens;
  totalOut += retrieval.usage.output_tokens;

  // 2. Gap gate
  if (isNoSource(retrieval.top_score, retrieval.candidates.length)) {
    await upsertResponse(supabase, {
      question_id: args.question_id,
      // Keep the sentinel as an internal record of WHY there's no draft, but
      // leave the user-facing draft empty — the no_source gap_flag drives the
      // "No source found" banner. Never leak the sentinel into the draft box.
      answer_text_with_markers:
        "NO_SOURCE: The knowledge base does not contain content sufficient to answer this requirement.",
      answer_text_clean: "",
      tone: args.tone || "technical",
      confidence: 0,
      gap_flag: "no_source",
      status: "requires_review",
      generated_by: "ai",
      citations: [],
    });
    return { input_tokens: totalIn, output_tokens: totalOut };
  }

  // 3. Voice examples — pull a couple of approved answers from THIS org only.
  // responses carry no org column, so join question → document → deal → org and
  // inner-filter on deals.org_id. Without this, approved answers from every
  // tenant leak into this prompt (one customer's prose drafted into another's
  // proposal — a cross-tenant data leak).
  const { data: priorApproved } = await supabase
    .from("responses")
    .select("final_text, draft_text, questions!inner(documents!inner(deals!inner(org_id)))")
    .eq("status", "approved")
    .eq("questions.documents.deals.org_id", args.org_id)
    .not("final_text", "is", null)
    .limit(3);

  const voiceExamples = (priorApproved ?? [])
    .map((r: any) => (r.final_text || r.draft_text || "").slice(0, 600))
    .filter(Boolean)
    .slice(0, 3);

  // 4. Generate
  if (!hasLlmKey()) {
    await upsertResponse(supabase, {
      question_id: args.question_id,
      answer_text_with_markers: "AI_DISABLED: no LLM API key configured.",
      answer_text_clean: "AI_DISABLED: no LLM API key configured.",
      tone: args.tone || "technical",
      confidence: 0,
      gap_flag: "no_source",
      status: "requires_review",
      generated_by: "ai",
      citations: [],
    });
    return { input_tokens: totalIn, output_tokens: totalOut };
  }

  const user = buildGeneratorUser({
    org_name: args.org_name,
    question_text: args.question_text,
    voice_examples: voiceExamples,
    sources: retrieval.candidates,
  });

  const { text: rawAnswer, usage: genUsage } = await callGroqText({
    system: PROMPTS.generator_system_v1,
    user,
    maxTokens: 900,
  });
  totalIn += genUsage.input_tokens;
  totalOut += genUsage.output_tokens;

  // 5. Detect the model's NO_SOURCE sentinel
  if (/^\s*NO_SOURCE:/i.test(rawAnswer)) {
    await upsertResponse(supabase, {
      question_id: args.question_id,
      // Record the model's sentinel internally; keep the draft box empty so the
      // banner — not raw "NO_SOURCE:" text — communicates the gap to the user.
      answer_text_with_markers: rawAnswer.trim(),
      answer_text_clean: "",
      tone: args.tone || "technical",
      confidence: 0,
      gap_flag: "no_source",
      status: "requires_review",
      generated_by: "ai",
      citations: [],
    });
    return { input_tokens: totalIn, output_tokens: totalOut };
  }

  // 6. Parse citation markers
  const validIds = new Set(retrieval.candidates.map((c) => c.chunk_id));
  const cited = extractCitations(rawAnswer, retrieval.candidates);
  const clean = stripMarkers(rawAnswer);

  // 7. Confidence — heuristic from citation count, not a second LLM call.
  // The dedicated scorer added ~3-5s per question and a full extra request to
  // Cerebras's 30 RPM budget. With Cerebras free tier that doubled total time
  // for diminishing quality signal. Set RAG_USE_CONFIDENCE_LLM=1 to opt back
  // into the LLM-scored path.
  let confidence = cited.length === 0 ? 0.2 : cited.length >= 2 ? 0.7 : 0.5;

  if (process.env.RAG_USE_CONFIDENCE_LLM === "1") {
    try {
      const { text, usage } = await callGroqText({
        system: PROMPTS.confidence_system_v1,
        user: `<answer>
${rawAnswer}
</answer>

<sources>
${retrieval.candidates.map((c) => `<chunk id="${c.chunk_id}">${c.text}</chunk>`).join("\n")}
</sources>`,
        maxTokens: 16,
        model: MODEL_FAST,
      });
      totalIn += usage.input_tokens;
      totalOut += usage.output_tokens;
      const m = text.match(/[01](?:\.\d+)?/);
      if (m) confidence = Math.max(0, Math.min(1, parseFloat(m[0])));
    } catch {
      // Leave heuristic confidence if scorer fails.
    }
  }

  const gap_flag: "ok" | "partial" | "no_source" =
    cited.length === 0 ? "no_source" : confidence >= 0.7 ? "ok" : "partial";
  const status: "draft" | "requires_review" =
    confidence >= 0.7 && gap_flag === "ok" ? "draft" : "requires_review";

  await upsertResponse(supabase, {
    question_id: args.question_id,
    answer_text_with_markers: rawAnswer.trim(),
    answer_text_clean: clean,
    tone: args.tone || "technical",
    confidence,
    gap_flag,
    status,
    generated_by: "ai",
    citations: cited.filter((c) => validIds.has(c.chunk_id)),
  });

  return { input_tokens: totalIn, output_tokens: totalOut };
}

// ---------- helpers ----------

function buildGeneratorUser(args: {
  org_name: string;
  question_text: string;
  voice_examples: string[];
  sources: Candidate[];
}): string {
  const voice = args.voice_examples.length
    ? `<voice_examples>
${args.voice_examples.map((v) => `<example>${v}</example>`).join("\n")}
</voice_examples>`
    : "";

  // Cite by 1-based index, not chunk UUID. LLMs reliably fail to reproduce long
  // UUIDs verbatim (they emit empty or malformed markers), which silently drops
  // every citation. A small integer is trivial to copy.
  const sources = args.sources
    .map(
      (c, i) =>
        `<chunk id="${i + 1}" doc="${esc(c.document_filename)}" section="${esc(
          c.section_path ?? ""
        )}" page="${c.page_start ?? ""}">
${c.text}
</chunk>`
    )
    .join("\n");

  return `Company: ${args.org_name}

<requirement>
${args.question_text}
</requirement>

${voice}

<sources>
${sources}
</sources>

Write the answer now. Cite every supported claim with the chunk's number in square brackets, e.g. [c:1] or [c:3]. Use only the numbers shown in <sources>.`;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type ParsedCitation = {
  chunk_id: string;
  document_filename: string;
  section_path: string | null;
  page: number | null;
  quote: string;
};

// Matches [c:N] and the full-width-bracket variant 【c:N】 some models emit.
const CITE_RE = /[[【]\s*c:\s*(\d{1,3})\s*[\]】]/gi;

function extractCitations(
  textWithMarkers: string,
  sources: Candidate[]
): ParsedCitation[] {
  const out: ParsedCitation[] = [];
  const seen = new Set<number>();
  let m: RegExpExecArray | null;
  CITE_RE.lastIndex = 0;
  while ((m = CITE_RE.exec(textWithMarkers)) !== null) {
    const n = parseInt(m[1], 10);
    if (seen.has(n)) continue;
    const src = sources[n - 1];
    if (!src) continue;
    seen.add(n);
    // Quote: take the sentence preceding this marker as supporting context.
    const before = textWithMarkers.slice(0, m.index).replace(/\s+/g, " ").trim();
    const sentences = before.split(/(?<=[.!?])\s+/);
    const quote = (sentences[sentences.length - 1] || src.text.slice(0, 200)).slice(0, 400);
    out.push({
      chunk_id: src.chunk_id,
      document_filename: src.document_filename,
      section_path: src.section_path,
      page: src.page_start ?? null,
      quote,
    });
  }
  return out;
}

function stripMarkers(text: string): string {
  return text.replace(CITE_RE, "").replace(/\s+/g, " ").trim();
}

async function upsertResponse(
  supabase: SupabaseClient,
  args: {
    question_id: string;
    answer_text_with_markers: string;
    answer_text_clean: string;
    tone: string;
    confidence: number;
    gap_flag: "ok" | "partial" | "no_source";
    status: "draft" | "requires_review";
    generated_by: "ai" | "human" | "edited";
    citations: ParsedCitation[];
  }
) {
  const { data: existing } = await supabase
    .from("responses")
    .select("id")
    .eq("question_id", args.question_id)
    .limit(1)
    .maybeSingle();

  const payload = {
    question_id: args.question_id,
    ai_generated_draft: args.answer_text_clean,
    draft_text: args.answer_text_clean,
    answer_text_with_markers: args.answer_text_with_markers,
    tone: args.tone,
    confidence: args.confidence,
    gap_flag: args.gap_flag,
    status: args.status,
    generated_by: args.generated_by,
  };

  let responseId: string;
  if (existing) {
    responseId = existing.id;
    await supabase.from("responses").update(payload).eq("id", existing.id);
  } else {
    const { data: inserted, error } = await supabase
      .from("responses")
      .insert(payload)
      .select()
      .single();
    if (error || !inserted) throw new Error(`Response insert failed: ${error?.message}`);
    responseId = inserted.id;
  }

  // Replace citations (idempotent)
  await supabase.from("citations").delete().eq("response_id", responseId);
  if (args.citations.length > 0) {
    await supabase.from("citations").insert(
      args.citations.map((c) => ({
        response_id: responseId,
        chunk_id: c.chunk_id,
        document_filename: c.document_filename,
        section_path: c.section_path,
        page: c.page,
        quote: c.quote,
      }))
    );
  }

  // Update question status
  if (args.status === "requires_review") {
    await supabase
      .from("questions")
      .update({ status: "drafting" })
      .eq("id", args.question_id);
  }
}
