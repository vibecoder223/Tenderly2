# Klovered — LinkedIn campaign guidelines (the operating system)

This is the master guideline for producing Klovered's LinkedIn marketing.
Any writer — human or AI — works from this document. It encodes the role, the
audience, the voice, the design system, the production pipeline, and the
quality bar. If a campaign contradicts this file, the campaign is wrong.

Companion docs:
- [MESSAGING_PLAYBOOK.md](MESSAGING_PLAYBOOK.md) — core promise, segment angles, word lists
- [CONTENT_CALENDAR_10.md](CONTENT_CALENDAR_10.md) — the current campaign queue
- `../../BRAND.md` — voice + visual identity source of truth
- `../../../propello-deck/` — the pitch-deck design system (deck.css + fonts.css) all visuals inherit

---

## 1. The role

Act as Head of Marketing, Creative Director, senior SaaS copywriter, growth
marketer, and product designer in one. The job: campaigns that earn attention,
build trust, and book demos. Educate first, sell second. Never salesy. Never
sounds like AI.

Quality bar: Notion, Linear, Stripe, Figma, Vanta, Loom, Clay. If a post
wouldn't sit comfortably next to theirs, rewrite it.

## 2. What Klovered is (and what we sell)

Klovered is an AI-powered proposal and response platform. It answers RFPs,
RFIs, security questionnaires, vendor assessments, due diligence and customer
questionnaires — from the company's own knowledge base. Every answer is
grounded in the customer's documents, cited to its source, or flagged for a
human. It never invents.

**Core value proposition:**
> We help businesses win more opportunities by turning company knowledge into
> fast, accurate responses.

The customer does not buy AI. They buy:
more revenue · faster responses · higher win rates · less repetitive work ·
happier proposal teams · consistent answers · institutional knowledge that
stays · competitive advantage.

**The ladder every message climbs:**
feature → benefit → **transformation** → **identity**.
Sell the top two. "Extracts 255 requirements" is a feature. "Enter every bid
worth winning" is a transformation. "The small firm that competes above its
weight" is an identity. Lead there.

## 3. Audience and their real pains

Bid managers, proposal managers, sales directors, RevOps, founders, SMEs,
mid-market, enterprise. The surface pain is "RFPs take too long." The real
pains — write to these:

- We spend days answering the same questions.
- Nobody knows where the latest answer lives.
- Knowledge is scattered across documents, email, SharePoint.
- Responses are inconsistent across the team.
- Every RFP starts from zero.
- Good answers disappear after every project.
- SMEs can't afford a proposal team.
- Deadlines are dread. Skipped bids are silent revenue loss.

Emotional core: **relief** (the dread ends) and **ambition** (punch above your
weight). Every campaign sells one or both.

## 4. Copy style

- Every sentence earns attention. Never waste words.
- Short paragraphs. White space. One idea per line.
- Hooks, storytelling, curiosity, authority. Emotional tension.
- Sentence case. No exclamation marks. No em dashes. Contractions fine.
- Numbers carry proof. Adjectives don't.
- Banned (BRAND.md): seamless, unlock, empower, leverage, revolutionize,
  effortless, supercharge, magic, world-class, cutting-edge. Also avoid:
  powerful, robust, solution, streamline, game-changer.

Tension patterns that work:
> "Most companies don't lose deals because of price.
> They lose because they couldn't answer fast enough."

> "You probably already have the perfect answer.
> You just can't find it."

> "The average proposal isn't written.
> It's copied."

## 5. Story structure (the non-negotiable arc)

Pain alone is complaining. Every campaign completes the arc:

**Hook → turn (show the product working) → impact (what changes for them) →
proof (a number or a story) → CTA.**

Slide count: **as many slides as the story has ideas, zero filler.** 6–10 is
the healthy range. One idea per slide. Slide 1 stops the scroll; the last
slide asks for exactly one action.

## 6. Visual system (inherit the pitch deck — do not freelance)

All visuals are built with the deck design system in `propello-deck/`:
- **Fonts:** Clash Display (headlines) + Geist (body) + mono micro-labels,
  embedded via `fonts.css` so renders are identical everywhere.
- **Palette (deck.css):** signal `#12B24A`, brand `#00872F`, deep `#00681F`,
  tint `#DCF7E3`, canvas `#FCFCF9`, panel `#F3F6F4`, ink `#13201A`.
  One hue: green. Color is spent on state and brand moments only.
- **Slide grammar:** mono uppercase eyebrow + 56px green rule + Clash headline
  with one green accent phrase. Dark ink slides for statements, light canvas
  for story beats, full signal-green for the CTA. Footer: `NN / NN` counter
  left, `propello` wordmark right. Content vertically centered.
- **Product vignettes:** browser chrome frames with the real UI patterns —
  `cited · 1.0` green chips, `no source · needs a human` amber chips, the
  stats band (255 · <3 min · 100% · 0). These are the visual proof. Use them.
- **Format: 1080×1350 (4:5 portrait) — the LinkedIn standard.** Portrait fills
  more of the mobile feed than square without getting cropped (LinkedIn caps
  previews at 4:5), which lifts dwell time. Never go taller than 4:5.
- **Production:** `propello-linkedin-monday/build-c01.mjs` is the reference
  builder — renders 1080×1350 HTML slides via headless Edge and packs a .pptx
  at a 10×12.5 layout. Copy it per campaign; edit the `slides` array. PNGs land
  in `render-cNN/`.

Image concepts allowed: dashboard mockups, feature spotlights, before/after,
workflow rails, timelines, comparison graphics, stat bands, browser-framed
screenshots with callouts. Screenshots must be real product UI — presentation
can be premium (frames, annotations), the interface itself is never faked.

## 7. Truth discipline (hard rules)

- Only real product capabilities. Never invent features or UI.
- Real numbers only. The proof bank: 255 requirements from a 65-page tender,
  read-to-draft under 3 minutes, 100% cited or flagged, 0 invented answers.
- No certifications we don't hold (no ISO/SOC 2 claims). No invented
  testimonials or logos. "Working toward" is fine; "certified" is fraud.
- We say "cites or flags," never "always right." The honesty is the moat.

## 8. Every campaign ships with

1. Scroll-stopping hook (the first line and slide 1)
2. LinkedIn post copy (short paragraphs, white space)
3. Carousel outline, 6–10 slides, one idea per slide
4. Creative direction (how the visuals carry the message)
5. Image concepts (from the allowed list above)
6. Which product vignettes/screenshots to include
7. One CTA (comment / DM / "send me a real RFP")
8. 3–5 hashtags (#rfp #proposals #bidmanagement #presales #knowledgemanagement)

## 9. Distribution and cadence

- 3–4 posts a week, one campaign each. Post 08:00–09:30 UK.
- Every post ends in a question. Reply to every comment within 2 hours.
- The flagship CTA everywhere: **"Send me a real RFP. I'll run it live."**
  The product is the demo; the demo is the funnel.
- Measure demo requests and RFPs run, not likes.

## 10. How to brief a new campaign (fill this in, nothing else needed)

```
CAMPAIGN BRIEF
- Pillar: [educational / myth / pain / behind-the-product / founder / proof / trend]
- Who exactly: [role + firm size]
- The pain underneath: [the emotional one]
- After-state we're selling: [transformation or identity]
- The ONE idea: [single sentence]
- Proof: [number, story, or "live demo"]
- CTA: [one action]
- Length: [let the story decide; 6–10]
```
