"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function ResetPasswordClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);

  // Supabase recovery links use the implicit flow: the tokens arrive in the URL
  // fragment (#access_token=…&type=recovery). The browser client parses that
  // fragment on construction (detectSessionInUrl) and persists the session to
  // cookies, firing PASSWORD_RECOVERY / SIGNED_IN. We listen for that, also
  // check for an already-established session, and fall back to a timed settle so
  // the page never hangs on "Verifying…".
  useEffect(() => {
    const supabase = createClient();
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      setHasSession(ok);
      setChecking(false);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) finish(true);
    });

    const t = setTimeout(() => {
      supabase.auth.getSession().then(({ data }) => finish(!!data.session));
    }, 1500);

    return () => {
      clearTimeout(t);
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setErr("Passwords do not match.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
    // Session is now active — send them into the app shortly.
    setTimeout(() => {
      router.push("/dashboard");
      router.refresh();
    }, 1200);
  }

  if (checking) {
    return (
      <div className="card p-7" style={{ color: "var(--fg-4)" }}>Verifying reset link…</div>
    );
  }

  if (!hasSession) {
    return (
      <div className="card p-7">
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Link expired</h1>
        <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
          This reset link is invalid or already used. Request a fresh one.
        </p>
        <Link href="/auth/forgot-password" className="btn btn-primary w-full justify-center" style={{ display: "flex" }}>
          Request new link
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="card p-7">
        <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Password updated</h1>
        <p className="text-sm" style={{ color: "var(--fg-4)" }}>
          Signing you in…
        </p>
      </div>
    );
  }

  return (
    <div className="card p-7">
      <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Set a new password</h1>
      <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
        Choose a new password for your account.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">New password</label>
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
        <div>
          <label className="label">Confirm password</label>
          <input
            className="input"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}
        <button type="submit" className="btn btn-primary w-full justify-center mt-2" disabled={loading}>
          {loading ? "Updating…" : "Update password"}
        </button>
      </form>
      <div className="text-xs text-center mt-5" style={{ color: "var(--fg-4)" }}>
        <Link href="/auth/login" style={{ color: "var(--accent)" }}>← Back to sign in</Link>
      </div>
    </div>
  );
}
