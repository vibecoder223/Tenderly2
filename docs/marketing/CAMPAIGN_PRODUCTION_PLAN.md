# Klovered — campaign production plan (05–10)

How the remaining campaigns get built. Companion to
[CAMPAIGN_VISUAL_PLAN.md](CAMPAIGN_VISUAL_PLAN.md) (visual treatment) and
[CONTENT_CALENDAR_10.md](CONTENT_CALENDAR_10.md) (copy). Where the two disagree,
**the visual plan wins** — screens stay rare, each campaign looks distinct.

Everything is code. No image assets. Each campaign is a `build-cNN.mjs` that
renders 1080×1350 (4:5) HTML slides via headless Edge and packs a `.pptx`,
inheriting `../klovered-deck/deck.css` + `fonts.css`. Model each on the existing
`build-c01.mjs` … `build-c04.mjs`.

---

## Component inventory

**Built and reusable** (from C01–C04):
`vUpload` · `vExtract` · `vSemantic` · `vDraft` (cited answer box) · `vExport` ·
`vFlag` (cited-vs-flagged card).

**New for 05–10 — two components, one treatment, one re-theme:**

| New | For | Shows |
|---|---|---|
| `vLibrary` | 06 | Reusable answer library rows with `reused · N bids` green count chips |
| `vReview` | 09 | Grounded badge + confidence bar + **Approve** button (the one screen the visual plan flagged unbuilt) |
| `vFlagHero` *(treatment)* | 09 | The amber `no source · needs a human` chip blown up huge and centered — reuses `vFlag` badge styles at scale |
| `vExtract` re-theme | 08 | Existing component, new data: a 300-row security questionnaire |

C05 is a **rebuild**: the old Monday `build-carousel.mjs` is this campaign but at
square 1080×1080 / 8 slides. Rebuild to 4:5 / 7 slides.

---

## Slide-by-slide (bg · headline · visual)

### 05 — The bids you didn't enter · text-only · 7 slides · *rebuild square→4:5*
1. ink — "Your biggest competitor is the bid you didn't enter." — text
2. canvas — "You qualified. You just couldn't answer 200 questions in time." — text
3. canvas — "Nobody logs a skipped bid. No report shows it." — text
4. ink — "It's revenue you decided to lose. Silently." — text
5. panel — "One won bid pays for years of it." — big-number typography
6. canvas — "Answer in days, and enter every bid worth winning." — text
7. green — CTA: "How many did you skip last quarter?" — text

### 06 — Copied, not written · 1 screen · 6 slides
1. ink — "The average proposal isn't written. It's copied." — text
2. canvas — "That's not lazy. You've answered this 50 times." — text
3. ink — "Copying isn't the problem. Copying badly is." — text
4. canvas — "Approved once, reused everywhere." — **vLibrary** *(new)*
5. ink — "Every bid gets faster than the last." — text
6. green — CTA: "What have you rewritten the most?" — text

### 07 — Page 140 · text-only · 6 slides
1. ink — "The requirement that loses the bid is never on page 1." — text
2. canvas — "It's on page 140. In a table. Phrased as a statement." — text; *page 140* green accent + mono kicker `PAGE 140 · BURIED IN A TABLE` (no oversized numeral)
3. ink — "Miss it: disqualified. Three weeks wasted." — text
4. canvas — "Humans get tired on page 140. Machines don't." — text
5. panel — "Every requirement extracted. Nothing hides." — big "255" stat typography
6. green — CTA: "Worst place you've found a hidden requirement?" — text

### 08 — The questionnaire that stalls the deal · 1 screen · 7 slides
1. ink — "The deal was done. Then the questionnaire arrived." — text
2. canvas — "300 rows. Close date plus one month." — text
3. ink — "Sales blames security. Security blames sales." — text
4. canvas — "But you've answered 90% of it before." — text
5. ink — "Answered from your library, cited and current." — **vExtract** re-themed to a 300-row security questionnaire
6. canvas — "A month becomes a day." — text
7. green — CTA: "Longest a questionnaire delayed your close?" — text

### 09 — The refusal · product-led · 6 slides
1. ink — "We taught our AI to say 'I don't know'." — text
2. canvas — "No source in your documents? It refuses to draft." — **vFlag**
3. ink — "Awkward in demos. Essential in bids." — **vFlagHero** *(treatment)*
4. canvas — "When it is grounded, it shows its work." — **vReview** *(new)*
5. ink — "Cited, or flagged. Nothing in between." — **vFlag** (reprise)
6. green — CTA: "Should AI ever guess in a legal document?" — text

### 10 — Why I'm building this · text-only · 7 slides
1. ink — "They skipped a bid worth more than their year." — text
2. canvas — "180 questions. Two weeks. Their experts billed out." — text
3. ink — "So they passed. Quietly." — text
4. canvas — "The answers already existed. Trapped in old proposals." — text
5. ink — "So we built the un-trapping." — text
6. canvas — "Building in the open from here." — text
7. green — CTA: "The most winnable bid you ever skipped?" — text

---

## Totals

- 6 campaigns, **39 slides**; only **9 carry a UI vignette**, the other 30 are
  typography — screens remain the minority, by design.
- New work: 2 components (`vLibrary`, `vReview`), 1 chip treatment (`vFlagHero`),
  1 `vExtract` re-theme, and C05 rebuilt square→4:5.

## Build order

Text-only first (fast, no new components): **05 → 07 → 10** →
then **06** (`vLibrary`) → **08** (`vExtract` re-theme) →
**09** (`vReview` + `vFlagHero`, the heaviest).

## Output per campaign

`build-cNN.mjs` → `slides-cNN/` (HTML) + `render-cNN/` (PNG) + `campaign-NN-*.pptx`.
Post to LinkedIn as a document (upload the `.pptx`) or as an image carousel
(the PNGs in order).
