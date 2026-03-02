import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { componentRegistry } from '@/services/componentRegistry';
import type { SduiRenderPayload } from '@/services/componentRegistry';
import { logger } from '@/utils/logger';

interface RenderedComponent {
  id: string;
  element: React.ReactElement;
}

let nextId = 0;

/** Overlay-only SDUI host. Only renders components with target='overlay'. */
export default function SduiScreen() {
  const router = useRouter();
  const [components, setComponents] = useState<RenderedComponent[]>([]);

  const handleRender = useCallback((payload: SduiRenderPayload) => {
    if (payload.target !== 'overlay') return;
    logger.info('SDUI overlay: rendering component', { service: 'SduiScreen', name: payload.name });
    const element = componentRegistry.render(payload.name, payload.props);
    if (!element) {
      logger.warn('SDUI overlay: render returned null', { service: 'SduiScreen', name: payload.name });
      return;
    }
    const id = String(nextId++);
    setComponents((prev) => [...prev, { id, element }]);
  }, []);

  useEffect(() => {
    // Drain any overlay renders that fired before this screen mounted
    const pending = componentRegistry.drainPending();
    if (pending.length > 0) {
      pending.forEach((payload) => handleRender(payload));
    }
    const unsub = componentRegistry.onRender(handleRender);
    return unsub;
  }, [handleRender]);

  const dismiss = useCallback(() => {
    setComponents([]);
    router.back();
  }, [router]);

  if (components.length === 0) {
    return null;
  }

  return (
    <TouchableOpacity style={styles.backdrop} onPress={dismiss} activeOpacity={1}>
      <View style={styles.container}>
        {components.map((rc) => (
          <View key={rc.id} style={styles.componentWrapper}>
            {rc.element}
          </View>
        ))}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    padding: 48,
  },
  componentWrapper: {
    width: '100%',
    maxWidth: 1200,
  },
});
