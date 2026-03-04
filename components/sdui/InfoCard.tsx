import React, { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform, ScrollView } from "react-native";
import { z } from "zod";

import { remoteBridgeService } from "@/services/remoteBridgeService";

const actionSchema = z.object({
  actionId: z.string().describe("Unique action identifier emitted to the relay on press"),
  label: z.string().describe("Button label text"),
});

export const infoCardPropsSchema = z.object({
  title: z.string().describe("Card heading"),
  body: z.string().optional().describe("Body text or description"),
  imageUrl: z.string().optional().describe("Optional image URL shown above the body text"),
  actions: z.array(actionSchema).optional().describe("Action buttons rendered at the bottom"),
  component: z.string().default("InfoCard").describe("Component name for event routing"),
});

export type InfoCardProps = z.infer<typeof infoCardPropsSchema>;

export function InfoCard({ title, body, imageUrl, actions = [], component = "InfoCard" }: InfoCardProps) {
  const [focusedAction, setFocusedAction] = useState<string | null>(null);

  const handleAction = (actionId: string) => {
    remoteBridgeService.emitUiAction({ component, actionId });
  };

  return (
    <View style={styles.container}>
      {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" /> : null}
      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <Text style={styles.title}>{title}</Text>
        {body ? <Text style={styles.bodyText}>{body}</Text> : null}
      </ScrollView>
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((action) => (
            <TouchableOpacity
              key={action.actionId}
              style={[styles.actionBtn, focusedAction === action.actionId && styles.actionBtnFocused]}
              onPress={() => handleAction(action.actionId)}
              onFocus={() => setFocusedAction(action.actionId)}
              onBlur={() => setFocusedAction(null)}
              isTVSelectable
              activeOpacity={0.8}>
              <Text style={styles.actionText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const TV = Platform.isTV;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "transparent",
    width: "100%",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: TV ? 280 : 180,
    borderRadius: TV ? 16 : 10,
    marginBottom: TV ? 32 : 16,
  },
  body: {
    maxHeight: TV ? 200 : 160,
  },
  bodyContent: {
    gap: TV ? 16 : 10,
  },
  title: {
    color: "#FFFFFF",
    fontSize: TV ? 40 : 24,
    fontWeight: "700",
  },
  bodyText: {
    color: "#8E8E93",
    fontSize: TV ? 28 : 16,
    lineHeight: TV ? 42 : 24,
  },
  actions: {
    flexDirection: "row",
    gap: TV ? 16 : 12,
    marginTop: TV ? 32 : 16,
    flexWrap: "wrap",
  },
  actionBtn: {
    paddingVertical: TV ? 18 : 10,
    paddingHorizontal: TV ? 44 : 24,
    backgroundColor: "#2C2C2E",
    borderRadius: TV ? 14 : 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  actionBtnFocused: {
    borderColor: "#FFC312",
    backgroundColor: "#1C1C1E",
  },
  actionText: {
    color: "#FFFFFF",
    fontSize: TV ? 26 : 16,
    fontWeight: "600",
  },
});
