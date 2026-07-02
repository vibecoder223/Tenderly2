import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F7F8FA",
        "bg-2": "#F1F3F6",
        surface: "#FFFFFF",
        border: "#E4E7EC",
        "border-strong": "#D0D5DD",
        divider: "#EEF0F3",
        fg: "#0F1626",
        "fg-2": "#2A3245",
        "fg-3": "#5B6478",
        "fg-4": "#8A93A6",
        "fg-5": "#B8BFCE",
        accent: "#3B47D6",
        "accent-2": "#2E3AB8",
        "accent-tint": "#EEF0FF",
        "accent-line": "#C7CDF7",
        ok: "#0E8A5F",
        "ok-tint": "#E6F4EE",
        warn: "#B7791F",
        "warn-tint": "#FBF3E0",
        err: "#C0392B",
        "err-tint": "#FBEAE7",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Text",
          "system-ui",
          "sans-serif",
        ],
        mono: ["Geist Mono", "ui-monospace", "SF Mono", "Menlo", "monospace"],
      },
      borderRadius: {
        xs: "4px",
        sm: "6px",
        md: "8px",
        lg: "12px",
      },
      boxShadow: {
        s1: "0 1px 2px rgba(15,22,38,0.04), 0 0 0 1px rgba(15,22,38,0.02)",
        s2: "0 4px 14px rgba(15,22,38,0.06), 0 1px 2px rgba(15,22,38,0.04)",
        s3: "0 16px 40px rgba(15,22,38,0.10), 0 2px 6px rgba(15,22,38,0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
