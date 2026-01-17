import { useEffect, useState, useMemo, useRef, useCallback, useReducer } from "react";
import { useVideoPlayer, VideoSource } from "expo-video";
import { InteractionManager } from "react-native";
import { fetchVideoDetails, needsTranscoding, isAudioOnly, getSubtitleTracks, getVideoStreamUrl, getTranscodingStreamUrl } from "@/services/jellyfinApi";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { logger } from "@/utils/logger";

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

  // Refs to prevent duplicate operations and cleanup issues
  const autoPlayTriggeredRef = useRef(false);
  const isMountedRef = useRef(true);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stablePlaybackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStablePlaybackRef = useRef(false);

  // Ref to track if we're in seeking/buffering state to avoid excessive state transitions
  const isSeekingRef = useRef(false);
  const lastStatusChangeRef = useRef<number>(0);

  // Ref to track current playback mode (avoids stale closure in event listeners)
  const currentModeRef = useRef<PlaybackMode>("direct");

  // Ref for onPlaybackEnd callback (avoids stale closure in event listeners)
  const onPlaybackEndRef = useRef(onPlaybackEnd);
  onPlaybackEndRef.current = onPlaybackEnd;

  // Track stable playback to hide loading spinner at the right time
  const [hasStablePlayback, setHasStablePlayback] = useState(false);

  /**
   * Step 1: Fetch video metadata and determine playback mode
   */
  const fetchMetadata = useCallback(async () => {
    logger.debug("Fetching video details", { service: "useVideoPlayback", videoId });

    try {
      const details = await fetchVideoDetails(videoId);

      if (!details) {
        throw new Error("Video not found or unavailable");
      }

      setVideoDetails(details);

      // Check if this is an audio-only file
      const audioOnly = isAudioOnly(details);
      if (audioOnly) {
        console.log("[useVideoPlayback] Audio-only file detected - will use direct play");
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

      // Provide user-friendly error message
      const errorMessage =
        err instanceof Error
          ? err.message.includes("not found")
            ? "Video not found on server"
            : err.message.includes("network") || err.message.includes("fetch")
              ? "Unable to connect to Jellyfin server"
              : `Failed to load video details: ${err.message}`
          : "Failed to load video details";

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

    const generateStreamUrl = async () => {
      try {
        const url = mode === "transcode" ? await getTranscodingStreamUrl(videoId, details) : getVideoStreamUrl(videoId, details);

        logger.info("Stream URL generated", {
          service: "useVideoPlayback",
          mode: mode.toUpperCase(),
          url,
        });

        if (!url) {
          throw new Error("Failed to generate stream URL");
        }

        setStreamUrl(url);
        dispatch({ type: "STREAM_CREATED", streamUrl: url });
      } catch (error) {
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

        // Check if this is audio-only (skip auto-play for audio to avoid threading issues)
        const isAudio = videoDetails ? isAudioOnly(videoDetails) : false;

        // Auto-play on first ready (but skip for audio-only files)
        if (!autoPlayTriggeredRef.current && isMountedRef.current && !isAudio) {
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
        } else if (isAudio) {
          logger.info("Audio-only file - skipping auto-play, user must tap play button", { service: "useVideoPlayback" });
        }
      } else if (payload.status === "error") {
        const currentMode = currentModeRef.current;
        const willRetryWithTranscode = currentMode === "direct" && !hasTriedTranscoding;

        // Log at INFO level if we'll auto-retry, ERROR level if this is a real failure
        if (willRetryWithTranscode) {
          logger.info("Direct play failed, will retry with transcoding", payload.error, { service: "useVideoPlayback" });
        } else {
          logger.error("Playback error", payload.error, { service: "useVideoPlayback" });
        }

        // Provide user-friendly error message based on error type
        let errorMessage = "Failed to play video";

        if (payload.error) {
          const errorStr = String(payload.error.message || payload.error);

          if (errorStr.includes("HostFunction") || errorStr.includes("corrupted") || errorStr.includes("invalid")) {
            errorMessage = "This video file appears to be corrupted or in an unsupported format";
          } else if (errorStr.includes("network") || errorStr.includes("connection")) {
            errorMessage = "Network error: Unable to connect to the server";
          } else if (errorStr.includes("timeout")) {
            errorMessage = "Connection timed out. Please check your network";
          } else if (errorStr.includes("decode")) {
            errorMessage = "Unable to decode video. Try a different quality setting";
          } else {
            errorMessage = `Playback error: ${errorStr}`;
          }
        }

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
    // For audio files, hide loading once READY (waiting for manual play)
    // For video files, show loading during READY state (auto-play is starting)
    (state.type === "READY" && !isAudioOnlyFile) ||
    // For audio files, never show loading during PLAYING state
    // For video files, show loading until stable playback is achieved
    (state.type === "PLAYING" && !isAudioOnlyFile && !hasStablePlayback);

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
