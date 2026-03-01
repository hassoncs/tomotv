import { LiquidGlassView, isLiquidGlassSupported } from "@callstack/liquid-glass";
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
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView effect={effect} tintColor={tintColor} interactive={interactive} style={style}>
        {children}
      </LiquidGlassView>
    );
  }

  return (
    <BlurView intensity={GLASS.fallbackBlurIntensity} tint={GLASS.fallbackBlurTint} style={style}>
      {children}
    </BlurView>
  );
}
