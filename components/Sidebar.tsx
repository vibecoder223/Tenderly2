"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

type Item = { href: string; label: string; icon: React.ReactNode; shortcut?: string };
type Group = { title: string; items: Item[] };

const groups: Group[] = [
  {
    title: "Workspace",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        shortcut: "⌘1",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
            <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
          </svg>
        ),
      },
      {
        href: "/deals",
        label: "Deals",
        shortcut: "⌘2",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7h-7l-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
          </svg>
        ),
      },
      {
        href: "/my-queue",
        label: "My queue",
        shortcut: "⌘3",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Intelligence",
    items: [
      {
        href: "/knowledge",
        label: "Knowledge base",
        shortcut: "⌘4",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        ),
      },
      {
        href: "/templates",
        label: "Templates",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="9" y1="21" x2="9" y2="9" />
          </svg>
        ),
      },
    ],
  },
  {
    title: "Insights",
    items: [
      {
        href: "/analytics",
        label: "Analytics",
        shortcut: "⌘5",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 3v18h18" /><path d="M7 14l4-4 4 3 5-7" />
          </svg>
        ),
      },
    ],
  },
];

const utility: Item[] = [
  {
    href: "/team",
    label: "Team",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
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
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const [searchVal, setSearchVal] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Close on route change
  useEffect(() => { setMobileOpen(false); }, [path]);

  // Expose toggle to parent via custom event
  useEffect(() => {
    function handle() { setMobileOpen((v) => !v); }
    window.addEventListener("sidebar-toggle", handle);
    return () => window.removeEventListener("sidebar-toggle", handle);
  }, []);

  // Inbox count — fetch once on mount and refresh when the tab regains focus,
  // instead of on every route change (which fired a request per navigation).
  useEffect(() => {
    const load = () =>
      fetch("/api/inbox/count").then(r => r.json()).then(d => setQueueCount(d.count ?? 0)).catch(() => {});
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = searchVal.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    setSearchVal("");
  }

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 29,
            background: "oklch(0.10 0.02 264 / 0.45)",
            backdropFilter: "blur(2px)",
            display: "none",
          }}
        />
      )}
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex flex-col sidebar-rail${mobileOpen ? " sidebar-open" : ""}`}
      style={{
        width: "var(--sidebar)",
        background: "var(--bg-2)",
        borderRight: "1px solid var(--divider)",
      }}
    >
      {/* Brand */}
      <div
        className="flex items-center gap-2.5 px-4"
        style={{
          height: "var(--topbar)",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        <Mark />
        <span
          style={{
            fontSize: 15.5,
            fontWeight: 600,
            letterSpacing: "-0.012em",
            color: "var(--fg)",
          }}
        >
          Propello
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: "8px 8px 4px" }}>
        <form onSubmit={submitSearch}>
          <label style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 5,
            background: "var(--surface)", border: "1px solid var(--border)",
            cursor: "text",
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: "var(--fg-5)", flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              placeholder="Search…"
              style={{
                flex: 1, background: "none", border: "none", outline: "none",
                fontSize: 12.5, color: "var(--fg-2)", minWidth: 0,
              }}
            />
          </label>
        </form>
      </div>

      {/* Primary navigation */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0 12px" }}>
        {groups.map((group, gi) => (
          <div key={group.title} style={{ marginTop: gi === 0 ? 0 : 18 }}>
            <div
              style={{
                fontFamily: "'Geist Mono', ui-monospace, monospace",
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: "0.16em",
                textTransform: "uppercase",
                color: "var(--fg-4)",
                padding: "0 16px 6px",
              }}
            >
              {group.title}
            </div>
            <nav style={{ display: "flex", flexDirection: "column", gap: 1, padding: "0 8px" }}>
              {group.items.map((it) => (
                <NavItem
                  key={it.href}
                  item={it}
                  path={path}
                  badge={it.href === "/my-queue" && queueCount ? queueCount : undefined}
                />
              ))}
            </nav>
          </div>
        ))}
      </div>

      {/* Utility — visually separated, sits above the user card */}
      <div
        style={{
          padding: "8px",
          borderTop: "1px solid var(--divider)",
        }}
      >
        <nav style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {utility.map((it) => (
            <NavItem key={it.href} item={it} path={path} />
          ))}
        </nav>
      </div>

      {/* User card */}
      <div
        className="flex items-center gap-2.5"
        style={{
          padding: "10px 12px",
          borderTop: "1px solid var(--divider)",
          background: "transparent",
        }}
      >
        <div
          className="flex items-center justify-center"
          style={{
            width: 26, height: 26,
            borderRadius: "50%",
            background: "var(--accent-tint)",
            color: "var(--accent-3)",
            fontFamily: "'Geist', sans-serif",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            flexShrink: 0,
          }}
        >
          {(user.name || user.email).slice(0, 2).toUpperCase()}
        </div>
        <div style={{ lineHeight: 1.2, flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--fg)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {user.name || user.email}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--fg-4)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: 1,
            }}
          >
            {orgName}
          </div>
        </div>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            title="Sign out"
            aria-label="Sign out"
            style={{
              padding: 6,
              borderRadius: 5,
              color: "var(--fg-4)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              transition: "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
              display: "inline-flex",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "var(--bg-2)";
              (e.currentTarget as HTMLElement).style.color = "var(--fg-2)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "var(--fg-4)";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </form>
      </div>
    </aside>
    </>
  );
}

function NavItem({ item, path, badge }: { item: Item; path: string; badge?: number }) {
  const active =
    item.href === "/dashboard"
      ? path === "/dashboard"
      : path === item.href || path.startsWith(item.href + "/");

  return (
    <Link
      href={item.href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "6px 10px",
        borderRadius: 5,
        fontSize: 12.5,
        fontWeight: 500,
        background: active ? "var(--surface)" : "transparent",
        color: active ? "var(--fg)" : "var(--fg-3)",
        boxShadow: active ? "inset 0 0 0 1px var(--border)" : "none",
        position: "relative",
        transition: "background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-2)";
          (e.currentTarget as HTMLElement).style.color = "var(--fg-2)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color = "var(--fg-3)";
        }
      }}
    >
      {active && (
        <span
          aria-hidden
          style={{
            width: 4, height: 4, borderRadius: "50%",
            background: "var(--accent)", flexShrink: 0,
            marginRight: -6,
          }}
        />
      )}
      <span
        aria-hidden
        style={{
          width: 16, height: 16,
          display: "inline-flex",
          color: active ? "var(--accent)" : "var(--fg-4)",
          flexShrink: 0,
          transition: "color var(--dur-fast) var(--ease)",
        }}
      >
        {item.icon}
      </span>
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {item.label}
      </span>
      {badge != null && badge > 0 && (
        <span style={{
          fontSize: 10.5, fontWeight: 600, lineHeight: 1,
          padding: "2px 6px", borderRadius: 99,
          background: active ? "var(--accent-tint2)" : "var(--warn-tint, oklch(0.97 0.04 60))",
          color: active ? "var(--accent-2)" : "var(--warn, oklch(0.60 0.15 60))",
          flexShrink: 0,
        }}>
          {badge}
        </span>
      )}
      {item.shortcut && badge == null && (
        <span className="kbd" style={{ flexShrink: 0 }}>{item.shortcut}</span>
      )}
    </Link>
  );
}

function Mark() {
  return (
    <div
      style={{
        width: 24, height: 24,
        borderRadius: 5,
        background: "var(--accent-3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        fontFamily: "'Geist Mono', ui-monospace, monospace",
        fontWeight: 600,
        fontSize: 12,
        color: "oklch(0.97 0.012 152)",
        letterSpacing: "-0.02em",
        lineHeight: 1,
      }}
    >
      P
    </div>
  );
}
