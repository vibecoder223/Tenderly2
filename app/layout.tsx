import type { Metadata } from "next";
import "./globals.css";

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
        <link rel="preconnect" href="https://api.fontshare.com" />
        <link rel="preconnect" href="https://cdn.fontshare.com" crossOrigin="anonymous" />
        {/* Body + UI: Switzer (humanist). Display headings: Cabinet Grotesk (editorial). Mono: JetBrains. */}
        <link
          href="https://api.fontshare.com/v2/css?f[]=switzer@400,500,600,700&f[]=cabinet-grotesk@500,700,800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
