export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-7">
          <div
            className="w-7 h-7 rounded-md relative flex items-center justify-center"
            style={{ background: "linear-gradient(140deg,oklch(0.18 0.04 264) 0%,oklch(0.28 0.08 264) 55%,oklch(0.48 0.22 264) 100%)", boxShadow: "inset 0 1px 0 oklch(1 0 0 / 0.12)" }}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
              <rect x="3" y="3" width="9" height="1.6" rx="0.8" fill="oklch(1 0 0 / 0.90)" />
              <rect x="6.7" y="4.6" width="1.6" height="4.2" rx="0.8" fill="oklch(1 0 0 / 0.90)" />
              <rect x="3.5" y="9.5" width="8" height="2.8" rx="1.4" fill="oklch(1 0 0 / 0.90)" />
              <rect x="5" y="10.6" width="5" height="0.6" rx="0.3" fill="oklch(0.28 0.08 264 / 1)" />
            </svg>
          </div>
          <span className="text-base font-semibold" style={{ color: "var(--fg)" }}>TenderOps</span>
        </div>
        {children}
      </div>
    </div>
  );
}
