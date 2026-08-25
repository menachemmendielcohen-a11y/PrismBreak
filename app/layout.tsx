import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://prism-break-arcade.mendicohenhamelech.chatgpt.site"),
  title: "PRISM BREAK — Absorb the Storm",
  description: "Dash through enemy fire, evolve the prism, and break the Aperture in this kinetic neon arena game.",
  applicationName: "PRISM BREAK",
  openGraph: {
    title: "PRISM BREAK — Absorb the Storm",
    description: "Dash through the storm. Turn enemy fire into light. Break the Aperture.",
    type: "website",
    url: "https://prism-break-arcade.mendicohenhamelech.chatgpt.site",
    images: [{
      url: "https://prism-break-arcade.mendicohenhamelech.chatgpt.site/og.png",
      width: 1680,
      height: 945,
      alt: "PRISM BREAK — Absorb the Storm",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PRISM BREAK — Absorb the Storm",
    description: "Dash through the storm. Turn enemy fire into light. Break the Aperture.",
    images: ["https://prism-break-arcade.mendicohenhamelech.chatgpt.site/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
