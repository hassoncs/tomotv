import { Canvas, Fill, ImageShader, Shader, Skia, useImage } from "@shopify/react-native-skia";
import React from "react";
import { View } from "react-native";
import { useDerivedValue } from "react-native-reanimated";

export interface SkiaFadingHeroImageProps {
  uri: string;
  width: number;
  height: number;
  /** UV y (0–1) where alpha fade begins. Default 0.5. */
  fadeStart?: number;
  /** UV y (0–1) where alpha reaches 0. Default 0.88. */
  fadeEnd?: number;
}

const FADE_SKSL = `
uniform shader image;
uniform vec2 u_resolution;
uniform float u_fadeStart;
uniform float u_fadeEnd;

half4 main(float2 pos) {
  float2 uv = pos / u_resolution;
  half4 color = image.eval(pos);
  float alpha = 1.0 - smoothstep(u_fadeStart, u_fadeEnd, uv.y);
  return half4(color.rgb * alpha, color.a * alpha);
}
`;

function compileShader(sksl: string) {
  const effect = Skia.RuntimeEffect.Make(sksl);
  if (!effect) {
    throw new Error("SkiaFadingHeroImage: failed to compile SkSL shader");
  }
  return effect;
}

const shaderSource = compileShader(FADE_SKSL);

export function SkiaFadingHeroImage({ uri, width, height, fadeStart = 0.5, fadeEnd = 0.88 }: SkiaFadingHeroImageProps) {
  const image = useImage(uri);

  const uniforms = useDerivedValue(
    () => ({
      u_resolution: [width, height] as const,
      u_fadeStart: fadeStart,
      u_fadeEnd: fadeEnd,
    }),
    [width, height, fadeStart, fadeEnd],
  );

  if (!image) {
    return <View style={{ width, height }} />;
  }

  return (
    <Canvas style={{ width, height }}>
      <Fill>
        <Shader source={shaderSource} uniforms={uniforms}>
          <ImageShader image={image} fit="cover" rect={{ x: 0, y: 0, width, height }} />
        </Shader>
      </Fill>
    </Canvas>
  );
}
