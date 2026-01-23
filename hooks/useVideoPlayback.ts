import { useEffect, useState, useMemo, useRef, useCallback, useReducer } from "react";
import type { VideoRef, OnLoadData, OnProgressData, OnVideoErrorData, AudioTrack, TextTrack } from "react-native-video";
import { InteractionManager } from "react-native";
import { fetchVideoDetails, needsTranscoding, isAudioOnly, getSubtitleTracks, getAudioTracks, getVideoStreamUrl, getTranscodingStreamUrl, isDemoMode, connectToDemoServer, refreshConfig, getConfig } from "@/services/jellyfinApi";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { logger } from "@/utils/logger";
import { prepareMultiAudioPlayback, shouldUseMultiAudio, isMultiAudioAvailable } from "@/services/multiAudioLoader";

/**
 * Error types for video playback classification
 * Using specific patterns instead of loose string matching
 */
export enum PlaybackErrorType {
  NOT_FOUND = "NOT_FOUND",
  UNAUTHORIZED = "UNAUTHORIZED",
  NETWORK = "NETWORK",
  TIMEOUT = "TIMEOUT",
  CORRUPT = "CORRUPT",
  DECODE = "DECODE",
  UNKNOWN = "UNKNOWN",
}

// Patterns for classifying errors - order matters (more specific first)
const ERROR_PATTERNS: { type: PlaybackErrorType; patterns: RegExp[] }[] = [
  {
    type: PlaybackErrorType.NOT_FOUND,
    patterns: [/not found/i, /404/i, /item.*not.*exist/i],
  },
  {
    type: PlaybackErrorType.UNAUTHORIZED,
    patterns: [
      /unauthorized/i,
      /401/i,
      /not authorized/i,
      /authentication.*fail/i,
      /invalid.*credentials/i,
      /error -1013/i, // NSURLErrorResourceUnavailable (often indicates 401/403)
    ],
  },
  {
    type: PlaybackErrorType.TIMEOUT,
    patterns: [/timed?\s*out/i, /timeout/i, /etimedout/i],
  },
  {
    type: PlaybackErrorType.CORRUPT,
    patterns: [/HostFunction/i, /corrupted/i, /invalid.*format/i, /invalid.*data/i],
  },
  {
    type: PlaybackErrorType.DECODE,
    patterns: [/decode/i, /codec.*not.*supported/i, /unable.*play/i],
  },
  {
    type: PlaybackErrorType.NETWORK,
    patterns: [
      /network\s*(error|fail|issue)/i,
      /fetch\s*(error|fail)/i,
      /connection\s*(refused|reset|closed)/i,
      /econnreset/i,
      /econnrefused/i,
      /unable.*connect/i,
    ],
  },
];

/**
 * Classifies an error into a specific type using pattern matching
 * More reliable than loose includes() checks
 */
export function classifyPlaybackError(error: unknown): PlaybackErrorType {
  if (!error) return PlaybackErrorType.UNKNOWN;

  // Extract error message from Error instances, plain objects with message property, or convert to string
  let errorMessage: string;
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    errorMessage = String((error as { message: unknown }).message);
  } else {
    errorMessage = String(error);
  }

  for (const { type, patterns } of ERROR_PATTERNS) {
    if (patterns.some(pattern => pattern.test(errorMessage))) {
      return type;
    }
  }

  return PlaybackErrorType.UNKNOWN;
}

/**
 * Gets a user-friendly error message based on error type
 */
export function getPlaybackErrorMessage(errorType: PlaybackErrorType, originalError?: string): string {
  switch (errorType) {
    case PlaybackErrorType.NOT_FOUND:
      return "Video not found on server";
    case PlaybackErrorType.UNAUTHORIZED:
      return "Authentication failed. Your session may have expired.";
    case PlaybackErrorType.NETWORK:
      return "Unable to connect to Jellyfin server";
    case PlaybackErrorType.TIMEOUT:
      return "Connection timed out. Please check your network";
    case PlaybackErrorType.CORRUPT:
      return "This video file appears to be corrupted or in an unsupported format";
    case PlaybackErrorType.DECODE:
      return "Unable to decode video. Try a different quality setting";
    case PlaybackErrorType.UNKNOWN:
    default:
      return originalError ? `Playback error: ${originalError}` : "Failed to load video";
  }
}

export type PlaybackMode = "direct" | "transcode";

/**
 * Video player state machine
 * State transitions:
 * IDLE → FETCHING_METADATA → CREATING_STREAM → INITIALIZING_PLAYER → READY → PLAYING
 *                                                                           ↓
 *                                                                        ERROR
 */
export type VideoPlayerState =
  | { type: "IDLE" }
  | { type: "FETCHING_METADATA" }
  | { type: "CREATING_STREAM"; mode: PlaybackMode; details: JellyfinVideoItem; hasSubtitles: boolean }
  | { type: "INITIALIZING_PLAYER"; mode: PlaybackMode; streamUrl: string }
  | { type: "READY"; mode: PlaybackMode }
  | { type: "PLAYING"; mode: PlaybackMode }
  | { type: "ERROR"; error: string; canRetryWithTranscode: boolean };

export type VideoPlayerAction =
  | { type: "FETCH_METADATA" }
  | { type: "METADATA_FETCHED"; details: JellyfinVideoItem; mode: PlaybackMode; hasSubtitles: boolean }
  | { type: "STREAM_CREATED"; streamUrl: string }
  | { type: "PLAYER_READY" }
  | { type: "PLAYER_PLAYING" }
  | { type: "PLAYER_ERROR"; error: any; mode: PlaybackMode; hasTriedTranscode: boolean }
  | { type: "RETRY" }
  | { type: "RETRY_WITH_TRANSCODE" };

export interface VideoPlaybackConfig {
  videoId: string;
  onPlaybackEnd?: () => void;
}

export interface VideoPlaybackResult {
  // Player ref for Video component
  videoRef: React.RefObject<VideoRef | null>;

  // Source URI for Video component
  sourceUri: string | null;

  // Paused state for Video component
  paused: boolean;

  // Video component event callbacks
  videoCallbacks: {
    onLoad: (data: OnLoadData) => void;
    onProgress: (data: OnProgressData) => void;
    onError: (error: OnVideoErrorData) => void;
    onEnd: () => void;
    onAudioTracks: (data: { audioTracks: AudioTrack[] }) => void;
    onTextTracks: (data: { textTracks: TextTrack[] }) => void;
  };

  // State machine state
  state: VideoPlayerState;

  // Video details
  videoDetails: JellyfinVideoItem | null;

  // Media type
  isAudioOnly: boolean;

  // UI helpers
  isLoading: boolean;
  showLoadingOverlay: boolean;

  // Playback control
  play: () => void;
  pause: () => void;

  // Actions
  retry: () => void;
}

/**
 * State machine reducer for video playback
 */
export function videoPlayerReducer(state: VideoPlayerState, action: VideoPlayerAction): VideoPlayerState {
  logger.debug("State machine transition", {
    service: "VideoStateMachine",
    from: state.type,
    to: action.type,
  });

  switch (action.type) {
    case "FETCH_METADATA":
      return { type: "FETCHING_METADATA" };

    case "METADATA_FETCHED":
      return {
        type: "CREATING_STREAM",
        mode: action.mode,
        details: action.details,
        hasSubtitles: action.hasSubtitles,
      };

    case "STREAM_CREATED":
      if (state.type !== "CREATING_STREAM") return state;
      return {
        type: "INITIALIZING_PLAYER",
        mode: state.mode,
        streamUrl: action.streamUrl,
      };

    case "PLAYER_READY":
      if (state.type !== "INITIALIZING_PLAYER") return state;
      return {
        type: "READY",
        mode: state.mode,
      };

    case "PLAYER_PLAYING":
      if (state.type !== "READY" && state.type !== "PLAYING") return state;
      return {
        type: "PLAYING",
        mode: state.mode,
      };

    case "PLAYER_ERROR": {
      const canRetry = action.mode === "direct" && !action.hasTriedTranscode;
      const errorMsg = action.error?.message || "Failed to load video";
      return {
        type: "ERROR",
        error: errorMsg,
        canRetryWithTranscode: canRetry,
      };
    }

    case "RETRY":
      return { type: "IDLE" };

    case "RETRY_WITH_TRANSCODE":
      return { type: "FETCHING_METADATA" };

    default:
      return state;
  }
}

/**
 * Custom hook to manage video playback logic using a state machine
 * Handles codec checking, transcoding decisions, and player lifecycle
 */
export function useVideoPlayback(config: VideoPlaybackConfig): VideoPlaybackResult {
  const { videoId, onPlaybackEnd } = config;

  // State machine
  const [state, dispatch] = useReducer(videoPlayerReducer, { type: "IDLE" });

  // Persistent data across states
  const [videoDetails, setVideoDetails] = useState<JellyfinVideoItem | null>(null);
  const [hasTriedTranscoding, setHasTriedTranscoding] = useState(false);
  const [hasTriedCredentialRefresh, setHasTriedCredentialRefresh] = useState(false);

  // Request ID to prevent race conditions when videoId changes
  // Incremented on each videoId change, async operations check before updating state
  const requestIdRef = useRef(0);

  // === Refs for synchronous access in event handlers ===
  // Note: These refs cannot be consolidated into state because event handlers
  // need synchronous access to avoid race conditions and stale closures.

  // Lifecycle & autoplay control
  const autoPlayTriggeredRef = useRef(false);
  const isMountedRef = useRef(true);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stablePlaybackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Status tracking (for debouncing rapid status changes)
  const isSeekingRef = useRef(false);
  const lastStatusChangeRef = useRef<number>(0);
  const hasStablePlaybackRef = useRef(false); // Ref for sync access in handlers

  // Playback mode & callbacks (avoid stale closures in event listeners)
  const currentModeRef = useRef<PlaybackMode>("direct");
  const onPlaybackEndRef = useRef(onPlaybackEnd);
  onPlaybackEndRef.current = onPlaybackEnd;

  // Track stable playback for UI (state triggers re-renders, ref is for sync checks)
  const [hasStablePlayback, setHasStablePlayback] = useState(false);

  /**
   * Step 1: Fetch video metadata and determine playback mode
   */
  const fetchMetadata = useCallback(async () => {
    // Capture current request ID to check for stale responses
    const currentRequestId = requestIdRef.current;

    logger.debug("Fetching video details", { service: "useVideoPlayback", videoId, requestId: currentRequestId });

    try {
      const details = await fetchVideoDetails(videoId);

      // Check if this response is stale (videoId changed while fetching)
      if (requestIdRef.current !== currentRequestId) {
        logger.debug("Ignoring stale metadata response", {
          service: "useVideoPlayback",
          expectedRequestId: requestIdRef.current,
          actualRequestId: currentRequestId,
        });
        return;
      }

      if (!details) {
        throw new Error("Video not found or unavailable");
      }

      setVideoDetails(details);

      // Check if this is an audio-only file
      const audioOnly = isAudioOnly(details);
      if (audioOnly) {
        logger.debug("Audio-only file detected - will use direct play", { service: "useVideoPlayback" });
      }

      // Check codec compatibility (skip for audio-only files)
      const requiresTranscoding = audioOnly ? false : needsTranscoding(details);

      // Check for external subtitles
      const subtitles = getSubtitleTracks(details);
      const hasExternalSubs = subtitles.length > 0;

      // Determine playback mode - force transcode on retry
      let selectedMode: PlaybackMode = "direct";

      if (requiresTranscoding || hasExternalSubs || hasTriedTranscoding) {
        selectedMode = "transcode";

        if (requiresTranscoding) {
          logger.info("Codec not supported, using transcoding", { service: "useVideoPlayback" });
        }
        if (hasExternalSubs) {
          logger.info("Found external subtitles, using HLS with subtitle tracks", {
            service: "useVideoPlayback",
            subtitleCount: subtitles.length,
          });
        }
        if (hasTriedTranscoding) {
          logger.info("Retrying with transcoding", { service: "useVideoPlayback" });
        }
      } else {
        logger.info("Using direct play", { service: "useVideoPlayback" });
      }

      // Update mode ref before dispatch (for event listener closures)
      currentModeRef.current = selectedMode;

      dispatch({
        type: "METADATA_FETCHED",
        details,
        mode: selectedMode,
        hasSubtitles: hasExternalSubs,
      });

      if (selectedMode === "transcode") {
        setHasTriedTranscoding(true);
      }
    } catch (err) {
      logger.error("Error fetching metadata", err, { service: "useVideoPlayback", videoId });

      // Classify error and provide user-friendly message
      const errorType = classifyPlaybackError(err);
      const originalMessage = err instanceof Error ? err.message : undefined;
      const errorMessage = getPlaybackErrorMessage(errorType, originalMessage);

      dispatch({
        type: "PLAYER_ERROR",
        error: { message: errorMessage },
        mode: "direct",
        hasTriedTranscode: hasTriedTranscoding,
      });
    }
  }, [videoId, hasTriedTranscoding]);

  /**
   * Store streamUrl in state to keep it stable across state transitions
   */
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  /**
   * Step 2: Generate stream URL when in CREATING_STREAM state
   */
  useEffect(() => {
    if (state.type !== "CREATING_STREAM") return;

    const { mode, details } = state;
    // Capture current request ID to check for stale responses
    const currentRequestId = requestIdRef.current;

    const generateStreamUrl = async () => {
      try {
        let url: string;

        if (mode === "transcode") {
          // Check if we should use multi-audio custom protocol
          const useMultiAudio = isMultiAudioAvailable() && shouldUseMultiAudio(details);

          if (useMultiAudio) {
            // Use multi-audio loader for seamless track switching
            logger.info("Using multi-audio custom protocol", {
              service: "useVideoPlayback",
              audioTrackCount: getAudioTracks(details).length,
            });

            // First get the base transcoding URL
            const baseUrl = await getTranscodingStreamUrl(videoId, details);

            // Then prepare multi-audio playback with custom protocol
            const cachedConfig = await getConfig();

            url = await prepareMultiAudioPlayback(
              videoId,
              details,
              baseUrl,
              cachedConfig.apiKey
            );
          } else {
            // Regular transcoding
            url = await getTranscodingStreamUrl(videoId, details);
          }
        } else {
          // Direct play
          url = getVideoStreamUrl(videoId);
        }

        // Check if this response is stale (videoId changed while fetching)
        if (requestIdRef.current !== currentRequestId) {
          logger.debug("Ignoring stale stream URL response", { service: "useVideoPlayback" });
          return;
        }

        logger.info("Stream URL generated", {
          service: "useVideoPlayback",
          mode: mode.toUpperCase(),
          streamType: url.includes(".m3u8") ? "HLS" : "Direct",
          isMultiAudio: url.includes("jellyfin-multi://"),
        });

        if (!url) {
          throw new Error("Failed to generate stream URL");
        }

        setStreamUrl(url);
        dispatch({ type: "STREAM_CREATED", streamUrl: url });

        // Log available tracks when using HLS transcoding
        if (mode === "transcode" && details) {
          const subtitles = getSubtitleTracks(details);
          const audioTracks = getAudioTracks(details);

          if (subtitles.length > 0 || audioTracks.length > 0) {
            logger.debug("Available tracks in HLS stream", {
              service: "useVideoPlayback",
              subtitleCount: subtitles.length,
              audioTrackCount: audioTracks.length,
              subtitleLanguages: subtitles.map(s => s.language).join(", "),
              audioLanguages: audioTracks.map(a => a.language).join(", "),
            });
          }
        }
      } catch (error) {
        // Check for stale response before dispatching error
        if (requestIdRef.current !== currentRequestId) {
          return;
        }

        logger.error("Error generating stream URL", error, { service: "useVideoPlayback" });

        dispatch({
          type: "PLAYER_ERROR",
          error: {
            message: "Failed to create video stream. Please check your settings.",
          },
          mode,
          hasTriedTranscode: hasTriedTranscoding,
        });
      }
    };

    generateStreamUrl();
  }, [state, videoId, hasTriedTranscoding]);

  /**
   * Step 3: Create video ref for Video component
   */
  const videoRef = useRef<VideoRef>(null);

  /**
   * Step 4: Playback state management
   * Store state that we need for control and callbacks
   */
  const [paused, setPaused] = useState(true); // Start paused, will auto-play on load
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const isPlayingRef = useRef(false);

  /**
   * Step 5: Video event callbacks (replacing player.addListener calls)
   */

  // Callback: Video loaded and ready
  const onLoad = useCallback((data: OnLoadData) => {
    if (!isMountedRef.current) return;

    durationRef.current = data.duration;

    logger.debug("Player loaded and ready", {
      service: "useVideoPlayback",
      duration: data.duration,
    });

    // Ensure state update happens on main thread via InteractionManager
    InteractionManager.runAfterInteractions(() => {
      if (!isMountedRef.current) return;
      dispatch({ type: "PLAYER_READY" });
    });

    // Auto-play on first load
    if (!autoPlayTriggeredRef.current && isMountedRef.current) {
      logger.debug("Scheduling auto-play", { service: "useVideoPlayback" });

      // Clear any existing timer
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
      }

      // Use InteractionManager to ensure play() is called after interactions complete
      autoPlayTimerRef.current = setTimeout(() => {
        if (!isMountedRef.current) {
          logger.debug("Component unmounted, skipping auto-play", { service: "useVideoPlayback" });
          return;
        }

        InteractionManager.runAfterInteractions(() => {
          if (!isMountedRef.current) return;

          try {
            logger.debug("Auto-playing video", { service: "useVideoPlayback" });
            setPaused(false);
            // Only mark as triggered after successful play
            autoPlayTriggeredRef.current = true;
          } catch (error) {
            logger.error("Error auto-playing", error, { service: "useVideoPlayback" });
            // Dispatch error on main thread
            InteractionManager.runAfterInteractions(() => {
              if (!isMountedRef.current) return;
              dispatch({
                type: "PLAYER_ERROR",
                error: {
                  message: "Failed to start video playback. The video file may be corrupted or incompatible.",
                },
                mode: currentModeRef.current,
                hasTriedTranscode: hasTriedTranscoding,
              });
            });
          }
        });

        autoPlayTimerRef.current = null;
      }, 100);
    }
  }, [hasTriedTranscoding]);

  // Callback: Video progress update
  const onProgress = useCallback((data: OnProgressData) => {
    if (!isMountedRef.current) return;

    currentTimeRef.current = data.currentTime;

    // Update playing state
    const nowPlaying = !paused;
    const wasPlaying = isPlayingRef.current;

    if (nowPlaying !== wasPlaying) {
      isPlayingRef.current = nowPlaying;

      if (nowPlaying) {
        // Video started playing
        if (!hasStablePlaybackRef.current) {
          InteractionManager.runAfterInteractions(() => {
            if (!isMountedRef.current) return;
            dispatch({ type: "PLAYER_PLAYING" });
          });

          // Start stable playback detection after video starts playing
          if (stablePlaybackTimerRef.current) {
            clearTimeout(stablePlaybackTimerRef.current);
          }

          stablePlaybackTimerRef.current = setTimeout(() => {
            if (isMountedRef.current && isPlayingRef.current) {
              logger.debug("Stable playback detected, hiding spinner", { service: "useVideoPlayback" });
              hasStablePlaybackRef.current = true;
              InteractionManager.runAfterInteractions(() => {
                if (!isMountedRef.current) return;
                setHasStablePlayback(true);
              });
              stablePlaybackTimerRef.current = null;
            }
          }, 500);
        }
      } else {
        // Video paused or stopped, clear the stable playback timer
        if (stablePlaybackTimerRef.current && !hasStablePlaybackRef.current) {
          clearTimeout(stablePlaybackTimerRef.current);
          stablePlaybackTimerRef.current = null;
        }
      }
    }
  }, [paused, hasTriedTranscoding]);

  // Callback: Video playback ended
  const onEnd = useCallback(() => {
    if (!isMountedRef.current) return;

    logger.info("Video playback ended, triggering callback", { service: "useVideoPlayback" });
    InteractionManager.runAfterInteractions(() => {
      if (!isMountedRef.current) return;
      onPlaybackEndRef.current?.();
    });
  }, []);

  // Callback: Video error
  const onError = useCallback((error: OnVideoErrorData) => {
    if (!isMountedRef.current) return;

    const currentMode = currentModeRef.current;
    const willRetryWithTranscode = currentMode === "direct" && !hasTriedTranscoding;

    // Classify error first to determine if it's a 401
    const errorType = classifyPlaybackError(error.error);
    // Extract error message from react-native-video error object
    const originalMessage =
      error.error?.localizedDescription ||
      error.error?.message ||
      error.error?.errorString ||
      String(error.error || "");

    logger.debug("Error classified", {
      service: "useVideoPlayback",
      errorType,
      willRetryWithTranscode,
      hasTriedCredentialRefresh,
    });

    // Check if this is a 401 error in demo mode - try refreshing credentials
    const is401Error = errorType === PlaybackErrorType.UNAUTHORIZED;

    if (is401Error && !hasTriedCredentialRefresh) {
      logger.info("Authentication error detected, attempting to refresh demo credentials", {
        service: "useVideoPlayback",
        error: originalMessage,
      });

      // Try to refresh demo credentials and retry playback
      (async () => {
        try {
          const inDemoMode = await isDemoMode();
          if (inDemoMode) {
            logger.info("Reconnecting to demo server for fresh credentials", {
              service: "useVideoPlayback",
            });

            // Pass false to preserve folder navigation and library state
            await connectToDemoServer(false);
            await refreshConfig();

            logger.info("Demo credentials refreshed, retrying playback", {
              service: "useVideoPlayback",
            });

            // Mark that we tried credential refresh
            setHasTriedCredentialRefresh(true);

            // Retry playback by resetting state
            InteractionManager.runAfterInteractions(() => {
              if (!isMountedRef.current) return;
              dispatch({ type: "RETRY" });
            });

            return;
          }
        } catch (error) {
          logger.error("Failed to refresh demo credentials", error, {
            service: "useVideoPlayback",
          });
        }

        // If not in demo mode or refresh failed, show the error
        const errorMessage = getPlaybackErrorMessage(errorType, originalMessage);
        InteractionManager.runAfterInteractions(() => {
          if (!isMountedRef.current) return;
          dispatch({
            type: "PLAYER_ERROR",
            error: { message: errorMessage },
            mode: currentMode,
            hasTriedTranscode: hasTriedTranscoding,
          });
        });
      })();

      return;
    }

    // Log at INFO level if we'll auto-retry, ERROR level if this is a real failure
    if (willRetryWithTranscode) {
      logger.info("Direct play failed, will retry with transcoding", error, { service: "useVideoPlayback" });
    } else {
      logger.error("Playback error", error, { service: "useVideoPlayback" });
    }

    const errorMessage = getPlaybackErrorMessage(errorType, originalMessage);

    // Ensure error dispatch happens on main thread
    InteractionManager.runAfterInteractions(() => {
      if (!isMountedRef.current) return;
      dispatch({
        type: "PLAYER_ERROR",
        error: { message: errorMessage },
        mode: currentMode,
        hasTriedTranscode: hasTriedTranscoding,
      });
    });
  }, [hasTriedTranscoding, hasTriedCredentialRefresh]);

  // Callback: Audio tracks discovered
  const onAudioTracks = useCallback((data: { audioTracks: AudioTrack[] }) => {
    if (!isMountedRef.current) return;

    logger.info("Audio tracks discovered from HLS manifest", {
      service: "useVideoPlayback",
      trackCount: data.audioTracks.length,
      tracks: data.audioTracks.map(t => ({
        index: t.index,
        title: t.title,
        language: t.language,
        type: t.type,
      })),
    });
  }, []);

  // Callback: Text tracks (subtitles) discovered
  const onTextTracks = useCallback((data: { textTracks: TextTrack[] }) => {
    if (!isMountedRef.current) return;

    logger.info("Subtitle tracks discovered from HLS manifest", {
      service: "useVideoPlayback",
      trackCount: data.textTracks.length,
      tracks: data.textTracks.map(t => ({
        index: t.index,
        title: t.title,
        language: t.language,
        type: t.type,
      })),
    });
  }, []);

  /**
   * Setup and cleanup on mount/unmount
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      // Clear timers
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      if (stablePlaybackTimerRef.current) {
        clearTimeout(stablePlaybackTimerRef.current);
        stablePlaybackTimerRef.current = null;
      }

      // Stop playback on unmount
      setPaused(true);
    };
  }, []);

  /**
   * Reset state when video ID changes
   */
  useEffect(() => {
    // Increment request ID to invalidate any in-flight async operations
    requestIdRef.current += 1;

    // Clear any pending timers
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (stablePlaybackTimerRef.current) {
      clearTimeout(stablePlaybackTimerRef.current);
      stablePlaybackTimerRef.current = null;
    }

    dispatch({ type: "RETRY" });
    setVideoDetails(null);
    setStreamUrl(null);
    setHasTriedTranscoding(false);
    setHasTriedCredentialRefresh(false);
    setHasStablePlayback(false);
    hasStablePlaybackRef.current = false;
    autoPlayTriggeredRef.current = false;
    isSeekingRef.current = false;
    lastStatusChangeRef.current = 0;
    currentModeRef.current = "direct";
  }, [videoId]);

  /**
   * Start metadata fetch when in IDLE or FETCHING_METADATA state
   */
  useEffect(() => {
    if (state.type === "IDLE") {
      dispatch({ type: "FETCH_METADATA" });
    } else if (state.type === "FETCHING_METADATA") {
      fetchMetadata();
    }
  }, [state.type, fetchMetadata]);


  /**
   * Handle retry with transcoding when direct play fails
   */
  useEffect(() => {
    if (state.type !== "ERROR" || !state.canRetryWithTranscode || !isMountedRef.current) return;

    // Don't auto-retry if error message suggests file is corrupted
    const isCorruptedFile = state.error.includes("corrupted") || state.error.includes("HostFunction") || state.error.includes("invalid");

    if (isCorruptedFile) {
      logger.warn("File appears corrupted, skipping auto-retry with transcoding", { service: "useVideoPlayback" });
      // Don't auto-retry, let user manually retry or go back
      return;
    }

    // Note: Already logged in player error handler above
    setHasTriedTranscoding(true);
    autoPlayTriggeredRef.current = false;

    // Clear streamUrl to unmount Video component during retry
    // This prevents the old URL from firing additional errors
    setStreamUrl(null);

    // Auto-retry with transcoding
    const retryTimer = setTimeout(() => {
      if (isMountedRef.current) {
        dispatch({ type: "RETRY_WITH_TRANSCODE" });
      }
    }, 500);

    return () => clearTimeout(retryTimer);
  }, [state]);

  /**
   * Playback control functions
   */
  const play = useCallback(() => {
    setPaused(false);
  }, []);

  const pause = useCallback(() => {
    setPaused(true);
  }, []);

  /**
   * Retry playback from the beginning
   */
  const retry = useCallback(() => {
    // Clear any pending timers
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (stablePlaybackTimerRef.current) {
      clearTimeout(stablePlaybackTimerRef.current);
      stablePlaybackTimerRef.current = null;
    }

    setHasTriedTranscoding(false);
    setHasStablePlayback(false);
    hasStablePlaybackRef.current = false;
    autoPlayTriggeredRef.current = false;
    dispatch({ type: "RETRY" });
  }, []);

  /**
   * Compute UI state from state machine
   */
  // Check if current video is audio-only
  const isAudioOnlyFile = videoDetails ? isAudioOnly(videoDetails) : false;

  const isLoading =
    state.type === "FETCHING_METADATA" ||
    state.type === "CREATING_STREAM" ||
    state.type === "INITIALIZING_PLAYER" ||
    state.type === "READY" ||
    (state.type === "PLAYING" && !hasStablePlayback);

  const showLoadingOverlay = isLoading;

  /**
   * Video callbacks object for Video component props
   */
  const videoCallbacks = useMemo(() => ({
    onLoad,
    onProgress,
    onError,
    onEnd,
    onAudioTracks,
    onTextTracks,
  }), [onLoad, onProgress, onError, onEnd, onAudioTracks, onTextTracks]);

  return {
    videoRef,
    sourceUri: streamUrl,
    paused,
    videoCallbacks,
    state,
    videoDetails,
    isAudioOnly: isAudioOnlyFile,
    isLoading,
    showLoadingOverlay,
    play,
    pause,
    retry,
  };
}
