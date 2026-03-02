import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { z } from 'zod';

export const nowPlayingCardPropsSchema = z.object({
  title: z.string().describe('Title of the currently playing item'),
  seriesName: z.string().optional().describe('TV show name if applicable'),
  seasonEpisode: z.string().optional().describe('Season and episode label e.g. "S02 E05"'),
  positionSeconds: z.number().nonnegative().default(0).describe('Current playback position in seconds'),
  durationSeconds: z.number().nonnegative().default(0).describe('Total duration in seconds'),
  posterUrl: z.string().optional().describe('URL of the poster/thumbnail image'),
});

export type NowPlayingCardProps = z.infer<typeof nowPlayingCardPropsSchema>;

const TV = Platform.isTV;

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function NowPlayingCard({
  title,
  seriesName,
  seasonEpisode,
  positionSeconds = 0,
  durationSeconds = 0,
  posterUrl,
}: NowPlayingCardProps) {
  const progress = durationSeconds > 0 ? Math.min(positionSeconds / durationSeconds, 1) : 0;

  return (
    <View style={styles.container}>
      {posterUrl ? (
        <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
      ) : (
        <View style={[styles.poster, styles.posterPlaceholder]} />
      )}
      <View style={styles.info}>
        {seriesName && <Text style={styles.series}>{seriesName}</Text>}
        <Text style={styles.title}>{title}</Text>
        {seasonEpisode && <Text style={styles.meta}>{seasonEpisode}</Text>}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.time}>
          {formatTime(positionSeconds)} / {formatTime(durationSeconds)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'rgba(28,28,30,0.95)',
    borderRadius: TV ? 20 : 16,
    padding: TV ? 32 : 20,
    gap: TV ? 28 : 16,
    alignItems: 'center',
    maxWidth: TV ? 1100 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
  poster: {
    width: TV ? 140 : 80,
    height: TV ? 210 : 120,
    borderRadius: TV ? 12 : 8,
  },
  posterPlaceholder: {
    backgroundColor: '#3A3A3C',
  },
  info: {
    flex: 1,
    gap: TV ? 10 : 6,
  },
  series: {
    color: '#FFC312',
    fontSize: TV ? 22 : 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  title: {
    color: '#FFFFFF',
    fontSize: TV ? 36 : 24,
    fontWeight: '700',
  },
  meta: {
    color: '#8E8E93',
    fontSize: TV ? 22 : 15,
  },
  progressBar: {
    height: TV ? 6 : 4,
    backgroundColor: '#3A3A3C',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: TV ? 12 : 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFC312',
    borderRadius: 3,
  },
  time: {
    color: '#636366',
    fontSize: TV ? 20 : 14,
  },
});
