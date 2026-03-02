import { navigationPushParamsSchema } from '@/bridge/protocol';
import type { HandlerDispatcher } from '@/bridge/types';
import { playbackController } from '@/services/playbackController';

export function registerHandlers(dispatcher: HandlerDispatcher): void {
  dispatcher.register('navigation.push', async (params: unknown) => {
    const parsed = navigationPushParamsSchema.parse(params);
    playbackController.navigatePush(parsed.route, parsed.params);

    return {
      ok: true,
      route: playbackController.getCurrentRoute()
    };
  });

  dispatcher.register('navigation.back', async () => {
    playbackController.navigateBack();

    return {
      ok: true
    };
  });

  dispatcher.register('navigation.getCurrentRoute', async () => {
    return playbackController.getCurrentRoute();
  });
}
