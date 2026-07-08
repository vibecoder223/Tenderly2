#!/usr/bin/env node
/**
 * UAT harness for the batched AI pipeline.
 *
 * Seeds a KB (12 capability chunks, Mistral-embedded), uploads a sample RFP
 * (~8 pages, 22 requirements), enqueues the pipeline, drives /api/jobs/drain,
 * and reports per-stage wall-clock, token usage, and response quality.
 *
 * REQUIRES: `npm run dev` running on :3000 (drain endpoint), and .env.local
 * with Supabase service role + Mistral keys.
 *
 * USAGE: node scripts/uat.mjs [--keep]   (--keep skips cleanup of test rows)
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// ---------- env ----------
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
const MISTRAL_KEY = env.MISTRAL_API_KEY;
const CRON_SECRET = env.CRON_SECRET;
const APP_URL = env.UAT_APP_URL || "http://localhost:3000";
if (!SUPABASE_URL || !SERVICE_KEY) fail("Need Supabase URL + service role key in .env.local");
if (!MISTRAL_KEY) fail("Need MISTRAL_API_KEY in .env.local");
if (!CRON_SECRET) fail("Need CRON_SECRET in .env.local");

const keep = process.argv.includes("--keep");
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function fail(msg) {
  console.error(`✘ ${msg}`);
  process.exit(1);
}
const now = () => Date.now();
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

// ---------- sample KB ----------
const KB_CHUNKS = [
  ["Security certifications", "Propello Solutions holds ISO/IEC 27001:2022 certification (certificate #IS-745211, valid through March 2028) and completes an annual SOC 2 Type II audit covering security, availability, and confidentiality trust criteria. The latest SOC 2 report (January 2026) recorded zero exceptions. Penetration tests are performed twice yearly by CREST-accredited third parties, with all critical and high findings remediated within 14 days."],
  ["Data encryption", "All customer data is encrypted at rest using AES-256 with keys managed in a FIPS 140-2 Level 3 validated HSM, and in transit using TLS 1.3. Key rotation occurs every 90 days automatically. Customer-managed encryption keys (CMEK) are supported on the Enterprise plan, allowing customers to revoke access unilaterally."],
  ["Data residency and hosting", "The platform is hosted on Microsoft Azure with primary regions in Qatar Central (Doha) and West Europe (Netherlands). Customers select their data residency region at contract signature; data never leaves the selected region, including backups and disaster recovery replicas. An on-premises deployment option is available for government clients with sovereignty requirements."],
  ["Service levels and support", "We commit to a 99.9% monthly uptime SLA with service credits of 10% per 0.1% shortfall, capped at 50% of monthly fees. Support tiers: Standard (business hours, 8-hour response) and Premium (24/7, 1-hour P1 response, dedicated technical account manager). Average P1 resolution time in 2025 was 3.2 hours."],
  ["Implementation methodology", "Implementations follow a four-phase methodology: Discovery (2 weeks), Configuration (3-4 weeks), UAT and training (2 weeks), and Hypercare (2 weeks post go-live). A typical mid-size deployment completes in 8-10 weeks. Each project is staffed with a certified project manager, a solution architect, and a training lead. We have completed 140+ implementations with a 96% on-time rate."],
  ["Pricing model", "Pricing is per-user per-month subscription with three tiers: Essential ($29/user/month), Professional ($55/user/month), and Enterprise (custom, volume-discounted above 500 seats). Implementation is a one-time fee typically 0.8x-1.2x first-year subscription. No charges for storage up to 1TB per workspace; API access is included in Professional and above. Multi-year commitments receive 12-18% discounts."],
  ["Integrations and API", "The platform exposes a REST API (OpenAPI 3.1 documented) and webhooks for all core objects. Native integrations include Microsoft 365, SharePoint, Salesforce, SAP Ariba, Oracle Fusion, and Slack. Single sign-on is supported via SAML 2.0 and OIDC (Azure AD, Okta, Ping). SCIM 2.0 handles automated user provisioning and deprovisioning."],
  ["Access control", "Role-based access control ships with five default roles and unlimited custom roles with field-level permissions. All privileged actions are captured in an immutable audit log retained for 7 years and exportable to customer SIEM via syslog or API. IP allowlisting and session policies (timeout, concurrent session limits) are configurable per workspace."],
  ["Business continuity and disaster recovery", "The disaster recovery plan targets an RPO of 15 minutes and RTO of 4 hours, tested twice yearly with published results. Backups run continuously (point-in-time recovery to any second within 35 days) plus daily snapshots retained 12 months in a geo-separate region. The business continuity plan is ISO 22301-aligned and audited annually."],
  ["Company profile and references", "Propello Solutions was founded in 2019, is headquartered in Doha with offices in Dubai and London, and employs 85 staff, of whom 60 are in engineering and delivery. Reference customers include three GCC government ministries, two regional banks, and a Fortune 500 logistics firm; contactable references are available under NDA. The company is profitable and carries no external debt."],
  ["Compliance and privacy", "The platform complies with GDPR and Qatar's Personal Data Privacy Protection Law (Law No. 13 of 2016). A Data Protection Officer is appointed. Data processing agreements with EU standard contractual clauses are offered as standard. Data subject requests (access, erasure, portability) are fulfilled through a self-service console within 30 days. Sub-processors are listed publicly and customers are notified 30 days before changes."],
  ["Training and onboarding", "Training includes role-based live sessions (admin, end-user, and executive tracks), a self-paced learning portal with certifications, and train-the-trainer packages. All documentation is available in English and Arabic. Post go-live, quarterly business reviews track adoption metrics; customers averaging 78% weekly active usage after 90 days."],
];

// ---------- sample RFP ----------
const RFP_TEXT = `REQUEST FOR PROPOSAL — ENTERPRISE PROPOSAL AUTOMATION PLATFORM
RFP Reference: QG-2026-114 | Issued: June 2026

SECTION 1 — INTRODUCTION
The Authority invites proposals from qualified vendors for the supply, implementation, and support of an enterprise proposal automation platform. Vendors must respond to every requirement in Sections 3 through 7, indicating full compliance, partial compliance, or non-compliance, with supporting evidence.

SECTION 2 — BACKGROUND
The Authority processes approximately 400 tenders annually across 12 departments. The current process is manual and the Authority seeks a platform to automate document analysis, response drafting, and compliance tracking.

SECTION 3 — SECURITY REQUIREMENTS
3.1 The vendor MUST hold a current ISO 27001 certification and provide the certificate number and validity period.
3.2 The vendor MUST provide evidence of an independent SOC 2 Type II audit completed within the last 12 months.
3.3 All data MUST be encrypted at rest and in transit. Describe the encryption standards and key management approach, including support for customer-managed keys.
3.4 The solution MUST support single sign-on via SAML 2.0 or OIDC with the Authority's Azure Active Directory.
3.5 Describe the role-based access control model, including custom roles and audit logging capabilities.
3.6 The vendor MUST describe its penetration testing regime and remediation timelines.

SECTION 4 — DATA GOVERNANCE REQUIREMENTS
4.1 All Authority data MUST reside within the State of Qatar or, subject to approval, within the GCC. Specify available hosting regions and residency guarantees.
4.2 Confirm compliance with Qatar Law No. 13 of 2016 on Personal Data Privacy Protection and describe your data protection governance.
4.3 Describe your backup and disaster recovery capabilities, including RPO and RTO commitments and testing frequency.
4.4 Confirm whether an on-premises or sovereign deployment option is available for classified workloads.

SECTION 5 — TECHNICAL REQUIREMENTS
5.1 The solution MUST provide a documented REST API for integration with the Authority's existing systems.
5.2 Describe available native integrations, specifically with Microsoft 365 and SharePoint.
5.3 The solution MUST support automated user provisioning and deprovisioning via SCIM.
5.4 Describe the platform's uptime commitment and the service credit regime applicable to SLA breaches.

SECTION 6 — IMPLEMENTATION AND SUPPORT REQUIREMENTS
6.1 Describe your implementation methodology, typical timeline for a 300-user deployment, and the project team you would assign.
6.2 Describe the training approach, including Arabic-language support and post-go-live adoption tracking.
6.3 Describe your support tiers, response times for priority-1 incidents, and escalation procedures.
6.4 Provide details of at least three comparable reference implementations, preferably within the GCC region.

SECTION 7 — COMMERCIAL REQUIREMENTS
7.1 Provide your pricing model, including subscription tiers, implementation fees, and any volume or multi-year discounts applicable to a 300-user deployment.
7.2 Confirm the company's financial standing, years in operation, and total staff dedicated to delivery.

END OF RFP
`;

// ---------- Mistral embeddings ----------
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

const STOPWORDS = new Set(["the","a","an","and","or","but","of","to","in","on","for","with","at","by","is","are","was","were","be","been","being","this","that","these","those","it","its","as","from","into","than","then","so","such","not","no","do","does","did","done","has","have","had","will","would","should","could","may","might","must","can","shall","we","you","they","i","he","she","our","your","their","my","his","her","us","them","also","more","most","any","all","each"]);
function sparseTerms(text) {
  const toks = text.toLowerCase().replace(/[^a-z0-9\s\-]/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return [...new Set(toks)].slice(0, 200);
}

// ---------- main ----------
console.log("═══ Propello UAT — batched pipeline ═══\n");

const { data: org } = await supabase.from("organizations").select("id, name").order("created_at").limit(1).single();
if (!org) fail("No organization found — sign up in the app first.");
console.log(`→ Org: ${org.name} (${org.id})`);

// Preexisting queue noise check
const { count: pendingBefore } = await supabase.from("jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "claimed"]);
if (pendingBefore > 0) console.log(`⚠ ${pendingBefore} preexisting live jobs in queue — timings may include their work.`);

// Drain reachable?
const ping = await fetch(`${APP_URL}/api/jobs/drain`, { method: "POST", headers: { "x-cron-secret": CRON_SECRET } }).catch(() => null);
if (!ping || ping.status >= 500) fail(`Drain endpoint not reachable at ${APP_URL} — is 'npm run dev' running?`);
console.log(`→ Drain endpoint OK (${APP_URL})`);

// 1. Seed KB
const tSeed0 = now();
const kbTexts = KB_CHUNKS.map(([, t]) => t);
const kbEmb = await embed(kbTexts);
const { data: kdoc, error: kdocErr } = await supabase
  .from("knowledge_documents")
  .insert({ org_id: org.id, filename: "UAT-capability-statement.txt", doc_type: "other", file_path: `uat/kb-${Date.now()}.txt`, mime_type: "text/plain", ingestion_status: "ready", text_hash: `uat-${Date.now()}` })
  .select().single();
if (kdocErr) fail(`KB doc insert: ${kdocErr.message}`);
const { error: chunkErr } = await supabase.from("document_chunks").insert(
  KB_CHUNKS.map(([title, text], i) => ({
    knowledge_document_id: kdoc.id, org_id: org.id, chunk_index: i,
    section_title: title, section_path: title, page_start: i + 1, page_end: i + 1,
    raw_text: text, cleaned_text: text, text_for_embedding: text,
    embedding: kbEmb[i], sparse_terms: sparseTerms(text),
  }))
);
if (chunkErr) fail(`KB chunks insert: ${chunkErr.message}`);
console.log(`→ KB seeded: ${KB_CHUNKS.length} chunks, embedded in ${secs(now() - tSeed0)}`);

// 2. Deal + document + storage upload
const { data: deal, error: dealErr } = await supabase.from("deals").insert({ org_id: org.id, name: `UAT batched pipeline ${new Date().toISOString().slice(0, 16)}` }).select().single();
if (dealErr) fail(`Deal insert: ${dealErr.message}`);
const filePath = `uat/rfp-${Date.now()}.txt`;
const { error: upErr } = await supabase.storage.from("documents").upload(filePath, new Blob([RFP_TEXT], { type: "text/plain" }), { contentType: "text/plain" });
if (upErr) fail(`Storage upload: ${upErr.message}`);
const { data: doc, error: docErr } = await supabase.from("documents").insert({ deal_id: deal.id, filename: "QG-2026-114-RFP.txt", file_path: filePath, mime_type: "text/plain", processing_status: "queued" }).select().single();
if (docErr) fail(`Document insert: ${docErr.message}`);
console.log(`→ RFP uploaded: ${doc.filename} (${(RFP_TEXT.length / 1024).toFixed(1)} KB)\n`);

// 3. Enqueue + drive
const t0 = now();
const transitions = [["queued", 0]];
await supabase.from("jobs").insert({ document_id: doc.id, org_id: org.id, stage: "ingest" });

let done = false;
const poller = (async () => {
  let last = "queued";
  while (!done) {
    const { data: d } = await supabase.from("documents").select("processing_status").eq("id", doc.id).single();
    if (d && d.processing_status !== last) {
      last = d.processing_status;
      transitions.push([last, now() - t0]);
      console.log(`  [${secs(now() - t0).padStart(7)}] → ${last}`);
      if (["completed", "failed", "extraction_failed", "generation_failed", "embedding_failed"].includes(last)) { done = true; return; }
    }
    await new Promise((r) => setTimeout(r, 1500));
  }
})();

const TIMEOUT_MS = 20 * 60_000;
const drainer = (async () => {
  while (!done && now() - t0 < TIMEOUT_MS) {
    const res = await fetch(`${APP_URL}/api/jobs/drain`, { method: "POST", headers: { "x-cron-secret": CRON_SECRET } }).catch(() => null);
    if (!res) { await new Promise((r) => setTimeout(r, 2000)); continue; }
    const j = await res.json().catch(() => ({}));
    if ((j.claimed ?? 0) === 0) await new Promise((r) => setTimeout(r, 2000));
  }
})();

await Promise.race([Promise.all([poller, drainer]), new Promise((r) => setTimeout(r, TIMEOUT_MS))]);
done = true;
const totalMs = transitions[transitions.length - 1][1];

// 4. Report
console.log("\n═══ RESULTS ═══");
const { data: runs } = await supabase.from("agent_runs").select("agent_type, status, input_tokens, output_tokens, started_at, completed_at").eq("document_id", doc.id).order("started_at");
let tokIn = 0, tokOut = 0;
for (const r of runs ?? []) {
  const dur = r.completed_at && r.started_at ? (new Date(r.completed_at) - new Date(r.started_at)) : 0;
  tokIn += r.input_tokens ?? 0; tokOut += r.output_tokens ?? 0;
  console.log(`  ${r.agent_type.padEnd(12)} ${r.status.padEnd(10)} ${secs(dur).padStart(7)}  in:${r.input_tokens ?? "-"} out:${r.output_tokens ?? "-"}`);
}
const { data: qs } = await supabase.from("questions").select("id").eq("document_id", doc.id);
const qIds = (qs ?? []).map((q) => q.id);
const { data: resps } = qIds.length ? await supabase.from("responses").select("question_id, gap_flag, confidence, draft_text").in("question_id", qIds) : { data: [] };
const withText = (resps ?? []).filter((r) => (r.draft_text ?? "").trim().length > 0);
const noSource = (resps ?? []).filter((r) => r.gap_flag === "no_source");
const { data: genJobs } = await supabase.from("jobs").select("stage, status, created_at, updated_at, attempts, error").eq("document_id", doc.id).order("created_at");
console.log("\n  Stage transitions:");
for (const [s, ms] of transitions) console.log(`    ${secs(ms).padStart(7)}  ${s}`);
console.log(`\n  Questions extracted:  ${qIds.length}`);
console.log(`  Responses drafted:    ${withText.length}`);
console.log(`  No-source flagged:    ${noSource.length}`);
console.log(`  Extract-stage tokens: ${tokIn} in / ${tokOut} out`);
console.log(`  Jobs:`);
for (const jb of genJobs ?? []) console.log(`    ${jb.stage.padEnd(10)} ${jb.status.padEnd(7)} attempts:${jb.attempts}${jb.error ? " err:" + jb.error.slice(0, 80) : ""}`);
console.log(`\n  TOTAL WALL-CLOCK: ${secs(totalMs)} (${(totalMs / 60000).toFixed(1)} min)`);

// Sample answers
console.log("\n  Sample drafted answers:");
for (const r of withText.slice(0, 3)) console.log(`   • [conf ${r.confidence}] ${r.draft_text.slice(0, 180)}…`);

// 5. Cleanup
if (!keep) {
  await supabase.from("documents").delete().eq("id", doc.id);
  await supabase.from("deals").delete().eq("id", deal.id);
  await supabase.from("knowledge_documents").delete().eq("id", kdoc.id);
  await supabase.storage.from("documents").remove([filePath]);
  console.log("\n→ Test rows cleaned up (use --keep to inspect in the app).");
} else {
  console.log(`\n→ Kept: deal ${deal.id}, document ${doc.id}, KB ${kdoc.id}`);
}
process.exit(0);
