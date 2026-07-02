// Shared Instrument UI primitives (DESIGN.md, draft B). Compose these instead
// of hand-rolling markup so every page reads the same. CSS lives in globals.css.
import React from "react";

/** Completion meter: track + fill + mono percentage. */
export function Meter({ pct, width = 72 }: { pct: number | null; width?: number }) {
  if (pct == null) {
    return <span className="meter-pct" style={{ color: "var(--fg-4)" }}>not started</span>;
  }
  return (
    <div className="meter">
      <span className="meter-track" style={{ width }}>
        <span className={`meter-fill${pct >= 100 ? " full" : ""}`} style={{ width: `${pct}%` }} />
      </span>
      <span className="meter-pct">{pct}%</span>
    </div>
  );
}

export type Reading = {
  label: string;
  value: React.ReactNode;
  delta?: React.ReactNode;
  tone?: "warn" | "err" | "ok";
};

/** Full-width readings band for overview screens: mono micro-label + big mono
 *  number + context delta, divided by hairlines. `maxWidth` must match the
 *  max-width of the page content below it (dashboard: 1300, analytics: 1200)
 *  so the band's cell grid lines up with the content instead of overhanging
 *  it on wide screens — the outer bar still spans full width. */
export function ReadingsBand({ items, maxWidth = 1300 }: { items: Reading[]; maxWidth?: number }) {
  return (
    <div className="band">
      <div
        className="band-inner"
        role="list"
        aria-label="Summary"
        style={{ ["--band-cols" as any]: items.length, ["--band-max-width" as any]: `${maxWidth}px` }}
      >
        {items.map((r, i) => (
          <div className="band-cell" role="listitem" key={i}>
            <span className="band-label">{r.label}</span>
            <div className="band-reading">
              <span className={`band-n${r.tone ? " " + r.tone : ""}`}>{r.value}</span>
              {r.delta != null && <span className="band-delta">{r.delta}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Bordered block with a head row (title + optional count + optional link). */
export function Block({
  title,
  count,
  more,
  moreHref,
  children,
  className = "",
}: {
  title: string;
  count?: React.ReactNode;
  more?: string;
  moreHref?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`section-card ${className}`}>
      <div className="section-card-head">
        <div>
          <span className="section-card-title">{title}</span>
          {count != null && <span className="section-card-count">{count}</span>}
        </div>
        {more && moreHref && (
          <a href={moreHref} className="block-more">{more}</a>
        )}
      </div>
      {children}
    </section>
  );
}
