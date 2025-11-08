import {fetchVideos, refreshConfig} from "@/services/jellyfinApi"
import {Host, SecureField, TextField, TextFieldRef} from "@expo/ui/swift-ui"
import {Ionicons} from "@expo/vector-icons"
import * as SecureStore from "expo-secure-store"
import React, {useEffect, useRef, useState} from "react"
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native"
import {SafeAreaView} from "react-native-safe-area-context"

const STORAGE_KEYS = {
  SERVER_IP: "jellyfin_server_ip",
  API_KEY: "jellyfin_api_key",
  USER_ID: "jellyfin_user_id",
  VIDEO_QUALITY: "app_video_quality"
}

// Video quality presets (bitrate in kbps)
const QUALITY_PRESETS = [
  {label: "480p", value: 0, bitrate: 1500, resolution: "854x480", description: "Fast - Lower"},
  {label: "540p", value: 1, bitrate: 2500, resolution: "960x540", description: "Balanced - Good"},
  {label: "720p", value: 2, bitrate: 4000, resolution: "1280x720", description: "Smooth - High"},
  {label: "1080p", value: 3, bitrate: 8000, resolution: "1920x1080", description: "Best - Highest"}
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
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.contentContainer}>
          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>VIDEO QUALITY</Text>
          </View>

          {/* Quality Buttons */}
          <View style={styles.section}>
            {QUALITY_PRESETS.map((preset, index) => (
              <Pressable
                key={preset.value}
                style={({focused}) => [
                  styles.listItem,
                  index === 0 && styles.listItemFirst,
                  index === QUALITY_PRESETS.length - 1 && styles.listItemLast,
                  focused && {backgroundColor: "rgba(255, 255, 255, 0.1)"}
                ]}
                onPress={() => setVideoQuality(preset.value)}
                tvParallaxProperties={{magnification: 1.01}}
                isTVSelectable={true}
              >
                <View style={styles.listItemContent}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemTitle}>{preset.label}</Text>
                    <Text style={styles.listItemSubtitle}>{preset.description}</Text>
                  </View>
                  {videoQuality === preset.value && (
                    <Ionicons name="checkmark" size={Platform.isTV ? 28 : 24} color="#FFC312" />
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          {/* Save Quality Button */}
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={saveAppSettings}
            disabled={isSaving}
            activeOpacity={0.2}
            isTVSelectable={true}
          >
            {isSaving ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryButtonText}>Save Quality</Text>}
          </TouchableOpacity>

          {/* Jellyfin Server Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>JELLYFIN SERVER</Text>
          </View>

          {/* Server Settings Group */}
          <View
            style={[
              styles.section,
              {
                paddingBottom: Platform.isTV ? 30 : 24
              }
            ]}
          >
            {/* Server IP */}
            <View style={[styles.listItem, styles.listItemFirst]}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Server IP</Text>
                <Host style={styles.inputHost}>
                  <TextField
                    ref={serverIpRef}
                    placeholder="192.168.1.100"
                    autocorrection={false}
                    onChangeText={setServerIp}
                  />
                </Host>
              </View>
            </View>

            {/* User ID */}
            <View style={styles.listItem}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>User ID</Text>
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

            {/* API Key */}
            <View style={[styles.listItem, styles.listItemLast]}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>API Key</Text>
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
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={testConnection}
              disabled={isTesting || isSaving}
              activeOpacity={0.6}
              isTVSelectable={true}
            >
              {isTesting ? (
                <ActivityIndicator color="#FFC312" />
              ) : (
                <Text style={styles.secondaryButtonText}>Test Connection</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={saveJellyfinSettings}
              disabled={isSaving || isTesting}
              activeOpacity={0.6}
              isTVSelectable={true}
            >
              {isSaving ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.primaryButtonText}>Save Server Settings</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Clear Settings */}
          <TouchableOpacity
            style={styles.destructiveButton}
            onPress={clearSettings}
            disabled={isSaving || isTesting}
            activeOpacity={0.6}
            isTVSelectable={true}
          >
            <Text style={styles.destructiveButtonText}>Clear All Settings</Text>
          </TouchableOpacity>
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
    paddingBottom: Platform.isTV ? 60 : 40,
    alignItems: "center"
  },
  contentContainer: {
    width: "100%",
    maxWidth: Platform.isTV ? 1000 : 600,
    paddingHorizontal: Platform.isTV ? 60 : 16
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  loadingText: {
    marginTop: 16,
    fontSize: Platform.isTV ? 20 : 17,
    color: "#8E8E93"
  },
  // Section Headers (iOS style)
  sectionHeader: {
    paddingHorizontal: Platform.isTV ? 16 : 16,
    paddingTop: Platform.isTV ? 32 : 24,
    paddingBottom: Platform.isTV ? 12 : 8
  },
  sectionHeaderText: {
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: -0.08
  },
  // Section (Grouped List)
  section: {
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 32 : 10,
    overflow: "hidden",
    // paddingVertical: Platform.isTV ? 8 : 6,
    marginBottom: Platform.isTV ? 32 : 24
  },
  // List Items
  listItem: {
    backgroundColor: "#1C1C1E",
    paddingHorizontal: Platform.isTV ? 28 : 16,
    paddingVertical: Platform.isTV ? 24 : 16,
    // borderBottomWidth: 0.5,
    // borderBottomColor: "rgba(84, 84, 88, 0.6)",
    // Add margin for TV focus scaling (10% scale = need 5% margin on each side)
    marginHorizontal: Platform.isTV ? 4 : 0
  },
  listItemFirst: {
    borderTopLeftRadius: Platform.isTV ? 16 : 10,
    borderTopRightRadius: Platform.isTV ? 16 : 10
  },
  listItemLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: Platform.isTV ? 16 : 10,
    borderBottomRightRadius: Platform.isTV ? 16 : 10
  },
  listItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Platform.isTV ? 16 : 12
  },
  listItemLeft: {
    flex: 1
  },
  listItemTitle: {
    fontSize: Platform.isTV ? 25 : 20,
    fontWeight: "400",
    color: "#FFFFFF",
    marginBottom: 2
  },
  listItemSubtitle: {
    color: "#8E8E93",
    fontSize: Platform.isTV ? 20 : 17
  },
  // Input Fields
  inputContainer: {
    gap: Platform.isTV ? 20 : 12
  },
  inputLabel: {
    fontSize: Platform.isTV ? 18 : 15,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 15
  },
  inputHost: {
    width: "100%",
    minHeight: Platform.isTV ? 52 : 44
  },
  // Buttons
  buttonGroup: {
    gap: Platform.isTV ? 16 : 12,
    marginTop: Platform.isTV ? 24 : 16
  },
  primaryButton: {
    backgroundColor: "#FFC312",
    paddingVertical: Platform.isTV ? 20 : 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Platform.isTV ? 24 : 16,
    minHeight: Platform.isTV ? 60 : 50,
    maxWidth: 400,
    width: "100%",
    marginHorizontal: "auto"
  },
  primaryButtonText: {
    fontSize: Platform.isTV ? 25 : 17,
    fontWeight: "600",
    color: "#000000"
  },
  secondaryButton: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#FFC312",
    paddingVertical: Platform.isTV ? 20 : 14,
    paddingHorizontal: Platform.isTV ? 28 : 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    minHeight: Platform.isTV ? 60 : 50,
    maxWidth: 400,
    width: "100%",
    marginHorizontal: "auto"
  },
  secondaryButtonText: {
    fontSize: Platform.isTV ? 24 : 17,
    fontWeight: "600",
    color: "#FFC312"
  },
  destructiveButton: {
    backgroundColor: "transparent",
    paddingVertical: Platform.isTV ? 20 : 14,
    paddingHorizontal: Platform.isTV ? 28 : 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Platform.isTV ? 40 : 32,
    minHeight: Platform.isTV ? 60 : 50
  },
  destructiveButtonText: {
    fontSize: Platform.isTV ? 20 : 17,
    fontWeight: "600",
    color: "#FF3B30"
  }
})
