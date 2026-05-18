import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";

export const dealStatusLabels: Record<string, string> = {
  new: "New",
  parsing: "Parsing",
  drafting: "Drafting",
  in_progress: "In progress",
  under_review: "Under review",
  awaiting_approval: "Awaiting approval",
  completed: "Completed",
  submitted: "Submitted",
  won: "Won",
  lost: "Lost",
  open: "Open",
  responded: "Responded",
};

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
      className="px-7 py-5 border-b flex items-start gap-6"
      style={{ background: "var(--surface)", borderColor: "var(--divider)" }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[12px] mb-1" style={{ color: "var(--fg-4)" }}>
          <Link href="/deals" style={{ color: "var(--fg-4)" }}>Deals</Link> ›{" "}
          <span>{deal.client_name ?? "—"}</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-[20px] font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
            {deal.name}
          </h1>
          <StatusBadge
            status={deal.status}
            label={dealStatusLabels[deal.status] ?? deal.status}
          />
        </div>
      </div>

      <div className="flex items-stretch gap-5 text-[12px]" style={{ color: "var(--fg-4)" }}>
        <Meta label="Value">
          {deal.value
            ? `$${Number(deal.value).toLocaleString()}`
            : "—"}
        </Meta>
        <Meta label="Due">
          <span style={{ color: dueSoon ? "var(--warn)" : "var(--fg)" }}>
            {deal.due_date ? deal.due_date.slice(0, 10) : "—"}
          </span>
        </Meta>
        <Meta label="Completion">
          {pct == null ? (
            "—"
          ) : (
            <div className="flex items-center gap-2">
              <div
                className="rounded-full"
                style={{ width: 80, height: 6, background: "var(--bg-2)" }}
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
              <span className="num text-[12.5px]" style={{ color: "var(--fg)" }}>{pct}%</span>
            </div>
          )}
        </Meta>
      </div>
    </header>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[120px]">
      <div className="text-[10.5px] uppercase tracking-wider font-semibold" style={{ color: "var(--fg-5)" }}>
        {label}
      </div>
      <div className="text-[13.5px] font-medium mt-0.5" style={{ color: "var(--fg)" }}>
        {children}
      </div>
    </div>
  );
}
