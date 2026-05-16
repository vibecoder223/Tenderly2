export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md">
        <div className="flex items-center gap-2 justify-center mb-7">
          <div
            className="w-7 h-7 rounded-md relative"
            style={{ background: "linear-gradient(140deg,#0F1626 0%,#2A3245 70%,#3B47D6 100%)" }}
          />
          <span className="text-base font-semibold" style={{ color: "var(--fg)" }}>Tenderly</span>
        </div>
        {children}
      </div>
    </div>
  );
}
