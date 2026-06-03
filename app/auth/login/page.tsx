"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";

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

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email || !email.includes("@")) {
      setErr("Please sign in with your email address.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setErr(error.message);
      return;
    }
    // Keep spinner active through the redirect
    router.push(next);
    router.refresh();
  }

  async function signInWithGoogle() {
    setErr(null);
    setGoogleLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}${next}`,
      },
    });
    if (error) {
      setGoogleLoading(false);
      setErr(error.message);
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
        </div>
        {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}
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
      <div className="mt-4">
        <button
          type="button"
          className="btn btn-ghost w-full justify-center"
          onClick={signInWithGoogle}
          disabled={googleLoading}
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
            "Sign in with Google"
          )}
        </button>
      </div>
      <div className="text-xs text-center mt-5" style={{ color: "var(--fg-4)" }}>
        New here?{" "}
        <Link href="/auth/signup" style={{ color: "var(--accent)" }}>Create an account</Link>
      </div>
    </div>
  );
}
