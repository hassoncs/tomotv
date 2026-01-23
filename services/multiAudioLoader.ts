/**
 * multiAudioLoader.ts
 *
 * Service for preparing multi-audio track playback with custom HLS manifest generation.
 * This enables seamless audio track switching during transcoding - TomoTV's killer feature!
 *
 * How it works:
 * 1. Detects videos with multiple audio tracks
 * 2. Configures native Swift resource loader with track metadata
 * 3. Generates custom protocol URL (jellyfin-multi://)
 * 4. Native module intercepts URL and generates multivariant HLS manifest
 * 5. AVPlayer discovers all audio tracks and enables seamless switching
 *
 * Created: January 23, 2026
 */

import { NativeModules, Platform } from "react-native";
import type { JellyfinVideoItem, JellyfinMediaStream } from "@/types/jellyfin";
import { logger } from "@/utils/logger";

const { MultiAudioResourceLoader } = NativeModules;

/**
 * Audio track information for native module
 */
export interface AudioTrackInfo {
  Index: number;
  Language: string;
  Codec: string;
  Channels: number;
  DisplayTitle: string;
}

/**
 * Check if multi-audio native module is available
 * Only available on iOS/tvOS
 */
export function isMultiAudioAvailable(): boolean {
  if (Platform.OS !== "ios") {
    return false;
  }

  return MultiAudioResourceLoader !== null && MultiAudioResourceLoader !== undefined;
}

/**
 * Extract audio track information from video metadata
 */
export function getAudioTracks(videoItem: JellyfinVideoItem): AudioTrackInfo[] {
  if (!videoItem.MediaStreams) {
    return [];
  }

  const audioStreams = videoItem.MediaStreams.filter(
    (stream: JellyfinMediaStream) => stream.Type === "Audio"
  );

  return audioStreams.map((stream: JellyfinMediaStream) => ({
    Index: stream.Index ?? 0,
    Language: stream.Language || "und",
    Codec: stream.Codec || "unknown",
    Channels: stream.Channels || 2,
    DisplayTitle:
      stream.DisplayTitle ||
      `${stream.Language || "Unknown"} (${stream.Codec || "Unknown"})`,
  }));
}

/**
 * Prepare multi-audio playback for a video with multiple audio tracks
 *
 * @param videoId - Jellyfin item ID
 * @param videoItem - Video metadata from Jellyfin
 * @param baseUrl - HLS transcoding base URL (from getTranscodingStreamUrl)
 * @param apiKey - Jellyfin API key
 * @returns Custom protocol URL for multi-audio playback (jellyfin-multi://...)
 * @throws Error if native module is not available or configuration fails
 */
export async function prepareMultiAudioPlayback(
  videoId: string,
  videoItem: JellyfinVideoItem,
  baseUrl: string,
  apiKey: string
): Promise<string> {
  // Verify native module is available
  if (!isMultiAudioAvailable()) {
    throw new Error("Multi-audio native module not available on this platform");
  }

  // Extract audio tracks
  const audioTracks = getAudioTracks(videoItem);

  if (audioTracks.length === 0) {
    throw new Error("No audio tracks found in video metadata");
  }

  logger.info("Preparing multi-audio playback", {
    service: "MultiAudioLoader",
    videoId,
    audioTrackCount: audioTracks.length,
    tracks: audioTracks.map((t) => ({
      language: t.Language,
      codec: t.Codec,
      channels: t.Channels,
    })),
  });

  try {
    // Configure resource loader with track info
    await MultiAudioResourceLoader.configureResourceLoader(
      baseUrl,
      apiKey,
      videoId,
      audioTracks
    );

    // Generate custom URL
    const customUrl = await MultiAudioResourceLoader.generateCustomUrl(videoId);

    logger.info("Multi-audio custom URL generated", {
      service: "MultiAudioLoader",
      videoId,
      customUrl,
    });

    return customUrl;
  } catch (error) {
    logger.error("Failed to prepare multi-audio playback", {
      service: "MultiAudioLoader",
      videoId,
      error,
    });
    throw error;
  }
}

/**
 * Check if a video should use multi-audio playback
 *
 * @param videoItem - Video metadata
 * @returns true if video has multiple audio tracks and needs transcoding
 */
export function shouldUseMultiAudio(videoItem: JellyfinVideoItem): boolean {
  if (!isMultiAudioAvailable()) {
    return false;
  }

  const audioTracks = getAudioTracks(videoItem);
  return audioTracks.length > 1;
}
