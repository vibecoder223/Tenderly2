"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AddQuestion({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reqId, setReqId] = useState("");
  const [text, setText] = useState("");
  const [category, setCategory] = useState("technical");
  const [priority, setPriority] = useState("medium");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        document_id: documentId,
        requirement_id: reqId || null,
        question_text: text,
        category,
        priority,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setText("");
      setReqId("");
      setOpen(false);
      router.refresh();
    } else {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      alert(error || "Failed");
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn">
        + Add question manually
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card p-5 space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Requirement ID</label>
          <input className="input mono" value={reqId} onChange={(e) => setReqId(e.target.value)} placeholder="Q1.1" />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="technical">Technical</option>
            <option value="compliance">Compliance</option>
            <option value="commercial">Commercial</option>
            <option value="operational">Operational</option>
          </select>
        </div>
        <div>
          <label className="label">Priority</label>
          <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Question / requirement text</label>
        <textarea
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          required
          placeholder="Describe the security controls in place for data at rest…"
        />
      </div>
      <div className="flex items-center gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy || !text.trim()}>
          {busy ? "Adding…" : "Add"}
        </button>
        <button type="button" className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
