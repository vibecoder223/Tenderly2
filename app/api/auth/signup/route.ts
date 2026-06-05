import { NextResponse } from "next/server";
import { tryCreateAdminClient } from "@/utils/supabase/admin";

/**
 * Server-side signup.
 *
 * Supabase's default "Confirm email" flow requires SMTP. With no custom SMTP
 * configured, the built-in mailer only delivers to project team members and is
 * heavily rate-limited — so real users sign up, are told to "check your inbox",
 * and never receive anything. That's a dead end.
 *
 * When the service-role key is available we create the account already
 * confirmed (email_confirm: true) so the user can sign in immediately. The
 * client then establishes a session with signInWithPassword and proceeds to
 * onboarding. No email round-trip required.
 *
 * If the service-role key isn't set (`adminless`), we tell the client to fall
 * back to the normal client-side signUp + email-confirmation flow.
 *
 * To require real email verification instead, configure SMTP in Supabase and
 * switch this to the standard confirmation flow.
 */
export async function POST(req: Request) {
  let body: { email?: string; password?: string; name?: string; invite?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const invite = typeof body.invite === "string" ? body.invite : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  const admin = tryCreateAdminClient();
  if (!admin) {
    // No elevated access — let the client run the standard email-confirm flow.
    return NextResponse.json({ adminless: true });
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name || undefined, invite_token: invite || undefined },
  });

  if (error) {
    const msg = (error.message || "").toLowerCase();
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      return NextResponse.json(
        { error: "An account with this email already exists. Sign in instead." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message || "Could not create account." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
