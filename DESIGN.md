# Design

Chosen direction: **Clean SaaS** (the approved dashboard). Near-white canvas,
white cards that lift on a soft shadow, one confident green spent only on action
and state, Geist sans everywhere. Reference implementation:
`app/(app)/dashboard/page.tsx` and `public/design-drafts/brand/dashboard-refined.html`.

This file is the spec. `components/ui.tsx` holds the primitives that implement
it. Pages compose those primitives; they do not invent their own colors, fonts,
numbers, or card styles.

## Theme

Light. Users read and write dense RFP content for hours in bright offices; the
whole surface stays light. The product feels calm and modern, not technical: the
polish comes from typography, spacing, and restraint, never a dark background.

## Color

OKLCH everywhere. Never `#000` or `#fff`. Color strategy: Restrained (accent well
under 10% of surface). Values live in `app/globals.css` `:root` and must match
`BRAND.md` §5.

- `--bg` oklch(0.995 0.001 152) — near-white canvas (reads white)
- `--bg-2` oklch(0.968 0.004 152) — hover fill, faint second layer
- `--surface` oklch(1 0 0) — cards, tables, topbar, sidebar, inputs
- `--fg` … `--fg-5` — ink ramp, hue 152
- `--border` oklch(0.90 0.005 152), `--divider` oklch(0.945 0.004 152) — hairlines
- `--accent` oklch(0.53 0.18 152) — brand green: primary buttons, links, active state, progress fills
- `--accent-3` oklch(0.44 0.16 152) — green text on tint (active nav label)
- `--accent-tint` oklch(0.955 0.045 152) — active-nav pill, badges, avatars
- `--warn` review/pending, `--err` overdue/failed — status only
- Primary buttons are **green** fill, white text. Green is action and state, never chrome.
- Status is always a dot/number + label, never color alone. State color (warn/err) appears only on the number or dot that carries risk.

## Typography

- **Everything**: Geist. Base 13.5px, line-height 1.5. No display face in-product (Clash Display is marketing-only, per BRAND.md).
- **Numbers**: Geist sans with `font-variant-numeric: tabular-nums` for aligned columns. Headline/readings numbers 27px/550. **No monospace numbers.**
- **Geist Mono** survives only in `.kbd` keyboard-shortcut chips (⌘K). Nowhere else.
- **Labels**: sentence case, 11–12.5px, `--fg-3`/`--fg-4`. No 9px uppercase mono micro-labels.
- Headings: `.page-title` 21px/650, section titles 13–13.5px/600. Hierarchy from weight + size, not mono/uppercase texture.

## Layout

- App shell: 216px white sidebar (border-right) + 44px white topbar, both on the near-white canvas.
- **Cards** (`.section-card`): white surface, 1px `--border`, radius 8px, soft `--shadow-2` lift. Head row = sentence-case 13.5px/600 title + optional count + right-aligned quiet green link.
- **Readings strip** (`.readings`): full-width white card, 4 cells divided by hairlines, big sans number (27px/550) + sentence-case label. State color on risk numbers only.
- **Rows** over cards for lists: runway rows (`.rw-row`), key/value trust rows (`.trust-row`), activity feed rows (`.feed-row`, avatar + text + relative time). Hairline dividers, hover = `--bg-2` wash.
- **Tables** (`.data-table`): sentence-case 11px `--fg-4` headers (not mono/uppercase), 13px cells, hairline row rules, right-align numeric columns.
- Two-column regions use equal-height stretch so cards align top and bottom.
- Radius: 5–6px controls, 8px cards. Spacing: 24–28px page gutters, 16px card padding, roomy rows.

## Components (in `components/ui.tsx`)

- **Buttons** (globals.css `.btn`): default = surface + border; primary = green fill + white text; danger; ghost. Hover darkens; solid green darkens background and keeps white text.
- **StatStrip / Reading**: the readings strip.
- **SectionCard**: bordered white card + head (title/count/link), supports a divided second head.
- **StatusBadge**: dot + sentence label, tone = accent/warn/err/ok. Single vocabulary across deals, questions, docs, review.
- **RunwayRow / KeyValueRow / FeedRow**: the dashboard list primitives.
- **Meter**: track + green fill + sans percentage.
- Active nav item: green-tint pill (`--accent-tint` bg, `--accent-3` text, green icon), `aria-current="page"`.
- Every control has default, hover, focus-visible (2px accent outline), active, disabled.

## Page anatomy (STRICT — every page is built this way)

Every page is the same vertical stack. No page invents its own skeleton, width,
or spacing. This is what makes pages look like the same product.

```
Topbar            fixed: breadcrumbs left, primary page action(s) right
└ Page            max-width 1280px · padding 24px 28px · children spaced 20px
   ├ PageHeader   h1 title (21/650) + one-line sub. No meta pill. No actions here (they live in the Topbar).
   ├ Readings     (only if the page has KPIs) the bordered white .readings card — NEVER an edge-to-edge band
   ├ Toolbar      (only on list pages) filters / search / segmented control, on the canvas, not boxed
   └ Content      one or more SectionCards laid out on the grid below
```

Hard rules:
- **One width: 1280px.** One gutter: 28px horizontal, 24px top. Never per-page values.
- **Metrics are always the `.readings` card**, sitting inside the page like any other block. `ReadingsBand` / `.band` (edge-to-edge) is retired.
- **PageHeader is title + sub only.** No `.page-meta` count pill, no title-row. Counts belong in the relevant SectionCard head.
- Primary actions live in the **Topbar**, never in the page header.

## Spacing scale (STRICT)

Use only these. No ad-hoc values.
- Page gutter: `28px` horizontal, `24px` top.
- Between stacked blocks: `20px` (`space-y-5`).
- Grid gap: `20px`.
- Card padding: body `16px`; head `12px 16px`.
- Row padding: `12px 16px`.
- Radius: cards `8px`, controls `6px`, pills `999px`.

## Box rules (when something is a card, when it is not)

- **Boxed (SectionCard):** any discrete group of data — a table, a list, a metrics-detail panel, a chart, a form section.
- **Not boxed (sits on canvas):** the PageHeader, the readings strip's surroundings, the Toolbar (filters/search/tabs).
- **The readings strip is the one metrics card**; it is boxed, full-width.
- Never nest a card inside a card. Never box a single control or a lone number.
- Lists render as **rows inside one card**, never as a grid of little cards. No icon-card grids.
- Side-by-side cards use equal-height stretch so they align top and bottom.

## Grid (content region)

Only these column patterns, gap 20px:
- **Full** — one card full width.
- **Halves** — `1fr 1fr` (two equal cards).
- **2:1** — `minmax(0,2fr) 1fr` (primary + rail; the dashboard's deals + trust layout).
Collapse to a single column below 1000px.

## Page archetypes (pick one per page)

| Archetype | Pages | Shape |
|---|---|---|
| **Overview** | dashboard, analytics | Header → Readings → 2:1 or Halves grid of SectionCards |
| **List / index** | deals, knowledge, templates, team, library, my-queue, activity, search | Header → (optional Readings) → Toolbar → one SectionCard with a DataTable or row-list |
| **Detail** | deals/[id] + tabs | DealHeader → tab bar → tab body as SectionCards |
| **Form** | settings, deals/new, deals/fields | Header → SectionCard(s) with a label+control form grid → sticky save bar |
| **Empty / first-run** | any zero-state | one centered EmptyState card |

Whatever the archetype, the atoms are identical: same Page shell, same Readings,
same SectionCard, same DataTable, same StatusBadge, same spacing.

## Layout primitives (components/ui.tsx — pages compose these, never hand-roll)

- `Page` — container (1280px, gutters, `space-y-5`).
- `PageHeader` — title + sub.
- `Readings` / `Reading` — the metrics card.
- `SectionCard` — the one card: head (title + optional count + optional subtitle + optional right link), optional divided second head. Replaces the analytics-local `Section` and any bespoke card.
- `Toolbar`, `SearchField`, `SegmentedTabs`, `FilterChip` — list-page controls.
- `DataTable` — restyled table wrapper (sentence-case headers, right-aligned numerics).
- `StatusBadge`, `Meter`, `RunwayRow`, `KeyValueRow`, `FeedRow`, `EmptyState`.

If a page needs a pattern not in this list, add it here first, then use it. A page
never styles its own card, header, table, or metric.

## Motion

- 100–150ms ease `cubic-bezier(0.22, 1, 0.36, 1)` on background/border/color/opacity/transform only.
- No layout-property animation, no page-load choreography. `prefers-reduced-motion` disables all.

## Banned here

Monospace numbers, 9px uppercase mono micro-labels, side-stripe accent borders,
gradient text, glassmorphism, hero-metric tiles, identical icon-card grids,
modals as first resort, em dashes in copy.

## Accessibility

WCAG AA: 4.5:1 body contrast, 3:1 large text/UI, full keyboard nav, visible focus
rings, `prefers-reduced-motion` honored. Status never by color alone (always a
label or icon too); active nav carries `aria-current` since the indicator is color.
