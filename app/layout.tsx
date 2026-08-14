import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://xray-rwa.yanwenzhe519.chatgpt.site"),
  title: "Duevia RWA — AI investigation and decision infrastructure",
  description: "Agentic RWA investigation, grounded risk decisions, and executable asset states on X Layer.",
  icons: { icon: "/duevia-avatar.png", shortcut: "/duevia-avatar.png" },
  openGraph: {
    title: "Duevia RWA — Investigate assets. Execute trust.",
    description: "AI investigation and decision infrastructure for tokenized private markets.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Duevia RWA — Verify what backs the asset" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Duevia RWA — Investigate assets. Execute trust.",
    description: "Agentic RWA investigation, grounded decisions, and X Layer execution.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
