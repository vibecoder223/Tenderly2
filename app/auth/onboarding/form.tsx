"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingForm({
  defaultName,
  email,
}: {
  defaultName: string;
  email: string;
}) {
  const router = useRouter();
  const [orgName, setOrgName] = useState("");
  const [name, setName] = useState(defaultName);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orgName, name }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setErr(error || "Failed to create workspace");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="card p-7">
      <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--fg)" }}>Set up your workspace</h1>
      <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
        Signed in as <span className="mono">{email}</span>.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="label">Workspace / company name</label>
          <input
            className="input"
            placeholder="Acme Corp"
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Your display name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}
        <button type="submit" className="btn btn-primary w-full justify-center mt-2" disabled={loading}>
          {loading ? "Creating workspace…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
