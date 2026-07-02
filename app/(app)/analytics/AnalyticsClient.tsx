"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";
import { Meter } from "@/components/ui";

// Mono axis ticks so charts match the app's data typography.
const axisTick = { fontSize: 10, fill: "var(--fg-5)", fontFamily: "'Geist Mono', ui-monospace, monospace" } as const;

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
    if (days == null) { router.push("?"); return; }
    const t = new Date();
    const f = new Date(Date.now() - days * 86400_000);
    router.push(`?from=${fmt(f)}&to=${fmt(t)}`);
  }

  function fmt(d: Date) { return d.toISOString().slice(0, 10); }

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

/* ─── KPI card with optional sparkline ─────────────────────────────────── */

type SparkPoint = { v: number | null };

export function KpiCard({
  label,
  value,
  sub,
  tone,
  sparkData,
  sparkColor,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "ok" | "err" | "warn";
  sparkData?: SparkPoint[];
  sparkColor?: string;
}) {
  const fgColor =
    tone === "ok" ? "var(--ok)" :
    tone === "err" ? "var(--err)" :
    tone === "warn" ? "var(--warn)" :
    "var(--fg)";

  return (
    <div className="card" style={{ padding: "12px 14px", minWidth: 0, overflow: "hidden" }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-4)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <div>
          <div className="num" style={{ fontSize: 22, fontWeight: 600, color: fgColor, lineHeight: 1.1 }}>
            {value}
          </div>
          {sub && (
            <div style={{ fontSize: 11.5, color: "var(--fg-4)", marginTop: 3 }}>{sub}</div>
          )}
        </div>
        {sparkData && sparkData.length > 1 && (
          <div style={{ width: 72, height: 36, flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={sparkColor ?? fgColor}
                  strokeWidth={1.5}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Deals at risk ─────────────────────────────────────────────────────── */

export type DealRiskRow = {
  id: string;
  name: string;
  dueDate: string | null;
  pctDone: number;
  total: number;
  approved: number;
  daysLeft: number | null;
  risk: "red" | "amber" | "green" | "none";
};

export function DealsAtRisk({ rows }: { rows: DealRiskRow[] }) {
  if (rows.length === 0) {
    return <div style={{ fontSize: 13, color: "var(--fg-5)", padding: "8px 0" }}>No active deals</div>;
  }

  const riskColor = {
    red: "var(--err)",
    amber: "var(--warn)",
    green: "var(--ok)",
    none: "var(--fg-4)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {rows.map((row) => {
        const daysLabel =
          row.daysLeft == null ? null :
          row.daysLeft < 0 ? `${Math.abs(row.daysLeft)}d overdue` :
          row.daysLeft === 0 ? "due today" :
          `${row.daysLeft}d left`;

        return (
          <div
            key={row.id}
            style={{ padding: "10px 0", borderBottom: "1px solid var(--divider)" }}
          >
            {/* Top row: name + action */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>
                {row.name}
              </div>
              <a
                href={`/deals/${row.id}/questions`}
                className="block-more"
                style={{ flexShrink: 0 }}
              >
                Open →
              </a>
            </div>
            {/* Meter + days */}
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Meter pct={Math.round(row.pctDone * 100)} width={120} />
              {daysLabel && (
                <span
                  className="mono"
                  style={{ fontSize: 11, color: riskColor[row.risk], fontWeight: row.risk === "red" ? 600 : 400, fontVariantNumeric: "tabular-nums" }}
                >
                  {daysLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Funnel section ─────────────────────────────────────────────────────── */

export type FunnelStep = { label: string; count: number; pctOfPrev: number | null };
export type DwellBar = { label: string; days: number };

export function FunnelSection({
  steps,
  dwellData,
}: {
  steps: FunnelStep[];
  dwellData: DwellBar[];
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
      {/* Funnel steps */}
      <div>
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-4)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Conversion funnel
        </div>
        <div>
          {steps.map((step, i) => {
            const maxCount = steps[0]?.count ?? 1;
            const barW = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
            return (
              <div key={step.label} style={{ paddingBottom: 7, borderBottom: i < steps.length - 1 ? "1px solid var(--divider)" : "none", marginBottom: i < steps.length - 1 ? 7 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--fg-3)" }}>{step.label}</span>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span className="num" style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>{step.count.toLocaleString()}</span>
                    {step.pctOfPrev != null && (
                      <span style={{ fontSize: 11, color: step.pctOfPrev >= 70 ? "var(--ok)" : step.pctOfPrev >= 40 ? "var(--warn)" : "var(--err)" }}>
                        {step.pctOfPrev}%
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "var(--border)", overflow: "hidden" }}>
                  <div style={{ width: `${barW}%`, height: "100%", background: i === steps.length - 1 ? "var(--ok)" : "var(--accent)", borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dwell times — hidden on mobile to save vertical space */}
      <div className="hidden sm:block">
        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--fg-4)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Avg days per stage
        </div>
        {dwellData.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--fg-5)" }}>No data</div>
        ) : (
          <div style={{ height: 120 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dwellData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={18}>
                <CartesianGrid stroke="var(--divider)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}d`} />
                <Tooltip
                  contentStyle={{ background: "var(--elevated)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: unknown) => [`${v}d`, "avg days"]}
                  labelStyle={{ color: "var(--fg-4)", marginBottom: 4 }}
                />
                <Bar dataKey="days" radius={[3, 3, 0, 0]}>
                  {dwellData.map((_, idx) => (
                    <Cell key={idx} fill={idx === dwellData.length - 1 ? "var(--ok)" : "var(--accent)"} fillOpacity={0.75} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Trend chart ────────────────────────────────────────────────────────── */

type TrendPoint = { month: string; value: number | null };

export function TrendChart({
  data,
  label,
  color,
  unit,
}: {
  data: TrendPoint[];
  label: string;
  color: string;
  /** Suffix appended to values (e.g. "%" or "d"). Server-safe (no function prop). */
  unit: string;
}) {
  const format = (v: number) => `${v}${unit}`;
  return (
    <div className="card" style={{ padding: "18px 20px", minWidth: 0, overflow: "hidden" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--fg-3)", marginBottom: 16 }}>
        {label}
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid stroke="var(--divider)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} tickFormatter={format} />
          <Tooltip
            contentStyle={{ background: "var(--elevated)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, boxShadow: "var(--shadow-2)" }}
            formatter={(v: unknown) => [format(v as number), label]}
            labelStyle={{ color: "var(--fg-4)", marginBottom: 4 }}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} activeDot={{ r: 4, fill: color }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
