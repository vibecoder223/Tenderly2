"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { getSiteUrl } from "@/utils/site-url";

export default function ForgotPasswordClient() {
  const params = useSearchParams();
  const initialEmail = params.get("email") || "";
  const [email, setEmail] = useState(initialEmail);
  useEffect(() => {
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

    // Primary path: server mints the recovery link and emails it via Resend
    // (Supabase's own mailer can't deliver without SMTP). The response is always
    // ok and reveals nothing about whether the account exists.
    let fallback = false;
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await res.json().catch(() => ({}));
      fallback = !!j.fallback;
    } catch {
      fallback = true;
    }

    // Fallback (no Resend / no service role): let Supabase try its own flow. The
    // link still lands on the implicit-flow fragment that RecoveryRedirect
    // forwards to /auth/reset-password.
    if (fallback) {
      const supabase = createClient();
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${getSiteUrl()}/auth/reset-password`,
      });
    }

    setLoading(false);
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
