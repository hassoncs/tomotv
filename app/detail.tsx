import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Dimensions, FlatList, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { SkiaLibraryBackground } from "@/components/SkiaLibraryBackground";
import { FocusableButton } from "@/components/FocusableButton";
import { useBackground } from "@/contexts/BackgroundContext";
import { useLoading } from "@/contexts/LoadingContext";
import { fetchVideoDetails, formatDuration, getBackdropUrl, getEpisodes, getSeasons, getPosterUrl } from "@/services/jellyfinApi";
import { JellyfinItem, JellyfinVideoItem } from "@/types/jellyfin";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const HERO_HEIGHT = SCREEN_HEIGHT * 0.58;
const IS_TV = Platform.isTV;

// ─── Season pill ────────────────────────────────────────────────────────────

interface SeasonPillProps {
  season: JellyfinItem;
  isSelected: boolean;
  onPress: () => void;
  hasTVPreferredFocus?: boolean;
  accentColor?: string;
}

function SeasonPill({ season, isSelected, onPress, hasTVPreferredFocus, accentColor }: SeasonPillProps) {
  const [focused, setFocused] = useState(false);
  const tint = accentColor ?? "rgba(255,195,18,0.18)";

  return (
    <TouchableOpacity
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      hasTVPreferredFocus={hasTVPreferredFocus}
      isTVSelectable
      activeOpacity={0.85}
      style={[styles.seasonPill, isSelected && { borderColor: accentColor ? "rgba(255,255,255,0.6)" : "#FFC312", borderWidth: 2 }, (focused || isSelected) && { backgroundColor: tint }]}>
      <Text style={[styles.seasonPillText, (isSelected || focused) && styles.seasonPillTextActive]}>{season.Name}</Text>
    </TouchableOpacity>
  );
}

// ─── Episode row ─────────────────────────────────────────────────────────────

interface EpisodeRowProps {
  episode: JellyfinItem;
  onPress: (ep: JellyfinItem) => void;
  accentColor?: string;
}

function EpisodeRow({ episode, onPress, accentColor }: EpisodeRowProps) {
  const [focused, setFocused] = useState(false);
  const thumbUrl = getPosterUrl(episode.Id, 320);
  const tint = accentColor ?? "rgba(255,195,18,0.10)";
  const epNum = episode.IndexNumber != null ? `E${episode.IndexNumber}` : "";

  return (
    <TouchableOpacity
      onPress={() => onPress(episode)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      isTVSelectable
      activeOpacity={0.85}
      style={[styles.episodeRow, focused && { backgroundColor: tint }]}>
      <Image source={{ uri: thumbUrl }} style={styles.episodeThumb} contentFit="cover" cachePolicy="disk" />
      <View style={styles.episodeMeta}>
        <Text style={styles.episodeTitle} numberOfLines={1}>
          {epNum ? `${epNum} · ` : ""}
          {episode.Name}
        </Text>
        {episode.Overview ? (
          <Text style={styles.episodeOverview} numberOfLines={2}>
            {episode.Overview}
          </Text>
        ) : null}
        {episode.RunTimeTicks ? <Text style={styles.episodeDuration}>{formatDuration(episode.RunTimeTicks)}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function DetailScreen() {
  const router = useRouter();
  const { itemId, itemName } = useLocalSearchParams<{ itemId: string; itemName: string }>();
  const { showGlobalLoader } = useLoading();
  const { accentColor, currentImageSource } = useBackground();

  const [item, setItem] = useState<JellyfinVideoItem | null>(null);
  const [seasons, setSeasons] = useState<JellyfinItem[]>([]);
  const [episodes, setEpisodes] = useState<JellyfinItem[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isSeries = item?.Type === "Series";
  // Once item loads use its backdrop; until then fall back to whatever home screen had
  const backdropUrl = item ? (item.BackdropImageTags?.length ? getBackdropUrl(item.Id, 1920) : getPosterUrl(item.Id, 1920)) : undefined;
  const backgroundImageUrl = backdropUrl ?? (currentImageSource && typeof currentImageSource !== "number" ? currentImageSource.uri : undefined);

  // Load item + seasons on mount
  useEffect(() => {
    if (!itemId) return;
    setIsLoading(true);

    fetchVideoDetails(itemId).then(async (detail) => {
      if (!detail) {
        setIsLoading(false);
        return;
      }
      setItem(detail);

      if (detail.Type === "Series") {
        const s = await getSeasons(detail.Id);
        setSeasons(s);
        if (s.length > 0) {
          setSelectedSeasonId(s[0].Id);
        }
      }
      setIsLoading(false);
    });
  }, [itemId]);

  // Load episodes when selected season changes
  useEffect(() => {
    if (!selectedSeasonId || !item || item.Type !== "Series") return;
    getEpisodes(item.Id, selectedSeasonId).then(setEpisodes);
  }, [selectedSeasonId, item]);

  const handlePlay = useCallback(() => {
    if (!item) return;
    showGlobalLoader();
    router.push({ pathname: "/player", params: { videoId: item.Id, videoName: item.Name } });
  }, [item, router, showGlobalLoader]);

  const handleEpisodePlay = useCallback(
    (ep: JellyfinItem) => {
      showGlobalLoader();
      router.push({ pathname: "/player", params: { videoId: ep.Id, videoName: ep.Name } });
    },
    [router, showGlobalLoader],
  );

  const year = item?.ProductionYear ? String(item.ProductionYear) : null;
  const rating = item?.OfficialRating ?? null;
  const duration = item?.RunTimeTicks && !isSeries ? formatDuration(item.RunTimeTicks) : null;
  const genres = item?.Genres?.slice(0, 3) ?? [];
  const synopsis = item?.Overview ?? null;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Full-screen blurred backdrop — same system as home screen */}
      <SkiaLibraryBackground imageUrl={backgroundImageUrl} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} contentInsetAdjustmentBehavior="never">
        <View style={styles.metaPanel}>
          {/* Always show title immediately from route params */}
          <Text style={styles.title} numberOfLines={2}>
            {item?.Name ?? itemName}
          </Text>
          {isLoading ? (
            <ActivityIndicator color="#FFC312" size="small" style={{ marginTop: 20 }} />
          ) : (
            <>
              {/* Pills row */}
              <View style={styles.pillsRow}>
                {year ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{year}</Text>
                  </View>
                ) : null}
                {rating ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{rating}</Text>
                  </View>
                ) : null}
                {duration ? (
                  <View style={styles.pill}>
                    <Text style={styles.pillText}>{duration}</Text>
                  </View>
                ) : null}
                {genres.map((g) => (
                  <View key={g} style={[styles.pill, styles.genrePill]}>
                    <Text style={[styles.pillText, styles.genrePillText]}>{g}</Text>
                  </View>
                ))}
              </View>

              {/* Synopsis */}
              {synopsis ? (
                <Text style={styles.synopsis} numberOfLines={4}>
                  {synopsis}
                </Text>
              ) : null}

              {/* CTA buttons */}
              <View style={styles.ctaRow}>
                <FocusableButton title="▶  Play" variant="primary" hasTVPreferredFocus onPress={handlePlay} />
                <FocusableButton title="✕  Close" variant="secondary" onPress={() => router.back()} />
              </View>
            </>
          )}
        </View>

        {/* Series: season picker + episode list */}
        {!isLoading && isSeries && seasons.length > 0 && (
          <View style={styles.episodesSection}>
            <Text style={styles.sectionTitle}>Episodes</Text>

            {/* Season pills */}
            <FlatList
              data={seasons}
              horizontal
              keyExtractor={(s) => s.Id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.seasonsList}
              renderItem={({ item: season, index }) => (
                <SeasonPill season={season} isSelected={selectedSeasonId === season.Id} onPress={() => setSelectedSeasonId(season.Id)} hasTVPreferredFocus={index === 0} accentColor={accentColor} />
              )}
            />

            {/* Episode rows */}
            {episodes.map((ep) => (
              <EpisodeRow key={ep.Id} episode={ep} onPress={handleEpisodePlay} accentColor={accentColor} />
            ))}
          </View>
        )}

        <View style={{ height: IS_TV ? 200 : 80 }} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0A0A0A",
  },
  scroll: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: IS_TV ? 80 : 20,
    justifyContent: "flex-end",
    paddingBottom: IS_TV ? 80 : 40,
  },
  metaPanel: {
    borderRadius: 24,
    padding: IS_TV ? 40 : 24,
    marginBottom: IS_TV ? 24 : 16,
    backgroundColor: "rgba(10,10,10,0.6)",
  },
  title: {
    fontSize: IS_TV ? 52 : 28,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -1,
    marginBottom: IS_TV ? 16 : 10,
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: IS_TV ? 10 : 6,
    marginBottom: IS_TV ? 20 : 12,
  },
  pill: {
    borderRadius: 999,
    paddingVertical: IS_TV ? 6 : 4,
    paddingHorizontal: IS_TV ? 18 : 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  pillText: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 20 : 13,
    fontWeight: "600",
  },
  genrePill: {
    backgroundColor: "rgba(255,195,18,0.12)",
    borderColor: "rgba(255,195,18,0.3)",
  },
  genrePillText: {
    color: "#FFC312",
  },
  synopsis: {
    fontSize: IS_TV ? 22 : 15,
    color: "rgba(255,255,255,0.75)",
    lineHeight: IS_TV ? 34 : 22,
    marginBottom: IS_TV ? 32 : 20,
  },
  ctaRow: {
    flexDirection: "row",
    gap: IS_TV ? 20 : 12,
    flexWrap: "wrap",
  },

  // ── Episodes section ────────────────────────────────────────────────────
  episodesSection: {
    marginTop: IS_TV ? 12 : 8,
  },
  sectionTitle: {
    fontSize: IS_TV ? 32 : 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: IS_TV ? 20 : 12,
    letterSpacing: -0.5,
  },
  seasonsList: {
    paddingBottom: IS_TV ? 20 : 12,
    gap: IS_TV ? 12 : 8,
    flexDirection: "row",
  },
  seasonPill: {
    borderRadius: 999,
    paddingVertical: IS_TV ? 10 : 6,
    paddingHorizontal: IS_TV ? 28 : 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 2,
    borderColor: "transparent",
  },
  seasonPillText: {
    color: "rgba(255,255,255,0.65)",
    fontSize: IS_TV ? 22 : 14,
    fontWeight: "600",
  },
  seasonPillTextActive: {
    color: "#FFFFFF",
  },

  // ── Episode rows ────────────────────────────────────────────────────────
  episodeRow: {
    flexDirection: "row",
    gap: IS_TV ? 24 : 14,
    paddingVertical: IS_TV ? 16 : 10,
    paddingHorizontal: IS_TV ? 16 : 10,
    borderRadius: 16,
    marginBottom: IS_TV ? 4 : 2,
    alignItems: "flex-start",
  },
  episodeThumb: {
    width: IS_TV ? 200 : 120,
    aspectRatio: 16 / 9,
    borderRadius: 10,
    backgroundColor: "#1C1C1E",
  },
  episodeMeta: {
    flex: 1,
    paddingTop: IS_TV ? 4 : 2,
  },
  episodeTitle: {
    fontSize: IS_TV ? 22 : 15,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: IS_TV ? 8 : 4,
  },
  episodeOverview: {
    fontSize: IS_TV ? 18 : 13,
    color: "rgba(255,255,255,0.6)",
    lineHeight: IS_TV ? 26 : 18,
    marginBottom: IS_TV ? 8 : 4,
  },
  episodeDuration: {
    fontSize: IS_TV ? 18 : 12,
    color: "rgba(255,255,255,0.4)",
    fontWeight: "500",
  },
});
