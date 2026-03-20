import { Platform, useColorScheme } from "react-native";

// ─── Color Tokens ──────────────────────────────────────────────────────────────

// Champagne Gold — warm, premium, precise. Inspired by luxury instruments & trading terminals.
const light = {
  bgPrimary: "#E8DFC9",       // rich warm champagne — white surfaces float above this
  bgSecondary: "#DDD4BC",     // deeper warm layer for inset sections
  surface: "#FDFCF8",         // warm near-white — pops off bgPrimary
  surfaceElevated: "#FFFFFF", // pure white for highest elevation
  border: "#C6BC9F",          // warm tan border — visible contrast
  borderSubtle: "#D4CBB5",    // subtle warm separator
  textPrimary: "#14120D",     // deep warm near-black
  textSecondary: "#504A3C",   // warm mid-tone
  textTertiary: "#8A7E6A",    // muted warm
  accent: "#7A5010",          // deep amber gold — WCAG AA on champagne bg
  accentSoft: "#F5E4B8",      // warm golden highlight — distinct from bgPrimary
  accentPress: "#5E3D0A",
  success: "#1A7F47",
  successSoft: "#D4EEE1",
  warning: "#B85A09",
  warningSoft: "#FDEBD8",
  danger: "#B83426",
  dangerSoft: "#FDDBD7",
};

const dark = {
  bgPrimary: "#0B0A08",       // deep warm dark — not cold black
  bgSecondary: "#191710",
  surface: "#191710",
  surfaceElevated: "#232018",
  border: "#332E22",          // warm dark border
  borderSubtle: "#232018",
  textPrimary: "#F0EDE4",     // warm white — not harsh
  textSecondary: "#9C9080",   // warm mid-gray
  textTertiary: "#6B6357",
  accent: "#D4A843",          // champagne gold — warm, luxurious
  accentSoft: "rgba(212,168,67,0.13)",
  accentPress: "#ECC060",
  success: "#34D399",
  successSoft: "#062016",
  warning: "#FB923C",
  warningSoft: "#2A1200",
  danger: "#F87171",
  dangerSoft: "#2E0A08",
};

export type ColorTokens = typeof light;

// ─── Gradients ─────────────────────────────────────────────────────────────────
// For use with expo-linear-gradient. Top → bottom.

export const Gradients = {
  light: {
    // Starts richer at the top, fades to warm cream — classic luxury depth
    page: ["#DDD3BB", "#E8DFC9", "#F2EBD9"] as string[],
    // Hero / accent tint sections
    hero: ["#EDD9A8", "#F5EDD4"] as string[],
  },
  dark: {
    // Barely perceptible warm lift — preserves OLED feel with subtle depth
    page: ["#0B0A08", "#0E0C09", "#131009"] as string[],
    // Subtle gold glow for hero sections
    hero: ["rgba(212,168,67,0.10)", "rgba(212,168,67,0.02)"] as string[],
  },
};

export function getColors(scheme: "light" | "dark"): ColorTokens {
  return scheme === "dark" ? dark : light;
}

export function useColors(): ColorTokens {
  const scheme = useColorScheme();
  return scheme === "dark" ? dark : light;
}

// ─── Spacing ───────────────────────────────────────────────────────────────────

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

// ─── Border Radius ─────────────────────────────────────────────────────────────

export const Radius = {
  sharp: 6,
  card: 16,
  large: 24,
  xl: 32,
  pill: 999,
} as const;

// ─── Typography ────────────────────────────────────────────────────────────────

export const FontFamily = {
  display: "Syne_800ExtraBold",
  heading: "Syne_700Bold",
  semibold: "Syne_600SemiBold",
  body: "Syne_400Regular",
  mono: Platform.select({ ios: "Menlo-Regular", android: "monospace" }) as string,
  monoSemibold: Platform.select({ ios: "Menlo-Bold", android: "monospace" }) as string,
};

export const FontSize = {
  display: 48,
  h1: 34,
  h2: 28,
  h3: 22,
  h4: 18,
  body: 16,
  bodySmall: 14,
  label: 12,
  caption: 11,
  dataLarge: 28,
  dataMedium: 16,
  dataSmall: 13,
} as const;

export const LineHeight = {
  display: 52,
  h1: 40,
  h2: 34,
  h3: 28,
  h4: 24,
  body: 24,
  bodySmall: 20,
  label: 16,
  caption: 16,
  dataLarge: 34,
  dataMedium: 22,
  dataSmall: 18,
} as const;

export const LetterSpacing = {
  display: -1.5,
  h1: -0.8,
  h2: -0.4,
  h3: -0.2,
  label: 0.5,
  caption: 0.3,
} as const;

// ─── Duration ──────────────────────────────────────────────────────────────────

export const Duration = {
  instant: 100,
  fast: 180,
  normal: 300,
  slow: 480,
  onboarding: 600,
} as const;

// ─── Health Factor Semantic Color ──────────────────────────────────────────────

export function getHFColor(hf: number, colors: ColorTokens): string {
  if (hf >= 2.0) return colors.success;
  if (hf >= 1.5) return colors.warning;
  return colors.danger;
}

export function getHFBgColor(hf: number, colors: ColorTokens): string {
  if (hf >= 2.0) return colors.successSoft;
  if (hf >= 1.5) return colors.warningSoft;
  return colors.dangerSoft;
}
