import { inputTextParamsSchema, remoteKeyParamsSchema } from '@/bridge/protocol';
import type { HandlerDispatcher } from '@/bridge/types';
import { playbackController } from '@/services/playbackController';

export function registerHandlers(dispatcher: HandlerDispatcher): void {
  dispatcher.register('remote.key', async (params: unknown) => {
    const parsed = remoteKeyParamsSchema.parse(params);
    await playbackController.remoteKey(parsed.key, parsed.action ?? 'tap');
    return {
      ok: true
    };
  });

  dispatcher.register('input.text', async (params: unknown) => {
    const parsed = inputTextParamsSchema.parse(params);
    await playbackController.inputText(parsed.text);
    return {
      ok: true
    };
  });

  dispatcher.register('input.clear', async () => {
    await playbackController.clearInput();
    return {
      ok: true
    };
  });
}
