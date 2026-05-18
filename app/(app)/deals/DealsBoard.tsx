"use client";

import Link from "next/link";
import { useMemo } from "react";
import StatusBadge from "@/components/StatusBadge";

type Deal = {
  id: string;
  name: string;
  client_name: string | null;
  status: string;
  value: number | string | null;
  due_date: string | null;
};

const COLUMNS: { key: string; label: string; aliases: string[] }[] = [
  { key: "new", label: "New", aliases: ["new", "open"] },
  { key: "drafting", label: "Drafting", aliases: ["parsing", "drafting", "in_progress"] },
  { key: "under_review", label: "Under review", aliases: ["under_review", "awaiting_approval"] },
  { key: "submitted", label: "Submitted", aliases: ["submitted", "completed", "responded"] },
  { key: "won", label: "Won", aliases: ["won"] },
  { key: "lost", label: "Lost", aliases: ["lost"] },
];

export default function DealsBoard({
  view,
  deals,
  totals,
}: {
  view: "board" | "table";
  deals: Deal[];
  totals: Record<string, { total: number; approved: number }>;
}) {
  const grouped = useMemo(() => {
    const m = new Map<string, Deal[]>();
    for (const col of COLUMNS) m.set(col.key, []);
    for (const d of deals) {
      const col = COLUMNS.find((c) => c.aliases.includes(d.status));
      if (col) m.get(col.key)!.push(d);
      else m.get("new")!.push(d);
    }
    return m;
  }, [deals]);

  if (deals.length === 0) {
    return (
      <div className="card p-14 text-center">
        <h3 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>No deals yet</h3>
        <p className="text-sm mb-5" style={{ color: "var(--fg-4)" }}>
          Create your first deal to start tracking an RFP through to submission.
        </p>
        <Link href="/deals/new" className="btn btn-primary inline-flex">
          Create deal
        </Link>
      </div>
    );
  }

  if (view === "table") {
    return (
      <div className="card overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ color: "var(--fg-4)" }}>
              <th className="text-left font-medium px-5 py-2.5">Deal</th>
              <th className="text-left font-medium px-5 py-2.5">Client</th>
              <th className="text-left font-medium px-5 py-2.5">Status</th>
              <th className="text-left font-medium px-5 py-2.5">Completion</th>
              <th className="text-left font-medium px-5 py-2.5">Due</th>
              <th className="text-right font-medium px-5 py-2.5">Value</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((d) => {
              const t = totals[d.id] ?? { total: 0, approved: 0 };
              const pct = t.total > 0 ? Math.round((t.approved / t.total) * 100) : 0;
              return (
                <tr key={d.id} className="border-t" style={{ borderColor: "var(--divider)" }}>
                  <td className="px-5 py-3">
                    <Link href={`/deals/${d.id}`} className="font-medium" style={{ color: "var(--fg)" }}>
                      {d.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3" style={{ color: "var(--fg-3)" }}>
                    {d.client_name ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-5 py-3" style={{ minWidth: 160 }}>
                    {t.total > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="rounded-full" style={{ width: 80, height: 5, background: "var(--bg-2)" }}>
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: pct >= 100 ? "var(--ok)" : "var(--accent)",
                              borderRadius: 999,
                            }}
                          />
                        </div>
                        <span className="num text-[12px]" style={{ color: "var(--fg-3)" }}>
                          {pct}%
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "var(--fg-5)" }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3" style={{ color: "var(--fg-3)" }}>
                    {d.due_date ? d.due_date.slice(0, 10) : "—"}
                  </td>
                  <td className="px-5 py-3 text-right num" style={{ color: "var(--fg-2)" }}>
                    {d.value ? `$${Number(d.value).toLocaleString()}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${COLUMNS.length}, minmax(220px, 1fr))` }}>
      {COLUMNS.map((col) => {
        const items = grouped.get(col.key) ?? [];
        return (
          <div key={col.key} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span
                className="text-[11.5px] uppercase tracking-wider font-semibold"
                style={{ color: "var(--fg-4)" }}
              >
                {col.label}
              </span>
              <span className="num text-[11.5px]" style={{ color: "var(--fg-5)" }}>
                {items.length}
              </span>
            </div>
            <div className="space-y-2">
              {items.length === 0 && (
                <div
                  className="text-[12px] text-center py-6 rounded"
                  style={{ color: "var(--fg-5)", background: "var(--bg-2)" }}
                >
                  No deals
                </div>
              )}
              {items.map((d) => {
                const t = totals[d.id] ?? { total: 0, approved: 0 };
                const pct = t.total > 0 ? Math.round((t.approved / t.total) * 100) : 0;
                const dueSoon =
                  d.due_date != null &&
                  (new Date(d.due_date).getTime() - Date.now()) / 86_400_000 < 7;
                return (
                  <Link
                    key={d.id}
                    href={`/deals/${d.id}`}
                    className="card p-3 block hover:shadow-s2"
                  >
                    <div className="text-[13px] font-medium leading-tight mb-1" style={{ color: "var(--fg)" }}>
                      {d.name}
                    </div>
                    <div className="text-[11.5px] mb-2" style={{ color: "var(--fg-4)" }}>
                      {d.client_name ?? "No client"}
                    </div>
                    {t.total > 0 && (
                      <div
                        className="rounded-full mb-2"
                        style={{ height: 4, background: "var(--bg-2)" }}
                      >
                        <div
                          style={{
                            width: `${pct}%`,
                            height: "100%",
                            background: pct >= 100 ? "var(--ok)" : "var(--accent)",
                            borderRadius: 999,
                          }}
                        />
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[11px]">
                      <span style={{ color: "var(--fg-4)" }}>
                        {d.value ? `$${Number(d.value).toLocaleString()}` : "—"}
                      </span>
                      <span
                        style={{
                          color: dueSoon ? "var(--warn)" : "var(--fg-4)",
                        }}
                      >
                        {d.due_date ? d.due_date.slice(0, 10) : "—"}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
