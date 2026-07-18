# Klovered — ad expression layer v2 (the shape & object system)

Extends [BRAND_ADS_GUIDELINE.md](BRAND_ADS_GUIDELINE.md). That doc locked the
photo treatments (ink scrim, green duotone) and the six templates T1–T6. This
one adds what a Kony/SAP-tier campaign has and T1–T6 don't: **a shape
language, contained real-color photography, object heroes, and green-led
frames** — without breaking the one-hue discipline.

Why: T1–T6 are typographic frames with photos *behind* type. Modern brand
campaigns (see Behance brand boards) put photos *inside brand geometry*, use
product-UI artifacts as heroes, and let the brand color lead entire frames.
BRAND.md §7 already names the raw material: "oversized forward-chevrons, a
single green shape bleeding off the edge, big green number callouts."

## The seven new moves (E1–E7)

### E1 · Chevron photo mask
The forward chevron (the "go" arrow, BRAND.md §7) becomes a photo container:
a giant chevron/parallelogram clipped photo, headline type **overlapping the
mask edge** so type and image interlock (the SAP move).
- Photo inside the mask may be **real color**, graded gently (saturate .85,
  contrast 1.05). Containment is the treatment — the shape does the branding.
- On CANVAS: ink headline, one green word. On INK: white headline.
- One mask per frame. The chevron always points **right** (forward, never back).

### E2 · Green-led frame
Signal green `#12B24A` as the whole field — no longer CTA-only. Rules that
keep green meaning "go":
- Max **one** green-led frame per set *in addition to* the type-only CTA (T6).
- Ink type only. White only for containers (tiles, pills), never for body text.
- Must contain a **white-radius tile** (photo or UI) so the frame reads as a
  designed card, not a colored slide.

### E3 · Photo-in-tile (contained real color)
A real-color photo inside a 20–24px-radius tile sitting on a green or ink
field (the Kony "invite friend" move). Real color is allowed **only inside a
tile** — full-bleed color photography is still banned; scrim/duotone rules
from v1 still govern full-bleed and split photos.

### E4 · Object hero
One oversized flat brand object as the image — no 3D renders, no mascots:
- a giant **cited chip** (`✓ cited · source attached`), slightly rotated
- a giant **green disc** with a stat or `%`
- a giant **requirement pill** (`REQ-140 · answered`)
Object gets a soft long shadow (`0 40px 80px -40px` ink at ~35%) so it sits
on the page like a physical thing. One object per frame, poster-scale.

### E5 · UI-card ad
A product data card is the whole ad (the Kony "income per week" move): white
surface card, mono chart bars or a readings band, one bar/value highlighted
in signal green with a value bubble. Numbers must be real product vocabulary
(answers drafted, citations attached, requirements found). The chart IS the
proof; headline stays small.

### E6 · Inline block highlight (preferred) / pill
One headline phrase gets a solid **block highlight** — a tight white
rectangle, ~3px radius, ink text knocked onto it (or the inverse: ink block +
white text for extra punch on green). `box-decoration-break: clone` keeps the
block tight per line. This is the preferred marker over the older rounded pill
— it reads sharper and more editorial. Replaces the green accent *word* in
that frame; never both, never two blocks.
Variants: **stamp stack** (each headline line its own left-aligned block,
alternating white/ink) for tagline-only frames; **block band** rising from a
full-bleed photo's green scrim.

### E7 · Bento brand board
One frame = a 2×3 (or 3×3) grid of mixed tiles: green logo tile, UI stat
tile, duotone photo tile, chip tile, ink wordmark tile, CTA tile. 14px gaps,
20px radii. The board is the "whole brand in one glance" asset — use as the
campaign opener or the LinkedIn banner, max one per campaign.

### E8 · Standard photo
A photo used plainly — no mask, no duotone, no scrim. Three placements only:
- **Photo-stack**: photo as a clean rectangle filling the top ~55%, type block
  below on canvas. The workhorse SaaS-feed layout.
- **Photo-block**: headline first, photo in a 24px-radius full-width block
  below, optional mono caption chip on the photo.
- **Card-on-photo**: full-bleed photo, type inside a solid canvas card
  (48px padding) — the card carries legibility, so the photo stays untreated.
Grade: light only (saturate .9–1, contrast ≤1.05). The photo must still obey
the subject rules (§2 of the v1 guideline) — candid, bid-team world, no
clichés. Type never sits directly on an untreated photo.

## What still stands (unchanged from v1)
- One hue. No blue, no purple, no second accent. Amber only as the honesty chip.
- Full-bleed photos: ink scrim or nothing. Splits: green duotone.
- Type grammar: mono eyebrow → green rule → Clash Display headline → footer.
- Banned: gradient blobs, 3D renders, lens flares, glowing brains, handshakes.
- Sentence case, no exclamation marks, banned-word list, numbers as proof.

## Set composition (a 6-frame campaign now draws from both layers)
Lead with E1 or E4 (scroll-stopper) → T5/E5 product proof → T2/T4 story/stat
→ E2 offer frame → T6 CTA. Never two photo frames adjacent; never two
green-led frames (E2 + T6 must be separated by at least one light frame).

## Example set (built in ../../klovered-linkedin/ads/build-shapes.mjs)
1. **v01 chevron hero** — E1 on canvas, p3 in the mask, "The bid moves. You don't grind."
2. **v02 green offer** — E2+E3+E6, p5 tile, "Answer every RFP. In **days**."
3. **v03 object hero** — E4 cited chip, "Every answer shows its receipts."
4. **v04 UI-card** — E5 chart of answers drafted per day, 255 highlighted.
5. **v05 bento board** — E7, six tiles, the brand in one frame.
6. **v06 angled split** — E1 variant on ink, angled mask, white type overlap.
