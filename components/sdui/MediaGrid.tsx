import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Platform } from 'react-native';
import { z } from 'zod';

import { VideoGridItem } from '@/components/video-grid-item';
import type { JellyfinVideoItem } from '@/types/jellyfin';
import { remoteBridgeService } from '@/services/remoteBridgeService';

// Minimal Zod schema for a Jellyfin item as received from the bridge.
// Only Id and Name are required; everything else is optional to keep the bot
// prompt payload lean while remaining compatible with VideoGridItem.
const mediaGridItemSchema = z.object({
  Id: z.string().min(1),
  Name: z.string(),
  RunTimeTicks: z.number().default(0),
  Type: z.string().default('Movie'),
  Path: z.string().default(''),
  MediaStreams: z.array(z.unknown()).optional(),
  MediaSources: z.array(z.unknown()).optional(),
  Overview: z.string().optional(),
  PremiereDate: z.string().optional(),
  ProductionYear: z.number().optional(),
  CommunityRating: z.number().optional(),
  OfficialRating: z.string().optional(),
  Genres: z.array(z.string()).optional(),
  SeriesName: z.string().optional(),
  SeasonName: z.string().optional(),
  IndexNumber: z.number().optional(),
  ParentIndexNumber: z.number().optional(),
  ImageTags: z.object({ Primary: z.string().optional() }).optional(),
  PrimaryImageAspectRatio: z.number().optional(),
});

export const mediaGridPropsSchema = z.object({
  items: z.array(mediaGridItemSchema).describe('Jellyfin video items to display in the grid'),
  title: z.string().optional().describe('Optional header title displayed above the grid'),
  columns: z.number().int().min(1).max(8).default(5).describe('Number of grid columns'),
  onSelectId: z.string().optional().describe('Pre-selected item ID (informational, unused at render)'),
});

export type MediaGridProps = z.infer<typeof mediaGridPropsSchema> & {
  onSelect?: (itemId: string) => void;
};

export function MediaGrid({ items, title, columns = 5, onSelect }: MediaGridProps) {
  const handlePress = useCallback(
    (video: JellyfinVideoItem) => {
      remoteBridgeService.emitUiSelect({
        component: 'MediaGrid',
        itemId: video.Id,
        itemType: video.Type,
        title: video.Name,
      });
      onSelect?.(video.Id);
    },
    [onSelect]
  );

  return (
    <View style={styles.container}>
      {title ? <Text style={styles.header}>{title}</Text> : null}
      <FlatList
        data={items as JellyfinVideoItem[]}
        keyExtractor={(item) => item.Id}
        numColumns={columns}
        renderItem={({ item, index }) => (
          <VideoGridItem
            video={item}
            onPress={handlePress}
            index={index}
          />
        )}
        contentContainerStyle={styles.grid}
        scrollEnabled={items.length > columns * 2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  header: {
    color: '#FFFFFF',
    fontSize: Platform.isTV ? 36 : 24,
    fontWeight: '700',
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  grid: {
    paddingBottom: 32,
  },
});
