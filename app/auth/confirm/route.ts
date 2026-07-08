import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { getSiteUrl } from "@/utils/site-url";
import type { EmailOtpType } from "@supabase/supabase-js";

export const runtime = "nodejs";

/**
 * Email confirmation landing route.
 *
 * Handles both link formats Supabase can produce:
 *  - token_hash + type  (verifyOtp — works cross-device; custom email template)
 *  - code               (exchangeCodeForSession — same-browser PKCE, default template)
 *
 * On success the session cookies are set and the user is sent to `next`
 * (their onboarding, or an invite-accept page). On failure they're bounced to
 * login with an explanatory message rather than a blank screen.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const rawNext = searchParams.get("next") ?? "/auth/onboarding";
  const next = rawNext.startsWith("/") ? rawNext : "/auth/onboarding";
  const dest = `${getSiteUrl()}${next}`;

  const supabase = createClient(await cookies());

  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(dest);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(dest);
  }

  const url = new URL(`${getSiteUrl()}/auth/login`);
  url.searchParams.set("error", "This confirmation link is invalid or has expired. Sign in to request a new one.");
  return NextResponse.redirect(url.toString());
}
