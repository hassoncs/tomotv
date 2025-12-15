import React from "react";
import { ActivityIndicator, Platform, Pressable, PressableProps, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";

export type ButtonVariant = "primary" | "secondary" | "destructive" | "debug" | "retry";

interface FocusableButtonProps extends Omit<PressableProps, "style"> {
  /** Button text label */
  title: string;
  /** Visual variant of the button */
  variant?: ButtonVariant;
  /** Whether button is in loading state */
  isLoading?: boolean;
  /** Optional icon to display before text */
  icon?: React.ReactNode;
  /** Whether this button should have TV preferred focus */
  hasTVPreferredFocus?: boolean;
  /** Custom styles for the button container */
  style?: ViewStyle;
  /** Custom styles for the button text */
  textStyle?: TextStyle;
}

/**
 * FocusableButton - A reusable button component with enhanced TV focus styling
 *
 * Features:
 * - Clear visual focus indication for TV navigation
 * - Multiple visual variants (primary, secondary, destructive, etc.)
 * - Loading state with spinner
 * - Icon support
 * - Platform-specific sizing (larger on TV)
 * - Proper accessibility with isTVSelectable
 */
export function FocusableButton({ title, variant = "primary", isLoading = false, icon, hasTVPreferredFocus = false, disabled = false, style, textStyle, ...pressableProps }: FocusableButtonProps) {
  const getButtonStyle = (focused: boolean): ViewStyle => {
    const baseStyle = [styles.button];

    // Variant-specific styles
    switch (variant) {
      case "primary":
        baseStyle.push(styles.primaryButton);
        if (focused) baseStyle.push(styles.primaryButtonFocused);
        break;
      case "secondary":
        baseStyle.push(styles.secondaryButton);
        if (focused) baseStyle.push(styles.secondaryButtonFocused);
        break;
      case "destructive":
        baseStyle.push(styles.destructiveButton);
        if (focused) baseStyle.push(styles.destructiveButtonFocused);
        break;
      case "debug":
        baseStyle.push(styles.debugButton);
        if (focused) baseStyle.push(styles.debugButtonFocused);
        break;
      case "retry":
        baseStyle.push(styles.retryButton);
        if (focused) baseStyle.push(styles.retryButtonFocused);
        break;
    }

    // Disabled state
    if (disabled || isLoading) {
      baseStyle.push(styles.buttonDisabled);
    }

    // Custom styles
    if (style) {
      baseStyle.push(style);
    }

    return StyleSheet.flatten(baseStyle);
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle = [styles.buttonText];

    // Variant-specific text styles
    switch (variant) {
      case "primary":
        baseStyle.push(styles.primaryButtonText);
        break;
      case "secondary":
        baseStyle.push(styles.secondaryButtonText);
        break;
      case "destructive":
        baseStyle.push(styles.destructiveButtonText);
        break;
      case "debug":
        baseStyle.push(styles.debugButtonText);
        break;
      case "retry":
        baseStyle.push(styles.retryButtonText);
        break;
    }

    // Disabled state
    if (disabled || isLoading) {
      baseStyle.push(styles.buttonTextDisabled);
    }

    // Custom text styles
    if (textStyle) {
      baseStyle.push(textStyle);
    }

    return StyleSheet.flatten(baseStyle);
  };

  return (
    <Pressable
      {...pressableProps}
      style={({ pressed, focused }) => [getButtonStyle(focused || false), pressed && styles.buttonPressed]}
      disabled={disabled || isLoading}
      isTVSelectable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
      tvParallaxProperties={{
        magnification: 1.05,
        pressMagnification: 1.0,
      }}>
      <View style={styles.buttonContent}>
        {isLoading ? (
          <ActivityIndicator color={variant === "primary" ? "#000000" : "#FFC312"} size={"small"} />
        ) : (
          <>
            {icon}
            <Text style={getTextStyle()}>{title}</Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Platform.isTV ? 20 : 14,
    paddingHorizontal: Platform.isTV ? 48 : 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    minHeight: Platform.isTV ? 60 : 50,
    minWidth: Platform.isTV ? 300 : 200,
    // Add transparent border to prevent layout shift on focus
    borderWidth: Platform.isTV ? 4 : 3,
    borderColor: "transparent",
    // Use consistent shadowRadius to prevent layout shift when focus changes
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: Platform.isTV ? 20 : 12,
    elevation: 2,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Platform.isTV ? 12 : 8,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: Platform.isTV ? 24 : 18,
    fontWeight: "600",
  },
  buttonTextDisabled: {
    opacity: 0.6,
  },

  // Primary variant (Yellow background, black text)
  primaryButton: {
    backgroundColor: "#FFC312",
    borderColor: "transparent",
  },
  primaryButtonFocused: {
    backgroundColor: "#FFD54F",
    borderColor: "#FFFFFF",
    shadowColor: "#FFC312",
    shadowOpacity: 0.5,
    elevation: 8,
  },
  primaryButtonText: {
    color: "#000000",
  },

  // Secondary variant (Transparent with yellow border)
  secondaryButton: {
    backgroundColor: "transparent",
    borderColor: "#FFC312",
  },
  secondaryButtonFocused: {
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    borderColor: "#FFD54F",
    shadowColor: "#FFC312",
    shadowOpacity: 0.4,
    elevation: 6,
  },
  secondaryButtonText: {
    color: "#FFC312",
  },

  // Destructive variant (Red text)
  destructiveButton: {
    backgroundColor: "transparent",
    borderColor: "transparent",
  },
  destructiveButtonFocused: {
    backgroundColor: "rgba(255, 59, 48, 0.15)",
    borderColor: "#FF3B30",
    shadowColor: "#FF3B30",
    shadowOpacity: 0.4,
    elevation: 6,
  },
  destructiveButtonText: {
    color: "#FF3B30",
    fontSize: Platform.isTV ? 20 : 17,
  },

  // Debug variant (Gray border)
  debugButton: {
    backgroundColor: "transparent",
    borderColor: "#8E8E93",
  },
  debugButtonFocused: {
    backgroundColor: "rgba(142, 142, 147, 0.15)",
    borderColor: "#FFFFFF",
    shadowColor: "#8E8E93",
    shadowOpacity: 0.4,
    elevation: 6,
  },
  debugButtonText: {
    color: "#8E8E93",
    fontSize: Platform.isTV ? 20 : 17,
  },

  // Retry variant (Yellow background)
  retryButton: {
    backgroundColor: "#FFC312",
    borderColor: "transparent",
  },
  retryButtonFocused: {
    backgroundColor: "#FFD54F",
    borderColor: "#FFFFFF",
    shadowColor: "#FFC312",
    shadowOpacity: 0.5,
    elevation: 8,
  },
  retryButtonText: {
    color: "#000000",
  },
});
