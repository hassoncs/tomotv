import React, { useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { z } from 'zod';

export const searchResultsPropsSchema = z.object({
  results: z.array(z.object({
    id: z.string().describe('Jellyfin item ID'),
    type: z.enum(['Movie', 'Series', 'Episode', 'Audio', 'MusicAlbum']).describe('Media type'),
    title: z.string().describe('Item title'),
    subtitle: z.string().optional().describe('Secondary info e.g. year, series name, episode number'),
    thumbnailUrl: z.string().optional().describe('Thumbnail image URL'),
  })).describe('Mixed-type search results to display as a list'),
  title: z.string().optional().default('Results').describe('Header title for the results list'),
});

export type SearchResultsProps = z.infer<typeof searchResultsPropsSchema>;
export type SearchResultItem = SearchResultsProps['results'][number];

const TYPE_ICONS: Record<SearchResultItem['type'], string> = {
  Movie: '🎬',
  Series: '📺',
  Episode: '▶️',
  Audio: '🎵',
  MusicAlbum: '💿',
};

export function SearchResults({ results, title = 'Results' }: SearchResultsProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const renderItem = ({ item }: { item: SearchResultItem }) => {
    const isFocused = focusedId === item.id;
    return (
      <TouchableOpacity
        style={[styles.row, isFocused && styles.rowFocused]}
        onFocus={() => setFocusedId(item.id)}
        onBlur={() => setFocusedId(null)}
        isTVSelectable
        activeOpacity={0.8}
      >
        {item.thumbnailUrl ? (
          <Image source={{ uri: item.thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Text style={styles.typeIcon}>{TYPE_ICONS[item.type] ?? '🎬'}</Text>
          </View>
        )}
        <View style={styles.rowInfo}>
          <View style={styles.rowHeader}>
            <Text style={styles.typeLabel}>{item.type}</Text>
          </View>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
          {item.subtitle && <Text style={styles.rowSubtitle} numberOfLines={1}>{item.subtitle}</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {title && <Text style={styles.header}>{title}</Text>}
      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        scrollEnabled
      />
    </View>
  );
}

const THUMB_SIZE = Platform.isTV ? 80 : 56;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(28,28,30,0.95)',
    borderRadius: 20,
    padding: 24,
    maxWidth: 800,
    maxHeight: 600,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    color: '#FFFFFF',
    fontSize: Platform.isTV ? 28 : 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  list: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#2C2C2E',
    borderRadius: 10,
    padding: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowFocused: {
    borderColor: '#FFC312',
    backgroundColor: '#3A3A3C',
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 6,
  },
  thumbPlaceholder: {
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 28,
  },
  rowInfo: {
    flex: 1,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    gap: 8,
  },
  typeLabel: {
    color: '#FFC312',
    fontSize: Platform.isTV ? 16 : 12,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: Platform.isTV ? 22 : 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: '#8E8E93',
    fontSize: Platform.isTV ? 18 : 13,
  },
});
