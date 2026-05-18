"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "", label: "Overview" },
  { href: "/documents", label: "Documents" },
  { href: "/questions", label: "Questions" },
  { href: "/compliance", label: "Compliance" },
  { href: "/approvals", label: "Approvals" },
  { href: "/activity", label: "Activity" },
  { href: "/export", label: "Export" },
];

export default function DealTabs({
  dealId,
  counts,
}: {
  dealId: string;
  counts?: { questions?: number; unanswered?: number; approvals?: number };
}) {
  const path = usePathname();
  const base = `/deals/${dealId}`;
  return (
    <div
      className="flex items-center gap-0 border-b px-7"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      {TABS.map((t) => {
        const href = `${base}${t.href}`;
        const active =
          t.href === ""
            ? path === base
            : path === href || path.startsWith(href + "/");
        const badge =
          t.label === "Questions" && counts?.questions != null ? counts.questions :
          t.label === "Approvals" && counts?.approvals != null ? counts.approvals :
          null;
        return (
          <Link
            key={t.href}
            href={href}
            className="flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium"
            style={{
              color: active ? "var(--accent-2)" : "var(--fg-3)",
              borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
              marginBottom: -1,
            }}
          >
            {t.label}
            {badge != null && badge > 0 && (
              <span
                className="num text-[10.5px] px-1.5 py-0.5 rounded-full"
                style={{
                  background: active ? "var(--accent-tint2)" : "var(--bg-2)",
                  color: active ? "var(--accent-2)" : "var(--fg-4)",
                }}
              >
                {badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
