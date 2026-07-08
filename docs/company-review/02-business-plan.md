# Propello — business plan

Prepared July 2026. Companion documents: the investor deck (`../propello-deck/propello-pitch.pptx`),
the cloud cost plan (03), the technical audit (04), and the marketing strategy (05).

---

## 1. Executive summary

Propello is AI RFP response software. When a company or government wants to buy something
expensive, it sends suppliers a long formal questionnaire (an RFP). Suppliers that answer
well and fast win the contract; suppliers that answer slowly skip bids and lose revenue.
Today that answering is done by hand: senior people spend two to three weeks per response
digging through old proposals, chasing colleagues, and retyping answers in Word.

Propello reads the RFP, extracts every question, drafts an answer for each one grounded in
the customer's own documents with a citation to the source, flags anything it cannot support
instead of guessing, routes drafts through human review, and exports a submission-ready
Word or PDF document. In a live test on a real 65-page government tender it extracted 255
requirements and drafted grounded answers in under three minutes, with zero invented answers.

- **Market:** proposal management software is a ~$3.3B market growing ~12% a year, already
  validated by funded competitors (Loopio, Responsive, AutogenAI). None of them grounds
  every answer in the customer's own documents end to end.
- **Model:** per-seat B2B SaaS ($79 / $149 / enterprise custom), landing with bid teams and
  expanding into security questionnaires and due diligence.
- **Stage:** working product (extraction, grounded drafting, review workflow, export,
  answer library, analytics), pre-revenue, targeting 20 design partners in the first
  6 months through founder-led sales.
- **Ask:** pre-seed to harden the product, run the pilot program, and convert design
  partners to annual contracts.

## 2. Mission

Free the people who win contracts from the busywork of writing them. Every claim cited,
every gap flagged, every approved answer reused.

## 3. Vision

Propello starts with RFPs because they are the most painful "big document" in B2B. The same
grounded engine answers every formal questionnaire a company faces: security reviews, vendor
assessments, due diligence questionnaires, compliance audits. The long-term vision is the
system of record for how a company answers questions about itself — a living, verified
knowledge base that turns institutional memory into won revenue.

## 4. Market analysis

### The problem in plain words

A government wants a £10M IT system. It publishes a 200-page document with 300 numbered
requirements. Five suppliers compete. Each must answer every requirement, in the buyer's
format, by a hard deadline, with evidence. The supplier's best engineers and consultants
stop billable work for two weeks to do it. Most firms respond to fewer bids than they could
win, simply because responding is too expensive.

### Market size

| Layer | Definition | Size |
|---|---|---|
| TAM | Proposal management + response software globally | ~$3.3B (2025), ~$9B+ by 2034, ~12% CAGR |
| SAM | English-language mid-market bid teams (IT consultancies, integrators, gov contractors, professional services) buying response software | ~$800M |
| SOM (3 yr) | 400 mid-market accounts at ~$15–25k ACV via founder-led + first sales team, starting in the Gulf and UK | ~$8M ARR |

Assumptions: mid-market firms responding to 20+ formal bids a year; average 8 seats at
$149/seat/month plus enterprise deals; the Gulf beachhead (Qatar, UAE, KSA) is
underserved by US-centric incumbents and is where the founder's network sits.

Adjacent markets the engine expands into: security questionnaire automation, sales
enablement content, procurement compliance — each larger than the initial wedge.

### Why now

1. **AI can finally read.** Models handle 200-page structured documents reliably enough for
   enterprise answers; this was not true two years ago.
2. **The answers already exist.** Companies sit on years of past proposals and policies,
   scattered across drives and inboxes.
3. **More bids, same teams.** Procurement keeps formalizing (especially government and
   regulated industries); bid volume rises while headcount does not.

## 5. Customer segments

| Segment | Bids/year | Pain trigger | Entry point |
|---|---|---|---|
| IT consultancies & system integrators | 20–50 | Senior consultants writing answers at billable rates | Founder network, LinkedIn |
| Government contractors | 10–40 | Disqualification risk from missed requirements | Tender portals, partners |
| Engineering & professional services | 10–30 | Every new client starts with a formal proposal | Industry associations |

**Ideal first customer:** a 20–500 person consultancy or integrator answering government
and enterprise tenders, with a bid manager (or a partner acting as one) and a folder of old
proposals. The purchase trigger is concrete and quarterly: a bid they had to skip, or a loss
blamed on a rushed response.

**Personas.** The economic buyer is the CEO, COO, or sales director — they pay to win more
bids with the same team and to reclaim expert hours. The daily users are bid managers (run
each response), consultants and engineers (approve drafts in their queue), and reviewers
(sign off with citations in view). Renewal requires both to be happy; the product serves
both.

## 6. Competitive analysis

| Competitor | What it is | Where it falls short |
|---|---|---|
| Manual process (status quo) | Word, email, SharePoint | Weeks per response; the real competitor in every deal |
| Responsive (RFPIO), Loopio | Legacy response management | Content libraries and workflow, but drafting is still largely human; AI features are bolt-ons |
| AutogenAI | AI bid writing | Generates fluent prose but is not grounded in a per-customer verified corpus with per-answer citations and explicit gap flags |
| ChatGPT / Copilot | Generic AI | No extraction of 300 requirements into tracked tasks, no grounding guarantee, no review workflow, no export pipeline; answers become legally binding commitments |
| Consultants / bid-writing agencies | Outsourced writing | $10–50k per bid, doesn't scale, knowledge leaves with them |

**Why can't customers just use ChatGPT?** Because in a bid, a confident wrong answer is a
legal and commercial liability. One invented ISO certification can void a contract. Propello's
core property — every answer cited to the customer's own documents, every gap flagged for a
human — is a workflow and trust guarantee, not a prompt. Add requirement extraction at scale,
assignment and approval tracking, template export, and a compounding answer library, and the
gap between "a chat window" and "a bid workspace" is the product.

**Moat.** Every approved answer lands in the customer's answer library. The next
questionnaire arrives largely pre-answered from vetted content. Switching costs grow with
every bid; the data moat deepens inside each account.

## 7. Product roadmap

| Horizon | Focus | Key items |
|---|---|---|
| Now → month 3 | Pilot-ready | Fix audit findings (04): email deliverability, auth hardening, job reliability; onboarding polish; template fidelity in export |
| Month 3–9 | Design-partner driven | Multi-format ingestion (Excel questionnaires, portals), answer library curation tools, reviewer SLAs and reminders, usage analytics for the buyer |
| Month 9–18 | Expansion | Security questionnaire mode, SSO/SCIM, audit log for enterprise, per-document pricing, API |
| 18+ | Platform | DDQ/compliance document types, integrations (Salesforce, SharePoint, Teams), multilingual (Arabic first — Gulf differentiator) |

## 8. Revenue model

- **Starter — $79/seat/month.** Up to 5 bids a month, extraction and grounded drafting,
  Word/PDF export. For small teams proving value.
- **Team — $149/seat/month.** Unlimited bids, review workflow, answer library, template
  export. The core plan; most customers land here.
- **Enterprise — custom.** SSO/SCIM, retention controls, dedicated onboarding, volume and
  per-document pricing.

Pricing logic: one senior consultant hour costs more than a seat-month. A single won bid
pays for years of the product. AI consumption is metered internally (documents processed)
and protected by the bids-per-month cap on Starter and fair-use terms on Team; heavy usage
is pushed to Enterprise per-document pricing so gross margin stays above 80% even with
LLM costs.

Unit economics targets: ~$15k ACV mid-market, CAC near zero in phase 1 (founder-led),
net revenue retention >110% via seat expansion and document-type expansion.

## 9. Sales strategy

**Phase 1 (months 0–6): founder-led, first 20 customers.**
1. Target list of 100 firms from the founder's consultancy/SAP presales network (Gulf + UK).
2. Warm outreach — LinkedIn plus intros; message is the proof line, not features:
   "300 questions. 3 days, not 3 weeks."
3. The demo is their own RFP processed live in 30 minutes. Nothing sells like watching your
   own tender turn into a tracked, half-answered workspace.
4. 30-day paid pilot (~$500 flat) scoped to one real bid, with onboarding of their document
   corpus included. Paid, because free pilots don't get championed.
5. Convert at 50%+ to annual Team plans; expand seats as more reviewers join.

**Phase 2 (months 6–18): repeatable motion.**
- Hire customer success at ~10 paying teams (onboarding quality is the churn lever).
- Hire the first salesperson when the founder playbook closes repeatably (~$20k MRR);
  they inherit a written motion, target list, and case studies.
- Channel: partnerships with bid-writing consultancies and tender-portal providers who
  see the demand daily.

## 10. Marketing strategy (summary — full plan in 05)

Positioning: **the grounded one.** Propello never guesses; it cites or it flags. All content
flows from that claim plus the proof numbers. Founder-led LinkedIn (3 posts/week from the
30-post bank in doc 05), case studies from every design partner, SEO/AI-SEO landing page
(already structured with FAQ + JSON-LD), and later narrow paid search on high-intent
keywords ("RFP response software", "AI bid writing"). No paid ads before 10 reference
customers.

## 11. Operations

- **Team today:** founder (product + sales) with a working full-stack build; contributors
  listed on the team slide to be confirmed with roles.
- **Infrastructure:** serverless (Vercel + Supabase + LLM APIs) — near-zero fixed cost,
  scales by configuration; see doc 03. No DevOps hire needed before ~100 customers.
- **Support:** founder + CS hire handle onboarding; in-app docs and email support.
  Enterprise gets a named contact.
- **Legal/compliance:** standard SaaS DPA, data residency answer prepared (customers will
  ask — it's in their questionnaires), SOC 2 readiness deferred until enterprise deals
  require it (typically month 12+).

## 12. Hiring plan

| Trigger | Hire | Why |
|---|---|---|
| 10 paying teams | Customer success | Onboarding and KB setup is the make-or-break moment |
| ~$20k MRR | Account executive | Founder playbook is repeatable; founder moves to bigger deals |
| Roadmap load | Full-stack engineer | Ship expansion features; founder stops being the only committer |
| ~$50k MRR | Second engineer + part-time finance | Reliability, SOC 2 groundwork |

No hires precede their trigger. Target: 5–6 people at the end of year 1.

## 13. Financial forecast (base case)

| | Month 6 | Month 12 | Month 24 |
|---|---|---|---|
| Paying customers | 10 (of 20 pilots) | 25 | 80 |
| Avg seats × price | 6 × $149 | 7 × $149 | 8 × $160 blended |
| MRR | ~$9k | ~$26k | ~$100k |
| ARR | ~$107k | ~$310k | ~$1.2M |
| Infra + AI cost / mo | <$500 | ~$1.5k | ~$6k |
| Team cost / mo | founder | ~$25k (4 ppl) | ~$60k (7 ppl) |

Gross margin stays >80% because LLM cost per processed document (cents to low dollars) is
tiny against seat revenue, and heavy processors are moved to per-document pricing.
Break-even on operating cash is achievable around month 20–22 without further raise;
the pre-seed buys speed, not survival.

Sensitivity: the plan's fragile assumption is pilot→paid conversion (50%). At 30%, month-12
ARR is ~$190k and the sales hire slips a quarter; the model still works because CAC is
near zero.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Incumbents ship grounding | Move fast in the wedge; the per-account answer library is the defensible layer, not the model |
| LLM cost or quality shifts | Provider-agnostic pipeline (already abstracted); grounding reduces dependence on frontier reasoning |
| Enterprise trust bar | Citations + gap flags are the product's answer; SOC 2 when deals demand it |
| Founder bandwidth | Hiring triggers are pre-committed; phase 1 deliberately caps at 20 accounts |
| Hallucination incident at a customer | The pipeline's "cite or flag" contract, plus the UAT suite in doc 04, is the guardrail — this is why the audit matters commercially |
