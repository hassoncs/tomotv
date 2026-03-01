import { Image } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";

interface DynamicBackgroundProps {
  imageUrl?: string;
}

export function DynamicBackground({ imageUrl }: DynamicBackgroundProps) {
  const [currentUrl, setCurrentUrl] = useState<string | undefined>(imageUrl);
  const [previousUrl, setPreviousUrl] = useState<string | undefined>(undefined);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (imageUrl === currentUrl) return;

    setPreviousUrl(currentUrl);
    setCurrentUrl(imageUrl);
    fadeAnim.setValue(0);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [imageUrl, currentUrl, fadeAnim]);

  return (
    <View style={styles.container}>
      {previousUrl && (
        <Image
          source={{ uri: previousUrl }}
          style={styles.layer}
          blurRadius={40}
          contentFit="cover"
          cachePolicy="disk"
        />
      )}
      <Animated.View style={[styles.layer, { opacity: fadeAnim }]}>
        {currentUrl && (
          <Image
            source={{ uri: currentUrl }}
            style={styles.layerFill}
            blurRadius={40}
            contentFit="cover"
            cachePolicy="disk"
          />
        )}
      </Animated.View>
      <View style={styles.overlay} />
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
});
