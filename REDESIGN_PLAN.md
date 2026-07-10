# Klovered UI redesign plan

Bring every page in line with the approved dashboard. The dashboard
(`app/(app)/dashboard/page.tsx` + `public/design-drafts/brand/dashboard-refined.html`)
is the visual reference. This doc is the plan; each page is executed as its own
Sonnet session that follows it.

## The one rule

There is **one source of truth**: `DESIGN.md` (the spec) and `components/ui.tsx`
(the shared primitives). No page invents its own colors, fonts, numbers, or card
styles. If a page needs something new, add it to the primitives first, then use it.

## The language shift (why this is needed)

The dashboard moved away from the old "Instrument" system that `DESIGN.md` still
documents. Every other page still follows the old spec, so they diverge. The
redesign reconciles them:

| Element | Old (Instrument, still in DESIGN.md + most pages) | New (approved dashboard) |
|---|---|---|
| Canvas | warm off-white `oklch(0.99 0.003 90)` | near-white `oklch(0.995 0.001 152)` (done in globals.css) |
| Cards | 1px border, **no shadow** (`--shadow-1: none`) | 1px border + soft `--shadow-2` lift |
| All numbers | Geist **Mono** (`.display`, `.band-n`, `.stat-val`, table cells, refs) | Geist **sans**, tabular — mono dropped entirely |
| Section labels | 9px **mono UPPERCASE** micro-label (the "signature") | sentence-case, 11–12.5px |
| Overview metrics | `.band` readings (mono 26px) | `.readings` strip (sans 27px, state color on risk) |
| Active nav | white surface + inset ring + green dot | green-tint pill (`--accent-tint` bg, `--accent-3` text) |
| Timestamps | mono `MM-DD HH:MM` | relative sans ("2 hours ago") |
| Copy | terse, technical | sentence case, human, outcome-first |
| Green usage | same (action + state only) | same — unchanged |

Green stays reserved for **action** (primary buttons) and **state** (active nav,
status dots/numbers). That part of the brand does not change.

---

## Phase 0 — Foundation (must land before any page)

Nothing else starts until this is done, because every page pulls from it.

### 0a. Rewrite `DESIGN.md`
Replace the Instrument spec with the new language. Lock the decisions in
"Open decisions" below. This becomes the spec every page session reads first.

### 0b. Reconcile `app/globals.css` shared classes
Restyle the shared classes **in place** so pages using them update for free,
rather than migrating markup everywhere:
- `.band` / `.band-n` → match `.readings` (sans numbers) OR deprecate in favor of `.readings`.
- `.data-table thead th` → drop 9px mono uppercase; use sentence-case 11px `--fg-4`.
- `.display`, `.stat-val`, `.inline-stat` → Geist sans, per the mono rule.
- `.feed-row` → already restyled (avatar + relative time). Confirm all callers pass the new markup.
- Keep `.readings`, `.rw-row`, `.trust-row`, `.queue-act-primary` (added for the dashboard) as the canonical primitives.

### 0c. Build the layout primitives in `components/ui.tsx` (THE uniformity mechanism)
Pages diverge today because each hand-rolls its shell, cards, and metrics.
Build these once; every page composes only these. See DESIGN.md "Layout
primitives" and "Page anatomy" for the strict contract.
- `Page` — the container (1280px, 28px/24px gutters, `space-y-5`). Every page wraps its body in this.
- `PageHeader` — title + one-line sub. No meta pill, no in-header actions.
- `Readings` / `Reading` — the metrics card. **Retire `ReadingsBand` / `.band`** (migrate `analytics` + `dashboard` onto `Readings`).
- `SectionCard` — the single card (head: title + optional count + subtitle + right link; optional divided second head). **Replace the analytics-local `Section` and the existing `Block`** with this one component.
- `Toolbar`, `SearchField`, `SegmentedTabs`, `FilterChip` — list-page controls.
- `DataTable` — restyled table wrapper (sentence-case headers, right-aligned numerics).
- `StatusBadge`, `Meter`, `RunwayRow`, `KeyValueRow`, `FeedRow`, `EmptyState`.

Definition of done for 0c: `analytics` and `dashboard` both rebuilt on these
primitives and visually identical in shell/spacing/cards. That proves the
primitives enforce uniformity before the other pages start.

---

## Phase 1 — Shared chrome (propagates to every page)

Do these right after foundation; they appear on all pages so fixing them moves everything.
- `components/Sidebar.tsx` — done (green-tint active pill).
- `components/Topbar.tsx` — align to near-white, confirm crumb + quick-find styling.
- `components/DealTabs.tsx`, `components/DealHeader.tsx`, `components/DealDetailsCard.tsx` — the deal workspace chrome on every `deals/[id]/*` page.
- `components/StatusBadge.tsx` — the status vocabulary shared app-wide.

## Phase 2 — High-traffic pages
In rough dependency/traffic order:
1. `analytics` (`page.tsx` + `AnalyticsClient.tsx`) — uses ReadingsBand + charts; heaviest.
2. `my-queue/page.tsx` — queue rows, mono refs.
3. `deals/page.tsx` + `deals/DealsBoard.tsx` — the pipeline board.
4. `deals/[id]/page.tsx` (overview) + tabs: `documents`, `questions`, `questions/[qid]`, `approvals`, `compliance`, `export`, `activity`.
5. `knowledge` (`page.tsx`, `KnowledgeView.tsx`, `AnswersView.tsx`, `KnowledgeTabs.tsx`).

## Phase 3 — Long tail
`team/TeamView`, `templates/TemplatesView`, `library`, `search`, `activity`,
`settings/SettingsForm`, `deals/new/form`, `deals/fields/DealFieldsManager`.

## Phase 4 — Auth + final sweep
- Auth screens (`login`, `signup`, `onboarding`, `accept`, `forgot/reset password`) — mostly conformant already; light pass.
- Final consistency sweep: grep for stray mono numbers, 9px uppercase labels, hardcoded colors; run build + lint; screenshot each page next to the dashboard.

---

## Per-page execution recipe (run this for EACH page with Sonnet)

Every page session does the same checklist so the result is uniform:

1. **Read `DESIGN.md` first** (esp. "Page anatomy", "Box rules", "Page archetypes"), plus this plan and the dashboard as reference.
2. **Pick the archetype** (Overview / List / Detail / Form / Empty) and build that exact skeleton.
3. **Shell** → wrap the body in `Page`; use `PageHeader` (title + sub). Delete any bespoke width/padding/`page-meta` pill; primary action goes to the Topbar.
4. **Metrics** → `Readings` card if the page has KPIs. Never an edge-to-edge band.
5. **Cards** → `SectionCard` only; white + border + `--shadow-2`. No bespoke card CSS, no nested cards, no icon-card grids.
6. **Grid** → Full / Halves / 2:1, gap 20px, equal-height when side-by-side.
7. **Tables/lists** → `DataTable` (or `RunwayRow` when deadline-oriented); lists are rows inside one card.
8. **Numbers/labels** → Geist sans everywhere (tabular where aligned); sentence-case labels; no mono, no 9px uppercase. Mono only in `.kbd`.
9. **Status** → `StatusBadge` vocabulary (dot + label), never color alone. **Green** on primary buttons + active/live state only.
10. **Copy** → sentence case, human, relative timestamps. **Empty states** → `EmptyState`.
11. **Verify** → `npm run build` + `npm run lint` clean; screenshot at desktop and mobile; lay it next to the dashboard — the shell, spacing, and cards must be indistinguishable.

**Definition of done (per page):** builds + lints clean; no mono headline numbers;
no 9px uppercase labels; cards match dashboard elevation; status uses the shared
vocabulary; green only on action/state; reads as the same product as the dashboard.

### Suggested Sonnet prompt per page
> Redesign `<path>` to match the Klovered design system. Read `DESIGN.md` and
> `REDESIGN_PLAN.md` first; the dashboard (`app/(app)/dashboard/page.tsx`) is the
> reference. Follow the per-page recipe in REDESIGN_PLAN.md exactly. Use the
> shared primitives in `components/ui.tsx`; do not hand-roll card/number/label
> styles. Then run build + lint and show me a screenshot.

---

## Confirmed decisions (locked)

1. **Mono numerals** — dropped entirely. All numbers/refs/IDs/timestamps in Geist sans (tabular where aligned). Geist Mono only in `.kbd` shortcut chips.
2. **9px uppercase mono micro-label** — dropped everywhere; sentence-case labels replace it.
3. **Density** — match the dashboard (slightly more spacious, 13.5px base) app-wide.

Direction in one line: clean consumer-SaaS. Geist sans throughout, sentence case,
white cards with soft shadow on near-white canvas, green for action/state only.
