import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

import { componentRegistry } from '@/services/componentRegistry';
import { logger } from '@/utils/logger';

// Components are registered in _layout.tsx at app startup
interface RenderedComponent {
  id: string;
  element: React.ReactElement;
}

let nextId = 0;

export default function SduiScreen() {
  const router = useRouter();
  const [components, setComponents] = useState<RenderedComponent[]>([]);

  const handleRender = useCallback((name: string, props: Record<string, unknown>) => {
    logger.info('SDUI: rendering component', { service: 'SduiScreen', name });
    const element = componentRegistry.render(name, props);
    if (!element) {
      logger.warn('SDUI: render returned null', { service: 'SduiScreen', name });
      return;
    }
    const id = String(nextId++);
    setComponents((prev) => [...prev, { id, element }]);
  }, []);

  useEffect(() => {
    // Drain any renders that fired before this screen mounted (router.push race)
    const pending = componentRegistry.drainPending();
    if (pending.length > 0) {
      pending.forEach(({ name, props }) => handleRender(name, props));
    }
    // Subscribe for future renders
    const unsub = componentRegistry.onRender(handleRender);
    return unsub;
  }, [handleRender]);

  // Dismiss the overlay when all components are cleared
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
