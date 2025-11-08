import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform } from 'react-native';
import { JellyfinVideoItem, JellyfinMediaStream } from '@/types/jellyfin';

interface VideoDebugOverlayProps {
  videoItem: JellyfinVideoItem | null;
  isVisible: boolean;
}

export function VideoDebugOverlay({ videoItem, isVisible }: VideoDebugOverlayProps) {
  if (!isVisible || !videoItem) {
    return null;
  }

  const videoStreams = videoItem.MediaStreams?.filter(s => s.Type === 'Video') || [];
  const audioStreams = videoItem.MediaStreams?.filter(s => s.Type === 'Audio') || [];

  const formatBitrate = (bitrate?: number): string => {
    if (!bitrate) return 'Unknown';
    const mbps = (bitrate / 1000000).toFixed(2);
    return `${mbps} Mbps`;
  };

  const formatResolution = (stream: JellyfinMediaStream): string => {
    if (stream.Width && stream.Height) {
      return `${stream.Width}x${stream.Height}`;
    }
    return 'Unknown';
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>🔍 Debug Info</Text>

        {/* File Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📁 File</Text>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>{videoItem.Name}</Text>
          <Text style={styles.label}>Path:</Text>
          <Text style={styles.value} numberOfLines={2}>{videoItem.Path || 'N/A'}</Text>
          <Text style={styles.label}>ID:</Text>
          <Text style={styles.value}>{videoItem.Id}</Text>
        </View>

        {/* Video Streams */}
        {videoStreams.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎬 Video Streams ({videoStreams.length})</Text>
            {videoStreams.map((stream, index) => (
              <View key={index} style={styles.streamInfo}>
                <Text style={styles.streamTitle}>Stream #{index + 1}</Text>
                <Text style={styles.label}>Codec:</Text>
                <Text style={styles.value}>{stream.Codec?.toUpperCase() || 'Unknown'}</Text>
                <Text style={styles.label}>Resolution:</Text>
                <Text style={styles.value}>{formatResolution(stream)}</Text>
                {stream.BitRate && (
                  <>
                    <Text style={styles.label}>Bitrate:</Text>
                    <Text style={styles.value}>{formatBitrate(stream.BitRate)}</Text>
                  </>
                )}
                <Text style={styles.label}>Display Title:</Text>
                <Text style={styles.value}>{stream.DisplayTitle}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Audio Streams */}
        {audioStreams.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔊 Audio Streams ({audioStreams.length})</Text>
            {audioStreams.map((stream, index) => (
              <View key={index} style={styles.streamInfo}>
                <Text style={styles.streamTitle}>Stream #{index + 1}</Text>
                <Text style={styles.label}>Codec:</Text>
                <Text style={styles.value}>{stream.Codec?.toUpperCase() || 'Unknown'}</Text>
                {stream.BitRate && (
                  <>
                    <Text style={styles.label}>Bitrate:</Text>
                    <Text style={styles.value}>{formatBitrate(stream.BitRate)}</Text>
                  </>
                )}
                <Text style={styles.label}>Display Title:</Text>
                <Text style={styles.value}>{stream.DisplayTitle}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Runtime */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏱️ Runtime</Text>
          <Text style={styles.label}>Ticks:</Text>
          <Text style={styles.value}>{videoItem.RunTimeTicks?.toLocaleString()}</Text>
        </View>

        <Text style={styles.hint}>
          {Platform.isTV ? 'Press Menu to close' : 'Tap to close'}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    zIndex: 2000,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Platform.isTV ? 60 : 20,
  },
  title: {
    fontSize: Platform.isTV ? 32 : 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 24,
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
    backgroundColor: 'rgba(28, 28, 30, 0.8)',
    borderRadius: 12,
    padding: Platform.isTV ? 20 : 16,
  },
  sectionTitle: {
    fontSize: Platform.isTV ? 24 : 18,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 12,
  },
  streamInfo: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  streamTitle: {
    fontSize: Platform.isTV ? 18 : 14,
    fontWeight: '600',
    color: '#98989D',
    marginBottom: 8,
  },
  label: {
    fontSize: Platform.isTV ? 16 : 13,
    fontWeight: '600',
    color: '#98989D',
    marginTop: 8,
  },
  value: {
    fontSize: Platform.isTV ? 18 : 15,
    fontWeight: '500',
    color: '#FFFFFF',
    marginTop: 2,
  },
  hint: {
    fontSize: Platform.isTV ? 18 : 14,
    color: '#98989D',
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
  },
});
