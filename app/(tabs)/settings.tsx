import {fetchVideos, refreshConfig} from "@/services/jellyfinApi"
import {Host, SecureField, TextField, TextFieldRef} from "@expo/ui/swift-ui"
import {Ionicons} from "@expo/vector-icons"
import * as SecureStore from "expo-secure-store"
import React, {useEffect, useRef, useState} from "react"
import {ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View} from "react-native"
import {SafeAreaView} from "react-native-safe-area-context"

const STORAGE_KEYS = {
  SERVER_IP: "jellyfin_server_ip",
  API_KEY: "jellyfin_api_key",
  USER_ID: "jellyfin_user_id",
  VIDEO_QUALITY: "app_video_quality"
}

// Video quality presets (bitrate in kbps)
const QUALITY_PRESETS = [
  {label: "480p", value: 0, bitrate: 1500, resolution: "854x480", description: "Fast - Lower Quality"},
  {label: "540p", value: 1, bitrate: 2500, resolution: "960x540", description: "Balanced - Good Quality"},
  {label: "720p", value: 2, bitrate: 4000, resolution: "1280x720", description: "Smooth - High Quality"},
  {label: "1080p", value: 3, bitrate: 8000, resolution: "1920x1080", description: "Best - Highest Quality"}
]

export default function SettingsScreen() {
  const [serverIp, setServerIp] = useState("")
  const [apiKey, setApiKey] = useState("")
  const [userId, setUserId] = useState("")
  const [videoQuality, setVideoQuality] = useState(2) // Default to 720p
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  // Refs for text fields
  const serverIpRef = useRef<TextFieldRef>(null)
  const apiKeyRef = useRef<TextFieldRef>(null)
  const userIdRef = useRef<TextFieldRef>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setIsLoading(true)
      const [savedIp, savedKey, savedUserId, savedQuality] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_IP),
        SecureStore.getItemAsync(STORAGE_KEYS.API_KEY),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_ID),
        SecureStore.getItemAsync(STORAGE_KEYS.VIDEO_QUALITY)
      ])

      const ip = savedIp || ""
      const key = savedKey || ""
      const uid = savedUserId || ""
      const quality = savedQuality ? parseInt(savedQuality, 10) : 2 // Default to 720p

      setServerIp(ip)
      setApiKey(key)
      setUserId(uid)
      setVideoQuality(quality)

      // Set text in TextField refs
      serverIpRef.current?.setText(ip)
      apiKeyRef.current?.setText(key)
      userIdRef.current?.setText(uid)
    } catch (error) {
      console.error("Error loading settings:", error)
      Alert.alert("Error", "Failed to load settings from iCloud")
    } finally {
      setIsLoading(false)
    }
  }

  const testConnection = async () => {
    try {
      setIsTesting(true)

      // Validate inputs before testing
      if (!serverIp.trim() || !apiKey.trim() || !userId.trim()) {
        Alert.alert("Validation Error", "Please fill in all fields before testing connection")
        return
      }

      // Temporarily save to test connection
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_IP, serverIp.trim()),
        SecureStore.setItemAsync(STORAGE_KEYS.API_KEY, apiKey.trim()),
        SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, userId.trim())
      ])

      // Refresh config and test
      await refreshConfig()
      const videos = await fetchVideos()

      Alert.alert(
        "Connection Successful!",
        `Successfully connected to Jellyfin server.\n\nFound ${videos.length} video(s) in your library.`,
        [{text: "OK"}]
      )
    } catch (error) {
      console.error("Connection test failed:", error)
      Alert.alert(
        "Connection Failed",
        `Unable to connect to Jellyfin server.\n\nPlease check:\n• Server IP is correct\n• Jellyfin is running\n• API key and User ID are valid\n\nError: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        [{text: "OK"}]
      )
    } finally {
      setIsTesting(false)
    }
  }

  const saveJellyfinSettings = async () => {
    try {
      setIsSaving(true)

      // Validate inputs
      if (!serverIp.trim()) {
        Alert.alert("Validation Error", "Please enter a server IP address")
        return
      }

      if (!apiKey.trim()) {
        Alert.alert("Validation Error", "Please enter an API key")
        return
      }

      if (!userId.trim()) {
        Alert.alert("Validation Error", "Please enter a User ID")
        return
      }

      // Save to secure store (syncs to iCloud Keychain automatically)
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_IP, serverIp.trim()),
        SecureStore.setItemAsync(STORAGE_KEYS.API_KEY, apiKey.trim()),
        SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, userId.trim())
      ])

      // Refresh the API service config cache
      await refreshConfig()

      Alert.alert("Success", "Jellyfin settings saved successfully!", [{text: "OK"}])
    } catch (error) {
      console.error("Error saving settings:", error)
      Alert.alert("Error", "Failed to save settings to iCloud")
    } finally {
      setIsSaving(false)
    }
  }

  const saveAppSettings = async () => {
    try {
      setIsSaving(true)

      // Save app settings
      await SecureStore.setItemAsync(STORAGE_KEYS.VIDEO_QUALITY, videoQuality.toString())

      const qualityLabel = QUALITY_PRESETS[videoQuality]?.label || "Unknown"
      Alert.alert("Success", `Video quality set to ${qualityLabel}`)
    } catch (error) {
      console.error("Error saving app settings:", error)
      Alert.alert("Error", "Failed to save app settings")
    } finally {
      setIsSaving(false)
    }
  }

  const clearSettings = () => {
    Alert.alert("Clear Settings", "Are you sure you want to clear all settings?", [
      {
        text: "Cancel",
        style: "cancel"
      },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await Promise.all([
              SecureStore.deleteItemAsync(STORAGE_KEYS.SERVER_IP),
              SecureStore.deleteItemAsync(STORAGE_KEYS.API_KEY),
              SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID),
              SecureStore.deleteItemAsync(STORAGE_KEYS.VIDEO_QUALITY)
            ])
            setServerIp("")
            setApiKey("")
            setUserId("")
            setVideoQuality(2) // Reset to 720p default

            // Clear text in TextField refs
            serverIpRef.current?.setText("")
            apiKeyRef.current?.setText("")
            userIdRef.current?.setText("")

            // Refresh config to reset to defaults
            await refreshConfig()

            Alert.alert("Success", "Settings cleared, using default values")
          } catch (error) {
            console.error("Error clearing settings:", error)
            Alert.alert("Error", "Failed to clear settings")
          }
        }
      }
    ])
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFC312" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.contentWrapper}>
          {/* Jellyfin Settings Card */}

          <View style={styles.card}>
            {/* Video Quality Header */}
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="videocam-outline" size={Platform.isTV ? 32 : 28} color="#FFC312" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Video Quality</Text>
                <Text style={styles.cardSubtitle}>
                  Currently: {QUALITY_PRESETS[videoQuality]?.label} - {QUALITY_PRESETS[videoQuality]?.description}
                </Text>
              </View>
            </View>

            {/* Quality Control - Buttons for all platforms */}
            <View style={styles.qualityButtonsContainer}>
              {QUALITY_PRESETS.map(preset => (
                <TouchableOpacity
                  key={preset.value}
                  style={[styles.qualityButton, videoQuality === preset.value && styles.qualityButtonActive]}
                  onPress={() => setVideoQuality(preset.value)}
                  activeOpacity={0.7}
                  isTVSelectable={true}
                >
                  <Text
                    style={[styles.qualityButtonText, videoQuality === preset.value && styles.qualityButtonTextActive]}
                  >
                    {preset.label}
                  </Text>
                  <Text
                    style={[
                      styles.qualityButtonSubtext,
                      videoQuality === preset.value && styles.qualityButtonSubtextActive
                    ]}
                  >
                    {preset.description}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* App Action Buttons */}
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={saveAppSettings}
                disabled={isSaving}
                activeOpacity={0.7}
                isTVSelectable={true}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={Platform.isTV ? 24 : 20} color="#000000FF" />
                    <Text style={styles.saveButtonText}>Save Quality Setting</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.card}>
            {/* Header inside card */}
            <View style={styles.cardHeader}>
              <View style={styles.cardHeaderIcon}>
                <Ionicons name="server-outline" size={Platform.isTV ? 32 : 28} color="#FFC312" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Jellyfin Server</Text>
                <Text style={styles.cardSubtitle}>Connect to your media server</Text>
              </View>
            </View>

            {/* Server IP Address and User ID Row */}
            <View style={styles.formRow}>
              {/* Server IP Address */}
              <View style={styles.formGroupHalf}>
                <View style={styles.labelContainer}>
                  <Ionicons name="globe-outline" size={Platform.isTV ? 20 : 18} color="#FFC312" />
                  <View style={styles.labelTextContainer}>
                    <Text style={styles.label}>Server IP Address</Text>
                    <Text style={styles.labelHint}>Local IP (port 8096 added automatically)</Text>
                  </View>
                </View>
                <Host style={styles.inputHost}>
                  <TextField
                    ref={serverIpRef}
                    placeholder="192.168.1.100"
                    autocorrection={false}
                    onChangeText={setServerIp}
                  />
                </Host>
              </View>

              {/* User ID */}
              <View style={styles.formGroupHalf}>
                <View style={styles.labelContainer}>
                  <Ionicons name="person-outline" size={Platform.isTV ? 20 : 18} color="#FFC312" />
                  <View style={styles.labelTextContainer}>
                    <Text style={styles.label}>User ID</Text>
                    <Text style={styles.labelHint}>Found in user profile settings</Text>
                  </View>
                </View>
                <Host style={styles.inputHost}>
                  <TextField
                    ref={userIdRef}
                    placeholder="Enter your user ID"
                    autocorrection={false}
                    onChangeText={setUserId}
                  />
                </Host>
              </View>
            </View>

            <View style={styles.divider} />

            {/* API Key */}
            <View style={styles.formGroup}>
              <View style={styles.labelContainer}>
                <Ionicons name="key-outline" size={Platform.isTV ? 20 : 18} color="#FFC312" />
                <View style={styles.labelTextContainer}>
                  <Text style={styles.label}>API Key</Text>
                  <Text style={styles.labelHint}>Dashboard → API Keys → Create new key</Text>
                </View>
              </View>
              <Host style={styles.inputHost}>
                {Platform.isTV ? (
                  <TextField
                    ref={apiKeyRef}
                    placeholder="Enter your API key"
                    autocorrection={false}
                    onChangeText={setApiKey}
                  />
                ) : (
                  <SecureField ref={apiKeyRef} placeholder="Enter your API key" onChangeText={setApiKey} />
                )}
              </Host>
            </View>

            {/* Jellyfin Action Buttons */}
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={[styles.actionButton, styles.testButton]}
                onPress={testConnection}
                disabled={isTesting || isSaving}
                activeOpacity={0.7}
                isTVSelectable={true}
              >
                {isTesting ? (
                  <ActivityIndicator color="#FFC312" />
                ) : (
                  <>
                    <Ionicons name="flash-outline" size={Platform.isTV ? 24 : 20} color="#FFC312" />
                    <Text style={styles.testButtonText}>Test Connection</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionButton, styles.saveButton]}
                onPress={saveJellyfinSettings}
                disabled={isSaving || isTesting}
                activeOpacity={0.7}
                isTVSelectable={true}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="save-outline" size={Platform.isTV ? 24 : 20} color="#000000FF" />
                    <Text style={styles.saveButtonText}>Save Server Settings</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Danger Zone */}
          <View style={styles.dangerZone}>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={clearSettings}
              disabled={isSaving || isTesting}
              activeOpacity={0.7}
              isTVSelectable={true}
            >
              <Ionicons name="trash-outline" size={Platform.isTV ? 22 : 20} color="#FF3B30" />
              <Text style={styles.clearButtonText}>Clear All Settings</Text>
            </TouchableOpacity>
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
  scrollContent: {
    paddingTop: 60,
    paddingBottom: 60,
    alignItems: "center"
  },
  contentWrapper: {
    width: "60%",
    maxWidth: 1200,
    minWidth: Platform.isTV ? 800 : 300
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  loadingText: {
    marginTop: 16,
    fontSize: Platform.isTV ? 22 : 18,
    color: "#8E8E93"
  },
  card: {
    backgroundColor: "#1C1C1E",
    borderRadius: 32,
    padding: Platform.isTV ? 32 : 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: Platform.isTV ? 32 : 24
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Platform.isTV ? 32 : 28,
    paddingBottom: Platform.isTV ? 24 : 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
    gap: 16
  },
  cardHeaderIcon: {
    width: Platform.isTV ? 56 : 48,
    height: Platform.isTV ? 56 : 48,
    borderRadius: Platform.isTV ? 28 : 24,
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  cardHeaderText: {
    flex: 1
  },
  cardTitle: {
    fontSize: Platform.isTV ? 28 : 24,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4
  },
  cardSubtitle: {
    fontSize: Platform.isTV ? 16 : 14,
    color: "#8E8E93"
  },
  formGroup: {
    marginBottom: Platform.isTV ? 28 : 24
  },
  formRow: {
    flexDirection: "row",
    gap: Platform.isTV ? 20 : 16,
    marginBottom: Platform.isTV ? 28 : 24
  },
  formGroupHalf: {
    flex: 1
  },
  labelContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12,
    gap: 12
  },
  labelTextContainer: {
    flex: 1
  },
  label: {
    fontSize: Platform.isTV ? 18 : 16,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4
  },
  labelHint: {
    fontSize: Platform.isTV ? 14 : 12,
    color: "#8E8E93",
    lineHeight: Platform.isTV ? 18 : 16
  },
  inputHost: {
    width: "100%",
    minHeight: Platform.isTV ? 60 : 50
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: Platform.isTV ? 24 : 20
  },
  cardActions: {
    flexDirection: "row",
    gap: Platform.isTV ? 16 : 12,
    marginTop: Platform.isTV ? 28 : 24,
    paddingTop: Platform.isTV ? 24 : 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)"
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: Platform.isTV ? 18 : 16,
    paddingHorizontal: Platform.isTV ? 24 : 20,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    maxWidth: 350,
    marginHorizontal: "auto"
  },
  testButton: {
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    borderWidth: 2,
    borderColor: "#FFC312"
  },
  testButtonText: {
    fontSize: Platform.isTV ? 22 : 16,
    fontWeight: "700",
    color: "#FFC312"
  },
  saveButton: {
    backgroundColor: "#FFC312",
    borderWidth: 2,
    borderColor: "#FFC312"
  },
  saveButtonText: {
    fontSize: Platform.isTV ? 22 : 16,
    fontWeight: "700",
    color: "#000000FF"
  },
  sectionDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Platform.isTV ? 48 : 40,
    gap: 20
  },
  sectionDividerLine: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)"
  },
  sectionDividerText: {
    fontSize: Platform.isTV ? 22 : 15,
    fontWeight: "700",
    color: "#8E8E93",
    textTransform: "uppercase",
    letterSpacing: 2
  },
  qualityButtonsContainer: {
    flexDirection: "row",
    gap: Platform.isTV ? 14 : 10,
    marginBottom: Platform.isTV ? 24 : 20
  },
  qualityButton: {
    flex: 1,
    paddingVertical: Platform.isTV ? 28 : 24,
    paddingHorizontal: Platform.isTV ? 16 : 12,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  qualityButtonActive: {
    backgroundColor: "rgba(255, 195, 18, 0.2)",
    borderColor: "#FFC312"
  },
  qualityButtonText: {
    fontSize: Platform.isTV ? 24 : 20,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6
  },
  qualityButtonTextActive: {
    color: "#FFC312"
  },
  qualityButtonSubtext: {
    fontSize: Platform.isTV ? 14 : 12,
    color: "#8E8E93",
    textAlign: "center"
  },
  qualityButtonSubtextActive: {
    color: "rgba(255, 195, 18, 0.8)"
  },
  dangerZone: {
    marginTop: Platform.isTV ? 48 : 40,
    alignItems: "center"
  },
  clearButton: {
    flexDirection: "row",
    paddingVertical: Platform.isTV ? 16 : 14,
    paddingHorizontal: Platform.isTV ? 32 : 28,
    borderRadius: 50,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(255, 59, 48, 0.3)",
    alignItems: "center",
    gap: 10
  },
  clearButtonText: {
    fontSize: Platform.isTV ? 16 : 14,
    fontWeight: "700",
    color: "#FF3B30"
  }
})
