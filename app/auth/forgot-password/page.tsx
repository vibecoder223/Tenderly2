"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/client";
import { getSiteUrl } from "@/utils/site-url";

export default function ForgotPasswordPage() {
  const params = useSearchParams();
  const initialEmail = params.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  useEffect(() => {
    // In case the search param arrives after hydration
    const p = params.get("email");
    if (p) setEmail(p);
  }, [params]);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getSiteUrl()}/api/auth/callback?next=/auth/reset-password`,
    });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card p-7">
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Check your email</h1>
        <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
          If <span className="mono">{email}</span> has an account, you'll receive a reset link shortly.
        </p>
        <Link href="/auth/login" className="btn w-full justify-center" style={{ display: "flex" }}>
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-7">
      <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Reset password</h1>
      <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
        Enter your email and we'll send a reset link.
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
        {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}
        <button type="submit" className="btn btn-primary w-full justify-center mt-2" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <div className="text-xs text-center mt-5" style={{ color: "var(--fg-4)" }}>
        <Link href="/auth/login" style={{ color: "var(--accent)" }}>← Back to sign in</Link>
      </div>
    </div>
  );
}
