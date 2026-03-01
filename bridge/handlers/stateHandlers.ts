import type { HandlerDispatcher } from '@/bridge/types';
import { playbackController } from '@/services/playbackController';

export function registerHandlers(dispatcher: HandlerDispatcher): void {
  dispatcher.register('state.status', async () => {
    return playbackController.getFullState();
  });

  dispatcher.register('state.queue', async () => {
    return playbackController.getQueueState();
  });

  dispatcher.register('state.library', async () => {
    return playbackController.getLibraryState();
  });
}
