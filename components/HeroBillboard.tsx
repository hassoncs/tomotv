import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import { SkiaFadingHeroImage } from "@/components/SkiaFadingHeroImage";
import { FocusableButton } from "@/components/FocusableButton";
import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { getBackdropUrl, getPosterUrl } from "@/services/jellyfinApi";
import { JellyfinItem } from "@/types/jellyfin";

const WINDOW_HEIGHT = Dimensions.get("window").height;
const SCREEN_WIDTH = Dimensions.get("window").width;
const HERO_HEIGHT = WINDOW_HEIGHT * 0.62;

const ROTATION_INTERVAL_MS = 8000;

interface HeroBillboardProps {
  items: JellyfinItem[];
  onPlay: (item: JellyfinItem) => void;
  onInfo?: (item: JellyfinItem) => void;
  onItemChange?: (item: JellyfinItem) => void;
  /** Called when focus enters the hero area (e.g. user navigates back from shelves) */
  onHeroFocus?: () => void;
  /** Animated.Value 0–1: 1 = sharp hero image fully visible, 0 = faded out (only blurred bg shows). */
  heroAnim?: Animated.Value;
}

function formatDurationFromTicks(ticks: number): string {
  const secs = ticks / 10000000;
  if (secs >= 3600) {
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  }
  return `${Math.floor(secs / 60)}m`;
}

export function HeroBillboard({ items, onPlay, onInfo, onItemChange, onHeroFocus, heroAnim }: HeroBillboardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  const goBack = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + items.length) % items.length);
  }, [items.length]);

  // Auto-rotation timer
  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(advance, ROTATION_INTERVAL_MS);
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, [advance, items.length]);

  useEffect(() => {
    if (items.length > 0) onItemChange?.(items[currentIndex]);
  }, [currentIndex, items, onItemChange]);

  // Re-sync background when focus returns to the hero area
  const handleHeroAreaFocus = useCallback(() => {
    onHeroFocus?.();
    onItemChange?.(items[currentIndex]);
  }, [onHeroFocus, onItemChange, items, currentIndex]);

  if (items.length === 0) return null;

  const item = items[currentIndex];
  const backdropUrl =
    item.BackdropImageTags && item.BackdropImageTags.length > 0
      ? getBackdropUrl(item.Id)
      : getPosterUrl(item.Id, 1920);

  const year = item.ProductionYear ? String(item.ProductionYear) : undefined;
  const genre = item.Genres && item.Genres.length > 0 ? item.Genres[0] : undefined;
  const duration = item.RunTimeTicks ? formatDurationFromTicks(item.RunTimeTicks) : undefined;
  const subtitle = [year, genre, duration].filter(Boolean).join(" • ");
  const showArrows = items.length > 1;


  return (
    <View style={styles.container} onFocus={handleHeroAreaFocus}>
      {/* Sharp hero image — fades out when focus moves to shelves */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: heroAnim ?? 1 }]}>
        <SkiaFadingHeroImage
          uri={backdropUrl}
          width={SCREEN_WIDTH}
          height={HERO_HEIGHT}
          fadeStart={0.8}
          fadeEnd={0.92}
        />
      </Animated.View>

      <View style={[styles.metadataContainer, { left: SPACING.screenPadding }]}>
        <View style={styles.metadataPanel}>
          <Text style={styles.title} numberOfLines={2}>
            {item.Name}
          </Text>
          {subtitle.length > 0 && <Text style={styles.subtitle}>{subtitle}</Text>}

          <View style={styles.buttonRow}>
            {/* Left arrow — navigates carousel back */}
            {showArrows && (
              <Pressable
                style={({ focused }) => [styles.arrowButton, focused && styles.arrowButtonFocused]}
                isTVSelectable
                onPress={goBack}
              >
                <Text style={styles.arrowText}>‹</Text>
              </Pressable>
            )}

            <FocusableButton
              title="▶ Play"
              variant="primary"
              hasTVPreferredFocus
              onPress={() => onPlay(item)}
            />

            {onInfo && (
              <FocusableButton
                title="More Info"
                variant="secondary"
                onPress={() => onInfo(item)}
              />
            )}

            {/* Right arrow — navigates carousel forward */}
            {showArrows && (
              <Pressable
                style={({ focused }) => [styles.arrowButton, focused && styles.arrowButtonFocused]}
                isTVSelectable
                onPress={advance}
              >
                <Text style={styles.arrowText}>›</Text>
              </Pressable>
            )}
          </View>

          {showArrows && (
            <View style={styles.dotsRow}>
              {items.map((_, idx) => (
                <View key={idx} style={[styles.dot, idx === currentIndex && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: HERO_HEIGHT,
  },
  metadataContainer: {
    position: "absolute",
    bottom: 60,
    right: SPACING.screenPadding,
  },
  metadataPanel: {
    maxWidth: 700,
  },
  title: {
    ...TYPOGRAPHY.heroTitle,
    color: COLORS.textPrimary,
    marginBottom: 12,
    textShadowColor: "rgba(0, 0, 0, 0.9)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    ...TYPOGRAPHY.heroSubtitle,
    color: COLORS.textSecondary,
    marginBottom: 24,
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },
  arrowButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  arrowButtonFocused: {
    backgroundColor: "rgba(255, 195, 18, 0.25)",
    borderColor: "#FFC312",
  },
  arrowText: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "300",
    lineHeight: 42,
    marginTop: -2,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 20,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textTertiary,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
    width: 24,
    borderRadius: 4,
  },
});
