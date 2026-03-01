import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
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
    borderRadius: 20,
    padding: 24,
    gap: 24,
    alignItems: 'center',
    maxWidth: 900,
    alignSelf: 'center',
  },
  poster: {
    width: 100,
    height: 150,
    borderRadius: 8,
  },
  posterPlaceholder: {
    backgroundColor: '#3A3A3C',
  },
  info: {
    flex: 1,
    gap: 8,
  },
  series: {
    color: '#FFC312',
    fontSize: 18,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },
  meta: {
    color: '#8E8E93',
    fontSize: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#3A3A3C',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFC312',
    borderRadius: 2,
  },
  time: {
    color: '#636366',
    fontSize: 18,
  },
});
