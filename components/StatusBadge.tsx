export const dealStatusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  responded: "Responded",
  won: "Won",
  lost: "Lost",
};

const tone: Record<string, "ok" | "warn" | "err" | "accent" | "default"> = {
  open: "default",
  in_progress: "accent",
  responded: "warn",
  won: "ok",
  lost: "err",
  // Processing statuses
  uploaded: "default",
  extracting: "accent",
  chunked: "accent",
  analyzing: "accent",
  structured: "accent",
  completed: "ok",
  failed: "err",
  // Question/response statuses
  pending: "default",
  submitted: "warn",
  approved: "ok",
  rejected: "err",
  draft: "default",
  exported: "ok",
  // Compliance
  compliant: "ok",
  partial: "warn",
  non_compliant: "err",
};

export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = tone[status] || "default";
  return (
    <span className={`badge ${cls === "default" ? "" : `badge-${cls}`}`}>
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: "currentColor",
          opacity: 0.7,
        }}
      />
      {label ?? (status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " "))}
    </span>
  );
}
