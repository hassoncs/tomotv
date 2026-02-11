import { FocusableButton } from "@/components/FocusableButton";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import { settingsStyles } from "./styles";

interface QuickConnectSectionProps {
  code: string | null;
  status: string;
  error: string | null;
  onCancel: () => void;
  onSwitchToPassword: () => void;
}

export function QuickConnectSection({ code, status, error, onCancel, onSwitchToPassword }: QuickConnectSectionProps) {
  return (
    <>
      <View style={settingsStyles.section}>
        <View style={[settingsStyles.listItem, settingsStyles.listItemFirst, settingsStyles.listItemLast, styles.quickConnectContainer]}>
          {status === "INITIATING" && (
            <View style={styles.centeredContent}>
              <ActivityIndicator size="large" color="#FFC312" />
              <Text style={styles.statusText}>Starting Quick Connect...</Text>
            </View>
          )}

          {status === "SHOWING_CODE" && code && (
            <View style={styles.centeredContent}>
              <Text style={styles.quickConnectLabel}>Enter this code on another device:</Text>
              <Text style={styles.quickConnectCode}>{code}</Text>
              <View style={styles.waitingRow}>
                <ActivityIndicator size="small" color="#8E8E93" />
                <Text style={styles.waitingText}>Waiting for approval...</Text>
              </View>
              <Text style={styles.quickConnectHint}>Open your Jellyfin dashboard or app, go to Quick Connect, and enter the code above.</Text>
            </View>
          )}

          {status === "ERROR" && (
            <View style={styles.centeredContent}>
              <Ionicons name="alert-circle" size={Platform.isTV ? 48 : 36} color="#FF3B30" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={settingsStyles.buttonGroup}>
        <FocusableButton title="Cancel" variant="secondary" onPress={onCancel} style={settingsStyles.fullWidthButton} />
        <FocusableButton title="Use Username & Password" variant="debug" onPress={onSwitchToPassword} style={settingsStyles.fullWidthButton} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  quickConnectContainer: {
    minHeight: Platform.isTV ? 280 : 200,
    justifyContent: "center",
  },
  centeredContent: {
    alignItems: "center",
    justifyContent: "center",
    gap: Platform.isTV ? 20 : 14,
    paddingVertical: Platform.isTV ? 20 : 12,
  },
  quickConnectLabel: {
    fontSize: Platform.isTV ? 30 : 18,
    color: "#8E8E93",
    textAlign: "center",
  },
  quickConnectCode: {
    fontSize: Platform.isTV ? 72 : 48,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: "#FFC312",
    letterSpacing: Platform.isTV ? 16 : 10,
    textAlign: "center",
    paddingVertical: Platform.isTV ? 16 : 8,
  },
  waitingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Platform.isTV ? 12 : 8,
  },
  waitingText: {
    fontSize: Platform.isTV ? 26 : 16,
    color: "#8E8E93",
  },
  quickConnectHint: {
    fontSize: Platform.isTV ? 24 : 14,
    color: "#636366",
    textAlign: "center",
    paddingHorizontal: Platform.isTV ? 24 : 16,
    lineHeight: Platform.isTV ? 34 : 20,
  },
  statusText: {
    fontSize: Platform.isTV ? 28 : 17,
    color: "#8E8E93",
    marginTop: Platform.isTV ? 12 : 8,
  },
  errorText: {
    fontSize: Platform.isTV ? 28 : 17,
    color: "#FF3B30",
    textAlign: "center",
    paddingHorizontal: Platform.isTV ? 24 : 16,
  },
});
