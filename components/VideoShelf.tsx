import { SmartGlassView } from "@/components/SmartGlassView";
import { COLORS, SPACING, TYPOGRAPHY } from "@/constants/theme";
import { getPosterUrl, hasPoster } from "@/services/jellyfinApi";
import { JellyfinItem } from "@/types/jellyfin";
import { Image } from "expo-image";
import { MarqueeText } from "@/components/MarqueeText";
import React, { useCallback, useState } from "react";
import { Dimensions, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const IS_TV = Platform.isTV;
const { width: SCREEN_WIDTH } = Dimensions.get("window");
void SCREEN_WIDTH;

const POSTER_CARD_WIDTH = IS_TV ? 200 : 130;
const LANDSCAPE_CARD_WIDTH = IS_TV ? 350 : 220;

interface ShelfCardProps {
  item: JellyfinItem;
  onPress: (item: JellyfinItem) => void;
  cardStyle: "poster" | "landscape";
  index: number;
}

function ShelfCard({ item, onPress, cardStyle, index }: ShelfCardProps) {
  const [focused, setFocused] = useState(false);

  const cardWidth = cardStyle === "poster" ? POSTER_CARD_WIDTH : LANDSCAPE_CARD_WIDTH;
  const aspectRatio = cardStyle === "poster" ? 2 / 3 : 16 / 9;
  const posterSize = cardStyle === "poster" ? POSTER_CARD_WIDTH : LANDSCAPE_CARD_WIDTH;
  const posterUrl = hasPoster(item) ? getPosterUrl(item.Id, posterSize) : undefined;

  const handlePress = useCallback(() => {
    onPress(item);
  }, [onPress, item]);

  const handleFocus = useCallback(() => {
    setFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
  }, []);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={0.9}
      isTVSelectable={true}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={item.Name || "Media item"}
      style={[styles.cardContainer, { width: cardWidth }]}>
      <View
        style={[
          styles.card,
          { aspectRatio, backgroundColor: COLORS.backgroundCard },
          focused ? styles.cardFocused : styles.cardUnfocused,
        ]}>
        {posterUrl ? (
          <Image
            source={{ uri: posterUrl }}
            style={styles.cardImage}
            contentFit="cover"
            priority={index < 8 ? "high" : "normal"}
            cachePolicy="disk"
            recyclingKey={item.Id}
          />
        ) : (
          <View style={styles.placeholderImage}>
            <Text style={styles.placeholderIcon}>▶</Text>
          </View>
        )}

        {focused && (
          <SmartGlassView style={styles.infoOverlay}>
            <MarqueeText active={focused} style={styles.infoTitle}>
              {item.Name || "Unknown"}
            </MarqueeText>
          </SmartGlassView>
        )}
      </View>
    </TouchableOpacity>
  );
}

interface VideoShelfProps {
  title: string;
  items: JellyfinItem[];
  onItemPress: (item: JellyfinItem) => void;
  cardStyle?: "poster" | "landscape";
}

export function VideoShelf({ title, items, onItemPress, cardStyle = "poster" }: VideoShelfProps) {
  const renderItem = useCallback(
    ({ item, index }: { item: JellyfinItem; index: number }) => (
      <ShelfCard item={item} onPress={onItemPress} cardStyle={cardStyle} index={index} />
    ),
    [onItemPress, cardStyle],
  );

  const keyExtractor = useCallback((item: JellyfinItem) => item.Id, []);

  return (
    <View style={styles.container}>
      <Text style={[TYPOGRAPHY.sectionTitle, styles.sectionTitle]}>{title}</Text>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        horizontal={true}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingLeft: IS_TV ? SPACING.screenPadding : 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  listContent: {
    paddingLeft: IS_TV ? SPACING.screenPadding : 16,
    paddingRight: 40,
    gap: SPACING.shelfItemGap,
  },
  cardContainer: {
    // width set inline per cardStyle
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 2,
  },
  cardFocused: {
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 16,
    shadowOpacity: 0.3,
    elevation: 8,
  },
  cardUnfocused: {
    borderColor: COLORS.borderSubtle,
  },
  cardImage: {
    width: "100%",
    height: "100%",
  },
  placeholderImage: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderIcon: {
    fontSize: IS_TV ? 36 : 24,
    color: COLORS.textSecondary,
  },
  infoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: IS_TV ? 14 : 10,
    paddingHorizontal: IS_TV ? 16 : 12,
    justifyContent: "center",
    alignItems: "center",
  },
  infoTitle: {
    color: COLORS.textPrimary,
    fontSize: IS_TV ? 24 : 13,
    fontWeight: "700",
    textAlign: "center",
    width: "100%",
  },
});
