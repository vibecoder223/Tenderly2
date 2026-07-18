# Klovered — advertising & LinkedIn visual system (the photography layer)

Extends [BRAND.md](../../BRAND.md) for ads and social. It adds one thing the
brand book deliberately left out: **a stock-photography layer**, locked behind
a treatment strict enough that any photo reads unmistakably as Klovered.
Nothing here overrides the brand book; section 7's ban on "stock clichés and
gradient blobs" still stands. This doc defines the only way a photo is allowed in.

Companions: [LINKEDIN_CAMPAIGN_GUIDELINES.md](LINKEDIN_CAMPAIGN_GUIDELINES.md)
(copy system) · [CAMPAIGN_VISUAL_PLAN.md](CAMPAIGN_VISUAL_PLAN.md) (carousels) ·
`../../klovered-deck/` (deck.css + fonts.css tokens all renders inherit).

---

## 1. The photo treatment (the recipe)

A photo earns its place only if it carries the emotion the type can't:
**relief** (the dread ends) or **ambition** (punch above your weight).
Otherwise the frame stays typographic.

Two approved treatments. No third.

### A. Ink scrim (full-bleed hero)
Real color photography, dark and cinematic, under an ink gradient so white
Clash Display type always wins.

- Photo: documentary, candid, available-light. Underexposed is better than bright.
- Scrim: linear-gradient of Ink `#13201A`, **85% opacity at the text side,
  fading to 35%** at the far edge. Text always sits on the ≥85% zone.
- One Signal-green `#12B24A` accent per frame: the accent word in the headline,
  the green rule, or a thin 6px green bar bleeding off one edge. Never two.
- Legibility floor: headline zone must measure ≥7:1 against the scrimmed photo;
  body/subhead ≥4.5:1.

### B. Green duotone (inset / split)
Grayscale photo remapped to the brand ramp: shadows → Ink `#13201A`,
highlights → Green tint `#DCF7E3`, midtones pass through Signal green.

- Build: desaturate 100% → contrast +10% → multiply layer of Signal green
  `#12B24A` → set frame background Ink so blacks stay Ink, not pure black.
- Used inset (framed) or as the photo half of a split. Never full-bleed —
  full-bleed duotone is the drenched-green CTA's job and would dilute it.
- Corner radius 20px when inset, matching the product browser frames.

**Banned regardless of treatment:** gradient blobs, 3D renders, lens flares,
grain filters as decoration, AI-brain glow, any second hue surviving the grade.

## 2. Subjects (true to the audience)

Shoot or source the real world of a bid team. Candid, unstaged, imperfect.

Allowed: a proposal team mid-deadline around a table; one person, laptop open,
office dark around them; a thick printed tender, tabs and highlighter; hands on
a keyboard beside a marked-up requirements list; a whiteboard of numbered
requirements; an empty office at 7pm, one screen still on.

**Banned clichés:** handshakes, rockets, lightbulbs, glowing brains, robot
hands, suited people pointing at charts, stair/arrow metaphors, anyone smiling
at a laptop like it just complimented them.

## 3. Backgrounds and where the photo sits

| Mode | Base | Photo behavior | Use for |
|---|---|---|---|
| INK | `#13201A` | Full-bleed + ink scrim, or duotone inset | Statements, hooks, tension |
| CANVAS | `#FCFCF9` | Duotone inset or split 50/50, never full-bleed | Story beats, explanations |
| PANEL | `#F3F6F4` | Small duotone cut-in beside a big number | Stats, "the math" |
| SIGNAL GREEN | `#12B24A` | **No photo.** Type only, ink text | The one CTA per set |

One drenched-green frame per campaign/set, always the CTA, always photo-free —
that keeps green meaning "go," not "background."

## 4. Layout templates (six, reusable)

All keep the slide grammar: mono uppercase eyebrow → 56–66px green rule →
Clash Display headline with exactly one Signal-green phrase → footer
(`NN / NN` left, lowercase `klovered` wordmark right). Formats: **1080×1350**
(LinkedIn feed, primary), 1080×1080 (square), 1200×628 (link/paid ads —
same grammar, type scaled down one step, photo zone moves right).

1. **T1 · Full-bleed hero (ink scrim).** Photo fills frame; scrim from the
   left/bottom; eyebrow + headline + subhead in the ≥85% zone; green accent
   word. The scroll-stopper. Use once per campaign at most.
2. **T2 · Split 50/50.** Type panel (ink or canvas) left, duotone photo right,
   hard vertical edge. Headline up to 112px. For pain/story beats.
3. **T3 · Statement + photo cut-in.** Poster-scale type (96–132px) on ink or
   canvas; small duotone photo (≈38% width, 20px radius) bottom-right,
   overlapped 24px by the headline block so type visibly wins.
4. **T4 · Proof frame.** PANEL background, mono eyebrow, giant Geist-esque
   display number in Signal green (≈340px), caption, optional tiny duotone
   cut-in. For 255 / 3 days / 0 invented.
5. **T5 · Product frame.** Unchanged from the campaigns: white browser-chrome
   vignette on any background. When the product is the proof, no photo — the
   UI is the image.
6. **T6 · CTA.** Drenched Signal green, ink text, one question, wordmark. No
   photo, no product, nothing else.

Attention logic on a phone feed: T1/T3 lead (emotion at thumb-speed), T5 is
the receipt, T4 the number, T6 the ask. Never two photo frames back to back.

## 5. Stock art-direction shot list

| # | Shot | Framing | Search terms | Template |
|---|---|---|---|---|
| 1 | Person alone at laptop, office dark, screen glow | Wide, subject small, negative space left for type | "working late office laptop dark candid" | T1 |
| 2 | Thick printed tender, sticky tabs, highlighter | Top-down, hard side light | "printed document stack sticky notes annotated" | T2/T3 |
| 3 | Team around table, papers, mid-discussion | Eye level, motion blur OK | "team meeting documents deadline candid office" | T1/T2 |
| 4 | Hands typing beside marked-up requirements list | Close, shallow depth | "hands keyboard printed checklist desk" | T3 |
| 5 | Whiteboard dense with numbered items, marker in hand | Slight angle, real handwriting | "whiteboard planning list startup candid" | T2 |
| 6 | Empty office at dusk, one monitor still on | Wide, moody, tungsten vs blue | "empty office evening monitor glow" | T1 |
| 7 | Coffee cup on printed spreadsheet, late light | Detail shot | "coffee desk documents late night" | T3 cut-in |
| 8 | Person exhaling, leaning back, work done | Medium, genuine relief not grin | "relieved person office desk candid" | T2 (after-state) |
| 9 | Two colleagues reviewing one screen, pointing at text | Over-shoulder | "colleagues reviewing screen document office" | T3 |
| 10 | Stack of ring binders / past proposals on a shelf | Flat, symmetrical | "binder archive shelf office documents" | T4 cut-in |

License real photos (Unsplash+, Pexels, or shot in-house). Faces used in paid
ads need model releases. Every photo passes the grade in section 1 before use.

## 6. Three canonical example ads

Built in `../../klovered-linkedin/build-ads.mjs`, rendered to `render-ads/`.
Placeholder photos demonstrate the treatment; swap per the shot list.

1. **"3 days"** — T1, shot 1 or 6, ink scrim. Eyebrow `THE PROOF`, headline
   "300 questions. **3 days,** not 3 weeks.", subhead "Klovered drafts every
   answer from your own documents. Cited."
2. **"Busywork"** — T2 split, shot 2 duotone right. Eyebrow `THE TAGLINE`,
   headline "Win the bid, **not the busywork.**"
3. **"I don't know"** — T3 on ink, shot 9 duotone cut-in, amber
   `no source · needs a human` chip. Headline "We taught our AI to say
   **'I don't know.'**", subhead "Cited, or flagged. Nothing in between."

## 7. Photography do / don't

| Do | Don't |
|---|---|
| Candid, available-light, documentary | Staged smiles, studio white |
| Ink scrim or green duotone, nothing else | Untreated full-color photo as background |
| One green accent per frame | Green + amber + photo color competing |
| Photo carries relief or ambition | Photo as wallpaper behind type |
| Type wins every frame | Headline hunting for a clear spot |
| Real numbers on the frame (255, 3 days, 0) | Vague claims, invented logos or faces as "customers" |
