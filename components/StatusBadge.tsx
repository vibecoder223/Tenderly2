// Single source of truth for status labels + tones.
// Canonical taxonomy after migration 0007:
//   Deal:     new, in_progress, submitted, won, lost
//   Question: todo, drafting, review, approved, blocked
// Processing + compliance statuses are independent enums kept as-is.

export const dealStatusLabels: Record<string, string> = {
  new: "New",
  open: "Open",
  draft: "Draft",
  in_progress: "In progress",
  submitted: "Submitted",
  responded: "Responded",
  won: "Won",
  lost: "Lost",
};

export const questionStatusLabels: Record<string, string> = {
  todo: "To do",
  drafting: "Drafting",
  review: "In review",
  approved: "Approved",
  blocked: "Blocked",
};

const tone: Record<string, "ok" | "warn" | "err" | "accent" | "default"> = {
  // Deal statuses
  new: "default",
  open: "default",
  draft: "default",
  in_progress: "accent",
  submitted: "warn",
  responded: "warn",
  won: "ok",
  lost: "err",

  // Question statuses
  todo: "default",
  drafting: "accent",
  review: "warn",
  approved: "ok",
  blocked: "err",

  // Processing statuses (documents / knowledge)
  uploading: "default",
  uploaded: "default",
  extracting: "accent",
  chunked: "accent",
  analyzing: "accent",
  structured: "accent",
  parsing: "accent",
  chunking: "accent",
  embedding: "accent",
  storing: "accent",
  ready: "ok",
  completed: "ok",
  failed: "err",

  // Compliance
  compliant: "ok",
  partial: "warn",
  non_compliant: "err",
  pending: "default",
};

export default function StatusBadge({ status, label }: { status: string; label?: string }) {
  const cls = tone[status] || "default";
  const resolved =
    label ??
    dealStatusLabels[status] ??
    questionStatusLabels[status] ??
    status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
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
      {resolved}
    </span>
  );
}
