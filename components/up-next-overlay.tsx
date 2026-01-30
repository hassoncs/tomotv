import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Dimensions, Platform, StyleSheet, Text, View } from "react-native";

interface UpNextOverlayProps {
  nextVideoName: string;
  progress: string;
  onSkip: () => void;
  visible: boolean;
}

const COUNTDOWN_SECONDS = 30;

export function UpNextOverlay({ nextVideoName, progress, onSkip, visible }: UpNextOverlayProps) {
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset countdown when overlay becomes visible
  useEffect(() => {
    if (visible) {
      setCountdown(COUNTDOWN_SECONDS);
    }
  }, [visible]);

  // Countdown timer
  useEffect(() => {
    if (!visible) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [visible]);

  // Auto-skip when countdown reaches 0
  useEffect(() => {
    if (visible && countdown === 0) {
      onSkip();
    }
  }, [countdown, visible, onSkip]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.container} pointerEvents={visible ? "auto" : "none"}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="play-skip-forward" size={Platform.isTV ? 28 : 20} color="#FFC312" />
          <Text style={styles.headerText}>Up Next</Text>
          <Text style={styles.countdown}>{`${countdown}s`}</Text>
        </View>

        <Text style={styles.videoName} numberOfLines={2}>
          {nextVideoName}
        </Text>

        {progress ? <Text style={styles.progress}>{progress}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: Dimensions.get("window").height * 0.3,
    right: 76,
    zIndex: 200,
  },
  card: {
    backgroundColor: "rgba(28, 28, 30, 0.65)",
    borderRadius: 23,
    padding: Platform.isTV ? 28 : 20,
    minWidth: Platform.isTV ? 400 : 280,
    maxWidth: Platform.isTV ? 500 : 340,
    borderWidth: 1,
    borderColor: "rgba(255, 195, 18, 0.3)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Platform.isTV ? 12 : 8,
    marginBottom: Platform.isTV ? 16 : 12,
  },
  headerText: {
    fontSize: Platform.isTV ? 22 : 16,
    fontWeight: "700",
    color: "#FFC312",
    flex: 1,
  },
  countdown: {
    fontSize: Platform.isTV ? 20 : 14,
    fontWeight: "600",
    color: "#8E8E93",
  },
  videoName: {
    fontSize: Platform.isTV ? 24 : 17,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: Platform.isTV ? 8 : 4,
    lineHeight: Platform.isTV ? 32 : 22,
  },
  progress: {
    fontSize: Platform.isTV ? 18 : 13,
    fontWeight: "500",
    color: "#8E8E93",
  },
});
