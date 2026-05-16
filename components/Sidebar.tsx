"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items: { href: string; label: string; icon: React.ReactNode }[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
      </svg>
    ),
  },
  {
    href: "/deals",
    label: "Deals",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      </svg>
    ),
  },
  {
    href: "/library",
    label: "Response library",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" /><path d="M7 14l4-4 4 3 5-7" />
      </svg>
    ),
  },
  {
    href: "/team",
    label: "Team",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function Sidebar({
  user,
  orgName,
}: {
  user: { name: string; email: string };
  orgName: string;
}) {
  const path = usePathname();

  return (
    <aside
      className="fixed inset-y-0 left-0 flex flex-col z-30 border-r"
      style={{ width: "var(--sidebar)", background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div
        className="flex items-center gap-2.5 px-5 border-b"
        style={{ height: "var(--topbar)", borderColor: "var(--border)" }}
      >
        <div
          className="w-[26px] h-[26px] rounded-[7px] relative"
          style={{
            background: "linear-gradient(140deg,#0F1626 0%,#2A3245 70%,#3B47D6 100%)",
            boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
          }}
        >
          <span
            className="absolute"
            style={{
              inset: 7,
              borderLeft: "1.5px solid rgba(255,255,255,0.85)",
              borderBottom: "1.5px solid rgba(255,255,255,0.85)",
              borderBottomLeftRadius: 4,
            }}
          />
        </div>
        <span className="text-[16px] font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
          Tenderly
        </span>
      </div>

      <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] px-3 pt-[18px] pb-1.5" style={{ color: "var(--fg-5)" }}>
        Workspace
      </div>
      <nav className="flex flex-col gap-px px-2">
        {items.map((it) => {
          const active = path === it.href || path.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`nav-item ${active ? "is-active" : ""}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 500,
                background: active ? "var(--accent-tint)" : "transparent",
                color: active ? "var(--accent-2)" : "var(--fg-3)",
              }}
            >
              <span
                style={{ width: 16, height: 16, display: "inline-flex", color: active ? "var(--accent)" : "var(--fg-4)" }}
                aria-hidden
              >
                {it.icon}
              </span>
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div
        className="mt-auto flex items-center gap-2.5 p-3 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-semibold"
          style={{ background: "linear-gradient(135deg,#3B47D6,#5C6BFA)" }}
        >
          {(user.name || user.email).slice(0, 2).toUpperCase()}
        </div>
        <div className="leading-tight flex-1 min-w-0">
          <strong className="text-[12.5px] font-semibold block truncate" style={{ color: "var(--fg)" }}>
            {user.name || user.email}
          </strong>
          <span className="text-[11.5px] block truncate" style={{ color: "var(--fg-4)" }}>
            {orgName}
          </span>
        </div>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            title="Sign out"
            className="p-1.5 rounded hover:bg-[var(--bg-2)]"
            style={{ color: "var(--fg-4)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
  );
}
