"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/Select";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

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

const ROLE_OPTIONS = ["owner", "admin", "user", "viewer"];

export default function TeamView({
  members,
  invites,
  currentUserId,
  currentUserRole,
  canInvite,
}: {
  members: Member[];
  invites: Invite[];
  currentUserId: string;
  currentUserRole: string;
  canInvite: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [generated, setGenerated] = useState<{ url: string; email: string; reused?: boolean; emailed?: boolean; emailError?: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [rowErr, setRowErr] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  const isOwner = currentUserRole === "owner";
  const canManage = ["owner", "admin"].includes(currentUserRole);
  // Owners can assign any role; admins can't grant or change owner status.
  const assignableRoles = isOwner ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r !== "owner");

  async function changeRole(id: string, newRole: string) {
    setRowErr(null);
    setRowBusy(id);
    const res = await fetch(`/api/team/member/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setRowBusy(null);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setRowErr(error || "Could not change role.");
      return;
    }
    router.refresh();
  }

  async function removeMember(id: string, label: string) {
    if (!confirm(`Remove ${label} from this workspace?`)) return;
    setRowErr(null);
    setRowBusy(id);
    const res = await fetch(`/api/team/member/${id}`, { method: "DELETE" });
    setRowBusy(null);
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: "Failed" }));
      setRowErr(error || "Could not remove member.");
      return;
    }
    router.refresh();
  }
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
    setGenerated({ url: j.url, email, reused: j.reused, emailed: j.emailed, emailError: j.emailError });
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
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px_auto] gap-2 items-end">
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
                <Select
                  value={role}
                  onChange={setRole}
                  minWidth={180}
                  ariaLabel="Invite role"
                  options={[
                    { value: "user", label: "User" },
                    { value: "admin", label: "Admin" },
                    { value: "viewer", label: "Viewer" },
                  ]}
                />
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
                {generated.emailed
                  ? `✓ Invite emailed to `
                  : generated.reused
                  ? "A pending invite already exists — re-share this link with "
                  : "Share this link with "}
                <span className="mono">{generated.email}</span>
                {generated.emailed ? "." : ":"}
              </div>
              {!generated.emailed && generated.emailError && (
                <div className="text-[11px] mb-1.5" style={{ color: "var(--fg-4)" }}>
                  (Email didn’t send: {generated.emailError}. Share the link manually.)
                </div>
              )}
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

      <div className="section-card" style={{ overflow: "visible" }}>
        <div className="section-card-head">
          <div>
            <span className="section-card-title">Members</span>
            <span className="section-card-count">{members.length}</span>
          </div>
          {rowErr && <span className="text-xs" style={{ color: "var(--err)" }}>{rowErr}</span>}
        </div>
        <div className="overflow-x-auto lg:overflow-x-visible">
        <table className="data-table" style={{ minWidth: 560 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              {canManage && <th></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isSelf = m.user_id === currentUserId;
              // Admins can't modify owners; owners can modify anyone.
              const editable = canManage && (m.role !== "owner" || isOwner);
              const lastOwner = m.role === "owner" && members.filter((x) => x.role === "owner").length <= 1;
              return (
                <tr key={m.id}>
                  <td style={{ fontWeight: 550, color: "var(--fg)" }}>
                    {m.name || "—"}
                    {isSelf && (
                      <span className="text-[11px] ml-2" style={{ color: "var(--fg-4)" }}>(you)</span>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 11.5, color: "var(--fg-3)" }}>
                    {m.email}
                  </td>
                  <td>
                    {editable ? (
                      <Select
                        value={m.role}
                        disabled={rowBusy === m.id || lastOwner}
                        ariaLabel="Change member role"
                        onChange={(v) => changeRole(m.id, v)}
                        options={assignableRoles.map((r) => ({ value: r, label: cap(r) }))}
                      />
                    ) : (
                      <span className={`st${m.role === "owner" ? " st-accent" : ""}`}>{m.role}</span>
                    )}
                  </td>
                  <td className="mono" style={{ fontSize: 10.5, color: "var(--fg-4)", fontVariantNumeric: "tabular-nums" }}>
                    {m.created_at.slice(0, 10)}
                  </td>
                  {canManage && (
                    <td style={{ textAlign: "right" }}>
                      {editable && !isSelf && !lastOwner && (
                        <button
                          className="btn btn-danger"
                          disabled={rowBusy === m.id}
                          onClick={() => removeMember(m.id, m.name || m.email)}
                        >
                          {rowBusy === m.id ? "…" : "Remove"}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>

      {invites.length > 0 && (
        <div className="section-card overflow-hidden">
          <div className="section-card-head">
            <div>
              <span className="section-card-title">Pending invites</span>
              <span className="section-card-count">{invites.length}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="data-table" style={{ minWidth: 480 }}>
            <thead>
              <tr>
                <th>Email</th>
                <th>Role</th>
                <th>Expires</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invites.map((inv) => {
                const url = `${origin}/auth/accept?token=${inv.token}`;
                return (
                  <tr key={inv.id}>
                    <td className="mono" style={{ fontSize: 11.5, color: "var(--fg-2)" }}>
                      {inv.email}
                    </td>
                    <td><span className="st">{inv.role}</span></td>
                    <td className="mono" style={{ fontSize: 10.5, color: "var(--fg-4)", fontVariantNumeric: "tabular-nums" }}>
                      {inv.expires_at.slice(0, 10)}
                    </td>
                    <td style={{ textAlign: "right" }}>
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
        </div>
      )}
    </div>
  );
}
