"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

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
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();

    // Create the account server-side. When the service-role key is configured,
    // the account is created already confirmed so the user can sign in right
    // away — no email round-trip (Supabase's default mailer doesn't deliver to
    // arbitrary addresses without SMTP). If the server reports `adminless`, fall
    // back to the standard client-side signUp + email-confirmation flow.
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name, invite: invite || undefined }),
    });
    const result = await res.json().catch(() => ({ error: "Signup failed." }));

    if (!res.ok && !result.adminless) {
      setLoading(false);
      setErr(result.error || "Could not create account.");
      return;
    }

    if (result.adminless) {
      // Standard flow: client signUp triggers the confirmation email (requires
      // SMTP). If confirmation is disabled, signUp returns a session directly.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, invite_token: invite || undefined } },
      });
      if (error) {
        setLoading(false);
        setErr(error.message);
        return;
      }
      if (!data.session) {
        setLoading(false);
        setInfo("Check your inbox to confirm your email, then sign in.");
        return;
      }
    } else {
      // Account created + confirmed server-side — establish the session now.
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        setErr(error.message);
        return;
      }
    }

    // Keep spinner active through the redirect
    if (invite) {
      router.push(`/auth/accept?token=${invite}`);
    } else {
      router.push("/auth/onboarding");
    }
    router.refresh();
  }

  return (
    <div className="card p-7">
      <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>
        {invite ? "Join workspace" : "Create account"}
      </h1>
      <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
        {invite ? "Create your account to accept the invite." : "You'll set up your workspace next."}
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Your name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input
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
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}
        {info && <div className="text-xs" style={{ color: "var(--ok)" }}>{info}</div>}
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
              Creating account…
            </>
          ) : invite ? "Create account & join" : "Create account"}
        </button>
      </form>
      <div className="text-xs text-center mt-5" style={{ color: "var(--fg-4)" }}>
        Have an account?{" "}
        <Link
          href={invite ? `/auth/login?next=${encodeURIComponent(`/auth/accept?token=${invite}`)}` : "/auth/login"}
          style={{ color: "var(--accent)" }}
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
