"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewDealForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [value, setValue] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/deals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        client_name: client || null,
        value: value ? Number(value) : null,
        due_date: dueDate || null,
      }),
    });
    setLoading(false);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setErr(error || "Failed");
      return;
    }
    const { deal } = await res.json();
    router.push(`/deals/${deal.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      <div>
        <label className="label">Deal name</label>
        <input
          className="input"
          required
          value={name}
          placeholder="e.g. Acme Corp — Q1 2026 RFP"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <label className="label">Client / company</label>
        <input
          className="input"
          value={client}
          placeholder="Acme Corp"
          onChange={(e) => setClient(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Estimated value (USD)</label>
          <input
            className="input"
            type="number"
            min="0"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div>
          <label className="label">Due date</label>
          <input
            className="input"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>
      {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}
      <div className="pt-2">
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Creating…" : "Create deal"}
        </button>
      </div>
    </form>
  );
}
