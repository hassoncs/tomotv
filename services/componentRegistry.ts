import React from 'react';
import { z } from 'zod';

import { logger } from '@/utils/logger';

export interface ComponentManifestEntry {
  name: string;
  description: string;
  propsSchema: Record<string, unknown>;
  focusConfig?: {
    initialFocusIndex?: number;
    focusDirection?: 'horizontal' | 'vertical' | 'grid';
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RegisteredComponent<TProps = any> {
  name: string;
  description: string;
  component: React.ComponentType<TProps>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  propsSchema: z.ZodType<TProps, any, any>;
  focusConfig?: ComponentManifestEntry['focusConfig'];
}

export type SduiRenderListener = (name: string, props: Record<string, unknown>) => void;

class ComponentRegistry {
  private static instance: ComponentRegistry;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private components = new Map<string, RegisteredComponent<any>>();
  private pendingRenders: Array<{ name: string; props: Record<string, unknown> }> = [];
  private renderListeners = new Set<SduiRenderListener>();

  private constructor() {}

  static getInstance(): ComponentRegistry {
    if (!ComponentRegistry.instance) {
      ComponentRegistry.instance = new ComponentRegistry();
    }
    return ComponentRegistry.instance;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register(config: RegisteredComponent<any>): void {
    this.components.set(config.name, config);
    logger.debug('SDUI component registered', {
      service: 'ComponentRegistry',
      name: config.name,
    });
  }

  /**
   * Render a component by name with validated props.
   * Returns null if the component is not found or props fail validation.
   */
  render(name: string, rawProps: unknown): React.ReactElement | null {
    const registered = this.components.get(name);
    if (!registered) {
      logger.warn('SDUI: unknown component', { service: 'ComponentRegistry', name });
      return null;
    }

    const result = registered.propsSchema.safeParse(rawProps);
    if (!result.success) {
      logger.warn('SDUI: invalid props', {
        service: 'ComponentRegistry',
        name,
        issues: result.error.issues.map((i) => i.message).join(', '),
      });
      return null;
    }

    return React.createElement(registered.component, result.data);
  }

  /**
   * Returns a JSON-schema manifest of all registered components.
   * Sent to the LLM via `tommo ui:components` so it knows what to render.
   */
  getManifest(): ComponentManifestEntry[] {
    return Array.from(this.components.values()).map((c) => ({
      name: c.name,
      description: c.description,
      // Return empty schema object — the LLM uses descriptions, not full JSON schema
      propsSchema: {} as Record<string, unknown>,
      ...(c.focusConfig ? { focusConfig: c.focusConfig } : {}),
    }));
  }

  /**
   * Called by the bridge handler when a `ui.render` command arrives from the relay.
   * Dispatches to all registered render listeners (i.e. the SDUI canvas screen).
   */
  dispatchRender(name: string, props: Record<string, unknown>): void {
    logger.info('SDUI render queued', { service: 'ComponentRegistry', name });
    // Queue so SduiScreen can drain on mount — avoids the race with router.push
    this.pendingRenders.push({ name, props });
    this.renderListeners.forEach((listener) => listener(name, props));
  }

  /** Drain all renders that arrived before SduiScreen mounted. */
  drainPending(): Array<{ name: string; props: Record<string, unknown> }> {
    const pending = [...this.pendingRenders];
    this.pendingRenders = [];
    return pending;
  }

  onRender(listener: SduiRenderListener): () => void {
    this.renderListeners.add(listener);
    return () => this.renderListeners.delete(listener);
  }
}

export const componentRegistry = ComponentRegistry.getInstance();
