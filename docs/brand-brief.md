# Brand identity execution brief

Paste the prompt below into a fresh session to execute. Written 2026-07-03.

---

## Prompt

You are working in the repo at `Desktop/vibe coding/Klovered` (a Next.js app; the dev server config `propello-web` exists in `.claude/launch.json` and serves on port 3000). Work on the existing branch `redesign/instrument-ui`. Commit after each phase with a descriptive message; do NOT push.

**Task: build Klovered's brand identity and marketing pages.** Klovered is an AI-powered RFP response platform (extracts requirements from uploaded RFPs, drafts grounded answers with citations from a company knowledge base, routes them through SME review to export). Buyers: heads of bids/presales at B2B companies. The target feel: modern confident SaaS in the register of Upwork (owned green, approachable, light) and Cursor (typographic restraint, product-as-hero) — NOT generic B2B template.

**Before writing anything:** read `PRODUCT.md`, `DESIGN.md`, and look at `public/design-drafts/draft-b-instrument.html` plus the live app dashboard to absorb the existing "Instrument" design system. If the `/impeccable` skill is available, invoke it for this work (it will load the same two files; the task is brand-register). The reference mockups for the app already exist; your job is the brand layer on top.

### Locked decisions (do not relitigate)

1. Brand color is the existing sage green family, hue ~149: `--accent: oklch(0.50 0.135 149)` with the ramp already in `app/globals.css`. For marketing surfaces add a brighter stop `--leaf: oklch(0.72 0.17 149)` usable only on dark or drenched-green backgrounds, plus a deep anchor `--pine: oklch(0.30 0.09 155)` for drenched sections. Never introduce a second brand hue.
2. Typography is Geist (UI/body/display) + Geist Mono (numbers, labels, eyebrows), loaded from Google Fonts. Marketing display sizes: 56–88px, weight 600–650, letter-spacing -0.03em to -0.045em. No serif, no second family.
3. Wordmark: lowercase `propello` set in Geist 650, tight tracking. Mark: rounded-square tile (radius ~22% of size), sage green fill, white Geist Mono "P". These become favicon and OG image later.
4. Voice: outcome-first, plain sentences, contractions fine, no exclamation marks, no filler ("seamless", "unlock", "empower", "leverage" are banned). Mono numerals carry proof: e.g. "300 questions. 3 days." Draft 3 hero headline candidates and pick the strongest; the claim must be concrete, not vibes.
5. Light-first. The landing page is light canvas like the app; exactly one drenched green CTA band near the footer. A dark Cursor-style hero exists only as variant B for comparison.

### Hard constraints (from DESIGN.md and the impeccable system)

- OKLCH for all colors; never #000 or #fff; tint neutrals toward the brand hue at chroma 0.002–0.01.
- Banned: gradient text, side-stripe borders, glassmorphism, hero-metric tile grids, identical icon-card grids, modals, em dashes in copy (use commas/periods/colons), Title Case (sentence case everywhere), stock-photo imagery.
- The product screenshot in the hero must be a hand-built static HTML recreation of the app dashboard (readings band, Requires-action queue, deals table) inside a browser-chrome frame — not an <img> and not a fake abstract UI.
- All pages self-contained single HTML files (Google Fonts is the only external dependency), placed in `public/design-drafts/brand/`. That path is served without auth (middleware already allows `/design-drafts`), so they're viewable at `http://localhost:3000/design-drafts/brand/<name>.html` and by double-clicking the file.

### Phase 1 — BRAND.md (repo root)

Write the identity reference: positioning statement, 3-word personality, voice rules with 5 do/don't copy pairs, logo construction + clearspace + misuse list, full color system (app tokens + the two marketing stops with hex fallbacks and contrast notes), type scale for marketing vs app, the mono micro-label pattern as a brand signature, and imagery stance (product-real screenshots only, no illustration for now). Keep it under 150 lines; it's a working doc, not a book. Commit.

### Phase 2 — three HTML pages in public/design-drafts/brand/

1. `landing-a-light.html` — full landing page: nav (wordmark, Product, Pricing, Docs, Sign in, "Start free" ink button); hero with mono eyebrow, display headline, subline, dual CTA, and the browser-framed dashboard recreation; a quiet logo wall ("Teams answering RFPs with Klovered", 5–6 grayscale placeholder wordmarks); three alternating feature sections (requirement extraction / grounded drafts with visible citation chips / review-to-export pipeline), each with a small product vignette built in HTML; a stats strip reusing the app's readings-band vocabulary (mono numbers + micro-labels, e.g. answers drafted, avg confidence, citations attached); one testimonial as a large-type pull quote (no card); simple 3-tier pricing (Starter/Team/Enterprise, middle tier accented with a 2px border only); the single drenched-green CTA band; footer with wordmark and column links.
2. `landing-b-dark.html` — the hero section ONLY (nav + hero + logo wall) re-executed on a near-black canvas (oklch ~0.18, green-tinted) with `--leaf` as the accent, so the user can compare hero directions. Do not build the full page twice.
3. `brandbook.html` — one-page visual identity reference: logo block (mark + wordmark at 3 sizes, clearspace diagram), color swatches with token names and hex, type specimen (display/heading/body/mono scales with the real sizes), the signature patterns (micro-label, readings band cell, status tag, count pill) rendered live, and a 6-item do/don't list.

Verify each page in the browser via the preview server at 1440px width and screenshot it. Fix anything that looks broken before presenting. Commit, then present all three URLs and ask the user to pick the hero direction (A or B) and approve moving to phase 3.

### Phase 3 — apply to the app (only after the user picks)

Refine the sidebar wordmark/mark to match BRAND.md; generate `app/icon.svg` (Next.js file-convention favicon) from the mark; restyle the auth pages (login/signup) to the brand (they currently lag the app redesign); if the user chose the dark hero, do NOT dark-mode the app — the app stays light regardless. Keep `npx tsc --noEmit` clean, verify login page renders, commit.

### Phase 4 — sync docs

Update DESIGN.md with the marketing color stops and display type scale; add a Brand section pointer to BRAND.md in PRODUCT.md. Commit.

Throughout: verify in the browser after every page (the preview screenshot tool can be flaky — if it times out twice, verify via DOM inspection with preview_eval instead, and mention it). Report at the end with the URLs, what you built, and the one decision you need from the user.

---

## Notes for the user (not part of the prompt)

- Phase 2 ends with a decision point: hero A (light) vs B (dark). Everything else proceeds without you.
- Total scope is roughly: 1 markdown doc, 3 HTML pages, favicon + auth restyle, 2 doc updates.
- If you want a real designed logo later (beyond the wordmark + tile), that's an external design task; this brief gets you a credible programmatic identity.
