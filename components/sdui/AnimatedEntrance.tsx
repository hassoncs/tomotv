import React, { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

interface AnimatedEntranceProps {
  children: React.ReactNode;
  /**
   * Changing this value replays the entrance animation without remounting children.
   * Pass the incrementing render ID from ai.tsx so new ui.render calls trigger the
   * animation even when the same component type is being updated in place.
   */
  triggerKey: string | number;
  /** Total animation duration in ms. Default: 320. */
  durationMs?: number;
  /**
   * How far below the final position the component starts (in pixels).
   * A small positive number gives the Apple-style "created from below" feel. Default: 18.
   */
  offsetY?: number;
}

/**
 * Generic entrance animation wrapper for SDUI components.
 *
 * Wraps any child in a fade-in (0→1 opacity) + slide-up (offsetY→0 translateY)
 * animation. Applied at the single ai.tsx render injection point so all 9 SDUI
 * components get the animation without any per-component changes.
 *
 * The wrapper is non-focusable: tvOS focus passes through to children normally.
 */
export function AnimatedEntrance({
  children,
  triggerKey,
  durationMs = 320,
  offsetY = 18,
}: AnimatedEntranceProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(offsetY);

  useEffect(() => {
    // Reset immediately, then animate in.
    opacity.value = 0;
    translateY.value = offsetY;

    opacity.value = withTiming(1, { duration: durationMs, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: durationMs, easing: Easing.out(Easing.quad) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [triggerKey]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}
