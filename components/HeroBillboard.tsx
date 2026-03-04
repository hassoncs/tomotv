import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, findNodeHandle, StyleSheet, Text, View, Pressable } from "react-native";
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
}

function formatDurationFromTicks(ticks: number): string {
  const secs = ticks / 10000000;
  if (secs >= 3600) {
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  }
  return `${Math.floor(secs / 60)}m`;
}

export function HeroBillboard({ items, onPlay, onInfo, onItemChange, onHeroFocus }: HeroBillboardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track which button is currently focused — null means hero doesn't have focus
  const focusedButtonRef = useRef<"play" | "info" | null>(null);
  const leftSentinelRef = useRef<View>(null);
  const rightSentinelRef = useRef<View>(null);
  // State to drive hasTVPreferredFocus bounce-back after sentinel fires
  const [playPreferredFocus, setPlayPreferredFocus] = useState(true);
  const [infoPreferredFocus, setInfoPreferredFocus] = useState(false);
  // Node handles for nextFocusLeft/Right — populated after mount
  const [leftSentinelHandle, setLeftSentinelHandle] = useState<number | null>(null);
  const [rightSentinelHandle, setRightSentinelHandle] = useState<number | null>(null);

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
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [advance, items.length]);

  useEffect(() => {
    if (items.length > 0) {
      onItemChange?.(items[currentIndex]);
    }
  }, [currentIndex, items, onItemChange]);

  // Populate node handles after sentinels mount so nextFocusLeft/Right work
  useEffect(() => {
    setLeftSentinelHandle(findNodeHandle(leftSentinelRef.current));
    setRightSentinelHandle(findNodeHandle(rightSentinelRef.current));
  }, []);

  // Re-sync background when focus returns to the hero area (after browsing shelves)
  const handleHeroAreaFocus = useCallback(() => {
    onHeroFocus?.();
    onItemChange?.(items[currentIndex]);
  }, [onHeroFocus, onItemChange, items, currentIndex]);

  // Clear focused button when focus leaves the hero container entirely
  const handleHeroBlur = useCallback(() => {
    focusedButtonRef.current = null;
  }, []);

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

  return (
    // Skia handles the bottom alpha fade — no overflow clip needed
    <View style={styles.container} onFocus={handleHeroAreaFocus} onBlur={handleHeroBlur}>
      {/* Hero image with shader-based alpha fade to transparent at the bottom */}
      <SkiaFadingHeroImage
        uri={backdropUrl}
        width={SCREEN_WIDTH}
        height={HERO_HEIGHT}
        fadeStart={0.8}
        fadeEnd={0.92}
      />

      <View style={[styles.metadataContainer, { left: SPACING.screenPadding }]}>
        <View style={styles.metadataPanel}>
          <Text style={styles.title} numberOfLines={2}>
            {item.Name}
          </Text>
          {subtitle.length > 0 && <Text style={styles.subtitle}>{subtitle}</Text>}
          <View style={styles.buttonRow}>
            {/* Left sentinel: invisible, receives focus when user presses left on Play */}
            <Pressable
              ref={leftSentinelRef}
              style={styles.sentinel}
              isTVSelectable
              onFocus={() => {
                goBack();
                setPlayPreferredFocus(true);
                setInfoPreferredFocus(false);
              }}
            />
            <FocusableButton
              title="▶ Play"
              variant="primary"
              hasTVPreferredFocus={playPreferredFocus}
              nextFocusLeft={leftSentinelHandle ?? undefined}
              onPress={() => onPlay(item)}
              onFocus={() => {
                focusedButtonRef.current = "play";
                setPlayPreferredFocus(true);
                setInfoPreferredFocus(false);
              }}
              onBlur={() => { focusedButtonRef.current = null; }}
            />
            {onInfo && (
              <FocusableButton
                title="More Info"
                variant="secondary"
                hasTVPreferredFocus={infoPreferredFocus}
                nextFocusRight={rightSentinelHandle ?? undefined}
                onPress={() => onInfo(item)}
                onFocus={() => {
                  focusedButtonRef.current = "info";
                  setInfoPreferredFocus(true);
                  setPlayPreferredFocus(false);
                }}
                onBlur={() => { focusedButtonRef.current = null; }}
              />
            )}
            {/* Right sentinel: invisible, receives focus when user presses right on More Info */}
            <Pressable
              ref={rightSentinelRef}
              style={styles.sentinel}
              isTVSelectable
              onFocus={() => {
                advance();
                setInfoPreferredFocus(true);
                setPlayPreferredFocus(false);
              }}
            />
          </View>
        </View>

        {items.length > 1 && (
          <View style={styles.dotsRow}>
            {items.map((_, idx) => (
              <View key={idx} style={[styles.dot, idx === currentIndex && styles.dotActive]} />
            ))}
          </View>
        )}
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
  sentinel: {
    width: 1,
    height: 1,
    opacity: 0,
    position: "absolute",
  },
});
