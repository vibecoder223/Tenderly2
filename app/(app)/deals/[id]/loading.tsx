// Suspense fallback for deal tab content. The deal layout (header + tabs)
// renders above this; only the tab body waits on its queries, so switching
// tabs paints instantly instead of blocking on the next tab's waterfall.
export default function DealTabLoading() {
  return (
    <div style={{ padding: "20px 24px" }}>
      <div className="skel" style={{ width: 180, height: 14, marginBottom: 18 }} />
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 0", borderBottom: "1px solid var(--divider, var(--border))" }}
        >
          <div className="skel" style={{ width: 15, height: 15, borderRadius: 4 }} />
          <div className="skel" style={{ width: `${72 - i * 9}%`, height: 11 }} />
          <div className="skel" style={{ width: 56, height: 16, marginLeft: "auto", borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}
