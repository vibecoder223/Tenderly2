import { Page } from "@/components/ui";

// Route-level Suspense fallback for every (app) page. Without this, every
// navigation blocks on the page's full query waterfall before ANYTHING paints
// (all routes are dynamic — auth cookies). With it, the shell + this skeleton
// stream immediately and the page body swaps in when the data lands.
export default function AppLoading() {
  return (
    <>
      {/* Topbar strip */}
      <div style={{ height: 49, borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", padding: "0 20px" }}>
        <div className="skel" style={{ width: 180, height: 12 }} />
      </div>

      <Page>
        {/* Title + sub */}
        <div style={{ marginBottom: 4 }}>
          <div className="skel" style={{ width: 220, height: 22, marginBottom: 10 }} />
          <div className="skel" style={{ width: 320, height: 12 }} />
        </div>

        {/* Readings band */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ padding: "14px 16px", border: "1px solid var(--border)", borderRadius: 10, background: "var(--elevated)" }}>
              <div className="skel" style={{ width: 64, height: 20, marginBottom: 8 }} />
              <div className="skel" style={{ width: 96, height: 10 }} />
            </div>
          ))}
        </div>

        {/* Two content cards */}
        {[0, 1].map((i) => (
          <div key={i} style={{ border: "1px solid var(--border)", borderRadius: 10, background: "var(--elevated)", padding: 20 }}>
            <div className="skel" style={{ width: 140, height: 13, marginBottom: 16 }} />
            <div className="skel" style={{ width: "100%", height: 10, marginBottom: 10 }} />
            <div className="skel" style={{ width: "84%", height: 10, marginBottom: 10 }} />
            <div className="skel" style={{ width: "62%", height: 10 }} />
          </div>
        ))}
      </Page>
    </>
  );
}
