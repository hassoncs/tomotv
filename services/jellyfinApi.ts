import {JellyfinVideoItem, JellyfinVideosResponse} from "@/types/jellyfin"
import * as SecureStore from "expo-secure-store"

// Development fallback credentials from .env.local
// These are ONLY used during local development if user hasn't configured settings
// Production builds will NOT include .env.local (it's in .gitignore)
// Users MUST configure their own server via Settings screen
const DEV_SERVER = process.env.EXPO_PUBLIC_DEV_JELLYFIN_SERVER || ""
const DEV_API_KEY = process.env.EXPO_PUBLIC_DEV_JELLYFIN_API_KEY || ""
const DEV_USER_ID = process.env.EXPO_PUBLIC_DEV_JELLYFIN_USER_ID || ""

const STORAGE_KEYS = {
  SERVER_IP: "jellyfin_server_ip",
  API_KEY: "jellyfin_api_key",
  USER_ID: "jellyfin_user_id",
  VIDEO_QUALITY: "app_video_quality"
}

// Video quality presets (matches settings page)
const QUALITY_PRESETS = [
  {label: "480p", bitrate: 1500000, width: 854, height: 480}, // Increased from 1Mbps
  {label: "540p", bitrate: 2500000, width: 960, height: 540}, // Increased from 1.5Mbps
  {label: "720p", bitrate: 4000000, width: 1280, height: 720}, // Increased from 3Mbps
  {label: "1080p", bitrate: 8000000, width: 1920, height: 1080} // Increased from 5Mbps
]

const DEFAULT_QUALITY = 2 // 720p (was 540p, better for Apple TV)

// Cached config for synchronous URL functions
// Will be populated from SecureStore on first load
let cachedConfig = {
  server: "",
  apiKey: "",
  userId: ""
}

/**
 * Get Jellyfin configuration from SecureStore
 * Falls back to .env.local development credentials if user hasn't configured settings
 * Also updates the cache for synchronous functions
 */
async function getConfig(): Promise<{server: string; apiKey: string; userId: string}> {
  try {
    const [serverIp, apiKey, userId] = await Promise.all([
      SecureStore.getItemAsync(STORAGE_KEYS.SERVER_IP),
      SecureStore.getItemAsync(STORAGE_KEYS.API_KEY),
      SecureStore.getItemAsync(STORAGE_KEYS.USER_ID)
    ])

    // Build server URL from IP (add http:// and port if needed)
    let server = ""
    if (serverIp && serverIp.trim()) {
      const ip = serverIp.trim()
      // Check if already has protocol
      if (!ip.startsWith("http://") && !ip.startsWith("https://")) {
        // Check if has port
        if (ip.includes(":")) {
          server = `http://${ip}`
        } else {
          server = `http://${ip}:8096`
        }
      } else {
        server = ip
      }
    }

    const config = {
      // Use user settings if available, otherwise fall back to dev env vars
      server: server || DEV_SERVER,
      apiKey: apiKey?.trim() || DEV_API_KEY,
      userId: userId?.trim() || DEV_USER_ID
    }

    // Update cache for synchronous functions
    cachedConfig = config

    // Log when using dev credentials (helpful for debugging)
    if (!server && DEV_SERVER) {
      console.log("[JellyfinAPI] Using development credentials from .env.local")
    }

    return config
  } catch (error) {
    console.error("Error reading Jellyfin config from SecureStore:", error)
    // Fall back to dev credentials on error
    return {
      server: DEV_SERVER,
      apiKey: DEV_API_KEY,
      userId: DEV_USER_ID
    }
  }
}

/**
 * Refresh the config cache - call this after updating settings
 */
export async function refreshConfig(): Promise<void> {
  await getConfig()
}

/**
 * Get video quality settings from SecureStore
 * Returns quality preset index (0-3) or default (540p)
 */
async function getQualitySettings(): Promise<{index: number; bitrate: number; width: number; height: number; label: string}> {
  try {
    const savedQuality = await SecureStore.getItemAsync(STORAGE_KEYS.VIDEO_QUALITY)
    const qualityIndex = savedQuality ? parseInt(savedQuality, 10) : DEFAULT_QUALITY

    // Validate index is within bounds
    const validIndex = qualityIndex >= 0 && qualityIndex < QUALITY_PRESETS.length ? qualityIndex : DEFAULT_QUALITY
    const preset = QUALITY_PRESETS[validIndex]

    return {
      index: validIndex,
      bitrate: preset.bitrate,
      width: preset.width,
      height: preset.height,
      label: preset.label
    }
  } catch (error) {
    console.error("Error reading quality settings:", error)
    const preset = QUALITY_PRESETS[DEFAULT_QUALITY]
    return {
      index: DEFAULT_QUALITY,
      bitrate: preset.bitrate,
      width: preset.width,
      height: preset.height,
      label: preset.label
    }
  }
}

// Initialize config cache on module load
getConfig().catch(() => {
  // Silent fail, will use defaults
})

/**
 * Fetch all videos from Jellyfin server
 * Throws error if server is not configured (in production) or connection fails
 */
export async function fetchVideos(): Promise<JellyfinVideoItem[]> {
  try {
    const config = await getConfig()

    // Validate configuration before making request
    // This will only fail in production when user hasn't configured AND no dev credentials
    if (!config.server || !config.apiKey || !config.userId) {
      throw new Error(
        "Jellyfin server not configured. Please go to Settings and configure your server connection."
      )
    }

    const url = `${config.server}/Users/${config.userId}/Items?api_key=${config.apiKey}&Recursive=true&IncludeItemTypes=Movie,Video&Fields=Path,MediaStreams,Overview,PremiereDate,CommunityRating,OfficialRating,Genres`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch videos: ${response.status} ${response.statusText}`)
    }

    const data: JellyfinVideosResponse = await response.json()
    return data.Items || []
  } catch (error) {
    console.error("Error fetching videos from Jellyfin:", error)
    throw error
  }
}

/**
 * Get video stream URL for a specific item
 * Always uses direct download - HLS generation appears broken in Jellyfin
 * @param itemId - The video item ID
 * @param videoItem - Optional video item (unused)
 */
export function getVideoStreamUrl(itemId: string, videoItem?: JellyfinVideoItem | null): string {
  // Use direct download endpoint
  // HLS with Static=true fails with CoreMediaErrorDomain -12971
  // This suggests Jellyfin HLS generation has issues with this video
  return `${cachedConfig.server}/Items/${itemId}/Download?api_key=${cachedConfig.apiKey}`
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
export async function getTranscodingStreamUrl(itemId: string, videoItem?: JellyfinVideoItem | null): Promise<string> {
  // Get user's quality preferences
  const quality = await getQualitySettings()

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
    `&RequireAvc=true` // Force H.264/AVC output

  // Check for external subtitles and burn them in
  if (videoItem && videoItem.MediaStreams) {
    const subtitleStreams = videoItem.MediaStreams.filter(
      stream => stream.Type === "Subtitle" && stream.IsExternal && stream.Index !== undefined
    )

    if (subtitleStreams.length > 0) {
      const firstSubIndex = subtitleStreams[0].Index
      url += `&SubtitleStreamIndex=${firstSubIndex}`
      url += `&SubtitleMethod=Encode` // Burn subtitles into video frames
      console.log(`[JellyfinAPI] Transcoding with subtitle burn-in (stream ${firstSubIndex}, ${quality.label} @ ${quality.bitrate / 1000000}Mbps)`)
    } else {
      console.log(`[JellyfinAPI] Transcoding without subtitles (${quality.label} @ ${quality.bitrate / 1000000}Mbps)`)
    }
  }

  return url
}

/**
 * Get poster image URL for a specific item
 * Posters are better for movie/video displays (2:3 aspect ratio)
 */
export function getPosterUrl(itemId: string, maxHeight: number = 450): string {
  return `${cachedConfig.server}/Items/${itemId}/Images/Primary?api_key=${cachedConfig.apiKey}&maxHeight=${maxHeight}&quality=90`
}

/**
 * Check if item has a poster image
 */
export function hasPoster(item: JellyfinVideoItem): boolean {
  return item.ImageTags?.Primary !== undefined
}

/**
 * Format duration from RunTimeTicks to readable format
 * RunTimeTicks are in 100-nanosecond intervals
 * @param ticks - RunTimeTicks from Jellyfin
 * @returns Formatted string like "1h 23m" or "45m"
 */
export function formatDuration(ticks: number): string {
  const totalSeconds = ticks / 10000000
  const totalMinutes = Math.floor(totalSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

/**
 * Fetch detailed video item information including media streams
 */
export async function fetchVideoDetails(itemId: string): Promise<JellyfinVideoItem | null> {
  try {
    const config = await getConfig()
    const url = `${config.server}/Users/${config.userId}/Items/${itemId}?api_key=${config.apiKey}&Fields=Path,MediaStreams,Overview,MediaSources`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch video details: ${response.status} ${response.statusText}`)
    }

    const data: JellyfinVideoItem = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching video details from Jellyfin:", error)
    return null
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
  const codecLower = codec.toLowerCase()

  // Supported codecs
  if (codecLower.includes("h264") || codecLower.includes("avc")) {
    return true // H.264/AVC is universally supported
  }

  if (codecLower.includes("hevc") || codecLower.includes("h265")) {
    return true // HEVC is supported on modern iOS/tvOS devices
  }

  // Unsupported codecs that need transcoding
  if (codecLower.includes("mpeg4") || codecLower.includes("mpeg-4")) {
    return false // MPEG-4 Part 2 (old codec) not supported - causes black screen
  }

  if (codecLower.includes("vp8") || codecLower.includes("vp9")) {
    return false // VP8/VP9 not supported
  }

  if (codecLower.includes("av1")) {
    return false // AV1 not supported yet
  }

  if (codecLower.includes("vc1") || codecLower.includes("wmv")) {
    return false // VC-1/WMV not supported
  }

  if (codecLower.includes("mpeg2")) {
    return false // MPEG-2 not supported
  }

  if (codecLower.includes("divx") || codecLower.includes("xvid")) {
    return false // DivX/Xvid not supported
  }

  // Default to unsupported for unknown codecs to be safe
  // Better to transcode unnecessarily than show black screen
  console.warn(`[CodecCheck] Unknown codec "${codec}", defaulting to transcoding for safety`)
  return false
}

/**
 * Check if item is audio-only (no video stream)
 * Audio-only files should be handled differently or filtered out
 */
export function isAudioOnly(videoItem: JellyfinVideoItem | null): boolean {
  if (!videoItem || !videoItem.MediaStreams) {
    return false
  }

  // Check if there's a video stream
  const hasVideo = videoItem.MediaStreams.some(stream => stream.Type === "Video")
  const hasAudio = videoItem.MediaStreams.some(stream => stream.Type === "Audio")

  // Audio-only: has audio but no video
  return !hasVideo && hasAudio
}

/**
 * Check if video needs transcoding based on its codec
 * Returns true if transcoding is required, false if direct play is supported
 */
export function needsTranscoding(videoItem: JellyfinVideoItem | null): boolean {
  if (!videoItem || !videoItem.MediaStreams) {
    return false // Default to direct play if no info available
  }

  // Find the video stream
  const videoStream = videoItem.MediaStreams.find(stream => stream.Type === "Video")

  if (!videoStream || !videoStream.Codec) {
    return false // No video stream info, try direct play
  }

  const supported = isCodecSupported(videoStream.Codec)

  console.log(`[CodecCheck] Video codec: ${videoStream.Codec}, Supported: ${supported}`)

  return !supported
}

/**
 * Subtitle track interface for expo-video
 * These tracks are passed to VideoSource.subtitleTracks
 */
export interface SubtitleTrack {
  uri: string
  language: string
  label: string
  type: "text/vtt" | "text/srt"
}

/**
 * Get all subtitle tracks available for a video
 * Returns external subtitle files in VTT format for expo-video
 */
export function getSubtitleTracks(videoItem: JellyfinVideoItem | null): SubtitleTrack[] {
  if (!videoItem || !videoItem.MediaStreams) {
    return []
  }

  // Find all subtitle streams
  const subtitleStreams = videoItem.MediaStreams.filter(stream => stream.Type === "Subtitle")

  if (subtitleStreams.length === 0) {
    return []
  }

  const tracks: SubtitleTrack[] = []

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
        type: "text/vtt" // Always VTT since we request .vtt format
      }
      tracks.push(track)
      console.log(`[Subtitles] Found external subtitle: ${track.label} (${track.language}) - ${track.uri}`)
    }
  }

  return tracks
}

/**
 * Get subtitle URL for a specific stream index
 * @param itemId - The video item ID
 * @param streamIndex - The subtitle stream index from MediaStreams
 * @param format - Subtitle format (default: 'vtt' for best compatibility)
 */
export function getSubtitleUrl(itemId: string, streamIndex: number, format: string = "vtt"): string {
  // Jellyfin subtitle stream endpoint (from SubtitleController.cs)
  // Format: /Videos/{itemId}/{mediaSourceId}/Subtitles/{index}/Stream.{format}
  // The format extension is required (e.g., .vtt, .srt)
  // For most cases, mediaSourceId is the same as itemId
  // VTT format is preferred as it works better with HTML5 video players
  return `${cachedConfig.server}/Videos/${itemId}/${itemId}/Subtitles/${streamIndex}/Stream.${format}?api_key=${cachedConfig.apiKey}`
}
