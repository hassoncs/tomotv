import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import { z } from "zod";

import { AnimatedProgressBar } from "./AnimatedProgressBar";

export const nowPlayingCardPropsSchema = z.object({
  title: z.string().describe("Title of the currently playing item"),
  seriesName: z.string().optional().describe("TV show name if applicable"),
  seasonEpisode: z.string().optional().describe('Season and episode label e.g. "S02 E05"'),
  positionSeconds: z.number().nonnegative().default(0).describe("Current playback position in seconds"),
  durationSeconds: z.number().nonnegative().default(0).describe("Total duration in seconds"),
  posterUrl: z.string().optional().describe("URL of the poster/thumbnail image"),
  playbackRate: z.number().positive().default(1).describe("Playback speed multiplier (1 = real-time, 2 = 2x). Drives the progress bar forward animation without needing re-renders."),
});

export type NowPlayingCardProps = z.infer<typeof nowPlayingCardPropsSchema>;

const TV = Platform.isTV;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function NowPlayingCard({ title, seriesName, seasonEpisode, positionSeconds = 0, durationSeconds = 0, posterUrl, playbackRate = 1 }: NowPlayingCardProps) {
  const progressFraction = durationSeconds > 0 ? Math.min(positionSeconds / durationSeconds, 1) : 0;
  // Normalized rate: fraction of total progress per second at the given playback speed.
  const progressPerSecond = durationSeconds > 0 ? playbackRate / durationSeconds : undefined;

  return (
    <View style={styles.container}>
      {posterUrl ? <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" /> : <View style={[styles.poster, styles.posterPlaceholder]} />}
      <View style={styles.info}>
        {seriesName && <Text style={styles.series}>{seriesName}</Text>}
        <Text style={styles.title}>{title}</Text>
        {seasonEpisode && <Text style={styles.meta}>{seasonEpisode}</Text>}
        <AnimatedProgressBar progress={progressFraction} progressPerSecond={progressPerSecond} />
        <Text style={styles.time}>
          {formatTime(positionSeconds)} / {formatTime(durationSeconds)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    backgroundColor: "transparent",
    paddingVertical: TV ? 32 : 16,
    gap: TV ? 40 : 16,
    alignItems: "center",
    width: "100%",
  },
  poster: {
    width: TV ? 160 : 80,
    height: TV ? 240 : 120,
    borderRadius: TV ? 16 : 8,
  },
  posterPlaceholder: {
    backgroundColor: "#1C1C1E",
  },
  info: {
    flex: 1,
    gap: TV ? 12 : 6,
  },
  series: {
    color: "#FFC312",
    fontSize: TV ? 24 : 14,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFFFFF",
    fontSize: TV ? 44 : 24,
    fontWeight: "700",
  },
  meta: {
    color: "#8E8E93",
    fontSize: TV ? 24 : 15,
  },
  time: {
    color: "#636366",
    fontSize: TV ? 22 : 14,
  },
});
