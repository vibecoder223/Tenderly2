import { NextResponse } from "next/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";
import { sendEmail, resetEmail, emailConfigured } from "@/lib/email";
import { getSiteUrl } from "@/utils/site-url";

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

  const admin = tryCreateAdminClient();
  if (!admin || !emailConfigured()) {
    // Can't mint/send server-side — tell the client to fall back to Supabase's
    // own reset flow (which only delivers if SMTP is configured there).
    return NextResponse.json({ ok: true, fallback: true });
  }

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
    await sendEmail({ to: email, subject: tpl.subject, html: tpl.html, text: tpl.text });
  } catch {
    // Best-effort; never surface internal failures here.
  }

  return NextResponse.json({ ok: true });
}
