import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Platform } from "react-native";
import { z } from "zod";

import { remoteBridgeService } from "@/services/remoteBridgeService";

export const confirmationCardPropsSchema = z.object({
  title: z.string().describe("Confirmation prompt shown to the user"),
  message: z.string().optional().describe("Optional supporting detail text"),
  confirmLabel: z.string().default("Confirm").describe("Label for the confirm button"),
  cancelLabel: z.string().default("Cancel").describe("Label for the cancel button"),
  component: z.string().default("ConfirmationCard").describe("Component name for event routing"),
});

export type ConfirmationCardProps = z.infer<typeof confirmationCardPropsSchema>;

export function ConfirmationCard({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel", component = "ConfirmationCard" }: ConfirmationCardProps) {
  const [focusedBtn, setFocusedBtn] = useState<"confirm" | "cancel" | null>(null);

  const handleConfirm = () => {
    remoteBridgeService.emitUiAction({ component, actionId: "confirm" });
  };

  const handleCancel = () => {
    remoteBridgeService.emitUiAction({ component, actionId: "cancel" });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.btn, styles.confirmBtn, focusedBtn === "confirm" && styles.btnFocused]}
          onPress={handleConfirm}
          onFocus={() => setFocusedBtn("confirm")}
          onBlur={() => setFocusedBtn(null)}
          isTVSelectable
          activeOpacity={0.8}>
          <Text style={[styles.btnText, styles.confirmBtnText]}>{confirmLabel}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.cancelBtn, focusedBtn === "cancel" && styles.btnFocused]}
          onPress={handleCancel}
          onFocus={() => setFocusedBtn("cancel")}
          onBlur={() => setFocusedBtn(null)}
          isTVSelectable
          activeOpacity={0.8}>
          <Text style={styles.btnText}>{cancelLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const TV = Platform.isTV;

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(28, 28, 30, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: TV ? 24 : 16,
    paddingVertical: TV ? 64 : 32,
    paddingHorizontal: TV ? 80 : 40,
    alignItems: "center",
    alignSelf: "center",
    maxWidth: TV ? 900 : undefined,
    width: "100%",
    gap: TV ? 24 : 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: TV ? 44 : 28,
    fontWeight: "600",
    textAlign: "center",
  },
  message: {
    color: "#8E8E93",
    fontSize: TV ? 30 : 18,
    textAlign: "center",
    lineHeight: TV ? 42 : 26,
    marginBottom: TV ? 24 : 12,
  },
  buttons: {
    flexDirection: "row",
    gap: TV ? 24 : 16,
    justifyContent: "center",
  },
  btn: {
    paddingVertical: TV ? 22 : 14,
    paddingHorizontal: TV ? 60 : 36,
    borderRadius: TV ? 14 : 10,
    borderWidth: 2,
    borderColor: "transparent",
    minWidth: TV ? 240 : 120,
    alignItems: "center",
  },
  confirmBtn: {
    backgroundColor: "#FFC312",
  },
  cancelBtn: {
    backgroundColor: "#2C2C2E",
  },
  btnFocused: {
    borderColor: "#FFFFFF",
  },
  btnText: {
    color: "#FFFFFF",
    fontSize: TV ? 28 : 18,
    fontWeight: "600",
  },
  confirmBtnText: {
    color: "#000000",
  },
});
