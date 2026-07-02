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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Instrument system (DESIGN.md): Geist for UI, Geist Mono for data/meta. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@300..800&family=Geist+Mono:wght@400..600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <RecoveryRedirect />
        {children}
      </body>
    </html>
  );
}
