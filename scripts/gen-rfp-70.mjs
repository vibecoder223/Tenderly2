#!/usr/bin/env node
/**
 * Generates a large, realistic (~70 page) government RFP as plain text.
 * Structure mirrors real public-sector tenders: front matter + instructions
 * to bidders + evaluation methodology + numbered requirement sections with
 * contextual prose + general conditions + schedules.
 *
 * ~500 words/page is the convention, so target ~35,000 words.
 *
 * USAGE: node scripts/gen-rfp-70.mjs > samples/rfp-70page-govt.txt
 */

const REF = "RFP-GOV-2026-0417";
const ORG = "The National Digital Government Authority";
const OUT = [];
const w = (s = "") => OUT.push(s);

// ---- boilerplate paragraph banks (recycled with variation to build bulk) ----
const CONTEXT_PARAS = [
  "The Authority operates across multiple ministries and public bodies and must ensure that any solution procured under this tender is capable of serving a highly distributed, multi-department user base while maintaining strict information-security and data-sovereignty controls.",
  "Bidders are reminded that the evaluation panel will place significant weight on demonstrable, verifiable evidence rather than marketing assertions. Every claim of compliance must be substantiated with certificates, audit reports, reference contacts, or documented technical specifications as appropriate.",
  "The current environment consists of a fragmented set of manual processes, legacy spreadsheets, and disconnected departmental tools. The Authority seeks a consolidated, auditable, and scalable platform that reduces cycle times, improves transparency, and provides leadership with real-time visibility across the entire portfolio.",
  "Where a requirement is expressed using the word MUST, it is mandatory and non-compliance may render the bid non-responsive. Where a requirement uses SHOULD, it is highly desirable and will be scored. Where a requirement uses MAY, it is optional and offered for information.",
  "The successful bidder will be expected to operate under a formal governance framework with regular service reviews, documented escalation paths, and jointly agreed performance indicators reported on a monthly basis for the duration of the contract term.",
];

function ctx(i) {
  return CONTEXT_PARAS[i % CONTEXT_PARAS.length];
}

// ---- requirement bank: 14 sections, expanded ----
const SECTIONS = [
  { id: "5", title: "SECURITY AND INFORMATION ASSURANCE REQUIREMENTS", items: [
    "The vendor MUST hold a current ISO/IEC 27001:2022 certification and provide the certificate number, accredited certification body, scope statement, and validity period.",
    "The vendor MUST provide evidence of an independent SOC 2 Type II audit completed within the last twelve months, including the auditor's opinion and any noted exceptions.",
    "The solution MUST encrypt all data at rest using AES-256 or stronger, and describe the key-management approach, including hardware security module usage and rotation frequency.",
    "The solution MUST encrypt all data in transit using TLS 1.2 or higher, and confirm that legacy protocols are disabled.",
    "The solution MUST support customer-managed encryption keys, enabling the Authority to revoke platform access to its data unilaterally.",
    "The vendor MUST support single sign-on via SAML 2.0 or OIDC integrated with the Authority's Azure Active Directory tenant.",
    "The vendor MUST enforce multi-factor authentication for all administrative and privileged accounts.",
    "Describe the role-based access control model, including the number of default roles, support for custom roles, and field-level permission granularity.",
    "Describe the immutable audit-logging capability, the retention period, and the mechanisms available to export logs to the Authority's SIEM.",
    "Describe the penetration-testing regime, including frequency, the accreditation of testers, and remediation SLAs by severity classification.",
    "Describe the vulnerability-management program, including scanning cadence and patch timelines for critical and high findings.",
    "Describe the secure software development lifecycle, including SAST, DAST, dependency scanning, and code-review practices.",
    "Describe the security incident-response plan and the committed customer-notification timeline following a confirmed breach.",
    "Confirm whether IP allowlisting, session timeout, and concurrent-session limits are configurable per workspace.",
    "Describe how the platform segregates each tenant's data and prevents cross-tenant access in a multi-tenant architecture.",
  ]},
  { id: "6", title: "DATA GOVERNANCE, PRIVACY AND SOVEREIGNTY REQUIREMENTS", items: [
    "All Authority data MUST reside within the State of Qatar or, subject to prior written approval, within an approved GCC jurisdiction. Specify all available hosting regions.",
    "Confirm full compliance with Qatar Law No. 13 of 2016 on Personal Data Privacy Protection and describe the governance structure supporting it.",
    "Confirm whether a Data Protection Officer is appointed and describe that individual's reporting line and independence.",
    "Describe the backup regime, including frequency, retention, geographic separation, and point-in-time recovery capabilities.",
    "State the committed Recovery Point Objective and Recovery Time Objective, and the frequency with which disaster-recovery tests are performed.",
    "Confirm whether an on-premises or sovereign-cloud deployment option is available for classified or restricted workloads.",
    "Describe the sub-processor disclosure practice and the notice period provided before any sub-processor is added or changed.",
    "Describe data classification handling and the controls applied to commercially sensitive or personally identifiable information.",
    "Confirm the data export, retention, and deletion practices that apply upon contract termination or expiry.",
    "Describe the data-breach notification process, including the typical time-to-notify and the information provided to affected parties.",
    "Confirm whether the platform supports data-residency guarantees for backups and disaster-recovery replicas, not only primary storage.",
    "Describe the mechanisms available for fulfilling data-subject access, erasure, and portability requests within statutory timeframes.",
  ]},
  { id: "7", title: "CORE FUNCTIONAL REQUIREMENTS", items: [
    "The solution MUST support end-to-end lifecycle management of tender and proposal records from creation through award and closure.",
    "The solution MUST provide AI-assisted extraction of individual requirements from uploaded tender documents in PDF and Microsoft Word formats.",
    "Describe how the platform structures extracted requirements into a reviewable, categorized register with traceability to the source document.",
    "The solution MUST support automated first-draft response generation grounded in an organizational knowledge base.",
    "Describe how the platform flags requirements for which no supporting source content exists in the knowledge base.",
    "Describe support for structured response templates and automated compliance checklists.",
    "Describe the multi-stage review workflow, including weighted scoring, approval gates, and delegation of authority.",
    "Describe collaborative review capabilities across multiple concurrent stakeholders, including comment threads and conflict-of-interest tracking.",
    "The solution MUST provide configurable workflow automation that can be modified by business administrators without custom code.",
    "Describe search and retrieval capabilities across historical tenders, responses, and the knowledge base.",
    "Describe reporting and dashboard capabilities available to leadership for real-time portfolio visibility.",
    "Describe how the platform supports electronic submission with tamper-evident timestamps.",
    "Describe version control and complete change-history tracking for every record in the platform.",
    "Confirm whether bulk import and export of historical records is supported, and specify the formats.",
    "Describe how the platform handles multi-language documents, including Arabic-language content.",
  ]},
  { id: "8", title: "KNOWLEDGE MANAGEMENT AND CONTENT REQUIREMENTS", items: [
    "Describe how the platform ingests, indexes, and maintains an organizational knowledge base of reusable answer content.",
    "Describe the mechanism by which approved responses are captured and made reusable for future tenders.",
    "Describe how content freshness is managed, including review cycles and expiry of stale content.",
    "Describe how the platform attributes generated answers to their supporting source passages for auditability.",
    "Describe the controls that prevent unapproved or draft content from being reused in submitted responses.",
    "Describe how subject-matter experts are routed requirements that fall within their domain.",
  ]},
  { id: "9", title: "TECHNICAL AND INTEGRATION REQUIREMENTS", items: [
    "The solution MUST provide a documented REST API conforming to OpenAPI 3.0 or later for integration with the Authority's systems.",
    "Describe available native integrations, specifically with Microsoft 365 and SharePoint.",
    "The solution MUST support automated user provisioning and deprovisioning via SCIM 2.0.",
    "Confirm the platform's uptime commitment and describe the service-credit regime applicable to SLA breaches.",
    "Confirm API rate limits and describe how the platform scales under peak concurrent load.",
    "Describe the system architecture's approach to high availability, failover, and horizontal scalability.",
    "Describe the approach to accessibility compliance against WCAG 2.1 AA or an equivalent standard.",
    "Describe mobile access, including whether native applications or responsive web are provided.",
    "Confirm the supported browsers and the minimum client-side requirements.",
    "Describe the webhook or event-streaming capabilities available for near-real-time integration.",
    "Describe the sandbox or non-production environment provided for integration testing.",
  ]},
  { id: "10", title: "IMPLEMENTATION, MIGRATION AND TRANSITION REQUIREMENTS", items: [
    "Describe the implementation methodology, the typical timeline for a deployment of approximately 500 users across 12 departments, and the project team proposed.",
    "Describe the data-migration approach from the legacy systems currently in use, including validation and reconciliation.",
    "Describe the transition and cutover plan, including rollback provisions.",
    "Describe the training approach, including Arabic-language materials, role-based tracks, and train-the-trainer options.",
    "Describe post-go-live adoption tracking and the metrics reported to the Authority.",
    "Describe the change-management and configuration-governance process for a phased, multi-department rollout.",
    "Describe the knowledge-transfer approach that reduces the Authority's long-term dependency on vendor personnel.",
    "Confirm the maximum number of concurrent implementation workstreams the vendor's team can support.",
  ]},
  { id: "11", title: "SUPPORT, SLA AND SERVICE MANAGEMENT REQUIREMENTS", items: [
    "Describe the support tiers offered, the hours of coverage, and the response and resolution targets by incident priority.",
    "Confirm the response time committed for priority-one incidents and the associated escalation procedure.",
    "Confirm whether a dedicated technical account manager is provided for the duration of the contract.",
    "Describe the service-level reporting provided, including frequency and format.",
    "Describe the escalation path in the event of a repeatedly missed SLA.",
    "Describe the product roadmap process and how customer feedback is incorporated into release planning.",
    "Confirm the maintenance-window policy and the notice provided before planned maintenance.",
  ]},
  { id: "12", title: "COMMERCIAL AND CONTRACTUAL REQUIREMENTS", items: [
    "Provide the complete pricing model, including subscription tiers, implementation fees, and any volume or multi-year discounts applicable to a 500-user deployment.",
    "Confirm the company's financial standing, years in operation, and total staff dedicated to delivery and support.",
    "Confirm standard payment terms and whether contract governance under the laws of the State of Qatar is acceptable.",
    "Confirm the levels of professional-indemnity and cyber-liability insurance maintained.",
    "Describe the approach to price stability or any escalation clauses over a multi-year term.",
    "Confirm whether performance bonds or bank guarantees can be provided as required by procurement regulations.",
    "Describe any early-termination provisions and the associated costs.",
    "Confirm whether pricing is based on named users, concurrent users, or unlimited users.",
    "Confirm whether the vendor is willing to enter into a service-level agreement with financial remedies.",
  ]},
  { id: "13", title: "QUALITY, ACCEPTANCE AND WARRANTY REQUIREMENTS", items: [
    "Describe the approach to user-acceptance testing prior to go-live, including entry and exit criteria.",
    "Confirm the warranty period following go-live and precisely what is covered during that period.",
    "Describe the defect-severity classification and the resolution timelines committed during warranty.",
    "Confirm whether performance and load-testing results are available for the evaluation panel's review prior to award.",
  ]},
  { id: "14", title: "GOVERNANCE, SUSTAINABILITY AND LOCAL-CONTENT REQUIREMENTS", items: [
    "Describe the governance structure proposed for ongoing account management, including the seniority of the assigned sponsor.",
    "Confirm whether an executive sponsor is assigned to the account and describe their involvement.",
    "Describe the vendor's approach to sustainability and any relevant environmental certifications.",
    "Describe the vendor's contribution to local content, in-country value, and Qatarization objectives.",
    "Describe the vendor's approach to business continuity for its own operations supporting this contract.",
  ]},
];

// ---------- FRONT MATTER ----------
w(`REQUEST FOR PROPOSAL`);
w(`SUPPLY, IMPLEMENTATION AND SUPPORT OF AN ENTERPRISE TENDER AND PROPOSAL AUTOMATION PLATFORM`);
w(`RFP Reference: ${REF}`);
w(`Issued by: ${ORG}`);
w(`Date of Issue: 15 June 2026`);
w(`Closing Date for Submissions: 31 August 2026, 14:00 Arabia Standard Time`);
w("");
w("NOTICE TO BIDDERS: This document contains the complete requirements for the above procurement. Bidders must respond to every mandatory requirement. Bids that omit mandatory responses may be declared non-responsive and excluded from evaluation without further consideration.");
w("");

w("TABLE OF CONTENTS");
w("Section 1 — Introduction and Purpose");
w("Section 2 — Instructions to Bidders");
w("Section 3 — Evaluation Methodology");
w("Section 4 — Scope of Requirements");
SECTIONS.forEach((s) => w(`Section ${s.id} — ${s.title}`));
w("Section 15 — General Terms and Conditions");
w("Section 16 — Schedules and Annexes");
w("");

w("SECTION 1 — INTRODUCTION AND PURPOSE");
w("");
for (let i = 0; i < 4; i++) w(ctx(i));
w("");
w("1.1 The purpose of this Request for Proposal is to invite qualified and experienced vendors to submit proposals for the supply, implementation, integration, training, and ongoing support of an enterprise-grade tender and proposal automation platform.");
w("1.2 The platform is intended to serve approximately 500 named users distributed across 12 government departments, with the ability to scale to 1,000 users over the contract term.");
w("1.3 The initial contract term shall be three years, with two optional one-year extensions exercisable at the sole discretion of the Authority, subject to satisfactory performance.");
w("1.4 The Authority processes in excess of 400 tenders annually. The current process is predominantly manual and the Authority seeks measurable reductions in cycle time, improved compliance tracking, and consolidated management information.");
w(ctx(2));
w("");

w("SECTION 2 — INSTRUCTIONS TO BIDDERS");
w("");
w("2.1 Bids must be submitted electronically through the Authority's e-procurement portal no later than the closing date and time stated on the cover page. Late submissions will not be accepted under any circumstances.");
w("2.2 Bids must remain valid for a period of one hundred and twenty (120) days from the closing date.");
w("2.3 Bidders must submit two separate envelopes: a Technical Proposal and a Commercial Proposal. Commercial information must not appear anywhere in the Technical Proposal.");
w("2.4 Bidders must respond to each requirement individually, stating one of: Fully Compliant, Partially Compliant, or Non-Compliant, together with a supporting narrative and evidence.");
w("2.5 Any clarification questions must be submitted in writing no later than fourteen (14) days before the closing date. Responses will be published to all registered bidders.");
w("2.6 The Authority reserves the right to accept or reject any bid, to annul the procurement process, or to reject all bids at any time prior to award, without incurring any liability to bidders.");
w("2.7 Bidders shall bear all costs associated with the preparation and submission of their bids.");
w("2.8 Any attempt by a bidder to influence the evaluation process improperly shall result in immediate disqualification.");
w(ctx(3));
w("");

w("SECTION 3 — EVALUATION METHODOLOGY");
w("");
w("3.1 Bids will be evaluated in three stages: (a) compliance screening, (b) technical evaluation, and (c) commercial evaluation.");
w("3.2 Only bids passing the compliance screening will proceed to technical evaluation. The technical and commercial scores will be combined using a 70/30 weighting in favour of technical merit.");
w("3.3 The technical evaluation will assess the response to each requirement section according to the weightings set out below. Evidence quality, depth, and verifiability will materially affect scoring.");
w("3.4 The Authority may, at its discretion, invite shortlisted bidders to present their solutions and to provide a live demonstration against a representative sample tender.");
w(ctx(1));
w("");

w("SECTION 4 — SCOPE OF REQUIREMENTS");
w("");
w("4.1 The following sections set out the detailed requirements. Each requirement is uniquely numbered for ease of response. Bidders must retain the numbering in their responses.");
w("4.2 The use of MUST, SHOULD, and MAY throughout this document carries the meaning defined in Section 2 and the introductory notes.");
w(ctx(0));
w("");

// ---------- REQUIREMENT SECTIONS with per-item context ----------
let totalReqs = 0;
for (const sec of SECTIONS) {
  w(`SECTION ${sec.id} — ${sec.title}`);
  w("");
  w(`${sec.id}.0 The requirements in this section are ${sec.title.toLowerCase()}. ${ctx(sec.id.charCodeAt(0))}`);
  w("");
  sec.items.forEach((item, i) => {
    totalReqs++;
    w(`${sec.id}.${i + 1} ${item}`);
    // contextual prose to give the section realistic bulk (~3 paragraphs/item)
    w(`Context: ${ctx(i + sec.id.length)} Bidders should address this requirement with specific, verifiable detail rather than general statements of intent.`);
    w(`Evaluation note: ${ctx(i + sec.id.length + 1)} Responses lacking verifiable evidence against this requirement will score in the lower quartile regardless of the compliance status claimed.`);
    w(`Supplementary guidance: ${ctx(i + sec.id.length + 2)} ${ctx(i + sec.id.length + 3)}`);
    w(`Risk note: ${ctx(i + sec.id.length + 4)}`);
    w("");
  });
}

// ---------- BACK MATTER ----------
w("SECTION 15 — GENERAL TERMS AND CONDITIONS");
w("");
for (let i = 1; i <= 40; i++) {
  w(`15.${i} ${ctx(i)} ${ctx(i + 2)} ${ctx(i + 4)}`);
  w("");
}

w("SECTION 16 — SCHEDULES AND ANNEXES");
w("");
w("16.1 Annex A — Pricing Schedule. Bidders must complete the pricing schedule in full, itemizing subscription, implementation, training, and support costs.");
w("16.2 Annex B — Compliance Matrix. Bidders must complete the compliance matrix, cross-referencing each requirement number to the relevant section of their response.");
w("16.3 Annex C — Reference Contracts. Bidders must provide at least three reference contracts of comparable scope, with contactable references available under non-disclosure agreement.");
w("16.4 Annex D — Draft Service Level Agreement. The draft SLA sets out the performance indicators, measurement methods, and service credits that will apply.");
for (let i = 5; i <= 40; i++) {
  w(`16.${i} ${ctx(i)} ${ctx(i + 3)}`);
  w("");
}

w("END OF REQUEST FOR PROPOSAL");

const text = OUT.join("\n");
const words = text.split(/\s+/).filter(Boolean).length;
process.stderr.write(`Generated: ${totalReqs} numbered requirements, ${words} words, ~${Math.round(words / 500)} pages, ${(text.length / 1024).toFixed(1)} KB\n`);
process.stdout.write(text);
