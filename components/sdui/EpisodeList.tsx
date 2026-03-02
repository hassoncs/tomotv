import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { z } from 'zod';

import { remoteBridgeService } from '@/services/remoteBridgeService';

const episodeSchema = z.object({
  id: z.string().describe('Jellyfin episode item ID'),
  episodeNumber: z.number().optional().describe('Episode number within the season'),
  seasonNumber: z.number().optional().describe('Season number'),
  title: z.string().describe('Episode title'),
  overview: z.string().optional().describe('Short description of the episode'),
  durationMinutes: z.number().optional().describe('Duration in minutes'),
});

export const episodeListPropsSchema = z.object({
  episodes: z.array(episodeSchema).describe('List of episodes to display'),
  seriesTitle: z.string().optional().describe('Series name shown as header'),
  component: z.string().default('EpisodeList').describe('Component name for event routing'),
});

export type EpisodeListProps = z.infer<typeof episodeListPropsSchema>;
export type Episode = z.infer<typeof episodeSchema>;

export function EpisodeList({ episodes, seriesTitle, component = 'EpisodeList' }: EpisodeListProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const handlePress = (episode: Episode) => {
    remoteBridgeService.emitUiSelect({
      component,
      itemId: episode.id,
      itemType: 'Episode',
      title: episode.title,
    });
  };

  const renderItem = ({ item }: { item: Episode }) => {
    const isFocused = focusedId === item.id;
    const epLabel = item.seasonNumber !== undefined && item.episodeNumber !== undefined
      ? `S${item.seasonNumber}E${item.episodeNumber}`
      : item.episodeNumber !== undefined ? `E${item.episodeNumber}` : '';

    return (
      <TouchableOpacity
        style={[styles.row, isFocused && styles.rowFocused]}
        onPress={() => handlePress(item)}
        onFocus={() => setFocusedId(item.id)}
        onBlur={() => setFocusedId(null)}
        isTVSelectable
        activeOpacity={0.8}
      >
        {epLabel ? <Text style={styles.epLabel}>{epLabel}</Text> : null}
        <View style={styles.rowInfo}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          {item.overview ? (
            <Text style={styles.rowOverview} numberOfLines={2}>{item.overview}</Text>
          ) : null}
        </View>
        {item.durationMinutes ? (
          <Text style={styles.duration}>{item.durationMinutes}m</Text>
        ) : null}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {seriesTitle ? <Text style={styles.header}>{seriesTitle}</Text> : null}
      <FlatList
        data={episodes}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        scrollEnabled
      />
    </View>
  );
}

const TV = Platform.isTV;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(28,28,30,0.97)',
    borderRadius: 20,
    padding: TV ? 32 : 20,
    maxHeight: TV ? 700 : 500,
  },
  header: {
    color: '#FFFFFF',
    fontSize: TV ? 36 : 24,
    fontWeight: '700',
    marginBottom: TV ? 20 : 12,
  },
  list: {
    gap: TV ? 8 : 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TV ? 20 : 12,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: TV ? 20 : 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowFocused: {
    borderColor: '#FFC312',
    backgroundColor: '#3A3A3C',
  },
  epLabel: {
    color: '#FFC312',
    fontSize: TV ? 22 : 14,
    fontWeight: '700',
    minWidth: TV ? 80 : 56,
  },
  rowInfo: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: TV ? 26 : 17,
    fontWeight: '600',
  },
  rowOverview: {
    color: '#8E8E93',
    fontSize: TV ? 20 : 13,
  },
  duration: {
    color: '#8E8E93',
    fontSize: TV ? 20 : 13,
  },
});
