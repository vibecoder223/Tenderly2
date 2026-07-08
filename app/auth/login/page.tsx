"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

// Stores the last email a user successfully signed in with, so returning
// visitors don't retype it. Browser autofill is unreliable across sessions;
// this is an explicit, predictable prefill.
const LAST_EMAIL_KEY = "propello:last-email";

// The Google provider is disabled in Supabase unless explicitly enabled, so the
// button is hidden by default to avoid a dead-end "provider not enabled" error.
// Set NEXT_PUBLIC_ENABLE_GOOGLE=true once the provider is configured.
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_ENABLE_GOOGLE === "true";

// Map raw Supabase auth errors to actionable, human copy.
function friendlyAuthError(msg: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Incorrect email or password.";
  if (m.includes("email not confirmed")) return "Confirm your email first — check your inbox for the link.";
  if (m.includes("invalid api key")) {
    return "Auth is misconfigured (invalid API key). If you just changed environment variables, restart the dev server so the new key is loaded.";
  }
  if (m.includes("rate limit") || m.includes("too many")) return "Too many attempts. Wait a minute and try again.";
  return msg || "Something went wrong. Try again.";
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card p-7" style={{ color: "var(--fg-4)" }}>Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  // Prefer an explicit ?email= (e.g. forwarded from signup "account exists"),
  // otherwise fall back to the last remembered email once on mount.
  const [email, setEmail] = useState(params.get("email") || "");
  const [password, setPassword] = useState("");
  // Surface errors handed back by the auth callback (e.g. an expired magic /
  // recovery link redirects here with ?error=…). Without this the message is
  // silently dropped and the user just sees a blank login form.
  const [err, setErr] = useState<string | null>(params.get("error"));
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Set when Supabase rejects sign-in because the email isn't confirmed yet —
  // reveals a one-click "resend verification email" affordance.
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (params.get("email")) return; // explicit param wins
    try {
      const remembered = localStorage.getItem(LAST_EMAIL_KEY);
      if (remembered) setEmail(remembered);
    } catch {
      // localStorage unavailable (private mode) — no prefill, no harm.
    }
    // Run once on mount; params is stable for this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email || !email.includes("@")) {
      setErr("Please sign in with your email address.");
      return;
    }
    setLoading(true);
    setNeedsVerify(false);
    setResent(false);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setErr(friendlyAuthError(error.message));
      if ((error.message || "").toLowerCase().includes("email not confirmed")) {
        setNeedsVerify(true);
      }
      return;
    }
    try {
      localStorage.setItem(LAST_EMAIL_KEY, email);
    } catch {
      // ignore — remembering the email is best-effort.
    }
    // Keep spinner active through the redirect
    router.push(next);
    router.refresh();
  }

  async function resendVerification() {
    if (!email) return;
    setResending(true);
    setResent(false);
    setErr(null);
    const supabase = createClient();
    const emailRedirectTo = `${window.location.origin}/auth/confirm?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo },
    });
    setResending(false);
    if (error) {
      setErr(friendlyAuthError(error.message));
      return;
    }
    setResent(true);
  }

  async function signInWithGoogle() {
    setErr(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Route back to our server-side callback which exchanges the code
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setGoogleLoading(false);
      // Provide a clearer, actionable message when the provider isn't enabled
      if (error.message && /provider is not enabled|Unsupported provider/i.test(error.message)) {
        setErr(
          "Google sign-in is not enabled for this project. Enable the Google provider in your Supabase dashboard and add the app callback URLs."
        );
      } else {
        setErr(error.message || "An error occurred while starting Google sign-in.");
      }
    }
  }

  return (
    <div className="card p-7">
      <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Sign in</h1>
      <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
        Welcome back.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <div className="text-xs mt-2" style={{ textAlign: "right" }}>
            <Link href={`/auth/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} style={{ color: "var(--accent)" }}>
              Forgot password?
            </Link>
          </div>
        </div>
        {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}
        {needsVerify && (
          <div className="text-xs" style={{ color: "var(--fg-3)" }}>
            {resent ? (
              <span style={{ color: "var(--ok)" }}>Verification email sent — check your inbox.</span>
            ) : (
              <button
                type="button"
                onClick={resendVerification}
                disabled={resending}
                style={{ color: "var(--accent)", background: "none", border: "none", padding: 0, cursor: "pointer", font: "inherit" }}
              >
                {resending ? "Sending…" : "Resend verification email →"}
              </button>
            )}
          </div>
        )}
        <button type="submit" className="btn btn-primary w-full justify-center mt-2" disabled={loading}>
          {loading ? (
            <>
              <svg
                width="14" height="14"
                viewBox="0 0 14 14"
                fill="none"
                style={{ animation: "spin 0.75s linear infinite", flexShrink: 0 }}
              >
                <circle cx="7" cy="7" r="5.5" stroke="oklch(1 0 0 / 0.35)" strokeWidth="1.5" />
                <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Signing in…
            </>
          ) : "Sign in"}
        </button>
      </form>
      {GOOGLE_ENABLED && (
      <div className="mt-4">
        <button
          type="button"
          className="btn w-full justify-center"
          onClick={signInWithGoogle}
          disabled={googleLoading}
          aria-label="Sign in with Google"
        >
          {googleLoading ? (
            <>
              <svg
                width="14" height="14"
                viewBox="0 0 14 14"
                fill="none"
                style={{ animation: "spin 0.75s linear infinite", flexShrink: 0 }}
              >
                <circle cx="7" cy="7" r="5.5" stroke="oklch(1 0 0 / 0.35)" strokeWidth="1.5" />
                <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Redirecting…
            </>
          ) : (
            <>
              <span style={{ display: "inline-flex", width: 18, height: 18, marginRight: 8 }}>
                <svg viewBox="0 0 46 46" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                  <path fill="#4285F4" d="M23 9.5c3.9 0 7.1 1.3 9.5 3.5l7.1-7.1C36.5 2.1 30.2 0 23 0 14.6 0 7.2 3.8 3 9.4l8.3 6.5C13.6 12 17.9 9.5 23 9.5z"/>
                  <path fill="#34A853" d="M44 23c0-1.6-.2-3.1-.6-4.6H23v9h11.8c-.5 2.7-2 5-4.2 6.5l6.6 5.1C41.1 36.1 44 30 44 23z"/>
                  <path fill="#FBBC05" d="M11.3 28.6A13.5 13.5 0 0 1 10 23c0-1.8.4-3.6 1.1-5.2L3 11.6A23 23 0 0 0 0 23c0 3.7.9 7.2 2.6 10.3l8.7-4.7z"/>
                  <path fill="#EA4335" d="M23 44c7.2 0 13.5-2.1 18.6-5.8l-8.9-6.9C30.1 33.5 26.1 35 23 35c-5.1 0-9.4-2.5-11.7-6.1l-8.3 6.5C7.2 42.2 14.6 44 23 44z"/>
                </svg>
              </span>
              Sign in with Google
            </>
          )}
        </button>
      </div>
      )}
      <div className="text-xs text-center mt-5" style={{ color: "var(--fg-4)" }}>
        New here?{" "}
        <Link href="/auth/signup" style={{ color: "var(--accent)" }}>Create an account</Link>
      </div>
    </div>
  );
}
