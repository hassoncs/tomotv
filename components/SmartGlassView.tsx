// SmartGlassView — wraps LiquidGlassView with automatic fallback to BlurView.
//
// To enable Liquid Glass (iOS 26+ / tvOS 26+):
// 1. npm install @callstack/liquid-glass
// 2. EXPO_TV=1 npx expo prebuild --platform ios --clean
// 3. Uncomment the LiquidGlassView import and usage block below.
//
// import { LiquidGlassView, isLiquidGlassSupported } from "@callstack/liquid-glass";

import { GLASS } from "@/constants/theme";
import { BlurView } from "expo-blur";
import React from "react";
import { StyleProp, ViewStyle } from "react-native";

interface SmartGlassViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  effect?: "regular" | "clear";
  tintColor?: string;
  interactive?: boolean;
}

export function SmartGlassView({ children, style, effect = "regular", tintColor, interactive = false }: SmartGlassViewProps) {
  // Suppress unused-var warnings for props used when liquid glass is enabled
  void effect;
  void tintColor;
  void interactive;

  // -- When @callstack/liquid-glass is installed, replace this block with: --
  // if (isLiquidGlassSupported) {
  //   return (
  //     <LiquidGlassView effect={effect} tintColor={tintColor} interactive={interactive} style={style}>
  //       {children}
  //     </LiquidGlassView>
  //   );
  // }

  return (
    <BlurView intensity={GLASS.fallbackBlurIntensity} tint={GLASS.fallbackBlurTint} style={style}>
      {children}
    </BlurView>
  );
}
