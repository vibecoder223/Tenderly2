import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="card p-7" style={{ color: "var(--fg-4)" }}>Loading…</div>}>
      <ResetPasswordClient />
    </Suspense>
  );
}
