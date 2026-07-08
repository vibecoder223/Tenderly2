import { NextResponse } from "next/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { sendEmail, resetEmail, emailConfigured } from "@/lib/email";
import { getSiteUrl } from "@/utils/site-url";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Sends a password-reset email via Resend.
 *
 * Supabase's own mailer needs SMTP and won't deliver to arbitrary addresses, so
 * we mint the recovery link ourselves with the admin API (generate_link) and
 * send it through Resend. The link lands on the site with an implicit-flow
 * fragment; RecoveryRedirect forwards it to /auth/reset-password.
 *
 * Always responds 200 regardless of whether the address exists or the email
 * actually sent — never leak account existence to an unauthenticated caller.
 */
export async function POST(req: Request) {
  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email || "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (!email || !email.includes("@")) return NextResponse.json({ ok: true });

  // Throttle: 3 sends per email per 15 min, 10 per IP per 15 min. Responses
  // stay identical (200 ok) so throttling never leaks account existence.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (
    !rateLimit(`fp:email:${email}`, 3, 15 * 60_000) ||
    !rateLimit(`fp:ip:${ip}`, 10, 15 * 60_000)
  ) {
    return NextResponse.json({ ok: true });
  }

  const admin = tryCreateAdminClient();
  if (!admin || !emailConfigured()) {
    // Can't mint/send server-side — tell the client to fall back to Supabase's
    // own reset flow (which only delivers if SMTP is configured there).
    return NextResponse.json({ ok: true, fallback: true });
  }

  const isProd = process.env.NODE_ENV === "production";

  try {
    const { data, error } = await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: `${getSiteUrl()}/auth/reset-password` },
    });
    // No such user (or any other error) — swallow to avoid enumeration.
    const link = (data as { properties?: { action_link?: string } } | null)?.properties?.action_link;
    if (error || !link) return NextResponse.json({ ok: true });

    const tpl = resetEmail({ resetUrl: link });
    const sent = await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });

    if (!sent.ok) {
      // Don't fail the request (anti-enumeration), but make the failure visible
      // in server logs instead of silently lying "check your inbox". The most
      // common cause is Resend without a verified domain (it only delivers to
      // the account owner until then — verify a domain + set RESEND_FROM).
      console.error(`[forgot-password] email send failed: ${sent.error}`);
      // Outside production, return the link so the flow is testable without a
      // verified sending domain. Never do this in production.
      if (!isProd) return NextResponse.json({ ok: true, devResetLink: link });
    }
  } catch (e) {
    console.error("[forgot-password]", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ ok: true });
}
