import { ZodError } from 'zod';

import {
  eventPayloadSchemaMap,
  jsonRpcInboundMessageSchema,
  jsonRpcNotificationSchema,
  jsonRpcRequestSchema,
  jsonRpcSuccessResponseSchema,
  methodParamsSchemaMap,
  uiSelectEventSchema,
  uiActionEventSchema,
  uiDismissEventSchema,
} from '@/bridge/protocol';
import type {
  BridgeEventMethod,
  BridgeRequestMethod,
  BridgeTransport,
  FullAppState,
  HandlerDispatcher,
  HandlerFn,
  NavigationState,
  PlaybackState,
  QueueState,
  RemoteBridgeConfig
} from '@/bridge/types';
import { registerHandlers as registerNavigationHandlers } from '@/bridge/handlers/navigationHandlers';
import { registerHandlers as registerPlaybackHandlers } from '@/bridge/handlers/playbackHandlers';
import { registerHandlers as registerRemoteHandlers } from '@/bridge/handlers/remoteHandlers';
import { registerHandlers as registerStateHandlers } from '@/bridge/handlers/stateHandlers';
import { registerHandlers as registerSduiHandlers } from '@/bridge/handlers/sduiHandlers';
import { playbackController } from '@/services/playbackController';
// mDNS discovery available via bridgeDiscovery.ts when needed
import { logger } from '@/utils/logger';

type JsonRpcId = string | number | null;

interface ConnectionState {
  connected: boolean;
  reconnectAttempts: number;
}

type RemoteBridgeListener = (state: ConnectionState) => void;

class JsonRpcDispatcher implements HandlerDispatcher {
  private readonly handlers: Map<BridgeRequestMethod, HandlerFn> = new Map();

  register(method: BridgeRequestMethod, handler: HandlerFn): void {
    this.handlers.set(method, handler);
  }

  has(method: BridgeRequestMethod): boolean {
    return this.handlers.has(method);
  }

  async execute(method: BridgeRequestMethod, params: unknown): Promise<unknown> {
    const handler = this.handlers.get(method);
    if (!handler) {
      throw new Error(`Unknown method: ${method}`);
    }

    const paramsSchema = methodParamsSchemaMap[method];
    const parsedParams = paramsSchema.parse(params);
    return handler(parsedParams);
  }
}

export class WebSocketClientTransport implements BridgeTransport {
  private url: string;
  private socket: WebSocket | null = null;
  private openListener: (() => void) | null = null;
  private closeListener: ((event: { code?: number; reason?: string }) => void) | null = null;
  private errorListener: ((error: unknown) => void) | null = null;
  private messageListener: ((payload: string) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.socket) {
      return;
    }

    try {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.openListener?.();
      };

      this.socket.onclose = (event: WebSocketCloseEvent) => {
        this.socket = null;
        this.closeListener?.({ code: event.code, reason: event.reason });
      };

      this.socket.onerror = (event) => {
        this.errorListener?.(event);
      };

      this.socket.onmessage = (event: WebSocketMessageEvent) => {
        if (typeof event.data === 'string') {
          this.messageListener?.(event.data);
          return;
        }

        this.messageListener?.(String(event.data));
      };
    } catch (error) {
      this.errorListener?.(error);
      this.socket = null;
    }
  }

  disconnect(): void {
    if (!this.socket) {
      return;
    }

    this.socket.close();
    this.socket = null;
  }

  send(payload: string): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    this.socket.send(payload);
    return true;
  }

  /** Swap the target URL before the first connect() call. */
  setUrl(url: string): void {
    this.url = url;
  }

  isConnected(): boolean {
    return Boolean(this.socket && this.socket.readyState === WebSocket.OPEN);
  }

  onOpen(listener: () => void): void {
    this.openListener = listener;
  }

  onClose(listener: (event: { code?: number; reason?: string }) => void): void {
    this.closeListener = listener;
  }

  onError(listener: (error: unknown) => void): void {
    this.errorListener = listener;
  }

  onMessage(listener: (payload: string) => void): void {
    this.messageListener = listener;
  }
}

class RemoteBridgeService {
  private static instance: RemoteBridgeService;

  private readonly config: RemoteBridgeConfig;
  private readonly dispatcher: JsonRpcDispatcher;
  private readonly transport: BridgeTransport;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private isStarted = false;
  private playbackUnsubscribe: (() => void) | null = null;

  private listeners: Set<RemoteBridgeListener> = new Set();

  private constructor(config?: Partial<RemoteBridgeConfig>, transport?: BridgeTransport) {
    this.config = {
      relayUrl: config?.relayUrl ?? getDefaultRelayUrl(),
      reconnectIntervalMs: config?.reconnectIntervalMs ?? 3000,
      // 0 = retry forever
      maxReconnectAttempts: config?.maxReconnectAttempts ?? 0
    };

    this.transport = transport ?? new WebSocketClientTransport(this.config.relayUrl);
    this.dispatcher = new JsonRpcDispatcher();

    registerPlaybackHandlers(this.dispatcher);
    registerNavigationHandlers(this.dispatcher);
    registerStateHandlers(this.dispatcher);
    registerRemoteHandlers(this.dispatcher);
    registerSduiHandlers(this.dispatcher);

    this.transport.onOpen(() => {
      this.reconnectAttempts = 0;
      // Identify as the TommoTV app FIRST, before anything else
      this.transport.send('HELLO app');
      // Subscribe to state changes only after connected — prevents pre-HELLO event sends
      if (!this.playbackUnsubscribe) {
        this.playbackUnsubscribe = playbackController.subscribe((state) => {
          if (this.transport.isConnected()) {
            this.pushStateEvents(state);
          }
        });
      }
      logger.info('Remote bridge connected', {
        service: 'RemoteBridgeService',
        relayUrl: this.config.relayUrl
      });
      this.notifyListeners();
    });

    this.transport.onClose((event) => {
      logger.warn('Remote bridge disconnected', {
        service: 'RemoteBridgeService',
        code: event.code,
        reason: event.reason
      });
      this.notifyListeners();
      if (this.isStarted) {
        this.scheduleReconnect();
      }
    });

    this.transport.onError((error) => {
      logger.error('Remote bridge transport error', error, {
        service: 'RemoteBridgeService'
      });
      this.notifyListeners();
    });

    this.transport.onMessage((payload) => {
      void this.handleInboundMessage(payload);
    });
  }

  static getInstance(config?: Partial<RemoteBridgeConfig>, transport?: BridgeTransport): RemoteBridgeService {
    if (!RemoteBridgeService.instance) {
      RemoteBridgeService.instance = new RemoteBridgeService(config, transport);
    }

    return RemoteBridgeService.instance;
  }

  /** Create a fresh non-singleton instance for unit tests. */
  static createForTesting(transport: BridgeTransport): RemoteBridgeService {
    return new RemoteBridgeService({}, transport);
  }

  subscribe(listener: RemoteBridgeListener): () => void {
    this.listeners.add(listener);

    listener({
      connected: this.transport.isConnected(),
      reconnectAttempts: this.reconnectAttempts
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  start(): void {
    if (this.isStarted) {
      return;
    }
    this.isStarted = true;

    this.transport.connect();
  }

  stop(): void {
    this.isStarted = false;

    if (this.playbackUnsubscribe) {
      this.playbackUnsubscribe();
      this.playbackUnsubscribe = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.transport.disconnect();
    this.notifyListeners();
  }

  /** Immediately attempt a reconnect — clears any pending backoff timer. */
  reconnectNow(): void {
    if (!this.isStarted || this.transport.isConnected()) return;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    logger.info('Remote bridge: forcing immediate reconnect', { service: 'RemoteBridgeService' });
    this.transport.connect();
  }

  isConnected(): boolean {
    return this.transport.isConnected();
  }

  private notifyListeners(): void {
    const state: ConnectionState = {
      connected: this.transport.isConnected(),
      reconnectAttempts: this.reconnectAttempts
    };

    this.listeners.forEach((listener) => {
      listener(state);
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts += 1;

    // Exponential backoff: 3s → 6s → 12s → 24s → 30s cap — retries forever
    const baseMs = this.config.reconnectIntervalMs;
    const backoffMs = Math.min(baseMs * Math.pow(2, Math.min(this.reconnectAttempts - 1, 4)), 30_000);

    logger.info('Remote bridge reconnect scheduled', {
      service: 'RemoteBridgeService',
      attempt: this.reconnectAttempts,
      delayMs: backoffMs
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.isStarted) return;
      this.transport.connect();
      this.notifyListeners();
    }, backoffMs);
  }

  private async handleInboundMessage(payload: string): Promise<void> {
    let decoded: unknown;

    try {
      decoded = JSON.parse(payload);
    } catch {
      // Non-JSON frame — ignore silently (relay control messages, etc.)
      return;
    }

    // Ignore non-JSON-RPC frames (e.g. any relay handshake messages)
    if (typeof decoded !== 'object' || decoded === null || !('jsonrpc' in decoded)) {
      return;
    }

    const parsed = jsonRpcInboundMessageSchema.safeParse(decoded);

    if (!parsed.success) {
      this.sendError(null, -32600, 'Invalid Request', {
        issues: parsed.error.issues.map((issue) => issue.message)
      });
      return;
    }

    const message = parsed.data;

    const requestParse = jsonRpcRequestSchema.safeParse(message);
    if (requestParse.success) {
      await this.handleRequest(requestParse.data);
      return;
    }

    const notificationParse = jsonRpcNotificationSchema.safeParse(message);
    if (notificationParse.success) {
      await this.handleNotification(notificationParse.data.method, notificationParse.data.params);
      return;
    }

    this.sendError(null, -32600, 'Invalid Request');
  }

  private async handleRequest(request: { id: JsonRpcId; method: BridgeRequestMethod; params?: unknown }): Promise<void> {
    if (!this.dispatcher.has(request.method)) {
      this.sendError(request.id, -32601, 'Method not found', {
        method: request.method
      });
      return;
    }

    try {
      const result = await this.dispatcher.execute(request.method, request.params);
      this.sendResult(request.id, result ?? null);
    } catch (error) {
      if (error instanceof ZodError) {
        this.sendError(request.id, -32602, 'Invalid params', {
          issues: error.issues.map((issue) => issue.message)
        });
        return;
      }

      this.sendError(request.id, -32603, 'Internal error', {
        details: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private async handleNotification(method: BridgeRequestMethod, params: unknown): Promise<void> {
    if (!this.dispatcher.has(method)) {
      return;
    }

    try {
      await this.dispatcher.execute(method, params);
    } catch (error) {
      logger.warn('JSON-RPC notification failed', {
        service: 'RemoteBridgeService',
        method,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  private sendResult(id: JsonRpcId, result: unknown): void {
    const validated = jsonRpcSuccessResponseSchema.parse({
      jsonrpc: '2.0',
      id,
      result
    });

    this.sendPayload(validated);
  }

  private sendError(id: JsonRpcId, code: number, message: string, data?: unknown): void {
    this.sendPayload({
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data !== undefined ? { data } : {})
      }
    });
  }

  private pushStateEvents(state: FullAppState): void {
    this.sendEvent('event.playback', state.playback);
    this.sendEvent('event.navigation', state.navigation);
    this.sendEvent('event.queue', state.queue);
  }

  private sendEvent(method: BridgeEventMethod, payload: PlaybackState | NavigationState | QueueState): void {
    const validatedPayload = eventPayloadSchemaMap[method].parse(payload);
    this.sendPayload({
      jsonrpc: '2.0',
      method,
      params: validatedPayload
    });
  }

  public sendNotification(method: string, params: unknown): void {
    this.sendPayload({
      jsonrpc: '2.0',
      method,
      params
    });
  }

  /** Emit a structured UI selection event (app → relay). */
  public emitUiSelect(payload: { component: string; itemId: string; itemType?: string; title?: string }): void {
    const validated = uiSelectEventSchema.parse(payload);
    this.sendPayload({ jsonrpc: '2.0', method: 'event.ui.select', params: validated });
  }

  /** Emit a structured UI action event (confirm/cancel/custom). */
  public emitUiAction(payload: { component: string; actionId: string; value?: string }): void {
    const validated = uiActionEventSchema.parse(payload);
    this.sendPayload({ jsonrpc: '2.0', method: 'event.ui.action', params: validated });
  }

  /** Emit a UI dismiss event (overlay or canvas closed). */
  public emitUiDismiss(payload: { component?: string; source: 'overlay' | 'canvas' }): void {
    const validated = uiDismissEventSchema.parse(payload);
    this.sendPayload({ jsonrpc: '2.0', method: 'event.ui.dismiss', params: validated });
  }

  private sendPayload(payload: unknown): void {
    const serialized = JSON.stringify(payload);

    if (!this.transport.send(serialized)) {
      logger.warn('Dropping bridge payload while disconnected', {
        service: 'RemoteBridgeService'
      });
    }
  }
}

function getDefaultRelayUrl(): string {
  const envValue = typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_REMOTE_BRIDGE_RELAY_URL : undefined;
  return envValue && envValue.length > 0 ? envValue : 'ws://openclaw.lan:9091/tomotv';
}

export const remoteBridgeService = RemoteBridgeService.getInstance();

/** Named export of the class — for injecting mock transports in tests only. */
export { RemoteBridgeService as RemoteBridgeServiceTestExport };
