# One-domain auth flow: marketing + tool + backend

**Date:** 2026-07-17
**Status:** Approved. Stage 1 (backend cookie sessions) implemented in `Klovered-python`.

## Why this exists

Klovered Free is split across three deployables: the marketing site
(`klovered-landing-human`), the Python backend (`Klovered-python`), and the
tool UI (`klovered-free`, currently still on Supabase). Clicking "Sign in" on
the marketing site landed on a blank page — it pointed at a `/knowledge`
route on the marketing site itself, which doesn't exist there. That surfaced
the real gap: there was no defined process for how sign-in, the tool, and the
backend are supposed to connect. This spec defines that process before any
more code gets written against it.

## Decisions locked in this session

1. **Access model: guest-first.** The tool is usable with zero signup.
   Signing in is optional and exists only to persist data.
2. **Only signed-in accounts persist data.** Guest work is ephemeral (48h
   auto-purge) and never carries into an account. Signing up always starts a
   **fresh** account/workspace — no guest-to-account upgrade. (This
   supersedes an earlier "upgrade guest in place" design built earlier in the
   migration; that code has been removed.)
3. **Sign-in pages live on the marketing site**, not inside the tool.
   `/login` and `/signup` are marketing-site pages that call the backend API
   directly.
4. **One domain, path-routed, shared cookie.** Marketing, the tool, and the
   backend are all served from the same domain via Caddy path routing:
   - `klovered.com/` → marketing site
   - `klovered.com/app` → the tool
   - `klovered.com/api/*` → the Python backend
   A single `httponly`, `samesite=lax` session cookie, scoped to the domain,
   is set by the backend on login/signup and read by every route on that
   domain — including the tool. This is what makes "log in on marketing, land
   in the tool already authenticated" work with nothing in the URL.
5. **The tool must be rewired off Supabase onto the Python backend** for this
   to work at all — a token/cookie minted by the Python backend means
   nothing to Supabase. This is Stage 3 below and is the largest remaining
   piece of the whole migration.

## Process map

### Layout (single domain)
```
klovered.com           marketing (landing, pricing, contact, /login, /signup)
klovered.com/app        the tool (guest-first RFP tool)
klovered.com/api/*      Python backend (accounts, knowledge, RFP pipeline)
```

### Journey A — Guest (no login)
```
klovered.com -> "Start free" -> klovered.com/app
  tool has no cookie -> POST /api/auth/guest -> backend sets a GUEST cookie
  uploads RFP, gets answers. No account. Auto-deletes in 48h.
```

### Journey B — Sign in (existing account)
```
klovered.com -> "Sign in" -> klovered.com/login
  POST /api/auth/login -> backend sets an ACCOUNT cookie
  redirect -> klovered.com/app (reads cookie -> already logged in)
  sees their saved work
```

Journey C (guest-upgrades-on-signup) was considered and explicitly rejected:
only signed-in accounts keep data; there is no bridge from guest to account.

## Build stages

| Stage | What | Status |
|---|---|---|
| 1 | Backend: session cookie set on login/signup/guest/Google callback; `require_guest` accepts the cookie as a fallback to the `Authorization` header; guest-upgrade-on-signup removed from both the password and Google paths; `POST /api/auth/logout` added. | **Done** — `app/cookies.py`, `app/config.py`, `app/routers/auth.py`, `app/routers/google_auth.py`, `app/deps.py`. Unit + integration tests added. |
| 2 | Marketing: real `/login` and `/signup` pages that POST to the backend; wire "Sign in" / "Start free" to real destinations. | Not started. |
| 3 | Tool rewire: `klovered-free` off Supabase onto the Python backend (auth, data, storage, every API route), deployed as the third app under `/app`. | Not started — largest remaining piece. |
| 4 | Domain + HTTPS + path routing live (Caddy `/` -> marketing, `/app` -> tool, `/api` -> backend). Requires the domain's DNS to be pointed at the Droplet (in progress: `klovered.com` A records added at Namecheap). | DNS records added; not yet flipped live in `.env`/Caddy (still `DOMAIN=:80`, IP-only, no `/app` route since the tool isn't deployed yet). |

## Why each stage is sequenced this way

Stage 1 has no user-visible effect on its own (nothing calls it with a
browser cookie yet) but is a prerequisite for Stage 2 (login pages need
something to call) and Stage 3 (the tool needs a cookie-aware backend to
migrate onto). Stage 4 (domain/HTTPS) is independent and can happen in
parallel — it doesn't block 2 or 3, but Google OAuth and the `/app` route
both need it before they're real.

## Explicitly out of scope for this spec

- The actual Stage 3 rewire plan (which of `klovered-free`'s 28 Supabase call
  sites map to which Python endpoint) — that needs its own spec once Stage 2
  is done, given its size.
- docx export, answer-library, `/api/answers` — unrelated deferred backend
  work, tracked separately in `klovered-python-do-migration` memory.
