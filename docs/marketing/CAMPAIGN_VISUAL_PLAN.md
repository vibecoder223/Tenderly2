# Klovered — campaign visual plan (all 10, slide by slide)

Decides the visual treatment of every slide before it's built. Two rules:

1. **Text-only is the default.** A screenshot only appears when it *is* the
   proof of that slide's point. Most slides are bold typography.
2. **Each screen is used sparingly** (max two campaigns). No two campaigns look
   alike.

Companion: [CONTENT_CALENDAR_10.md](CONTENT_CALENDAR_10.md) (copy) ·
[LINKEDIN_CAMPAIGN_GUIDELINES.md](LINKEDIN_CAMPAIGN_GUIDELINES.md) (system).

Backgrounds: **ink** (dark statement) · **canvas** (light) · **panel** (tinted) ·
**green** (CTA). Product screens render as a white browser frame, so they read
the same on any background.

---

## The screen library (real Klovered UI)

| Screen | Shows | Used in |
|---|---|---|
| `vUpload` | Dropzone, file, parsing progress | 01 |
| `vExtract` | Requirements → tracked questions with statuses | 01, 08 |
| `vSemantic` | Question matched to your documents + relevance scores | 01, 02 |
| `vDraft` | Grounded answer + cited source | 01, 09 |
| `vExport` | Approved rows → Word / PDF / template | 01 |
| `vFlag` | No-source refusal (flagged for a human) | 04, 09 |
| `vLibrary` | Reusable answer library + reuse counts | 06 |
| `vReview` | Grounded badge + confidence bar + Approve | 09 |
| `vQueue` | "My queue" — assigned questions, reviewer, status | 11 |

Text-only campaigns: **03, 05, 07, 10.** One-screen: **02, 04, 06, 08, 11.**
Product-led: **01, 09.**

---

## 01 — The 3-minute reveal · product-led · 8 slides
1. [ink] The reveal — "200 pages in. 3 minutes later." — *text*
2. [canvas] Step one: upload — "Upload the RFP. Any format." — **vUpload**
3. [ink] Step two: extract — "Every requirement, a tracked question." — **vExtract**
4. [canvas] Step three: understand — "Matched to the right source." — **vSemantic**
5. [ink] Step four: draft — "Grounded and cited." — **vDraft**
6. [canvas] Step five: export — "Approve, then export." — **vExport**
7. [ink] The difference — "3 minutes vs 3 weeks." — *text*
8. [green] See it on yours — CTA — *text*

## 02 — You already have the answer · 1 screen · 6 slides
1. [ink] The trap — "You already wrote the perfect answer. You can't find it." — *text*
2. [canvas] Where it lives — "A 2023 proposal. An email. Someone's laptop." — *text*
3. [canvas] The tax — "So you write it again. Slightly worse." — *text*
4. [ink] The real problem — "It was never writing. It's retrieval." — *text*
5. [canvas] The fix — "It finds your own answer in seconds." — **vSemantic**
6. [green] Your turn — "Where do your best answers live today?" — *text*

## 03 — The two firms · text-only · 8 slides
1. [ink] A story — "Two firms. Same RFP. Same Monday." — *text*
2. [canvas] Firm A — "Three senior people. Three weeks." — *text*
3. [ink] Firm B — "Uploaded it. Drafted in minutes." — *text*
4. [canvas] Firm A — "Wrote from scratch, for days." — *text*
5. [ink] Firm B — "Reviewed for one afternoon." — *text*
6. [canvas] The result — "Both submitted on time." — *text*
7. [ink] The twist — "But Firm B entered two more bids. Firm A said no." — *text*
8. [green] Your turn — "Which firm is yours?" — *text*

## 04 — The confident lie · 1 screen · 6 slides
1. [ink] The risk — "AI wrote your bid. One answer is a lie." — *text*
2. [canvas] The confidence — "Fluent. Certain. Promised an SLA you don't offer." — *text*
3. [ink] The stakes — "A guess becomes a contract." — *text*
4. [canvas] The bar — "Not 'sounds right'. 'Show me the source'." — *text*
5. [canvas] The difference — "When it can't back it up, it flags a human." — **vFlag**
6. [green] Your turn — "Certain, or checkable?" — *text*

## 05 — The bids you didn't enter · text-only · 7 slides
1. [ink] Hook — "Your biggest competitor is the bid you didn't enter." — *text*
2. [canvas] "You qualified. You couldn't answer 200 questions in time." — *text*
3. [canvas] "Nobody logs a skipped bid. No report shows it." — *text*
4. [ink] "It's revenue you decided to lose. Silently." — *text*
5. [panel] The math — "One won bid pays for years of it." — *text (big number)*
6. [canvas] "Answer in days, and enter every bid worth winning." — *text*
7. [green] Your turn — "How many did you skip last quarter?" — *text*

## 06 — Copied, not written · 1 screen · 6 slides
1. [ink] Hook — "The average proposal isn't written. It's copied." — *text*
2. [canvas] "That's not lazy. You've answered this 50 times." — *text*
3. [ink] "Copying isn't the problem. Copying badly is." — *text*
4. [canvas] The fix — "Approved once, reused everywhere." — **vLibrary**
5. [ink] "Every bid gets faster than the last." — *text*
6. [green] Your turn — "What have you rewritten the most?" — *text*

## 07 — Page 140 · text-only · 6 slides
1. [ink] Hook — "The requirement that loses the bid is never on page 1." — *text*
2. [canvas] "It's on page 140. In a table. Phrased as a statement." — *text*
3. [ink] "Miss it: disqualified. Three weeks wasted." — *text*
4. [canvas] "Humans get tired on page 140. Machines don't." — *text*
5. [panel] "Every requirement extracted. Nothing hides." — *text*
6. [green] Your turn — "Worst place you've found a hidden requirement?" — *text*

## 08 — The questionnaire that stalls the deal · 1 screen · 7 slides
1. [ink] Hook — "The deal was done. Then the questionnaire arrived." — *text*
2. [canvas] "300 rows. Close date plus one month." — *text*
3. [ink] "Sales blames security. Security blames sales." — *text*
4. [canvas] "But you've answered 90% of it before." — *text*
5. [ink] The fix — "Answered from your library, cited and current." — **vExtract**
6. [canvas] "A month becomes a day." — *text*
7. [green] Your turn — "Longest a questionnaire delayed your close?" — *text*

## 09 — The refusal (behind the product) · product-led · 6 slides
1. [ink] Hook — "We taught our AI to say 'I don't know'." — *text*
2. [canvas] "No source in your documents? It refuses to draft." — **vFlag**
3. [ink] "Awkward in demos. Essential in bids. Your name goes on it." — *text*
4. [canvas] "When it is grounded, it shows its work." — **vReview**
5. [ink] "Cited, or flagged. Nothing in between." — *text*
6. [green] Your turn — "Should AI ever guess in a legal document?" — *text*

## 11 — Your experts, not a bottleneck · 1 screen · 7 slides
*(the team / collaboration story)*
1. [ink] Team — "One person can't answer 300 questions. Your team can." — *text*
2. [canvas] The old way — "The bid manager becomes the bottleneck, chasing by email." — *text*
3. [ink] Assign — "Each question routed to the person who owns it." — *text*
4. [canvas] Review — "Experts approve in their own queue. Minutes, not weekends." — **vQueue**
5. [ink] No chaos — "One thread per question. No lost email chains." — *text*
6. [canvas] The gate — "Nothing ships without a human sign-off." — *text*
7. [green] Your turn — "How does your team split a 300-question bid today?" — *text*

## 10 — Why I'm building this · text-only · 7 slides
1. [ink] Hook — "They skipped a bid worth more than their year." — *text*
2. [canvas] "180 questions. Two weeks. Their experts billed out." — *text*
3. [ink] "So they passed. Quietly." — *text*
4. [canvas] "The answers already existed. Trapped in old proposals." — *text*
5. [ink] "So we built the un-trapping." — *text*
6. [canvas] "Building in the open from here." — *text*
7. [green] Your turn — "The most winnable bid you ever skipped?" — *text*

---

## Tally (variety check)

- **26 of ~66 slides** carry a screen; the rest are typography. Screens are the
  minority, by design.
- Every screen appears in **one or two** campaigns, never as the recycled
  default.
- `vReview` (grounded + confidence + Approve) is the only screen not yet built —
  add it when Campaign 09 is produced.

Build order suggestion: 01 (done) → 04 (done) → 02 → 06 → 08 → 09, interleaving
the text-only ones (03 done, 05, 07, 10) which are fast.
