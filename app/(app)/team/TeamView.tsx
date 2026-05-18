"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Member = {
  id: string;
  user_id: string;
  name: string | null;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
};
type Invite = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  token: string;
};

export default function TeamView({
  members,
  invites,
  currentUserId,
  canInvite,
}: {
  members: Member[];
  invites: Invite[];
  currentUserId: string;
  canInvite: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ url: string; email: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setGenerated(null);
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    setBusy(false);
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error || "Failed");
      return;
    }
    setGenerated({ url: j.url, email });
    setEmail("");
    router.refresh();
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this invite?")) return;
    await fetch(`/api/team/invite/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="space-y-6">
      {canInvite && (
        <div className="card p-5">
          <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--fg)" }}>Invite a teammate</h2>
          <p className="text-[12.5px] mb-4" style={{ color: "var(--fg-4)" }}>
            Generates a one-time link. They'll be added to this workspace when they sign up or sign in.
          </p>
          <form onSubmit={invite} className="space-y-3">
            <div className="grid grid-cols-[1fr_180px_auto] gap-2 items-end">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  required
                  value={email}
                  placeholder="teammate@yourcompany.com"
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Role</label>
                <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div>
                <button type="submit" className="btn btn-primary" disabled={busy || !email}>
                  {busy ? "Creating…" : "Create invite"}
                </button>
              </div>
            </div>
            {err && <div className="text-xs" style={{ color: "var(--err)" }}>{err}</div>}
          </form>
          {generated && (
            <div className="mt-4 p-3 rounded" style={{ background: "var(--accent-tint)" }}>
              <div className="text-[12px] mb-1.5" style={{ color: "var(--accent-2)" }}>
                Share this link with <span className="mono">{generated.email}</span>:
              </div>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  className="input mono text-[11.5px]"
                  value={generated.url}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button onClick={() => copy(generated.url, "new")} className="btn">
                  {copied === "new" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--divider)" }}>
          <h3 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
            Members ({members.length})
          </h3>
        </div>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ color: "var(--fg-4)" }}>
              <th className="text-left font-medium px-5 py-2.5">Name</th>
              <th className="text-left font-medium px-5 py-2.5">Email</th>
              <th className="text-left font-medium px-5 py-2.5">Role</th>
              <th className="text-left font-medium px-5 py-2.5">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t" style={{ borderColor: "var(--divider)" }}>
                <td className="px-5 py-3 font-medium" style={{ color: "var(--fg)" }}>
                  {m.name || "—"}
                  {m.user_id === currentUserId && (
                    <span className="text-[11px] ml-2" style={{ color: "var(--fg-4)" }}>(you)</span>
                  )}
                </td>
                <td className="px-5 py-3 mono text-[12.5px]" style={{ color: "var(--fg-3)" }}>
                  {m.email}
                </td>
                <td className="px-5 py-3"><span className="badge">{m.role}</span></td>
                <td className="px-5 py-3" style={{ color: "var(--fg-4)" }}>
                  {m.created_at.slice(0, 10)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invites.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b" style={{ borderColor: "var(--divider)" }}>
            <h3 className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
              Pending invites ({invites.length})
            </h3>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ color: "var(--fg-4)" }}>
                <th className="text-left font-medium px-5 py-2.5">Email</th>
                <th className="text-left font-medium px-5 py-2.5">Role</th>
                <th className="text-left font-medium px-5 py-2.5">Expires</th>
                <th className="text-right font-medium px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const url = `${origin}/auth/accept?token=${inv.token}`;
                return (
                  <tr key={inv.id} className="border-t" style={{ borderColor: "var(--divider)" }}>
                    <td className="px-5 py-3 mono text-[12.5px]" style={{ color: "var(--fg-2)" }}>
                      {inv.email}
                    </td>
                    <td className="px-5 py-3"><span className="badge">{inv.role}</span></td>
                    <td className="px-5 py-3" style={{ color: "var(--fg-4)" }}>
                      {inv.expires_at.slice(0, 10)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          className="btn"
                          onClick={() => copy(url, inv.id)}
                          title={url}
                        >
                          {copied === inv.id ? "Copied!" : "Copy link"}
                        </button>
                        {canInvite && (
                          <button className="btn btn-danger" onClick={() => revoke(inv.id)}>
                            Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
