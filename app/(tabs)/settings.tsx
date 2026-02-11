import { FocusableButton } from "@/components/FocusableButton";
import { useFolderNavigation } from "@/contexts/FolderNavigationContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { folderNavigationManager } from "@/services/folderNavigationManager";
import { fetchLibraryVideos, refreshConfig } from "@/services/jellyfinApi";
import { libraryManager } from "@/services/libraryManager";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const STORAGE_KEYS = {
  SERVER_URL: "jellyfin_server_url",
  API_KEY: "jellyfin_api_key",
  USER_ID: "jellyfin_user_id",
  VIDEO_QUALITY: "app_video_quality",
};

// Video quality presets (bitrate in kbps)
const QUALITY_PRESETS = [
  {
    label: "480p",
    value: 0,
    bitrate: 1500,
    resolution: "854x480",
    description: "Fast - Lower",
  },
  {
    label: "540p",
    value: 1,
    bitrate: 2500,
    resolution: "960x540",
    description: "Balanced - Good",
  },
  {
    label: "720p",
    value: 2,
    bitrate: 4000,
    resolution: "1280x720",
    description: "Smooth - High",
  },
  {
    label: "1080p",
    value: 3,
    bitrate: 8000,
    resolution: "1920x1080",
    description: "Best - Highest",
  },
];

// Helper to get initial env values
const getInitialEnvValues = () => {
  return {
    serverUrl: process.env.EXPO_PUBLIC_DEV_JELLYFIN_SERVER || "",
    apiKey: process.env.EXPO_PUBLIC_DEV_JELLYFIN_API_KEY || "",
    userId: process.env.EXPO_PUBLIC_DEV_JELLYFIN_USER_ID || "",
  };
};

export default function SettingsScreen() {
  const initialEnv = getInitialEnvValues();
  const router = useRouter();
  const { refreshLibrary } = useLibrary();
  const { refresh: refreshFolderNavigation } = useFolderNavigation();

  const [serverUrl, setServerUrl] = useState(initialEnv.serverUrl);
  const [apiKey, setApiKey] = useState(initialEnv.apiKey);
  const [userId, setUserId] = useState(initialEnv.userId);
  const [videoQuality, setVideoQuality] = useState(2); // Default to 720p
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [userIdFocused, setUserIdFocused] = useState(false);
  const [apiKeyFocused, setApiKeyFocused] = useState(false);

  // Refs for text fields
  const serverUrlRef = useRef<TextInput>(null);
  const apiKeyRef = useRef<TextInput>(null);
  const userIdRef = useRef<TextInput>(null);

  // Refs to store current values without causing re-renders
  const currentServerUrl = useRef(serverUrl);
  const currentApiKey = useRef(apiKey);
  const currentUserId = useRef(userId);

  const maskValue = (val: string) =>
    val.length > 4 ? "••••••••" + val.slice(-4) : val;

  // Reload settings whenever the screen comes into focus
  // This ensures demo server credentials are shown after connecting
  useFocusEffect(
    useCallback(() => {
      loadSettings();

      return () => {
        Keyboard.dismiss();
        serverUrlRef.current?.blur();
        apiKeyRef.current?.blur();
        userIdRef.current?.blur();
        setUserIdFocused(false);
        setApiKeyFocused(false);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const [savedUrl, savedKey, savedUserId, savedQuality] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_URL),
        SecureStore.getItemAsync(STORAGE_KEYS.API_KEY),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_ID),
        SecureStore.getItemAsync(STORAGE_KEYS.VIDEO_QUALITY),
      ]);

      // Only override state if we have saved values
      // Otherwise keep the env values that were initialized
      if (savedUrl) {
        setServerUrl(savedUrl);
        currentServerUrl.current = savedUrl;
      }
      if (savedKey) {
        setApiKey(savedKey);
        currentApiKey.current = savedKey;
      }
      if (savedUserId) {
        setUserId(savedUserId);
        currentUserId.current = savedUserId;
      }
      if (savedQuality) setVideoQuality(parseInt(savedQuality, 10));

      logger.debug("Loading settings", {
        hasSavedUrl: !!savedUrl,
        hasSavedKey: !!savedKey,
        hasSavedUserId: !!savedUserId,
        currentUrl: savedUrl || serverUrl,
      });
    } catch (error) {
      logger.error("Error loading settings", error);
      Alert.alert("Error", "Failed to load settings from iCloud");
    } finally {
      setIsLoading(false);
    }
  };

  const validateInputs = (): { valid: boolean; error?: string; sanitized?: { serverUrl: string; apiKey: string; userId: string } } => {
    // Use ref values instead of state
    const url = currentServerUrl.current;
    const key = currentApiKey.current;
    const uid = currentUserId.current;

    // Check if fields are filled
    if (!url.trim()) {
      return { valid: false, error: "Please enter a server URL" };
    }

    if (!key.trim()) {
      return { valid: false, error: "Please enter an API key" };
    }

    if (!uid.trim()) {
      return { valid: false, error: "Please enter a User ID" };
    }

    // Validate and parse URL format
    const trimmedUrl = url.trim();
    try {
      const parsedUrl = new URL(trimmedUrl);
      if (!parsedUrl.protocol.startsWith("http")) {
        return {
          valid: false,
          error: "Server URL must start with http:// or https://",
        };
      }
    } catch {
      return {
        valid: false,
        error: "Invalid server URL format. Must include protocol and port (e.g., http://192.168.1.100:8096)",
      };
    }

    // Validate API key format (alphanumeric, typically 32 chars but can vary)
    const apiKeyTrimmed = key.trim();
    if (!/^[a-zA-Z0-9]{16,64}$/.test(apiKeyTrimmed)) {
      return {
        valid: false,
        error: "Invalid API key format. Must be 16-64 alphanumeric characters",
      };
    }

    // Validate User ID format (GUID without dashes or with dashes)
    const userIdTrimmed = uid.trim();
    if (!/^[a-f0-9]{32}$/i.test(userIdTrimmed) && !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userIdTrimmed)) {
      return {
        valid: false,
        error: "Invalid User ID format. Must be a valid GUID (e.g., 8d6b79c2-4368-496c-9393-1394d31ac428)",
      };
    }

    // Return validated and sanitized values
    // Since validation passed, we know the values are safe - just trim them
    return {
      valid: true,
      sanitized: {
        serverUrl: trimmedUrl,
        apiKey: apiKeyTrimmed.toLowerCase(), // Normalize to lowercase hex
        userId: userIdTrimmed.toLowerCase(), // Normalize to lowercase hex
      },
    };
  };

  const testConnection = async () => {
    try {
      setIsTesting(true);

      // Validate inputs - returns sanitized values if valid
      const validation = validateInputs();
      if (!validation.valid || !validation.sanitized) {
        Alert.alert("Validation Error", validation.error || "Invalid input");
        return;
      }

      // Use validated values directly (validation already ensures format is safe)
      const { serverUrl, apiKey, userId } = validation.sanitized;

      // Temporarily save to test connection
      await Promise.all([SecureStore.setItemAsync(STORAGE_KEYS.SERVER_URL, serverUrl), SecureStore.setItemAsync(STORAGE_KEYS.API_KEY, apiKey), SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, userId)]);

      // Refresh config and test
      await refreshConfig();

      // Clear manager caches to prevent stale data from old server
      libraryManager.clearCache();
      folderNavigationManager.clearCache();

      const { items: videos } = await fetchLibraryVideos({ limit: 60, startIndex: 0 });

      // Refresh both contexts to update the home screen
      await refreshLibrary();
      await refreshFolderNavigation();

      Alert.alert("Connection Successful!", `Successfully connected to Jellyfin server.\n\nFound ${videos.length} video(s) in your library.`, [{ text: "OK" }]);
    } catch (error) {
      logger.error("Connection test failed", error);
      Alert.alert(
        "Connection Failed",
        `Unable to connect to Jellyfin server.\n\nPlease check:\n• Server URL is correct (include port)\n• Jellyfin is running\n• API key and User ID are valid\n\nError: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        [{ text: "OK" }],
      );
    } finally {
      setIsTesting(false);
    }
  };

  const saveJellyfinSettings = async () => {
    try {
      setIsSaving(true);

      // Validate inputs - returns sanitized values if valid
      const validation = validateInputs();
      if (!validation.valid || !validation.sanitized) {
        Alert.alert("Validation Error", validation.error || "Invalid input");
        return;
      }

      // Use validated values directly (validation already ensures format is safe)
      const { serverUrl, apiKey, userId } = validation.sanitized;

      // Save to secure store (syncs to iCloud Keychain automatically)
      await Promise.all([SecureStore.setItemAsync(STORAGE_KEYS.SERVER_URL, serverUrl), SecureStore.setItemAsync(STORAGE_KEYS.API_KEY, apiKey), SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, userId)]);

      // Refresh the API service config cache
      await refreshConfig();

      // Clear manager caches to prevent stale data from old server
      libraryManager.clearCache();
      folderNavigationManager.clearCache();

      // Refresh both contexts so the home screen updates
      logger.info("Settings saved - refreshing contexts and navigating to Library", {
        screen: "settings",
      });
      await refreshLibrary();
      await refreshFolderNavigation();

      // Navigate to Library tab - this is the user feedback
      router.navigate("/(tabs)");
    } catch (error) {
      logger.error("Error saving settings", error);
      Alert.alert("Error", "Failed to save settings to iCloud");
    } finally {
      setIsSaving(false);
    }
  };

  const handleQualityChange = async (qualityValue: number) => {
    try {
      setVideoQuality(qualityValue);

      // Save immediately
      await SecureStore.setItemAsync(STORAGE_KEYS.VIDEO_QUALITY, qualityValue.toString());

      const qualityLabel = QUALITY_PRESETS[qualityValue]?.label || "Unknown";
      Alert.alert("Success", `Video quality set to ${qualityLabel}`);
    } catch (error) {
      logger.error("Error saving video quality", error);
      Alert.alert("Error", "Failed to save video quality");
    }
  };

  const viewDebugInfo = async () => {
    try {
      const [savedUrl, savedKey, savedUserId, savedQuality] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_URL),
        SecureStore.getItemAsync(STORAGE_KEYS.API_KEY),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_ID),
        SecureStore.getItemAsync(STORAGE_KEYS.VIDEO_QUALITY),
      ]);

      const qualityLabel = savedQuality ? QUALITY_PRESETS[parseInt(savedQuality, 10)]?.label || "Unknown" : "Not set";

      // Obfuscate API key for security - only show last 4 characters
      const obfuscatedApiKey = savedKey ? `${"•".repeat(28)}${savedKey.slice(-4)}` : "Not set";

      const debugInfo = `
📱 Stored in iCloud Keychain:

Server URL: ${savedUrl || "Not set"}
User ID: ${savedUserId || "Not set"}
API Key: ${obfuscatedApiKey}
Video Quality: ${qualityLabel}

✅ These values are synced across all your Apple devices via iCloud Keychain.
      `.trim();

      Alert.alert("Debug Info", debugInfo, [{ text: "OK", style: "default" }]);
    } catch (error) {
      logger.error("Error loading debug info", error);
      Alert.alert("Error", "Failed to load debug information");
    }
  };

  const clearSettings = () => {
    Alert.alert("Clear Settings", "Are you sure you want to clear all settings?", [
      {
        text: "Cancel",
        style: "cancel",
      },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await Promise.all([
              SecureStore.deleteItemAsync(STORAGE_KEYS.SERVER_URL),
              SecureStore.deleteItemAsync(STORAGE_KEYS.API_KEY),
              SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID),
              SecureStore.deleteItemAsync(STORAGE_KEYS.VIDEO_QUALITY),
            ]);
            setServerUrl("");
            setApiKey("");
            setUserId("");
            setVideoQuality(2); // Reset to 720p default

            // Update current refs to match state
            currentServerUrl.current = "";
            currentApiKey.current = "";
            currentUserId.current = "";

            // Refresh config to reset to defaults
            await refreshConfig();

            // Trigger library refresh to show error state
            refreshLibrary();

            Alert.alert("Success", "Settings cleared, using default values");
          } catch (error) {
            logger.error("Error clearing settings", error);
            Alert.alert("Error", "Failed to clear settings");
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#FFC312" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        focusable={false}>
        <View style={styles.contentContainer}>
          {/* Jellyfin Server Section */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>JELLYFIN SERVER</Text>
          </View>

          {/* Server Settings Group */}
          <View
            style={[
              styles.section,
              {
                paddingBottom: Platform.isTV ? 30 : 24,
              },
            ]}>
            {/* Server URL */}
            <View style={[styles.listItem, styles.listItemFirst]}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Server URL</Text>
                <TextInput
                  ref={serverUrlRef}
                  value={serverUrl}
                  placeholder="http://192.168.1.100:8096"
                  placeholderTextColor="#8E8E93"
                  autoCorrect={false}
                  autoCapitalize="none"
                  keyboardType="url"
                  onChangeText={(value) => {
                    setServerUrl(value);
                    currentServerUrl.current = value;
                  }}
                  style={styles.textInput}
                  autoFocus={false}
                  numberOfLines={1}
                  multiline={false}
                />
                <Text style={styles.inputHint}>
                  Your Jellyfin server address, e.g. http://192.168.1.100:8096
                </Text>
              </View>
            </View>

            {/* User ID */}
            <View style={styles.listItem}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>User ID</Text>
                <TextInput
                  ref={userIdRef}
                  value={userIdFocused ? userId : maskValue(userId)}
                  placeholder="Enter your user ID"
                  placeholderTextColor="#8E8E93"
                  autoCorrect={false}
                  autoCapitalize="none"
                  onChangeText={(value) => {
                    setUserId(value);
                    currentUserId.current = value;
                  }}
                  onFocus={() => setUserIdFocused(true)}
                  onBlur={() => setUserIdFocused(false)}
                  style={styles.textInput}
                  autoFocus={false}
                  multiline={false}
                  numberOfLines={1}
                />
                <Text style={styles.inputHint}>
                  Dashboard → Users → click your name → copy the ID from the
                  URL
                </Text>
              </View>
            </View>

            {/* API Key */}
            <View style={[styles.listItem, styles.listItemLast]}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>API Key</Text>
                <TextInput
                  ref={apiKeyRef}
                  value={apiKeyFocused ? apiKey : maskValue(apiKey)}
                  placeholder="Enter your API key"
                  placeholderTextColor="#8E8E93"
                  autoCorrect={false}
                  autoCapitalize="none"
                  onChangeText={(value) => {
                    setApiKey(value);
                    currentApiKey.current = value;
                  }}
                  onFocus={() => setApiKeyFocused(true)}
                  onBlur={() => setApiKeyFocused(false)}
                  style={styles.textInput}
                  autoFocus={false}
                  numberOfLines={1}
                  multiline={false}
                />
                <Text style={styles.inputHint}>
                  Dashboard → API Keys → create a key for Tomo TV
                </Text>
              </View>
            </View>
          </View>

          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>VIDEO QUALITY</Text>
          </View>

          {/* Quality Buttons */}
          <View style={styles.section}>
            {QUALITY_PRESETS.map((preset, index) => (
              <Pressable
                key={preset.value}
                style={({ focused }) => [
                  styles.listItem,
                  index === 0 && styles.listItemFirst,
                  index === QUALITY_PRESETS.length - 1 && styles.listItemLast,
                  focused && { backgroundColor: "rgba(255, 255, 255, 0.1)" },
                ]}
                onPress={() => handleQualityChange(preset.value)}
                tvParallaxProperties={{ magnification: 1.01 }}
                isTVSelectable={true}
                accessibilityLabel={`${preset.label} quality`}
                accessibilityRole="button"
                accessibilityState={{ selected: videoQuality === preset.value }}
                accessibilityHint={`Set video quality to ${preset.label}. ${preset.description}`}>
                <View style={styles.listItemContent}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemTitle}>{preset.label}</Text>
                    <Text style={styles.listItemSubtitle}>{preset.description}</Text>
                  </View>
                  {videoQuality === preset.value && <Ionicons name="checkmark" size={Platform.isTV ? 28 : 24} color="#FFC312" />}
                </View>
              </Pressable>
            ))}
          </View>

          <View style={styles.buttonGroup}>
            <FocusableButton
              title="Refresh Connection"
              variant="secondary"
              onPress={testConnection}
              disabled={isTesting || isSaving}
              isLoading={isTesting}
              style={{ width: "100%", maxWidth: 400, marginHorizontal: "auto" }}
            />

            <FocusableButton
              title="Save Server Settings"
              variant="primary"
              onPress={saveJellyfinSettings}
              disabled={isSaving || isTesting}
              isLoading={isSaving}
              style={{ width: "100%", maxWidth: 400, marginHorizontal: "auto" }}
            />
          </View>

          {/* Debug Info */}
          <FocusableButton
            title="View iCloud Sync Status"
            variant="debug"
            onPress={viewDebugInfo}
            style={{
              marginTop: Platform.isTV ? 32 : 24,
              width: "100%",
              maxWidth: 400,
              marginHorizontal: "auto",
            }}
          />

          {/* Clear Settings */}
          <FocusableButton
            title="Clear All Settings"
            variant="destructive"
            onPress={clearSettings}
            disabled={isSaving || isTesting}
            style={{
              marginTop: Platform.isTV ? 16 : 12,
              width: "100%",
              maxWidth: 400,
              marginHorizontal: "auto",
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1C1C1E",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Platform.isTV ? 20 : 16,
    paddingBottom: Platform.isTV ? 60 : 40,
    alignItems: "center",
  },
  contentContainer: {
    width: "100%",
    maxWidth: Platform.isTV ? 1000 : 600,
    paddingHorizontal: Platform.isTV ? 60 : 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: Platform.isTV ? 30 : 18,
    color: "#8E8E93",
  },
  // Section Headers (iOS style)
  sectionHeader: {
    paddingHorizontal: Platform.isTV ? 16 : 16,
    paddingTop: Platform.isTV ? 32 : 24,
    paddingBottom: Platform.isTV ? 12 : 8,
  },
  sectionHeaderText: {
    fontSize: Platform.isTV ? 28 : 16,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: -0.08,
  },
  // Section (Grouped List)
  section: {
    backgroundColor: "#2C2C2E",
    borderRadius: Platform.isTV ? 32 : 10,
    overflow: "hidden",
    // paddingVertical: Platform.isTV ? 8 : 6,
    marginBottom: Platform.isTV ? 32 : 24,
  },
  // List Items
  listItem: {
    backgroundColor: "#2C2C2E",
    paddingHorizontal: Platform.isTV ? 28 : 16,
    paddingVertical: Platform.isTV ? 24 : 16,
    // borderBottomWidth: 0.5,
    // borderBottomColor: "rgba(84, 84, 88, 0.6)",
    // Add margin for TV focus scaling (10% scale = need 5% margin on each side)
    marginHorizontal: Platform.isTV ? 4 : 0,
  },
  listItemFirst: {
    borderTopLeftRadius: Platform.isTV ? 16 : 10,
    borderTopRightRadius: Platform.isTV ? 16 : 10,
  },
  listItemLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: Platform.isTV ? 16 : 10,
    borderBottomRightRadius: Platform.isTV ? 16 : 10,
  },
  listItemContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Platform.isTV ? 16 : 12,
  },
  listItemLeft: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: Platform.isTV ? 30 : 20,
    fontWeight: "400",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  listItemSubtitle: {
    color: "#8E8E93",
    fontSize: Platform.isTV ? 28 : 18,
  },
  // Input Fields
  inputContainer: {
    gap: Platform.isTV ? 20 : 12,
  },
  inputLabel: {
    fontSize: Platform.isTV ? 30 : 18,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 4,
  },
  inputHint: {
    fontSize: Platform.isTV ? 26 : 15,
    color: "#FFC312",
    marginTop: 6,
  },
  inputHost: {
    width: "100%",
    minHeight: Platform.isTV ? 52 : 44,
  },
  textInput: {
    width: "100%",
    minHeight: Platform.isTV ? 56 : 50,
    // backgroundColor: "#2C2C2E",
    borderRadius: Platform.isTV ? 12 : 8,
    paddingHorizontal: Platform.isTV ? 16 : 12,
    fontSize: Platform.isTV ? 28 : 20,
    color: "#FFFFFF",
  },
  // Buttons
  buttonGroup: {
    gap: Platform.isTV ? 16 : 12,
    marginTop: Platform.isTV ? 24 : 16,
  },
});
