import Link from "next/link";
import StatusBadge, { dealStatusLabels } from "@/components/StatusBadge";
import CloneDealButton from "@/components/CloneDealButton";

export default function DealHeader({
  deal,
  completion,
}: {
  deal: {
    id: string;
    name: string;
    client_name: string | null;
    status: string;
    value: number | string | null;
    due_date: string | null;
  };
  completion?: { approved: number; total: number };
}) {
  const pct =
    completion && completion.total > 0
      ? Math.round((completion.approved / completion.total) * 100)
      : null;
  const dueSoon =
    deal.due_date != null && (new Date(deal.due_date).getTime() - Date.now()) / 86_400_000 < 7;

  return (
    <header
      className="py-3.5 md:py-4 border-b flex flex-col gap-3 md:flex-row md:items-start md:gap-6 pl-[52px] pr-4 md:px-7"
      style={{ background: "var(--surface)", borderColor: "var(--divider)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="crumbs" style={{ marginBottom: 4 }}>
          <Link href="/deals" style={{ color: "var(--fg-4)", textDecoration: "none" }}>Deals</Link>
          <span className="sep">/</span>
          <span className="curr" style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11.5 }}>
            {deal.client_name ?? "—"}
          </span>
        </div>
        <div className="page-title-row" style={{ gap: 10, flexWrap: "wrap" }}>
          <h1 className="page-title" style={{ wordBreak: "break-word" }}>{deal.name}</h1>
          <StatusBadge
            status={deal.status}
            label={dealStatusLabels[deal.status] ?? deal.status}
          />
        </div>
      </div>

      <div className="flex items-end gap-x-5 gap-y-3 flex-wrap md:items-start md:self-start">
        <Meta label="value">
          <span style={{ fontFamily: "'Geist', sans-serif", fontWeight: 700, letterSpacing: "-0.022em", fontSize: 17, color: "var(--fg)" }}>
            {deal.value ? (
              <>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: 11, color: "var(--fg-4)", fontWeight: 500, marginRight: 1 }}>$</span>
                {Number(deal.value).toLocaleString()}
              </>
            ) : "—"}
          </span>
        </Meta>
        <Meta label="due">
          <span
            className="mono"
            style={{ color: dueSoon ? "var(--warn)" : "var(--fg-2)", fontSize: 13, fontWeight: dueSoon ? 600 : 500 }}
          >
            {deal.due_date ? deal.due_date.slice(0, 10) : "—"}
          </span>
        </Meta>
        <Meta label="completion">
          {pct == null ? (
            <span className="mono" style={{ fontSize: 13, color: "var(--fg-4)" }}>—</span>
          ) : (
            <div className="flex items-center gap-2">
              <div style={{ width: 72, height: 4, background: "var(--bg-2)", borderRadius: 2, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    background: pct >= 100 ? "var(--ok)" : "var(--accent)",
                  }}
                />
              </div>
              <span className="mono num" style={{ fontSize: 12, color: "var(--fg-3)" }}>{pct}%</span>
            </div>
          )}
        </Meta>
        <div className="self-center md:self-start md:mt-1">
          <CloneDealButton dealId={deal.id} />
        </div>
      </div>
    </header>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 88 }}>
      <div
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--fg-5)",
          marginBottom: 3,
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}
