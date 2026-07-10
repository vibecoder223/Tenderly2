# Klovered — authentication & Supabase production setup

This is the checklist to make the (now bypass-free) auth flow fully work in
production. The code enforces email verification natively: a Supabase session is
only issued after a confirmed email, so the app cannot be entered unverified.
The remaining work is Supabase dashboard configuration for **email delivery** and
**redirect URLs** — without those, confirmation emails won't arrive.

## How the flow works now (code)

- **Signup** (`app/auth/signup/page.tsx`): standard `supabase.auth.signUp()` with
  `emailRedirectTo = <site>/auth/confirm?next=…`. When "Confirm email" is on,
  no session is returned and the user sees a "check your inbox" screen with a
  **resend** button. There is no admin `email_confirm` bypass (the old
  `app/api/auth/signup/route.ts` was deleted).
- **Confirm** (`app/auth/confirm/route.ts`): handles both link formats —
  `token_hash`+`type` via `verifyOtp` (cross-device) and `code` via
  `exchangeCodeForSession` (same-browser). Sets the session and redirects to
  `next` (onboarding, or an invite-accept page). Bad/expired links bounce to
  login with a message.
- **Login** (`app/auth/login/page.tsx`): `signInWithPassword`. Supabase natively
  rejects unconfirmed users ("Email not confirmed"), which is mapped to friendly
  copy plus a **resend verification** link.
- **Forgot / reset password**: unchanged and working — recovery link minted via
  `admin.generateLink` and delivered through Resend (`app/api/auth/forgot-password`),
  new password set via `updateUser` on the recovery session.
- **Sessions**: `@supabase/ssr` stores the session in cookies; `middleware.ts`
  refreshes it on every request and guards all non-public routes; server code
  reads the user via `getClaimsUser` (local JWT verification, no round-trip).

## Required environment variables

| Var | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Vercel + `.env.local` | Anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel (server only) | Onboarding org creation, invite lookup, password-reset link minting. **Never** expose to the client. |
| `NEXT_PUBLIC_SITE_URL` | Vercel + `.env.local` | Canonical origin for every auth redirect (e.g. `https://app.klovered.io`). Falls back to `http://localhost:3000`. **Set this in production** or confirmation/reset links point at localhost. |
| `RESEND_API_KEY` | Vercel | Sends invite + password-reset emails |
| `RESEND_FROM` | Vercel | e.g. `Klovered <noreply@klovered.io>` on a verified domain |
| `CRON_SECRET` | Vercel | Protects `/api/jobs/drain` |
| `NEXT_PUBLIC_ENABLE_GOOGLE` | Vercel (optional) | `true` to show the Google button once the provider is configured |

## Supabase dashboard checklist (do these before launch)

### 1. Auth → Providers → Email
- [ ] **Enable "Confirm email"** (Authentication → Providers → Email → "Confirm email" ON). This is what makes verification mandatory. With it off, `signUp` returns a session immediately and users skip verification (acceptable for local dev only).
- [ ] Set **minimum password length** to 8 to match the app's client validation.

### 2. Email delivery — configure SMTP (critical)
Supabase's built-in mailer only sends to project members and is rate-limited, so
confirmation emails to real users **will not arrive** until you configure custom SMTP.
- [ ] Authentication → Emails → SMTP Settings → enable custom SMTP.
- [ ] Easiest path (you already use Resend): create Resend SMTP credentials and paste host `smtp.resend.com`, port `465`, user `resend`, password = a Resend API key, sender = an address on your **verified** Resend domain.
- [ ] Verify your sending domain in Resend (SPF + DKIM + DMARC) — the same domain used for `RESEND_FROM`.
- [ ] Send a test signup to an external inbox (Gmail/Outlook) and confirm it lands in the inbox, not spam.

### 3. URL configuration (Authentication → URL Configuration)
- [ ] **Site URL** = your production origin (e.g. `https://app.klovered.io`).
- [ ] **Redirect allowlist** — add every URL the app redirects to after auth:
  - `https://app.klovered.io/auth/confirm`
  - `https://app.klovered.io/auth/reset-password`
  - `https://app.klovered.io/api/auth/callback`
  - `http://localhost:3000/auth/confirm`
  - `http://localhost:3000/auth/reset-password`
  - `http://localhost:3000/api/auth/callback`
  - (add any preview/staging origins you use)
  Redirects to URLs not on this list are rejected by Supabase.

### 4. Email templates (Authentication → Emails → Templates)
The default templates work with the code as-is (they redirect through `emailRedirectTo`
with a `code`, which `/auth/confirm` handles). For robust **cross-device** confirmation
(open the email on your phone, signed up on your laptop), switch the **Confirm signup**
template link to the token-hash format the confirm route also supports:
- [ ] Set the confirmation link to:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=signup&next=/auth/onboarding`
- [ ] Optionally brand the templates (logo, sender name) to match Klovered.

### 5. Google OAuth (optional)
- [ ] Follow `docs/SUPABASE_GOOGLE_SETUP.md`, enable the Google provider, add the callback URLs above, then set `NEXT_PUBLIC_ENABLE_GOOGLE=true`.

### 6. Session settings (optional hardening)
- [ ] Authentication → Sessions: confirm access-token expiry (default 1h) + refresh-token rotation are acceptable. Defaults are fine for launch.

## Verifying end to end (after the above)

1. Sign up with a real external email → land on "check your inbox".
2. Receive the email → click the link → land in onboarding, signed in.
3. Try signing in **before** confirming → blocked with "Confirm your email first" + a working resend link.
4. Forgot password → receive reset email → set new password → land in the app.
5. Invite a teammate → they receive the invite, sign up, confirm, and land on the accept screen for the correct workspace.
6. Log out → protected routes redirect to login.

## Notes / non-issues

- **No middleware email-verified check is needed**: a session only exists post-confirmation, so a valid session cookie already implies a verified email.
- `/design-drafts` and `/api/jobs/drain` are intentionally public (marketing drafts; cron endpoint guarded by `CRON_SECRET`). Leave as-is.
- The dev-only reset-link echo in `forgot-password` is gated behind `NODE_ENV !== "production"` and never fires in prod.
