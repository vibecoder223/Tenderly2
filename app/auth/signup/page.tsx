"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function Spinner() {
  return (
    <svg
      width="14" height="14" viewBox="0 0 14 14" fill="none"
      style={{ animation: "spin 0.75s linear infinite", flexShrink: 0 }}
      aria-hidden="true"
    >
      <circle cx="7" cy="7" r="5.5" stroke="oklch(1 0 0 / 0.35)" strokeWidth="1.5" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="card p-7" style={{ color: "var(--fg-4)" }}>Loading…</div>}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const invite = params.get("invite") || "";
  const prefilledEmail = params.get("email") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [exists, setExists] = useState(false); // email already has an account
  const [loading, setLoading] = useState(false);

  // After a successful signUp we switch to a "check your inbox" view. Holds the
  // address the confirmation email was sent to (also gates the resend button).
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  // Where the user should land AFTER they confirm their email.
  const next = invite ? `/auth/accept?token=${invite}` : "/auth/onboarding";
  const emailRedirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`
      : undefined;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setExists(false);

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();
    if (!EMAIL_RE.test(cleanEmail)) {
      setErr("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();

    // Standard Supabase signup. Email confirmation is enforced by the project's
    // auth settings: when "Confirm email" is on, no session is returned and the
    // user must click the link in their inbox before they can sign in. There is
    // no admin bypass — a session only exists after a verified email.
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { name: cleanName || undefined, invite_token: invite || undefined },
        emailRedirectTo,
      },
    });

    if (error) {
      setLoading(false);
      const m = error.message.toLowerCase();
      if (m.includes("already") || m.includes("registered") || m.includes("exists")) {
        setExists(true);
        setErr("An account with this email already exists.");
      } else if (m.includes("rate limit") || m.includes("too many")) {
        setErr("Too many attempts. Wait a minute and try again.");
      } else {
        setErr(error.message);
      }
      return;
    }

    // Confirmations disabled at the project level: a session is returned, so
    // send the user straight into onboarding (used in local/dev setups).
    if (data.session) {
      router.push(next);
      router.refresh();
      return;
    }

    // Confirmation required — show the "check your inbox" state.
    setLoading(false);
    setSentTo(cleanEmail);
  }

  async function resend() {
    if (!sentTo) return;
    setResending(true);
    setResent(false);
    setErr(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: sentTo,
      options: { emailRedirectTo },
    });
    setResending(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setResent(true);
  }

  // ─── Confirmation-sent view ──────────────────────────────────────────────
  if (sentTo) {
    return (
      <div className="card p-7">
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>
          Check your inbox
        </h1>
        <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
          We sent a verification link to <strong style={{ color: "var(--fg)" }}>{sentTo}</strong>.
          Click it to confirm your email, then sign in.
        </p>
        <div
          className="text-xs mb-4"
          style={{ color: "var(--fg-3)", background: "var(--bg-2)", padding: "12px 14px", borderRadius: 8, lineHeight: 1.6 }}
        >
          Didn&apos;t get it? Check spam, or resend below. The link expires after a while — if it does, just sign in and request a new one.
        </div>
        {err && <div className="text-xs mb-3" style={{ color: "var(--err)" }}>{err}</div>}
        {resent && <div className="text-xs mb-3" style={{ color: "var(--ok)" }}>Sent. Check your inbox again.</div>}
        <button
          type="button"
          className="btn w-full justify-center"
          onClick={resend}
          disabled={resending}
        >
          {resending ? (<><Spinner /> Resending…</>) : "Resend verification email"}
        </button>
        <div className="text-xs text-center mt-5" style={{ color: "var(--fg-4)" }}>
          Already confirmed?{" "}
          <Link
            href={`/auth/login?email=${encodeURIComponent(sentTo)}${invite ? `&next=${encodeURIComponent(next)}` : ""}`}
            style={{ color: "var(--accent)" }}
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // ─── Signup form view ────────────────────────────────────────────────────
  return (
    <div className="card p-7">
      <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>
        {invite ? "Join workspace" : "Create account"}
      </h1>
      <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
        {invite ? "Create your account to accept the invite." : "You'll set up your workspace next."}
      </p>
      <form onSubmit={submit} className="space-y-3" noValidate>
        <div>
          <label className="label" htmlFor="su-name">Your name</label>
          <input id="su-name" className="input" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="su-email">Email</label>
          <input
            id="su-email"
            className="input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={!!prefilledEmail}
            style={prefilledEmail ? { background: "var(--bg-2)" } : undefined}
          />
        </div>
        <div>
          <label className="label" htmlFor="su-password">Password</label>
          <input
            id="su-password"
            className="input"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="text-xs mt-2" style={{ color: "var(--fg-4)" }}>At least 8 characters.</div>
        </div>
        {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}
        {exists && (
          <div className="text-xs">
            <Link
              href={`/auth/login?email=${encodeURIComponent(email.trim().toLowerCase())}${invite ? `&next=${encodeURIComponent(next)}` : ""}`}
              style={{ color: "var(--accent)" }}
            >
              Sign in to your account →
            </Link>
          </div>
        )}
        <button type="submit" className="btn btn-primary w-full justify-center mt-2" disabled={loading}>
          {loading ? (<><Spinner /> Creating account…</>) : invite ? "Create account & join" : "Create account"}
        </button>
      </form>
      <div className="text-xs text-center mt-5" style={{ color: "var(--fg-4)" }}>
        Have an account?{" "}
        <Link
          href={invite ? `/auth/login?next=${encodeURIComponent(next)}` : "/auth/login"}
          style={{ color: "var(--accent)" }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
