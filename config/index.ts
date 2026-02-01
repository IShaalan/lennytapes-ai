/**
 * LennyTapes Configuration
 *
 * Central export for all configuration modules.
 */

// Theme system
export {
  themes,
  defaultThemeId,
  getTheme,
  getThemeCSS,
  type Theme,
  type ThemeId,
  type ThemeTypography,
  type ThemeColors,
  type ThemeEffects,
} from "./themes.js";

// Font configuration
export {
  themeFonts,
  getGoogleFontsUrl,
  getAllFontsUrls,
  type FontConfig,
  type ThemeFonts,
} from "./fonts.js";

// Brand identity
export { BRAND, LOGO, VISUAL_METAPHORS, VOICE, SOCIAL } from "./brand.js";
