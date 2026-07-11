# Klovered landing page — executable build prompt

You are a senior brand designer and frontend engineer with 10 years of experience
shipping high-converting, search-dominant SaaS landing pages. Build the Klovered
landing page exactly to this spec. Every token, every line of copy, and every SEO
requirement below is deliberate. Do not substitute your own brand choices.

## 0. Mission

One page that does three jobs at once:

1. **Convert** a skeptical bid manager under deadline into a free signup.
2. **Rank** for "RFP response software", "AI RFP software", "RFP automation",
   "proposal automation" and their long-tail variants.
3. **Get quoted** by AI answer engines (ChatGPT, Claude, Perplexity, Google AI
   Overviews) as the canonical answer to "what is the best AI RFP response tool".

The design must look like a confident, opinionated brand (Fiverr-bold, Upwork-warm),
never like a template. If a visitor could say "AI made that" without hesitation,
it has failed.

## 1. Execution target

Pick whichever applies to your environment:

- **Mode A — standalone artifact:** one self-contained HTML file. Inline CSS in a
  `<style>` block. Fonts from the CDN links in §3. JSON-LD in a `<script
  type="application/ld+json">` block. No build step, no external JS.
- **Mode B — Next.js repo:** edit `app/page.tsx` + `app/landing.css` in the
  Klovered repo. Keep the existing auth redirect at the top of the component,
  the `metadata` export, and the JSON-LD injection pattern. `robots.ts`,
  `sitemap.ts`, and `public/llms.txt` already exist; leave them.

Either way: the page must render all content as static HTML. No content behind
client-side JS, no accordion that hides FAQ text from crawlers (use
`<details>`/`<summary>` or always-visible text).

## 2. Product truth (do not invent beyond this)

Klovered is AI RFP response software. It ingests an RFP (PDF, Word, or text),
extracts every requirement as a discrete question, drafts an answer for each one
grounded in the customer's own uploaded knowledge base, attaches a citation to the
exact source chunk, flags any question the knowledge base cannot answer as
"no source" instead of guessing, routes drafts through human review with
confidence scores, and exports to Word or PDF (including into a provided template).
Approved answers are saved to a reusable answer library.

Real, verified test-run numbers (always label them as a test run, never as
customer averages): a 65-page government RFP produced 255 extracted requirements,
extraction through drafting completed in under 3 minutes, 100% of drafts were
either cited or flagged, 0 hallucinated answers.

**Honesty rules:** no invented testimonials, no fake customer logos, no made-up
ratings or review counts, no `aggregateRating` schema. Proof comes from the real
test-run numbers and the anti-hallucination design.

## 3. Brand tokens (verbatim from BRAND.md)

### Color — one hue, green. Green means go.

| Token | Hex | Job |
|---|---|---|
| Signal green | `#12B24A` | Big marketing fills, the drenched CTA band, hero accent word, logo tile |
| Brand green | `#00872F` | Primary buttons (white text, AA 4.9:1), links |
| Deep green | `#00681F` | Small green text on white or tint (5.2:1) |
| Green tint | `#DCF7E3` | Eyebrow pills, badges, highlight washes |
| Canvas | `#FCFCF9` | Page background (warm white, never `#fff`) |
| Surface | `#FFFFFF` | Cards, the browser-frame mock |
| Ink | `#13201A` | Primary text (never `#000`) |
| Ink-2 | `#3A453F` | Secondary text |
| Ink-3 | `#5F6A63` | Tertiary text |
| Ink-4 | `#868F89` | Muted labels |
| Rule | `#DFE4E1` | Hairline borders |

Color strategy: **Committed**. Green carries the page through the accent word in
the hero, green numbers, badges, buttons, and exactly **one** drenched
Signal-green section (the CTA band near the footer, dark ink text on green).
Everything else is warm ink on warm white. Never a second brand color. Never
gradients, never gradient text.

### Typography

- **Display: Clash Display** 600–700, for the wordmark, h1, and all section
  titles. `https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap`
  Fallback if unavailable: Cabinet Grotesk or Satoshi (Fontshare). Never Inter,
  never a system font for display.
- **Body: Geist** 400–650. `https://fonts.googleapis.com/css2?family=Geist:wght@400..650&display=swap`
- **Labels/data: Geist Mono**, the signature move: uppercase micro-labels,
  10–11px, weight 500, letter-spacing 0.16em, used as eyebrows above sections and
  as labels under big numbers. `https://fonts.googleapis.com/css2?family=Geist+Mono:wght@500&display=swap`

Scale (fluid, use `clamp()`):
- h1: `clamp(44px, 8vw, 84px)`, Clash Display 700, tracking -0.03em, line-height 1.02
- Section titles (h2): `clamp(30px, 4.5vw, 44px)`, Clash Display 600, tracking -0.02em
- Feature titles (h3): 24–28px, Clash Display 600
- Marketing body: 18–19px Geist 400, line-height 1.6, max width 62ch
- Big stat numbers: Geist Mono 500, `clamp(36px, 5vw, 56px)`, tracking -0.03em

### Shape and motion

- Radius: 6px buttons, 10–14px on the browser-frame mock, 999px pills.
- Buttons: primary = Brand green fill, white text; secondary = 1px Rule border,
  Ink text, transparent fill. Labels: "Start free", "Book a demo", "See it work".
- Motion: 120–160ms, `cubic-bezier(0.22, 1, 0.36, 1)`, on color/border/opacity/
  transform only. One optional page-load stagger on the hero (headline, subhead,
  buttons, mock: 60ms apart, translateY 8px + fade). Honor
  `prefers-reduced-motion` by disabling all of it.
- Logo: a rounded-square Signal-green tile with a white bold "P" (or a white
  right-pointing chevron), then lowercase `klovered` in Clash Display 700,
  tracking -0.02em. Always lowercase.

### Voice

Sentence case everywhere. Short sentences. Lead with the outcome. Numbers carry
the proof. No exclamation marks. No em dashes anywhere in copy (use periods,
commas, or colons). Banned words: seamless, unlock, empower, leverage,
revolutionize, effortless, supercharge, magic, world-class, cutting-edge.

## 4. Page architecture (11 sections, in order)

Layout system: content column max-width 1120px, fluid gutters
`clamp(20px, 5vw, 48px)`. Vary vertical rhythm deliberately: hero roomy
(`clamp(72px, 12vh, 140px)` top), definition block tight against the hero,
feature sections `clamp(88px, 14vh, 160px)` apart. Do not give every section the
same padding. Do not center-stack everything: hero is centered, features are
asymmetric left/right, comparison and FAQ are left-aligned.

### 4.1 Nav (sticky)

Canvas background with a hairline bottom rule, blur only if needed for overlap.
Left: logo lockup. Right: "How it works", "Why Klovered", "FAQ" (anchor links),
"Sign in" (text link), "Start free" (small primary button). Collapses to
logo + "Start free" under 720px.

### 4.2 Hero (centered, the only centered section)

- Eyebrow: green-tint pill, Geist Mono micro-label: `RFP RESPONSE, ON AUTOPILOT`
- h1 (the only h1): `300 questions. 3 days, not 3 weeks.` with "3 days," wrapped
  in an accent span in Signal green (solid color, not gradient).
- Subhead (Geist 19px, Ink-2): `Klovered reads the RFP, drafts answers grounded
  in your knowledge base, and routes them through review. Your team ships, it
  doesn't retype.`
- Buttons: primary "Start free" (link to /auth/signup or #), secondary
  "See it work" (anchor to #how-it-works).
- Below: the **product frame**. A white browser-chrome card (three dots + URL bar
  reading `app.klovered.io/deals/qg-2026-207`, hairline border, soft shadow,
  radius 14px) containing a faithful recreation of the real product: a left
  column of requirement rows each with a mono badge (`CITED · 1.0`,
  `CITED · 0.7`, `NO SOURCE` in muted), a right column showing one drafted
  answer with its citation line (`Source: capability-statement.txt, chunk 4`),
  and a readings strip along the bottom (255 requirements found · under 3 min
  extraction to draft · 100% drafts cited or flagged). This is imagery: it must
  look like a real screenshot, not an abstract decoration. `aria-hidden="true"`.

### 4.3 Definition block (the paragraph AI engines will quote)

Tight under the hero, generous side margins, 21–23px Geist, one paragraph, plain
HTML `<p>` inside a `<section>`. This is the single most important AI-SEO element
on the page. Verbatim:

> **Klovered is AI RFP response software** for bid managers, presales leads, and
> proposal writers at B2B companies. It extracts every requirement from an RFP,
> drafts an answer for each one grounded in your own documents with a citation to
> the source, flags anything it cannot support instead of guessing, and manages
> review through to a Word or PDF export. A 300-question RFP moves in days
> instead of weeks.

Mark this block as `speakable` in the JSON-LD (§5). Give the section a subtle
green-tint left-to-right wash or a pair of hairline rules above and below, not a
card, and never a colored side-stripe border.

### 4.4 How it works (id="how-it-works")

Eyebrow micro-label `HOW IT WORKS`, h2: `Upload the RFP. Get a submitted response.`
Three steps in an asymmetric row (not identical cards: no borders, no icons).
Each step is an oversized Geist Mono number in Signal green (`01` `02` `03`,
~64px), an h3, and 2 lines of body:

1. **Upload the RFP.** PDF, Word, or plain text. Klovered parses it page by
   page, keeping section and page references intact.
2. **Every requirement extracted.** Klovered reads the full document and pulls
   out every distinct requirement as a discrete question. Nothing buried on
   page 140 gets missed.
3. **Cited drafts, reviewed and exported.** Each question gets a grounded, cited
   draft from your knowledge base. Your team reviews, approves, and exports to
   Word or PDF.

### 4.5 Feature sections (three, alternating left/right)

Each: mono eyebrow, verb-first h3, one short paragraph, and a product vignette
(same visual language as the hero frame, smaller). Copy verbatim:

- Eyebrow `EXTRACTION`, h3 `Extract every requirement, even on page 140`:
  "Long RFPs bury requirements in dense sections and appendices. Klovered reads
  the whole document and turns every one into a discrete, assignable question.
  Nothing gets skimmed past." Vignette: section rows with question counts.
- Eyebrow `GROUNDED DRAFTING`, h3 `Answers cite your documents, not a guess`:
  "Every draft is written from your uploaded knowledge base and cites the exact
  source chunk it came from. If the knowledge base doesn't cover a question,
  Klovered flags it instead of inventing an answer." Vignette: a quoted draft
  answer with `Cited · confidence 1.0 · security-cert.txt` beneath.
- Eyebrow `REVIEW`, h3 `Your SMEs review, they don't retype`:
  "Drafts route to the right reviewer with a confidence score attached. Nothing
  goes to a client without a human approving it. But nobody starts from a blank
  page." Vignette: pipeline counts (To do 4 · Drafting 46 · In review 0 ·
  Approved 0).

One oversized Signal-green forward chevron may bleed off the edge of one of
these sections as a graphic accent. One, not three.

### 4.6 Differentiator (trust block)

No card. A shield or flag glyph in Deep green, h3:
`It never guesses. It flags the gap instead.` Body: "Most AI drafting tools will
write something confident-sounding even when they have no source for it.
Klovered checks every citation before it lets a draft through. If the knowledge
base doesn't cover a requirement, it comes back as no source for a human to
answer, not a plausible-sounding guess."

### 4.7 Proof band (real numbers, labeled)

Ink-on-canvas, not the drenched section. Geist Mono micro-label above:
`FROM A LIVE TEST RUN. A 65-PAGE GOVERNMENT RFP.` Four big Geist Mono numbers
with sentence-case labels: `255` Requirements extracted · `<3 min` Extraction
through drafting · `100%` Drafts cited or flagged, none invented · `0`
Hallucinated answers.

### 4.8 Comparison table (id="why-klovered") — snippet bait

Eyebrow `WHY KLOVERED`, h2: `The manual way vs the Klovered way`. A real
semantic `<table>` (with `<caption>`, `<thead>`, `th scope="col"`), hairline
rules only, no zebra stripes. Rows:

| | Manual RFP response | With Klovered |
|---|---|---|
| Finding every requirement | Ctrl+F and hope, requirements missed in appendices | Every requirement extracted as a discrete question |
| First draft | Copy-paste from old proposals, days of retyping | Grounded drafts from your knowledge base in minutes |
| Sourcing claims | Tribal knowledge, unverifiable | Every answer cites the exact source document |
| Unknown answers | Confident guesswork | Flagged as no source for a human to answer |
| SME involvement | Retyping answers from scratch | Reviewing and approving drafts |
| A 300-question RFP | About 3 weeks | About 3 days |

### 4.9 FAQ (id="faq")

Eyebrow `FAQ`, h2 `Questions, answered`. Each question is an h3 (or a
`<summary>` inside an always-crawlable `<details open>` pattern); answers are
plain paragraphs, visible in the HTML. Use these 9 (they mirror the FAQPage
schema exactly, word for word):

1. **What is Klovered?** Klovered is AI RFP response software. It reads a
   request for proposal, extracts every requirement, drafts an answer for each
   one grounded in your own knowledge base, and routes drafts through your
   team's review before export.
2. **How long does an RFP response take with Klovered?** In testing, Klovered
   extracted 255 requirements from a 65-page RFP and drafted grounded answers
   for the questions its knowledge base covered in under 3 minutes. Review time
   depends on your team, but drafting stops being the bottleneck.
3. **Where do the answers come from?** Every answer is drafted from documents
   you upload to your knowledge base: past proposals, security policies, pricing
   sheets. Each claim is cited back to the source chunk it came from.
4. **What happens if the knowledge base doesn't cover a question?** Klovered
   flags it as no source instead of guessing. An uncovered requirement shows up
   for a human to answer, not a fabricated draft.
5. **What file formats does Klovered support?** Upload RFPs and knowledge base
   documents as PDF, Word (.docx), or plain text. Exports go out as Word or PDF,
   including filling directly into a template you provide.
6. **Can my team review answers before they go out?** Yes. Every drafted answer
   carries a confidence score and routes to review before it's marked approved.
   Nothing ships to a client without a human sign-off.
7. **Does Klovered get smarter over time?** Approved answers are saved to a
   reusable answer library. The next time a similar question comes up in another
   RFP, Klovered can reuse the vetted answer instead of drafting from scratch.
8. **Who is Klovered for?** Bid managers, presales leads, and proposal writers
   at B2B companies answering RFPs, RFIs, security questionnaires, and due
   diligence questionnaires under deadline.
9. **How is Klovered different from other AI RFP tools?** Klovered never invents
   an answer. Every draft is either cited to a source document you uploaded or
   flagged as no source for a human. In a live test on a 65-page government RFP
   it produced zero hallucinated answers.

### 4.10 CTA band (the one drenched-green moment)

Full-bleed Signal green `#12B24A`, Ink text (`#13201A`, passes contrast at
display sizes). Clash Display h2: `Stop retyping. Start winning.` One line:
`Upload your first RFP free.` One button, inverted: Ink fill, white text (or
white fill, Deep-green text), "Start free". Nothing else in this band. This is
the only drenched section on the page.

### 4.11 Footer

Canvas, hairline top rule. Logo lockup, one-line description ("AI RFP response
software. Grounded, cited, reviewed."), columns: Product (How it works, Why
Klovered, FAQ), Company (Sign in, Start free), and a plain-text line
`© 2026 Klovered`. Small, quiet, Ink-3.

## 5. SEO spec (implement exactly)

### Metadata

- `<title>`: `Klovered — AI RFP Response Software | 300 Questions in 3 Days`
- Meta description: `Klovered reads the RFP, drafts answers cited from your own
  documents, and routes them through review. Answer every RFP in days, not
  weeks. Start free.`
- Canonical: `https://klovered.io`
- Open Graph: type website, siteName Klovered, same title/description.
  Twitter card: summary_large_image.
- `<html lang="en">`, viewport meta, charset utf-8.

### Heading map (one h1, logical order, no skips)

h1 hero → h2 per section (How it works, The manual way vs the Klovered way,
Questions answered, CTA) → h3 for steps, features, differentiator, FAQ items.
The phrase "AI RFP response software" must appear in: title tag, meta
description, definition paragraph, FAQ answer 1, and footer line. Secondary
phrases to work in naturally, once each: "RFP automation" (comparison intro or
definition), "proposal software" (FAQ 8), "security questionnaires" (FAQ 8).
Never keyword-stuff; every use must read as natural copy.

### JSON-LD (one script tag, an array of these objects)

1. `Organization`: name Klovered, url, logo, description ("Klovered is AI RFP
   response software that extracts requirements from RFPs and drafts cited
   answers from a company's own knowledge base.")
2. `WebSite`: name Klovered, url.
3. `SoftwareApplication`: name Klovered, applicationCategory
   BusinessApplication, operatingSystem Web, description, offers { price "0",
   priceCurrency "USD", description "Free to start" }. No aggregateRating (no
   real reviews exist; do not fabricate).
4. `FAQPage`: mainEntity = the 9 FAQ questions/answers from §4.9, text matching
   the visible copy exactly.
5. `HowTo`: name "How Klovered answers an RFP", 3 steps matching §4.4.
6. `WebPage` with `speakable` (SpeakableSpecification, cssSelector pointing at
   the definition-block paragraph).

### Technical

- All content server-rendered / static HTML. Zero JS required to read anything.
- Semantic elements: `<nav>`, `<header>`, `<main>`, `<section>` with
  `aria-labelledby` or headings, `<footer>`, real `<table>`, real `<details>`.
- Images/mocks are CSS+HTML (no image requests); anything decorative gets
  `aria-hidden="true"`. If any real image is added it needs descriptive alt
  text in brand voice.
- Font loading: `display=swap` on both CDN links, preconnect to
  `api.fontshare.com` and `fonts.googleapis.com` / `fonts.gstatic.com`.
- Performance budget: no external JS libraries, no web-font more than the 3
  families listed, CSS under ~20KB, LCP element is the h1 (text, not an image),
  zero CLS (reserve the mock's aspect ratio).

## 6. AI-SEO (answer-engine) checklist

- The definition paragraph (§4.3) is self-contained: an engine can lift it
  verbatim and it still makes sense with full entity name and category.
- Every factual claim is specific and numeric where possible, and test-run
  numbers are always labeled as a test run.
- FAQ answers are 2–4 sentences, self-contained, no pronouns pointing outside
  the answer ("Klovered flags it", not "it flags it").
- The comparison table uses plain language pairs an engine can quote as
  "manual vs Klovered".
- Consistent entity string everywhere: "Klovered" + "AI RFP response software".
  Never rename the category between sections.
- Mode B only: `public/llms.txt` already exists; verify its claims still match
  the page copy after your edits and update it if they drift.

## 7. Design bans (hard failures, rewrite if you catch yourself)

Gradient text or background-clip text. Colored side-stripe borders
(border-left/right >1px as accent). Glassmorphism. Identical icon-card grids.
Hero-metric gradient tiles. A second brand color (no blue, purple, black fills).
`#000` or `#fff` as text/background (use Ink and Canvas). Title Case headings.
Em dashes in copy. More than one drenched-green section. Stock-photo clichés or
abstract 3D blobs. Modals. Exclamation marks.

## 8. Accessibility

WCAG AA. Body contrast ≥4.5:1 (Ink-2 on Canvas passes; never Ink-4 for body).
Buttons: Brand green + white passes at 4.9:1. Signal green is only for large
display text or as a fill behind Ink text, never small green text (use Deep
green for that). Visible 2px Brand-green focus ring on every interactive
element. Full keyboard navigation. `prefers-reduced-motion` kills all animation.
Anchor links scroll with `scroll-margin-top` matching the sticky nav height.

## 9. Art direction: from correct to exceptional

Follow these in priority order. If build budget forces cuts, cut from the bottom.

1. **The signature moment (highest priority).** The hero product frame is not a
   static mock: over a slow 6–8s loop, requirement rows receive their
   `CITED · 1.0` badges one by one and the readings counter ticks from 0 to 255.
   The brand promise is forward motion; the hero shows work moving. Implement
   with CSS animation or a few lines of vanilla JS; freeze to the final state
   under `prefers-reduced-motion`.
2. **Typographic nerve.** Do not shrink the h1 below its clamp ceiling out of
   caution. Two lines maximum, tight tracking, and "3 days," is the only colored
   text in the fold. The design's tension is the scale gap between 84px display
   type and 10px mono micro-labels; if both extremes aren't extreme, the page
   reads timid.
3. **The chevron motif, exactly four uses.** Logo tile, the one section-bleed
   accent, row markers in the comparison table's "With Klovered" column, and a
   2px forward nudge of the arrow inside the primary button on hover. No fifth
   use.
4. **Pacing.** Alternate loud and quiet: hero loud, definition block a tight
   quiet beat, features build, proof band stark, drenched green CTA lands last
   as the payoff (green means go, placed at the moment the reader is ready to
   go). This requires the varied section padding from §4; uniform padding kills
   the rhythm.
5. **Sub-perceptual details.** `::selection` green tint with Ink text; tabular
   numerals in the proof band; the "no source" flag visible in the hero mock
   (showing the product admit a gap is the most credible pixel on the page);
   `scroll-margin-top` on anchor targets equal to the sticky nav height;
   favicon = green tile with white chevron.
6. **Optional, only if everything above shipped:** a 2px Signal-green
   scroll-progress bar fixed at the top of the viewport ("the bid moves").

**Refuse additive noise:** no dark "drama" section, no particle or mesh
backgrounds, no second accent color, no testimonial carousel, no 3D document
illustrations. The page's confidence is one hue, one motif, one animation, huge
type, and true numbers.

## 10. Acceptance checklist (verify before calling it done)

- [ ] Exactly one h1; heading levels never skip.
- [ ] View-source shows all copy, all 9 FAQ answers, and the full table with JS disabled.
- [ ] JSON-LD parses (paste into a validator) and FAQ/HowTo text matches visible copy exactly.
- [ ] Title ≤ 60 chars, description ≤ 160 chars.
- [ ] "AI RFP response software" appears in title, description, definition block, FAQ 1, footer.
- [ ] Exactly one drenched-green section; everywhere else green is ≤ roughly 15% of the surface.
- [ ] Clash Display renders for h1/h2/h3; Geist for body; Geist Mono only in micro-labels, badges, and stat numbers.
- [ ] No banned pattern from §7 anywhere.
- [ ] Mobile at 375px: nav collapses, hero h1 wraps cleanly, table scrolls horizontally in a wrapper or stacks, steps stack vertically.
- [ ] Hero mock animates (badges land, counter ticks) and freezes to final state under reduced motion.
- [ ] Chevron motif appears exactly four times (logo, section bleed, table markers, button hover).
- [ ] Reduced motion: page is fully static.
- [ ] Lighthouse (or judgment if unavailable): LCP is the h1 text, no layout shift, no console errors.
