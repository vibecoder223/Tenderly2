# Klovered Free — Public RFP Tool (Design Spec)

**Date:** 2026-07-12
**Status:** Approved for planning
**Author:** brainstormed with the user (Opus)

## 1. Purpose & GTM context

Instead of launching the full Klovered product (workspaces, teams, SME review,
approvals), we ship a **public, no-login tool** that runs the product's core
loop for anyone — in the spirit of iLovePDF / Sejda. This is a go-to-market
wedge: let people experience the "magic moment" for free, then convert.

**The magic moment (the whole product, minus the scaffolding):**

> Upload your company knowledge → upload an RFP → get AI-drafted, cited answers
> to every extracted requirement, exportable to `.docx`.

No sign-up required to try it. Optional Google sign-in to save/keep results.

## 2. Scope

### In scope (v1)
- Anonymous, no-login usage of the full core loop.
- Step 1: add knowledge (upload company docs into a temporary KB).
- Step 2: upload an RFP → extract requirements.
- Step 3: view AI-drafted, cited answers per requirement; export `.docx`.
- Optional **Google sign-in** to persist results beyond the anonymous window
  and unlock higher limits.
- Guardrails appropriate to a public tool (file/size/count caps, rate limiting,
  auto-expiry of anonymous data).

### Out of scope (v1)
- SME review, approvals, assignments, comments.
- Team invites, roles, multi-user workspaces.
- Deal fields / custom fields, the full sidebar app shell.
- Cloud connectors (Drive/Dropbox/etc.).
- Email/password auth (Google only in v1).
- Building a landing page — the marketing site already exists (see §3).

## 3. Landing page — reuse, do not build

The marketing/landing site already exists as a **separate standalone app**:
`vibe coding/klovered-landing-human/` (canonical; live marketing site, ported
1:1 from `Propello/public/design-drafts/brand/landing-human.html`).

Its CTAs already target the product via `NEXT_PUBLIC_APP_URL`. The free tool is
the destination of those CTAs. **No landing screen is built inside the free
tool.** The tool opens directly at Step 1 (add knowledge). We only need to make
sure the marketing site's "Try free" CTA points at the free tool's URL (env
value), and the free tool offers a link back to the marketing site in its
header.

## 4. Code layout — new standalone repo

A brand-new Next.js 14 app, sibling to the others:
`vibe coding/klovered-free/` (name TBD by user; default `klovered-free`).

- **Own repo / own deploy**, decoupled from the main app.
- **Vendors the RAG pipeline lib** from `Propello/lib/`:
  `parse.ts`, `chunk.ts`, `embeddings.ts`, `retrieval.ts`, `rag.ts`,
  `ingest.ts` (and their direct deps, e.g. `mistral.ts`, `agents.ts` as needed).
  Copied in for v1; a later refactor can extract these into a shared package
  (that refactor is explicitly deferred).
- **Points at the same Supabase project** as the main app (same DB, storage,
  pgvector, RLS, migrations). "The backend" = that shared Supabase project.
- **No sidebar / `AppShell`.** A lightweight public shell instead: slim top bar
  with logo, a 3-step indicator, and a "Sign in with Google" button.
- **Reuses the existing visual language verbatim**: the same CSS variables
  (forest-green accent, mono details, light canvas), the same
  `KnowledgeView` dropzone + 7-step `ProgressTracker`, the documents table,
  `CitationChips`, and status badges. The public tool should look like the same
  product, just unlocked.

## 5. Session & identity — Supabase anonymous auth

The entire existing backend is `org_id`-scoped with RLS and
`requireMembership`. We keep that untouched by giving every visitor a real
(anonymous) identity and a throwaway org.

**First action (lazy):**
1. `supabase.auth.signInAnonymously()` → creates a real `auth.users` row.
2. A server route (using the admin/service client) provisions a throwaway
   `organizations` row + a `team_members` row linking the anonymous user to it,
   mirroring the normal onboarding path. This makes `requireMembership` and all
   RLS policies work **exactly as today** — no schema or policy changes.
3. All uploads, chunks, requirements, responses, and citations scope to that
   throwaway org, isolated from every other visitor by the same RLS that
   protects real orgs.

**Isolation is the #1 correctness risk.** Because each visitor mints a real org,
the anonymous org must be provisioned and scoped so that one visitor can never
read another's uploads. This is the security-critical part of the build and
must be verified explicitly (RLS coverage, no service-client leakage of
cross-org rows to the client).

**Upgrade to Google (optional):**
- `supabase.auth.linkIdentity({ provider: 'google' })` upgrades the anonymous
  user **in place** — same `auth.users` row, same org, same data — now
  permanent. No data migration.
- Signed-in users are exempt from auto-expiry (§7) and get higher limits.

## 6. Screens & component reuse

Linear 3-step flow (not the sidebar app). Step state tracked in the URL.

| Step | Screen | Reuses |
|---|---|---|
| 1 | **Add knowledge** — dashed dropzone + 7-step progress + docs table + `add as` type control | `KnowledgeView` / `ProgressTracker` almost as-is |
| 2 | **Upload RFP** — same dropzone, then requirement-extraction progress | dropzone + `ProgressTracker` |
| 3 | **Answers** — requirements list; each row shows the drafted answer, `CitationChips`, confidence, gap flag; `.docx` export | `CitationChips`, export route/`lib/docx-export` |
| — | **Public shell** — slim top bar: logo → marketing site, 3-step indicator, "Sign in with Google" | new, minimal |

Empty/first-run states, and a persistent "your data is temporary — sign in to
keep it" affordance, use the existing tokens and copy tone.

## 7. Guardrails (public tool)

- File caps: keep the existing 50 MB per file. `pdf · docx · txt`.
- Per-anonymous-org caps: max N knowledge docs and max total pages (values TBD
  in plan; conservative defaults). Clear, friendly limit messaging.
- Rate limiting per session/IP on the upload + generate routes.
- **Auto-expiry:** anonymous orgs and their storage objects + `document_chunks`
  purged after **48h** (default; user-adjustable) via a scheduled cleanup job.
  Signed-in (Google) users are exempt.

## 8. Backend reuse & data model

**No new pipeline logic.** The new app calls the vendored pipeline against the
existing tables: `knowledge_documents`, `document_chunks`,
`extracted_requirements`, `questions`/`responses`, `citations`, and the
`knowledge` storage bucket. The only genuinely new server capability is
**anonymous-org provisioning** (§5). Everything else is a thin public wrapper
over code that already exists.

## 9. Model / execution split (who builds what)

This project is built partly on Opus and partly on Fable, by the user's
direction. This section is the handoff contract.

**Opus builds (security-sensitive / architectural):**
1. This spec + the implementation plan.
2. **Anonymous auth + throwaway-org provisioning + RLS verification** (§5) —
   the isolation-critical core.
3. **Vendored-pipeline wiring** against the shared Supabase project (the
   coupling point): env, Supabase clients, and confirming ingest/retrieval/
   generation run end-to-end in the new app.

**Fable builds (mechanical, well-specified, after the above is solid):**
1. Porting `KnowledgeView` + `ProgressTracker` into the public Step 1/2 screens.
2. The 3-step public shell + step indicator + Google sign-in button UI.
3. The Step 3 answers screen (requirements list, `CitationChips`, export
   button UI).

**Handoff point:** once the spec + plan exist and the anon-auth/pipeline
foundation is in place and verified, the UI-porting tasks are handed to Fable.
The plan will tag each task `[opus]` or `[fable]` so the switch is clean.

## 10. Decisions locked in this session

- Core job: **full loop** (KB → RFP → drafted, cited answers), minus review/team.
- Identity: **Supabase anonymous auth**, upgradeable to Google in place.
- Code layout: **separate standalone repo**, vendoring the pipeline lib,
  pointing at the **same Supabase project**.
- Landing: **reuse existing `klovered-landing-human`**, do not build one.
- Retention: **48h** for anonymous data (adjustable).
- Auth options: **Google only** in v1.
- Execution: **Opus** for spec + auth/pipeline core, **Fable** for UI porting.
