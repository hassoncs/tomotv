import { JellyfinVideoItem, JellyfinVideosResponse } from "@/types/jellyfin";
import * as SecureStore from "expo-secure-store";
import { logger } from "@/utils/logger";
import { retryWithBackoff } from "@/utils/retry";

// Development fallback credentials from .env.local
// These are ONLY used during local development if user hasn't configured settings
// Production builds will NOT include .env.local (it's in .gitignore)
// Users MUST configure their own server via Settings screen
const DEV_SERVER = process.env.EXPO_PUBLIC_DEV_JELLYFIN_SERVER || "";
const DEV_API_KEY = process.env.EXPO_PUBLIC_DEV_JELLYFIN_API_KEY || "";
const DEV_USER_ID = process.env.EXPO_PUBLIC_DEV_JELLYFIN_USER_ID || "";

const STORAGE_KEYS = {
  SERVER_IP: "jellyfin_server_ip",
  SERVER_PORT: "jellyfin_server_port",
  SERVER_PROTOCOL: "jellyfin_server_protocol",
  API_KEY: "jellyfin_api_key",
  USER_ID: "jellyfin_user_id",
  VIDEO_QUALITY: "app_video_quality",
};

// Video quality presets (matches settings page)
const QUALITY_PRESETS = [
  { label: "480p", bitrate: 1500000, width: 854, height: 480 }, // Increased from 1Mbps
  { label: "540p", bitrate: 2500000, width: 960, height: 540 }, // Increased from 1.5Mbps
  { label: "720p", bitrate: 4000000, width: 1280, height: 720 }, // Increased from 3Mbps
  { label: "1080p", bitrate: 8000000, width: 1920, height: 1080 }, // Increased from 5Mbps
];

const DEFAULT_QUALITY = 2; // 720p (was 540p, better for Apple TV)

// Cached config for synchronous URL functions
// Will be populated from SecureStore on first load
let cachedConfig = {
  server: "",
  apiKey: "",
  userId: "",
};

/**
 * Get Jellyfin configuration from SecureStore
 * Falls back to .env.local development credentials if user hasn't configured settings
 * Also updates the cache for synchronous functions
 */
async function getConfig(): Promise<{
  server: string;
  apiKey: string;
  userId: string;
}> {
  try {
    const [serverIp, serverPort, serverProtocol, apiKey, userId] =
      await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_IP),
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_PORT),
        SecureStore.getItemAsync(STORAGE_KEYS.SERVER_PROTOCOL),
        SecureStore.getItemAsync(STORAGE_KEYS.API_KEY),
        SecureStore.getItemAsync(STORAGE_KEYS.USER_ID),
      ]);

    // Build server URL from IP, port, and protocol settings
    let server = "";
    if (serverIp && serverIp.trim()) {
      const ip = serverIp.trim();
      const port = serverPort?.trim() || "8096";
      const protocol = serverProtocol?.trim() || "http";

      server = `${protocol}://${ip}:${port}`;
    }

    const config = {
      // Use user settings if available, otherwise fall back to dev env vars
      server: server || DEV_SERVER,
      apiKey: apiKey?.trim() || DEV_API_KEY,
      userId: userId?.trim() || DEV_USER_ID,
    };

    // Update cache for synchronous functions
    cachedConfig = config;

    // Log when using dev credentials (helpful for debugging)
    if (!server && DEV_SERVER) {
      logger.debug("Using development credentials from .env.local", {
        service: "JellyfinAPI",
      });
    }

    return config;
  } catch (error) {
    logger.error("Error reading Jellyfin config from SecureStore", error, {
      service: "JellyfinAPI",
    });
    // Fall back to dev credentials on error
    return {
      server: DEV_SERVER,
      apiKey: DEV_API_KEY,
      userId: DEV_USER_ID,
    };
  }
}

/**
 * Refresh the config cache - call this after updating settings
 */
export async function refreshConfig(): Promise<void> {
  await getConfig();
}

/**
 * Sync dev environment variables to SecureStore if not already set
 * This ensures dev credentials are visible in SecureStore for debugging
 */
export async function syncDevCredentials(): Promise<void> {
  try {
    // Only sync if we have dev credentials
    if (!DEV_SERVER || !DEV_API_KEY || !DEV_USER_ID) {
      return;
    }

    // Check if user has already configured settings
    const existingApiKey = await SecureStore.getItemAsync(STORAGE_KEYS.API_KEY);
    if (existingApiKey && existingApiKey.trim()) {
      // User has configured settings, don't override
      return;
    }

    // Parse dev server URL to extract protocol, IP, and port
    const urlMatch = DEV_SERVER.match(/^(https?):\/\/([^:]+):(\d+)/);
    if (urlMatch) {
      const [, protocol, ip, port] = urlMatch;
      await Promise.all([
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_PROTOCOL, protocol),
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_IP, ip),
        SecureStore.setItemAsync(STORAGE_KEYS.SERVER_PORT, port),
        SecureStore.setItemAsync(STORAGE_KEYS.API_KEY, DEV_API_KEY),
        SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, DEV_USER_ID),
      ]);
      logger.debug("Synced dev credentials to SecureStore", {
        service: "JellyfinAPI",
      });
    }
  } catch (error) {
    logger.error("Error syncing dev credentials", error, {
      service: "JellyfinAPI",
    });
  }
}

/**
 * Get video quality settings from SecureStore
 * Returns quality preset index (0-3) or default (540p)
 */
async function getQualitySettings(): Promise<{
  index: number;
  bitrate: number;
  width: number;
  height: number;
  label: string;
}> {
  try {
    const savedQuality = await SecureStore.getItemAsync(
      STORAGE_KEYS.VIDEO_QUALITY,
    );
    const qualityIndex = savedQuality
      ? parseInt(savedQuality, 10)
      : DEFAULT_QUALITY;

    // Validate index is within bounds
    const validIndex =
      qualityIndex >= 0 && qualityIndex < QUALITY_PRESETS.length
        ? qualityIndex
        : DEFAULT_QUALITY;
    const preset = QUALITY_PRESETS[validIndex];

    return {
      index: validIndex,
      bitrate: preset.bitrate,
      width: preset.width,
      height: preset.height,
      label: preset.label,
    };
  } catch (error) {
    console.error("Error reading quality settings:", error);
    const preset = QUALITY_PRESETS[DEFAULT_QUALITY];
    return {
      index: DEFAULT_QUALITY,
      bitrate: preset.bitrate,
      width: preset.width,
      height: preset.height,
      label: preset.label,
    };
  }
}

// Initialize config cache on module load
getConfig().catch(() => {
  // Silent fail, will use defaults
});

/**
 * Fetch primary library/view name from Jellyfin
 * Returns the first Movie/Video library name found
 */
export async function fetchLibraryName(): Promise<string> {
  try {
    const config = await getConfig();

    if (!config.server || !config.apiKey || !config.userId) {
      return "LIBRARY";
    }

    return await retryWithBackoff(
      async () => {
        const url = `${config.server}/Users/${config.userId}/Views`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        try {
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `MediaBrowser Token="${config.apiKey}"`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            logger.warn("Failed to fetch library name", {
              service: "JellyfinAPI",
              status: response.status,
            });
            return "LIBRARY";
          }

          const data = await response.json();

          // Debug: log the response
          logger.debug("Jellyfin Views response", {
            service: "JellyfinAPI",
            itemsCount: data.Items?.length || 0,
            items: data.Items?.map((item: any) => ({
              name: item.Name,
              collectionType: item.CollectionType,
            })),
          });

          // Find first Movie or mixed collection, or just any library with content
          let library = data.Items?.find(
            (item: any) =>
              item.CollectionType === "movies" ||
              item.CollectionType === "mixed",
          );

          // If no movie/mixed library, just use the first one
          if (!library && data.Items && data.Items.length > 0) {
            library = data.Items[0];
            logger.debug("Using first available library", {
              service: "JellyfinAPI",
              name: library.Name,
              collectionType: library.CollectionType,
            });
          }

          if (library) {
            logger.debug("Found library", {
              service: "JellyfinAPI",
              name: library.Name,
              collectionType: library.CollectionType,
            });
          } else {
            logger.warn("No libraries found", {
              service: "JellyfinAPI",
            });
          }

          return library?.Name || "LIBRARY";
        } catch (error) {
          clearTimeout(timeoutId);
          logger.warn("Error fetching library name", error, {
            service: "JellyfinAPI",
          });
          return "LIBRARY";
        }
      },
      { maxAttempts: 2 },
    );
  } catch (error) {
    logger.warn("Error fetching library name", error, {
      service: "JellyfinAPI",
    });
    return "LIBRARY";
  }
}

/**
 * Fetch all videos from Jellyfin server
 * Throws error if server is not configured (in production) or connection fails
 */
export async function fetchVideos(): Promise<JellyfinVideoItem[]> {
  try {
    const config = await getConfig();

    // Validate configuration before making request
    // This will only fail in production when user hasn't configured AND no dev credentials
    if (!config.server || !config.apiKey || !config.userId) {
      throw new Error(
        "Jellyfin server not configured. Please go to Settings and configure your server connection.",
      );
    }

    const pageSize = 200;
    const maxBatches = 50;
    const aggregated: JellyfinVideoItem[] = [];
    let startIndex = 0;
    let totalRecordCount: number | undefined;
    let batches = 0;

    while (batches < maxBatches) {
      batches += 1;
      const { items, total } = await retryWithBackoff(
        () =>
          requestLibraryItems(config, {
            startIndex,
            limit: pageSize,
          }),
        { maxAttempts: 3 },
      );

      totalRecordCount = total ?? totalRecordCount;
      aggregated.push(...items);

      if (items.length < pageSize) {
        break;
      }

      if (totalRecordCount !== undefined && aggregated.length >= totalRecordCount) {
        break;
      }

      startIndex += items.length;

      if (batches === maxBatches) {
        logger.warn("Reached library fetch batch limit", {
          service: "JellyfinAPI",
          fetched: aggregated.length,
        });
      }
    }

    return aggregated;
  } catch (error) {
    logger.error("Error fetching videos from Jellyfin", error, {
      service: "JellyfinAPI",
    });
    throw error;
  }
}

/**
 * Remote search for videos using Jellyfin's SearchTerm filter
 */
export async function searchVideos(
  searchTerm: string,
  limit: number = 60,
): Promise<JellyfinVideoItem[]> {
  const trimmed = searchTerm.trim();
  if (!trimmed) {
    return [];
  }

  const config = await getConfig();
  if (!config.server || !config.apiKey || !config.userId) {
    throw new Error("Jellyfin server not configured. Update settings before searching.");
  }

  return retryWithBackoff(
    async () => {
      const { items } = await requestLibraryItems(config, {
        startIndex: 0,
        limit,
        searchTerm: trimmed,
        timeoutMs: 15000,
      });
      return items;
    },
    { maxAttempts: 3 },
  );
}

type JellyfinConfig = {
  server: string;
  apiKey: string;
  userId: string;
};

async function requestLibraryItems(
  config: JellyfinConfig,
  {
    startIndex = 0,
    limit = 200,
    searchTerm,
    timeoutMs = 30000,
  }: {
    startIndex?: number;
    limit?: number;
    searchTerm?: string;
    timeoutMs?: number;
  },
): Promise<{ items: JellyfinVideoItem[]; total?: number }> {
  const query = new URLSearchParams({
    Recursive: "true",
    IncludeItemTypes: "Movie,Video",
    Fields: "Path,MediaStreams,Genres",
    StartIndex: String(startIndex),
    Limit: String(limit),
  });

  if (searchTerm) {
    query.append("SearchTerm", searchTerm);
  }

  const url = `${config.server}/Users/${config.userId}/Items?${query.toString()}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `MediaBrowser Token="${config.apiKey}"`,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch videos: ${response.status} ${response.statusText}`,
      );
    }

    const data: JellyfinVideosResponse = await response.json();
    return {
      items: data.Items || [],
      total: data.TotalRecordCount,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        "Request timed out. Please check your network connection and Jellyfin server.",
      );
    }
    throw error;
  }
}

/**
 * Get video stream URL for a specific item
 * Always uses direct download - HLS generation appears broken in Jellyfin
 * @param itemId - The video item ID
 * @param videoItem - Optional video item (unused)
 */
export function getVideoStreamUrl(
  itemId: string,
  videoItem?: JellyfinVideoItem | null,
): string {
  // Use direct download endpoint with API key in URL
  return `${cachedConfig.server}/Items/${itemId}/Download?api_key=${cachedConfig.apiKey}`;
}

/**
 * Get HLS transcoding URL with configurable quality
 *
 * Uses master.m3u8 HLS endpoint with full H.264/AAC transcode.
 * Subtitles are burned into video frames using SubtitleMethod=Encode.
 * Quality settings are loaded from user preferences.
 *
 * Optimized for Apple TV with:
 * - Fast encoding preset (veryfast/superfast)
 * - Larger segments (10s) for reduced overhead
 * - Higher H.264 level (4.1) for better compression
 * - Hardware acceleration hints
 *
 * @param itemId - The video item ID
 * @param videoItem - Optional video item with MediaStreams for subtitle detection
 */
export async function getTranscodingStreamUrl(
  itemId: string,
  videoItem?: JellyfinVideoItem | null,
): Promise<string> {
  // Get user's quality preferences
  const quality = await getQualitySettings();

  // Use HLS master.m3u8 endpoint for transcoding
  let url =
    `${cachedConfig.server}/Videos/${itemId}/master.m3u8?` +
    `api_key=${cachedConfig.apiKey}` +
    `&MediaSourceId=${itemId}` +
    `&VideoCodec=h264` +
    `&AudioCodec=aac` +
    `&VideoBitrate=${quality.bitrate}` +
    `&AudioBitrate=192000` + // 192kbps (better for AAC)
    `&MaxWidth=${quality.width}` +
    `&MaxHeight=${quality.height}` +
    `&VideoLevel=41` + // H.264 level 4.1 (was 30)
    `&TranscodingMaxAudioChannels=2` +
    `&SegmentContainer=ts` +
    `&MinSegments=1` +
    `&SegmentLength=10` + // 10 second segments (was 8)
    `&BreakOnNonKeyFrames=false` + // Force keyframes at segment boundaries
    `&TranscodeReasons=VideoCodecNotSupported` + // Hint for hardware accel
    `&EnableAutoStreamCopy=false` + // Force transcode for consistency
    `&AllowVideoStreamCopy=false` + // Ensure predictable behavior
    `&RequireAvc=true`; // Force H.264/AVC output

  // Check for external subtitles and burn them in
  if (videoItem && videoItem.MediaStreams) {
    const subtitleStreams = videoItem.MediaStreams.filter(
      (stream) =>
        stream.Type === "Subtitle" &&
        stream.IsExternal &&
        stream.Index !== undefined,
    );

    if (subtitleStreams.length > 0) {
      const firstSubIndex = subtitleStreams[0].Index;
      url += `&SubtitleStreamIndex=${firstSubIndex}`;
      url += `&SubtitleMethod=Encode`; // Burn subtitles into video frames
      logger.info("Transcoding with subtitle burn-in", {
        service: "JellyfinAPI",
        streamIndex: firstSubIndex,
        quality: quality.label,
        bitrate: `${quality.bitrate / 1000000}Mbps`,
      });
    } else {
      logger.info("Transcoding without subtitles", {
        service: "JellyfinAPI",
        quality: quality.label,
        bitrate: `${quality.bitrate / 1000000}Mbps`,
      });
    }
  }

  return url;
}

/**
 * Get poster image URL for a specific item
 * Posters are better for movie/video displays (2:3 aspect ratio)
 */
export function getPosterUrl(itemId: string, maxHeight: number = 450): string {
  return `${cachedConfig.server}/Items/${itemId}/Images/Primary?api_key=${cachedConfig.apiKey}&maxHeight=${maxHeight}&quality=90`;
}

/**
 * Check if item has a poster image
 */
export function hasPoster(item: JellyfinVideoItem): boolean {
  return item.ImageTags?.Primary !== undefined;
}

/**
 * Format duration from RunTimeTicks to readable format
 * RunTimeTicks are in 100-nanosecond intervals
 * @param ticks - RunTimeTicks from Jellyfin
 * @returns Formatted string like "1h 23m" or "45m"
 */
export function formatDuration(ticks: number): string {
  const totalSeconds = ticks / 10000000;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

/**
 * Fetch detailed video item information including media streams
 */
export async function fetchVideoDetails(
  itemId: string,
): Promise<JellyfinVideoItem | null> {
  try {
    const config = await getConfig();

    // Wrap the fetch operation with retry logic
    return await retryWithBackoff(
      async () => {
        const url = `${config.server}/Users/${config.userId}/Items/${itemId}?Fields=Path,MediaStreams,Overview,MediaSources`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

        try {
          const response = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
              Authorization: `MediaBrowser Token="${config.apiKey}"`,
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(
              `Failed to fetch video details: ${response.status} ${response.statusText}`,
            );
          }

          const data: JellyfinVideoItem = await response.json();
          return data;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error instanceof Error && error.name === "AbortError") {
            throw new Error(
              "Request timed out. Please check your network connection.",
            );
          }
          throw error;
        }
      },
      { maxAttempts: 3 },
    );
  } catch (error) {
    logger.error("Error fetching video details from Jellyfin", error, {
      service: "JellyfinAPI",
    });
    return null;
  }
}

/**
 * Check if a video codec is natively supported on iOS/tvOS
 * iOS/tvOS native support:
 * - H.264 (AVC): Fully supported
 * - HEVC (H.265): Supported on A10+ devices (iPhone 7+, iPad 2017+, Apple TV 4K)
 *
 * NOT supported (requires transcoding):
 * - MPEG-4 Part 2: Old codec (DivX/Xvid), not supported
 * - VP8, VP9: Google codecs, not supported
 * - AV1: Not supported yet
 * - VC-1: Windows Media codec, not supported
 * - MPEG-2: Limited/no support
 * - DivX, Xvid: Not supported
 */
export function isCodecSupported(codec: string): boolean {
  const codecLower = codec.toLowerCase();

  // Supported codecs
  if (codecLower.includes("h264") || codecLower.includes("avc")) {
    return true; // H.264/AVC is universally supported
  }

  if (codecLower.includes("hevc") || codecLower.includes("h265")) {
    return true; // HEVC is supported on modern iOS/tvOS devices
  }

  // Unsupported codecs that need transcoding
  if (codecLower.includes("mpeg4") || codecLower.includes("mpeg-4")) {
    return false; // MPEG-4 Part 2 (old codec) not supported - causes black screen
  }

  if (codecLower.includes("vp8") || codecLower.includes("vp9")) {
    return false; // VP8/VP9 not supported
  }

  if (codecLower.includes("av1")) {
    return false; // AV1 not supported yet
  }

  if (codecLower.includes("vc1") || codecLower.includes("wmv")) {
    return false; // VC-1/WMV not supported
  }

  if (codecLower.includes("mpeg2")) {
    return false; // MPEG-2 not supported
  }

  if (codecLower.includes("divx") || codecLower.includes("xvid")) {
    return false; // DivX/Xvid not supported
  }

  // Default to unsupported for unknown codecs to be safe
  // Better to transcode unnecessarily than show black screen
  logger.warn("Unknown codec, defaulting to transcoding for safety", {
    service: "CodecCheck",
    codec,
  });
  return false;
}

/**
 * Check if item is audio-only (no video stream)
 * Audio-only files should be handled differently or filtered out
 */
export function isAudioOnly(videoItem: JellyfinVideoItem | null): boolean {
  if (!videoItem || !videoItem.MediaStreams) {
    return false;
  }

  // Check if there's a video stream
  const hasVideo = videoItem.MediaStreams.some(
    (stream) => stream.Type === "Video",
  );
  const hasAudio = videoItem.MediaStreams.some(
    (stream) => stream.Type === "Audio",
  );

  // Audio-only: has audio but no video
  return !hasVideo && hasAudio;
}

/**
 * Check if video needs transcoding based on its codec
 * Returns true if transcoding is required, false if direct play is supported
 */
export function needsTranscoding(videoItem: JellyfinVideoItem | null): boolean {
  if (!videoItem || !videoItem.MediaStreams) {
    return false; // Default to direct play if no info available
  }

  // Find the video stream
  const videoStream = videoItem.MediaStreams.find(
    (stream) => stream.Type === "Video",
  );

  if (!videoStream || !videoStream.Codec) {
    return false; // No video stream info, try direct play
  }

  const supported = isCodecSupported(videoStream.Codec);

  logger.debug("Codec check result", {
    service: "CodecCheck",
    codec: videoStream.Codec,
    supported,
  });

  return !supported;
}

/**
 * Subtitle track interface for expo-video
 * These tracks are passed to VideoSource.subtitleTracks
 */
export interface SubtitleTrack {
  uri: string;
  language: string;
  label: string;
  type: "text/vtt" | "text/srt";
}

/**
 * Get all subtitle tracks available for a video
 * Returns external subtitle files in VTT format for expo-video
 */
export function getSubtitleTracks(
  videoItem: JellyfinVideoItem | null,
): SubtitleTrack[] {
  if (!videoItem || !videoItem.MediaStreams) {
    return [];
  }

  // Find all subtitle streams
  const subtitleStreams = videoItem.MediaStreams.filter(
    (stream) => stream.Type === "Subtitle",
  );

  if (subtitleStreams.length === 0) {
    return [];
  }

  const tracks: SubtitleTrack[] = [];

  for (const stream of subtitleStreams) {
    // Only include external subtitle files (not embedded/burned-in)
    // IsExternal indicates the subtitle is in a separate file (like .srt)
    if (stream.IsExternal && stream.Index !== undefined) {
      // Always request VTT format for best compatibility with video players
      // Jellyfin will convert SRT to VTT automatically if needed
      const track: SubtitleTrack = {
        uri: getSubtitleUrl(videoItem.Id, stream.Index, "vtt"),
        language: stream.Language || "und",
        label: stream.DisplayTitle || stream.Language || "Unknown",
        type: "text/vtt", // Always VTT since we request .vtt format
      };
      tracks.push(track);
      logger.debug("Found external subtitle", {
        service: "Subtitles",
        label: track.label,
        language: track.language,
        uri: track.uri,
      });
    }
  }

  return tracks;
}

/**
 * Get subtitle URL for a specific stream index
 * @param itemId - The video item ID
 * @param streamIndex - The subtitle stream index from MediaStreams
 * @param format - Subtitle format (default: 'vtt' for best compatibility)
 */
export function getSubtitleUrl(
  itemId: string,
  streamIndex: number,
  format: string = "vtt",
): string {
  // Jellyfin subtitle stream endpoint (from SubtitleController.cs)
  // Format: /Videos/{itemId}/{mediaSourceId}/Subtitles/{index}/Stream.{format}
  // The format extension is required (e.g., .vtt, .srt)
  // For most cases, mediaSourceId is the same as itemId
  // VTT format is preferred as it works better with HTML5 video players
  return `${cachedConfig.server}/Videos/${itemId}/${itemId}/Subtitles/${streamIndex}/Stream.${format}?api_key=${cachedConfig.apiKey}`;
}
