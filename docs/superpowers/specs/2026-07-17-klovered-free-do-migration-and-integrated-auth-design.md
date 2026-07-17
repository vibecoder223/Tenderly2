# Klovered Free — DO Postgres migration + integrated auth (Design Spec)

**Date:** 2026-07-17
**Status:** Approved for planning (Opus, brainstormed with the user)
**Supersedes:** `2026-07-17-one-domain-auth-flow-design.md` on two points — see §2.

## 1. Purpose

Bring the whole Klovered Free surface onto one self-hosted stack on DigitalOcean
(DO Managed Postgres + a single Droplet, no Supabase, no Vercel) and give it
**real, integrated sign-in/sign-up in each front-end app** — the marketing site
**and** the free tool — sharing one account per person.

The concrete failures this fixes:
- The free tool (`klovered-free`) still runs on **Supabase** and is **not
  deployed**. It must be rewired onto the Python backend + DO Postgres **before**
  it is deployed.
- The previous auth spec centralized login onto the marketing site only. That is
  wrong: **each app owns its own integrated auth UI**; a person's account is the
  same across both because both hit the same backend + DB.

`klovered.com` is **live now** (marketing site, currently HTTP). Every step below
is sequenced so the live site is only ever changed additively, and the tool
becomes publicly reachable only after it is fully proven on DO Postgres.

## 2. Decisions that supersede the prior spec

1. **Auth UI is integrated into each app, not centralized.** Both
   `klovered-landing-human` (marketing) and `klovered-free` (tool) ship the same
   `AuthModal` component and post to the same backend `/api/auth/*` endpoints.
   There is **no separate auth deployable**. (Supersedes prior decision #3.)
2. **Sign-up upgrades the guest in place.** When a signed-out guest with
   in-progress work signs up, their throwaway org + uploads + answers become the
   new account's data — exactly like `klovered-free`'s current Supabase behavior.
   (Supersedes prior decision #2, "signup always starts clean.")

Everything else from the prior spec stands: guest-first access, one domain with
Caddy path routing, one shared httpOnly session cookie, the tool must move off
Supabase onto the Python backend.

## 3. Target architecture

One Droplet, one domain, DO Managed Postgres in the same VPC. Three app
containers behind Caddy, plus Caddy itself:

```
klovered.com/          -> web      (klovered-landing-human: marketing + integrated auth modal)
klovered.com/app       -> tool     (klovered-free: guest-first RFP tool + integrated auth modal)
klovered.com/api/*     -> api      (Klovered-python: auth + RAG pipeline)
                          Postgres (DO Managed PG, pgvector, RLS) — shared by api only
```

- **One session cookie**, httpOnly, `samesite=lax`, `secure` (HTTPS), scoped to
  the domain. Set by `api` on guest/signup/login/Google-callback; read by every
  route on the domain. This is what makes "log in on marketing → land in `/app`
  already authenticated" work with nothing in the URL, and is what makes the two
  apps share one account.
- **Only `api` talks to Postgres.** Both front-ends are stateless and reach data
  exclusively through `/api/*`. No client ever holds a DB credential.
- **Auth methods (v1):** email/password **and** Google, in both apps.

### Auth UI delivery — Option A (chosen)
Each front-end ships its own copy of `AuthModal` (identical UX, kept in sync by
hand). Rejected: a shared `@klovered/auth` npm package (premature build coupling
for two consumers) and a centralized auth surface (the prior mistake).

## 4. Account & data model (the security-critical part)

Unchanged from what the backend already implements, extended only for
guest-upgrade:

- Every visitor gets a real `users` row (`is_anonymous = true`) + a throwaway
  org via `provision_workspace`, so RLS (`SET LOCAL app.user_id`, `app_user`
  role, `current_user_org_ids()`) isolates every session exactly as for real
  accounts. **Cross-tenant isolation is the #1 correctness risk** and must be
  verified with an explicit test (one guest cannot read another's uploads).
- **Sign-up (guest-upgrade-in-place):** convert the *current guest's* `users`
  row — set `email`, `password_hash`, `is_anonymous = false` — keeping the same
  `id`, org, and all uploaded data. If there is no guest session, create a fresh
  account. Uniqueness on `email` → 409 "sign in instead."
- **Google sign-up from a guest:** the OAuth callback likewise upgrades the
  current guest row in place rather than minting a new user.
- **Login:** unchanged — verifies against an existing non-anonymous account and
  replaces the current session.
- Signed-in accounts are exempt from the 48h guest auto-purge.

## 5. Backend gaps to close before the tool can run on it (Gate 0)

The pipeline code (`app/pipeline/*`) and routers (`auth`, `google_auth`,
`documents`, `knowledge`, `jobs`, `cron`) exist. Before the tool depends on the
backend, close these and prove the loop:

1. `signup` (and the Google callback) → **guest-upgrade-in-place** (§4).
2. Any read/export endpoints the tool's full loop needs that are missing —
   confirmed against the call-site map in §6: read extracted requirements +
   drafted answers for a deal, and **`.docx` export**.
3. **End-to-end verification against DO Postgres**: guest → upload knowledge →
   upload RFP → extracted, cited answers → export `.docx`. Plus the cross-tenant
   isolation test. This is the gate; nothing downstream starts until it passes.

## 6. Tool rewire: klovered-free off Supabase (Phase 1)

`klovered-free` currently reaches Supabase for auth, DB, and storage across ~28
call sites (`utils/supabase/*`, `lib/use-session.ts`, `components/AuthModal.tsx`,
`components/AuthButton.tsx`, and each `app/api/*` route). The rewire:

1. Produce a **call-site map**: each Supabase call → the `/api/*` endpoint that
   replaces it (auth, knowledge list/upload/delete, document upload/process, job
   drain, answers read, export). Endpoints missing on the backend feed back into
   Gate 0 step 2.
2. Delete `utils/supabase/*`; introduce a thin `lib/api.ts` fetch client that
   calls `/api/*` with `credentials: "include"` (cookie auth).
3. Rewire `AuthModal` to post to `/api/auth/{guest,signup,login,logout}` and to
   start the Google flow via `/api/auth/google/start`. Keep the exact UX; add
   email/password + Google; guest-upgrade-in-place on signup.
4. Rewire `lib/use-session.ts` and `AuthButton` to `/api/auth/me` + `logout`.
5. **Verify the whole tool locally** against the backend + DO Postgres: guest
   flow, signup-preserves-work, login, logout, cross-account isolation.

No Supabase references remain after this phase.

## 7. Integrated auth on the marketing site (Phase 2, additive to live)

1. Port the same `AuthModal` into `klovered-landing-human`, posting to the same
   `/api/auth/*`. Wire the header "Sign in" and "Start free" CTAs to open it (or
   route to `/app` for guest start).
2. **Enable HTTPS on `klovered.com`** (Caddy auto-issues once `DOMAIN` is the
   real domain) — required for `secure` cookies and Google OAuth redirect URIs.
   The site is on HTTP today; this flips before Google auth is real.
3. Deploy marketing. Safe: `/app` is not routed yet, so this only *adds* working,
   account-linked login to the live site without risking the tool.

## 8. Containerize + stage the tool (Phase 3, reachable but not on www)

1. Add a `Dockerfile` to `klovered-free` and a `tool` service to
   `docker-compose.stack.yml` (build arg `NEXT_PUBLIC_*` as needed; server-only
   secrets via env).
2. Bring it up on the Droplet and test via a staging path/port **before** the
   public route: guest, signup-preserves-work, and the linkage proof —
   login on marketing → open `/app` → already authenticated via the shared
   cookie.

## 9. Go live (Phase 4, one reversible step)

1. Add the Caddy `handle_path /app/*` → `tool:3000` block; keep `/api/*` → api
   and `/` → web.
2. Smoke-test the live flows.
3. **Rollback** = revert the one Caddyfile block + redeploy Caddy. The tool
   container simply stops receiving traffic; nothing else is affected.

Deploying to the live domain and the final cutover are outward-facing; the code
and staging are done autonomously, but the Phase 4 public cutover is confirmed
with the user before flipping.

## 10. Build order (summary) & model split

| # | Phase | Model |
|---|---|---|
| Gate 0 | Backend: guest-upgrade signup + Google; add missing read/export endpoints; prove loop + isolation on DO PG | `[opus]` |
| 1 | Tool rewire off Supabase onto `/api/*`; rewire AuthModal; verify locally | `[opus]` (5–6, 8), `[fable]` (modal UI polish) |
| 2 | Marketing: integrated AuthModal + CTAs; enable HTTPS; deploy (additive) | `[fable]` UI, `[opus]` HTTPS/cookie/deploy |
| 3 | Dockerize tool + stack service; stage on Droplet; linkage proof | `[opus]` |
| 4 | Caddy `/app` route → go live (user-confirmed) | `[opus]` |

Security-sensitive work (auth, RLS/cross-tenant isolation, live-domain cutover)
stays on Opus. Mechanical, fully-specified UI porting is tagged `[fable]` and
handed off only after Gate 0 + Phase 1 are proven.

## 11. Out of scope (v1)

- Extracting a shared auth package (Option B) — deferred; hand-sync the modal.
- Answer-library / reuse-suggestion, rate-limit, SSRF safe-fetch — tracked in the
  `klovered-python-do-migration` migration notes, ported later.
- Email/password recovery flows on the tool (forgot-password) — after v1.
- Migrating any existing Supabase data — there is no production data to move; the
  tool has never been deployed.
