import { Canvas, Fill, ImageShader, Shader, Skia, useImage } from "@shopify/react-native-skia";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { SharedValue } from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── SkSL Shaders ────────────────────────────────────────────────────────────
// Clear-to-blur masking shader with graduated darkening.
// Low-res upscale trick: 200px image → bilinear upscale = natural, free blur.
// 9-tap box blur adds extra smoothness in the blurred region only.
const CLEAR_BLUR_SKSL = `
uniform shader clearImg;
uniform shader blurImg;
uniform vec2 u_resolution;
uniform float u_blurLine;

vec4 main(vec2 pos) {
  vec2 uv = pos / u_resolution;

  // Clear image sampled at full resolution
  vec4 clear = clearImg.eval(pos);

  // 9-tap box blur on the low-res image (inlined — SkSL disallows 'shader' as function param)
  vec4 blurSum = vec4(0.0);
  float r = 6.0;
  blurSum += blurImg.eval(pos + vec2(-r, -r));
  blurSum += blurImg.eval(pos + vec2( 0, -r));
  blurSum += blurImg.eval(pos + vec2( r, -r));
  blurSum += blurImg.eval(pos + vec2(-r,  0));
  blurSum += blurImg.eval(pos);
  blurSum += blurImg.eval(pos + vec2( r,  0));
  blurSum += blurImg.eval(pos + vec2(-r,  r));
  blurSum += blurImg.eval(pos + vec2( 0,  r));
  blurSum += blurImg.eval(pos + vec2( r,  r));
  vec4 blur = blurSum / 9.0;

  // Clear at top, blurred at bottom with smooth transition at u_blurLine
  float t = smoothstep(u_blurLine - 0.1, u_blurLine + 0.1, uv.y);
  vec4 color = mix(clear, blur, t);

  // Graduated darkening: 10% at top → 45% at bottom
  float darkness = mix(0.10, 0.45, uv.y);
  color.rgb *= (1.0 - darkness);

  return color;
}
`;

// Dark fallback: subtle radial gradient shown when no image is available
const DARK_FALLBACK_SKSL = `
uniform vec2 u_resolution;

vec4 main(vec2 pos) {
  vec2 uv = pos / u_resolution;
  float dist = length(uv - vec2(0.5)) * 1.4;
  float brightness = mix(0.085, 0.035, dist);
  return vec4(vec3(brightness), 1.0);
}
`;

// Compile at module level — throws on SkSL syntax errors (caught at startup)
function compileShader(sksl: string) {
  const effect = Skia.RuntimeEffect.Make(sksl);
  if (!effect) throw new Error("SkiaLibraryBackground: shader compile failed");
  return effect;
}

const clearBlurEffect = compileShader(CLEAR_BLUR_SKSL);
const darkFallbackEffect = compileShader(DARK_FALLBACK_SKSL);

// ─── Types ───────────────────────────────────────────────────────────────────

interface ImagePair {
  clearUrl: string;
  blurUrl: string;
}

export interface SkiaLibraryBackgroundProps {
  /** Jellyfin backdrop URL. If undefined, renders dark fallback. */
  imageUrl?: string;
  /** Blur line position: 0.0 (top) to 1.0 (bottom). Default 0.45. Accepts SharedValue for scroll animation. */
  blurLine?: SharedValue<number> | number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPair(imageUrl: string): ImagePair {
  const [baseUrl, query = ""] = imageUrl.split("?");
  const filtered = query
    .split("&")
    .filter((p) => p && !p.startsWith("maxWidth="))
    .join("&");
  const sep = filtered ? "&" : "";
  return {
    clearUrl: `${baseUrl}?${filtered}${sep}maxWidth=1920`,
    blurUrl: `${baseUrl}?${filtered}${sep}maxWidth=100`,
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SkiaLibraryBackground({ imageUrl, blurLine = 0.45 }: SkiaLibraryBackgroundProps) {
  const [currentPair, setCurrentPair] = useState<ImagePair | null>(null);
  const [previousPair, setPreviousPair] = useState<ImagePair | null>(null);
  const fadeAnim = useSharedValue(1);

  // Track current pair via ref to avoid currentPair in effect deps (prevents infinite loop)
  const currentPairRef = useRef<ImagePair | null>(null);

  const clearPrevious = useCallback(() => setPreviousPair(null), []);

  useEffect(() => {
    const newPair = imageUrl ? buildPair(imageUrl) : null;

    // Skip if it's the same image (compare full-res URL as canonical key)
    if (newPair?.clearUrl === currentPairRef.current?.clearUrl) return;

    setPreviousPair(currentPairRef.current);
    currentPairRef.current = newPair;
    setCurrentPair(newPair);

    // Cross-fade: new pair fades in over previous, previous cleared via runOnJS callback
    fadeAnim.value = 0;
    fadeAnim.value = withTiming(1, { duration: 500, easing: Easing.ease }, () => {
      runOnJS(clearPrevious)();
    });
  }, [imageUrl, fadeAnim, clearPrevious]);

  // Normalize blurLine: plain number or SharedValue → SharedValue
  const blurLineValue = useDerivedValue(() =>
    typeof blurLine === "number" ? blurLine : blurLine.value,
  );

  // Hoisted at top level — avoids conditional hook violation
  const fallbackUniforms = useDerivedValue(() => ({
    u_resolution: [SCREEN_WIDTH, SCREEN_HEIGHT] as const,
  }));

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  return (
    <>
      {/* Dark fallback — always rendered as base layer behind everything */}
      <Canvas style={styles.layer} pointerEvents="none">
        <Fill>
          <Shader source={darkFallbackEffect} uniforms={fallbackUniforms} />
        </Fill>
      </Canvas>

      {/* Previous image pair — stays at full opacity until current fades in */}
      {previousPair && <ImagePairLayer pair={previousPair} blurLine={blurLineValue} />}

      {/* Current image pair — animates in on top */}
      {currentPair && (
        <Animated.View style={[styles.layer, fadeStyle]} pointerEvents="none">
          <ImagePairLayer pair={currentPair} blurLine={blurLineValue} />
        </Animated.View>
      )}
    </>
  );
}

// ─── ImagePairLayer ───────────────────────────────────────────────────────────

interface ImagePairLayerProps {
  pair: ImagePair;
  blurLine: SharedValue<number>;
}

function ImagePairLayer({ pair, blurLine }: ImagePairLayerProps) {
  const clearImage = useImage(pair.clearUrl);
  const blurImage = useImage(pair.blurUrl);

  const uniforms = useDerivedValue(() => ({
    u_resolution: [SCREEN_WIDTH, SCREEN_HEIGHT] as const,
    u_blurLine: blurLine.value,
  }));

  // Render nothing until both images are decoded — prevents flash of unloaded content
  if (!clearImage || !blurImage) return null;

  return (
    <Canvas style={styles.layer} pointerEvents="none">
      <Fill>
        {/* ImageShader children bind to clearImg/blurImg uniforms in declaration order */}
        <Shader source={clearBlurEffect} uniforms={uniforms}>
          <ImageShader image={clearImage} fit="cover" x={0} y={0} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} />
          <ImageShader image={blurImage} fit="cover" x={0} y={0} width={SCREEN_WIDTH} height={SCREEN_HEIGHT} />
        </Shader>
      </Fill>
    </Canvas>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
});
