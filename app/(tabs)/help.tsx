import {Ionicons} from "@expo/vector-icons"
import React from "react"
import {Image, Platform, Pressable, ScrollView, StyleSheet, Text, View} from "react-native"
import {SafeAreaView} from "react-native-safe-area-context"

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
            <Text style={styles.heroSubtitle}>Play videos from your Mac on your Apple TV</Text>
          </View>

          {/* About Card */}
          <Pressable style={styles.card} isTVSelectable={true}>
            <View style={styles.cardHeader}>
              <View style={styles.cardIconBadge}>
                <Ionicons name="information-circle" size={Platform.isTV ? 28 : 22} color="#FFC312" />
              </View>
              <Text style={styles.cardTitle}>About</Text>
            </View>
            <Text style={styles.cardText}>
              Tomo TV streams video content from your Jellyfin media server. Connect to your server to browse and play
              your movie library with automatic codec detection and intelligent transcoding for smooth playback across
              all devices.
            </Text>
          </Pressable>

          {/* Configuration Guide Section */}
          <View style={styles.sectionHeader}>
            <Ionicons name="book-outline" size={Platform.isTV ? 24 : 20} color="#FFC312" />
            <Text style={styles.sectionTitle}>Configuration Guide</Text>
          </View>

          {/* Server Configuration Card */}
          <Pressable style={styles.helpCard} isTVSelectable={true}>
            <View style={styles.helpCardHeader}>
              <View style={styles.helpIconContainer}>
                <Ionicons name="desktop" size={Platform.isTV ? 32 : 24} color="#FFC312" />
              </View>
              <Text style={styles.helpCardTitle}>Server Setup</Text>
            </View>
            <Text style={styles.helpCardText}>
              Enter your Jellyfin server&apos;s IP address or hostname{" "}
              <Text style={styles.highlight}>without the port</Text> (e.g.,{" "}
              <Text style={styles.code}>192.168.1.100</Text> or <Text style={styles.code}>jellyfin.local</Text>).
            </Text>
            <Text style={styles.helpCardText}>
              The default port is <Text style={styles.code}>8096</Text> for HTTP or{" "}
              <Text style={styles.code}>8920</Text> for HTTPS. Toggle the protocol switch if your server uses SSL.
            </Text>
          </Pressable>

          {/* User ID Card */}
          <Pressable style={styles.helpCard} isTVSelectable={true}>
            <View style={styles.helpCardHeader}>
              <View style={styles.helpIconContainer}>
                <Ionicons name="person" size={Platform.isTV ? 32 : 24} color="#FFC312" />
              </View>
              <Text style={styles.helpCardTitle}>User ID</Text>
            </View>
            <Text style={styles.helpCardText}>To find your User ID:</Text>
            <View style={styles.stepsList}>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>Open Jellyfin Dashboard in your browser</Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Navigate to <Text style={styles.highlight}>Users</Text>
                </Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>Select your user account</Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>4</Text>
                </View>
                <Text style={styles.stepText}>Copy the ID from the browser URL</Text>
              </View>
            </View>
          </Pressable>

          {/* API Key Card */}
          <Pressable style={styles.helpCard} isTVSelectable={true}>
            <View style={styles.helpCardHeader}>
              <View style={styles.helpIconContainer}>
                <Ionicons name="key" size={Platform.isTV ? 32 : 24} color="#FFC312" />
              </View>
              <Text style={styles.helpCardTitle}>API Key</Text>
            </View>
            <Text style={styles.helpCardText}>To create an API Key:</Text>
            <View style={styles.stepsList}>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <Text style={styles.stepText}>Open Jellyfin Dashboard in your browser</Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <Text style={styles.stepText}>
                  Go to <Text style={styles.highlight}>API Keys</Text>
                </Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <Text style={styles.stepText}>
                  Click <Text style={styles.highlight}>New Key</Text>
                </Text>
              </View>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>4</Text>
                </View>
                <Text style={styles.stepText}>Copy the generated key to TomoTV</Text>
              </View>
            </View>
          </Pressable>

          {/* Features Section */}
          <View style={styles.sectionHeader}>
            <Ionicons name="sparkles-outline" size={Platform.isTV ? 24 : 20} color="#FFC312" />
            <Text style={styles.sectionTitle}>Key Features</Text>
          </View>

          <View style={styles.featuresGrid}>
            <Pressable style={styles.featureCard} isTVSelectable={true}>
              <Ionicons name="play-circle" size={Platform.isTV ? 40 : 32} color="#FFC312" />
              <Text style={styles.featureTitle}>Smart Playback</Text>
              <Text style={styles.featureText}>Automatic codec detection with intelligent transcoding</Text>
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

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Made for your Jellyfin Library</Text>
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
    borderColor: "rgba(142, 142, 147, 0.3)"
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
  // Features Grid
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Platform.isTV ? 16 : 12,
    marginBottom: Platform.isTV ? 32 : 24
  },
  featureCard: {
    flex: 1,
    minWidth: Platform.isTV ? 260 : 150,
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 20 : 14,
    padding: Platform.isTV ? 24 : 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(142, 142, 147, 0.2)"
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
    backgroundColor: "rgba(142, 142, 147, 0.3)",
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
