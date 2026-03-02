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

const TV = Platform.isTV;

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

const THUMB_SIZE = TV ? 90 : 56;

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(28,28,30,0.95)',
    borderRadius: TV ? 20 : 16,
    padding: TV ? 32 : 20,
    maxWidth: TV ? 1100 : 600,
    maxHeight: TV ? 800 : 500,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    color: '#FFFFFF',
    fontSize: TV ? 32 : 20,
    fontWeight: '700',
    marginBottom: TV ? 20 : 12,
  },
  list: {
    gap: TV ? 12 : 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: TV ? 20 : 12,
    backgroundColor: '#2C2C2E',
    borderRadius: TV ? 14 : 10,
    padding: TV ? 16 : 12,
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
    borderRadius: TV ? 10 : 6,
  },
  thumbPlaceholder: {
    backgroundColor: '#3A3A3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: TV ? 36 : 24,
  },
  rowInfo: {
    flex: 1,
    gap: TV ? 6 : 4,
  },
  rowHeader: {
    flexDirection: 'row',
    gap: TV ? 10 : 6,
  },
  typeLabel: {
    color: '#FFC312',
    fontSize: TV ? 18 : 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  rowTitle: {
    color: '#FFFFFF',
    fontSize: TV ? 26 : 16,
    fontWeight: '600',
  },
  rowSubtitle: {
    color: '#8E8E93',
    fontSize: TV ? 20 : 13,
  },
});
