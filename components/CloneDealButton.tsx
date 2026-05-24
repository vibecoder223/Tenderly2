"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CloneDealButton({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function clone() {
    setLoading(true);
    const res = await fetch(`/api/deals/${dealId}/clone`, { method: "POST" });
    setLoading(false);
    if (!res.ok) return;
    const { deal } = await res.json();
    router.push(`/deals/${deal.id}`);
  }

  return (
    <button
      className="btn"
      onClick={clone}
      disabled={loading}
      title="Duplicate this deal"
    >
      {loading ? (
        <>
          <svg width="12" height="12" viewBox="0 0 14 14" fill="none"
            style={{ animation: "spin 0.75s linear infinite", flexShrink: 0 }}>
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1.5" />
            <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Duplicating…
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Duplicate
        </>
      )}
    </button>
  );
}
