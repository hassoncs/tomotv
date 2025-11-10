import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.appIcon}
              resizeMode="contain"
            />
            <Text style={styles.heroTitle}>Tomo TV</Text>
            <Text style={styles.heroSubtitle}>
              Play videos from your Mac on your Apple TV
            </Text>
          </View>

          {/* About Card */}
          <Pressable
            style={styles.card}
            isTVSelectable={true}
            hasTVPreferredFocus={true}
          >
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBadge}>
                <Ionicons
                  name="information-circle"
                  size={Platform.isTV ? 28 : 22}
                  color="#FFC312"
                />
              </View>
              <Text style={styles.cardTitle}>About</Text>
            </View>
            <Text style={styles.cardText}>
              Play any video from your Mac on Apple TV—no manual encoding
              required. Tomo TV automatically handles videos that won&apos;t
              normally play, so you can just hit play and watch.
            </Text>
          </Pressable>

          {/* Quick Start Section */}
          <View style={styles.sectionHeader}>
            <Ionicons
              name="rocket-outline"
              size={Platform.isTV ? 24 : 20}
              color="#FFC312"
            />
            <Text style={styles.sectionTitle}>Quick Start</Text>
          </View>

          <Pressable style={styles.helpCard} isTVSelectable={true}>
            <View style={styles.helpCardHeader}>
              <View style={styles.helpIconContainer}>
                <Ionicons
                  name="settings-outline"
                  size={Platform.isTV ? 32 : 24}
                  color="#FFC312"
                />
              </View>
              <Text style={styles.helpCardTitle}>Configuration</Text>
            </View>
            <Text style={styles.helpCardText}>
              Go to the <Text style={styles.highlight}>Settings</Text> tab and
              enter:
            </Text>
            <View style={styles.configList}>
              <View style={styles.configItem}>
                <Ionicons
                  name="desktop"
                  size={Platform.isTV ? 20 : 16}
                  color="#FFC312"
                />
                <Text style={styles.configText}>
                  Server IP (e.g.,{" "}
                  <Text style={styles.code}>192.168.1.100</Text>)
                </Text>
              </View>
              <View style={styles.configItem}>
                <Ionicons
                  name="key"
                  size={Platform.isTV ? 20 : 16}
                  color="#FFC312"
                />
                <Text style={styles.configText}>
                  API Key from Jellyfin Dashboard → API Keys
                </Text>
              </View>
              <View style={styles.configItem}>
                <Ionicons
                  name="person"
                  size={Platform.isTV ? 20 : 16}
                  color="#FFC312"
                />
                <Text style={styles.configText}>
                  User ID from Jellyfin Dashboard → Users
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Transcoding Section */}
          <View style={styles.sectionHeader}>
            <Ionicons
              name="film-outline"
              size={Platform.isTV ? 24 : 20}
              color="#FFC312"
            />
            <Text style={styles.sectionTitle}>How Transcoding Works</Text>
          </View>

          <Pressable style={styles.highlightCard} isTVSelectable={true}>
            <View style={styles.helpCardHeader}>
              <View style={styles.helpIconContainer}>
                <Ionicons
                  name="sync"
                  size={Platform.isTV ? 32 : 24}
                  color="#FFC312"
                />
              </View>
              <Text style={styles.helpCardTitle}>Smart Codec Detection</Text>
            </View>

            {/* Enable Transcoding Notice */}
            <View style={styles.noticeBox}>
              <Ionicons
                name="information-circle"
                size={Platform.isTV ? 24 : 20}
                color="#FFC312"
              />
              <Text style={styles.noticeText}>
                <Text style={styles.noticeBold}>Enable Transcoding</Text> in
                Settings to unlock this feature
              </Text>
            </View>

            <Text style={styles.helpCardText}>
              Tomo TV analyzes each video&apos;s codec before playback. If your
              device supports the codec natively (like H.264 or HEVC), the video
              plays directly for the best quality and performance.
            </Text>
            <Text style={styles.helpCardText}>
              For unsupported codecs, the app automatically requests your
              Jellyfin server to transcode the video in real-time to a
              compatible format. This happens seamlessly in the background—you
              just press play.
            </Text>
          </Pressable>

          {/* Codec Support Card */}
          <Pressable style={styles.helpCard} isTVSelectable={true}>
            <View style={styles.helpCardHeader}>
              <View style={styles.helpIconContainer}>
                <Ionicons
                  name="checkmark-circle"
                  size={Platform.isTV ? 32 : 24}
                  color="#34C759"
                />
              </View>
              <Text style={styles.helpCardTitle}>Supported Codecs</Text>
            </View>
            <Text style={styles.codecSubtitle}>Direct Play (Native)</Text>
            <View style={styles.codecBadgeRow}>
              <View style={styles.codecBadge}>
                <Text style={styles.codecBadgeText}>H.264</Text>
              </View>
              <View style={styles.codecBadge}>
                <Text style={styles.codecBadgeText}>HEVC (H.265)</Text>
              </View>
            </View>
            <Text style={styles.helpCardText}>
              These codecs play directly without transcoding for maximum quality
              and minimal server load.
            </Text>

            <Text
              style={[
                styles.codecSubtitle,
                { marginTop: Platform.isTV ? 20 : 16 },
              ]}
            >
              Transcoded Formats
            </Text>
            <View style={styles.codecBadgeRow}>
              <View style={styles.codecBadgeSecondary}>
                <Text style={styles.codecBadgeTextSecondary}>MPEG-4</Text>
              </View>
              <View style={styles.codecBadgeSecondary}>
                <Text style={styles.codecBadgeTextSecondary}>VP8</Text>
              </View>
              <View style={styles.codecBadgeSecondary}>
                <Text style={styles.codecBadgeTextSecondary}>VP9</Text>
              </View>
              <View style={styles.codecBadgeSecondary}>
                <Text style={styles.codecBadgeTextSecondary}>AV1</Text>
              </View>
              <View style={styles.codecBadgeSecondary}>
                <Text style={styles.codecBadgeTextSecondary}>VC-1</Text>
              </View>
              <View style={styles.codecBadgeSecondary}>
                <Text style={styles.codecBadgeTextSecondary}>MPEG-2</Text>
              </View>
            </View>
            <Text style={styles.helpCardText}>
              These formats are automatically converted on-the-fly by your
              Jellyfin server.
            </Text>
          </Pressable>

          {/* Quality Settings Card */}
          <Pressable style={styles.helpCard} isTVSelectable={true}>
            <View style={styles.helpCardHeader}>
              <View style={styles.helpIconContainer}>
                <Ionicons
                  name="options"
                  size={Platform.isTV ? 32 : 24}
                  color="#FFC312"
                />
              </View>
              <Text style={styles.helpCardTitle}>Quality Control</Text>
            </View>
            <Text style={styles.helpCardText}>
              Once transcoding is enabled in{" "}
              <Text style={styles.highlight}>Settings</Text>, you can adjust the
              quality to balance between video quality and network performance:
            </Text>
            <View style={styles.qualityList}>
              <View style={styles.qualityItem}>
                <Text style={styles.qualityLabel}>480p</Text>
                <Text style={styles.qualityDesc}>
                  Lower bandwidth, faster start
                </Text>
              </View>
              <View style={styles.qualityItem}>
                <Text style={styles.qualityLabel}>720p</Text>
                <Text style={styles.qualityDesc}>Balanced quality</Text>
              </View>
              <View style={styles.qualityItem}>
                <Text style={styles.qualityLabel}>1080p</Text>
                <Text style={styles.qualityDesc}>
                  High quality, more bandwidth
                </Text>
              </View>
            </View>
          </Pressable>

          {/* Features Section */}
          <View style={styles.sectionHeader}>
            <Ionicons
              name="sparkles-outline"
              size={Platform.isTV ? 24 : 20}
              color="#FFC312"
            />
            <Text style={styles.sectionTitle}>Key Features</Text>
          </View>

          <View style={styles.featuresGrid}>
            <Pressable style={styles.featureCard} isTVSelectable={true}>
              <Ionicons
                name="play-circle"
                size={Platform.isTV ? 40 : 32}
                color="#FFC312"
              />
              <Text style={styles.featureTitle}>Smart Playback</Text>
              <Text style={styles.featureText}>
                Automatic codec detection with intelligent transcoding
              </Text>
            </Pressable>

            <Pressable style={styles.featureCard} isTVSelectable={true}>
              <Ionicons
                name="cloud-done"
                size={Platform.isTV ? 40 : 32}
                color="#FFC312"
              />
              <Text style={styles.featureTitle}>iCloud Sync</Text>
              <Text style={styles.featureText}>
                Settings sync across all your Apple devices
              </Text>
            </Pressable>

            <Pressable style={styles.featureCard} isTVSelectable={true}>
              <Ionicons
                name="tv"
                size={Platform.isTV ? 40 : 32}
                color="#FFC312"
              />
              <Text style={styles.featureTitle}>Apple TV Ready</Text>
              <Text style={styles.featureText}>
                Optimized for big screen viewing experience
              </Text>
            </Pressable>

            <Pressable style={styles.featureCard} isTVSelectable={true}>
              <Ionicons
                name="shield-checkmark"
                size={Platform.isTV ? 40 : 32}
                color="#FFC312"
              />
              <Text style={styles.featureTitle}>Secure Storage</Text>
              <Text style={styles.featureText}>
                Credentials stored in iCloud Keychain
              </Text>
            </Pressable>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Made for your Jellyfin Library, Please visit
              <Text
                style={{
                  color: "#34C759",
                  fontWeight: "600",
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.isTV ? 20 : 16,
    paddingBottom: Platform.isTV ? 60 : 40,
  },
  contentContainer: {
    width: "100%",
    maxWidth: Platform.isTV ? 1000 : 600,
    paddingHorizontal: Platform.isTV ? 60 : 16,
    alignSelf: "center",
  },
  // Hero Section
  heroSection: {
    alignItems: "center",
    marginBottom: Platform.isTV ? 48 : 32,
  },
  appIcon: {
    width: Platform.isTV ? 120 : 96,
    height: Platform.isTV ? 120 : 96,
    marginBottom: Platform.isTV ? 24 : 16,
    borderRadius: 4000,
  },
  heroTitle: {
    fontSize: Platform.isTV ? 48 : 36,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: Platform.isTV ? 8 : 4,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: Platform.isTV ? 22 : 17,
    color: "#8E8E93",
    fontWeight: "500",
  },
  // Card Styles
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 24 : 16,
    padding: Platform.isTV ? 32 : 24,
    marginBottom: Platform.isTV ? 32 : 24,
    borderWidth: 1,
    borderColor: "rgba(255, 195, 18, 0.2)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Platform.isTV ? 16 : 12,
    gap: Platform.isTV ? 12 : 8,
  },
  cardIconBadge: {
    width: Platform.isTV ? 40 : 32,
    height: Platform.isTV ? 40 : 32,
    borderRadius: Platform.isTV ? 20 : 16,
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: Platform.isTV ? 26 : 20,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cardText: {
    fontSize: Platform.isTV ? 20 : 15,
    lineHeight: Platform.isTV ? 32 : 22,
    color: "#AEAEB2",
  },
  // Section Headers
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Platform.isTV ? 12 : 8,
    marginTop: Platform.isTV ? 16 : 8,
    marginBottom: Platform.isTV ? 24 : 16,
  },
  sectionTitle: {
    fontSize: Platform.isTV ? 28 : 22,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  // Help Cards
  helpCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 20 : 14,
    padding: Platform.isTV ? 28 : 20,
    marginBottom: Platform.isTV ? 20 : 16,
    borderWidth: 1,
    borderColor: "rgba(255, 195, 18, 0.2)",
  },
  highlightCard: {
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 20 : 14,
    padding: Platform.isTV ? 28 : 20,
    marginBottom: Platform.isTV ? 20 : 16,
    borderWidth: 2,
    borderColor: "rgba(255, 195, 18, 0.4)",
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
  },
  noticeText: {
    flex: 1,
    fontSize: Platform.isTV ? 18 : 15,
    lineHeight: Platform.isTV ? 28 : 22,
    color: "#AEAEB2",
  },
  noticeBold: {
    fontWeight: "700",
    color: "#FFC312",
  },
  helpCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Platform.isTV ? 16 : 12,
    gap: Platform.isTV ? 16 : 12,
  },
  helpIconContainer: {
    width: Platform.isTV ? 56 : 44,
    height: Platform.isTV ? 56 : 44,
    borderRadius: Platform.isTV ? 28 : 22,
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  helpCardTitle: {
    fontSize: Platform.isTV ? 24 : 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  helpCardText: {
    fontSize: Platform.isTV ? 18 : 15,
    lineHeight: Platform.isTV ? 28 : 22,
    color: "#AEAEB2",
    marginBottom: Platform.isTV ? 16 : 12,
  },
  highlight: {
    color: "#FFC312",
    fontWeight: "600",
  },
  code: {
    fontFamily: Platform.select({
      ios: "Menlo",
      default: "monospace",
    }),
    backgroundColor: "rgba(142, 142, 147, 0.2)",
    paddingHorizontal: Platform.isTV ? 8 : 6,
    paddingVertical: Platform.isTV ? 4 : 2,
    borderRadius: Platform.isTV ? 6 : 4,
    fontSize: Platform.isTV ? 17 : 14,
    color: "#FFC312",
  },
  // Steps List
  stepsList: {
    gap: Platform.isTV ? 16 : 12,
  },
  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Platform.isTV ? 16 : 12,
  },
  stepNumber: {
    width: Platform.isTV ? 32 : 24,
    height: Platform.isTV ? 32 : 24,
    borderRadius: Platform.isTV ? 16 : 12,
    backgroundColor: "#FFC312",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  stepNumberText: {
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: "700",
    color: "#000000",
  },
  stepText: {
    flex: 1,
    fontSize: Platform.isTV ? 18 : 15,
    lineHeight: Platform.isTV ? 34 : 22,
    color: "#AEAEB2",
  },
  // Configuration List
  configList: {
    gap: Platform.isTV ? 16 : 12,
    marginTop: Platform.isTV ? 12 : 8,
  },
  configItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Platform.isTV ? 12 : 10,
    paddingVertical: Platform.isTV ? 8 : 6,
  },
  configText: {
    flex: 1,
    fontSize: Platform.isTV ? 18 : 15,
    lineHeight: Platform.isTV ? 28 : 22,
    color: "#AEAEB2",
  },
  // Codec Styles
  codecSubtitle: {
    fontSize: Platform.isTV ? 20 : 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: Platform.isTV ? 12 : 8,
  },
  codecBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Platform.isTV ? 12 : 8,
    marginBottom: Platform.isTV ? 16 : 12,
  },
  codecBadge: {
    backgroundColor: "rgba(52, 199, 89, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(52, 199, 89, 0.4)",
    borderRadius: Platform.isTV ? 12 : 8,
    paddingHorizontal: Platform.isTV ? 16 : 12,
    paddingVertical: Platform.isTV ? 8 : 6,
  },
  codecBadgeText: {
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: "600",
    color: "#34C759",
  },
  codecBadgeSecondary: {
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 195, 18, 0.3)",
    borderRadius: Platform.isTV ? 12 : 8,
    paddingHorizontal: Platform.isTV ? 16 : 12,
    paddingVertical: Platform.isTV ? 8 : 6,
  },
  codecBadgeTextSecondary: {
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: "600",
    color: "#FFC312",
  },
  // Quality List
  qualityList: {
    gap: Platform.isTV ? 12 : 10,
    marginTop: Platform.isTV ? 12 : 8,
  },
  qualityItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(142, 142, 147, 0.1)",
    borderRadius: Platform.isTV ? 12 : 8,
    paddingHorizontal: Platform.isTV ? 20 : 16,
    paddingVertical: Platform.isTV ? 12 : 10,
  },
  qualityLabel: {
    fontSize: Platform.isTV ? 18 : 15,
    fontWeight: "600",
    color: "#FFC312",
  },
  qualityDesc: {
    fontSize: Platform.isTV ? 16 : 13,
    color: "#8E8E93",
  },
  // Features Grid
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Platform.isTV ? 16 : 12,
    marginBottom: Platform.isTV ? 32 : 24,
  },
  featureCard: {
    flex: 1,
    minWidth: Platform.isTV ? 260 : 150,
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 20 : 14,
    padding: Platform.isTV ? 24 : 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 195, 18, 0.2)",
  },
  featureTitle: {
    fontSize: Platform.isTV ? 20 : 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: Platform.isTV ? 16 : 12,
    marginBottom: Platform.isTV ? 8 : 6,
    textAlign: "center",
  },
  featureText: {
    fontSize: Platform.isTV ? 16 : 13,
    lineHeight: Platform.isTV ? 24 : 19,
    color: "#8E8E93",
    textAlign: "center",
  },
  // Footer
  footer: {
    alignItems: "center",
    marginTop: Platform.isTV ? 32 : 24,
    paddingTop: Platform.isTV ? 32 : 24,
  },
  footerDivider: {
    width: Platform.isTV ? 80 : 60,
    height: 2,
    backgroundColor: "rgba(255, 195, 18, 0.2)",
    marginVertical: Platform.isTV ? 16 : 12,
  },
  footerText: {
    fontSize: Platform.isTV ? 18 : 14,
    color: "#8E8E93",
    textAlign: "center",
    marginBottom: Platform.isTV ? 8 : 4,
  },
  versionText: {
    fontSize: Platform.isTV ? 16 : 13,
    color: "#636366",
    textAlign: "center",
  },
});
