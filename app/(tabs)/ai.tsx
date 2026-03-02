import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useBackground } from "@/contexts/BackgroundContext";
import {
  View,
  StyleSheet,
  TVEventControl,
  ScrollView,
  Platform,
} from 'react-native';
import { isNativeSearchAvailable, TvosSearchView } from 'expo-tvos-search';

// expo-tvos-search renders RN children below the native search bar and accepts
// a `mode` prop, but neither are in the upstream TS types (patched library).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TvosSearchViewWithChildren = TvosSearchView as React.ComponentType<any>;
import { componentRegistry } from '@/services/componentRegistry';
import type { SduiRenderPayload } from '@/services/componentRegistry';
import { sendChatMessage, OpenClawError } from '@/services/openclawApi';
import { ChatMessage } from '@/components/sdui/ChatMessage';
import { logger } from '@/utils/logger';
import { useFocusEffect } from 'expo-router';

// ─── Constants ──────────────────────────────────────────────────────────────

/** Debounce delay before auto-submitting a query to OpenClaw. */
const SUBMIT_DEBOUNCE_MS = 1500;

/** Minimum query length to trigger a submission. */
const MIN_QUERY_LENGTH = 2;

// ─── Types ──────────────────────────────────────────────────────────────────

interface RenderedComponent {
  id: string;
  element: React.ReactElement;
}

// ─── Component ──────────────────────────────────────────────────────────────

let nextComponentId = 0;
let nextQueryId = 0;

/** AI tab — native search bar (keyboard + mic) for voice commands to OpenClaw. */
export default function AiScreen() {
  // Query / request state
  const [currentQuery, setCurrentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [errorText, setErrorText] = useState('');
  const submittedQueryRef = useRef('');

  // Track the current query's ID so stale SDUI renders from old queries are ignored.
  const activeQueryIdRef = useRef(-1);

  // Whether SDUI canvas components have arrived for the current query.
  // When true the raw text response card is suppressed (the bot already
  // rendered richer content; showing both would be redundant).
  const [hasSduiContent, setHasSduiContent] = useState(false);

  // SDUI canvas components (from WebSocket ui.render)
  const [components, setComponents] = useState<RenderedComponent[]>([]);

  // Abort controller for in-flight requests
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounce timer
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Gesture handler management (tvOS keyboard compat) ───────────────────

  const handleSearchFieldFocused = useCallback(() => {
    TVEventControl?.disableGestureHandlersCancelTouches?.();
  }, []);

  const handleSearchFieldBlurred = useCallback(() => {
    TVEventControl?.enableGestureHandlersCancelTouches?.();
  }, []);

  useFocusEffect(
    useCallback(() => {
      TVEventControl?.enableGestureHandlersCancelTouches?.();
    }, []),
  );

  const { setScreenContext, setBackdropUrl } = useBackground();
  useEffect(() => {
    setScreenContext("home");
    setBackdropUrl(undefined);
  }, [setScreenContext, setBackdropUrl]);

  // ── Submit to OpenClaw ──────────────────────────────────────────────────

  const submitQuery = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) return;

    // Skip if same query already submitted
    if (trimmed === submittedQueryRef.current) return;
    submittedQueryRef.current = trimmed;

    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Stamp a new query ID — SDUI renders that arrive with a different ID are dropped.
    const queryId = nextQueryId++;
    activeQueryIdRef.current = queryId;

    // Clear previous results
    setResponseText('');
    setErrorText('');
    setComponents([]);
    setHasSduiContent(false);
    setIsLoading(true);

    logger.info('AI tab: submitting query', { service: 'AiScreen', query: trimmed });

    try {
      const result = await sendChatMessage(trimmed, controller.signal);
      if (controller.signal.aborted) return;
      // Only set the text if this query is still the active one.
      if (activeQueryIdRef.current === queryId) {
        setResponseText(result.text);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      const message =
        err instanceof OpenClawError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Something went wrong';
      logger.error('AI tab: query failed', err, { service: 'AiScreen', query: trimmed });
      if (activeQueryIdRef.current === queryId) {
        setErrorText(message);
      }
    } finally {
      if (!controller.signal.aborted && activeQueryIdRef.current === queryId) {
        setIsLoading(false);
      }
    }
  }, []);

  // ── Debounced search handler ────────────────────────────────────────────

  const handleSearch = useCallback(
    (event: { nativeEvent: { query: string } }) => {
      const query = event.nativeEvent.query;
      setCurrentQuery(query);

      // Clear previous debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      const trimmed = query.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) return;

      // Debounce: submit after user stops typing
      debounceTimerRef.current = setTimeout(() => {
        submitQuery(query);
      }, SUBMIT_DEBOUNCE_MS);
    },
    [submitQuery],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      abortControllerRef.current?.abort();
    };
  }, []);

  // ── SDUI canvas render handling ─────────────────────────────────────────

  const handleRender = useCallback((payload: SduiRenderPayload) => {
    if (payload.target !== 'canvas') return;
    logger.info('AI tab: rendering canvas component', {
      service: 'AiScreen',
      name: payload.name,
    });
    const element = componentRegistry.render(payload.name, payload.props);
    if (!element) {
      logger.warn('AI tab: render returned null', { service: 'AiScreen', name: payload.name });
      return;
    }
    const id = String(nextComponentId++);
    setComponents((prev) => [...prev, { id, element }]);
    // Mark that the bot sent SDUI content — suppress the plain text card.
    setHasSduiContent(true);
  }, []);

  useEffect(() => {
    const pending = componentRegistry.drainPending();
    if (pending.length > 0) {
      pending.forEach((payload) => handleRender(payload));
    }
    const unsub = componentRegistry.onRender(handleRender);
    return unsub;
  }, [handleRender]);

  // ── Render ──────────────────────────────────────────────────────────────

  // Show the ChatMessage text bubble only when:
  // - we have a text response, AND
  // - no richer SDUI components arrived (those already convey the bot's intent).
  const showTextResponse = responseText.length > 0 && !hasSduiContent;

  // Show error card regardless of SDUI content (errors should always be visible).
  const hasAnyContent = isLoading || errorText.length > 0 || showTextResponse || components.length > 0;

  if (isNativeSearchAvailable()) {
    return (
      <TvosSearchViewWithChildren
        mode="input"
        results={[]}
        placeholder="Ask me anything..."
        colorScheme="dark"
        topInset={140}
        onSearch={handleSearch}
        onSelectItem={() => {}}
        onSearchFieldFocused={handleSearchFieldFocused}
        onSearchFieldBlurred={handleSearchFieldBlurred}
        style={styles.nativeView}
      >
        {/* Results area — rendered as RN children below the native search bar */}
        <ScrollView
          style={[styles.resultsContainer, !hasAnyContent && styles.hidden]}
          contentContainerStyle={styles.resultsContent}
        >
          <View style={styles.contentWrapper}>
            {/* Loading indicator — shown while waiting for either text or SDUI */}
            {isLoading && components.length === 0 && (
              <ChatMessage
                text="Thinking…"
                role="assistant"
                variant="default"
              />
            )}

            {/* Error message */}
            {errorText.length > 0 && (
              <ChatMessage
                text={errorText}
                role="system"
                variant="error"
              />
            )}

            {/* Text-only response (suppressed when SDUI components are present) */}
            {showTextResponse && (
              <ChatMessage
                text={responseText}
                role="assistant"
                variant="default"
              />
            )}

            {/* SDUI components from ui.render */}
            {components.map((rc) => (
              <View key={rc.id} style={styles.componentWrapper}>
                {rc.element}
              </View>
            ))}
          </View>
        </ScrollView>
      </TvosSearchViewWithChildren>
    );
  }

  // Fallback for non-tvOS (shouldn't happen in production)
  return <View style={styles.fallback} />;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  nativeView: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  resultsContent: {
    padding: Platform.isTV ? 48 : 16,
    gap: 16,
    paddingBottom: Platform.isTV ? 120 : 40,
    backgroundColor: 'transparent',
  },
  hidden: {
    display: 'none',
    opacity: 0,
  },
  contentWrapper: {
    width: '100%',
  },
  componentWrapper: {
    width: '100%',
  },
  fallback: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
