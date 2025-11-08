import {
  formatDuration,
  getPosterUrl,
  hasPoster,
} from "@/services/jellyfinApi";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { Image } from "expo-image";
import React, { useCallback, useMemo, useState } from "react";
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface VideoGridItemProps {
  video: JellyfinVideoItem;
  onPress: (video: JellyfinVideoItem) => void;
  index: number;
}

/**
 * VideoGridItem Component
 *
 * Performance optimizations:
 * - Memoized with React.memo() to prevent unnecessary re-renders
 * - Only re-renders when video.Id or index changes
 * - Computed values (posterUrl, duration) are memoized with useMemo
 * - Callbacks (handleFocus, handleBlur, handlePress) are memoized with useCallback
 * - Animated values use lazy initialization pattern for efficiency
 */
function VideoGridItemComponent({ video, onPress, index }: VideoGridItemProps) {
  const [focused, setFocused] = useState(false);
  const scaleAnim = useState(() => new Animated.Value(1))[0];
  const shadowAnim = useState(() => new Animated.Value(0))[0];

  // Memoize computed values to avoid recalculation on every render
  const posterUrl = useMemo(
    () => (hasPoster(video) ? getPosterUrl(video.Id, 600) : undefined),
    [video],
  );

  const duration = useMemo(
    () => formatDuration(video.RunTimeTicks),
    [video.RunTimeTicks],
  );

  // Memoize callbacks to maintain referential stability
  const handleFocus = useCallback(() => {
    setFocused(true);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1.1,
        useNativeDriver: true,
        friction: 7,
        tension: 100,
      }),
      Animated.timing(shadowAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, shadowAnim]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 100,
      }),
      Animated.timing(shadowAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [scaleAnim, shadowAnim]);

  const handlePress = useCallback(() => {
    onPress(video);
  }, [onPress, video]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={0.95}
      isTVSelectable={true}
      hasTVPreferredFocus={index === 0}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.card,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.imageContainer,
            focused && styles.focusedContainer,
            {
              shadowOpacity: shadowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.8],
              }),
            },
          ]}
        >
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              style={styles.poster}
              contentFit="contain"
              transition={200}
              priority="high"
              cachePolicy="memory-disk"
              placeholder={require("@/assets/images/icon.png")}
              placeholderContentFit="contain"
            />
          ) : (
            <View style={styles.placeholderPoster}>
              <Text style={styles.placeholderText}>No Poster</Text>
            </View>
          )}

          {/* Duration Badge */}
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>

          {/* Focus Indicator */}
          {focused && Platform.isTV && <View style={styles.focusIndicator} />}
        </Animated.View>

        {/* Video Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
            {video.Name}
          </Text>
          {video.Genres && video.Genres.length > 0 && (
            <Text style={styles.genre} numberOfLines={1}>
              {video.Genres.slice(0, 2).join(" • ")}
            </Text>
          )}
          {video.CommunityRating && (
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingText}>
                ⭐ {video.CommunityRating.toFixed(1)}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

/**
 * Custom comparison function for React.memo
 * Only re-render when:
 * - video.Id changes (primary key)
 * - video.RunTimeTicks changes (duration display)
 * - index changes (affects hasTVPreferredFocus)
 * - onPress reference changes (should be stable if parent memoizes)
 */
function arePropsEqual(
  prevProps: VideoGridItemProps,
  nextProps: VideoGridItemProps,
): boolean {
  return (
    prevProps.video.Id === nextProps.video.Id &&
    prevProps.video.RunTimeTicks === nextProps.video.RunTimeTicks &&
    prevProps.index === nextProps.index &&
    prevProps.onPress === nextProps.onPress
  );
}

// Export memoized component
export const VideoGridItem = React.memo(VideoGridItemComponent, arePropsEqual);

const styles = StyleSheet.create({
  container: {
    flex: 1 / (Platform.isTV ? 5 : 3),
    padding: Platform.isTV ? 16 : 8,
  },
  card: {
    borderRadius: 32,
    backgroundColor: "transparent",
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 2 / 3, // Standard movie poster aspect ratio
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#1C1C1E",
    shadowColor: "#fff",
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowRadius: 32,
    elevation: 8,
  },
  focusedContainer: {
    // Additional styling for focused state handled by animations
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
  },
  placeholderText: {
    color: "#98989D",
    fontSize: 16,
    fontWeight: "500",
  },
  durationBadge: {
    position: "absolute",
    top: 18,
    right: 28,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 32,
  },
  durationText: {
    color: "#FAC400FF",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  focusIndicator: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 4,
    borderColor: "#FAC400FF",
    borderRadius: 32,
    backgroundColor: "transparent",
  },
  infoContainer: {
    paddingTop: 12,
    paddingHorizontal: 4,
  },
  title: {
    color: "#FFFFFF",
    fontSize: Platform.isTV ? 20 : 16,
    fontWeight: "700",
    marginBottom: 4,
    lineHeight: Platform.isTV ? 26 : 22,
  },
  genre: {
    color: "#98989D",
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  ratingText: {
    color: "#FFD700",
    fontSize: Platform.isTV ? 15 : 13,
    fontWeight: "600",
  },
});
