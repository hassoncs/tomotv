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

export function SmartGlassView({ children, style }: SmartGlassViewProps) {
  return (
    <BlurView intensity={60} tint="dark" style={style}>
      {children}
    </BlurView>
  );
}
