import React, { useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, Platform } from 'react-native';
import { z } from 'zod';
import { useRouter } from 'expo-router';

import { VideoGridItem } from '@/components/video-grid-item';
import type { JellyfinVideoItem } from '@/types/jellyfin';
import { isFolder } from '@/services/jellyfinApi';
import { useFolderNavigation } from '@/contexts/FolderNavigationContext';
import { useLoading } from '@/contexts/LoadingContext';
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
  ParentId: z.string().optional(),
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
  const router = useRouter();
  const { showGlobalLoader } = useLoading();
  const { navigateToFolder } = useFolderNavigation();

  const handlePress = useCallback(
    (video: JellyfinVideoItem) => {
      // Always notify the relay so the bot is passively informed.
      remoteBridgeService.emitUiSelect({
        component: 'MediaGrid',
        itemId: video.Id,
        itemType: video.Type,
        title: video.Name,
      });
      onSelect?.(video.Id);

      // Native navigation — same behaviour as the Library screen.
      if (isFolder(video as any)) {
        navigateToFolder({
          id: video.Id,
          name: video.Name,
          parentId: (video as any).ParentId,
          type: video.Type === 'Playlist' ? 'playlist' : 'folder',
        });
      } else {
        showGlobalLoader();
        router.push({
          pathname: '/player' as const,
          params: { videoId: video.Id, videoName: video.Name },
        });
      }
    },
    [router, showGlobalLoader, navigateToFolder, onSelect],
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
        scrollEnabled={false}
        removeClippedSubviews={false}
      />
        scrollEnabled={false}
        removeClippedSubviews={false}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    color: '#FFFFFF',
    fontSize: Platform.isTV ? 36 : 24,
    fontWeight: '700',
    marginBottom: Platform.isTV ? 20 : 12,
    paddingHorizontal: 8,
  },
  grid: {
    paddingBottom: Platform.isTV ? 48 : 24,
  },
});
