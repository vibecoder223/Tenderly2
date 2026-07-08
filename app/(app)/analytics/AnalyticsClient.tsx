"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
} from "recharts";
// Sans axis ticks so charts match the app's typography (no mono numbers).
const axisTick = { fontSize: 10.5, fill: "var(--fg-4)", fontFamily: "'Geist', sans-serif" } as const;

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

/* ─── Funnel + dwell (now two standalone cards, not one split-in-half card) ── */

export type FunnelStep = { label: string; count: number; pctOfPrev: number | null };
export type DwellBar = { label: string; days: number };

export function FunnelChart({ steps }: { steps: FunnelStep[] }) {
  if (steps.every((s) => s.count === 0)) {
    return <div style={{ fontSize: 13, color: "var(--fg-5)" }}>No questions in range</div>;
  }
  return (
    <div>
      {steps.map((step, i) => {
        const maxCount = steps[0]?.count ?? 1;
        const barW = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
        return (
          <div key={step.label} style={{ paddingBottom: 9, borderBottom: i < steps.length - 1 ? "1px solid var(--divider)" : "none", marginBottom: i < steps.length - 1 ? 9 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
              <span style={{ fontSize: 12.5, color: "var(--fg-3)" }}>{step.label}</span>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                <span className="num" style={{ fontSize: 15, fontWeight: 600, color: "var(--fg)" }}>{step.count.toLocaleString()}</span>
                {step.pctOfPrev != null && (
                  <span style={{ fontSize: 11.5, color: step.pctOfPrev >= 70 ? "var(--ok)" : step.pctOfPrev >= 40 ? "var(--warn)" : "var(--err)" }}>
                    {step.pctOfPrev}%
                  </span>
                )}
              </div>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
              <div style={{ width: `${barW}%`, height: "100%", background: i === steps.length - 1 ? "var(--ok)" : "var(--accent)", borderRadius: 3 }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DwellChart({ dwellData }: { dwellData: DwellBar[] }) {
  if (dwellData.length === 0) {
    return <div style={{ fontSize: 13, color: "var(--fg-5)" }}>No completed stages in range yet</div>;
  }
  return (
    <div style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dwellData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={28}>
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
              <Cell key={idx} fill={idx === dwellData.length - 1 ? "var(--ok)" : "var(--accent)"} fillOpacity={0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Win / loss over time — the headline chart for a bid lead ─────────────
 * Stacked won/lost bars per month. Deliberately not a win-rate line: with a
 * handful of deals a month, a % line is noisy and implies more precision
 * than the sample supports. Bar composition tells the same story plainly. */
export type WinLossPoint = { month: string; won: number; lost: number };

export function WinLossChart({ data, activeCount }: { data: WinLossPoint[]; activeCount: number }) {
  const hasAny = data.some((d) => d.won > 0 || d.lost > 0);
  if (!hasAny) {
    return (
      <div style={{ fontSize: 13, color: "var(--fg-4)", padding: "8px 0" }}>
        Win and loss trends appear once deals are marked won or lost.{" "}
        {activeCount > 0 && <>{activeCount} deal{activeCount === 1 ? "" : "s"} in flight now.</>}
      </div>
    );
  }
  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barSize={22}>
          <CartesianGrid stroke="var(--divider)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="month" tick={axisTick} axisLine={false} tickLine={false} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ background: "var(--elevated)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, boxShadow: "var(--shadow-2)" }}
            labelStyle={{ color: "var(--fg-4)", marginBottom: 4 }}
          />
          <Bar dataKey="won" stackId="wl" name="Won" fill="var(--ok)" radius={[0, 0, 0, 0]} />
          <Bar dataKey="lost" stackId="wl" name="Lost" fill="var(--err)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
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
