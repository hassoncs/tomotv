import { componentRegistry } from '../componentRegistry';
import type { SduiRenderPayload } from '../componentRegistry';

// Reset the singleton between tests by draining pending renders
beforeEach(() => {
  componentRegistry.drainPending();
});

describe('dispatchRender — render payload metadata', () => {
  it('dispatches payload with navigateToTab defaulting to true', () => {
    const received: SduiRenderPayload[] = [];
    const unsub = componentRegistry.onRender((payload) => {
      received.push(payload);
    });

    componentRegistry.dispatchRender('ChatMessage', { text: 'hi' });
    expect(received).toHaveLength(1);
    expect(received[0].name).toBe('ChatMessage');
    expect(received[0].props).toEqual({ text: 'hi' });
    expect(received[0].navigateToTab).toBe(true);
    unsub();
  });

  it('dispatches with navigateToTab=false', () => {
    const received: SduiRenderPayload[] = [];
    const unsub = componentRegistry.onRender((payload) => {
      received.push(payload);
    });

    componentRegistry.dispatchRender('ChatMessage', { text: 'hi' }, { navigateToTab: false });
    expect(received[0].navigateToTab).toBe(false);
    unsub();
  });

  it('drainPending returns queued payloads', () => {
    componentRegistry.dispatchRender('ChatMessage', { text: 'queued' });
    const pending = componentRegistry.drainPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].navigateToTab).toBe(true);
  });

  it('listeners receive full SduiRenderPayload (name, props, navigateToTab)', () => {
    const payloads: SduiRenderPayload[] = [];
    const unsub = componentRegistry.onRender((payload) => {
      payloads.push(payload);
    });

    componentRegistry.dispatchRender('InfoCard', { title: 'Test' });
    expect(payloads[0]).toMatchObject({
      name: 'InfoCard',
      props: { title: 'Test' },
      navigateToTab: true,
    });
    unsub();
  });
});
