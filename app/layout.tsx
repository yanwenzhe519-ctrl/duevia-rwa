import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://xray-rwa.yanwenzhe519.chatgpt.site"),
  title: "X-Ray RWA — Verify Before You Trust",
  description: "AI-powered RWA verification and risk intelligence, with tamper-evident proof on X Layer.",
  icons: {
    icon: "/xray-avatar.png",
    shortcut: "/xray-avatar.png",
  },
  openGraph: {
    title: "X-Ray RWA — Verify Before You Trust",
    description: "Turn fragmented offchain evidence into structured risk intelligence and verifiable proof on X Layer.",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "X-Ray RWA — Verify Before You Trust" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "X-Ray RWA — Verify Before You Trust",
    description: "AI-powered verification infrastructure for real-world assets.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
