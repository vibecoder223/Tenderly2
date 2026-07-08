#!/usr/bin/env node
/**
 * Creates a real login-able user + org + seeded KB for a live browser UAT
 * walkthrough of the 70-page RFP. Prints credentials to stdout.
 *
 * USAGE: node scripts/uat-live-setup.mjs
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = {};
const raw = await readFile(path.join(process.cwd(), ".env.local"), "utf8");
for (const line of raw.split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = Date.now();
const email = `uat-live-${stamp}@tenderly.test`;
const password = `UatLive!${stamp}`;

const { data: created, error: cErr } = await admin.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { name: "UAT Live Tester" },
});
if (cErr) { console.error(cErr.message); process.exit(1); }
const user = created.user;

const { data: org, error: oErr } = await admin
  .from("organizations")
  .insert({ name: `UAT Live ${stamp}`, slug: `uat-live-${stamp}` })
  .select().single();
if (oErr) { console.error(oErr.message); process.exit(1); }

await admin.from("team_members").insert({
  org_id: org.id, user_id: user.id, role: "owner", email, name: "UAT Live Tester",
});

// Seed KB (same capability chunks used by other UAT scripts)
const KB_CHUNKS = [
  ["Security certifications", "Propello Solutions holds ISO/IEC 27001:2022 certification (certificate #IS-745211, valid through March 2028) and completes an annual SOC 2 Type II audit covering security, availability, and confidentiality trust criteria. The latest SOC 2 report (January 2026) recorded zero exceptions. Penetration tests are performed twice yearly by CREST-accredited third parties, with all critical and high findings remediated within 14 days. Multi-factor authentication is enforced for all privileged accounts."],
  ["Data encryption", "All customer data is encrypted at rest using AES-256 with keys managed in a FIPS 140-2 Level 3 validated HSM, and in transit using TLS 1.3. Key rotation occurs every 90 days automatically. Customer-managed encryption keys (CMEK) are supported on the Enterprise plan."],
  ["Data residency and hosting", "The platform is hosted on Microsoft Azure with primary regions in Qatar Central (Doha) and West Europe (Netherlands). Customers select their data residency region at contract signature; data never leaves the selected region. An on-premises deployment option is available for government clients."],
  ["Service levels and support", "We commit to a 99.9% monthly uptime SLA with service credits of 10% per 0.1% shortfall, capped at 50% of monthly fees. Support tiers: Standard (business hours, 8-hour response) and Premium (24/7, 1-hour P1 response, dedicated technical account manager)."],
  ["Implementation methodology", "Implementations follow a four-phase methodology: Discovery (2 weeks), Configuration (3-4 weeks), UAT and training (2 weeks), and Hypercare (2 weeks post go-live). Large multi-department rollouts run 14-18 weeks. We have completed 140+ implementations with a 96% on-time rate."],
  ["Pricing model", "Pricing is per-user per-month subscription with three tiers: Essential ($29/user/month), Professional ($55/user/month), and Enterprise (custom, volume-discounted above 500 seats). Multi-year commitments receive 12-18% discounts."],
  ["Integrations and API", "The platform exposes a REST API (OpenAPI 3.1 documented) and webhooks. Native integrations include Microsoft 365, SharePoint, Salesforce, SAP Ariba, Oracle Fusion, and Slack. SSO via SAML 2.0 and OIDC. SCIM 2.0 handles automated user provisioning."],
  ["Access control", "Role-based access control ships with five default roles and unlimited custom roles with field-level permissions. All privileged actions are captured in an immutable audit log retained for 7 years."],
  ["Business continuity and disaster recovery", "The disaster recovery plan targets an RPO of 15 minutes and RTO of 4 hours, tested twice yearly. Backups run continuously with point-in-time recovery within 35 days."],
  ["Company profile and references", "Propello Solutions was founded in 2019, is headquartered in Doha with offices in Dubai and London, and employs 85 staff. Reference customers include three GCC government ministries and two regional banks."],
  ["Compliance and privacy", "The platform complies with GDPR and Qatar's Personal Data Privacy Protection Law (Law No. 13 of 2016). A Data Protection Officer is appointed. Data subject requests are fulfilled within 30 days."],
  ["Training and accessibility", "Training includes role-based live sessions, a self-paced learning portal, and train-the-trainer packages. Documentation is available in English and Arabic. The platform meets WCAG 2.1 AA accessibility standards."],
];
const STOPWORDS = new Set(["the","a","an","and","or","but","of","to","in","on","for","with","at","by","is","are","was","were","be","been","being","this","that","these","those","it","its","as","from","into","than","then","so","such","not","no","do","does","did","done","has","have","had","will","would","should","could","may","might","must","can","shall","we","you","they","i","he","she","our","your","their","my","his","her","us","them","also","more","most","any","all","each"]);
function sparseTerms(text) {
  const toks = text.toLowerCase().replace(/[^a-z0-9\s\-]/g, " ").split(/\s+/).filter((t) => t.length >= 3 && !STOPWORDS.has(t));
  return [...new Set(toks)].slice(0, 200);
}
const MISTRAL_KEY = env.MISTRAL_API_KEY;
async function embed(texts) {
  const res = await fetch("https://api.mistral.ai/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${MISTRAL_KEY}` },
    body: JSON.stringify({ model: "mistral-embed", input: texts }),
  });
  if (!res.ok) { console.error(`Mistral embed failed: ${res.status} ${(await res.text()).slice(0, 200)}`); process.exit(1); }
  const j = await res.json();
  return j.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}
const kbEmb = await embed(KB_CHUNKS.map(([, t]) => t));
const { data: kdoc, error: kdocErr } = await admin
  .from("knowledge_documents")
  .insert({ org_id: org.id, filename: "capability-statement.txt", doc_type: "other", file_path: `uatlive/kb-${stamp}.txt`, mime_type: "text/plain", ingestion_status: "ready", text_hash: `uatlive-${stamp}` })
  .select().single();
if (kdocErr) { console.error(kdocErr.message); process.exit(1); }
await admin.from("document_chunks").insert(
  KB_CHUNKS.map(([title, text], i) => ({
    knowledge_document_id: kdoc.id, org_id: org.id, chunk_index: i,
    section_title: title, section_path: title, page_start: i + 1, page_end: i + 1,
    raw_text: text, cleaned_text: text, text_for_embedding: text,
    embedding: kbEmb[i], sparse_terms: sparseTerms(text),
  }))
);

console.log(JSON.stringify({ email, password, org_id: org.id, user_id: user.id }, null, 2));
