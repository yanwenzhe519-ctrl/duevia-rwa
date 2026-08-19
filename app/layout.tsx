import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://duevia-rwa.cardrevive-agent.workers.dev"),
  title: "Duevia — AI-Powered RWA Recovery Infrastructure",
  description: "AI-powered RWA recovery infrastructure for evidence-backed asset operations on X Layer.",
  icons: { icon: "/duevia-avatar.png", shortcut: "/duevia-avatar.png" },
  openGraph: {
    title: "Duevia — AI-Powered RWA Recovery Infrastructure",
    description: "AI-powered RWA recovery infrastructure for evidence-backed asset operations on X Layer.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Duevia RWA — Verify what backs the asset" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Duevia — AI-Powered RWA Recovery Infrastructure",
    description: "AI-powered RWA recovery infrastructure for evidence-backed asset operations on X Layer.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
