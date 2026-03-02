import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { componentRegistry } from '@/services/componentRegistry';
import type { SduiRenderPayload } from '@/services/componentRegistry';
import { logger } from '@/utils/logger';

interface RenderedComponent {
  id: string;
  element: React.ReactElement;
}

let nextId = 0;

/** AI tab — SDUI canvas host for rich content (MediaGrid, ConfirmationCard, InfoCard, etc.). */
export default function AiScreen() {
  const [components, setComponents] = useState<RenderedComponent[]>([]);

  const handleRender = useCallback((payload: SduiRenderPayload) => {
    if (payload.target !== 'canvas') return;
    logger.info('AI tab: rendering canvas component', { service: 'AiScreen', name: payload.name });
    const element = componentRegistry.render(payload.name, payload.props);
    if (!element) {
      logger.warn('AI tab: render returned null', { service: 'AiScreen', name: payload.name });
      return;
    }
    const id = String(nextId++);
    setComponents((prev) => [...prev, { id, element }]);
  }, []);

  useEffect(() => {
    // Drain any canvas renders that arrived before this screen mounted
    const pending = componentRegistry.drainPending();
    if (pending.length > 0) {
      pending.forEach((payload) => handleRender(payload));
    }
    const unsub = componentRegistry.onRender(handleRender);
    return unsub;
  }, [handleRender]);

  if (components.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyIcon}>✦</Text>
        <Text style={styles.emptyTitle}>AI Assistant</Text>
        <Text style={styles.emptySubtitle}>
          Ask the radbot to show media, cards, or actions — they'll appear here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.canvas}>
      {components.map((rc) => (
        <View key={rc.id} style={styles.componentWrapper}>
          {rc.element}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1C1C1E',
    gap: 16,
    padding: 64,
  },
  emptyIcon: {
    fontSize: 72,
    color: '#FFC312',
  },
  emptyTitle: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  emptySubtitle: {
    fontSize: 28,
    color: '#98989D',
    textAlign: 'center',
    maxWidth: 800,
  },
  canvas: {
    flex: 1,
    backgroundColor: '#1C1C1E',
    padding: 48,
    gap: 24,
  },
  componentWrapper: {
    width: '100%',
  },
});
