export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-7">
          <div
            className="w-7 h-7 flex items-center justify-center"
            style={{
              borderRadius: 6,
              background: "var(--accent)",
              fontFamily: "'Geist', sans-serif",
              fontWeight: 800,
              fontSize: 15,
              color: "white",
              letterSpacing: "-0.05em",
              lineHeight: 1,
            }}
          >
            P
          </div>
          <span className="text-base font-semibold" style={{ color: "var(--fg)" }}>Klovered</span>
        </div>
        {children}
      </div>
    </div>
  );
}
