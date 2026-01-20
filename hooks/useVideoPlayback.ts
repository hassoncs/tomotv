import { useEffect, useState, useMemo, useRef, useCallback, useReducer } from "react";
import { useVideoPlayer, VideoSource } from "expo-video";
import { InteractionManager } from "react-native";
import { fetchVideoDetails, needsTranscoding, isAudioOnly, getSubtitleTracks, getVideoStreamUrl, getTranscodingStreamUrl, isDemoMode, connectToDemoServer, refreshConfig } from "@/services/jellyfinApi";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { logger } from "@/utils/logger";

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
  // Player instance
  player: ReturnType<typeof useVideoPlayer>;

  // State machine state
  state: VideoPlayerState;

  // Video details
  videoDetails: JellyfinVideoItem | null;

  // Media type
  isAudioOnly: boolean;

  // UI helpers
  isLoading: boolean;
  showLoadingOverlay: boolean;

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
          logger.info("Found subtitles, using HLS with burn-in", {
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
        const url = mode === "transcode" ? await getTranscodingStreamUrl(videoId, details) : getVideoStreamUrl(videoId);

        // Check if this response is stale (videoId changed while fetching)
        if (requestIdRef.current !== currentRequestId) {
          logger.debug("Ignoring stale stream URL response", { service: "useVideoPlayback" });
          return;
        }

        logger.info("Stream URL generated", {
          service: "useVideoPlayback",
          mode: mode.toUpperCase(),
          streamType: url.includes(".m3u8") ? "HLS" : "Direct",
        });

        if (!url) {
          throw new Error("Failed to generate stream URL");
        }

        setStreamUrl(url);
        dispatch({ type: "STREAM_CREATED", streamUrl: url });
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
   * Step 3: Create video source for player
   * Keep it stable once created by using state instead of deriving from current state.type
   */
  const videoSource: VideoSource | null = useMemo(() => {
    if (!streamUrl) {
      return null;
    }

    const source: VideoSource = {
      uri: streamUrl,
      contentType: streamUrl.includes(".m3u8") ? "hls" : "auto",
    };

    logger.debug("Video source created", { service: "useVideoPlayback" });
    return source;
  }, [streamUrl]);

  /**
   * Step 4: Initialize player with video source
   */
  const player = useVideoPlayer(videoSource, (player) => {
    if (!videoSource) return;
    player.loop = false;
    logger.debug("Player initialized", { service: "useVideoPlayback" });
  });

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

      // Stop playback on unmount - useVideoPlayer handles cleanup automatically
      if (player) {
        try {
          player.pause();
        } catch (_error) {
          // Silently ignore - player may already be deallocated by native side
        }
      }
    };
  }, [player]);

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
   * Step 5: Handle player events and auto-play
   * Note: Attach listeners once when player and videoSource are ready, keep them throughout lifecycle
   */
  useEffect(() => {
    if (!player || !videoSource) return;

    logger.debug("Attaching player event listeners", { service: "useVideoPlayback" });

    const statusSubscription = player.addListener("statusChange", (payload) => {
      if (!isMountedRef.current) return;

      const now = Date.now();
      const timeSinceLastChange = now - lastStatusChangeRef.current;
      lastStatusChangeRef.current = now;

      // Track seeking state - rapid loading/readyToPlay cycles indicate seeking
      if (payload.status === "loading") {
        isSeekingRef.current = hasStablePlaybackRef.current;
      }

      // Only log status changes if not in rapid seeking mode (debounce logs)
      if (!isSeekingRef.current || timeSinceLastChange > 500) {
        logger.debug("Player status change", { service: "useVideoPlayback", status: payload.status });
      }

      if (payload.status === "readyToPlay") {
        // Once stable playback is achieved, skip state machine transitions during seeking
        // This prevents excessive dispatches and InteractionManager overhead
        if (hasStablePlaybackRef.current) {
          // Clear seeking state - buffer complete
          isSeekingRef.current = false;
          return;
        }

        // Ensure state update happens on main thread via InteractionManager
        InteractionManager.runAfterInteractions(() => {
          if (!isMountedRef.current) return;
          dispatch({ type: "PLAYER_READY" });
        });

        // Auto-play on first ready
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
                logger.debug("Calling play()", { service: "useVideoPlayback" });
                player.play();
                // Only mark as triggered after successful play
                autoPlayTriggeredRef.current = true;
              } catch (error) {
                logger.error("Error calling play()", error, { service: "useVideoPlayback" });
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
      } else if (payload.status === "error") {
        const currentMode = currentModeRef.current;
        const willRetryWithTranscode = currentMode === "direct" && !hasTriedTranscoding;

        // Classify error first to determine if it's a 401
        const errorType = classifyPlaybackError(payload.error);
        const originalMessage = payload.error?.message || String(payload.error || "");

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
          logger.info("Direct play failed, will retry with transcoding", payload.error, { service: "useVideoPlayback" });
        } else {
          logger.error("Playback error", payload.error, { service: "useVideoPlayback" });
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
      }
    });

    const playingSubscription = player.addListener("playingChange", (payload) => {
      if (!isMountedRef.current) return;

      if (payload.isPlaying) {
        // Once stable playback achieved, skip redundant PLAYER_PLAYING dispatches
        // This prevents overhead during seeking/buffering cycles
        if (!hasStablePlaybackRef.current) {
          // Ensure state update happens on main thread
          InteractionManager.runAfterInteractions(() => {
            if (!isMountedRef.current) return;
            dispatch({ type: "PLAYER_PLAYING" });
          });

          // Start stable playback detection after video starts playing
          // Wait 500ms of continuous playback before hiding spinner
          if (stablePlaybackTimerRef.current) {
            clearTimeout(stablePlaybackTimerRef.current);
          }

          stablePlaybackTimerRef.current = setTimeout(() => {
            if (isMountedRef.current && player.playing) {
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

        // Check if video ended - when currentTime is near duration and not playing
        if (player.currentTime > 0 && player.duration > 0) {
          const timeRemaining = player.duration - player.currentTime;
          // Consider video ended if less than 1 second remaining
          if (timeRemaining < 1 && onPlaybackEndRef.current) {
            logger.info("Video playback ended, triggering callback", { service: "useVideoPlayback" });
            InteractionManager.runAfterInteractions(() => {
              if (!isMountedRef.current) return;
              onPlaybackEndRef.current?.();
            });
          }
        }
      }
    });

    return () => {
      // Clear timeouts if pending
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      if (stablePlaybackTimerRef.current) {
        clearTimeout(stablePlaybackTimerRef.current);
        stablePlaybackTimerRef.current = null;
      }

      // Remove subscriptions
      try {
        statusSubscription.remove();
        playingSubscription.remove();
      } catch (_error) {
        // Silently ignore subscription cleanup errors
      }
    };
  }, [player, videoSource, hasTriedTranscoding, videoDetails]); // Keep listeners stable, don't re-attach on hasStablePlayback change

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

    // Auto-retry with transcoding
    const retryTimer = setTimeout(() => {
      if (isMountedRef.current) {
        dispatch({ type: "RETRY_WITH_TRANSCODE" });
      }
    }, 500);

    return () => clearTimeout(retryTimer);
  }, [state]);

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

  return {
    player,
    state,
    videoDetails,
    isAudioOnly: isAudioOnlyFile,
    isLoading,
    showLoadingOverlay,
    retry,
  };
}
