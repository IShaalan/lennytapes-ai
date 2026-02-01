/**
 * LennyTapes Theme Configuration
 *
 * Three typography directions, configurable at runtime.
 * Default: Retro-Tech (playful, cassette-tape nostalgia, bold accents)
 */

export type ThemeId = "retro-tech" | "warm-knowledge" | "modern-editorial";

export interface ThemeTypography {
  fontHeadline: string;
  fontBody: string;
  fontMono: string;
  // Font weights
  weightLight: number;
  weightRegular: number;
  weightMedium: number;
  weightBold: number;
  weightBlack: number;
  // Scale (relative to base 16px)
  scaleXs: string;
  scaleSm: string;
  scaleBase: string;
  scaleLg: string;
  scaleXl: string;
  scale2xl: string;
  scale3xl: string;
  scale4xl: string;
  scale5xl: string;
  // Line heights
  leadingTight: string;
  leadingNormal: string;
  leadingRelaxed: string;
  // Letter spacing
  trackingTight: string;
  trackingNormal: string;
  trackingWide: string;
}

export interface ThemeColors {
  // Brand
  primary: string;
  primaryHover: string;
  primaryMuted: string;
  accent: string;
  accentHover: string;
  accentMuted: string;

  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgInverse: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  textAccent: string;

  // Borders
  borderLight: string;
  borderMedium: string;
  borderStrong: string;

  // Semantic
  success: string;
  warning: string;
  error: string;
  info: string;

  // Special (for cassette/retro elements)
  special1: string;
  special2: string;
  special3: string;
}

export interface ThemeEffects {
  // Border radius
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  radiusFull: string;

  // Shadows
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;
  shadowGlow: string;

  // Transitions
  transitionFast: string;
  transitionNormal: string;
  transitionSlow: string;
}

export interface Theme {
  id: ThemeId;
  name: string;
  description: string;
  typography: ThemeTypography;
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
  effects: ThemeEffects;
}

// =============================================================================
// THEME: RETRO-TECH (Default)
// Playful, cassette-tape nostalgia, bold accents
// =============================================================================

const retroTechTheme: Theme = {
  id: "retro-tech",
  name: "Retro Tech",
  description: "Playful cassette-tape nostalgia with bold accents",

  typography: {
    // Space Grotesk for headlines - geometric, retro-futuristic
    fontHeadline: '"Space Grotesk", system-ui, sans-serif',
    // Inter for body - clean, readable
    fontBody: '"Inter", system-ui, sans-serif',
    // JetBrains Mono for code/timestamps
    fontMono: '"JetBrains Mono", "Fira Code", monospace',

    weightLight: 300,
    weightRegular: 400,
    weightMedium: 500,
    weightBold: 700,
    weightBlack: 900,

    scaleXs: "0.75rem", // 12px
    scaleSm: "0.875rem", // 14px
    scaleBase: "1rem", // 16px
    scaleLg: "1.125rem", // 18px
    scaleXl: "1.25rem", // 20px
    scale2xl: "1.5rem", // 24px
    scale3xl: "1.875rem", // 30px
    scale4xl: "2.25rem", // 36px
    scale5xl: "3rem", // 48px

    leadingTight: "1.25",
    leadingNormal: "1.5",
    leadingRelaxed: "1.75",

    trackingTight: "-0.025em",
    trackingNormal: "0",
    trackingWide: "0.025em",
  },

  colors: {
    light: {
      // Bold orange/coral primary - energetic, playful
      primary: "#FF6B35",
      primaryHover: "#E55A2B",
      primaryMuted: "#FF6B3520",

      // Electric teal accent - retro tech vibes
      accent: "#00D9C0",
      accentHover: "#00C4AD",
      accentMuted: "#00D9C020",

      // Warm cream backgrounds
      bgPrimary: "#FFFBF7",
      bgSecondary: "#FFF5ED",
      bgTertiary: "#FFEDE0",
      bgInverse: "#1A1A2E",

      // Warm dark text
      textPrimary: "#1A1A2E",
      textSecondary: "#4A4A5E",
      textMuted: "#8A8A9E",
      textInverse: "#FFFBF7",
      textAccent: "#FF6B35",

      // Borders
      borderLight: "#FFE5D4",
      borderMedium: "#FFCDB2",
      borderStrong: "#FFB088",

      // Semantic
      success: "#10B981",
      warning: "#F59E0B",
      error: "#EF4444",
      info: "#3B82F6",

      // Special cassette colors
      special1: "#6C63FF", // Purple (cassette label)
      special2: "#FFD93D", // Yellow (tape reel)
      special3: "#2D3436", // Dark gray (cassette body)
    },

    dark: {
      // Same brand colors, adjusted for dark mode
      primary: "#FF7F50",
      primaryHover: "#FF9B75",
      primaryMuted: "#FF7F5025",

      accent: "#00E5CC",
      accentHover: "#00F5DC",
      accentMuted: "#00E5CC20",

      // Dark backgrounds with warm undertone
      bgPrimary: "#0F0F1A",
      bgSecondary: "#1A1A2E",
      bgTertiary: "#252542",
      bgInverse: "#FFFBF7",

      // Light text
      textPrimary: "#F5F5F7",
      textSecondary: "#B8B8C8",
      textMuted: "#6A6A7E",
      textInverse: "#0F0F1A",
      textAccent: "#FF7F50",

      // Borders
      borderLight: "#2A2A3E",
      borderMedium: "#3A3A4E",
      borderStrong: "#4A4A5E",

      // Semantic
      success: "#34D399",
      warning: "#FBBF24",
      error: "#F87171",
      info: "#60A5FA",

      // Special cassette colors (slightly brighter for dark mode)
      special1: "#8B83FF",
      special2: "#FFE066",
      special3: "#4A5568",
    },
  },

  effects: {
    radiusSm: "0.25rem",
    radiusMd: "0.5rem",
    radiusLg: "0.75rem",
    radiusXl: "1rem",
    radiusFull: "9999px",

    // Playful shadows with slight color tint
    shadowSm: "0 1px 2px rgba(26, 26, 46, 0.05)",
    shadowMd: "0 4px 6px rgba(26, 26, 46, 0.07), 0 2px 4px rgba(26, 26, 46, 0.05)",
    shadowLg: "0 10px 15px rgba(26, 26, 46, 0.1), 0 4px 6px rgba(26, 26, 46, 0.05)",
    shadowGlow: "0 0 20px rgba(255, 107, 53, 0.3)",

    transitionFast: "150ms ease",
    transitionNormal: "250ms ease",
    transitionSlow: "400ms ease",
  },
};

// =============================================================================
// THEME: WARM KNOWLEDGE
// Scholarly but warm, Substack/Readwise vibes
// =============================================================================

const warmKnowledgeTheme: Theme = {
  id: "warm-knowledge",
  name: "Warm Knowledge",
  description: "Scholarly but warm, like a well-loved library",

  typography: {
    // Newsreader for headlines - elegant variable serif
    fontHeadline: '"Newsreader", "Georgia", serif',
    // Source Sans for body - humanist, readable
    fontBody: '"Source Sans 3", "Source Sans Pro", system-ui, sans-serif',
    // IBM Plex Mono for code
    fontMono: '"IBM Plex Mono", monospace',

    weightLight: 300,
    weightRegular: 400,
    weightMedium: 500,
    weightBold: 600,
    weightBlack: 800,

    scaleXs: "0.75rem",
    scaleSm: "0.875rem",
    scaleBase: "1.0625rem", // Slightly larger base for readability
    scaleLg: "1.1875rem",
    scaleXl: "1.375rem",
    scale2xl: "1.625rem",
    scale3xl: "2rem",
    scale4xl: "2.5rem",
    scale5xl: "3.25rem",

    leadingTight: "1.3",
    leadingNormal: "1.6", // More generous for long-form reading
    leadingRelaxed: "1.8",

    trackingTight: "-0.02em",
    trackingNormal: "0",
    trackingWide: "0.02em",
  },

  colors: {
    light: {
      // Deep forest green - scholarly, trustworthy
      primary: "#2D5A47",
      primaryHover: "#1F4435",
      primaryMuted: "#2D5A4715",

      // Warm gold accent
      accent: "#C9A227",
      accentHover: "#B8921F",
      accentMuted: "#C9A22715",

      // Paper-white backgrounds
      bgPrimary: "#FDFCFA",
      bgSecondary: "#F7F5F2",
      bgTertiary: "#EFECE7",
      bgInverse: "#1C2420",

      textPrimary: "#1C2420",
      textSecondary: "#4A524D",
      textMuted: "#7A827D",
      textInverse: "#FDFCFA",
      textAccent: "#2D5A47",

      borderLight: "#E8E4DE",
      borderMedium: "#D4CFC6",
      borderStrong: "#B8B2A6",

      success: "#2D5A47",
      warning: "#C9A227",
      error: "#C74B50",
      info: "#4A7C94",

      special1: "#8B4513", // Leather brown
      special2: "#F5E6C8", // Aged paper
      special3: "#2F4F4F", // Dark slate
    },

    dark: {
      primary: "#4A8B71",
      primaryHover: "#5A9B81",
      primaryMuted: "#4A8B7120",

      accent: "#E0B83D",
      accentHover: "#EBC84D",
      accentMuted: "#E0B83D20",

      bgPrimary: "#121816",
      bgSecondary: "#1C2420",
      bgTertiary: "#263028",
      bgInverse: "#FDFCFA",

      textPrimary: "#F2F0ED",
      textSecondary: "#B8C0BA",
      textMuted: "#6A726C",
      textInverse: "#121816",
      textAccent: "#4A8B71",

      borderLight: "#2A3430",
      borderMedium: "#3A4440",
      borderStrong: "#4A5450",

      success: "#4A8B71",
      warning: "#E0B83D",
      error: "#E07075",
      info: "#6A9CB4",

      special1: "#A86B3D",
      special2: "#3A3020",
      special3: "#4A6A6A",
    },
  },

  effects: {
    radiusSm: "0.125rem",
    radiusMd: "0.25rem",
    radiusLg: "0.375rem",
    radiusXl: "0.5rem",
    radiusFull: "9999px",

    // Subtle, refined shadows
    shadowSm: "0 1px 2px rgba(28, 36, 32, 0.04)",
    shadowMd: "0 2px 4px rgba(28, 36, 32, 0.06)",
    shadowLg: "0 4px 8px rgba(28, 36, 32, 0.08)",
    shadowGlow: "0 0 12px rgba(45, 90, 71, 0.2)",

    transitionFast: "150ms ease",
    transitionNormal: "200ms ease",
    transitionSlow: "350ms ease",
  },
};

// =============================================================================
// THEME: MODERN EDITORIAL
// Clean, tech-forward, Notion/Linear/Vercel vibes
// =============================================================================

const modernEditorialTheme: Theme = {
  id: "modern-editorial",
  name: "Modern Editorial",
  description: "Clean and tech-forward, minimal and precise",

  typography: {
    // Geist for everything - Vercel's typeface
    fontHeadline: '"Geist", "Inter", system-ui, sans-serif',
    fontBody: '"Geist", "Inter", system-ui, sans-serif',
    fontMono: '"Geist Mono", "JetBrains Mono", monospace',

    weightLight: 300,
    weightRegular: 400,
    weightMedium: 500,
    weightBold: 600,
    weightBlack: 700,

    scaleXs: "0.75rem",
    scaleSm: "0.875rem",
    scaleBase: "0.9375rem", // 15px - slightly tighter
    scaleLg: "1.0625rem",
    scaleXl: "1.1875rem",
    scale2xl: "1.375rem",
    scale3xl: "1.75rem",
    scale4xl: "2.125rem",
    scale5xl: "2.75rem",

    leadingTight: "1.2",
    leadingNormal: "1.5",
    leadingRelaxed: "1.65",

    trackingTight: "-0.03em",
    trackingNormal: "-0.01em", // Slightly tight for modern feel
    trackingWide: "0.01em",
  },

  colors: {
    light: {
      // Pure black primary - bold, confident
      primary: "#000000",
      primaryHover: "#171717",
      primaryMuted: "#00000010",

      // Violet accent - modern, creative
      accent: "#7C3AED",
      accentHover: "#6D28D9",
      accentMuted: "#7C3AED15",

      // Pure white backgrounds
      bgPrimary: "#FFFFFF",
      bgSecondary: "#FAFAFA",
      bgTertiary: "#F5F5F5",
      bgInverse: "#000000",

      textPrimary: "#0A0A0A",
      textSecondary: "#525252",
      textMuted: "#A3A3A3",
      textInverse: "#FFFFFF",
      textAccent: "#7C3AED",

      borderLight: "#F0F0F0",
      borderMedium: "#E5E5E5",
      borderStrong: "#D4D4D4",

      success: "#22C55E",
      warning: "#EAB308",
      error: "#EF4444",
      info: "#3B82F6",

      special1: "#7C3AED", // Violet
      special2: "#06B6D4", // Cyan
      special3: "#171717", // Near black
    },

    dark: {
      primary: "#FFFFFF",
      primaryHover: "#E5E5E5",
      primaryMuted: "#FFFFFF15",

      accent: "#A78BFA",
      accentHover: "#C4B5FD",
      accentMuted: "#A78BFA20",

      bgPrimary: "#000000",
      bgSecondary: "#0A0A0A",
      bgTertiary: "#171717",
      bgInverse: "#FFFFFF",

      textPrimary: "#FAFAFA",
      textSecondary: "#A3A3A3",
      textMuted: "#525252",
      textInverse: "#000000",
      textAccent: "#A78BFA",

      borderLight: "#1F1F1F",
      borderMedium: "#2E2E2E",
      borderStrong: "#404040",

      success: "#4ADE80",
      warning: "#FACC15",
      error: "#F87171",
      info: "#60A5FA",

      special1: "#A78BFA",
      special2: "#22D3EE",
      special3: "#E5E5E5",
    },
  },

  effects: {
    radiusSm: "0.375rem",
    radiusMd: "0.5rem",
    radiusLg: "0.75rem",
    radiusXl: "1rem",
    radiusFull: "9999px",

    // Crisp, minimal shadows
    shadowSm: "0 1px 2px rgba(0, 0, 0, 0.05)",
    shadowMd: "0 4px 6px rgba(0, 0, 0, 0.05)",
    shadowLg: "0 8px 16px rgba(0, 0, 0, 0.08)",
    shadowGlow: "0 0 0 1px rgba(124, 58, 237, 0.5)",

    transitionFast: "100ms ease",
    transitionNormal: "150ms ease",
    transitionSlow: "300ms ease",
  },
};

// =============================================================================
// EXPORTS
// =============================================================================

export const themes: Record<ThemeId, Theme> = {
  "retro-tech": retroTechTheme,
  "warm-knowledge": warmKnowledgeTheme,
  "modern-editorial": modernEditorialTheme,
};

export const defaultThemeId: ThemeId = "retro-tech";

export function getTheme(id: ThemeId = defaultThemeId): Theme {
  return themes[id];
}

export function getThemeCSS(theme: Theme, mode: "light" | "dark" = "light"): string {
  const colors = theme.colors[mode];
  const { typography, effects } = theme;

  return `
    /* Typography */
    --font-headline: ${typography.fontHeadline};
    --font-body: ${typography.fontBody};
    --font-mono: ${typography.fontMono};

    --font-weight-light: ${typography.weightLight};
    --font-weight-regular: ${typography.weightRegular};
    --font-weight-medium: ${typography.weightMedium};
    --font-weight-bold: ${typography.weightBold};
    --font-weight-black: ${typography.weightBlack};

    --text-xs: ${typography.scaleXs};
    --text-sm: ${typography.scaleSm};
    --text-base: ${typography.scaleBase};
    --text-lg: ${typography.scaleLg};
    --text-xl: ${typography.scaleXl};
    --text-2xl: ${typography.scale2xl};
    --text-3xl: ${typography.scale3xl};
    --text-4xl: ${typography.scale4xl};
    --text-5xl: ${typography.scale5xl};

    --leading-tight: ${typography.leadingTight};
    --leading-normal: ${typography.leadingNormal};
    --leading-relaxed: ${typography.leadingRelaxed};

    --tracking-tight: ${typography.trackingTight};
    --tracking-normal: ${typography.trackingNormal};
    --tracking-wide: ${typography.trackingWide};

    /* Colors */
    --color-primary: ${colors.primary};
    --color-primary-hover: ${colors.primaryHover};
    --color-primary-muted: ${colors.primaryMuted};
    --color-accent: ${colors.accent};
    --color-accent-hover: ${colors.accentHover};
    --color-accent-muted: ${colors.accentMuted};

    --bg-primary: ${colors.bgPrimary};
    --bg-secondary: ${colors.bgSecondary};
    --bg-tertiary: ${colors.bgTertiary};
    --bg-inverse: ${colors.bgInverse};

    --text-primary: ${colors.textPrimary};
    --text-secondary: ${colors.textSecondary};
    --text-muted: ${colors.textMuted};
    --text-inverse: ${colors.textInverse};
    --text-accent: ${colors.textAccent};

    --border-light: ${colors.borderLight};
    --border-medium: ${colors.borderMedium};
    --border-strong: ${colors.borderStrong};

    --color-success: ${colors.success};
    --color-warning: ${colors.warning};
    --color-error: ${colors.error};
    --color-info: ${colors.info};

    --color-special-1: ${colors.special1};
    --color-special-2: ${colors.special2};
    --color-special-3: ${colors.special3};

    /* Effects */
    --radius-sm: ${effects.radiusSm};
    --radius-md: ${effects.radiusMd};
    --radius-lg: ${effects.radiusLg};
    --radius-xl: ${effects.radiusXl};
    --radius-full: ${effects.radiusFull};

    --shadow-sm: ${effects.shadowSm};
    --shadow-md: ${effects.shadowMd};
    --shadow-lg: ${effects.shadowLg};
    --shadow-glow: ${effects.shadowGlow};

    --transition-fast: ${effects.transitionFast};
    --transition-normal: ${effects.transitionNormal};
    --transition-slow: ${effects.transitionSlow};
  `.trim();
}
