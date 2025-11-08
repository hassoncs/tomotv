import { useEffect, useState, useMemo, useRef, useCallback, useReducer } from 'react';
import { useVideoPlayer, VideoSource } from 'expo-video';
import {
  fetchVideoDetails,
  needsTranscoding,
  getSubtitleTracks,
  getVideoStreamUrl,
  getTranscodingStreamUrl,
} from '@/services/jellyfinApi';
import { JellyfinVideoItem } from '@/types/jellyfin';

export type PlaybackMode = 'direct' | 'transcode';

/**
 * Video player state machine
 * State transitions:
 * IDLE → FETCHING_METADATA → CREATING_STREAM → INITIALIZING_PLAYER → READY → PLAYING
 *                                                                           ↓
 *                                                                        ERROR
 */
export type VideoPlayerState =
  | { type: 'IDLE' }
  | { type: 'FETCHING_METADATA' }
  | { type: 'CREATING_STREAM'; mode: PlaybackMode; details: JellyfinVideoItem; hasSubtitles: boolean }
  | { type: 'INITIALIZING_PLAYER'; mode: PlaybackMode; streamUrl: string }
  | { type: 'READY'; mode: PlaybackMode }
  | { type: 'PLAYING'; mode: PlaybackMode }
  | { type: 'ERROR'; error: string; canRetryWithTranscode: boolean };

export type VideoPlayerAction =
  | { type: 'FETCH_METADATA' }
  | { type: 'METADATA_FETCHED'; details: JellyfinVideoItem; mode: PlaybackMode; hasSubtitles: boolean }
  | { type: 'STREAM_CREATED'; streamUrl: string }
  | { type: 'PLAYER_READY' }
  | { type: 'PLAYER_PLAYING' }
  | { type: 'PLAYER_ERROR'; error: any; mode: PlaybackMode; hasTriedTranscode: boolean }
  | { type: 'RETRY' }
  | { type: 'RETRY_WITH_TRANSCODE' };

export interface VideoPlaybackConfig {
  videoId: string;
  videoName: string;
}

export interface VideoPlaybackResult {
  // Player instance
  player: ReturnType<typeof useVideoPlayer>;

  // State machine state
  state: VideoPlayerState;

  // Video details
  videoDetails: JellyfinVideoItem | null;

  // UI helpers
  isLoading: boolean;
  showLoadingOverlay: boolean;

  // Actions
  retry: () => void;
}

/**
 * State machine reducer for video playback
 */
function videoPlayerReducer(state: VideoPlayerState, action: VideoPlayerAction): VideoPlayerState {
  console.log('[VideoStateMachine] Transition:', state.type, '→', action.type);

  switch (action.type) {
    case 'FETCH_METADATA':
      return { type: 'FETCHING_METADATA' };

    case 'METADATA_FETCHED':
      return {
        type: 'CREATING_STREAM',
        mode: action.mode,
        details: action.details,
        hasSubtitles: action.hasSubtitles,
      };

    case 'STREAM_CREATED':
      if (state.type !== 'CREATING_STREAM') return state;
      return {
        type: 'INITIALIZING_PLAYER',
        mode: state.mode,
        streamUrl: action.streamUrl,
      };

    case 'PLAYER_READY':
      if (state.type !== 'INITIALIZING_PLAYER') return state;
      return {
        type: 'READY',
        mode: state.mode,
      };

    case 'PLAYER_PLAYING':
      if (state.type !== 'READY' && state.type !== 'PLAYING') return state;
      return {
        type: 'PLAYING',
        mode: state.type === 'READY' ? state.mode : state.mode,
      };

    case 'PLAYER_ERROR': {
      const canRetry = action.mode === 'direct' && !action.hasTriedTranscode;
      const errorMsg = action.error?.message || 'Failed to load video';
      return {
        type: 'ERROR',
        error: errorMsg,
        canRetryWithTranscode: canRetry,
      };
    }

    case 'RETRY':
      return { type: 'IDLE' };

    case 'RETRY_WITH_TRANSCODE':
      return { type: 'FETCHING_METADATA' };

    default:
      return state;
  }
}

/**
 * Custom hook to manage video playback logic using a state machine
 * Handles codec checking, transcoding decisions, and player lifecycle
 */
export function useVideoPlayback(config: VideoPlaybackConfig): VideoPlaybackResult {
  const { videoId, videoName } = config;

  // State machine
  const [state, dispatch] = useReducer(videoPlayerReducer, { type: 'IDLE' });

  // Persistent data across states
  const [videoDetails, setVideoDetails] = useState<JellyfinVideoItem | null>(null);
  const [hasTriedTranscoding, setHasTriedTranscoding] = useState(false);

  // Refs to prevent duplicate operations and cleanup issues
  const autoPlayTriggeredRef = useRef(false);
  const isMountedRef = useRef(true);
  const autoPlayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stablePlaybackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasStablePlaybackRef = useRef(false);

  // Track stable playback to hide loading spinner at the right time
  const [hasStablePlayback, setHasStablePlayback] = useState(false);

  /**
   * Step 1: Fetch video metadata and determine playback mode
   */
  const fetchMetadata = useCallback(async () => {
    console.log('[useVideoPlayback] Fetching video details...');

    try {
      const details = await fetchVideoDetails(videoId);

      if (!details) {
        throw new Error('Video not found or unavailable');
      }

      setVideoDetails(details);

      // Check codec compatibility
      const requiresTranscoding = needsTranscoding(details);

      // Check for external subtitles
      const subtitles = getSubtitleTracks(details);
      const hasExternalSubs = subtitles.length > 0;

      // Determine playback mode - force transcode on retry
      let selectedMode: PlaybackMode = 'direct';

      if (requiresTranscoding || hasExternalSubs || hasTriedTranscoding) {
        selectedMode = 'transcode';

        if (requiresTranscoding) {
          console.log('[useVideoPlayback] Codec not supported, using transcoding');
        }
        if (hasExternalSubs) {
          console.log(`[useVideoPlayback] Found ${subtitles.length} subtitle(s), using HLS with burn-in`);
        }
        if (hasTriedTranscoding) {
          console.log('[useVideoPlayback] Retrying with transcoding');
        }
      } else {
        console.log('[useVideoPlayback] Using direct play');
      }

      dispatch({
        type: 'METADATA_FETCHED',
        details,
        mode: selectedMode,
        hasSubtitles: hasExternalSubs,
      });

      if (selectedMode === 'transcode') {
        setHasTriedTranscoding(true);
      }

    } catch (err) {
      console.error('[useVideoPlayback] Error fetching metadata:', err);

      // Provide user-friendly error message
      const errorMessage = err instanceof Error
        ? err.message.includes('not found')
          ? 'Video not found on server'
          : err.message.includes('network') || err.message.includes('fetch')
          ? 'Unable to connect to Jellyfin server'
          : `Failed to load video details: ${err.message}`
        : 'Failed to load video details';

      dispatch({
        type: 'PLAYER_ERROR',
        error: { message: errorMessage },
        mode: 'direct',
        hasTriedTranscode: hasTriedTranscoding,
      });
    }
  }, [videoId, hasTriedTranscoding]);

  /**
   * Setup and cleanup on mount/unmount
   */
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      console.log('[useVideoPlayback] Component unmounting, cleaning up...');
      isMountedRef.current = false;
      if (autoPlayTimerRef.current) {
        clearTimeout(autoPlayTimerRef.current);
        autoPlayTimerRef.current = null;
      }
      if (stablePlaybackTimerRef.current) {
        clearTimeout(stablePlaybackTimerRef.current);
        stablePlaybackTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Reset state when video ID changes
   */
  useEffect(() => {
    console.log('[useVideoPlayback] Video changed, resetting state');

    // Clear any pending timers
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (stablePlaybackTimerRef.current) {
      clearTimeout(stablePlaybackTimerRef.current);
      stablePlaybackTimerRef.current = null;
    }

    dispatch({ type: 'RETRY' });
    setVideoDetails(null);
    setStreamUrl(null);
    setHasTriedTranscoding(false);
    setHasStablePlayback(false);
    hasStablePlaybackRef.current = false;
    autoPlayTriggeredRef.current = false;
  }, [videoId]);

  /**
   * Start metadata fetch when in IDLE or FETCHING_METADATA state
   */
  useEffect(() => {
    if (state.type === 'IDLE') {
      dispatch({ type: 'FETCH_METADATA' });
    } else if (state.type === 'FETCHING_METADATA') {
      fetchMetadata();
    }
  }, [state.type, fetchMetadata]);

  /**
   * Store streamUrl in state to keep it stable across state transitions
   */
  const [streamUrl, setStreamUrl] = useState<string | null>(null);

  /**
   * Step 2: Generate stream URL when in CREATING_STREAM state
   */
  useEffect(() => {
    if (state.type !== 'CREATING_STREAM') return;

    const { mode, details } = state;

    const generateStreamUrl = async () => {
      try {
        const url = mode === 'transcode'
          ? await getTranscodingStreamUrl(videoId, details)
          : getVideoStreamUrl(videoId, details);

        console.log('[useVideoPlayback] Stream URL generated');
        console.log('[useVideoPlayback] Mode:', mode.toUpperCase());
        console.log('[useVideoPlayback] URL:', url);

        if (!url) {
          throw new Error('Failed to generate stream URL');
        }

        setStreamUrl(url);
        dispatch({ type: 'STREAM_CREATED', streamUrl: url });
      } catch (error) {
        console.error('[useVideoPlayback] Error generating stream URL:', error);

        dispatch({
          type: 'PLAYER_ERROR',
          error: {
            message: 'Failed to create video stream. Please check your settings.',
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
      contentType: streamUrl.includes('.m3u8') ? 'hls' : 'auto',
    };

    console.log('[useVideoPlayback] Video source created');
    return source;
  }, [streamUrl]);

  /**
   * Step 4: Initialize player with video source
   */
  const player = useVideoPlayer(videoSource, (player) => {
    if (!videoSource) return;
    player.loop = false;
    console.log('[useVideoPlayback] Player initialized');
  });

  /**
   * Step 5: Handle player events and auto-play
   * Note: Attach listeners once when player and videoSource are ready, keep them throughout lifecycle
   */
  useEffect(() => {
    if (!player || !videoSource) return;

    console.log('[useVideoPlayback] Attaching player event listeners');

    // Capture current state for closure
    const getCurrentMode = (): PlaybackMode => {
      if (state.type === 'INITIALIZING_PLAYER' || state.type === 'READY' || state.type === 'PLAYING') {
        return state.mode;
      }
      return 'direct'; // fallback
    };

    const statusSubscription = player.addListener('statusChange', (payload) => {
      if (!isMountedRef.current) return;

      console.log('[useVideoPlayback] Status:', payload.status);

      if (payload.status === 'readyToPlay') {
        dispatch({ type: 'PLAYER_READY' });

        // Auto-play on first ready
        if (!autoPlayTriggeredRef.current && isMountedRef.current) {
          autoPlayTriggeredRef.current = true;
          console.log('[useVideoPlayback] Scheduling auto-play...');

          // Clear any existing timer
          if (autoPlayTimerRef.current) {
            clearTimeout(autoPlayTimerRef.current);
          }

          // Delay to avoid event listener conflicts
          autoPlayTimerRef.current = setTimeout(() => {
            if (!isMountedRef.current) {
              console.log('[useVideoPlayback] Component unmounted, skipping auto-play');
              return;
            }

            try {
              if (player.status === 'readyToPlay') {
                console.log('[useVideoPlayback] Calling play()');
                player.play();
              }
            } catch (error) {
              console.error('[useVideoPlayback] Error calling play():', error);

              // Dispatch error to state machine
              dispatch({
                type: 'PLAYER_ERROR',
                error: {
                  message: 'Failed to start video playback. The video file may be corrupted or incompatible.',
                },
                mode: getCurrentMode(),
                hasTriedTranscode: hasTriedTranscoding,
              });
            }

            autoPlayTimerRef.current = null;
          }, 100);
        }
      } else if (payload.status === 'error') {
        console.error('[useVideoPlayback] Playback error:', payload.error);

        // Provide user-friendly error message based on error type
        let errorMessage = 'Failed to play video';

        if (payload.error) {
          const errorStr = String(payload.error.message || payload.error);

          if (errorStr.includes('HostFunction') || errorStr.includes('corrupted') || errorStr.includes('invalid')) {
            errorMessage = 'This video file appears to be corrupted or in an unsupported format';
          } else if (errorStr.includes('network') || errorStr.includes('connection')) {
            errorMessage = 'Network error: Unable to connect to the server';
          } else if (errorStr.includes('timeout')) {
            errorMessage = 'Connection timed out. Please check your network';
          } else if (errorStr.includes('decode')) {
            errorMessage = 'Unable to decode video. Try a different quality setting';
          } else {
            errorMessage = `Playback error: ${errorStr}`;
          }
        }

        dispatch({
          type: 'PLAYER_ERROR',
          error: { message: errorMessage },
          mode: getCurrentMode(),
          hasTriedTranscode: hasTriedTranscoding,
        });
      }
    });

    const playingSubscription = player.addListener('playingChange', (payload) => {
      if (!isMountedRef.current) return;

      try {
        if (payload.isPlaying) {
          dispatch({ type: 'PLAYER_PLAYING' });

          // Start stable playback detection after video starts playing
          // Wait 1.5 seconds of continuous playback before hiding spinner
          if (!hasStablePlaybackRef.current) {
            // Clear any existing timer
            if (stablePlaybackTimerRef.current) {
              clearTimeout(stablePlaybackTimerRef.current);
            }

            stablePlaybackTimerRef.current = setTimeout(() => {
              if (isMountedRef.current && player.playing) {
                console.log('[useVideoPlayback] Stable playback detected, hiding spinner');
                hasStablePlaybackRef.current = true;
                setHasStablePlayback(true);
                stablePlaybackTimerRef.current = null;
              }
            }, 1500);
          }
        } else {
          // Video paused or stopped, clear the stable playback timer
          if (stablePlaybackTimerRef.current && !hasStablePlaybackRef.current) {
            clearTimeout(stablePlaybackTimerRef.current);
            stablePlaybackTimerRef.current = null;
          }
        }
      } catch (error) {
        console.error('[useVideoPlayback] Error in playingChange handler:', error);
        // Don't crash the app, just log the error
      }
    });

    return () => {
      console.log('[useVideoPlayback] Cleaning up event listeners');

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
      } catch (error) {
        console.error('[useVideoPlayback] Error removing subscriptions:', error);
      }
    };
  }, [player, videoSource, hasTriedTranscoding]); // Keep listeners stable, don't re-attach on hasStablePlayback change

  /**
   * Handle retry with transcoding when direct play fails
   */
  useEffect(() => {
    if (state.type === 'ERROR' && state.canRetryWithTranscode && isMountedRef.current) {
      // Don't auto-retry if error message suggests file is corrupted
      const isCorruptedFile = state.error.includes('corrupted') ||
                              state.error.includes('HostFunction') ||
                              state.error.includes('invalid');

      if (isCorruptedFile) {
        console.log('[useVideoPlayback] File appears corrupted, skipping auto-retry with transcoding');
        // Don't auto-retry, let user manually retry or go back
        return;
      }

      console.log('[useVideoPlayback] Direct play failed, will retry with transcoding...');
      setHasTriedTranscoding(true);
      autoPlayTriggeredRef.current = false;

      // Auto-retry with transcoding
      const retryTimer = setTimeout(() => {
        if (isMountedRef.current) {
          dispatch({ type: 'RETRY_WITH_TRANSCODE' });
        }
      }, 500);

      return () => clearTimeout(retryTimer);
    }
  }, [state]);

  /**
   * Retry playback from the beginning
   */
  const retry = useCallback(() => {
    console.log('[useVideoPlayback] Manual retry...');

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
    dispatch({ type: 'RETRY' });
  }, []);

  /**
   * Compute UI state from state machine
   */
  const isLoading =
    state.type === 'FETCHING_METADATA' ||
    state.type === 'CREATING_STREAM' ||
    state.type === 'INITIALIZING_PLAYER' ||
    state.type === 'READY' ||
    (state.type === 'PLAYING' && !hasStablePlayback);

  const showLoadingOverlay = isLoading;

  return {
    player,
    state,
    videoDetails,
    isLoading,
    showLoadingOverlay,
    retry,
  };
}
