import type { HandlerDispatcher } from '@/bridge/types';
import { uiRenderParamsSchema } from '@/bridge/protocol';
import { componentRegistry } from '@/services/componentRegistry';

export function registerHandlers(dispatcher: HandlerDispatcher): void {
  dispatcher.register('ui.render', async (params: unknown) => {
    const parsed = uiRenderParamsSchema.parse(params);

    const manifest = componentRegistry.getManifest();
    const knownComponent = manifest.find((c) => c.name === parsed.component);
    if (!knownComponent) {
      throw new Error(`Unknown SDUI component: ${parsed.component}. Available: ${manifest.map((c) => c.name).join(', ')}`);
    }

    componentRegistry.dispatchRender(
      parsed.component,
      parsed.props as Record<string, unknown>,
      { navigateToTab: parsed.navigateToTab }
    );

    return {
      ok: true,
      component: parsed.component,
    };
  });

  dispatcher.register('ui.components', async () => {
    return componentRegistry.getManifest();
  });
}
