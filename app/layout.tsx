import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Force dynamic rendering for all pages (fixes static generation issues with client components)
export const dynamic = "force-dynamic";

// Headline font - Space Grotesk
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-space-grotesk",
  weight: ["400", "500", "700"],
});

// Body font - Inter
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  weight: ["300", "400", "500", "600", "700"],
});

// Mono font - JetBrains Mono
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "LennyTapes",
    template: "%s | LennyTapes",
  },
  description:
    "Search, explore, and pressure-test ideas from Lenny's Podcast. Go beyond basic search to discover hidden connections and surface expert disagreements.",
  keywords: [
    "Lenny's Podcast",
    "product management",
    "growth",
    "startup advice",
    "product leadership",
  ],
  authors: [{ name: "LennyTapes" }],
  openGraph: {
    title: "LennyTapes",
    description:
      "Deep dives into expert knowledge from Lenny's Podcast",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LennyTapes",
    description:
      "Deep dives into expert knowledge from Lenny's Podcast",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Override CSS variables with Next.js font variables */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root {
                --font-headline: var(--font-space-grotesk), "Space Grotesk", system-ui, sans-serif;
                --font-body: var(--font-inter), "Inter", system-ui, sans-serif;
                --font-mono: var(--font-jetbrains-mono), "JetBrains Mono", monospace;
              }
            `,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-body antialiased">
        {children}
      </body>
    </html>
  );
}
