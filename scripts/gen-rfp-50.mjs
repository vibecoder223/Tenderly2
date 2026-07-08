#!/usr/bin/env node
// Generates a 50-requirement RFP for UAT (procurement platform, 6 sections).
const SECTIONS = [
  ["3", "SECURITY REQUIREMENTS", [
    "The vendor MUST hold a current ISO/IEC 27001 certification; provide certificate number, scope, and validity period.",
    "The vendor MUST provide evidence of an independent SOC 2 Type II audit completed within the last 12 months.",
    "Describe encryption standards applied at rest and in transit, including key management and customer-managed key support.",
    "The solution MUST support single sign-on via SAML 2.0 or OIDC integrated with the Authority's Azure Active Directory.",
    "Describe the role-based access control model, including custom roles, field-level permissions, and audit logging.",
    "Describe your penetration testing regime, frequency, and remediation timelines by severity.",
    "Confirm whether multi-factor authentication is enforced for all privileged accounts.",
    "Describe your security incident response plan and customer notification timelines.",
    "Confirm IP allowlisting and configurable session policies are supported per workspace.",
  ]],
  ["4", "DATA GOVERNANCE REQUIREMENTS", [
    "All Authority data MUST reside within the State of Qatar or, subject to approval, within the GCC. Specify hosting regions and residency guarantees.",
    "Confirm compliance with Qatar Law No. 13 of 2016 on Personal Data Privacy Protection and describe your data protection governance.",
    "Describe backup and disaster recovery capabilities, including RPO and RTO commitments and testing frequency.",
    "Confirm whether an on-premises or sovereign deployment option is available for classified workloads.",
    "Describe sub-processor disclosure practices and the notice period before any sub-processor change.",
    "Confirm data retention, export, and deletion practices upon contract termination.",
    "Confirm whether a Data Protection Officer is appointed and describe their reporting line.",
    "Describe how data subject requests (access, erasure, portability) are fulfilled and within what timeframe.",
  ]],
  ["5", "TECHNICAL REQUIREMENTS", [
    "The solution MUST provide a documented REST API for integration with the Authority's existing systems.",
    "Describe available native integrations, specifically with Microsoft 365 and SharePoint.",
    "The solution MUST support automated user provisioning and deprovisioning via SCIM.",
    "Describe the platform's uptime commitment and the service credit regime applicable to SLA breaches.",
    "Describe the system architecture's approach to high availability, failover, and horizontal scalability.",
    "Confirm whether the platform supports Arabic-language data entry, search, and reporting.",
    "Describe your approach to accessibility compliance (WCAG 2.1 AA or equivalent).",
    "Describe your approach to mobile access, including native apps versus responsive web.",
    "Confirm API rate limits and describe how the platform scales under peak concurrent load.",
    "Describe webhook support for real-time event notifications to external systems.",
  ]],
  ["6", "FUNCTIONAL REQUIREMENTS", [
    "The solution MUST support AI-assisted extraction of requirements from uploaded RFP documents.",
    "Describe how drafted responses are grounded in an approved knowledge base with citations.",
    "Describe the review and approval workflow, including multi-stage approval gates.",
    "Confirm whether the platform supports reusable answer libraries that improve over time.",
    "Describe reporting and dashboard capabilities available to leadership for real-time visibility.",
    "Describe search and retrieval capabilities across historical proposals and responses.",
    "Confirm whether the solution supports export to Word and PDF formats with customer templates.",
    "Describe version control and change-history tracking for responses within the platform.",
  ]],
  ["7", "IMPLEMENTATION AND SUPPORT REQUIREMENTS", [
    "Describe your implementation methodology, typical timeline for a 300-user deployment, and the project team assigned.",
    "Describe the training approach, including Arabic-language materials and post-go-live adoption tracking.",
    "Describe your support tiers, response times for priority-1 incidents, and escalation procedures.",
    "Provide details of at least three comparable reference implementations, preferably within the GCC region.",
    "Confirm the availability of a dedicated technical account manager for the duration of the contract.",
    "Describe your data migration approach from the Authority's legacy system.",
    "Describe your approach to knowledge transfer and reducing dependency on vendor personnel.",
    "Confirm warranty period post go-live and what is covered during that period.",
  ]],
  ["8", "COMMERCIAL REQUIREMENTS", [
    "Provide your pricing model, including subscription tiers, implementation fees, and volume or multi-year discounts for a 300-user deployment.",
    "Confirm the company's financial standing, years in operation, and total staff dedicated to delivery.",
    "Confirm professional indemnity and cyber liability insurance coverage levels.",
    "Confirm whether performance bonds or bank guarantees can be provided as required by procurement regulations.",
    "Describe any early-termination provisions and associated costs.",
    "Confirm standard payment terms and whether contract governance under Qatari law is available.",
    "Describe your approach to price stability or escalation clauses over a multi-year term.",
  ]],
];

const lines = [];
lines.push("REQUEST FOR PROPOSAL — PROPOSAL AUTOMATION PLATFORM");
lines.push("RFP Reference: QG-2026-207 | Issued: July 2026 | Issuing Entity: The Authority");
lines.push("");
lines.push("SECTION 1 — INTRODUCTION");
lines.push("The Authority invites proposals from qualified vendors for the supply, implementation, and support of an enterprise proposal automation platform. Vendors must respond to every requirement in Sections 3 through 8, indicating full compliance, partial compliance, or non-compliance, with supporting evidence.");
lines.push("");
lines.push("SECTION 2 — BACKGROUND");
lines.push("The Authority processes approximately 400 tenders annually across 12 departments. The current process is manual, and the Authority seeks a platform to automate document analysis, response drafting, and compliance tracking.");
lines.push("");
let n = 0;
for (const [id, title, items] of SECTIONS) {
  lines.push(`SECTION ${id} — ${title}`);
  items.forEach((t, i) => { n++; lines.push(`${id}.${i + 1} ${t}`); });
  lines.push("");
}
lines.push("END OF RFP");
const text = lines.join("\n");
process.stdout.write(text);
console.error(`\nGenerated ${n} requirements, ${(text.length / 1024).toFixed(1)} KB`);
