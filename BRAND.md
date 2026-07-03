# Propello — Brand & Design System

This is the single source of truth. It drives both the marketing surfaces and
the product UI. The token table maps 1:1 to CSS custom properties in
`app/globals.css`, so changing a value here is a spec change for the whole app.

Direction: **Cobalt**. Warm-white canvas, one confident cobalt-blue brand color
carrying actions and identity, a warm amber as an energy accent. Modern SaaS in
the register of Upwork (friendly, light, human), Pipedrive (colorful confident
CTAs), and Cursor (typographic discipline). Not green. Not dark.

---

## 1. Positioning

Propello turns a 300-question RFP into a reviewed, exportable response in days
instead of weeks: extract every requirement, draft grounded answers from your
knowledge base, route through human review, export. For bid and presales teams
who need speed without losing citation-level trust.

One-liner: **"300 questions. 3 days, not 3 weeks."**

---

## 2. Personality

Confident, warm, precise. Three words: **capable, direct, unfussy.**

- Capable: the product does real work; the brand shows the work (mono numbers,
  real screenshots, visible citations), it doesn't gesture at "AI magic".
- Direct: plain sentences, outcome first. No hedging, no hype.
- Unfussy: clean surfaces, one brand color, generous whitespace. Nothing
  decorative that isn't doing a job.

---

## 3. Voice

- Sentence case everywhere: headlines, buttons, nav, labels.
- Outcome-first. Lead with what the user gets, not what the software is.
- Mono numerals carry proof: "300 questions. 3 days." never "blazing fast".
- Contractions are fine. No exclamation marks. No em dashes (use commas, periods, colons).
- Banned words: seamless, unlock, empower, leverage, revolutionize, effortless, supercharge, magic.

| Don't | Do |
|---|---|
| "Seamlessly unlock AI-powered RFP magic" | "Extract requirements. Draft answers. Ship the response." |
| "Empower your team to work smarter" | "Your SMEs review, they don't retype." |
| "Get Started Now!" | "Start free" |
| "Revolutionize your proposal workflow" | "300 questions. 3 days, not 3 weeks." |

---

## 4. Logo

- **Mark**: rounded-square tile, corner radius = 24% of size, `--brand` fill,
  a Geist Mono "P" in white, weight 600, optically centered.
- **Wordmark**: lowercase `propello`, Geist 650, letter-spacing -0.02em, `--ink`.
- **Lockup**: mark + 8px gap + wordmark, wordmark vertically centered on mark.
- **Clearspace**: 0.5x mark-height minimum on all sides.
- **Minimum size**: mark alone never below 16px; lockup never below 20px mark-height.
- **Misuse**: never recolor the mark to a non-brand hue, never stretch or skew,
  never set the wordmark in another typeface, never Title Case or UPPERCASE it,
  never place the mark on a background under 3:1 contrast with the tile.

---

## 5. Color tokens

OKLCH. Never pure `#000` or `#fff`. Neutrals carry a faint cool-blue tint (hue
265) so they sit under the cobalt without going gray-corporate. These names are
the CSS variable names.

### Neutrals
| Token | OKLCH | Hex | Role |
|---|---|---|---|
| `--bg` | `oklch(0.99 0.003 90)` | `#fcfcf9` | Page canvas (warm white) |
| `--bg-2` | `oklch(0.972 0.004 265)` | `#f4f5f8` | Sidebar / second layer |
| `--surface` | `oklch(1 0 0)` | `#ffffff` | Cards, tables, inputs |
| `--ink` | `oklch(0.20 0.015 265)` | `#13161d` | Primary text |
| `--ink-2` | `oklch(0.38 0.012 265)` | `#3a3f4b` | Secondary text |
| `--ink-3` | `oklch(0.52 0.010 265)` | `#5f6472` | Tertiary text |
| `--ink-4` | `oklch(0.64 0.008 265)` | `#868b98` | Muted / labels |
| `--rule` | `oklch(0.90 0.005 265)` | `#dfe1e7` | Hairline borders |
| `--rule-soft` | `oklch(0.945 0.004 265)` | `#edeef2` | Faint dividers |

### Brand (cobalt) — action, identity, links, primary CTAs
| Token | OKLCH | Hex | Role |
|---|---|---|---|
| `--brand` | `oklch(0.52 0.19 262)` | `#245fd4` | Primary buttons, links, brand fill |
| `--brand-hover` | `oklch(0.47 0.18 262)` | `#1c53c1` | Hover state |
| `--brand-deep` | `oklch(0.44 0.17 262)` | `#1649ae` | Text on tint, small labels (7.8:1) |
| `--brand-tint` | `oklch(0.955 0.03 262)` | `#e5f1ff` | Wash, active-nav bg, badges |
| `--brand-glow` | `oklch(0.52 0.19 262 / 0.16)` | — | Focus ring |

### Amber — energy accent (highlights, "new", streaks). Never for body text.
| Token | OKLCH | Hex | Role |
|---|---|---|---|
| `--amber` | `oklch(0.75 0.15 65)` | `#ee9733` | Highlight fills, decorative accent |
| `--amber-deep` | `oklch(0.55 0.14 62)` | `#a95a00` | Text on amber tint (4.9:1) |
| `--amber-tint` | `oklch(0.965 0.04 70)` | `#fdf1df` | Wash |

### Status — one meaning each, always paired with a label, never color alone
| Token | OKLCH | Role |
|---|---|---|
| `--warn` | `oklch(0.62 0.14 62)` | Review / pending |
| `--err` | `oklch(0.55 0.19 27)` | Overdue / failed |
| `--ok` | `oklch(0.60 0.14 155)` | Approved / done |

Color strategy: **Restrained in-app** (cobalt well under 10% of surface, spent on
action + state), **Committed on marketing** (cobalt carries hero and CTAs). One
drenched-cobalt CTA band per marketing page maximum.

---

## 6. Typography

One family drives the whole system: **Geist** (UI, body, display) + **Geist Mono**
(numbers, labels, IDs, timestamps). Keeping one family is what lets a single
BRAND.md govern both app and site.

### Type scale
| Name | Font | Size | Weight | Tracking | Use |
|---|---|---|---|---|---|
| Display | Geist | 56–80px (clamp) | 650 | -0.04em | Marketing hero |
| Title | Geist | 32–40px | 650 | -0.03em | Marketing section heads |
| H1 (app) | Geist | 20px | 650 | -0.02em | Page titles |
| H2 | Geist | 15px | 600 | -0.012em | Block titles |
| Body-lg | Geist | 18px | 400 | 0 | Marketing subheads (max 60ch) |
| Body | Geist | 13–15px | 400 | 0 | UI + prose |
| Reading | Geist Mono | 26px | 500 | -0.03em | Big numbers (readings band) |
| Micro-label | Geist Mono | 9–11px | 500 | 0.14–0.16em, uppercase | Eyebrows, table headers, stat labels |

### The signature move
The mono micro-label (uppercase, wide tracking) appears on every surface: hero
eyebrow, section labels, stat labels, table headers, nav group labels. It's the
one motif that makes marketing and product read as the same company.

---

## 7. Components (product)

- **Buttons**: radius 6px, 12–13px/500. **Primary = `--brand` fill + white text**
  (colorful confident CTA, the SaaS move). Secondary = surface + rule border.
  Ghost = transparent. Trailing mono kbd hint where a shortcut exists.
- **Links**: `--brand`, no underline until hover.
- **Nav item (active)**: white surface + inset rule ring + leading 4px `--brand` dot.
- **Status tag**: mono uppercase label + 5px dot, tone-colored (brand/warn/err/ok). Never color alone.
- **Count pill**: mono, `--brand-tint` bg + `--brand-deep` text.
- **Readings band**: 5 cells, mono micro-label + big mono number + context delta.
- **Meter**: 72×4px track + `--brand` fill + mono percentage. Never a ring.
- **Segmented tabs**: active = `--brand-tint` bg + `--brand-deep` text.
- Radius: 6px controls, 10px cards, 24% for the logo tile.
- Every control has default, hover, focus-visible (2px `--brand` ring), active, disabled.

---

## 8. Layout & motion

- App shell: ~216px sidebar (`--bg-2`, right rule) + 44px white topbar.
- Marketing: left-aligned or centered hero, one idea per fold, generous whitespace, browser-framed real product screenshots (never abstract UI).
- Radius rhythm, 24px page gutters, 16px block padding.
- Motion: 100–150ms, exponential ease-out `cubic-bezier(0.22,1,0.36,1)`, on color/background/border only. No layout animation. Honor `prefers-reduced-motion`.

---

## 9. Imagery

Real product screenshots only, framed in plain browser chrome. No stock photos,
no abstract 3D, no gradient blobs, no illustration system (not scoped yet).

---

## 10. Accessibility

WCAG AA: 4.5:1 body text, 3:1 large text and UI. Cobalt `--brand` is 5.6:1 on
white; use `--brand-deep` (7.8:1) for small text on tints. Amber is decorative
only, never body text. Status never by color alone. Full keyboard nav, visible
focus rings, reduced-motion honored.

---

## 11. Do / Don't

| Do | Don't |
|---|---|
| Cobalt CTA fills | Ink/black CTAs (that was the old system) |
| Warm-white canvas | Stark white or gray-corporate |
| One brand hue (cobalt) + amber energy | A third brand color |
| Mono numbers as proof | Adjective-stacked claims |
| Browser-framed real UI | Abstract gradient hero art |
| Sentence case | Title Case headlines |
