import { Platform, useColorScheme } from "react-native";

// ─── Color Tokens ──────────────────────────────────────────────────────────────

// Champagne Gold — warm, premium, precise. Inspired by luxury instruments & trading terminals.
const light = {
  bgPrimary: "#FFFEF9",       // warm white — not cold
  bgSecondary: "#F5F2EA",     // warm parchment
  surface: "#FFFFFF",
  surfaceElevated: "#FFFFFF",
  border: "#DDD8CC",          // warm border
  borderSubtle: "#EDE9E0",
  textPrimary: "#1A1814",     // warm near-black
  textSecondary: "#6B6357",   // warm gray
  textTertiary: "#A89F90",    // muted warm
  accent: "#A07218",          // deep amber-gold — readable at 5.5:1 on warm white
  accentSoft: "#FAF4E2",      // warm gold tint
  accentPress: "#7A5510",
  success: "#1A7F47",
  successSoft: "#E8F5EE",
  warning: "#C0620A",
  warningSoft: "#FFF3E0",
  danger: "#C0392B",
  dangerSoft: "#FDEDEC",
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
