/**
 * Font configuration for LennyTapes themes
 *
 * Each theme uses different font combinations.
 * This config helps with Next.js font optimization.
 */

import type { ThemeId } from "./themes.js";

export interface FontConfig {
  name: string;
  googleFontsName: string;
  weights: number[];
  variable?: string;
  subsets?: string[];
  display?: "auto" | "block" | "swap" | "fallback" | "optional";
}

export interface ThemeFonts {
  headline: FontConfig;
  body: FontConfig;
  mono: FontConfig;
}

// =============================================================================
// RETRO-TECH FONTS
// =============================================================================

const retroTechFonts: ThemeFonts = {
  headline: {
    name: "Space Grotesk",
    googleFontsName: "Space+Grotesk",
    weights: [400, 500, 700],
    variable: "--font-space-grotesk",
    subsets: ["latin"],
    display: "swap",
  },
  body: {
    name: "Inter",
    googleFontsName: "Inter",
    weights: [300, 400, 500, 600, 700],
    variable: "--font-inter",
    subsets: ["latin"],
    display: "swap",
  },
  mono: {
    name: "JetBrains Mono",
    googleFontsName: "JetBrains+Mono",
    weights: [400, 500, 700],
    variable: "--font-jetbrains-mono",
    subsets: ["latin"],
    display: "swap",
  },
};

// =============================================================================
// WARM KNOWLEDGE FONTS
// =============================================================================

const warmKnowledgeFonts: ThemeFonts = {
  headline: {
    name: "Newsreader",
    googleFontsName: "Newsreader",
    weights: [400, 500, 600, 700],
    variable: "--font-newsreader",
    subsets: ["latin"],
    display: "swap",
  },
  body: {
    name: "Source Sans 3",
    googleFontsName: "Source+Sans+3",
    weights: [300, 400, 500, 600, 700],
    variable: "--font-source-sans",
    subsets: ["latin"],
    display: "swap",
  },
  mono: {
    name: "IBM Plex Mono",
    googleFontsName: "IBM+Plex+Mono",
    weights: [400, 500, 600],
    variable: "--font-ibm-plex-mono",
    subsets: ["latin"],
    display: "swap",
  },
};

// =============================================================================
// MODERN EDITORIAL FONTS
// =============================================================================

const modernEditorialFonts: ThemeFonts = {
  headline: {
    name: "Geist",
    googleFontsName: "Geist", // Note: Geist may need to be self-hosted
    weights: [400, 500, 600, 700],
    variable: "--font-geist",
    subsets: ["latin"],
    display: "swap",
  },
  body: {
    name: "Geist",
    googleFontsName: "Geist",
    weights: [300, 400, 500, 600],
    variable: "--font-geist",
    subsets: ["latin"],
    display: "swap",
  },
  mono: {
    name: "Geist Mono",
    googleFontsName: "Geist+Mono",
    weights: [400, 500, 600],
    variable: "--font-geist-mono",
    subsets: ["latin"],
    display: "swap",
  },
};

// =============================================================================
// EXPORTS
// =============================================================================

export const themeFonts: Record<ThemeId, ThemeFonts> = {
  "retro-tech": retroTechFonts,
  "warm-knowledge": warmKnowledgeFonts,
  "modern-editorial": modernEditorialFonts,
};

/**
 * Generate Google Fonts URL for a theme
 */
export function getGoogleFontsUrl(themeId: ThemeId): string {
  const fonts = themeFonts[themeId];
  const fontFamilies: string[] = [];

  const uniqueFonts = new Map<string, number[]>();

  [fonts.headline, fonts.body, fonts.mono].forEach((font) => {
    const existing = uniqueFonts.get(font.googleFontsName);
    if (existing) {
      // Merge weights
      const merged = [...new Set([...existing, ...font.weights])].sort((a, b) => a - b);
      uniqueFonts.set(font.googleFontsName, merged);
    } else {
      uniqueFonts.set(font.googleFontsName, font.weights);
    }
  });

  uniqueFonts.forEach((weights, name) => {
    // Skip Geist - needs self-hosting or Next.js built-in
    if (name === "Geist" || name === "Geist+Mono") return;

    const weightStr = weights.join(";");
    fontFamilies.push(`family=${name}:wght@${weightStr}`);
  });

  if (fontFamilies.length === 0) return "";

  return `https://fonts.googleapis.com/css2?${fontFamilies.join("&")}&display=swap`;
}

/**
 * Get all unique fonts needed across all themes (for preloading)
 */
export function getAllFontsUrls(): string[] {
  const urls = new Set<string>();

  (Object.keys(themeFonts) as ThemeId[]).forEach((themeId) => {
    const url = getGoogleFontsUrl(themeId);
    if (url) urls.add(url);
  });

  return Array.from(urls);
}
