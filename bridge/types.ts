import type { JellyfinVideoItem } from '@/types/jellyfin';

export type HandlerFn = (params: unknown) => Promise<unknown>;

export type BridgeRequestMethod =
  | 'playback.play'
  | 'playback.pause'
  | 'playback.resume'
  | 'playback.stop'
  | 'playback.seek'
  | 'playback.next'
  | 'playback.prev'
  | 'state.status'
  | 'state.queue'
  | 'state.library'
  | 'navigation.push'
  | 'navigation.back'
  | 'navigation.getCurrentRoute'
  | 'navigation.push'
  | 'navigation.back'
  | 'navigation.getCurrentRoute'
  | 'remote.key'
  | 'input.text'
  | 'input.clear'
  | 'ui.render'
  | 'ui.components';

export type BridgeEventMethod =
  | 'event.playback'
  | 'event.navigation'
  | 'event.queue'
  | 'event.ui.select'
  | 'event.ui.action'
  | 'event.ui.dismiss';

export interface HandlerDispatcher {
  register(method: BridgeRequestMethod, handler: HandlerFn): void;
}

export interface BridgeRouter {
  push(route: string, params?: Record<string, string>): void;
  back(): void;
}

export interface PlaybackControlState {
  status: PlaybackStatus;
  jellyfinId: string | null;
  positionSeconds: number;
  durationSeconds: number;
}

export interface PlaybackControllerPlayerControls {
  pause(): void | Promise<void>;
  resume(): void | Promise<void>;
  stop(): void | Promise<void>;
  seek(seconds: number): void | Promise<void>;
  next?(): void | Promise<void>;
  prev?(): void | Promise<void>;
  playById?(jellyfinId: string, folderId?: string): void | Promise<void>;
  remoteKey?(key: RemoteKey, action: RemoteKeyAction): void | Promise<void>;
  inputText?(text: string): void | Promise<void>;
  clearInput?(): void | Promise<void>;
  getState?(): PlaybackControlState;
  subscribe?(listener: (state: PlaybackControlState) => void): () => void;
}

export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'stopped' | 'buffering' | 'error';

export type RemoteKey = 'up' | 'down' | 'left' | 'right' | 'select' | 'menu' | 'play_pause';

export type RemoteKeyAction = 'tap' | 'hold';

export interface NavigationState {
  route: string;
  params: Record<string, string>;
}

export interface PlaybackState {
  status: PlaybackStatus;
  jellyfinId: string | null;
  positionSeconds: number;
  durationSeconds: number;
  playerRegistered: boolean;
}

export interface QueueState {
  queue: JellyfinVideoItem[];
  currentIndex: number;
  isLoading: boolean;
  sourceFolderId: string | null;
}

export interface LibraryState {
  videos: JellyfinVideoItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreResults: boolean;
  error: string | null;
  libraryName: string;
}

export interface FullAppState {
  navigation: NavigationState;
  playback: PlaybackState;
  queue: QueueState;
  library: LibraryState;
}

export type PlaybackControllerListener = (state: FullAppState) => void;

export interface BridgeTransport {
  connect(): void;
  disconnect(): void;
  send(payload: string): boolean;
  isConnected(): boolean;
  onOpen(listener: () => void): void;
  onClose(listener: (event: { code?: number; reason?: string }) => void): void;
  onError(listener: (error: unknown) => void): void;
  onMessage(listener: (payload: string) => void): void;
}

export interface RemoteBridgeConfig {
  relayUrl: string;
  reconnectIntervalMs: number;
  maxReconnectAttempts: number;
}
