import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View } from "react-native";

export interface SkiaLibraryBackgroundProps {
  /** Jellyfin backdrop URL. If undefined, renders dark fallback. */
  imageUrl?: string;
}

function buildBlurUrl(imageUrl: string): string {
  const [baseUrl, query = ""] = imageUrl.split("?");
  const filtered = query
    .split("&")
    .filter((p) => p && !p.startsWith("maxWidth="))
    .join("&");
  const sep = filtered ? "&" : "";
  return `${baseUrl}?${filtered}${sep}maxWidth=200`;
}

export function SkiaLibraryBackground({ imageUrl }: SkiaLibraryBackgroundProps) {
  const blurUrl = imageUrl ? buildBlurUrl(imageUrl) : undefined;

  return (
    <View style={styles.container}>
      {/* Dark base — always visible */}
      <View style={[StyleSheet.absoluteFill, styles.darkBase]} />

      {/* Blurred backdrop — expo-image handles crossfade automatically when URI changes */}
      <Image source={blurUrl ? { uri: blurUrl } : undefined} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={10} transition={{ duration: 500, effect: "cross-dissolve" }} />

      {/* Darkening gradient: subtle at top, heavier at bottom */}
      <LinearGradient colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.65)"]} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  darkBase: {
    backgroundColor: "#0a0a0a",
  },
});
