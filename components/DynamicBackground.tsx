import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import type { ImageSource } from "@/contexts/BackgroundContext";

interface DynamicBackgroundProps {
  source?: ImageSource;
  blurRadius?: number;
  overlayOpacity?: number;
}

function getSourceKey(source?: ImageSource): string {
  if (!source) return "";
  if (typeof source === "number") return String(source);
  return source.uri;
}

export function DynamicBackground({ source, blurRadius = 50, overlayOpacity = 0.55 }: DynamicBackgroundProps) {
  const [currentSource, setCurrentSource] = useState<ImageSource | undefined>(source);
  const [previousSource, setPreviousSource] = useState<ImageSource | undefined>(undefined);
  const fadeAnim = useSharedValue(1);

  useEffect(() => {
    const currentKey = getSourceKey(currentSource);
    const newKey = getSourceKey(source);
    if (currentKey === newKey) return;

    setPreviousSource(currentSource);
    setCurrentSource(source);
    fadeAnim.value = 0;
    fadeAnim.value = withTiming(1, { duration: 500 });
  }, [source, currentSource, fadeAnim]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: fadeAnim.value,
  }));

  return (
    <View style={styles.container} pointerEvents="none">
      {previousSource && (
        <Image
          source={previousSource}
          style={styles.layer}
          blurRadius={blurRadius}
          contentFit="cover"
          cachePolicy="disk"
        />
      )}
      <Animated.View style={[styles.layer, animatedStyle]}>
        {currentSource && (
          <Image
            source={currentSource}
            style={styles.layerFill}
            blurRadius={blurRadius}
            contentFit="cover"
            cachePolicy="disk"
          />
        )}
      </Animated.View>
      <LinearGradient
        colors={[
          `rgba(10,10,10,${(overlayOpacity * 0.3).toFixed(3)})`,
          `rgba(10,10,10,${overlayOpacity.toFixed(3)})`,
          `rgba(10,10,10,${overlayOpacity.toFixed(3)})`,
        ]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFillObject}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: -1,
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
  layerFill: {
    width: "100%",
    height: "100%",
  },
});
