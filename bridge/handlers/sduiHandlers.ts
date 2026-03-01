import { z } from 'zod';

import type { HandlerDispatcher } from '@/bridge/types';
import { componentRegistry } from '@/services/componentRegistry';

export function registerHandlers(dispatcher: HandlerDispatcher): void {
  dispatcher.register('ui.render', async (params: unknown) => {
    const parsed = z.object({
      component: z.string().min(1),
      props: z.record(z.string(), z.unknown()).optional().default({}),
    }).parse(params);

    const manifest = componentRegistry.getManifest();
    const knownComponent = manifest.find((c) => c.name === parsed.component);
    if (!knownComponent) {
      throw new Error(`Unknown SDUI component: ${parsed.component}. Available: ${manifest.map((c) => c.name).join(', ')}`);
    }

    componentRegistry.dispatchRender(parsed.component, parsed.props as Record<string, unknown>);

    return {
      ok: true,
      component: parsed.component,
    };
  });

  dispatcher.register('ui.components', async () => {
    return componentRegistry.getManifest();
  });
}
