import { RemoteBridgeServiceTestExport } from '../remoteBridgeService';
import type { BridgeTransport } from '@/bridge/types';

jest.mock('@/utils/logger', () => ({
  logger: { debug: jest.fn(), error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));
jest.mock('@/services/playbackController', () => ({
  playbackController: {
    subscribe: jest.fn(() => () => {}),
    registerRouter: jest.fn(),
    unregisterRouter: jest.fn(),
  },
}));

class MockTransport implements BridgeTransport {
  connected = true;
  sent: string[] = [];
  connect() {}
  disconnect() {}
  send(payload: string): boolean {
    if (!this.connected) return false;
    this.sent.push(payload);
    return true;
  }
  isConnected() { return this.connected; }
  onOpen(cb: () => void) { cb(); }
  onClose() {}
  onError() {}
  onMessage() {}
}

describe('remoteBridgeService — UI event emission', () => {
  let transport: MockTransport;
  let service: ReturnType<typeof RemoteBridgeServiceTestExport.createForTesting>;

  beforeEach(() => {
    transport = new MockTransport();
    service = RemoteBridgeServiceTestExport.createForTesting(transport);
    // Drain the 'HELLO app' handshake sent during construction
    transport.sent = [];
  });

  it('emitUiSelect sends a JSON-RPC notification with method event.ui.select', () => {
    service.emitUiSelect({ component: 'MediaGrid', itemId: 'abc123' });
    expect(transport.sent).toHaveLength(1);
    const msg = JSON.parse(transport.sent[0]);
    expect(msg.jsonrpc).toBe('2.0');
    expect(msg.method).toBe('event.ui.select');
    expect(msg.params.itemId).toBe('abc123');
    expect(msg.id).toBeUndefined();
  });

  it('emitUiSelect includes optional fields when provided', () => {
    service.emitUiSelect({ component: 'MediaGrid', itemId: 'xyz', itemType: 'Movie', title: 'Dune' });
    const msg = JSON.parse(transport.sent[0]);
    expect(msg.params.itemType).toBe('Movie');
    expect(msg.params.title).toBe('Dune');
  });

  it('emitUiAction sends method event.ui.action', () => {
    service.emitUiAction({ component: 'ConfirmationCard', actionId: 'confirm' });
    const msg = JSON.parse(transport.sent[0]);
    expect(msg.method).toBe('event.ui.action');
    expect(msg.params.actionId).toBe('confirm');
  });

  it('emitUiAction includes optional value', () => {
    service.emitUiAction({ component: 'ConfirmationCard', actionId: 'rate', value: '5' });
    const msg = JSON.parse(transport.sent[0]);
    expect(msg.params.value).toBe('5');
  });

  it('emitUiDismiss sends method event.ui.dismiss', () => {
    service.emitUiDismiss({ source: 'overlay' });
    const msg = JSON.parse(transport.sent[0]);
    expect(msg.method).toBe('event.ui.dismiss');
    expect(msg.params.source).toBe('overlay');
  });

  it('emitUiDismiss includes optional component', () => {
    service.emitUiDismiss({ source: 'canvas', component: 'InfoCard' });
    const msg = JSON.parse(transport.sent[0]);
    expect(msg.params.component).toBe('InfoCard');
  });

  it('drops events when transport is disconnected', () => {
    transport.connected = false;
    service.emitUiSelect({ component: 'MediaGrid', itemId: 'x' });
    expect(transport.sent).toHaveLength(0);
  });
});
