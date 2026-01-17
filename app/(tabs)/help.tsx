import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";

type IoniconName = keyof typeof Ionicons.glyphMap;

interface Feature {
  icon: IoniconName;
  label: string;
}

const features: Feature[] = [
  { icon: "play-circle", label: "Adaptive Streaming" },
  { icon: "cloud-done", label: "iCloud Sync" },
  { icon: "flash", label: "Direct Play" },
];

const DOCS_URL = "keiver.dev/lab/tomotv";

export default function HelpScreen() {
  const appFile = require("@/app.json");
  const { version = "0.0.0" } = appFile?.expo || {};

  return (
    <View style={styles.container}>
      {/* Ambient glow effects */}
      <View style={styles.glowTopRight} />
      <View style={styles.glowBottomLeft} />

      <View style={styles.columns}>
        {/* Left Column */}
        <View style={styles.leftColumn}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.iconRow}>
              <View style={styles.iconGlow}>
                <Image source={require("@/assets/images/icon.png")} style={styles.appIcon} />
              </View>
              <View style={styles.titleBlock}>
                <Text style={styles.title}>Tomo TV</Text>
                <Text style={styles.subtitle}>Your Jellyfin library,{"\n"} connecting your Apple TV to your personal videos.</Text>
              </View>
            </View>

            {/* Feature pills */}
            <View style={styles.pillsRow}>
              {features.map((f, i) => (
                <Pressable key={f.label} style={({ focused }) => [styles.pill, focused && styles.pillFocused]} isTVSelectable hasTVPreferredFocus={i === 0}>
                  <Ionicons name={f.icon} size={18} color="#FFC312" />
                  <Text style={styles.pillText}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Built for <Text style={styles.jellyfinAccent}>Jellyfin</Text>
            </Text>
            <View style={styles.dot} />
            <Text style={styles.versionText}>{version}</Text>
          </View>
        </View>

        {/* Right Column - QR Card */}
        <Pressable style={({ focused }) => [styles.qrCard, focused && styles.qrCardFocused]} isTVSelectable>
          <LinearGradient colors={["rgba(52,199,89,0.15)", "rgba(52,199,89,0.05)", "transparent"]} style={styles.qrGradient} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />

          <Text style={styles.qrEyebrow}>SETUP GUIDE</Text>

          <View style={styles.qrFrame}>
            <Image source={require("@/assets/images/tomotv-qr-1000px.png")} style={styles.qrImage} />
          </View>

          <Text style={styles.qrUrl}>{DOCS_URL}</Text>
          <Text style={styles.qrHint}>Scan to get started</Text>
        </Pressable>
      </View>
    </View>
  );
}

const TV = Platform.isTV;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0D0D0F",
  },

  // Ambient background glows
  glowTopRight: {
    position: "absolute",
    top: -200,
    right: -200,
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: "rgba(255, 195, 18, 0.06)",
  },
  glowBottomLeft: {
    position: "absolute",
    bottom: -300,
    left: -200,
    width: 700,
    height: 700,
    borderRadius: 350,
    backgroundColor: "rgba(52, 199, 89, 0.04)",
  },

  // Layout
  columns: {
    flex: 1,
    flexDirection: "row",
    paddingHorizontal: TV ? 100 : 48,
    paddingVertical: TV ? 80 : 48,
    gap: TV ? 80 : 40,
  },

  // Left
  leftColumn: {
    flex: 1,
    justifyContent: "space-between",
  },
  hero: {},
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: TV ? 28 : 18,
    marginBottom: TV ? 48 : 28,
  },
  iconGlow: {
    shadowColor: "#FFC312",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: TV ? 50 : 30,
  },
  appIcon: {
    width: TV ? 120 : 80,
    height: TV ? 120 : 80,
    borderRadius: TV ? 60 : 40,
  },
  titleBlock: {},
  title: {
    fontSize: TV ? 72 : 48,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -2,
    marginBottom: TV ? 4 : 2,
  },
  subtitle: {
    fontSize: TV ? 24 : 16,
    fontWeight: "500",
    color: "#6E6E73",
    lineHeight: TV ? 34 : 24,
  },

  // Feature pills
  pillsRow: {
    flexDirection: "row",
    gap: TV ? 16 : 10,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: TV ? 10 : 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    paddingVertical: TV ? 14 : 10,
    paddingHorizontal: TV ? 20 : 14,
    borderRadius: TV ? 50 : 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  pillFocused: {
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    borderColor: "#FFC312",
  },
  pillText: {
    fontSize: TV ? 17 : 13,
    fontWeight: "600",
    color: "#A1A1A6",
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: TV ? 12 : 8,
  },
  footerText: {
    fontSize: TV ? 16 : 12,
    color: "#48484A",
    fontWeight: "500",
  },
  jellyfinAccent: {
    color: "#34C759",
    fontWeight: "700",
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#38383A",
  },
  versionText: {
    fontSize: TV ? 16 : 12,
    color: "#38383A",
    fontWeight: "500",
  },

  // QR Card
  qrCard: {
    width: TV ? 400 : 260,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: TV ? 40 : 28,
    alignItems: "center",
    justifyContent: "center",
    padding: TV ? 48 : 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  qrCardFocused: {
    borderColor: "rgba(52, 199, 89, 0.5)",
    backgroundColor: "rgba(52, 199, 89, 0.08)",
  },
  qrGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "60%",
  },
  qrEyebrow: {
    fontSize: TV ? 13 : 10,
    fontWeight: "700",
    color: "#34C759",
    letterSpacing: 3,
    marginBottom: TV ? 28 : 18,
  },
  qrFrame: {
    backgroundColor: "#FFFFFF",
    padding: TV ? 20 : 14,
    borderRadius: TV ? 24 : 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 40,
    marginBottom: TV ? 28 : 18,
  },
  qrImage: {
    width: TV ? 220 : 140,
    height: TV ? 220 : 140,
  },
  qrUrl: {
    fontSize: TV ? 22 : 15,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: TV ? 8 : 6,
  },
  qrHint: {
    fontSize: TV ? 15 : 11,
    color: "#6E6E73",
    fontWeight: "500",
  },
});
