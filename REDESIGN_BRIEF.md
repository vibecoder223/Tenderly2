# Klovered redesign brief (hand to Sonnet)

You are redesigning Klovered, an AI RFP-response tool (Next.js 16, React 19,
Tailwind 3). Two jobs: (A) turn the winning landing draft into a production
marketing page, and (B) reconcile the product app so it fully matches the brand.

## Source of truth (read these first, do not rewrite them)

- `BRAND.md` — the locked brand identity (green, Fiverr/Upwork energy, Clash
  Display + Geist). This is the spec. Follow it literally. Do not edit it.
- `DESIGN.md` — the product-register system ("Instrument"). Governs the app UI.
- `app/globals.css` — the implemented app tokens. Already migrated to green
  (OKLCH hue 152) and Geist. This is the working product truth; match it.

The name is **Klovered**. Any remaining "Tenderly" string is a bug to fix.

## Hard rules (apply to everything)

- OKLCH for all colors. Never `#000` or `#fff`; tint neutrals toward green.
- No em dashes anywhere (copy or comments). Sentence case in all UI/marketing copy.
- Banned: side-stripe accent borders, gradient text (`background-clip:text`),
  glassmorphism, hero-metric tiles, identical icon-card grids, modals as first
  resort. If you reach for one, restructure instead.
- Voice: short, outcome-first, numbers as proof. Banned words: seamless, unlock,
  empower, leverage, revolutionize, effortless, supercharge, magic, world-class,
  cutting-edge (see BRAND.md §3).
- Motion: 100 to 200ms, exponential ease-out, color/border/opacity/transform
  only, never layout properties. Honor `prefers-reduced-motion`.
- Run `npm run build` and `npm run lint` at the end. Both must pass.

---

## Job A: production marketing landing

**Base file:** `public/design-drafts/brand/landing-a-light.html` (the green,
light draft, already on the right structure). Ignore the other drafts in that
folder (`landing-b-dark`, `preview-cobalt-light`, `preview-violet-light`,
`hero-preview-monochrome-coral`); they are pre-green-lock explorations.

**Deliverable:** a self-contained (inline CSS, CDN fonts only) production page at
`public/design-drafts/brand/landing.html`. Keep it a single static HTML file.

**Fix these specific drifts from BRAND.md, in order of impact:**

1. **Add Clash Display.** This is the headline gap. Load Clash Display from
   Fontshare (`https://api.fontshare.com/v2/css?f[]=clash-display@600,700&display=swap`)
   and use it for the hero headline, section titles (`h2`), the wordmark, and the
   CTA-band headline, per BRAND.md §6. Keep Geist for body/UI and Geist Mono for
   data/labels. The draft currently sets everything in Geist, which is exactly
   the "too plain" problem the brand exists to fix.
2. **Green primary buttons, not ink.** BRAND.md §5/§9: primary CTAs are Brand
   green fill + white text. The draft uses `btn-ink` (near-black) for the nav
   CTA and hero CTA. Make primary CTAs green. Keep a bordered/ghost secondary.
   ("Green means go" is the entire brand idea; the main button cannot be black.)
3. **Green-tinted neutrals.** Swap the neutral hue from 110 to 152 so nothing
   reads corporate-gray, matching BRAND.md §5 and `globals.css`.
4. **Use the real brand greens** (BRAND.md §5): Signal green `oklch(0.68 0.17 152)`
   for big marketing fills / hero accent word / CTA band, Brand green
   `oklch(0.53 0.18 152)` for buttons, Deep green `oklch(0.44 0.16 152)` for
   small text on tint, Green tint `oklch(0.955 0.045 152)` for washes/pills. The
   draft's greens (hue 149, lower chroma) are more muted than the brand's
   Fiverr-energy Signal green.
5. **Eyebrow in a green-tint pill.** BRAND.md §8: the mono eyebrow sits in a
   green-tint pill, not as bare text.
6. **Hero headline: one word in Signal green** (the draft italicizes the second
   line; instead set one key word in Signal green, no italic).
7. **CTA band = one drenched Signal-green section with dark/ink text** (BRAND.md
   §8). The draft uses dark pine; use Signal green with ink text instead.
8. **Fix the "Tenderly" leftover** in the draft box copy (line ~262). Replace
   with Klovered and real product language.
9. **Logo mark:** prefer the forward/play chevron mark on a Signal-green tile for
   marketing (BRAND.md §4), rather than a muted pine "P" tile.

**Then bring it to production quality:**

- Add `<title>`, meta description, and Open Graph / Twitter card tags.
- Add an inline SVG favicon (green tile + forward mark).
- Add tasteful scroll-reveal motion on section entry (IntersectionObserver,
  disabled under `prefers-reduced-motion`), sub-200ms ease-out. Nothing bouncy.
- Tighten responsive behavior below 860px (hero type scale, stacked features,
  the in-hero app mockup) so nothing overflows horizontally.
- Keep the hero's browser-framed app mockup, but update its greens/neutrals to
  match, and make the stage dots and status colors consistent with the app.
- Copy stays as-is where it is already good; it is on-brand. Just fix the typo
  and any place a primary CTA label breaks the "Start free / Book a demo /
  See it work" system (BRAND.md §3). No exclamation marks.

**Done when:** the page uses Clash Display for display type, green primary CTAs,
green-tinted neutrals, a drenched Signal-green CTA band, has meta/OG/favicon,
reveals on scroll (motion-safe), holds up from 360px to wide, and contains zero
"Tenderly" strings and zero em dashes.

---

## Job B: reconcile the product app to the brand

The app has two token systems that have drifted apart:

- `app/globals.css` CSS variables: already green (OKLCH hue 152) + Geist. Correct.
- `tailwind.config.ts`: **stale.** Still maps `accent` to cobalt `#3B47D6`,
  `accent-2` to `#2E3AB8`, `accent-tint` to `#EEF0FF`, `accent-line` to `#C7CDF7`,
  and `fontFamily.sans` to **Inter**. About 155 usages across 36 files use these
  Tailwind utilities (`bg-accent`, `text-accent`, `border-accent`, `font-sans`,
  etc.), so a large part of the app currently renders **cobalt and Inter** even
  though the CSS-variable layer is green.

**Primary fix (do this first, it aligns all 36 files at once):** rewrite
`tailwind.config.ts` so the color tokens and sans font match `globals.css` /
BRAND.md. Use OKLCH values, not the old hex. Recommended mapping (align to the
CSS variables already in `globals.css`):

| token          | value (match globals.css)     |
|----------------|-------------------------------|
| `accent`       | `oklch(0.53 0.18 152)`        |
| `accent-2`     | `oklch(0.47 0.17 152)`        |
| `accent-tint`  | `oklch(0.955 0.045 152)`      |
| `accent-line`  | `oklch(0.78 0.12 152)`        |
| `ok`/`ok-tint` | reuse accent / accent-tint    |
| `warn`         | `oklch(0.62 0.14 62)`         |
| `err`          | `oklch(0.55 0.19 27)`         |
| `fg`..`fg-5`   | the ink ramp from globals.css |
| `bg`,`bg-2`,`surface`,`border`,`divider` | match globals.css |
| `fontFamily.sans` | `["Geist", ...system stack]` (drop Inter) |

Prefer making these reference the CSS variables (e.g. `accent: "var(--accent)"`)
so there is one source of truth and the two systems can never drift again. If a
utility needs Tailwind opacity modifiers, use the `oklch(... / <alpha-value>)`
form for that token. Verify Geist is actually loaded (check `app/layout.tsx`
font setup); the app font must be Geist, not Inter.

**Then audit and fix:**

- Grep the whole app for hardcoded cobalt (`#3B47D6`, `#2E3AB8`, `#EEF0FF`,
  `#C7CDF7`) and any `#000`/`#fff`; replace with tokens.
- Grep for "Tenderly" (including `package.json` "name", exports, doc strings,
  page copy) and decide per case: user-facing strings become "Klovered"; the
  internal package name is optional but note it.
- Confirm status colors (warn/err/ok) and the `.st` / `.stage` / `.badge`
  vocabularies render consistently on the real pages: dashboard, deals board,
  deal detail, questions table, approvals, knowledge, analytics, settings,
  auth screens.
- Spot-check the highest-traffic screens against DESIGN.md: dashboard readings
  band, "requires action" queue, deals board, questions split view. Fix only
  real brand/consistency breaks; do not restyle screens that already conform.
- Make sure primary buttons in-app are Brand green fill + white text, links are
  Deep green, focus ring is 2px Brand green (per BRAND.md §9 / globals.css).

**Done when:** `tailwind.config.ts` matches the green system, no cobalt hex or
`#000`/`#fff` remain, no user-facing "Tenderly" remains, `npm run build` and
`npm run lint` pass, and the main screens read as one green brand end to end.

---

## Suggested order

1. Job B primary fix (tailwind config) first, so the running app goes green.
2. Verify a few app screens in the browser.
3. Job A landing.
4. Job B audit sweep (hardcoded hex, "Tenderly", status consistency).
5. `npm run build` + `npm run lint`, then a final visual pass.

Ask before deleting any of the other brand draft HTML files; leave them unless
told otherwise.
