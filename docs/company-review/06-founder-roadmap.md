# Klovered — prioritized founder roadmap

One page. Order matters; nothing in a later block before the block above it is done,
except sales conversations, which start now and never stop.

## Block 0 — this week

1. **Fix the three P0s from the audit** (doc 04): real email verification via verified
   Resend domain + Supabase SMTP; rate limits + generic messaging on auth routes; SPF/DKIM/
   DMARC. These are the difference between "demo" and "product a stranger can sign up for."
2. **Pick one price list** ($79/$149/custom is now in the deck and business plan) and apply
   it to the landing page; rename the `tenderly` package remnant.
3. **Fill the deck's team slide** (three `[ Role ]` placeholders) and the ask amount on
   slide 20. The deck is otherwise send-ready: `../klovered-deck/klovered-pitch.pptx`.

## Block 1 — weeks 2–4: pilot-ready

4. Paid Mistral tier is already configured (15 RPM / 400K TPM extraction, 100 RPM / 100K TPM
   generation). The top speed win left is the **single-drain lock** (audit P1-4): stop
   concurrent drains from double-counting the rate budget and tripping 429s.
5. RLS assertion test + upload hardening (audit P1-5, P1-6). Run the full UAT plan
   (doc 04 §5) once, fix what falls out.
6. Enable the LLM confidence scorer for export-bound answers (`RAG_USE_CONFIDENCE_LLM=1`)
   — pilots are trust demonstrations.
7. Minimal CI: lint + grounding audit on every push.
8. Ship the landing page from the approved draft (`public/design-drafts/brand/landing-human.html`)
   with the demo-booking CTA wired up.

## Block 2 — months 2–6: 20 design partners

9. Run GTM phase 1 exactly as the deck states it: 100-firm target list from the network,
   warm outreach, live demo on their own RFP, $500 30-day paid pilot, convert at 50% to
   annual Team plans. Founder does every demo.
10. Onboarding is the product: white-glove KB setup for every pilot; write down the
    playbook as you go (it becomes the CS hire's manual).
11. Publish 3 LinkedIn posts a week from the 30-post bank (doc 05). Every converted pilot
    becomes a case study with numbers.
12. Instrument the two metrics that decide everything: minutes-to-first-draft and
    pilot→paid conversion.

## Block 3 — months 6–12: repeatable

13. Hire CS at 10 paying teams; sales at ~$20k MRR (triggers, not dates).
14. Move background jobs to a managed queue when retry visibility becomes support load;
    Upstash-backed rate gate when multi-instance 429s appear (doc 03 growth stage).
15. Security questionnaire mode (same engine, adjacent market) once two customers ask.
16. Raise the pre-seed on pilot traction, or skip it if conversion funds the hires.

## What NOT to do (repeat as needed)

No paid ads before 10 reference customers. No SOC 2 before a deal demands it. No second
product surface before the answer library is loved. No infrastructure work ahead of the
stage table in doc 03. No hires before their trigger.
