// To enable Liquid Glass (iOS 26+ / tvOS 26+):
// 1. npm install @callstack/liquid-glass
// 2. EXPO_TV=1 npx expo prebuild --platform ios --clean
// 3. Uncomment the isLiquidGlassSupported import below and the GLASS.isSupported assignment
//
// import { isLiquidGlassSupported } from "@callstack/liquid-glass";

export const COLORS = {
  background: "#0A0A0A",
  backgroundElevated: "#1C1C1E",
  backgroundCard: "#2C2C2E",

  glassTint: "rgba(255, 255, 255, 0.06)",
  glassTintFocused: "rgba(255, 255, 255, 0.12)",
  glassTintAccent: "rgba(255, 195, 18, 0.08)",

  accent: "#FFC312",
  accentMuted: "rgba(255, 195, 18, 0.5)",

  textPrimary: "#FFFFFF",
  textSecondary: "#98989D",
  textTertiary: "#636366",

  error: "#FF3B30",
  success: "#30D158",

  borderSubtle: "rgba(255, 255, 255, 0.08)",
  borderFocused: "rgba(255, 195, 18, 0.4)",
} as const;

export const SPACING = {
  screenPadding: 80,
  sectionGap: 48,
  shelfItemGap: 20,
  cardPadding: 16,
} as const;

export const TYPOGRAPHY = {
  heroTitle: { fontSize: 56, fontWeight: "800" as const, letterSpacing: -1 },
  heroSubtitle: { fontSize: 24, fontWeight: "500" as const },
  sectionTitle: { fontSize: 32, fontWeight: "700" as const },
  cardTitle: { fontSize: 20, fontWeight: "600" as const },
  body: { fontSize: 22, fontWeight: "400" as const },
  caption: { fontSize: 18, fontWeight: "400" as const },
} as const;

export const GLASS = {
  isSupported: false, // Replace with isLiquidGlassSupported once package is installed
  fallbackBlurIntensity: 60,
  fallbackBlurTint: "dark" as const,
} as const;
