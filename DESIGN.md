# Design

Chosen direction: **Instrument** (draft B). Light canvas, neutral panel chrome, forest green spent only on state and action, monospace micro-detail as the signature texture. Reference implementation: `public/design-drafts/draft-b-instrument.html`.

## Theme

Light. Users read and write dense RFP content for hours in bright offices; the whole surface stays light. The technical, precision-tool feel comes from typography, density, and mono texture, never from a dark background.

## Color

OKLCH everywhere. Never #000 or #fff. Color strategy: Restrained (accent well under 10% of surface).

- `--bg` oklch(0.985 0.002 110) — canvas
- `--panel` oklch(0.968 0.003 110) — sidebar / second neutral layer
- `--surface` oklch(1 0 0) — blocks, tables, topbar, inputs
- `--ink` oklch(0.17 0.010 110) — primary text
- `--ink-2` oklch(0.32 0.009 110), `--ink-3` oklch(0.47 0.008 110), `--ink-4` oklch(0.61 0.007 110) — text ramp
- `--rule` oklch(0.885 0.005 110), `--rule-soft` oklch(0.935 0.004 110) — hairlines
- `--accent` oklch(0.42 0.13 152), `--accent-deep` oklch(0.31 0.11 152), `--accent-tint` oklch(0.96 0.03 152) — brand green: primary-ish actions, links, live indicators, progress fills, drafting state
- `--warn` oklch(0.56 0.13 72) — review / pending states
- `--err` oklch(0.52 0.17 27) — overdue / failed states
- Primary buttons are **ink** (near-black), not green. Green is state, not chrome.
- Status is always a dot or square + label, never color alone. Stage dots: neutral (triage), accent (drafting), warn (review).

## Typography

- **UI/body**: Geist (400, 500, 600, 650). Base 13px, line-height 1.45. Dense by design.
- **Data/meta**: Geist Mono. All numerals (`font-variant-numeric: tabular-nums`), timestamps, IDs (SEC-4.1), file names, counts, keyboard hints, version tags.
- **Micro-labels** (the signature): Geist Mono 9px, weight 500, letter-spacing 0.16em, uppercase, ink-4. Used for nav group labels, table headers, stat labels.
- Readings/large numbers: Geist Mono 26px, weight 500, letter-spacing −0.03em.
- Scale is tight (9, 10, 11.5, 12.5, 13, 14, 26). Hierarchy comes from weight + mono/sans contrast, not size jumps.
- No display fonts, no serif.

## Layout

- App shell: 216px panel-toned sidebar (border-right rule) + 44px white topbar.
- Full-width **readings band** under the topbar on overview screens: 5 cells on white, each with mono micro-label + big mono number + mono context delta ("+2 this week", "worst −3d"), divided by soft hairlines.
- Content: blocks (`--surface`, 1px `--rule`, radius 8px) with an 11px/16px blockhead row: sans 13px/600 title, mono tally, right-aligned quiet accent link.
- Tables: mono uppercase 9px column headers on faint bg, 10px/16px cells, hairline row rules, hover = faint bg wash. Right-align numeric columns.
- Radius: 5px controls, 8px blocks. Spacing rhythm: 24px page gutters, 16px block padding.
- Sidebar footer: mono system status lines (● PIPELINE ACTIVE, queue depth, user@org) with green live dot.

## Components

- **Buttons**: 4.5px 11px padding, radius 5px, 12px/500. Default = surface + rule border, hover darkens border. Primary = ink bg + light text. Trailing mono kbd hint where a shortcut exists.
- **Search field**: bordered white field in sidebar with trailing ⌘K kbd chip.
- **Nav items**: 12.5px/500, active = white surface + inset rule ring + leading 4px green dot; mono count trailing.
- **Queue rows** ("Requires action"): signal square (7px, radius 2px, warn/err), title + small context line, mono ref column, bordered action chip (Review / Open / Retry) that gains accent border on row hover.
- **Progress**: 72px x 4px track + green fill + mono percentage. Never a ring.
- **Activity feed**: two-column grid rows, mono timestamp+actor column (9.5px) + sans description with bold entities.
- **Telemetry block**: spark bars (6px wide, accent-tint with accent "hot" bars) + key/value rows with mono values.
- Every control has default, hover, focus-visible (2px accent outline), active, disabled states.

## Motion

- 100ms ease `cubic-bezier(0.22, 1, 0.36, 1)` on background/border/color only.
- No layout-property animation, no page-load choreography. `prefers-reduced-motion` disables all.

## Banned here

Side-stripe accent borders, gradient text, glassmorphism, hero-metric tiles, icon-card grids, modals as first resort, em dashes in copy.
