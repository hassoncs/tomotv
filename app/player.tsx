import { useVideoPlayback } from "@/hooks/useVideoPlayback";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  InteractionManager,
  LogBox,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useTVEventHandler,
  View,
} from "react-native";
import { useLoading } from "@/contexts/LoadingContext";
import { useLibrary } from "@/contexts/LibraryContext";

// Suppress known warnings
LogBox.ignoreLogs([
  "allowsFullscreen",
  "The `allowsFullscreen` prop is deprecated",
  "JS object is no longer associated",
  "Operation requires a client callback",
  "Operation requires a client data source",
  "Cannot Open", // Direct play failures that trigger automatic transcoding retry
  "Failed to load the player item", // Player errors during automatic retry
]);

export default function VideoPlayerScreen() {
  const params = useLocalSearchParams<{
    videoId: string;
    videoName: string;
    playlistIndex?: string;
  }>();
  const router = useRouter();
  const { hideGlobalLoader, showGlobalLoader } = useLoading();
  const { videos } = useLibrary();

  // Parse playlist index
  const currentPlaylistIndex = params.playlistIndex
    ? parseInt(params.playlistIndex, 10)
    : -1;

  // Handle playback end - auto-play next video
  const handlePlaybackEnd = useCallback(() => {
    // Check if there's a next video in the playlist
    if (currentPlaylistIndex >= 0 && currentPlaylistIndex < videos.length - 1) {
      const nextVideo = videos[currentPlaylistIndex + 1];
      if (nextVideo) {
        console.log("[VideoPlayer] Auto-playing next video:", nextVideo.Name);
        showGlobalLoader();

        // Navigate to next video with updated playlist index
        router.replace({
          pathname: "/player" as const,
          params: {
            videoId: nextVideo.Id,
            videoName: nextVideo.Name,
            playlistIndex: (currentPlaylistIndex + 1).toString(),
          },
        });
      }
    } else {
      console.log("[VideoPlayer] End of playlist, going back to library");
      // End of playlist, return to library
      router.back();
    }
  }, [currentPlaylistIndex, videos, router, showGlobalLoader]);

  // Use the video playback hook with state machine
  const {
    player,
    state,
    videoDetails,
    isAudioOnly,
    showLoadingOverlay,
    retry,
  } = useVideoPlayback({
    videoId: params.videoId,
    videoName: params.videoName,
    onPlaybackEnd: handlePlaybackEnd,
  });

  // Track playing state for audio UI
  const [isPlaying, setIsPlaying] = useState(false);

  // Hide global loader when component mounts
  useEffect(() => {
    hideGlobalLoader();
  }, [hideGlobalLoader]);

  // Handle TV remote events
  const handleTVEvent = (evt: any) => {
    if (evt.eventType === "menu") {
      handleBack();
    }
  };

  useTVEventHandler(handleTVEvent);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (player) {
      try {
        player.pause();
      } catch (_error) {
        // Ignore errors - player may already be cleaning up
      }
    }
    router.back();
  }, [player, router]);

  // Handle Android TV back button
  useEffect(() => {
    if (Platform.OS === "android") {
      const backHandler = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          handleBack();
          return true;
        },
      );

      return () => backHandler.remove();
    }
  }, [handleBack]);

  // Pause player when entering error state
  useEffect(() => {
    if (state.type === "ERROR" && player) {
      try {
        player.pause();
      } catch (_error) {
        // Ignore errors - player may not be initialized
      }
    }
  }, [state.type, player]);

  // Listen to player state for audio UI
  useEffect(() => {
    if (!player || !isAudioOnly) return;

    const subscription = player.addListener("playingChange", (payload) => {
      // Ensure state update happens on main thread to avoid threading crashes
      InteractionManager.runAfterInteractions(() => {
        setIsPlaying(payload.isPlaying);
      });
    });

    return () => {
      subscription.remove();
    };
  }, [player, isAudioOnly]);

  // Toggle play/pause for audio
  const handlePlayPause = useCallback(() => {
    if (!player) return;

    try {
      if (isPlaying) {
        player.pause();
      } else {
        player.play();
      }
    } catch (error) {
      console.error("Error toggling playback:", error);
    }
  }, [player, isPlaying]);

  // Render error state (but not if auto-retry is in progress)
  if (state.type === "ERROR") {
    // If we can retry with transcoding, show loading overlay instead of error
    // This prevents flashing an error message during automatic retry
    if (state.canRetryWithTranscode) {
      return (
        <View style={styles.container}>
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
            <View style={styles.encodingMessageContainer}>
              <Text style={styles.encodingTitle}>
                Retrying with Transcoding
              </Text>
              <Text style={styles.encodingSubtitle}>
                Direct play failed • Converting to H.264
              </Text>
            </View>
          </View>
          {/* Back button for iOS */}
          {!Platform.isTV && (
            <TouchableOpacity style={styles.iosBackButton} onPress={handleBack}>
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      );
    }

    // Only show error UI if retry is not possible or has already failed
    const { error } = state;
    const mode = videoDetails ? "Transcoding" : "Direct Play";

    let errorDetails = `${error}\n\n`;
    errorDetails += `Mode: ${mode}\n`;
    errorDetails += `Video: ${params.videoName}\n\n`;

    if (mode === "Transcoding") {
      errorDetails += "⚠️ TRANSCODING FAILED\n\n";
      errorDetails +=
        "Your Jellyfin server may not have transcoding enabled.\n\n";
      errorDetails += "To fix this:\n";
      errorDetails += "1. Open Jellyfin Dashboard\n";
      errorDetails += "2. Go to Playback → Transcoding\n";
      errorDetails += "3. Enable hardware acceleration or install FFmpeg\n\n";
      errorDetails +=
        "Alternative: Try a device that supports this codec directly.";
    } else {
      errorDetails += "Video codec not supported for direct play.";
    }

    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Playback Error</Text>
        <Text style={styles.errorText}>{errorDetails}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={retry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.retryButton, styles.backButton]}
          onPress={handleBack}
        >
          <Text style={styles.retryButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Render audio-only player (no VideoView to avoid threading issues)
  if (isAudioOnly) {
    return (
      <View style={styles.container}>
        {/* Audio UI - No VideoView component */}
        <View style={styles.audioContainer}>
          <Ionicons
            name="musical-notes"
            size={Platform.isTV ? 120 : 80}
            color="rgba(255, 255, 255, 0.8)"
          />
          <Text style={styles.audioTitle}>{params.videoName}</Text>
          <Text style={styles.audioSubtitle}>Audio File</Text>

          {/* Play/Pause Button */}
          {!showLoadingOverlay && (
            <TouchableOpacity
              style={styles.playPauseButton}
              onPress={handlePlayPause}
              isTVSelectable={true}
              hasTVPreferredFocus={true}
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={Platform.isTV ? 48 : 36}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Back button */}
        {!Platform.isTV && (
          <TouchableOpacity style={styles.iosBackButton} onPress={handleBack}>
            <Ionicons name="close" size={30} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Render video player with native controls
  return (
    <View style={styles.container}>
      {/* Video Player with Native Controls */}
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={true}
        allowsPictureInPicture={Platform.OS === "ios"}
      />

      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          {/* Show encoding message only during transcoding */}
          {"mode" in state && state.mode === "transcode" && (
            <View style={styles.encodingMessageContainer}>
              <Text style={styles.encodingTitle}>Transcoding Video</Text>
              <Text style={styles.encodingSubtitle}>
                Codec not compatible • Converting to H.264
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Back button for iOS */}
      {!Platform.isTV && (
        <TouchableOpacity style={styles.iosBackButton} onPress={handleBack}>
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3d3d3d",
  },
  video: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#3d3d3d",
    zIndex: 100,
  },
  encodingMessageContainer: {
    marginTop: 24,
    alignItems: "center",
    paddingHorizontal: 40,
  },
  encodingTitle: {
    fontSize: Platform.isTV ? 24 : 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  encodingSubtitle: {
    fontSize: Platform.isTV ? 18 : 14,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    letterSpacing: 0.2,
  },
  iosBackButton: {
    position: "absolute",
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  audioContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#3d3d3d",
    padding: 40,
  },
  audioTitle: {
    marginTop: 32,
    fontSize: Platform.isTV ? 32 : 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    paddingHorizontal: 40,
  },
  audioSubtitle: {
    marginTop: 12,
    fontSize: Platform.isTV ? 20 : 16,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
  },
  playPauseButton: {
    marginTop: 48,
    width: Platform.isTV ? 120 : 96,
    height: Platform.isTV ? 120 : 96,
    borderRadius: Platform.isTV ? 60 : 48,
    // backgroundColor: "rgba(255, 195, 18, 0.2)",
    borderWidth: 3,
    borderColor: "rgba(255, 195, 18, 1)",
    justifyContent: "center",
    alignItems: "center",
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#3d3d3d",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  errorText: {
    marginTop: 8,
    fontSize: 18,
    color: "#98989D",
    textAlign: "center",
    lineHeight: 26,
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: "#FFC312",
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  backButton: {
    backgroundColor: "#8E8E93",
    marginTop: 12,
  },
});
