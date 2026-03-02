import { componentRegistry } from '../componentRegistry';
import type { SduiRenderPayload } from '../componentRegistry';

// Reset the singleton between tests by draining pending renders
beforeEach(() => {
  componentRegistry.drainPending();
});

describe('dispatchRender — render payload metadata', () => {
  it('dispatches payload with target defaulting to canvas', () => {
    const received: SduiRenderPayload[] = [];
    const unsub = componentRegistry.onRender((payload) => {
      received.push(payload);
    });

    componentRegistry.dispatchRender('Toast', { text: 'hi' });
    expect(received).toHaveLength(1);
    expect(received[0].name).toBe('Toast');
    expect(received[0].props).toEqual({ text: 'hi' });
    expect(received[0].target).toBe('canvas');
    expect(received[0].navigateToTab).toBe(true);
    unsub();
  });

  it('dispatches with explicit target=overlay', () => {
    const received: SduiRenderPayload[] = [];
    const unsub = componentRegistry.onRender((payload) => {
      received.push(payload);
    });

    componentRegistry.dispatchRender('Toast', { text: 'hi' }, { target: 'overlay', navigateToTab: false });
    expect(received[0].target).toBe('overlay');
    expect(received[0].navigateToTab).toBe(false);
    unsub();
  });

  it('dispatches with explicit target=canvas and navigateToTab=false', () => {
    const received: SduiRenderPayload[] = [];
    const unsub = componentRegistry.onRender((payload) => {
      received.push(payload);
    });

    componentRegistry.dispatchRender('MediaGrid', { items: [] }, { target: 'canvas', navigateToTab: false });
    expect(received[0].target).toBe('canvas');
    expect(received[0].navigateToTab).toBe(false);
    unsub();
  });

  it('drainPending returns payloads with metadata', () => {
    componentRegistry.dispatchRender('Toast', { text: 'queued' }, { target: 'overlay' });
    const pending = componentRegistry.drainPending();
    expect(pending).toHaveLength(1);
    expect(pending[0].target).toBe('overlay');
    expect(pending[0].navigateToTab).toBe(true);
  });

  it('listeners receive full SduiRenderPayload (name, props, target, navigateToTab)', () => {
    const payloads: SduiRenderPayload[] = [];
    const unsub = componentRegistry.onRender((payload) => {
      payloads.push(payload);
    });

    componentRegistry.dispatchRender('InfoCard', { title: 'Test' });
    expect(payloads[0]).toMatchObject({
      name: 'InfoCard',
      props: { title: 'Test' },
      target: 'canvas',
      navigateToTab: true,
    });
    unsub();
  });
});
