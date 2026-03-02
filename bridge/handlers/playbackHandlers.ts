import { playbackPlayParamsSchema, playbackSeekParamsSchema } from '@/bridge/protocol';
import type { HandlerDispatcher } from '@/bridge/types';
import { playbackController } from '@/services/playbackController';

export function registerHandlers(dispatcher: HandlerDispatcher): void {
  dispatcher.register('playback.play', async (params: unknown) => {
    const parsed = playbackPlayParamsSchema.parse(params);
    await playbackController.play(parsed.jellyfinId, parsed.folderId);
    return {
      ok: true
    };
  });

  dispatcher.register('playback.pause', async () => {
    await playbackController.pause();
    return {
      ok: true
    };
  });

  dispatcher.register('playback.resume', async () => {
    await playbackController.resume();
    return {
      ok: true
    };
  });

  dispatcher.register('playback.stop', async () => {
    await playbackController.stop();
    return {
      ok: true
    };
  });

  dispatcher.register('playback.seek', async (params: unknown) => {
    const parsed = playbackSeekParamsSchema.parse(params);
    await playbackController.seek(parsed.position);
    return {
      ok: true,
      position: parsed.position
    };
  });

  dispatcher.register('playback.next', async () => {
    await playbackController.next();
    return {
      ok: true
    };
  });

  dispatcher.register('playback.prev', async () => {
    await playbackController.prev();
    return {
      ok: true
    };
  });
}
