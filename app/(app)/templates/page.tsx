import { requireMembership } from "@/utils/auth";
import Topbar, { Crumb } from "@/components/Topbar";

export default async function TemplatesPage() {
  await requireMembership();
  return (
    <>
      <Topbar
        crumbs={
          <>
            <Crumb>Workspace</Crumb>
            <Crumb last>Templates</Crumb>
          </>
        }
      />
      <div className="p-7 max-w-[920px]">
        <div className="card p-10 text-center">
          <div
            className="mx-auto mb-4 w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ background: "var(--accent-tint)", color: "var(--accent-2)" }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          </div>
          <h2 className="text-base font-semibold mb-1" style={{ color: "var(--fg)" }}>
            Proposal templates
          </h2>
          <p className="text-[13px] mb-2" style={{ color: "var(--fg-4)" }}>
            Reusable cover-letter, structure, and section templates that wrap your final exports.
          </p>
          <p className="text-[12.5px]" style={{ color: "var(--fg-5)" }}>
            Coming soon — your branded export currently uses the default Tenderly template.
          </p>
        </div>
      </div>
    </>
  );
}
