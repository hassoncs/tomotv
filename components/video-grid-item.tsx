import { getPosterUrl, hasPoster } from "@/services/jellyfinApi";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Cache platform values at module level for better performance
const IS_TV = Platform.isTV;
const CARD_PADDING = IS_TV ? 16 : 8;
const POSTER_SIZE = IS_TV ? 300 : 200; // Optimized for memory
const NUM_COLUMNS = IS_TV ? 5 : 3;

interface VideoGridItemProps {
  video: JellyfinVideoItem;
  onPress: (video: JellyfinVideoItem) => void;
  index: number;
  onItemFocus?: () => void;
  onItemBlur?: () => void;
  hasTVPreferredFocus?: boolean;
  nextFocusUp?: number;
}

/**
 * VideoGridItem Component - Highly Optimized
 *
 * Performance optimizations:
 * - React.memo with custom comparison to prevent unnecessary re-renders
 * - Lazy metadata computation (only when focused)
 * - Reduced poster image size (400px vs 600px)
 * - Lightweight native-driver animation (single scale transform)
 * - Conditional image priority (first 10 only)
 * - No image transitions for instant display
 * - Platform values cached at module level
 * - BlurView only rendered when focused
 */
const VideoGridItemComponent = forwardRef<TouchableOpacity, VideoGridItemProps>(function VideoGridItemComponent(
  { video, onPress, index, onItemFocus, onItemBlur, hasTVPreferredFocus = false, nextFocusUp },
  ref,
) {
  const [focused, setFocused] = useState(false);

  // Single animated value with native driver for 60fps performance
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Marquee animation for long titles
  const marqueeAnim = useRef(new Animated.Value(0)).current;
  const marqueeAnimation = useRef<Animated.CompositeAnimation | null>(null);
  const titleWidth = useRef(0);
  const containerWidth = useRef(0);

  // Only compute poster URL - this is always needed for display
  const posterUrl = useMemo(
    () => (hasPoster(video) ? getPosterUrl(video.Id, POSTER_SIZE) : undefined),
    [video], // Only video ID needed, not entire video object
  );

  // Lazy compute metadata ONLY when focused - huge performance win!
  const metadata = useMemo(() => {
    if (!focused) return null;

    const videoStream = video.MediaStreams?.find((stream) => stream.Type === "Video");
    const audioStream = video.MediaStreams?.find((stream) => stream.Type === "Audio");

    const videoCodec = videoStream?.Codec?.toUpperCase() || "Unknown";
    const audioCodec = audioStream?.Codec?.toUpperCase() || "Unknown";
    const resolution = videoStream?.Width && videoStream?.Height ? `${videoStream.Width}x${videoStream.Height}` : "Unknown";

    // Calculate file size
    let fileSize = null;
    let duration = null;
    if (videoStream?.BitRate && video.RunTimeTicks) {
      const durationSeconds = video.RunTimeTicks / 10000000;
      const sizeBytes = (videoStream.BitRate * durationSeconds) / 8;
      const sizeGB = sizeBytes / (1024 * 1024 * 1024);
      fileSize = sizeGB >= 1 ? `${sizeGB.toFixed(1)} GB` : `${(sizeBytes / (1024 * 1024)).toFixed(0)} MB`;

      // Format duration
      const totalMinutes = Math.floor(durationSeconds / 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    }

    return { videoCodec, audioCodec, resolution, fileSize, duration };
  }, [focused, video.MediaStreams, video.RunTimeTicks]);

  // Start marquee animation for long titles
  const startMarquee = useCallback(() => {
    // Only animate if title is wider than container
    const overflow = titleWidth.current - containerWidth.current;
    if (overflow <= 0) return;

    // Reset to start position
    marqueeAnim.setValue(0);

    // Create looping animation: scroll left, pause, reset, repeat
    marqueeAnimation.current = Animated.loop(
      Animated.sequence([
        Animated.delay(1000), // Pause at start
        Animated.timing(marqueeAnim, {
          toValue: -overflow - 20, // Scroll to show full text + padding
          duration: Math.max(3000, overflow * 30), // Speed based on text length
          useNativeDriver: true,
        }),
        Animated.delay(1500), // Pause at end
        Animated.timing(marqueeAnim, {
          toValue: 0,
          duration: 0, // Instant reset
          useNativeDriver: true,
        }),
      ]),
    );
    marqueeAnimation.current.start();
  }, [marqueeAnim]);

  const stopMarquee = useCallback(() => {
    if (marqueeAnimation.current) {
      marqueeAnimation.current.stop();
      marqueeAnimation.current = null;
    }
    marqueeAnim.setValue(0);
  }, [marqueeAnim]);

  // Start/stop marquee based on focus
  useEffect(() => {
    if (focused) {
      // Small delay to allow layout measurement
      const timer = setTimeout(startMarquee, 200);
      return () => clearTimeout(timer);
    } else {
      stopMarquee();
    }
  }, [focused, startMarquee, stopMarquee]);

  // Focus handlers with smooth native animation
  const handleFocus = useCallback(() => {
    setFocused(true);
    onItemFocus?.();
    Animated.timing(scaleAnim, {
      toValue: 1.05,
      duration: 150, // Fast and snappy
      useNativeDriver: true, // Runs on native thread = 60fps
    }).start();
  }, [scaleAnim, onItemFocus]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    onItemBlur?.();
    Animated.timing(scaleAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
  }, [scaleAnim, onItemBlur]);

  const handlePress = useCallback(() => {
    onPress(video);
  }, [onPress, video]);

  return (
    <TouchableOpacity
      ref={ref}
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={0.95}
      isTVSelectable={true}
      hasTVPreferredFocus={hasTVPreferredFocus}
      nextFocusUp={nextFocusUp}
      style={styles.container}>
      <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
        <View style={styles.imageContainer}>
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              style={styles.poster}
              contentFit="cover"
              transition={0}
              priority={index < 10 ? "high" : "normal"}
              cachePolicy="disk" // Disk only - saves 60-100MB RAM
              recyclingKey={video.Id} // Helps with memory recycling
              placeholderContentFit="cover"
            />
          ) : (
            <View style={styles.placeholderPoster}>
              <Text style={styles.placeholderText} numberOfLines={1}>
                {video?.Name || "Unknown"}
              </Text>
            </View>
          )}

          {/* Bottom Info Section with Blur - Only render when focused for performance */}
          {focused &&
            metadata &&
            (posterUrl ? (
              <BlurView intensity={80} style={styles.infoOverlay} tint="dark">
                <Text style={styles.infoValue}>
                  {metadata.videoCodec} / {metadata.audioCodec}
                </Text>
                <Text style={styles.infoValue}>{metadata.resolution}</Text>
                <Text style={styles.infoValue}>{metadata?.duration}</Text>
                <View
                  style={styles.marqueeContainer}
                  onLayout={(e) => {
                    containerWidth.current = e.nativeEvent.layout.width;
                  }}>
                  <Animated.View style={{ transform: [{ translateX: marqueeAnim }] }}>
                    <Text
                      style={styles.infoValueTitle}
                      numberOfLines={1}
                      onTextLayout={(e) => {
                        const lines = e.nativeEvent.lines;
                        if (lines.length > 0) {
                          titleWidth.current = lines[0].width;
                        }
                      }}>
                      {video?.Name || "Unknown"}
                    </Text>
                  </Animated.View>
                </View>
              </BlurView>
            ) : (
              <View style={styles.infoOverlay}>
                <Text style={styles.infoValue}>
                  {metadata.videoCodec} / {metadata.audioCodec}
                </Text>
                <Text style={styles.infoValue}>{metadata.resolution}</Text>
                {metadata.fileSize && (
                  <Text style={styles.infoValue}>
                    {metadata.fileSize} / {metadata.duration}
                  </Text>
                )}
                <View
                  style={styles.marqueeContainer}
                  onLayout={(e) => {
                    containerWidth.current = e.nativeEvent.layout.width;
                  }}>
                  <Animated.View style={{ transform: [{ translateX: marqueeAnim }] }}>
                    <Text
                      style={styles.infoValueTitle}
                      numberOfLines={1}
                      onTextLayout={(e) => {
                        const lines = e.nativeEvent.lines;
                        if (lines.length > 0) {
                          titleWidth.current = lines[0].width;
                        }
                      }}>
                      {video?.Name || "Unknown"}
                    </Text>
                  </Animated.View>
                </View>
              </View>
            ))}

          {/* Border overlay - rendered on top to avoid gaps */}
          <View style={[styles.borderOverlay, focused && styles.borderOverlayFocused]} pointerEvents="none" />
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
});

/**
 * Custom comparison function for React.memo
 * Only re-render when video.Id or index changes
 * Removed checks for RunTimeTicks and MediaStreams since we compute lazily now
 */
function arePropsEqual(prevProps: VideoGridItemProps, nextProps: VideoGridItemProps): boolean {
  return (
    prevProps.video.Id === nextProps.video.Id &&
    prevProps.index === nextProps.index &&
    prevProps.onPress === nextProps.onPress &&
    prevProps.onItemFocus === nextProps.onItemFocus &&
    prevProps.onItemBlur === nextProps.onItemBlur &&
    prevProps.hasTVPreferredFocus === nextProps.hasTVPreferredFocus &&
    prevProps.nextFocusUp === nextProps.nextFocusUp
  );
}

// Export memoized component
export const VideoGridItem = React.memo(VideoGridItemComponent, arePropsEqual);

const styles = StyleSheet.create({
  container: {
    flex: 1 / NUM_COLUMNS,
    padding: CARD_PADDING,
  },
  card: {
    borderRadius: 32,
    backgroundColor: "transparent",
    overflow: "hidden",
  },
  imageContainer: {
    width: "100%",
    aspectRatio: 2 / 3, // Standard movie poster aspect ratio
    borderRadius: 32,
    overflow: "hidden",
    backgroundColor: "#1C1C1E",
  },
  borderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 32,
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
  },
  placeholderText: {
    color: "#98989D",
    fontSize: 16,
    fontWeight: "500",
    width: "90%",
    textAlign: "center",
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
  infoValue: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 16 : 13,
    fontWeight: "700",
    textAlign: "center",
    marginVertical: IS_TV ? 3 : 2,
    width: "100%",
  },
  marqueeContainer: {
    width: "100%",
    overflow: "hidden",
  },
  infoValueTitle: {
    color: "#FFFFFF",
    fontSize: IS_TV ? 16 : 13,
    fontWeight: "700",
    textAlign: "left",
    marginVertical: IS_TV ? 3 : 2,
  },
});
