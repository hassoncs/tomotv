import {Ionicons} from "@expo/vector-icons"
import React from "react"
import {Image, Platform, Pressable, ScrollView, StyleSheet, Text, View} from "react-native"
import {SafeAreaView} from "react-native-safe-area-context"

type IoniconName = keyof typeof Ionicons.glyphMap

const directPlayCodecs = ["H.264", "HEVC (H.265)"]
const transcodeCodecs = ["MPEG-4", "VP8", "VP9", "AV1", "VC-1", "MPEG-2", "DivX/Xvid"]

const qualityPresets = [
  {label: "480p", description: "Lower bandwidth • Fastest start"},
  {label: "540p", description: "Balanced default"},
  {label: "720p", description: "Sharp / Recommended for TV"},
  {label: "1080p", description: "Best quality • Requires strong LAN"}
]

const troubleshootingSteps: {icon: IoniconName; title: string; text: string}[] = [
  {
    icon: "wifi",
    title: "Same Network",
    text: "Ensure TomoTV and your Jellyfin server share the same LAN. The dev IP helper writes the current LAN IP to .env.local automatically."
  },
  {
    icon: "hardware-chip",
    title: "Enable Transcoding",
    text: "In Jellyfin → Dashboard → Playback → Transcoding, enable hardware acceleration or install the latest FFmpeg build."
  },
  {
    icon: "construct",
    title: "Verify Credentials",
    text: "Open Settings → View iCloud Sync Status to confirm the server IP, API key, and User ID saved correctly."
  }
]

export default function HelpScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.contentContainer}>
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <Image source={require("@/assets/images/icon.png")} style={styles.appIcon} resizeMode="contain" />
            <Text style={styles.heroTitle}>Tomo TV</Text>
            <Text style={styles.heroSubtitle}>Play videos from your Jellyfin server on your Apple TV</Text>
          </View>

          {/* About Card */}
          <Pressable style={styles.card} isTVSelectable={true} hasTVPreferredFocus={true}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBadge}>
                <Ionicons name="information-circle" size={Platform.isTV ? 28 : 22} color="#FFC312" />
              </View>
              <Text style={styles.cardTitle}>About</Text>
            </View>
            <Text style={styles.cardText}>
              Play any video from Jellyfin servers on your Apple TV — no manual encoding required. Tomo TV automatically
              handles videos that won&apos;t normally play, so you can just hit play and watch.
            </Text>
          </Pressable>

          {/* Quick Start Section */}
          <Pressable style={styles.card} isTVSelectable={true}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBadge}>
                <Ionicons name="rocket-outline" size={Platform.isTV ? 28 : 22} color="#FFC312" />
              </View>
              <Text style={styles.cardTitle}>Quick Start</Text>
            </View>

            <View style={styles.circlesContainer}>
              <View style={styles.circleItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.circle}>
                  <Ionicons name="server-outline" size={Platform.isTV ? 40 : 32} color="#FFC312" />
                </View>
                <Text style={styles.circleLabel}>Setup Jellyfin</Text>
                <Text style={styles.circleLabel}>Server</Text>
              </View>

              <View style={styles.circleItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.circle}>
                  <Ionicons name="settings-outline" size={Platform.isTV ? 40 : 32} color="#FFC312" />
                </View>
                <Text style={styles.circleLabel}>Configure Tomo TV</Text>
                <Text style={styles.circleLabel}>with Credentials</Text>
              </View>

              <View style={styles.circleItem}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.circle}>
                  <Ionicons name="play-circle-outline" size={Platform.isTV ? 40 : 32} color="#FFC312" />
                </View>
                <Text style={styles.circleLabel}>Stream</Text>
                <Text style={styles.circleLabel}>Videos</Text>
              </View>
            </View>
          </Pressable>

          {/* Codec Support Card */}
          <Pressable style={styles.helpCard} isTVSelectable={true}>
            <View style={styles.helpCardHeader}>
              <View style={styles.helpIconContainer}>
                <Ionicons name="checkmark-circle" size={Platform.isTV ? 32 : 24} color="#34C759" />
              </View>
              <Text style={styles.helpCardTitle}>Supported Codecs</Text>
            </View>
            <Text style={styles.codecSubtitle}>Direct Play (Native)</Text>
            <View style={styles.codecBadgeRow}>
              {directPlayCodecs.map(codec => (
                <View style={styles.codecBadge} key={codec}>
                  <Text style={styles.codecBadgeText}>{codec}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.helpCardText}>
              These codecs play directly without transcoding for maximum quality and minimal server load.
            </Text>

            <Text style={[styles.codecSubtitle, {marginTop: Platform.isTV ? 20 : 16}]}>Transcoded Formats</Text>
            <View style={styles.codecBadgeRow}>
              {transcodeCodecs.map(codec => (
                <View style={styles.codecBadgeSecondary} key={codec}>
                  <Text style={styles.codecBadgeTextSecondary}>{codec}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.helpCardText}>
              These formats are converted to H.264/AAC on-the-fly when TomoTV detects they cannot be direct-played.
            </Text>
          </Pressable>

          {/* Quality Settings Card */}
          <Pressable style={styles.helpCard} isTVSelectable={true}>
            <View style={styles.helpCardHeader}>
              <View style={styles.helpIconContainer}>
                <Ionicons name="options" size={Platform.isTV ? 32 : 24} color="#FFC312" />
              </View>
              <Text style={styles.helpCardTitle}>Quality Control</Text>
            </View>
            <Text style={styles.helpCardText}>Tune the default bitrate/resolution under Settings → Video Quality.</Text>
            <View style={styles.qualityList}>
              {qualityPresets.map(preset => (
                <View style={styles.qualityItem} key={preset.label}>
                  <Text style={styles.qualityLabel}>{preset.label}</Text>
                  <Text style={styles.qualityDesc}>{preset.description}</Text>
                </View>
              ))}
            </View>
          </Pressable>

          {/* Features Section */}
          <Pressable style={styles.card} isTVSelectable={true}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBadge}>
                <Ionicons name="sparkles-outline" size={Platform.isTV ? 28 : 22} color="#FFC312" />
              </View>
              <Text style={styles.cardTitle}>Key Features</Text>
            </View>

            <View style={styles.featuresGrid}>
              <Pressable style={styles.featureCard} isTVSelectable={true}>
                <Ionicons name="play-circle" size={Platform.isTV ? 40 : 32} color="#FFC312" />
                <Text style={styles.featureTitle}>HLS Streaming</Text>
                <Text style={styles.featureText}>Seamless video streaming with server-side transcoding</Text>
              </Pressable>

              <Pressable style={styles.featureCard} isTVSelectable={true}>
                <Ionicons name="cloud-done" size={Platform.isTV ? 40 : 32} color="#FFC312" />
                <Text style={styles.featureTitle}>iCloud Sync</Text>
                <Text style={styles.featureText}>Settings sync across all your Apple devices</Text>
              </Pressable>

              <Pressable style={styles.featureCard} isTVSelectable={true}>
                <Ionicons name="tv" size={Platform.isTV ? 40 : 32} color="#FFC312" />
                <Text style={styles.featureTitle}>Apple TV Ready</Text>
                <Text style={styles.featureText}>Optimized for big screen viewing experience</Text>
              </Pressable>

              <Pressable style={styles.featureCard} isTVSelectable={true}>
                <Ionicons name="shield-checkmark" size={Platform.isTV ? 40 : 32} color="#FFC312" />
                <Text style={styles.featureTitle}>Secure Storage</Text>
                <Text style={styles.featureText}>Credentials stored in iCloud Keychain</Text>
              </Pressable>
            </View>
          </Pressable>

          {/* Troubleshooting & Notes */}
          <Pressable style={styles.card} isTVSelectable={true}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBadge}>
                <Ionicons name="alert-circle" size={Platform.isTV ? 28 : 22} color="#FFC312" />
              </View>
              <Text style={styles.cardTitle}>Troubleshooting & Notes</Text>
            </View>

            <Text style={styles.helpCardText}>Quick checks when playback fails or a device cannot connect.</Text>

            <Text style={[styles.codecSubtitle, {marginTop: Platform.isTV ? 16 : 12}]}>Troubleshooting Steps</Text>
            <View style={styles.infoList}>
              {troubleshootingSteps.map(step => (
                <View style={styles.infoItem} key={step.title}>
                  <View style={styles.infoIconBadge}>
                    <Ionicons name={step.icon} size={Platform.isTV ? 24 : 20} color="#FFC312" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoTitle}>{step.title}</Text>
                    <Text style={styles.infoText}>{step.text}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={[styles.codecSubtitle, {marginTop: Platform.isTV ? 24 : 18}]}>Important Notes</Text>
            <View style={styles.infoList}>
              <View style={styles.infoItem}>
                <View style={styles.infoIconBadge}>
                  <Ionicons name="server" size={Platform.isTV ? 24 : 20} color="#FFC312" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Enable Transcoding</Text>
                  <Text style={styles.infoText}>
                    Turn on hardware or software transcoding in Jellyfin → Dashboard → Playback when codecs fail to
                    direct-play.
                  </Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoIconBadge}>
                  <Ionicons name="text" size={Platform.isTV ? 24 : 20} color="#FFC312" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Subtitles</Text>
                  <Text style={styles.infoText}>
                    External subtitle tracks are detected automatically; embedded ones are burned in during transcoding.
                  </Text>
                </View>
              </View>

              <View style={styles.infoItem}>
                <View style={styles.infoIconBadge}>
                  <Ionicons name="wifi" size={Platform.isTV ? 24 : 20} color="#FFC312" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Network</Text>
                  <Text style={styles.infoText}>
                    Keep TomoTV and Jellyfin on the same LAN or VPN for the most reliable streaming experience.
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>

          <Pressable style={styles.noticeBox} isTVSelectable={true}>
            <Ionicons name="information-circle" size={Platform.isTV ? 28 : 22} color="#FFC312" />
            <Text style={styles.noticeText}>
              If your server IP changes, open TomoTV Settings, update the address, and tap Test Connection before
              launching playback on Apple TV.
            </Text>
          </Pressable>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Made for your Jellyfin Library, Please visit
              <Text
                style={{
                  color: "#34C759",
                  fontWeight: "600"
                }}
              >
                {" "}
                https://jellyfin.org/{" "}
              </Text>
              for information on how to setup your server.
            </Text>
            <View style={styles.footerDivider} />
            <Text style={styles.versionText}>Version 1.0.0</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000"
  },
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingTop: Platform.isTV ? 20 : 16,
    paddingBottom: Platform.isTV ? 60 : 40
  },
  contentContainer: {
    width: "100%",
    maxWidth: Platform.isTV ? 1000 : 600,
    paddingHorizontal: Platform.isTV ? 60 : 16,
    alignSelf: "center"
  },
  // Hero Section
  heroSection: {
    alignItems: "center",
    marginBottom: Platform.isTV ? 48 : 32
  },
  appIcon: {
    width: Platform.isTV ? 120 : 96,
    height: Platform.isTV ? 120 : 96,
    marginBottom: Platform.isTV ? 24 : 16,
    borderRadius: 4000
  },
  heroTitle: {
    fontSize: Platform.isTV ? 48 : 36,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: Platform.isTV ? 8 : 4,
    letterSpacing: -0.5
  },
  heroSubtitle: {
    fontSize: Platform.isTV ? 22 : 17,
    color: "#8E8E93",
    fontWeight: "500"
  },
  // Card Styles
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 24 : 16,
    padding: Platform.isTV ? 32 : 24,
    marginBottom: Platform.isTV ? 32 : 24,
    borderWidth: 1,
    borderColor: "rgba(255, 195, 18, 0.2)"
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Platform.isTV ? 16 : 12,
    gap: Platform.isTV ? 12 : 8
  },
  cardIconBadge: {
    width: Platform.isTV ? 40 : 32,
    height: Platform.isTV ? 40 : 32,
    borderRadius: Platform.isTV ? 20 : 16,
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  cardTitle: {
    fontSize: Platform.isTV ? 26 : 20,
    fontWeight: "600",
    color: "#FFFFFF"
  },
  cardText: {
    fontSize: Platform.isTV ? 20 : 15,
    lineHeight: Platform.isTV ? 32 : 22,
    color: "#AEAEB2"
  },
  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Platform.isTV ? 12 : 8,
    marginTop: Platform.isTV ? 16 : 8,
    marginBottom: Platform.isTV ? 24 : 16
  },
  sectionTitle: {
    fontSize: Platform.isTV ? 28 : 22,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  // Help Cards
  helpCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 20 : 14,
    padding: Platform.isTV ? 28 : 20,
    marginBottom: Platform.isTV ? 20 : 16,
    borderWidth: 1,
    borderColor: "rgba(255, 195, 18, 0.2)"
  },
  highlightCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 20 : 14,
    padding: Platform.isTV ? 28 : 20,
    marginBottom: Platform.isTV ? 20 : 16,
    borderWidth: 2,
    borderColor: "rgba(255, 195, 18, 0.4)"
  },
  // Notice Box
  noticeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Platform.isTV ? 12 : 10,
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 195, 18, 0.4)",
    borderRadius: Platform.isTV ? 12 : 10,
    padding: Platform.isTV ? 16 : 12,
    marginBottom: Platform.isTV ? 20 : 16,
    marginTop: 50
  },
  noticeText: {
    flex: 1,
    fontSize: Platform.isTV ? 18 : 15,
    lineHeight: Platform.isTV ? 28 : 22,
    color: "#AEAEB2"
  },
  noticeBold: {
    fontWeight: "700",
    color: "#FFC312"
  },
  helpCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Platform.isTV ? 16 : 12,
    gap: Platform.isTV ? 16 : 12
  },
  helpIconContainer: {
    width: Platform.isTV ? 56 : 44,
    height: Platform.isTV ? 56 : 44,
    borderRadius: Platform.isTV ? 28 : 22,
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  helpCardTitle: {
    fontSize: Platform.isTV ? 24 : 18,
    fontWeight: "600",
    color: "#FFFFFF"
  },
  helpCardText: {
    fontSize: Platform.isTV ? 18 : 15,
    lineHeight: Platform.isTV ? 28 : 22,
    color: "#AEAEB2",
    marginBottom: Platform.isTV ? 16 : 12
  },
  highlight: {
    color: "#FFC312",
    fontWeight: "600"
  },
  code: {
    fontFamily: Platform.select({
      ios: "Menlo",
      default: "monospace"
    }),
    backgroundColor: "rgba(142, 142, 147, 0.2)",
    paddingHorizontal: Platform.isTV ? 8 : 6,
    paddingVertical: Platform.isTV ? 4 : 2,
    borderRadius: Platform.isTV ? 6 : 4,
    fontSize: Platform.isTV ? 17 : 14,
    color: "#FFC312"
  },
  // Steps List
  stepsList: {
    gap: Platform.isTV ? 16 : 12
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Platform.isTV ? 16 : 12
  },
  stepNumber: {
    width: Platform.isTV ? 32 : 24,
    height: Platform.isTV ? 32 : 24,
    borderRadius: Platform.isTV ? 16 : 12,
    backgroundColor: "#FFC312",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2
  },
  stepNumberText: {
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: "700",
    color: "#000000"
  },
  stepText: {
    flex: 1,
    fontSize: Platform.isTV ? 18 : 15,
    lineHeight: Platform.isTV ? 34 : 22,
    color: "#AEAEB2"
  },
  // Configuration List (legacy - keeping for compatibility)
  configList: {
    gap: Platform.isTV ? 16 : 12,
    marginTop: Platform.isTV ? 12 : 8
  },
  configItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Platform.isTV ? 12 : 10,
    paddingVertical: Platform.isTV ? 8 : 6
  },
  configText: {
    flex: 1,
    fontSize: Platform.isTV ? 18 : 15,
    lineHeight: Platform.isTV ? 28 : 22,
    color: "#AEAEB2"
  },
  // Quick Start Circles
  circlesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-evenly",
    alignItems: "flex-start",
    gap: Platform.isTV ? 40 : 28,
    width: "100%",
    marginTop: Platform.isTV ? 24 : 16
  },
  circleItem: {
    alignItems: "center",
    width: Platform.isTV ? 160 : 100,
    position: "relative"
  },
  stepBadge: {
    width: Platform.isTV ? 36 : 28,
    height: Platform.isTV ? 36 : 28,
    borderRadius: Platform.isTV ? 18 : 14,
    backgroundColor: "#FFC312",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Platform.isTV ? 12 : 8
  },
  circle: {
    width: Platform.isTV ? 120 : 88,
    height: Platform.isTV ? 120 : 88,
    borderRadius: Platform.isTV ? 60 : 44,
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    borderWidth: 2,
    borderColor: "rgba(255, 195, 18, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Platform.isTV ? 16 : 12
  },
  circleLabel: {
    fontSize: Platform.isTV ? 16 : 12,
    fontWeight: "500",
    color: "#AEAEB2",
    textAlign: "center",
    lineHeight: Platform.isTV ? 22 : 16
  },
  // Info List Styles
  infoList: {
    gap: Platform.isTV ? 20 : 16,
    marginTop: Platform.isTV ? 16 : 12
  },
  infoItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Platform.isTV ? 16 : 12
  },
  infoIconBadge: {
    width: Platform.isTV ? 44 : 36,
    height: Platform.isTV ? 44 : 36,
    borderRadius: Platform.isTV ? 22 : 18,
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0
  },
  infoContent: {
    flex: 1
  },
  infoTitle: {
    fontSize: Platform.isTV ? 20 : 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: Platform.isTV ? 6 : 4
  },
  infoText: {
    fontSize: Platform.isTV ? 18 : 15,
    lineHeight: Platform.isTV ? 26 : 22,
    color: "#AEAEB2"
  },
  // Codec Styles
  codecSubtitle: {
    fontSize: Platform.isTV ? 20 : 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: Platform.isTV ? 12 : 8
  },
  codecBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Platform.isTV ? 12 : 8,
    marginBottom: Platform.isTV ? 16 : 12
  },
  codecBadge: {
    backgroundColor: "rgba(52, 199, 89, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(52, 199, 89, 0.4)",
    borderRadius: Platform.isTV ? 12 : 8,
    paddingHorizontal: Platform.isTV ? 16 : 12,
    paddingVertical: Platform.isTV ? 8 : 6
  },
  codecBadgeText: {
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: "600",
    color: "#34C759"
  },
  codecBadgeSecondary: {
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 195, 18, 0.3)",
    borderRadius: Platform.isTV ? 12 : 8,
    paddingHorizontal: Platform.isTV ? 16 : 12,
    paddingVertical: Platform.isTV ? 8 : 6
  },
  codecBadgeTextSecondary: {
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: "600",
    color: "#FFC312"
  },
  // Quality List
  qualityList: {
    gap: Platform.isTV ? 12 : 10,
    marginTop: Platform.isTV ? 12 : 8
  },
  qualityItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(142, 142, 147, 0.1)",
    borderRadius: Platform.isTV ? 12 : 8,
    paddingHorizontal: Platform.isTV ? 20 : 16,
    paddingVertical: Platform.isTV ? 12 : 10
  },
  qualityLabel: {
    fontSize: Platform.isTV ? 18 : 15,
    fontWeight: "600",
    color: "#FFC312"
  },
  qualityDesc: {
    fontSize: Platform.isTV ? 16 : 13,
    color: "#8E8E93"
  },
  // Features Grid
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Platform.isTV ? 16 : 12,
    marginTop: Platform.isTV ? 16 : 12
  },
  featureCard: {
    flex: 1,
    minWidth: Platform.isTV ? 260 : 150,
    backgroundColor: "#2C2C2E",
    borderRadius: Platform.isTV ? 16 : 12,
    padding: Platform.isTV ? 24 : 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 195, 18, 0.15)"
  },
  featureTitle: {
    fontSize: Platform.isTV ? 20 : 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: Platform.isTV ? 16 : 12,
    marginBottom: Platform.isTV ? 8 : 6,
    textAlign: "center"
  },
  featureText: {
    fontSize: Platform.isTV ? 16 : 13,
    lineHeight: Platform.isTV ? 24 : 19,
    color: "#8E8E93",
    textAlign: "center"
  },
  // Footer
  footer: {
    alignItems: "center",
    marginTop: Platform.isTV ? 32 : 24,
    paddingTop: Platform.isTV ? 32 : 24
  },
  footerDivider: {
    width: Platform.isTV ? 80 : 60,
    height: 2,
    backgroundColor: "rgba(255, 195, 18, 0.2)",
    marginVertical: Platform.isTV ? 16 : 12
  },
  footerText: {
    fontSize: Platform.isTV ? 18 : 14,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: Platform.isTV ? 8 : 4
  },
  versionText: {
    fontSize: Platform.isTV ? 16 : 13,
    color: "#636366",
    textAlign: "center"
  }
})
