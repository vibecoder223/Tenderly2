#!/usr/bin/env node
/**
 * UAT — 3 documents, ~75 requirements each, against the live batched
 * pipeline (per-model rate gates: mistral-large-latest for extraction,
 * mistral-small-latest for generation).
 *
 * For each document, drives ingest -> extract -> structure -> generate to
 * completion via /api/jobs/drain, then reports per-stage wall-clock, token
 * usage (now persisted for the generate stage too, see lib/jobs.ts
 * runGenerateBatched), and answer quality. Aggregates cost across all 3
 * using real per-model Mistral pricing (not the generic estimateCost in
 * lib/groq.ts, which is tuned for a different provider).
 *
 * REQUIRES: `npm run dev` on :3000, .env.local with Supabase service role +
 * Mistral keys.
 *
 * USAGE: node scripts/uat-75.mjs [--keep]
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = {};
try {
  const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2];
  }
} catch {
  fail("Could not read .env.local");
}
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = env.CRON_SECRET;
const MISTRAL_KEY = env.MISTRAL_API_KEY;
const APP_URL = env.UAT_APP_URL || "http://localhost:3000";
if (!SUPABASE_URL || !SERVICE_KEY) fail("Need Supabase URL + service role key in .env.local");
if (!CRON_SECRET) fail("Need CRON_SECRET in .env.local");
if (!MISTRAL_KEY) fail("Need MISTRAL_API_KEY in .env.local (for KB seeding embeddings)");

const keep = process.argv.includes("--keep");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

function fail(msg) { console.error(`✘ ${msg}`); process.exit(1); }
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

// Real Mistral pricing (USD per 1M tokens) — confirmed from platform pricing.
const PRICING = {
  "mistral-large-latest": { in: 0.5, out: 1.5 },
  "mistral-small-latest": { in: 0.15, out: 0.6 },
};
function costOf(model, inTok, outTok) {
  const p = PRICING[model] ?? { in: 0, out: 0 };
  return (inTok / 1e6) * p.in + (outTok / 1e6) * p.out;
}

// ---------- requirement bank (80 templated items, 9 sections) ----------
const SECTIONS = [
  { id: "3", title: "SECURITY REQUIREMENTS", topic: "security", items: [
    "The vendor MUST hold a current ISO/IEC 27001 certification; provide certificate number, scope, and validity period.",
    "The vendor MUST provide evidence of an independent SOC 2 Type II audit completed within the last 12 months.",
    "Describe encryption standards applied at rest and in transit, including key management and customer-managed key support.",
    "The solution MUST support SSO via SAML 2.0 or OIDC integrated with {org}'s identity provider.",
    "Describe the role-based access control model, including custom roles, field-level permissions, and delegated approval authority.",
    "Describe your penetration testing regime, frequency, and remediation SLAs by severity.",
    "Describe your vulnerability management program including scanning cadence and patch timelines for critical/high findings.",
    "Confirm whether multi-factor authentication is enforced for all privileged accounts.",
    "Describe your security incident response plan and customer notification timelines.",
    "Confirm whether the platform has undergone independent code security review (SAST/DAST) and describe the frequency.",
  ]},
  { id: "4", title: "DATA GOVERNANCE REQUIREMENTS", topic: "legal", items: [
    "All {org} data MUST reside within an approved jurisdiction. Specify available hosting regions and residency guarantees.",
    "Confirm compliance with applicable data protection law and describe your data protection governance structure.",
    "Describe backup and disaster recovery capabilities, including RPO/RTO commitments and testing frequency.",
    "Confirm whether an on-premises or sovereign-cloud deployment option is available for sensitive workloads.",
    "Describe sub-processor disclosure practices and the notice period provided before any sub-processor change.",
    "Confirm data retention, export, and deletion practices upon contract termination or expiry.",
    "Describe your approach to data classification and handling of commercially sensitive information.",
    "Confirm whether a Data Protection Officer is appointed and describe their reporting line.",
    "Describe your data breach notification process and typical time-to-notify commitment.",
  ]},
  { id: "5", title: "FUNCTIONAL REQUIREMENTS — CORE PLATFORM", topic: "technical", items: [
    "The solution MUST support end-to-end lifecycle management of {domain_object} from creation through closure.",
    "Describe support for structured templates and automated compliance checklists relevant to {domain}.",
    "Describe how the platform supports multi-stage review with weighted scoring or approval gates.",
    "Confirm whether the solution supports electronic submission with tamper-evident timestamps.",
    "Describe capabilities for AI-assisted extraction of requirements from uploaded documents.",
    "Describe how the platform supports collaborative review across multiple stakeholders with conflict-of-interest tracking.",
    "Describe reporting and dashboard capabilities available to leadership for real-time visibility.",
    "Confirm whether the platform supports configurable workflow automation without custom code.",
    "Describe search and retrieval capabilities across historical records.",
  ]},
  { id: "6", title: "FUNCTIONAL REQUIREMENTS — RECORDS AND LIFECYCLE MANAGEMENT", topic: "technical", items: [
    "The solution MUST provide a centralized repository with automated renewal and milestone alerts.",
    "Describe performance tracking capabilities, including scorecards and historical analytics.",
    "Describe support for multi-currency and multi-entity structures, if applicable to {domain}.",
    "Confirm whether the solution supports e-signature integration.",
    "Describe version control and change-history tracking for records within the platform.",
    "Confirm whether bulk import/export of historical records is supported and describe the format.",
  ]},
  { id: "7", title: "TECHNICAL REQUIREMENTS", topic: "technical", items: [
    "The solution MUST provide a documented REST API for integration with {org}'s existing systems.",
    "Describe available native integrations relevant to {domain} systems.",
    "The solution MUST support automated user provisioning and deprovisioning via SCIM.",
    "Describe the platform's uptime commitment and the service credit regime applicable to SLA breaches.",
    "Confirm API rate limits and describe how the platform scales under peak concurrent load.",
    "Describe the system architecture's approach to high availability, failover, and horizontal scalability.",
    "Confirm whether the platform supports Arabic-language data entry, search, and reporting.",
    "Describe your approach to accessibility compliance (WCAG 2.1 AA or equivalent).",
    "Describe your approach to mobile access, including native apps versus responsive web.",
    "Confirm supported browsers and minimum client-side requirements.",
  ]},
  { id: "8", title: "IMPLEMENTATION AND SUPPORT REQUIREMENTS", topic: "commercial", items: [
    "Describe your implementation methodology, typical timeline for a deployment of this scale, and the project team you would assign.",
    "Describe the training approach, including local-language materials and post-go-live adoption tracking.",
    "Describe your support tiers, response times for priority-1 incidents, and escalation procedures.",
    "Provide details of at least three comparable reference implementations of similar scale.",
    "Describe your product roadmap process and how customer feedback is incorporated.",
    "Confirm the availability of a dedicated technical account manager for the duration of the contract.",
    "Describe your approach to knowledge transfer and reducing dependency on vendor personnel.",
    "Describe your change management and configuration governance process for a multi-department rollout.",
    "Describe your data migration approach from the legacy system currently in use.",
    "Confirm the maximum number of concurrent implementation projects your team can support.",
  ]},
  { id: "9", title: "COMMERCIAL REQUIREMENTS", topic: "commercial", items: [
    "Provide your pricing model, including subscription tiers, implementation fees, and any volume or multi-year discounts.",
    "Confirm the company's financial standing, years in operation, and total staff dedicated to delivery and support.",
    "Confirm standard payment terms and whether contract governance under local law is available.",
    "Confirm professional indemnity and cyber liability insurance coverage levels.",
    "Describe your approach to price stability or escalation clauses over a multi-year term.",
    "Confirm whether performance bonds or bank guarantees can be provided as required by procurement regulations.",
    "Describe any early-termination provisions and associated costs.",
    "Confirm whether pricing includes unlimited users or is capped per named/concurrent user.",
  ]},
  { id: "10", title: "QUALITY AND ACCEPTANCE REQUIREMENTS", topic: "technical", items: [
    "Describe your approach to user acceptance testing prior to go-live.",
    "Confirm warranty period post go-live and what is covered during that period.",
    "Describe defect severity classification and resolution timelines during warranty.",
    "Confirm whether performance/load testing results are available for review prior to award.",
  ]},
  { id: "11", title: "GOVERNANCE AND REPORTING REQUIREMENTS", topic: "commercial", items: [
    "Describe the governance structure you propose for ongoing account management.",
    "Confirm the frequency and format of service-level reporting provided to {org}.",
    "Describe your escalation path in the event of a missed SLA.",
    "Confirm whether an executive sponsor is assigned to the account.",
  ]},
];

function buildRfp(orgLabel, domain, domainObject, ref) {
  let n = 0;
  const lines = [];
  lines.push(`REQUEST FOR PROPOSAL — ${domain.toUpperCase()} PLATFORM`);
  lines.push(`RFP Reference: ${ref} | Issued: June 2026 | Issuing Entity: ${orgLabel}`);
  lines.push("");
  lines.push("SECTION 1 — INTRODUCTION AND SCOPE");
  lines.push(`${orgLabel} invites qualified vendors to propose a platform covering ${domain} operations. Vendors must respond fully to every requirement in Sections 3 through 11.`);
  lines.push("");
  lines.push("SECTION 2 — BACKGROUND");
  lines.push(`${orgLabel} currently manages this function manually and seeks to modernize it end to end.`);
  lines.push("");
  for (const sec of SECTIONS) {
    lines.push(`SECTION ${sec.id} — ${sec.title}`);
    sec.items.forEach((tmpl, i) => {
      n++;
      const text = tmpl.replaceAll("{org}", orgLabel).replaceAll("{domain}", domain).replaceAll("{domain_object}", domainObject);
      lines.push(`${sec.id}.${i + 1} ${text}`);
    });
    lines.push("");
  }
  lines.push("END OF RFP");
  return { text: lines.join("\n"), itemCount: n };
}

const DOCS = [
  buildRfp("Regional Health Authority", "healthcare records management", "patient case files", "RFP-HLT-2026-041"),
  buildRfp("Metro Transit Authority", "smart transit operations", "service tickets", "RFP-TRN-2026-058"),
  buildRfp("National University System", "learning management", "course enrollments", "RFP-EDU-2026-073"),
];

console.log("═══ Propello UAT — 3× ~75-question documents ═══\n");
for (const d of DOCS) console.log(`  prepared: ${d.itemCount} requirement lines`);
console.log("");

const { data: org } = await supabase.from("organizations").select("id, name").order("created_at").limit(1).single();
if (!org) fail("No organization found.");
console.log(`→ Org: ${org.name} (${org.id})\n`);

const ping = await fetch(`${APP_URL}/api/jobs/drain`, { method: "POST", headers: { "x-cron-secret": CRON_SECRET } }).catch(() => null);
if (!ping || ping.status >= 500) fail(`Drain endpoint not reachable at ${APP_URL} — is 'npm run dev' running?`);

// ---------- seed KB (so generation has content to ground against) ----------
// Cross-cutting capability content: answers the security / data-governance /
// technical / commercial sections that every RFP shares. Domain-specific
// functional sections (5/6) will legitimately return no-source — that's the
// realistic partial-coverage the answer library is meant to improve over time.
const KB_CHUNKS = [
  ["Security certifications", "Propello Solutions holds ISO/IEC 27001:2022 certification (certificate #IS-745211, valid through March 2028) and completes an annual SOC 2 Type II audit covering security, availability, and confidentiality trust criteria. The latest SOC 2 report (January 2026) recorded zero exceptions. Penetration tests are performed twice yearly by CREST-accredited third parties, with all critical and high findings remediated within 14 days. Vulnerability scanning runs continuously with critical patches applied within 7 days. Multi-factor authentication is enforced for all privileged accounts. Independent SAST/DAST code review is performed each release."],
  ["Data encryption", "All customer data is encrypted at rest using AES-256 with keys managed in a FIPS 140-2 Level 3 validated HSM, and in transit using TLS 1.3. Key rotation occurs every 90 days automatically. Customer-managed encryption keys (CMEK) are supported on the Enterprise plan, allowing customers to revoke access unilaterally."],
  ["Data residency and hosting", "The platform is hosted on Microsoft Azure with primary regions in Qatar Central (Doha) and West Europe (Netherlands). Customers select their data residency region at contract signature; data never leaves the selected region, including backups and disaster recovery replicas. An on-premises deployment option is available for government clients with sovereignty requirements."],
  ["Service levels and support", "We commit to a 99.9% monthly uptime SLA with service credits of 10% per 0.1% shortfall, capped at 50% of monthly fees. Support tiers: Standard (business hours, 8-hour response) and Premium (24/7, 1-hour P1 response, dedicated technical account manager). Average P1 resolution time in 2025 was 3.2 hours. A named technical account manager is assigned to enterprise accounts."],
  ["Implementation methodology", "Implementations follow a four-phase methodology: Discovery (2 weeks), Configuration (3-4 weeks), UAT and training (2 weeks), and Hypercare (2 weeks post go-live). A typical mid-size deployment completes in 8-10 weeks; large multi-department rollouts run 14-18 weeks. Each project is staffed with a certified project manager, a solution architect, and a training lead. We have completed 140+ implementations with a 96% on-time rate. Data migration from legacy systems is included, and knowledge transfer reduces vendor dependency over the contract term."],
  ["Pricing model", "Pricing is per-user per-month subscription with three tiers: Essential ($29/user/month), Professional ($55/user/month), and Enterprise (custom, volume-discounted above 500 seats). Implementation is a one-time fee typically 0.8x-1.2x first-year subscription. No charges for storage up to 1TB per workspace; API access is included in Professional and above. Multi-year commitments receive 12-18% discounts. Early termination is subject to 90 days notice. Performance bonds and bank guarantees can be provided where procurement regulations require."],
  ["Integrations and API", "The platform exposes a REST API (OpenAPI 3.1 documented) and webhooks for all core objects. Native integrations include Microsoft 365, SharePoint, Salesforce, SAP Ariba, Oracle Fusion, and Slack. Single sign-on is supported via SAML 2.0 and OIDC (Azure AD, Okta, Ping). SCIM 2.0 handles automated user provisioning and deprovisioning. The API supports 1,000 requests/minute on Enterprise and the platform scales horizontally under peak concurrent load with high-availability failover across availability zones."],
  ["Access control", "Role-based access control ships with five default roles and unlimited custom roles with field-level permissions and delegated approval authority. All privileged actions are captured in an immutable audit log retained for 7 years and exportable to customer SIEM via syslog or API. IP allowlisting and session policies (timeout, concurrent session limits) are configurable per workspace."],
  ["Business continuity and disaster recovery", "The disaster recovery plan targets an RPO of 15 minutes and RTO of 4 hours, tested twice yearly with published results. Backups run continuously (point-in-time recovery to any second within 35 days) plus daily snapshots retained 12 months in a geo-separate region. The business continuity plan is ISO 22301-aligned and audited annually. A security incident response plan commits to customer notification within 72 hours of a confirmed breach."],
  ["Company profile and references", "Propello Solutions was founded in 2019, is headquartered in Doha with offices in Dubai and London, and employs 85 staff, of whom 60 are in engineering and delivery. Reference customers include three GCC government ministries, two regional banks, and a Fortune 500 logistics firm; contactable references are available under NDA. The company is profitable and carries no external debt. Professional indemnity insurance of $5M and cyber liability insurance of $10M are maintained."],
  ["Compliance and privacy", "The platform complies with GDPR and Qatar's Personal Data Privacy Protection Law (Law No. 13 of 2016). A Data Protection Officer is appointed. Data processing agreements with EU standard contractual clauses are offered as standard. Data subject requests (access, erasure, portability) are fulfilled through a self-service console within 30 days. Sub-processors are listed publicly and customers are notified 30 days before changes. Upon termination, data is exported and deleted per contract terms within 30 days."],
  ["Training and accessibility", "Training includes role-based live sessions (admin, end-user, and executive tracks), a self-paced learning portal with certifications, and train-the-trainer packages. All documentation and the UI are available in English and Arabic, including Arabic-language data entry, search, and reporting. The platform meets WCAG 2.1 AA accessibility standards. Post go-live, quarterly business reviews track adoption; customers average 78% weekly active usage after 90 days."],
];

const STOPWORDS = new Set(["the","a","an","and","or","but","of","to","in","on","for","with","at","by","is","are","was","were","be","been","being","this","that","these","those","it","its","as","from","into","than","then","so","such","not","no","do","does","did","done","has","have","had","will","would","should","could","may","might","must","can","shall","we","you","they","i","he","she","our","your","their","my","his","her","us","them","also","more","most","any","all","each"]);
function sparseTerms(text) {
  const toks = text.toLowerCase().replace(/[^a-z0-9\s\-]/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return [...new Set(toks)].slice(0, 200);
}
async function embed(texts) {
  const res = await fetch("https://api.mistral.ai/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${MISTRAL_KEY}` },
    body: JSON.stringify({ model: "mistral-embed", input: texts }),
  });
  if (!res.ok) fail(`Mistral embed failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

const kbEmb = await embed(KB_CHUNKS.map(([, t]) => t));
const { data: kdoc, error: kdocErr } = await supabase
  .from("knowledge_documents")
  .insert({ org_id: org.id, filename: "UAT75-capability-statement.txt", doc_type: "other", file_path: `uat75/kb-${Date.now()}.txt`, mime_type: "text/plain", ingestion_status: "ready", text_hash: `uat75-${Date.now()}` })
  .select().single();
if (kdocErr) fail(`KB doc insert: ${kdocErr.message}`);
const { error: kbChunkErr } = await supabase.from("document_chunks").insert(
  KB_CHUNKS.map(([title, text], i) => ({
    knowledge_document_id: kdoc.id, org_id: org.id, chunk_index: i,
    section_title: title, section_path: title, page_start: i + 1, page_end: i + 1,
    raw_text: text, cleaned_text: text, text_for_embedding: text,
    embedding: kbEmb[i], sparse_terms: sparseTerms(text),
  }))
);
if (kbChunkErr) fail(`KB chunks insert: ${kbChunkErr.message}`);
console.log(`→ KB seeded: ${KB_CHUNKS.length} capability chunks\n`);

const runResults = [];

for (let idx = 0; idx < DOCS.length; idx++) {
  const { text, itemCount } = DOCS[idx];
  const label = `Doc ${idx + 1}/3`;
  console.log(`${label}: uploading (${itemCount} requirement lines, ${(text.length / 1024).toFixed(1)} KB)...`);

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .insert({ org_id: org.id, name: `UAT-75 ${label} ${new Date().toISOString().slice(0, 16)}` })
    .select().single();
  if (dealErr) fail(`Deal insert: ${dealErr.message}`);

  const filePath = `uat75/rfp-${idx}-${Date.now()}.txt`;
  const { error: upErr } = await supabase.storage.from("documents").upload(filePath, new Blob([text], { type: "text/plain" }), { contentType: "text/plain" });
  if (upErr) fail(`Storage upload: ${upErr.message}`);

  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .insert({ deal_id: deal.id, filename: `${label}.txt`, file_path: filePath, mime_type: "text/plain", processing_status: "queued" })
    .select().single();
  if (docErr) fail(`Document insert: ${docErr.message}`);

  const t0 = Date.now();
  await supabase.from("jobs").insert({ document_id: doc.id, org_id: org.id, stage: "ingest" });

  const transitions = [["queued", 0]];
  let done = false;
  let lastStatus = "queued";
  const TIMEOUT_MS = 8 * 60_000;

  while (!done && Date.now() - t0 < TIMEOUT_MS) {
    const res = await fetch(`${APP_URL}/api/jobs/drain`, { method: "POST", headers: { "x-cron-secret": CRON_SECRET } }).catch(() => null);
    if (!res) { await new Promise((r) => setTimeout(r, 2000)); continue; }
    await res.json().catch(() => ({}));
    const { data: d } = await supabase.from("documents").select("processing_status").eq("id", doc.id).single();
    if (d && d.processing_status !== lastStatus) {
      lastStatus = d.processing_status;
      transitions.push([lastStatus, Date.now() - t0]);
      console.log(`  [${secs(Date.now() - t0).padStart(7)}] → ${lastStatus}`);
    }
    if (["completed", "failed", "extraction_failed", "generation_failed", "embedding_failed"].includes(lastStatus)) {
      done = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const totalMs = transitions[transitions.length - 1][1];

  const { data: runs } = await supabase
    .from("agent_runs")
    .select("agent_type, status, input_tokens, output_tokens, error_message")
    .eq("document_id", doc.id)
    .order("started_at");
  const { data: jobRows } = await supabase
    .from("jobs")
    .select("stage, status, attempts, error")
    .eq("document_id", doc.id);
  const { data: qs } = await supabase.from("questions").select("id").eq("document_id", doc.id);
  const qIds = (qs ?? []).map((q) => q.id);
  const { data: resps } = qIds.length
    ? await supabase.from("responses").select("gap_flag, confidence, draft_text").in("question_id", qIds)
    : { data: [] };
  const withText = (resps ?? []).filter((r) => (r.draft_text ?? "").trim().length > 0);
  const noSource = (resps ?? []).filter((r) => r.gap_flag === "no_source");

  const extractRun = (runs ?? []).find((r) => r.agent_type === "extraction");
  const generateRun = (runs ?? []).find((r) => r.agent_type === "generate");
  const extractCost = extractRun ? costOf("mistral-large-latest", extractRun.input_tokens ?? 0, extractRun.output_tokens ?? 0) : 0;
  const generateCost = generateRun ? costOf("mistral-small-latest", generateRun.input_tokens ?? 0, generateRun.output_tokens ?? 0) : 0;
  const generateRetries = (jobRows ?? []).find((j) => j.stage === "generate")?.attempts ?? 0;
  const extractRetries = (jobRows ?? []).find((j) => j.stage === "extract")?.attempts ?? 0;

  const result = {
    label, itemCount, finalStatus: lastStatus, totalMs,
    questions: qIds.length, drafted: withText.length, noSource: noSource.length,
    extractIn: extractRun?.input_tokens ?? 0, extractOut: extractRun?.output_tokens ?? 0, extractCost, extractRetries,
    generateIn: generateRun?.input_tokens ?? 0, generateOut: generateRun?.output_tokens ?? 0, generateCost, generateRetries,
  };
  runResults.push(result);

  console.log(`  → ${qIds.length} questions, ${withText.length} drafted, ${noSource.length} no-source, ${secs(totalMs)} total\n`);

  if (!keep) {
    await supabase.from("documents").delete().eq("id", doc.id);
    await supabase.from("deals").delete().eq("id", deal.id);
    await supabase.storage.from("documents").remove([filePath]);
  }
}

// ---------- aggregate report ----------
console.log("═══ AGGREGATE RESULTS (3 documents) ═══\n");
console.log("Per-document:");
console.log("  Doc                  Status      Time     Questions  Drafted  NoSrc  Extract(in/out)    Generate(in/out)     Cost");
for (const r of runResults) {
  console.log(
    `  ${r.label.padEnd(20)} ${r.finalStatus.padEnd(11)} ${secs(r.totalMs).padStart(7)}  ${String(r.questions).padStart(9)}  ${String(r.drafted).padStart(7)}  ${String(r.noSource).padStart(5)}  ${(r.extractIn + "/" + r.extractOut).padStart(17)}  ${(r.generateIn + "/" + r.generateOut).padStart(19)}  $${(r.extractCost + r.generateCost).toFixed(4)}`
  );
}

const totals = runResults.reduce((acc, r) => ({
  time: acc.time + r.totalMs,
  questions: acc.questions + r.questions,
  drafted: acc.drafted + r.drafted,
  noSource: acc.noSource + r.noSource,
  extractIn: acc.extractIn + r.extractIn,
  extractOut: acc.extractOut + r.extractOut,
  generateIn: acc.generateIn + r.generateIn,
  generateOut: acc.generateOut + r.generateOut,
  cost: acc.cost + r.extractCost + r.generateCost,
  extractRetries: acc.extractRetries + Math.max(0, r.extractRetries - 1),
  generateRetries: acc.generateRetries + Math.max(0, r.generateRetries - 1),
}), { time: 0, questions: 0, drafted: 0, noSource: 0, extractIn: 0, extractOut: 0, generateIn: 0, generateOut: 0, cost: 0, extractRetries: 0, generateRetries: 0 });

console.log("\nTotals across all 3 documents:");
console.log(`  Wall-clock (sum):      ${secs(totals.time)}  (avg ${secs(totals.time / 3)}/doc)`);
console.log(`  Questions extracted:   ${totals.questions}  (avg ${(totals.questions / 3).toFixed(1)}/doc)`);
console.log(`  Answers drafted:       ${totals.drafted}   No-source: ${totals.noSource}`);
console.log(`  Extraction tokens:     ${totals.extractIn} in / ${totals.extractOut} out  (mistral-large-latest)`);
console.log(`  Generation tokens:     ${totals.generateIn} in / ${totals.generateOut} out  (mistral-small-latest)`);
console.log(`  Total tokens:          ${totals.extractIn + totals.extractOut + totals.generateIn + totals.generateOut}`);
console.log(`  Extraction retries:    ${totals.extractRetries}  (stage-level, indicates 429s/errors)`);
console.log(`  Generation retries:    ${totals.generateRetries}`);
console.log(`  TOTAL COST (3 docs):   $${totals.cost.toFixed(4)}   (avg $${(totals.cost / 3).toFixed(4)}/doc)`);

if (!keep) {
  await supabase.from("knowledge_documents").delete().eq("id", kdoc.id);
  console.log("\n→ Test rows + seeded KB cleaned up (use --keep to inspect in the app).");
}
process.exit(0);
