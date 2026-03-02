import React, { useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { z } from 'zod';

import { remoteBridgeService } from '@/services/remoteBridgeService';

const seasonSchema = z.object({
  seasonNumber: z.number().int().min(0).describe('Season number (0 = Specials)'),
  episodeCount: z.number().int().optional().describe('Number of episodes in the season'),
  id: z.string().optional().describe('Jellyfin season item ID'),
});

const actionSchema = z.object({
  actionId: z.string().describe('Unique action identifier emitted on press'),
  label: z.string().describe('Button label text'),
});

export const seriesDetailPropsSchema = z.object({
  seriesId: z.string().describe('Jellyfin series item ID'),
  title: z.string().describe('Series title'),
  overview: z.string().optional().describe('Series description / synopsis'),
  posterUrl: z.string().optional().describe('Poster image URL'),
  year: z.number().int().optional().describe('Production year'),
  rating: z.string().optional().describe('Content rating, e.g. "TV-MA"'),
  communityRating: z.number().optional().describe('Average community rating out of 10'),
  seasons: z.array(seasonSchema).describe('List of seasons to display'),
  actions: z.array(actionSchema).optional().describe('Additional action buttons'),
  component: z.string().default('SeriesDetail').describe('Component name for event routing'),
});

export type SeriesDetailProps = z.infer<typeof seriesDetailPropsSchema>;
type Season = z.infer<typeof seasonSchema>;
type Action = z.infer<typeof actionSchema>;

const TV = Platform.isTV;

export function SeriesDetail({
  seriesId,
  title,
  overview,
  posterUrl,
  year,
  rating,
  communityRating,
  seasons,
  actions = [],
  component = 'SeriesDetail',
}: SeriesDetailProps) {
  const [focusedSeasonId, setFocusedSeasonId] = useState<string | null>(null);
  const [focusedActionId, setFocusedActionId] = useState<string | null>(null);

  const handleSeasonPress = (season: Season) => {
    const itemId = season.id ?? `${seriesId}:S${season.seasonNumber}`;
    remoteBridgeService.emitUiSelect({
      component,
      itemId,
      itemType: 'Season',
      title: season.seasonNumber === 0 ? 'Specials' : `Season ${season.seasonNumber}`,
    });
  };

  const handleActionPress = (action: Action) => {
    remoteBridgeService.emitUiAction({ component, actionId: action.actionId });
  };

  const renderSeason = ({ item }: { item: Season }) => {
    const key = item.id ?? String(item.seasonNumber);
    const isFocused = focusedSeasonId === key;
    const label = item.seasonNumber === 0 ? 'Specials' : `Season ${item.seasonNumber}`;
    const epCount = item.episodeCount ? `${item.episodeCount} episodes` : '';

    return (
      <TouchableOpacity
        style={[styles.seasonRow, isFocused && styles.seasonRowFocused]}
        onPress={() => handleSeasonPress(item)}
        onFocus={() => setFocusedSeasonId(key)}
        onBlur={() => setFocusedSeasonId(null)}
        isTVSelectable
        activeOpacity={0.8}
      >
        <Text style={styles.seasonLabel}>{label}</Text>
        {epCount ? <Text style={styles.seasonEpCount}>{epCount}</Text> : null}
        <Text style={styles.seasonChevron}>›</Text>
      </TouchableOpacity>
    );
  };

  const metaParts: string[] = [];
  if (year) metaParts.push(String(year));
  if (rating) metaParts.push(rating);
  if (communityRating) metaParts.push(`★ ${communityRating.toFixed(1)}`);

  return (
    <View style={styles.container}>
      {/* Header row: poster + info */}
      <View style={styles.header}>
        {posterUrl ? (
          <Image source={{ uri: posterUrl }} style={styles.poster} resizeMode="cover" />
        ) : (
          <View style={[styles.poster, styles.posterPlaceholder]} />
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{title}</Text>
          {metaParts.length > 0 && (
            <Text style={styles.meta}>{metaParts.join('  ·  ')}</Text>
          )}
          {overview ? (
            <Text style={styles.overview} numberOfLines={4}>{overview}</Text>
          ) : null}

          {/* Action buttons */}
          {actions.length > 0 && (
            <View style={styles.actionsRow}>
              {actions.map((action) => (
                <TouchableOpacity
                  key={action.actionId}
                  style={[
                    styles.actionBtn,
                    focusedActionId === action.actionId && styles.actionBtnFocused,
                  ]}
                  onPress={() => handleActionPress(action)}
                  onFocus={() => setFocusedActionId(action.actionId)}
                  onBlur={() => setFocusedActionId(null)}
                  isTVSelectable
                  activeOpacity={0.8}
                >
                  <Text style={styles.actionText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>

      {/* Season list */}
      {seasons.length > 0 && (
        <>
          <Text style={styles.seasonsHeader}>Seasons</Text>
          <FlatList
            data={seasons}
            keyExtractor={(s) => s.id ?? String(s.seasonNumber)}
            renderItem={renderSeason}
            scrollEnabled={seasons.length > 4}
            contentContainerStyle={styles.seasonList}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: TV ? 40 : 24,
    gap: TV ? 28 : 18,
    maxWidth: 1100,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    gap: TV ? 32 : 20,
    alignItems: 'flex-start',
  },
  poster: {
    width: TV ? 160 : 100,
    height: TV ? 240 : 150,
    borderRadius: 12,
  },
  posterPlaceholder: {
    backgroundColor: '#3A3A3C',
  },
  info: {
    flex: 1,
    gap: TV ? 12 : 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: TV ? 40 : 26,
    fontWeight: '700',
    lineHeight: TV ? 50 : 34,
  },
  meta: {
    color: '#8E8E93',
    fontSize: TV ? 20 : 14,
    fontWeight: '500',
  },
  overview: {
    color: '#D1D1D6',
    fontSize: TV ? 22 : 15,
    lineHeight: TV ? 34 : 22,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
    marginTop: TV ? 8 : 4,
  },
  actionBtn: {
    paddingVertical: TV ? 14 : 10,
    paddingHorizontal: TV ? 36 : 22,
    backgroundColor: '#FFC312',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  actionBtnFocused: {
    borderColor: '#FFFFFF',
    backgroundColor: '#FFD60A',
  },
  actionText: {
    color: '#000000',
    fontSize: TV ? 22 : 15,
    fontWeight: '700',
  },
  seasonsHeader: {
    color: '#FFFFFF',
    fontSize: TV ? 28 : 18,
    fontWeight: '700',
  },
  seasonList: {
    gap: TV ? 8 : 6,
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingVertical: TV ? 18 : 12,
    paddingHorizontal: TV ? 24 : 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  seasonRowFocused: {
    borderColor: '#FFC312',
    backgroundColor: '#3A3A3C',
  },
  seasonLabel: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: TV ? 26 : 17,
    fontWeight: '600',
  },
  seasonEpCount: {
    color: '#8E8E93',
    fontSize: TV ? 20 : 13,
    marginRight: TV ? 16 : 10,
  },
  seasonChevron: {
    color: '#636366',
    fontSize: TV ? 28 : 20,
    fontWeight: '300',
  },
});
