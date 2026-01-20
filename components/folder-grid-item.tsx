import { DESIGN } from "@/constants/app";
import { getFolderThumbnailUrl } from "@/services/jellyfinApi";
import { JellyfinItem } from "@/types/jellyfin";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

const IS_TV = Platform.isTV;
const CARD_PADDING = IS_TV ? 16 : 8;
const POSTER_SIZE = IS_TV ? 300 : 200;
const NUM_COLUMNS = IS_TV ? 5 : 3;

interface FolderGridItemProps {
  folder: JellyfinItem;
  onPress: (folder: JellyfinItem) => void;
  index: number;
  hasTVPreferredFocus?: boolean;
}

function FolderGridItemComponent({ folder, onPress, index, hasTVPreferredFocus = false }: FolderGridItemProps) {
  const [focused, setFocused] = useState(false);

  const thumbnailUrl = useMemo(() => (folder.ImageTags?.Primary ? getFolderThumbnailUrl(folder.Id, POSTER_SIZE) : undefined), [folder.Id, folder.ImageTags?.Primary]);

  const handleFocus = useCallback(() => {
    setFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setFocused(false);
  }, []);

  const handlePress = useCallback(() => {
    onPress(folder);
  }, [onPress, folder]);

  const itemCount = folder.ChildCount;

  return (
    <TouchableOpacity
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={0.95}
      isTVSelectable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={styles.container}
      accessibilityLabel={folder.Name || "Folder"}
      accessibilityRole="button"
      accessibilityHint={itemCount !== undefined ? `Navigate to ${folder.Name} with ${itemCount} ${itemCount === 1 ? "item" : "items"}` : `Navigate to ${folder.Name}`}>
      <View style={styles.card}>
        <View style={styles.imageContainer}>
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={styles.poster} contentFit="cover" transition={0} priority={index < 10 ? "high" : "normal"} cachePolicy="disk" recyclingKey={folder.Id} />
          ) : (
            <View style={styles.placeholderPoster}>
              <Ionicons name="folder" size={IS_TV ? 80 : 50} color="#FFC312" />
              <Text style={styles.placeholderText} numberOfLines={2}>
                {folder.Name}
              </Text>
            </View>
          )}

          {/* Folder badge indicator - always visible */}
          <View style={styles.folderBadge}>
            <Ionicons name="folder" size={IS_TV ? 20 : 16} color="#FFC312" />
          </View>

          {/* Info overlay - only show on focus like video items */}
          {focused &&
            (thumbnailUrl ? (
              <BlurView intensity={80} style={styles.infoOverlay} tint="dark">
                <Text style={styles.folderName} numberOfLines={2}>
                  {folder.Name}
                </Text>
                {itemCount !== undefined && (
                  <Text style={styles.childCount}>
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </Text>
                )}
              </BlurView>
            ) : (
              <View style={styles.infoOverlayNoBlur}>
                <Text style={styles.folderName} numberOfLines={2}>
                  {folder.Name}
                </Text>
                {itemCount !== undefined && (
                  <Text style={styles.childCount}>
                    {itemCount} {itemCount === 1 ? "item" : "items"}
                  </Text>
                )}
              </View>
            ))}

          <View style={[styles.borderOverlay, focused && styles.borderOverlayFocused]} pointerEvents="none" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function arePropsEqual(prev: FolderGridItemProps, next: FolderGridItemProps): boolean {
  return prev.folder.Id === next.folder.Id && prev.index === next.index && prev.onPress === next.onPress && prev.hasTVPreferredFocus === next.hasTVPreferredFocus;
}

export const FolderGridItem = React.memo(FolderGridItemComponent, arePropsEqual);

const styles = StyleSheet.create({
  container: {
    flex: 1 / NUM_COLUMNS,
    padding: CARD_PADDING,
  },
  card: {
    borderRadius: DESIGN.BORDER_RADIUS_CARD,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: DESIGN.BORDER_RADIUS_CARD,
    overflow: "hidden",
    backgroundColor: "#1C1C1E",
  },
  borderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: DESIGN.BORDER_RADIUS_CARD,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  borderOverlayFocused: {
    borderColor: "rgba(250, 196, 0, 0.5)",
    shadowColor: "#fff",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },
  poster: {
    width: "100%",
    height: "100%",
  },
  placeholderPoster: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1C1C1E",
    padding: IS_TV ? 20 : 12,
  },
  placeholderText: {
    color: "#98989D",
    fontSize: IS_TV ? 16 : 12,
    fontWeight: "600",
    textAlign: "center",
    marginTop: IS_TV ? 16 : 10,
  },
  folderBadge: {
    position: "absolute",
    top: IS_TV ? 16 : 10,
    right: IS_TV ? 16 : 10,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: IS_TV ? DESIGN.BORDER_RADIUS_MEDIUM : DESIGN.BORDER_RADIUS_SMALL,
    padding: IS_TV ? 8 : 6,
  },
  infoOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "35%",
    paddingVertical: IS_TV ? 16 : 12,
    paddingHorizontal: IS_TV ? 20 : 16,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  infoOverlayNoBlur: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "35%",
    paddingVertical: IS_TV ? 16 : 12,
    paddingHorizontal: IS_TV ? 20 : 16,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  folderName: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 16 : 13,
    fontWeight: "700",
    textAlign: "center",
  },
  childCount: {
    color: "#98989D",
    fontSize: IS_TV ? 14 : 11,
    fontWeight: "500",
    marginTop: 4,
  },
});
