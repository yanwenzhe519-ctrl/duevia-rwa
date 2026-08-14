import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://duevia-rwa.yanwenzhe519.chatgpt.site"),
  title: "Duevia RWA — Asset assurance for tokenized private markets",
  description: "Turn fragmented offchain evidence into policy-enforceable asset assurance on X Layer.",
  icons: { icon: "/duevia-avatar.png", shortcut: "/duevia-avatar.png" },
  openGraph: {
    title: "Duevia RWA — Verify what backs the asset",
    description: "Evidence intelligence, asset assurance, and continuous monitoring for tokenized private markets.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Duevia RWA — Verify what backs the asset" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Duevia RWA — Verify what backs the asset",
    description: "Asset assurance infrastructure for tokenized private markets.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
