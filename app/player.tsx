import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VideoView } from 'expo-video';
import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useTVEventHandler,
  View,
  LogBox,
} from 'react-native';
import { useVideoPlayback } from '@/hooks/useVideoPlayback';

// Suppress known warnings
LogBox.ignoreLogs([
  'allowsFullscreen',
  'The `allowsFullscreen` prop is deprecated',
  'JS object is no longer associated',
  'Operation requires a client callback',
  'Operation requires a client data source',
]);

export default function VideoPlayerScreen() {
  const params = useLocalSearchParams<{ videoId: string; videoName: string }>();
  const router = useRouter();

  // Use the video playback hook with state machine
  const {
    player,
    state,
    videoDetails,
    showLoadingOverlay,
    retry,
  } = useVideoPlayback({
    videoId: params.videoId,
    videoName: params.videoName,
  });

  // Handle TV remote events
  const handleTVEvent = (evt: any) => {
    if (evt.eventType === 'menu') {
      handleBack();
    }
  };

  useTVEventHandler(handleTVEvent);

  // Handle Android TV back button
  useEffect(() => {
    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        handleBack();
        return true;
      });

      return () => backHandler.remove();
    }
  }, []);

  const handleBack = () => {
    if (player) {
      player.pause();
    }
    router.back();
  };

  // Render error state
  if (state.type === 'ERROR') {
    const { error } = state;
    const mode = videoDetails ? 'Transcoding' : 'Direct Play';

    let errorDetails = `${error}\n\n`;
    errorDetails += `Mode: ${mode}\n`;
    errorDetails += `Video: ${params.videoName}\n\n`;

    if (mode === 'Transcoding') {
      errorDetails += '⚠️ TRANSCODING FAILED\n\n';
      errorDetails += 'Your Jellyfin server may not have transcoding enabled.\n\n';
      errorDetails += 'To fix this:\n';
      errorDetails += '1. Open Jellyfin Dashboard\n';
      errorDetails += '2. Go to Playback → Transcoding\n';
      errorDetails += '3. Enable hardware acceleration or install FFmpeg\n\n';
      errorDetails += 'Alternative: Try a device that supports this codec directly.';
    } else {
      errorDetails += 'Video codec not supported for direct play.';
    }

    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
        <Text style={styles.errorTitle}>Playback Error</Text>
        <Text style={styles.errorText}>{errorDetails}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={retry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
        <Text style={styles.errorHint}>Or press back to return to library</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Player with Native Controls */}
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls={true}
        allowsPictureInPicture={Platform.OS === 'ios'}
      />

      {/* Loading Overlay */}
      {showLoadingOverlay && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          {/* Show encoding message only during transcoding */}
          {('mode' in state && state.mode === 'transcode') && (
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
    backgroundColor: '#000000',
  },
  video: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    zIndex: 100,
  },
  encodingMessageContainer: {
    marginTop: 24,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  encodingTitle: {
    fontSize: Platform.isTV ? 24 : 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  encodingSubtitle: {
    fontSize: Platform.isTV ? 18 : 14,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  iosBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 8,
    fontSize: 18,
    color: '#98989D',
    textAlign: 'center',
    lineHeight: 26,
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  errorHint: {
    marginTop: 16,
    fontSize: 16,
    color: '#98989D',
    textAlign: 'center',
  },
});
