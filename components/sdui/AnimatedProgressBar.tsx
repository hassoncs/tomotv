import React, { useEffect } from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

const TV = Platform.isTV;

export interface AnimatedProgressBarProps {
  /** Current position as a fraction 0–1. */
  progress: number;
  /**
   * Rate of forward progress in fractions per second.
   * e.g. for real-time playback at 1x: playbackRate / durationSeconds.
   * When provided, the bar animates forward at this rate after snapping to `progress`.
   */
  progressPerSecond?: number;
  /**
   * Alternative to progressPerSecond: total seconds remaining until the bar reaches 1.0.
   * Used by LoadingCard when the download/task duration is known.
   */
  durationToCompleteSeconds?: number;
  /** Bar height in pixels. Defaults to 6 on TV, 4 on mobile. */
  height?: number;
  /** Track (background) color. Defaults to rgba(255,255,255,0.1). */
  trackColor?: string;
  /** Fill color. Defaults to #FFC312 (gold). */
  fillColor?: string;
}

/**
 * Animated progress bar that can self-advance in real time.
 *
 * On each prop update it snaps to `progress` with a short catch-up animation
 * (250ms ease-out), then optionally continues advancing linearly to 1.0 based
 * on `progressPerSecond` or `durationToCompleteSeconds`. This lets NowPlayingCard
 * show a smoothly ticking progress bar without polling for updates.
 */
export function AnimatedProgressBar({
  progress,
  progressPerSecond,
  durationToCompleteSeconds,
  height = TV ? 6 : 4,
  trackColor = "rgba(255, 255, 255, 0.1)",
  fillColor = "#FFC312",
}: AnimatedProgressBarProps) {
  const progressSV = useSharedValue(progress);

  useEffect(() => {
    cancelAnimation(progressSV);

    const clamped = Math.max(0, Math.min(1, progress));
    const remaining = 1 - clamped;

    // Capture rate values for the worklet callback closure.
    const capturedPPS = progressPerSecond;
    const capturedDTC = durationToCompleteSeconds;

    // Step 1: Snap to the current confirmed position with a short catch-up.
    progressSV.value = withTiming(clamped, { duration: 250, easing: Easing.out(Easing.quad) }, (finished) => {
      "worklet";
      if (!finished || remaining <= 0) return;

      // Step 2: Continue advancing linearly to 100% at the given rate.
      let remainingMs: number | undefined;
      if (capturedPPS !== undefined && capturedPPS > 0) {
        remainingMs = (remaining / capturedPPS) * 1000;
      } else if (capturedDTC !== undefined && capturedDTC > 0) {
        remainingMs = capturedDTC * 1000;
      }

      if (remainingMs !== undefined) {
        progressSV.value = withTiming(1, {
          duration: remainingMs,
          easing: Easing.linear,
        });
      }
    });
  }, [progress, progressPerSecond, durationToCompleteSeconds, progressSV]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${(progressSV.value * 100).toFixed(2)}%` as `${number}%`,
  }));

  return (
    <View style={[styles.track, { height, backgroundColor: trackColor }]}>
      <Animated.View style={[{ height, borderRadius: 3, backgroundColor: fillColor }, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    borderRadius: 3,
    overflow: "hidden",
  },
});
