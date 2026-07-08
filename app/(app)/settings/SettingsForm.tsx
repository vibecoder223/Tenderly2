"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/Select";

export default function SettingsForm({
  orgName,
  settings,
}: {
  orgName: string;
  settings: {
    default_ai_tone: string;
    ai_model: string;
    max_monthly_tokens: number;
  };
}) {
  const router = useRouter();
  const [tone, setTone] = useState(settings.default_ai_tone);
  const [model, setModel] = useState(settings.ai_model);
  const [maxTokens, setMaxTokens] = useState(settings.max_monthly_tokens);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInfo(null);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        default_ai_tone: tone,
        ai_model: model,
        max_monthly_tokens: Number(maxTokens),
      }),
    });
    setBusy(false);
    setInfo(res.ok ? "Saved." : "Failed to save.");
    if (res.ok) router.refresh();
  }

  return (
    <form onSubmit={save} className="card p-6 space-y-4">
      <div>
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--fg)" }}>
          {orgName}
        </h2>
        <p className="text-xs mb-4" style={{ color: "var(--fg-4)" }}>
          AI defaults applied to new RFPs in this workspace.
        </p>
      </div>
      <div>
        <label className="label">Default tone</label>
        <Select
          value={tone}
          onChange={setTone}
          fullWidth
          options={[
            { value: "formal", label: "Formal" },
            { value: "technical", label: "Technical" },
            { value: "consultative", label: "Consultative" },
          ]}
        />
      </div>
      <div>
        <label className="label">AI model</label>
        <input className="input mono" value={model} onChange={(e) => setModel(e.target.value)} />
        <div className="text-[11px] mt-1" style={{ color: "var(--fg-4)" }}>
          Server uses the LLM_MODEL env var if set, else this.
        </div>
      </div>
      <div>
        <label className="label">Monthly token budget</label>
        <input
          className="input num"
          type="number"
          min="0"
          step="1000"
          value={maxTokens}
          onChange={(e) => setMaxTokens(Number(e.target.value))}
        />
      </div>
      {info && <div className="text-xs" style={{ color: info === "Saved." ? "var(--ok)" : "var(--err)" }}>{info}</div>}
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}
