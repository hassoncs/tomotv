import { Canvas, Fill, ImageShader, Shader, Skia, useImage } from "@shopify/react-native-skia";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

// ─── Shader ──────────────────────────────────────────────────────────────────
// Samples the image and fades alpha to 0 at the bottom.
// u_fadeStart: UV y where fade begins (e.g. 0.5 = halfway down)
// u_fadeEnd:   UV y where image is fully transparent (e.g. 0.88)
// Uses premultiplied alpha so compositing with the Skia background is clean.
const FADE_SKSL = `
uniform shader img;
uniform vec2 u_resolution;
uniform float u_fadeStart;
uniform float u_fadeEnd;

half4 main(float2 pos) {
  float2 uv = pos / u_resolution;
  half4 color = img.eval(pos);
  float alpha = 1.0 - smoothstep(u_fadeStart, u_fadeEnd, uv.y);
  return half4(color.rgb * alpha, color.a * alpha);
}
`;

const fadeEffect = (() => {
  const effect = Skia.RuntimeEffect.Make(FADE_SKSL);
  if (!effect) throw new Error("SkiaFadingHeroImage: shader compile failed");
  return effect;
})();

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SkiaFadingHeroImageProps {
  uri: string;
  width: number;
  height: number;
  /** UV y coordinate (0–1) where alpha begins fading. Default 0.5. */
  fadeStart?: number;
  /** UV y coordinate (0–1) where alpha reaches 0. Default 0.88. */
  fadeEnd?: number;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function SkiaFadingHeroImage({
  uri,
  width,
  height,
  fadeStart = 0.5,
  fadeEnd = 0.88,
}: SkiaFadingHeroImageProps) {
  const [currentUri, setCurrentUri] = useState(uri);
  const [previousUri, setPreviousUri] = useState<string | null>(null);
  const fadeAnim = useSharedValue(1);
  const uriRef = useRef(uri);

  const clearPrevious = useCallback(() => setPreviousUri(null), []);

  useEffect(() => {
    if (uriRef.current === uri) return;
    setPreviousUri(uriRef.current);
    uriRef.current = uri;
    setCurrentUri(uri);
    fadeAnim.value = 0;
    fadeAnim.value = withTiming(1, { duration: 600, easing: Easing.ease }, () => {
      runOnJS(clearPrevious)();
    });
  }, [uri, fadeAnim, clearPrevious]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: fadeAnim.value }));

  return (
    <>
      {previousUri && (
        <HeroImageLayer
          uri={previousUri}
          width={width}
          height={height}
          fadeStart={fadeStart}
          fadeEnd={fadeEnd}
        />
      )}
      {currentUri && (
        <Animated.View style={[styles.fill, fadeStyle]}>
          <HeroImageLayer
            uri={currentUri}
            width={width}
            height={height}
            fadeStart={fadeStart}
            fadeEnd={fadeEnd}
          />
        </Animated.View>
      )}
    </>
  );
}

// ─── HeroImageLayer ───────────────────────────────────────────────────────────

interface HeroImageLayerProps {
  uri: string;
  width: number;
  height: number;
  fadeStart: number;
  fadeEnd: number;
}

function HeroImageLayer({ uri, width, height, fadeStart, fadeEnd }: HeroImageLayerProps) {
  const image = useImage(uri);

  if (!image) return null;

  // Static uniforms — no animation needed, plain object is fine
  const uniforms = {
    u_resolution: [width, height] as const,
    u_fadeStart: fadeStart,
    u_fadeEnd: fadeEnd,
  };

  return (
    <Canvas style={{ width, height }}>
      <Fill>
        <Shader source={fadeEffect} uniforms={uniforms}>
          <ImageShader image={image} fit="cover" x={0} y={0} width={width} height={height} />
        </Shader>
      </Fill>
    </Canvas>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
