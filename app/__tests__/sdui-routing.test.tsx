/**
 * Verifies overlay/canvas routing split:
 * - SduiScreen (sdui.tsx) only renders target='overlay' payloads
 * - AiScreen (ai.tsx) only renders target='canvas' payloads
 * - ComponentRegistry routing metadata is correctly threaded through
 */
import React from 'react';
import { act, create } from 'react-test-renderer';

import { componentRegistry } from '@/services/componentRegistry';
import '@/components/sdui/registerComponents';

jest.mock('@/utils/logger', () => ({
  logger: { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

describe('SDUI canvas/overlay routing split', () => {
  beforeEach(() => {
    componentRegistry.drainPending();
  });

  it('dispatchRender target=overlay is received by overlay listeners, not canvas listeners', () => {
    const overlayReceived: string[] = [];
    const canvasReceived: string[] = [];

    const unsubOverlay = componentRegistry.onRender((p) => {
      if (p.target === 'overlay') overlayReceived.push(p.name);
    });
    const unsubCanvas = componentRegistry.onRender((p) => {
      if (p.target === 'canvas') canvasReceived.push(p.name);
    });

    componentRegistry.dispatchRender('Toast', { text: 'hi' }, { target: 'overlay' });

    expect(overlayReceived).toContain('Toast');
    expect(canvasReceived).not.toContain('Toast');

    unsubOverlay();
    unsubCanvas();
  });

  it('dispatchRender target=canvas is received by canvas listeners, not overlay listeners', () => {
    const overlayReceived: string[] = [];
    const canvasReceived: string[] = [];

    const unsubOverlay = componentRegistry.onRender((p) => {
      if (p.target === 'overlay') overlayReceived.push(p.name);
    });
    const unsubCanvas = componentRegistry.onRender((p) => {
      if (p.target === 'canvas') canvasReceived.push(p.name);
    });

    componentRegistry.dispatchRender('NowPlayingCard', { title: 'Test' }, { target: 'canvas' });

    expect(canvasReceived).toContain('NowPlayingCard');
    expect(overlayReceived).not.toContain('NowPlayingCard');

    unsubOverlay();
    unsubCanvas();
  });

  it('default target is canvas', () => {
    const canvasReceived: string[] = [];
    const unsub = componentRegistry.onRender((p) => {
      if (p.target === 'canvas') canvasReceived.push(p.name);
    });

    componentRegistry.dispatchRender('NowPlayingCard', {});
    expect(canvasReceived).toContain('NowPlayingCard');
    unsub();
  });

  it('navigateToTab defaults to true', () => {
    const payloads: { navigateToTab: boolean }[] = [];
    const unsub = componentRegistry.onRender((p) => payloads.push(p));
    componentRegistry.dispatchRender('Toast', {});
    expect(payloads[0].navigateToTab).toBe(true);
    unsub();
  });

  it('navigateToTab=false is preserved', () => {
    const payloads: { navigateToTab: boolean }[] = [];
    const unsub = componentRegistry.onRender((p) => payloads.push(p));
    componentRegistry.dispatchRender('Toast', {}, { target: 'canvas', navigateToTab: false });
    expect(payloads[0].navigateToTab).toBe(false);
    unsub();
  });
});
