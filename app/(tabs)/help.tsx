/**
 * @deprecated This tab has been replaced by the AI tab (ai.tsx).
 * File kept to avoid breaking any deep-link routes that may reference it.
 */
import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useBackground } from "@/contexts/BackgroundContext";

export default function HelpScreen() {
  const { setScreenContext, setBackdropUrl } = useBackground();
  useEffect(() => {
    setScreenContext("home");
    setBackdropUrl(undefined);
  }, [setScreenContext, setBackdropUrl]);

  return (
    <View style={styles.container}>
      <Text style={styles.text}>This screen has been replaced by the AI tab.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  text: {
    color: "#98989D",
    fontSize: 24,
  },
});
