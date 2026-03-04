import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { z } from "zod";

export const chatMessagePropsSchema = z.object({
  text: z.string().describe("The message text to display"),
  role: z.enum(["assistant", "system"]).default("assistant").describe("Who sent the message"),
  variant: z.enum(["default", "success", "warning", "error"]).default("default").describe("Visual style of the message"),
});

export type ChatMessageProps = z.infer<typeof chatMessagePropsSchema>;

const ACCENT_COLORS: Record<NonNullable<ChatMessageProps["variant"]>, string> = {
  default: "#FFC312",
  success: "#34C759",
  warning: "#FF9500",
  error: "#FF3B30",
};

const TV = Platform.isTV;

export function ChatMessage({ text, role = "assistant", variant = "default" }: ChatMessageProps) {
  const accentColor = ACCENT_COLORS[variant];
  const label = role === "system" ? "System" : "Radbot";

  return (
    <View style={styles.container}>
      <View style={[styles.accentBar, { backgroundColor: accentColor }]} />
      <View style={styles.content}>
        <Text style={[styles.roleLabel, { color: accentColor }]}>{label}</Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "transparent",
    paddingVertical: TV ? 24 : 12,
    marginBottom: TV ? 16 : 8,
  },
  accentBar: {
    width: TV ? 4 : 3,
    borderRadius: 2,
    marginRight: TV ? 32 : 16,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  roleLabel: {
    fontSize: TV ? 22 : 13,
    fontWeight: "600",
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: TV ? 12 : 6,
  },
  text: {
    color: "#FFFFFF",
    fontSize: TV ? 32 : 17,
    lineHeight: TV ? 46 : 26,
    fontWeight: "400",
  },
});
