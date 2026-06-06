"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/Select";

export default function LibraryForm() {
  const router = useRouter();
  const [category, setCategory] = useState("general");
  const [keyword, setKeyword] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/library", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ category, keyword, response_text: text }),
    });
    setBusy(false);
    if (res.ok) {
      setKeyword("");
      setText("");
      router.refresh();
    } else {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      alert(error || "Failed");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Category</label>
          <Select
            value={category}
            onChange={setCategory}
            fullWidth
            options={[
              { value: "general", label: "General" },
              { value: "technical", label: "Technical" },
              { value: "compliance", label: "Compliance" },
              { value: "commercial", label: "Commercial" },
              { value: "operational", label: "Operational" },
            ]}
          />
        </div>
        <div>
          <label className="label">Keyword / topic</label>
          <input className="input" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="security, SLA, pricing" />
        </div>
      </div>
      <div>
        <label className="label">Response text</label>
        <textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} required />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
        {busy ? "Saving…" : "Save to library"}
      </button>
    </form>
  );
}
