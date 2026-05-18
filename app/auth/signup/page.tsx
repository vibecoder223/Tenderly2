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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, invite_token: invite || undefined } },
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    if (!data.session) {
      setInfo("Check your inbox to confirm your email, then sign in.");
      return;
    }
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
          {loading ? "Creating account…" : invite ? "Create account & join" : "Create account"}
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
