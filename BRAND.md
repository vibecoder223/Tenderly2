# Brand

## Positioning

Propello turns a 300-question RFP into a reviewed, exportable response in days instead of weeks, by extracting requirements, drafting grounded answers from your knowledge base, and routing everything through human review. For bid teams who need speed without losing citation-level trust.

## Personality

Precise. Confident. Quietly technical. Professional equipment, not office software — the marketing layer is the same discipline as the product, just louder in scale, not tone.

## Voice

- Outcome-first, plain sentences. Contractions fine. No exclamation marks.
- Mono numerals carry the proof: "300 questions. 3 days." not "blazing fast."
- Sentence case everywhere — headlines, buttons, nav.
- Banned words: seamless, unlock, empower, leverage, revolutionize, effortless.
- No em dashes in copy — commas, periods, colons.

| Don't | Do |
|---|---|
| "Seamlessly unlock AI-powered RFP magic" | "Extract requirements. Draft grounded answers. Ship the response." |
| "Empower your team to work smarter" | "Your SMEs review, not retype." |
| "Effortless collaboration at scale" | "Assign, draft, approve. One thread per question." |
| "Revolutionize your proposal process" | "300 questions. 3 days." |
| "Get Started Now!" | "Start free" |

## Logo

**Mark**: rounded-square tile, radius ~22% of size, sage green fill (`--pine` on light, or solid `--accent` at small sizes), a Geist Mono "P" in white centered inside, weight 600.

**Wordmark**: lowercase `propello`, Geist 650, letter-spacing -0.02em.

Lockup: mark + wordmark, 8px gap, wordmark baseline-aligned to mark's vertical center.

**Clearspace**: minimum 0.5x mark-height on all sides. **Minimum size**: mark alone never below 16px; lockup never below 20px mark-height.

**Misuse**: never recolor the mark, never stretch/skew, never place on a background under 3:1 contrast with the tile, never set the wordmark in anything but Geist, never uppercase or title-case the wordmark.

## Color

App tokens (unchanged, `app/globals.css`):
- `--accent` `oklch(0.50 0.135 149)` `#107734` — action, state, links
- `--accent-3` `oklch(0.37 0.12 149)` `#005016` — text on tint
- `--accent-tint` `oklch(0.965 0.032 149)` `#e5fae8` — wash

Marketing-only additions (hero/CTA scale, not used in-app):
- `--leaf` `oklch(0.72 0.17 149)` `#3ecf6a` — bright accent for dark/drenched sections only. Contrast on `--pine`: 5.1:1 (AA for large text/UI).
- `--pine` `oklch(0.30 0.09 155)` `#0f3d21` — deep anchor for the drenched CTA band and dark hero variant. Contrast with white text: 11.8:1.

Never a second brand hue. Never use `--leaf` on white (fails AA — it's a dark-surface accent only).

## Typography

- App scale unchanged (13px base, DESIGN.md owns it).
- Marketing display: Geist 600–650, 56–88px, letter-spacing -0.03em to -0.045em, line-height 1.05.
- Marketing subhead: Geist 400, 18–20px, `--ink-3`, line-height 1.5, max 60ch.
- Eyebrow: Geist Mono 11px, 500, 0.14em tracking, uppercase — the brand's signature move, lifted straight from the app's micro-label pattern.

## Signature pattern

The micro-label (mono, uppercase, wide tracking) is the one motif that must appear on every brand surface: hero eyebrow, section labels, stat labels, pricing tier eyebrows. It's what makes marketing and product feel like the same company.

## Imagery

Product screenshots only — real (or realistically reconstructed) UI, framed in a plain browser chrome. No stock photography, no abstract 3D renders, no illustration system (not yet scoped).

## Do / Don't

| Do | Don't |
|---|---|
| One drenched-green CTA band per page | Green wash on every section |
| Mono numbers as proof points | Adjective-stacked claims |
| Browser-framed real UI | Abstract gradient blobs |
| Sentence case | Title Case headlines |
| Sage green, one hue | A second "friendly" accent color |
