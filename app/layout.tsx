import type { Metadata } from "next";
import "./globals.css";
import RecoveryRedirect from "@/components/RecoveryRedirect";

export const metadata: Metadata = {
  title: "Propello — RFP Response Platform",
  description: "AI-powered RFP automation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Instrument system (DESIGN.md): Geist for UI, Geist Mono for data/meta.
            Self-hosted (public/fonts + @font-face in globals.css) — no external
            font CDN round-trip, no render-blocking third-party CSS. */}
        <link
          rel="preload"
          href="/fonts/Geist-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/GeistMono-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <RecoveryRedirect />
        {children}
      </body>
    </html>
  );
}
