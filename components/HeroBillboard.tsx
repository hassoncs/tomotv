import React, { useCallback, useEffect, useRef, useState } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { FocusableButton } from "@/components/FocusableButton";
import { SmartGlassView } from "@/components/SmartGlassView";
import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { getBackdropUrl, getPosterUrl } from "@/services/jellyfinApi";
import { JellyfinItem } from "@/types/jellyfin";

const WINDOW_HEIGHT = Dimensions.get("window").height;
const HERO_HEIGHT = WINDOW_HEIGHT * 0.62;
const ROTATION_INTERVAL_MS = 8000;

interface HeroBillboardProps {
  items: JellyfinItem[];
  onPlay: (item: JellyfinItem) => void;
  onInfo?: (item: JellyfinItem) => void;
}

function formatDurationFromTicks(ticks: number): string {
  const secs = ticks / 10000000;
  if (secs >= 3600) {
    return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  }
  return `${Math.floor(secs / 60)}m`;
}

export function HeroBillboard({ items, onPlay, onInfo }: HeroBillboardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % items.length);
  }, [items.length]);

  useEffect(() => {
    if (items.length <= 1) return;
    timerRef.current = setInterval(advance, ROTATION_INTERVAL_MS);
    return () => {
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
      }
    };
  }, [advance, items.length]);

  if (items.length === 0) return null;

  const item = items[currentIndex];
  const backdropUrl = item.BackdropImageTags && item.BackdropImageTags.length > 0
    ? getBackdropUrl(item.Id)
    : getPosterUrl(item.Id, 1920);

  const year = item.ProductionYear ? String(item.ProductionYear) : undefined;
  const genre = item.Genres && item.Genres.length > 0 ? item.Genres[0] : undefined;
  const duration = item.RunTimeTicks ? formatDurationFromTicks(item.RunTimeTicks) : undefined;
  const subtitle = [year, genre, duration].filter(Boolean).join(" • ");

  return (
    <View style={styles.container}>
      <Image
        source={{ uri: backdropUrl }}
        style={styles.backdropImage}
        contentFit="cover"
        transition={600}
      />

      <LinearGradient
        colors={["transparent", COLORS.background]}
        locations={[0.3, 1.0]}
        style={styles.gradient}
      />

      <View style={[styles.metadataContainer, { left: SPACING.screenPadding }]}>
        <SmartGlassView style={styles.glassPanelStyle}>
          <Text style={styles.title} numberOfLines={2}>
            {item.Name}
          </Text>
          {subtitle.length > 0 && (
            <Text style={styles.subtitle}>{subtitle}</Text>
          )}
          <View style={styles.buttonRow}>
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
          </View>
        </SmartGlassView>

        {items.length > 1 && (
          <View style={styles.dotsRow}>
            {items.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === currentIndex && styles.dotActive,
                ]}
              />
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
    overflow: "hidden",
  },
  backdropImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: HERO_HEIGHT,
  },
  metadataContainer: {
    position: "absolute",
    bottom: 60,
    right: SPACING.screenPadding,
  },
  glassPanelStyle: {
    borderRadius: 20,
    padding: 28,
    maxWidth: 700,
  },
  title: {
    ...TYPOGRAPHY.heroTitle,
    color: COLORS.textPrimary,
    marginBottom: 12,
  },
  subtitle: {
    ...TYPOGRAPHY.heroSubtitle,
    color: COLORS.textSecondary,
    marginBottom: 24,
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
});
