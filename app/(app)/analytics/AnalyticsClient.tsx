"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

/* ─── Time range filter ─────────────────────────────────────────────────── */

const PRESETS = [
  { label: "7d",  days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "All", days: null },
] as const;

export function TimeRangeFilter({ from, to }: { from: string | null; to: string | null }) {
  const router = useRouter();

  function applyPreset(days: number | null) {
    if (days == null) {
      router.push("?");
      return;
    }
    const t = new Date();
    const f = new Date(Date.now() - days * 86400_000);
    router.push(`?from=${fmt(f)}&to=${fmt(t)}`);
  }

  function fmt(d: Date) {
    return d.toISOString().slice(0, 10);
  }

  function isActive(days: number | null) {
    if (days == null) return !from && !to;
    if (!from || !to) return false;
    const diff = (new Date(to).getTime() - new Date(from).getTime()) / 86400_000;
    return Math.abs(diff - days) < 2;
  }

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {PRESETS.map((p) => (
        <button
          key={p.label}
          onClick={() => applyPreset(p.days)}
          className={isActive(p.days) ? "btn btn-primary" : "btn"}
          style={{ height: 28, padding: "0 12px", fontSize: 12.5 }}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/* ─── Trend charts ──────────────────────────────────────────────────────── */

type TrendPoint = { month: string; value: number | null };

export function TrendChart({
  data,
  label,
  color,
  format,
}: {
  data: TrendPoint[];
  label: string;
  color: string;
  format: (v: number) => string;
}) {
  return (
    <div className="card" style={{ padding: "18px 20px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-3)", marginBottom: 16 }}>
        {label}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--divider)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: "var(--fg-5)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--fg-5)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={format}
          />
          <Tooltip
            contentStyle={{
              background: "var(--elevated)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
              boxShadow: "var(--shadow-2)",
            }}
            formatter={(v: unknown) => [format(v as number), label]}
            labelStyle={{ color: "var(--fg-4)", marginBottom: 4 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: color }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Pipeline stacked bar ──────────────────────────────────────────────── */

type DealStatus = { unanswered: number; drafting: number; review: number; approved: number; total: number };

export function PipelineBar({
  name,
  dueDate,
  counts,
}: {
  name: string;
  dueDate: string | null;
  counts: DealStatus;
}) {
  const { unanswered, drafting, review, approved, total } = counts;
  if (total === 0) return null;

  const pct = (n: number) => `${((n / total) * 100).toFixed(1)}%`;
  const overdue = dueDate && new Date(dueDate) < new Date();

  const segments = [
    { key: "unanswered", count: unanswered, color: "var(--fg-5)" },
    { key: "drafting",   count: drafting,   color: "var(--accent)" },
    { key: "review",     count: review,     color: "var(--warn)" },
    { key: "approved",   count: approved,   color: "var(--ok)" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid var(--divider)" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)" }}>{name}</span>
          {dueDate && (
            <span style={{ fontSize: 11, color: overdue ? "var(--err)" : "var(--fg-4)" }}>
              {overdue ? "overdue" : `due ${dueDate}`}
            </span>
          )}
        </div>
        <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", gap: 1 }}>
          {segments.map((s) =>
            s.count > 0 ? (
              <div
                key={s.key}
                title={`${s.key}: ${s.count}`}
                style={{ width: pct(s.count), background: s.color, minWidth: 2 }}
              />
            ) : null
          )}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--fg-4)", textAlign: "right", whiteSpace: "nowrap" }}>
        {approved}/{total} approved
      </div>
    </div>
  );
}
