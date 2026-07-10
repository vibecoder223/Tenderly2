"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Step = {
  key: string;
  label: string;
  desc: string;
  href: string;
  done: boolean;
};

/**
 * Persistent onboarding card on the dashboard. Each row deep-links to the
 * page where the user can complete that step. Steps only flip to "done"
 * when the user has real (non-sample) data of the corresponding type.
 *
 * Skip writes onboarding_dismissed=true on the org so the card stops
 * rendering on subsequent visits.
 */
export default function OnboardingChecklist({
  steps,
  total,
}: {
  steps: Step[];
  total: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const done = steps.filter((s) => s.done).length;
  const pct = Math.round((done / total) * 100);

  async function skip() {
    setBusy(true);
    await fetch("/api/onboarding/dismiss", { method: "POST" }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-1)",
        overflow: "hidden",
      }}
    >
      {/* Header with progress */}
      <div
        style={{
          padding: "16px 20px 14px",
          borderBottom: "1px solid var(--divider)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--fg)",
                letterSpacing: "-0.005em",
              }}
            >
              Get started with Klovered
            </h2>
            <p style={{ fontSize: 12.5, color: "var(--fg-4)", marginTop: 2 }}>
              {done} of {total} complete
            </p>
          </div>
          <button
            onClick={skip}
            disabled={busy}
            className="btn btn-ghost"
            style={{ fontSize: 12, color: "var(--fg-4)", height: 28 }}
          >
            Skip setup
          </button>
        </div>
        {/* Progress bar */}
        <div
          style={{
            height: 4,
            background: "var(--bg-2)",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: pct === 100 ? "var(--ok)" : "var(--accent)",
              borderRadius: 999,
              transition: "width var(--dur-slow) var(--ease-quint)",
            }}
          />
        </div>
      </div>

      {/* Steps */}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {steps.map((step, i) => {
          const isFirstIncomplete =
            !step.done && steps.slice(0, i).every((s) => s.done);
          return (
            <li
              key={step.key}
              style={{
                borderTop: i === 0 ? "none" : "1px solid var(--divider)",
              }}
            >
              <Link
                href={step.href}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 14,
                  padding: "14px 20px",
                  textDecoration: "none",
                  background: isFirstIncomplete ? "var(--accent-tint)" : "transparent",
                  transition: "background var(--dur-fast) var(--ease)",
                }}
                onMouseEnter={(e) => {
                  if (!isFirstIncomplete && !step.done) {
                    (e.currentTarget as HTMLElement).style.background = "var(--bg-2)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isFirstIncomplete) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                <StepIcon done={step.done} active={isFirstIncomplete} index={i + 1} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13.5,
                      fontWeight: 600,
                      color: step.done ? "var(--fg-4)" : "var(--fg)",
                      textDecoration: step.done ? "line-through" : "none",
                      lineHeight: 1.35,
                    }}
                  >
                    {step.label}
                  </div>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: "var(--fg-4)",
                      marginTop: 3,
                      lineHeight: 1.5,
                    }}
                  >
                    {step.desc}
                  </div>
                </div>
                {!step.done && (
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: 500,
                      color: isFirstIncomplete ? "var(--accent-2)" : "var(--fg-4)",
                      flexShrink: 0,
                      paddingTop: 1,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Open
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StepIcon({
  done,
  active,
  index,
}: {
  done: boolean;
  active: boolean;
  index: number;
}) {
  const size = 24;
  if (done) {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: "var(--ok)",
          color: "white",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <polyline
            points="2,6 5,9 10,3"
            stroke="white"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: active ? "var(--accent)" : "var(--bg-2)",
        color: active ? "white" : "var(--fg-4)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        marginTop: 1,
        fontSize: 11.5,
        fontWeight: 600,
        border: active ? "none" : "1.5px solid var(--border-strong)",
      }}
    >
      {index}
    </span>
  );
}
