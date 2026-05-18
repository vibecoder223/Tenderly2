#!/usr/bin/env node
/**
 * RAG eval harness.
 *
 * Runs every prompt in evals/rag_eval.jsonl through retrieval + generation
 * against the configured Supabase + Anthropic + Voyage environment, then
 * reports the four metrics required by the spec:
 *
 *   - citation accuracy:   ≥85%   (cited filename+page matches an expected one)
 *   - citation coverage:   ≥70%   (fraction of expected citations produced)
 *   - hallucination rate:  <5%    (factual claims with no [c:UUID])
 *   - gap detection:       100%   (no-source examples emit NO_SOURCE)
 *
 * USAGE
 *   node scripts/eval.mjs --org-id <UUID>
 *
 * If --org-id isn't given, the script picks the first organization found.
 */

import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = await loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  fail("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
}

const args = parseArgs(process.argv.slice(2));
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;
const VOYAGE_KEY = env.VOYAGE_API_KEY;

if (!ANTHROPIC_KEY) {
  console.warn(
    "⚠ ANTHROPIC_API_KEY not set — generation will be skipped and metrics will not be meaningful."
  );
}
if (!VOYAGE_KEY) {
  console.warn(
    "⚠ VOYAGE_API_KEY not set — retrieval will fall back to BM25-only, which usually underperforms."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const orgId =
  args["org-id"] ??
  (
    await supabase.from("organizations").select("id").order("created_at").limit(1).single()
  ).data?.id;
if (!orgId) fail("No organizations found in the database.");
console.log(`→ Eval running against org ${orgId}`);

const datasetPath = path.join(process.cwd(), "evals", "rag_eval.jsonl");
const raw = await readFile(datasetPath, "utf8");
const cases = raw
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => JSON.parse(l));

const VOYAGE_URL = "https://api.voyageai.com/v1";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const SONNET = env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

const NO_SOURCE_THRESHOLD = 0.4;

const results = [];
let totals = {
  cases: 0,
  citation_accuracy_num: 0,
  citation_accuracy_den: 0,
  coverage_num: 0,
  coverage_den: 0,
  hallucination_num: 0,
  hallucination_den: 0,
  gap_correct: 0,
  gap_total: 0,
};

for (const c of cases) {
  totals.cases += 1;
  const t0 = Date.now();
  const { candidates, top_score } = await retrieve(c.requirement);
  const isGap = candidates.length === 0 || top_score < NO_SOURCE_THRESHOLD;

  let answer = "";
  let cited = [];
  if (isGap || !ANTHROPIC_KEY) {
    answer = "NO_SOURCE: The knowledge base does not contain content sufficient to answer this requirement.";
  } else {
    const out = await generate(c.requirement, candidates);
    answer = out.answer;
    cited = out.cited;
  }

  // ----- Metric: gap detection -----
  if (c.expected_no_source) {
    totals.gap_total += 1;
    if (/^\s*NO_SOURCE:/i.test(answer)) totals.gap_correct += 1;
  }

  // ----- Metric: citation accuracy & coverage -----
  // Expected items are "filename p.NN"; we count an answer citation as a hit
  // if a parsed [c:UUID] resolved to a chunk whose (filename, page) matches.
  if (!c.expected_no_source) {
    const producedKeys = new Set(
      cited.map((x) => `${x.document_filename} p.${x.page ?? "?"}`)
    );
    totals.citation_accuracy_den += producedKeys.size;
    for (const k of producedKeys) {
      if (c.expected_citations.includes(k)) totals.citation_accuracy_num += 1;
    }
    totals.coverage_den += c.expected_citations.length;
    for (const e of c.expected_citations) {
      if (producedKeys.has(e)) totals.coverage_num += 1;
    }
  }

  // ----- Metric: hallucination — sentences with factual claims but no marker -----
  const factual = answer
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^NO_SOURCE/i.test(s));
  if (factual.length > 0) {
    for (const s of factual) {
      totals.hallucination_den += 1;
      if (!/\[c:[0-9a-f-]{36}\]/i.test(s)) totals.hallucination_num += 1;
    }
  }

  results.push({
    id: c.id,
    ms: Date.now() - t0,
    top_score,
    gap: isGap,
    answer_excerpt: answer.slice(0, 240),
    cited: cited.map((x) => `${x.document_filename} p.${x.page ?? "?"}`),
  });
  process.stdout.write(`.`);
}
process.stdout.write("\n");

const citationAccuracy =
  totals.citation_accuracy_den === 0
    ? null
    : totals.citation_accuracy_num / totals.citation_accuracy_den;
const coverage =
  totals.coverage_den === 0 ? null : totals.coverage_num / totals.coverage_den;
const hallucination =
  totals.hallucination_den === 0
    ? null
    : totals.hallucination_num / totals.hallucination_den;
const gapDetection = totals.gap_total === 0 ? null : totals.gap_correct / totals.gap_total;

const report = {
  generated_at: new Date().toISOString(),
  cases: totals.cases,
  metrics: {
    citation_accuracy: citationAccuracy,
    citation_coverage: coverage,
    hallucination_rate: hallucination,
    gap_detection: gapDetection,
    targets: {
      citation_accuracy_min: 0.85,
      citation_coverage_min: 0.7,
      hallucination_rate_max: 0.05,
      gap_detection_min: 1.0,
    },
  },
  results,
};

await mkdir(path.join(process.cwd(), "evals", "results"), { recursive: true });
const outPath = path.join(
  process.cwd(),
  "evals",
  "results",
  `eval-${Date.now()}.json`
);
await writeFile(outPath, JSON.stringify(report, null, 2));

console.log("\n=== Eval results ===");
console.log(`cases:               ${totals.cases}`);
console.log(`citation accuracy:   ${fmt(citationAccuracy)}  (target ≥ 0.85)`);
console.log(`citation coverage:   ${fmt(coverage)}  (target ≥ 0.70)`);
console.log(`hallucination rate:  ${fmt(hallucination)}  (target < 0.05)`);
console.log(`gap detection:       ${fmt(gapDetection)}  (target = 1.00)`);
console.log(`→ ${path.relative(process.cwd(), outPath)}`);

// ===================== helpers =====================

async function retrieve(query) {
  // dense
  const dense = [];
  if (VOYAGE_KEY) {
    const eRes = await fetch(`${VOYAGE_URL}/embeddings`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${VOYAGE_KEY}`,
      },
      body: JSON.stringify({
        model: env.VOYAGE_EMBED_MODEL ?? "voyage-3-large",
        input: [query],
        input_type: "query",
        output_dimension: 1024,
      }),
    });
    if (eRes.ok) {
      const j = await eRes.json();
      const emb = j.data[0].embedding;
      const { data, error } = await supabase.rpc("match_chunks", {
        p_org_id: orgId,
        p_embedding: emb,
        p_match_count: 20,
      });
      if (!error && data) {
        for (const r of data) {
          dense.push({
            chunk_id: r.chunk_id,
            text: r.text,
            section_path: r.section_path,
            page_start: r.page_start,
            page_end: r.page_end,
            document_filename: r.document_filename,
            score: r.similarity,
          });
        }
      }
    }
  }

  // sparse — simple GIN overlap
  const terms = query
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3)
    .slice(0, 8);
  const sparse = [];
  if (terms.length > 0) {
    const { data } = await supabase
      .from("document_chunks")
      .select(
        "id, raw_text, cleaned_text, section_path, page_start, page_end, knowledge_documents(filename), documents(filename)"
      )
      .eq("org_id", orgId)
      .overlaps("sparse_terms", terms)
      .limit(30);
    for (const r of data ?? []) {
      sparse.push({
        chunk_id: r.id,
        text: r.cleaned_text ?? r.raw_text ?? "",
        section_path: r.section_path,
        page_start: r.page_start,
        page_end: r.page_end,
        document_filename:
          r.knowledge_documents?.filename ?? r.documents?.filename ?? "(unknown)",
        score: 0.5,
      });
    }
  }

  // merge + rerank
  const merged = new Map();
  for (const c of [...dense, ...sparse]) {
    if (!merged.has(c.chunk_id)) merged.set(c.chunk_id, c);
  }
  const cands = [...merged.values()];
  if (cands.length === 0) return { candidates: [], top_score: 0 };

  if (VOYAGE_KEY && cands.length > 1) {
    const r = await fetch(`${VOYAGE_URL}/rerank`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${VOYAGE_KEY}`,
      },
      body: JSON.stringify({
        model: env.VOYAGE_RERANK_MODEL ?? "rerank-2",
        query,
        documents: cands.map((c) => c.text),
        top_k: Math.min(6, cands.length),
      }),
    });
    if (r.ok) {
      const j = await r.json();
      const ranked = j.data.map((d) => ({
        ...cands[d.index],
        score: d.relevance_score,
      }));
      return { candidates: ranked, top_score: ranked[0]?.score ?? 0 };
    }
  }

  cands.sort((a, b) => b.score - a.score);
  return { candidates: cands.slice(0, 6), top_score: cands[0]?.score ?? 0 };
}

async function generate(query, candidates) {
  const sys = `You are a proposal writer at the customer's company. You write answers to RFP requirements in the customer's own voice, drawing exclusively from the source chunks provided. You never invent facts. You never speculate. You never use external knowledge.

Rules:
1. Every factual claim must be supported by a chunk in <sources>. If a claim is not supported, do not make it.
2. Cite every supported claim inline using [c:CHUNK_ID]. The exact UUID from <sources>, no quotes, no extra brackets.
3. Write in business prose: confident, specific, concise.
4. If the sources do not cover the requirement, output exactly:
   "NO_SOURCE: The knowledge base does not contain content sufficient to answer this requirement."`;

  const user = `<requirement>${query}</requirement>

<sources>
${candidates
  .map(
    (c) =>
      `<chunk id="${c.chunk_id}" doc="${c.document_filename}" page="${
        c.page_start ?? ""
      }">${c.text}</chunk>`
  )
  .join("\n")}
</sources>

Write the answer now. Use [c:UUID] for every supported claim.`;

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: SONNET,
      max_tokens: 900,
      system: sys,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic call failed: ${res.status} ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  const block = (j.content ?? []).find((b) => b.type === "text");
  const answer = (block?.text ?? "").trim();

  const byId = new Map(candidates.map((c) => [c.chunk_id, c]));
  const seen = new Set();
  const cited = [];
  const re = /\[c:([0-9a-f-]{36})\]/gi;
  let m;
  while ((m = re.exec(answer)) !== null) {
    const id = m[1];
    if (seen.has(id)) continue;
    seen.add(id);
    const c = byId.get(id);
    if (c) {
      cited.push({ document_filename: c.document_filename, page: c.page_start });
    }
  }
  return { answer, cited };
}

async function loadEnv() {
  const out = { ...process.env };
  try {
    const txt = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {}
  return out;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
      out[key] = val;
    }
  }
  return out;
}

function fmt(x) {
  return x == null ? "n/a" : x.toFixed(3);
}

function fail(msg) {
  console.error("✗", msg);
  process.exit(1);
}
