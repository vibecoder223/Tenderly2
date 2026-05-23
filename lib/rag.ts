/**
 * Generation with citations + confidence scoring. The grounded answer
 * generator. Persists to `responses` + `citations`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { callGroqText, MODEL_FAST } from "./groq";
import { isNoSource, retrieveForQuery, type Candidate } from "./retrieval";

const PROMPTS = {
  generator_system_v1: `You are a proposal writer at the customer's company. You write answers to RFP requirements in the customer's own voice, drawing exclusively from the source chunks provided. You never invent facts. You never speculate. You never use external knowledge.

Rules:
1. Every factual claim must be supported by a chunk in <sources>. If a claim is not supported, do not make it.
2. Cite every supported claim inline using [c:CHUNK_ID]. The exact UUID from <sources>, no quotes, no extra brackets.
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
      answer_text_with_markers:
        "NO_SOURCE: The knowledge base does not contain content sufficient to answer this requirement.",
      answer_text_clean:
        "NO_SOURCE: The knowledge base does not contain content sufficient to answer this requirement.",
      tone: args.tone || "technical",
      confidence: 0,
      gap_flag: "no_source",
      status: "requires_review",
      generated_by: "ai",
      citations: [],
    });
    return { input_tokens: totalIn, output_tokens: totalOut };
  }

  // 3. Voice examples — pull a couple of approved answers from this workspace
  const { data: priorApproved } = await supabase
    .from("responses")
    .select("final_text, draft_text")
    .eq("status", "approved")
    .not("final_text", "is", null)
    .limit(3);

  const voiceExamples = (priorApproved ?? [])
    .map((r: any) => (r.final_text || r.draft_text || "").slice(0, 600))
    .filter(Boolean)
    .slice(0, 3);

  // 4. Generate
  if (!process.env.OPENROUTER_API_KEY) {
    await upsertResponse(supabase, {
      question_id: args.question_id,
      answer_text_with_markers: "AI_DISABLED: OPENROUTER_API_KEY not configured.",
      answer_text_clean: "AI_DISABLED: OPENROUTER_API_KEY not configured.",
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
      answer_text_with_markers: rawAnswer.trim(),
      answer_text_clean: rawAnswer.trim(),
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

  // 7. Confidence pass (Haiku)
  let confidence = 0.5;
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
    // Leave 0.5 if scorer fails — gap_flag below still drives review.
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

  const sources = args.sources
    .map(
      (c) =>
        `<chunk id="${c.chunk_id}" doc="${esc(c.document_filename)}" section="${esc(
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

Write the answer now. Use [c:UUID] for every supported claim.`;
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

function extractCitations(
  textWithMarkers: string,
  sources: Candidate[]
): ParsedCitation[] {
  const byId = new Map(sources.map((s) => [s.chunk_id, s]));
  const out: ParsedCitation[] = [];
  const seen = new Set<string>();
  const markerRe = /\[c:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi;
  let m: RegExpExecArray | null;
  while ((m = markerRe.exec(textWithMarkers)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    const src = byId.get(id);
    if (!src) continue;
    seen.add(id);
    // Quote: take the sentence preceding this marker as supporting context.
    const before = textWithMarkers.slice(0, m.index).replace(/\s+/g, " ").trim();
    const sentences = before.split(/(?<=[.!?])\s+/);
    const quote = (sentences[sentences.length - 1] || src.text.slice(0, 200)).slice(0, 400);
    out.push({
      chunk_id: id,
      document_filename: src.document_filename,
      section_path: src.section_path,
      page: src.page_start ?? null,
      quote,
    });
  }
  return out;
}

function stripMarkers(text: string): string {
  // Remove well-formed citations first.
  let cleaned = text.replace(/\s*\[c:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]/gi, "");
  // Then strip any malformed citation fragments (broken brackets, partial UUIDs).
  cleaned = cleaned.replace(/\[c:[^\]]*?\]/gi, "");          // any leftover [c:...] brackets
  cleaned = cleaned.replace(/\[c:[0-9a-f-]+/gi, "");         // unclosed [c:...
  cleaned = cleaned.replace(/\b[0-9a-f]{4,}-[0-9a-f-]+\b/gi, ""); // orphan UUID fragments mid-text
  return cleaned.replace(/\s+/g, " ").trim();
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
      .update({ status: "in_progress" })
      .eq("id", args.question_id);
  }
}
