import React, { useState } from 'react';
import { View, Text, Image, FlatList, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { z } from 'zod';

export const movieGridPropsSchema = z.object({
  movies: z.array(z.object({
    id: z.string().describe('Jellyfin item ID'),
    title: z.string().describe('Movie title'),
    year: z.number().optional().describe('Release year'),
    rating: z.number().optional().describe('Rotten Tomatoes score 0-100'),
    posterUrl: z.string().optional().describe('Poster image URL'),
  })).describe('Array of movies to display in a grid'),
  columns: z.number().int().min(1).max(8).default(4).describe('Number of columns in the grid'),
  onSelectId: z.string().optional().describe('Jellyfin item ID pre-selected (unused at render time)'),
});

export type MovieGridProps = z.infer<typeof movieGridPropsSchema>;
export type MovieGridItem = MovieGridProps['movies'][number];

const TV = Platform.isTV;
const CARD_WIDTH = TV ? 240 : 140;

export function MovieGrid({ movies, columns = 4 }: MovieGridProps) {
  const [focusedId, setFocusedId] = useState<string | null>(null);

  const renderItem = ({ item }: { item: MovieGridItem }) => {
    const isFocused = focusedId === item.id;
    return (
      <TouchableOpacity
        style={[styles.card, isFocused && styles.cardFocused]}
        onFocus={() => setFocusedId(item.id)}
        onBlur={() => setFocusedId(null)}
        isTVSelectable
        activeOpacity={0.8}
      >
        {item.posterUrl ? (
          <Image source={{ uri: item.posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]} />
        )}
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {(item.year || item.rating !== undefined) && (
          <Text style={styles.meta}>
            {[item.year, item.rating !== undefined ? `${item.rating}%` : null].filter(Boolean).join(' · ')}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={movies}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        renderItem={renderItem}
        contentContainerStyle={styles.grid}
        scrollEnabled={movies.length > columns * 2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(28,28,30,0.95)',
    borderRadius: TV ? 20 : 16,
    padding: TV ? 32 : 20,
    maxHeight: TV ? 800 : 500,
  },
  grid: {
    gap: TV ? 20 : 12,
  },
  card: {
    width: CARD_WIDTH,
    marginHorizontal: TV ? 12 : 8,
    borderRadius: TV ? 14 : 10,
    overflow: 'hidden',
    backgroundColor: '#2C2C2E',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardFocused: {
    borderColor: '#FFC312',
  },
  poster: {
    width: CARD_WIDTH,
    height: CARD_WIDTH * 1.5,
  },
  posterPlaceholder: {
    backgroundColor: '#3A3A3C',
  },
  title: {
    color: '#FFFFFF',
    fontSize: TV ? 22 : 13,
    fontWeight: '600',
    padding: TV ? 12 : 8,
  },
  meta: {
    color: '#8E8E93',
    fontSize: TV ? 18 : 11,
    paddingHorizontal: TV ? 12 : 8,
    paddingBottom: TV ? 12 : 8,
  },
});
