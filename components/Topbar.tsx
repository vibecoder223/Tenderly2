import React from "react";

export default function Topbar({
  crumbs,
  actions,
}: {
  crumbs: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-4 px-7 border-b"
      style={{
        height: "var(--topbar)",
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-2 text-[13px] font-medium" style={{ color: "var(--fg-4)" }}>
        {crumbs}
      </div>
      <div className="ml-auto flex items-center gap-2">{actions}</div>
    </header>
  );
}

export function Crumb({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return last ? (
    <b style={{ color: "var(--fg)", fontWeight: 600 }}>{children}</b>
  ) : (
    <>
      <span>{children}</span>
      <span style={{ color: "var(--fg-5)" }}>/</span>
    </>
  );
}
