import { FocusableButton } from "@/components/FocusableButton";
import { useFolderNavigation } from "@/contexts/FolderNavigationContext";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLoading } from "@/contexts/LoadingContext";
import { useVideoPlayback } from "@/hooks/useVideoPlayback";
import { connectToDemoServer } from "@/services/jellyfinApi";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { VideoView } from "expo-video";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, InteractionManager, LogBox, Platform, StyleSheet, Text, TouchableOpacity, useTVEventHandler, View } from "react-native";

// Suppress known warnings
LogBox.ignoreLogs([
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
  const { refreshLibrary, videos } = useLibrary();
  const { refresh: refreshFolderNavigation } = useFolderNavigation();

  // Parse playlist index
  const currentPlaylistIndex = params.playlistIndex ? parseInt(params.playlistIndex, 10) : -1;

  // Handle playback end - auto-play next video
  const handlePlaybackEnd = useCallback(() => {
    // Check if there's a next video in the playlist
    if (currentPlaylistIndex >= 0 && currentPlaylistIndex < videos.length - 1) {
      const nextVideo = videos[currentPlaylistIndex + 1];
      if (nextVideo) {
        logger.info("Auto-playing next video", { service: "VideoPlayer", videoName: nextVideo.Name });
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
      logger.info("End of playlist, going back to library", { service: "VideoPlayer" });
      // End of playlist, return to library
      router.back();
    }
  }, [currentPlaylistIndex, videos, router, showGlobalLoader]);

  // Use the video playback hook with state machine
  const { player, state, isAudioOnly, showLoadingOverlay, retry } = useVideoPlayback({
    videoId: params.videoId,
    onPlaybackEnd: handlePlaybackEnd,
  });

  // Track playing state for audio UI
  const [isPlaying, setIsPlaying] = useState(false);
  const [isConnectingToDemo, setIsConnectingToDemo] = useState(false);

  // Callback ref for play/pause button - focuses immediately when mounted on TV
  const playPauseButtonRef = useCallback((node: React.ElementRef<typeof TouchableOpacity> | null) => {
    if (node && Platform.isTV) {
      (node as unknown as { requestTVFocus: () => void }).requestTVFocus();
    }
  }, []);

  // Hide global loader when component mounts
  useEffect(() => {
    hideGlobalLoader();
  }, [hideGlobalLoader]);

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
      logger.error("Error toggling playback", error, { service: "VideoPlayer" });
    }
  }, [player, isPlaying]);

  // Handle Try Demo Server
  const handleTryDemo = useCallback(async () => {
    if (isConnectingToDemo) return; // Prevent double-click

    setIsConnectingToDemo(true);
    let connected = false;

    try {
      showGlobalLoader();
      await connectToDemoServer();
      connected = true;

      await refreshLibrary();
      await refreshFolderNavigation();

      hideGlobalLoader();

      Alert.alert("Demo Server Connected", "You're now connected to Jellyfin's demo server. Go back to browse the demo library.", [
        {
          text: "Go Back",
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      hideGlobalLoader();

      if (connected) {
        // Connection succeeded but refresh failed
        Alert.alert("Connected to Demo", "Connected to demo server, but couldn't load the library. Please check your internet connection and try navigating again.", [{ text: "OK" }]);
      } else {
        // Connection failed
        Alert.alert("Connection Failed", error instanceof Error ? error.message : "Unable to connect to demo server", [{ text: "OK" }]);
      }
    } finally {
      setIsConnectingToDemo(false);
    }
  }, [isConnectingToDemo, showGlobalLoader, hideGlobalLoader, refreshLibrary, refreshFolderNavigation, router]);

  // Handle TV remote events
  useTVEventHandler(
    useCallback(
      (evt: { eventType: string }) => {
        if (evt.eventType === "menu") {
          handleBack();
        }
        // Handle play/pause for audio files via remote buttons
        if (isAudioOnly && (evt.eventType === "playPause" || evt.eventType === "select")) {
          handlePlayPause();
        }
      },
      [handleBack, isAudioOnly, handlePlayPause],
    ),
  );

  // Handle Android TV back button
  useEffect(() => {
    if (Platform.OS === "android") {
      const backHandler = BackHandler.addEventListener("hardwareBackPress", () => {
        handleBack();
        return true;
      });

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

  // Render error state (but not if auto-retry is in progress)
  if (state.type === "ERROR") {
    // If we can retry with transcoding, show loading overlay instead of error
    // This prevents flashing an error message during automatic retry
    if (state.canRetryWithTranscode) {
      return (
        <View style={styles.container}>
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        </View>
      );
    }

    // Only show error UI if retry is not possible or has already failed
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Unable to Play</Text>
        <Text style={styles.errorText}>{state.error}</Text>

        <View style={styles.buttonGroup}>
          <FocusableButton title="Retry" onPress={retry} variant="retry" style={styles.button} hasTVPreferredFocus={true} />
          <FocusableButton title="Go Back" onPress={handleBack} variant="secondary" style={styles.button} />
        </View>
      </View>
    );
  }

  // Render audio-only player (no VideoView to avoid threading issues)
  if (isAudioOnly) {
    return (
      <View style={styles.container}>
        {/* Audio UI - No VideoView component */}
        <View style={styles.audioContainer}>
          <Ionicons name="musical-notes" size={Platform.isTV ? 120 : 80} color="rgba(255, 255, 255, 0.8)" />
          <Text style={styles.audioTitle}>{params.videoName}</Text>
          <Text style={styles.audioSubtitle}>Audio File</Text>

          {/* Play/Pause Button */}
          <TouchableOpacity
            ref={playPauseButtonRef}
            style={styles.playPauseButton}
            onPress={handlePlayPause}
            activeOpacity={1}
            isTVSelectable={true}
            accessibilityLabel={isPlaying ? "Pause" : "Play"}
            accessibilityRole="button"
            accessibilityHint={isPlaying ? "Pause audio playback" : "Resume audio playback"}>
            <Ionicons name={isPlaying ? "pause" : "play"} size={Platform.isTV ? 48 : 36} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Back button */}
        {!Platform.isTV && (
          <TouchableOpacity style={styles.iosBackButton} onPress={handleBack} accessibilityLabel="Close" accessibilityRole="button" accessibilityHint="Close player and return to library">
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
      <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={true} allowsPictureInPicture={Platform.OS === "ios"} />

      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* Back button for iOS */}
      {!Platform.isTV && (
        <TouchableOpacity style={styles.iosBackButton} onPress={handleBack} accessibilityLabel="Close" accessibilityRole="button" accessibilityHint="Close player and return to library">
          <Ionicons name="close" size={30} color="#FFFFFF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
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
    backgroundColor: "#000000",
    zIndex: 100,
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
    backgroundColor: "#000000",
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
    borderWidth: 3,
    borderColor: "#FFC312",
    backgroundColor: "rgba(255, 195, 18, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    opacity: 1,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#000000",
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
  buttonGroup: {
    gap: Platform.isTV ? 16 : 12,
    marginTop: Platform.isTV ? 32 : 24,
    alignItems: "center",
  },
  button: {
    minWidth: Platform.isTV ? 300 : 250,
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
