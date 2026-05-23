# Auth Improvements Design

**Date:** 2026-05-23  
**Status:** Approved

## Problems Fixed

| # | Issue | Root cause |
|---|---|---|
| 1 | No forgot-password flow | Simply doesn't exist |
| 2 | No way back to app from auth pages | No session-aware "continue" link |
| 3 | Confirmation/reset emails link to localhost | No `emailRedirectTo` passed; Supabase Site URL is localhost |
| 4 | Signout redirects to localhost in production | `NEXT_PUBLIC_SITE_URL` missing, hardcoded fallback |
| 5 | Login doesn't remember last email | No localStorage pre-fill |

## New Files

- `utils/site-url.ts` — `getSiteUrl()` helper: reads `NEXT_PUBLIC_SITE_URL`, falls back to `http://localhost:3000`
- `app/api/auth/callback/route.ts` — GET handler; exchanges `?code` for session, redirects to `?next` (default `/dashboard`). Handles both email confirmation and password reset.
- `app/auth/forgot-password/page.tsx` — Email form; calls `resetPasswordForEmail(email, { redirectTo: getSiteUrl() + '/api/auth/callback?next=/auth/reset-password' })`; shows neutral success message.
- `app/auth/reset-password/page.tsx` — New-password form shown after reset link. Verifies session is recovery type. Calls `updateUser({ password })`, redirects to `/dashboard`.

## Modified Files

- `app/auth/login/page.tsx` — Add "Forgot password?" link; pre-fill email from localStorage; store email on success; server wrapper shows "Continue as [email] →" banner if session already active.
- `app/auth/signup/page.tsx` — Pass `emailRedirectTo: getSiteUrl() + '/api/auth/callback?next=/dashboard'`; remove dead "check inbox" state (redirects immediately if session, shows link to login if confirmation required).
- `app/api/auth/signout/route.ts` — Use `request.headers.get('origin') ?? getSiteUrl()` instead of hardcoded localhost.
- `.env.local` — Add `NEXT_PUBLIC_SITE_URL=https://tenderly2.vercel.app`

## Flow: Forgot Password

1. Login page → "Forgot password?" → `/auth/forgot-password`
2. User enters email → `resetPasswordForEmail` called with production `redirectTo`
3. User clicks email link → `/api/auth/callback?code=...&next=/auth/reset-password`
4. Callback exchanges code → session created → redirect to `/auth/reset-password`
5. User enters new password → `updateUser({ password })` → redirect to `/dashboard`

## Flow: Email Confirmation (signup)

1. `signUp` called with `emailRedirectTo: getSiteUrl() + '/api/auth/callback?next=/dashboard'`
2. If session immediately (email confirm disabled): redirect to onboarding/accept
3. If confirmation required: show message with link to login (no dead-end)
4. User clicks confirmation link → `/api/auth/callback?code=...&next=/dashboard` → session → dashboard

## Environment Variables

- `NEXT_PUBLIC_SITE_URL` — production URL. Must be set in Vercel project settings AND `.env.local`.
