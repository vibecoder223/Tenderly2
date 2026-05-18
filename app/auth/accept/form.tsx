"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptForm({
  token,
  orgName,
  role,
}: {
  token: string;
  orgName: string;
  role: string;
  mode: "accept";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setErr(null);
    const res = await fetch("/api/team/accept", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setBusy(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setErr(error || "Failed");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card p-7">
      <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>
        Join {orgName}
      </h1>
      <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
        You've been invited as <span className="mono">{role}</span>.
      </p>
      {err && <div className="text-xs mb-3" style={{ color: "var(--err)" }}>{err}</div>}
      <button className="btn btn-primary w-full justify-center" onClick={accept} disabled={busy}>
        {busy ? "Joining…" : "Accept invite"}
      </button>
    </div>
  );
}
