"use client";

import { useEffect, useRef, useState } from "react";

export type SelectOption = { value: string; label: string };

/**
 * Vellum select — a custom popover dropdown so the *open* list is fully styled
 * (native <select> option lists are OS-rendered and can't be themed). Keyboard:
 * ↑/↓ move, Enter selects, Esc closes. Closes on outside click / blur.
 */
export default function Select({
  value,
  options,
  onChange,
  disabled,
  minWidth = 108,
  ariaLabel,
  fullWidth,
  triggerClassName = "select",
  style,
  wrapperStyle,
  placeholder = "Select…",
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  minWidth?: number;
  ariaLabel?: string;
  fullWidth?: boolean;
  /** Base class for the trigger button (e.g. "select", "input", "filter-chip"). */
  triggerClassName?: string;
  /** Inline style applied to the trigger button (fontSize, padding, height…). */
  style?: React.CSSProperties;
  /** Inline style applied to the wrapper (flex, width…). */
  wrapperStyle?: React.CSSProperties;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (open) setActive(Math.max(0, options.findIndex((o) => o.value === value)));
  }, [open, value, options]);

  function choose(v: string) {
    onChange(v);
    setOpen(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (disabled) return;
    if (!open && (e.key === "Enter" || e.key === " " || e.key === "ArrowDown")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const o = options[active];
      if (o) choose(o.value);
    }
  }

  return (
    <div
      ref={rootRef}
      className="vselect"
      style={{ ...(fullWidth ? { width: "100%" } : { minWidth }), ...wrapperStyle }}
    >
      <button
        type="button"
        className={`vselect-trigger ${triggerClassName}`}
        style={style}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKey}
      >
        <span className="vselect-value">{selected?.label ?? placeholder}</span>
        <svg className="vselect-chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <ul className="vselect-menu" role="listbox">
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <li
                key={o.value}
                role="option"
                aria-selected={isSel}
                className={`vselect-option${i === active ? " active" : ""}${isSel ? " selected" : ""}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o.value);
                }}
              >
                <span>{o.label}</span>
                {isSel && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
