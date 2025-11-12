import { useLibrary } from "@/contexts/LibraryContext";
import { fetchVideos, refreshConfig } from "@/services/jellyfinApi";
import { logger } from "@/utils/logger";
import { Host, Switch } from "@expo/ui/swift-ui";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STORAGE_KEYS = {
  SERVER_IP: "jellyfin_server_ip",
  SERVER_PORT: "jellyfin_server_port",
  SERVER_PROTOCOL: "jellyfin_server_protocol",
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
  let devIp = "";
  let devPort = "8096";
  let devProtocol: "http" | "https" = "http";

  const devServerUrl = process.env.EXPO_PUBLIC_DEV_JELLYFIN_SERVER;
  if (devServerUrl) {
    try {
      const url = new URL(devServerUrl);
      devProtocol = url.protocol.replace(":", "") as "http" | "https";
      devIp = url.hostname;
      devPort = url.port || "8096";
    } catch (e) {
      logger.warn("Failed to parse dev server URL", e);
    }
  }

  return {
    ip: devIp,
    port: devPort,
    protocol: devProtocol,
    apiKey: process.env.EXPO_PUBLIC_DEV_JELLYFIN_API_KEY || "",
    userId: process.env.EXPO_PUBLIC_DEV_JELLYFIN_USER_ID || "",
  };
};

export default function SettingsScreen() {
  const initialEnv = getInitialEnvValues();
  const { refreshLibrary } = useLibrary();

  const [serverIp, setServerIp] = useState(initialEnv.ip);
  const [serverPort, setServerPort] = useState(initialEnv.port);
  const [serverProtocol, setServerProtocol] = useState<"http" | "https">(
    initialEnv.protocol,
  );
  const [apiKey, setApiKey] = useState(initialEnv.apiKey);
  const [userId, setUserId] = useState(initialEnv.userId);
  const [videoQuality, setVideoQuality] = useState(2); // Default to 720p
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Refs for text fields
  const serverIpRef = useRef<TextInput>(null);
  const serverPortRef = useRef<TextInput>(null);
  const apiKeyRef = useRef<TextInput>(null);
  const userIdRef = useRef<TextInput>(null);

  // Refs to store current values without causing re-renders
  const currentServerIp = useRef(serverIp);
  const currentServerPort = useRef(serverPort);
  const currentApiKey = useRef(apiKey);
  const currentUserId = useRef(userId);

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const [
        savedIp,
        savedPort,
        savedProtocol,
        savedKey,
        savedUserId,
        savedQuality,
      ] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_IP),
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_PORT),
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_PROTOCOL),
        SecureStore.getItemAsync(STORAGE_KEYS.API_KEY),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_ID),
        SecureStore.getItemAsync(STORAGE_KEYS.VIDEO_QUALITY),
      ]);

      // Only override state if we have saved values
      // Otherwise keep the env values that were initialized
      if (savedIp) {
        setServerIp(savedIp);
        currentServerIp.current = savedIp;
      }
      if (savedPort) {
        setServerPort(savedPort);
        currentServerPort.current = savedPort;
      }
      if (savedProtocol) setServerProtocol(savedProtocol as "http" | "https");
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
        hasSavedIp: !!savedIp,
        hasSavedKey: !!savedKey,
        hasSavedUserId: !!savedUserId,
        currentIp: savedIp || serverIp,
        currentPort: savedPort || serverPort,
      });
    } catch (error) {
      logger.error("Error loading settings", error);
      Alert.alert("Error", "Failed to load settings from iCloud");
    } finally {
      setIsLoading(false);
    }
  };

  const validateInputs = (): { valid: boolean; error?: string } => {
    // Use ref values instead of state
    const ip = currentServerIp.current;
    const port = currentServerPort.current;
    const key = currentApiKey.current;
    const uid = currentUserId.current;

    // Check if fields are filled
    if (!ip.trim()) {
      return { valid: false, error: "Please enter a server IP address" };
    }

    if (!port.trim()) {
      return { valid: false, error: "Please enter a server port" };
    }

    if (!key.trim()) {
      return { valid: false, error: "Please enter an API key" };
    }

    if (!uid.trim()) {
      return { valid: false, error: "Please enter a User ID" };
    }

    // Validate server IP format (allow IP addresses, hostnames, localhost - NO PORT in IP field now)
    const serverIpTrimmed = ip.trim();
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    const hostnamePattern =
      /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const localhostPattern = /^localhost$/i;

    if (
      !ipPattern.test(serverIpTrimmed) &&
      !hostnamePattern.test(serverIpTrimmed) &&
      !localhostPattern.test(serverIpTrimmed)
    ) {
      return {
        valid: false,
        error:
          "Invalid server IP format. Use format: 192.168.1.100 or localhost (no port)",
      };
    }

    // Validate port
    const portNum = parseInt(port.trim(), 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      return {
        valid: false,
        error: "Invalid port. Must be between 1 and 65535",
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
    if (
      !/^[a-f0-9]{32}$/.test(userIdTrimmed) &&
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        userIdTrimmed,
      )
    ) {
      return {
        valid: false,
        error:
          "Invalid User ID format. Must be a valid GUID (e.g., 8d6b79c2-4368-496c-9393-1394d31ac428)",
      };
    }

    return { valid: true };
  };

  const testConnection = async () => {
    try {
      setIsTesting(true);

      // Validate inputs
      const validation = validateInputs();
      if (!validation.valid) {
        Alert.alert("Validation Error", validation.error || "Invalid input");
        return;
      }

      // Sanitize and prepare inputs (use ref values)
      const sanitizedServerIp = currentServerIp.current
        .trim()
        .replace(/[<>'"]/g, "");
      const sanitizedServerPort = currentServerPort.current
        .trim()
        .replace(/[^0-9]/g, "");
      const sanitizedApiKey = currentApiKey.current
        .trim()
        .replace(/[^a-zA-Z0-9]/g, "");
      const sanitizedUserId = currentUserId.current
        .trim()
        .replace(/[^a-f0-9-]/gi, "");

      // Temporarily save to test connection
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_IP, sanitizedServerIp),
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_PORT, sanitizedServerPort),
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_PROTOCOL, serverProtocol),
        SecureStore.setItemAsync(STORAGE_KEYS.API_KEY, sanitizedApiKey),
        SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, sanitizedUserId),
      ]);

      // Refresh config and test
      await refreshConfig();
      const videos = await fetchVideos();

      // Trigger library refresh in background
      refreshLibrary();

      Alert.alert(
        "Connection Successful!",
        `Successfully connected to Jellyfin server.\n\nFound ${videos.length} video(s) in your library.`,
        [{ text: "OK" }],
      );
    } catch (error) {
      logger.error("Connection test failed", error);
      Alert.alert(
        "Connection Failed",
        `Unable to connect to Jellyfin server.\n\nPlease check:\n• Server IP is correct\n• Jellyfin is running\n• API key and User ID are valid\n\nError: ${
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

      // Validate inputs
      const validation = validateInputs();
      if (!validation.valid) {
        Alert.alert("Validation Error", validation.error || "Invalid input");
        return;
      }

      // Sanitize inputs to prevent injection attacks (use ref values)
      const sanitizedServerIp = currentServerIp.current
        .trim()
        .replace(/[<>'"]/g, "");
      const sanitizedServerPort = currentServerPort.current
        .trim()
        .replace(/[^0-9]/g, "");
      const sanitizedApiKey = currentApiKey.current
        .trim()
        .replace(/[^a-zA-Z0-9]/g, "");
      const sanitizedUserId = currentUserId.current
        .trim()
        .replace(/[^a-f0-9-]/gi, "");

      // Save to secure store (syncs to iCloud Keychain automatically)
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_IP, sanitizedServerIp),
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_PORT, sanitizedServerPort),
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_PROTOCOL, serverProtocol),
        SecureStore.setItemAsync(STORAGE_KEYS.API_KEY, sanitizedApiKey),
        SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, sanitizedUserId),
      ]);

      // Refresh the API service config cache
      await refreshConfig();

      // Trigger library refresh in background
      logger.info("Settings saved - triggering library refresh", {
        screen: "settings",
      });
      refreshLibrary();

      Alert.alert("Success", "Jellyfin settings saved successfully!", [
        { text: "OK" },
      ]);
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
      await SecureStore.setItemAsync(
        STORAGE_KEYS.VIDEO_QUALITY,
        qualityValue.toString(),
      );

      const qualityLabel = QUALITY_PRESETS[qualityValue]?.label || "Unknown";
      Alert.alert("Success", `Video quality set to ${qualityLabel}`);
    } catch (error) {
      logger.error("Error saving video quality", error);
      Alert.alert("Error", "Failed to save video quality");
    }
  };

  const viewDebugInfo = async () => {
    try {
      const [
        savedIp,
        savedPort,
        savedProtocol,
        savedKey,
        savedUserId,
        savedQuality,
      ] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_IP),
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_PORT),
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_PROTOCOL),
        SecureStore.getItemAsync(STORAGE_KEYS.API_KEY),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_ID),
        SecureStore.getItemAsync(STORAGE_KEYS.VIDEO_QUALITY),
      ]);

      const qualityLabel = savedQuality
        ? QUALITY_PRESETS[parseInt(savedQuality, 10)]?.label || "Unknown"
        : "Not set";

      const debugInfo = `
📱 Stored in iCloud Keychain:

Server IP: ${savedIp || "Not set"}
Port: ${savedPort || "Not set"}
Protocol: ${savedProtocol || "Not set"}
User ID: ${savedUserId || "Not set"}
API Key: ${savedKey || "Not set"}
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
    Alert.alert(
      "Clear Settings",
      "Are you sure you want to clear all settings?",
      [
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
                SecureStore.deleteItemAsync(STORAGE_KEYS.SERVER_IP),
                SecureStore.deleteItemAsync(STORAGE_KEYS.SERVER_PORT),
                SecureStore.deleteItemAsync(STORAGE_KEYS.SERVER_PROTOCOL),
                SecureStore.deleteItemAsync(STORAGE_KEYS.API_KEY),
                SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID),
                SecureStore.deleteItemAsync(STORAGE_KEYS.VIDEO_QUALITY),
              ]);
              setServerIp("");
              setServerPort("8096");
              setServerProtocol("http");
              setApiKey("");
              setUserId("");
              setVideoQuality(2); // Reset to 720p default

              // Update current refs to match state
              currentServerIp.current = "";
              currentServerPort.current = "8096";
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
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFC312" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
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
                style={({ focused }) => [
                  styles.listItem,
                  index === 0 && styles.listItemFirst,
                  index === QUALITY_PRESETS.length - 1 && styles.listItemLast,
                  focused && { backgroundColor: "rgba(255, 255, 255, 0.1)" },
                ]}
                onPress={() => handleQualityChange(preset.value)}
                tvParallaxProperties={{ magnification: 1.01 }}
                isTVSelectable={true}
                hasTVPreferredFocus={index === 0}
              >
                <View style={styles.listItemContent}>
                  <View style={styles.listItemLeft}>
                    <Text style={styles.listItemTitle}>{preset.label}</Text>
                    <Text style={styles.listItemSubtitle}>
                      {preset.description}
                    </Text>
                  </View>
                  {videoQuality === preset.value && (
                    <Ionicons
                      name="checkmark"
                      size={Platform.isTV ? 28 : 24}
                      color="#FFC312"
                    />
                  )}
                </View>
              </Pressable>
            ))}
          </View>

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
            ]}
          >
            {/* Server IP */}
            <View style={[styles.listItem, styles.listItemFirst]}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Server IP / Hostname</Text>
                <TextInput
                  ref={serverIpRef}
                  value={serverIp}
                  placeholder="IP Address"
                  placeholderTextColor="#8E8E93"
                  autoCorrect={false}
                  onChangeText={(value) => {
                    setServerIp(value);
                    currentServerIp.current = value;
                  }}
                  style={styles.textInput}
                  autoFocus={false}
                  numberOfLines={1}
                  multiline={false}
                />
              </View>
            </View>

            {/* Port */}
            <View style={styles.listItem}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Port</Text>
                <TextInput
                  ref={serverPortRef}
                  value={serverPort}
                  placeholder="8096"
                  placeholderTextColor="#8E8E93"
                  autoCorrect={false}
                  keyboardType="number-pad"
                  onChangeText={(value) => {
                    setServerPort(value);
                    currentServerPort.current = value;
                  }}
                  style={styles.textInput}
                  autoFocus={false}
                  numberOfLines={1}
                  multiline={false}
                />
              </View>
            </View>

            {/* Protocol Toggle */}
            <View style={styles.listItem}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Protocol</Text>
                <Host matchContents>
                  <Switch
                    value={serverProtocol === "https"}
                    onValueChange={(value) =>
                      setServerProtocol(value ? "https" : "http")
                    }
                    label="Use HTTPS"
                    variant="switch"
                  />
                </Host>
              </View>
            </View>

            {/* User ID */}
            <View style={styles.listItem}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>User ID</Text>
                <TextInput
                  ref={userIdRef}
                  value={userId}
                  placeholder="Enter your user ID"
                  placeholderTextColor="#8E8E93"
                  autoCorrect={false}
                  onChangeText={(value) => {
                    setUserId(value);
                    currentUserId.current = value;
                  }}
                  style={styles.textInput}
                  autoFocus={false}
                  multiline={false}
                  numberOfLines={1}
                />
              </View>
            </View>

            {/* API Key */}
            <View style={[styles.listItem, styles.listItemLast]}>
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>API Key</Text>
                <TextInput
                  ref={apiKeyRef}
                  value={apiKey}
                  placeholder="Enter your API key"
                  placeholderTextColor="#8E8E93"
                  autoCorrect={false}
                  secureTextEntry={!Platform.isTV}
                  onChangeText={(value) => {
                    setApiKey(value);
                    currentApiKey.current = value;
                  }}
                  style={styles.textInput}
                  autoFocus={false}
                  numberOfLines={1}
                  multiline={false}
                />
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
                <Text style={styles.primaryButtonText}>
                  Save Server Settings
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Debug Info */}
          <TouchableOpacity
            style={styles.debugButton}
            onPress={viewDebugInfo}
            activeOpacity={0.6}
            isTVSelectable={true}
          >
            <Text style={styles.debugButtonText}>View iCloud Sync Status</Text>
          </TouchableOpacity>

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
    fontSize: Platform.isTV ? 20 : 17,
    color: "#8E8E93",
  },
  // Section Headers (iOS style)
  sectionHeader: {
    paddingHorizontal: Platform.isTV ? 16 : 16,
    paddingTop: Platform.isTV ? 32 : 24,
    paddingBottom: Platform.isTV ? 12 : 8,
  },
  sectionHeaderText: {
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: "600",
    color: "#8E8E93",
    letterSpacing: -0.08,
  },
  // Section (Grouped List)
  section: {
    backgroundColor: "#1C1C1E",
    borderRadius: Platform.isTV ? 32 : 10,
    overflow: "hidden",
    // paddingVertical: Platform.isTV ? 8 : 6,
    marginBottom: Platform.isTV ? 32 : 24,
  },
  // List Items
  listItem: {
    backgroundColor: "#1C1C1E",
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
    fontSize: Platform.isTV ? 25 : 20,
    fontWeight: "400",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  listItemSubtitle: {
    color: "#8E8E93",
    fontSize: Platform.isTV ? 20 : 17,
  },
  // Input Fields
  inputContainer: {
    gap: Platform.isTV ? 20 : 12,
  },
  inputLabel: {
    fontSize: Platform.isTV ? 18 : 15,
    fontWeight: "500",
    color: "#8E8E93",
    marginBottom: 15,
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
    fontSize: Platform.isTV ? 24 : 20,
    color: "#FFFFFF",
  },
  // Buttons
  buttonGroup: {
    gap: Platform.isTV ? 16 : 12,
    marginTop: Platform.isTV ? 24 : 16,
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
    marginHorizontal: "auto",
  },
  primaryButtonText: {
    fontSize: Platform.isTV ? 25 : 17,
    fontWeight: "600",
    color: "#000000",
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
    marginHorizontal: "auto",
  },
  secondaryButtonText: {
    fontSize: Platform.isTV ? 24 : 17,
    fontWeight: "600",
    color: "#FFC312",
  },
  debugButton: {
    backgroundColor: "transparent",
    paddingVertical: Platform.isTV ? 20 : 14,
    paddingHorizontal: Platform.isTV ? 28 : 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Platform.isTV ? 32 : 24,
    minHeight: Platform.isTV ? 60 : 50,
    borderWidth: 1,
    borderColor: "#8E8E93",
    maxWidth: 400,
    width: "100%",
    marginHorizontal: "auto",
  },
  debugButtonText: {
    fontSize: Platform.isTV ? 20 : 17,
    fontWeight: "600",
    color: "#8E8E93",
  },
  destructiveButton: {
    backgroundColor: "transparent",
    paddingVertical: Platform.isTV ? 20 : 14,
    paddingHorizontal: Platform.isTV ? 28 : 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Platform.isTV ? 16 : 12,
    minHeight: Platform.isTV ? 60 : 50,
  },
  destructiveButtonText: {
    fontSize: Platform.isTV ? 20 : 17,
    fontWeight: "600",
    color: "#FF3B30",
  },
});
