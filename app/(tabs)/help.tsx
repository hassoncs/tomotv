import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Feature {
  icon: IoniconName;
  title: string;
  subtitle: string;
  caption: string;
}

const features: Feature[] = [
  { icon: "play-circle", title: "HLS", subtitle: "Streaming", caption: "Adaptive bitrate playback" },
  { icon: "cloud-done", title: "iCloud", subtitle: "Sync", caption: "Settings across devices" },
  { icon: "flash", title: "Direct", subtitle: "Play", caption: "No transcoding needed" },
];

const DOCS_URL = "keiver.dev/lab/tomotv";

export default function HelpScreen() {
  const appFile = require("@/app.json");
  const { version = "0.0.0" } = appFile?.expo || {};

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.appIconGlow}>
            <Image source={require("@/assets/images/icon.png")} style={styles.appIcon} resizeMode="contain" />
          </View>
          <Text style={styles.heroTitle}>Tomo TV</Text>
          <Text style={styles.heroSubtitle}>Stream your Jellyfin library on Apple TV</Text>
        </View>

        {/* Feature Cards */}
        <View style={styles.featuresRow}>
          {features.map((feature, index) => (
            <Pressable key={feature.title} style={({ focused }) => [styles.featureCard, focused && styles.featureCardFocused]} isTVSelectable={true} hasTVPreferredFocus={index === 0}>
              <View style={styles.featureCircle}>
                <Ionicons name={feature.icon} size={Platform.isTV ? 44 : 32} color="#FFC312" />
              </View>
              <Text style={styles.featureTitle}>{feature.title}</Text>
              <Text style={styles.featureSubtitle}>{feature.subtitle}</Text>
              <Text style={styles.featureCaption}>{feature.caption}</Text>
            </Pressable>
          ))}
        </View>

        {/* QR Code & Documentation Section */}
        <Pressable style={({ focused }) => [styles.docsCard, focused && styles.docsCardFocused]} isTVSelectable={true}>
          <View style={styles.docsContent}>
            <View style={styles.qrWrapper}>
              <Image source={require("@/assets/images/tomotv-qr-1000px.png")} style={styles.qrCode} resizeMode="contain" />
            </View>
            <View style={styles.docsTextBlock}>
              <Text style={styles.docsLabel}>Documentation & Setup Guide</Text>
              <Text style={styles.docsUrl}>{DOCS_URL}</Text>
              <Text style={styles.docsScan}>Scan with your phone camera</Text>
            </View>
          </View>
        </Pressable>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.jellyfinText}>
            Made for your <Text style={styles.jellyfinHighlight}>Jellyfin</Text> library
          </Text>
          <View style={styles.footerDivider} />
          <Text style={styles.versionText}>Version {version}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1C1C1E",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    width: "100%",
    maxWidth: Platform.isTV ? 1000 : 500,
    paddingHorizontal: Platform.isTV ? 80 : 24,
    alignItems: "center",
  },
  // Hero Section
  heroSection: {
    alignItems: "center",
    marginTop: Platform.isTV ? 160 : 80,
    marginBottom: Platform.isTV ? 48 : 28,
  },
  appIconGlow: {
    shadowColor: "#FFC312",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: Platform.isTV ? 40 : 25,
    marginBottom: Platform.isTV ? 20 : 14,
  },
  appIcon: {
    width: Platform.isTV ? 130 : 90,
    height: Platform.isTV ? 130 : 90,
    borderRadius: Platform.isTV ? 65 : 45,
  },
  heroTitle: {
    fontSize: Platform.isTV ? 52 : 36,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: Platform.isTV ? 6 : 4,
    letterSpacing: -1,
  },
  heroSubtitle: {
    fontSize: Platform.isTV ? 22 : 16,
    color: "#AEAEB2",
    fontWeight: "500",
    textAlign: "center",
  },
  // Feature Cards
  featuresRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Platform.isTV ? 28 : 16,
    marginBottom: Platform.isTV ? 48 : 28,
  },
  featureCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 24 : 18,
    paddingVertical: Platform.isTV ? 32 : 22,
    paddingHorizontal: Platform.isTV ? 48 : 28,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
    minWidth: Platform.isTV ? 240 : 110,
  },
  featureCardFocused: {
    borderColor: "#FFC312",
    backgroundColor: "#3A3A3C",
    transform: [{ scale: 1.08 }],
  },
  featureCircle: {
    width: Platform.isTV ? 88 : 60,
    height: Platform.isTV ? 88 : 60,
    borderRadius: Platform.isTV ? 44 : 30,
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    borderWidth: 2,
    borderColor: "rgba(255, 195, 18, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Platform.isTV ? 16 : 10,
  },
  featureTitle: {
    fontSize: Platform.isTV ? 24 : 16,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: Platform.isTV ? 2 : 1,
  },
  featureSubtitle: {
    fontSize: Platform.isTV ? 18 : 13,
    fontWeight: "500",
    color: "#8E8E93",
  },
  featureCaption: {
    fontSize: Platform.isTV ? 14 : 10,
    fontWeight: "400",
    color: "#636366",
    marginTop: Platform.isTV ? 8 : 6,
    textAlign: "center",
  },
  // Documentation Card
  docsCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 24 : 18,
    padding: Platform.isTV ? 28 : 20,
    width: "100%",
    maxWidth: Platform.isTV ? 700 : 400,
    borderWidth: 2,
    borderColor: "rgba(52, 199, 89, 0.25)",
    marginBottom: Platform.isTV ? 36 : 24,
  },
  docsCardFocused: {
    borderColor: "#34C759",
    backgroundColor: "#3A3A3C",
    transform: [{ scale: 1.02 }],
  },
  docsContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Platform.isTV ? 28 : 16,
  },
  qrWrapper: {
    backgroundColor: "#FFFFFF",
    borderRadius: Platform.isTV ? 16 : 10,
    padding: Platform.isTV ? 10 : 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  qrCode: {
    width: Platform.isTV ? 110 : 70,
    height: Platform.isTV ? 110 : 70,
  },
  docsTextBlock: {
    flex: 1,
  },
  docsLabel: {
    fontSize: Platform.isTV ? 18 : 13,
    color: "#8E8E93",
    marginBottom: Platform.isTV ? 6 : 4,
    fontWeight: "500",
  },
  docsUrl: {
    fontSize: Platform.isTV ? 28 : 18,
    fontWeight: "800",
    color: "#34C759",
    marginBottom: Platform.isTV ? 8 : 4,
  },
  docsScan: {
    fontSize: Platform.isTV ? 15 : 11,
    color: "#636366",
    fontStyle: "italic",
  },
  // Footer
  footer: {
    alignItems: "center",
  },
  jellyfinText: {
    fontSize: Platform.isTV ? 17 : 13,
    color: "#8E8E93",
    textAlign: "center",
  },
  jellyfinHighlight: {
    color: "#34C759",
    fontWeight: "700",
  },
  footerDivider: {
    width: Platform.isTV ? 60 : 40,
    height: 2,
    backgroundColor: "rgba(255, 195, 18, 0.3)",
    marginVertical: Platform.isTV ? 12 : 8,
    borderRadius: 1,
  },
  versionText: {
    fontSize: Platform.isTV ? 15 : 12,
    color: "#636366",
  },
});
