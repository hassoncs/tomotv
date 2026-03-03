import { Canvas, Fill, Shader, Skia } from "@shopify/react-native-skia";
import React, { useEffect } from "react";
import { Dimensions, StyleSheet } from "react-native";
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// ─── SkSL Shader ─────────────────────────────────────────────────────────────
// Animated iridescent fractal — IQ cosine palette technique.
// Renders a mesmerizing, slowly-shifting color field suitable as a dark background.
const IRIDESCENT_SKSL = `
uniform float u_time;
uniform vec2 u_resolution;

vec3 palette(float t) {
    vec3 a = vec3(0.5, 0.5, 0.5);
    vec3 b = vec3(0.5, 0.5, 0.5);
    vec3 c = vec3(1.0, 1.0, 1.0);
    vec3 d = vec3(0.263, 0.416, 0.557);
    return a + b * cos(6.28318 * (c * t + d));
}

vec4 main(vec2 pos) {
    vec2 uv = (pos * 2.0 - u_resolution) / min(u_resolution.x, u_resolution.y);
    vec2 uv0 = uv;
    vec3 finalColor = vec3(0.0);

    for (float i = 0.0; i < 4.0; i += 1.0) {
        uv = fract(uv * 1.5) - 0.5;
        float d = length(uv) * exp(-length(uv0));
        vec3 col = palette(length(uv0) + i * 0.4 + u_time * 0.4);
        d = sin(d * 8.0 + u_time) / 8.0;
        d = abs(d);
        d = pow(0.01 / d, 1.2);
        finalColor += col * d;
    }

    // Dim to 35% so it works as a background without overpowering content
    finalColor *= 0.35;

    return vec4(finalColor, 1.0);
}
`;

// Compile once at module level — throws if SkSL has syntax errors
function compileShader(sksl: string) {
  const effect = Skia.RuntimeEffect.Make(sksl);
  if (!effect) {
    throw new Error("SkiaShaderBackground: failed to compile SkSL shader");
  }
  return effect;
}

const shaderSource = compileShader(IRIDESCENT_SKSL);

// ─── Component ───────────────────────────────────────────────────────────────

export function SkiaShaderBackground() {
  const clock = useSharedValue(0);

  useEffect(() => {
    // Continuously animate 0 → 2π×16 ≈ 100.5 over ~100s, then seamlessly repeat.
    // Using a multiple of 2π ensures sin/cos-based effects wrap without a visible jump.
    const target = Math.PI * 2 * 16;
    clock.value = withRepeat(withTiming(target, { duration: target * 1000, easing: Easing.linear }), -1, false);
  }, [clock]);

  const uniforms = useDerivedValue(() => ({
    u_time: clock.value,
    u_resolution: [SCREEN_WIDTH, SCREEN_HEIGHT] as const,
  }));

  return (
    <Canvas style={styles.canvas} pointerEvents="none">
      <Fill>
        <Shader source={shaderSource} uniforms={uniforms} />
      </Fill>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
});
