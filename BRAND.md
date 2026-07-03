# Propello — Brand & Design System

This is the single source of truth. It drives both the marketing surfaces and
the product UI. The token table maps 1:1 to CSS custom properties in
`app/globals.css`, so changing a value here is a spec change for the whole app.

Direction: **Green** (locked, approved). Warm-white canvas, one confident green
brand color carrying every action and identity moment. Modern SaaS in the
register of Fiverr, Upwork, Pipedrive: light, colorful, confident CTAs. One hue,
used everywhere, nothing else competing for attention. Simplicity over variety.

Reference implementation: `public/design-drafts/brand/preview-fiverr-green.html`.

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

OKLCH. Never pure `#000` or `#fff`. Neutrals carry a faint green tint (hue 152)
so they sit under the brand color without going gray-corporate. **One brand hue
only** — no second accent color. These names are the CSS variable names.

### Neutrals
| Token | OKLCH | Hex | Role |
|---|---|---|---|
| `--bg` | `oklch(0.99 0.003 90)` | `#fcfcf9` | Page canvas (warm white) |
| `--bg-2` | `oklch(0.972 0.004 152)` | `#f3f6f4` | Sidebar / second layer |
| `--surface` | `oklch(1 0 0)` | `#ffffff` | Cards, tables, inputs |
| `--ink` | `oklch(0.20 0.015 152)` | `#13201a` | Primary text |
| `--ink-2` | `oklch(0.38 0.012 152)` | `#3a453f` | Secondary text |
| `--ink-3` | `oklch(0.52 0.010 152)` | `#5f6a63` | Tertiary text |
| `--ink-4` | `oklch(0.64 0.008 152)` | `#868f89` | Muted / labels |
| `--rule` | `oklch(0.90 0.005 152)` | `#dfe4e1` | Hairline borders |
| `--rule-soft` | `oklch(0.945 0.004 152)` | `#edf1ef` | Faint dividers |

### Brand (green) — action, identity, links, primary CTAs. The only accent.
| Token | OKLCH | Hex | Role |
|---|---|---|---|
| `--brand` | `oklch(0.53 0.18 152)` | `#00872f` | Primary buttons, links, brand fill (white text 4.9:1) |
| `--brand-hover` | `oklch(0.47 0.17 152)` | `#00752a` | Hover state |
| `--brand-deep` | `oklch(0.44 0.16 152)` | `#00681f` | Text on tint, small labels (5.2:1 on white) |
| `--brand-tint` | `oklch(0.955 0.045 152)` | `#dcf7e3` | Wash, active-nav bg, badges |
| `--brand-glow` | `oklch(0.53 0.18 152 / 0.16)` | — | Focus ring |

### Status — one meaning each, always paired with a label, never color alone
| Token | OKLCH | Role |
|---|---|---|
| `--warn` | `oklch(0.62 0.14 62)` | Review / pending |
| `--err` | `oklch(0.55 0.19 27)` | Overdue / failed |
| `--ok` | `--brand-deep` (reuse, don't invent a second green) | Approved / done |

Color strategy: **Restrained in-app** (brand green well under 10% of surface,
spent on action + state only), **Committed on marketing** (green carries hero
CTA, nav CTA, highlighted word in the headline). One drenched-green band per
marketing page maximum. No secondary accent color anywhere in the system.

---

## 6. Typography

One family drives the whole system: **Geist** (UI, body, display) + **Geist Mono**
(numbers, labels, IDs, timestamps). One family, one hue: that pairing is the
whole simplicity argument.

### Type scale
| Name | Font | Size | Weight | Tracking | Use |
|---|---|---|---|---|---|
| Display | Geist | 56–80px (clamp) | 650–700 | -0.04em | Marketing hero |
| Title | Geist | 32–40px | 650 | -0.03em | Marketing section heads |
| H1 (app) | Geist | 20px | 650 | -0.02em | Page titles |
| H2 | Geist | 15px | 600 | -0.012em | Block titles |
| Body-lg | Geist | 18–19px | 400 | 0 | Marketing subheads (max 60ch) |
| Body | Geist | 13–15px | 400 | 0 | UI + prose |
| Reading | Geist Mono | 26px | 500 | -0.03em | Big numbers (readings band) |
| Micro-label | Geist Mono | 9–11px | 500 | 0.14–0.16em, uppercase | Eyebrows, table headers, stat labels |

### The signature move
The mono micro-label (uppercase, wide tracking) appears on every surface: hero
eyebrow, section labels, stat labels, table headers, nav group labels. It's the
one motif that makes marketing and product read as the same company.

---

## 7. Components (product)

- **Buttons**: radius 6–8px, 13–14px/600. **Primary = `--brand` fill + white
  text.** Secondary = surface + rule border. Ghost = transparent. Trailing mono
  kbd hint where a shortcut exists.
- **Links**: `--brand-deep`, no underline until hover.
- **Nav item (active)**: white surface + inset rule ring + leading 4px `--brand` dot.
- **Status tag**: mono uppercase label + 5px dot, tone-colored (brand/warn/err). Never color alone.
- **Count pill**: mono, `--brand-tint` bg + `--brand-deep` text.
- **Readings band**: 5 cells, mono micro-label + big mono number + context delta.
- **Meter**: 72×4px track + `--brand` fill + mono percentage. Never a ring.
- **Segmented tabs**: active = `--brand-tint` bg + `--brand-deep` text.
- Radius: 6–8px controls, 10–14px cards, 24% for the logo tile.
- Every control has default, hover, focus-visible (2px `--brand` ring), active, disabled.

---

## 8. Layout & motion

- App shell: ~216px sidebar (`--bg-2`, right rule) + 44px white topbar.
- Marketing: centered hero, one idea per fold, generous whitespace, browser-framed real product screenshots (never abstract UI).
- Radius rhythm, 24px page gutters, 16px block padding.
- Motion: 100–150ms, exponential ease-out `cubic-bezier(0.22,1,0.36,1)`, on color/background/border only. No layout animation. Honor `prefers-reduced-motion`.

---

## 9. Imagery

Real product screenshots only, framed in plain browser chrome. No stock photos,
no abstract 3D, no gradient blobs, no illustration system (not scoped yet).

---

## 10. Accessibility

WCAG AA: 4.5:1 body text, 3:1 large text and UI. `--brand-deep` is 5.2:1 on
white, safe for small text. White text on `--brand` fill is 4.9:1, safe for
button labels. Status never by color alone. Full keyboard nav, visible focus
rings, reduced-motion honored.

---

## 11. Do / Don't

| Do | Don't |
|---|---|
| One brand green, everywhere | A second accent color (amber, blue, anything) |
| Warm-white canvas | Stark white or gray-corporate |
| Green CTA fills | Ink/black CTAs (an earlier system, now retired) |
| Mono numbers as proof | Adjective-stacked claims |
| Browser-framed real UI | Abstract gradient hero art |
| Sentence case | Title Case headlines |
| Reuse `--brand-deep` for "done/approved" state | Invent a second green shade for status |
