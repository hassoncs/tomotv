import { playQueueManager } from '@/services/playQueueManager';
import { libraryManager } from '@/services/libraryManager';
import { logger } from '@/utils/logger';

import type {
  BridgeRouter,
  FullAppState,
  NavigationState,
  PlaybackControlState,
  PlaybackControllerListener,
  PlaybackControllerPlayerControls,
  PlaybackState,
  QueueState,
  RemoteKey,
  RemoteKeyAction
} from '@/bridge/types';

class PlaybackController {
  private static instance: PlaybackController;

  private playerControls: PlaybackControllerPlayerControls | null = null;
  private router: BridgeRouter | null = null;

  private playbackState: PlaybackState = {
    status: 'idle',
    jellyfinId: null,
    positionSeconds: 0,
    durationSeconds: 0,
    playerRegistered: false
  };

  private navigationState: NavigationState = {
    route: '/(tabs)',
    params: {}
  };

  private listeners: Set<PlaybackControllerListener> = new Set();

  private queueUnsubscribe: (() => void) | null = null;
  private libraryUnsubscribe: (() => void) | null = null;
  private playerUnsubscribe: (() => void) | null = null;

  private constructor() {
    this.queueUnsubscribe = playQueueManager.subscribe(() => {
      this.notifyListeners();
    });

    this.libraryUnsubscribe = libraryManager.subscribe(() => {
      this.notifyListeners();
    });
  }

  static getInstance(): PlaybackController {
    if (!PlaybackController.instance) {
      PlaybackController.instance = new PlaybackController();
    }
    return PlaybackController.instance;
  }

  subscribe(listener: PlaybackControllerListener): () => void {
    this.listeners.add(listener);

    logger.debug('Playback controller subscriber added', {
      service: 'PlaybackController',
      totalSubscribers: this.listeners.size
    });

    listener(this.getFullState());

    return () => {
      this.listeners.delete(listener);
      logger.debug('Playback controller subscriber removed', {
        service: 'PlaybackController',
        totalSubscribers: this.listeners.size
      });
    };
  }

  registerPlayer(controls: PlaybackControllerPlayerControls): void {
    this.playerControls = controls;
    this.playbackState.playerRegistered = true;

    const initialState = controls.getState?.();
    if (initialState) {
      this.applyPlayerState(initialState);
    }

    if (this.playerUnsubscribe) {
      this.playerUnsubscribe();
      this.playerUnsubscribe = null;
    }

    if (controls.subscribe) {
      this.playerUnsubscribe = controls.subscribe((state) => {
        this.applyPlayerState(state);
      });
    }

    logger.info('Player registered', {
      service: 'PlaybackController',
      hasStateSubscription: Boolean(controls.subscribe)
    });

    this.notifyListeners();
  }

  unregisterPlayer(): void {
    if (this.playerUnsubscribe) {
      this.playerUnsubscribe();
      this.playerUnsubscribe = null;
    }

    this.playerControls = null;
    this.playbackState = {
      status: 'idle',
      jellyfinId: null,
      positionSeconds: 0,
      durationSeconds: 0,
      playerRegistered: false
    };

    logger.info('Player unregistered', {
      service: 'PlaybackController'
    });

    this.notifyListeners();
  }

  registerRouter(router: BridgeRouter): void {
    this.router = router;
    logger.info('Router registered', {
      service: 'PlaybackController'
    });
    this.notifyListeners();
  }

  unregisterRouter(): void {
    this.router = null;
    logger.info('Router unregistered', {
      service: 'PlaybackController'
    });
    this.notifyListeners();
  }

  setCurrentRoute(route: string, params?: Record<string, string>): void {
    this.navigationState = {
      route,
      params: params ?? {}
    };
    this.notifyListeners();
  }

  getCurrentRoute(): NavigationState {
    return {
      route: this.navigationState.route,
      params: { ...this.navigationState.params }
    };
  }

  navigatePush(route: string, params?: Record<string, string>): void {
    if (!this.router) {
      throw new Error('Router is not registered');
    }

    this.router.push(route, params);
    this.navigationState = {
      route,
      params: params ?? {}
    };

    this.notifyListeners();
  }

  navigateBack(): void {
    if (!this.router) {
      throw new Error('Router is not registered');
    }

    this.router.back();
    this.navigationState = {
      route: '/(tabs)',
      params: {}
    };

    this.notifyListeners();
  }

  async play(jellyfinId: string, folderId?: string): Promise<void> {
    if (!jellyfinId) {
      throw new Error('jellyfinId is required');
    }

    if (this.playerControls?.playById) {
      await Promise.resolve(this.playerControls.playById(jellyfinId, folderId));
    } else if (this.router) {
      this.router.push('/player', {
        videoId: jellyfinId,
        ...(folderId ? { folderId } : {})
      });
      this.navigationState = {
        route: '/player',
        params: {
          videoId: jellyfinId,
          ...(folderId ? { folderId } : {})
        }
      };
    } else {
      throw new Error('No playback target is registered');
    }

    this.playbackState = {
      ...this.playbackState,
      status: 'buffering',
      jellyfinId
    };

    this.notifyListeners();
  }

  async pause(): Promise<void> {
    this.assertPlayerControls();
    await Promise.resolve(this.playerControls!.pause());
    this.playbackState = {
      ...this.playbackState,
      status: 'paused'
    };
    this.notifyListeners();
  }

  async resume(): Promise<void> {
    this.assertPlayerControls();
    await Promise.resolve(this.playerControls!.resume());
    this.playbackState = {
      ...this.playbackState,
      status: 'playing'
    };
    this.notifyListeners();
  }

  async stop(): Promise<void> {
    this.assertPlayerControls();
    await Promise.resolve(this.playerControls!.stop());
    this.playbackState = {
      ...this.playbackState,
      status: 'stopped'
    };
    this.notifyListeners();
  }

  async seek(seconds: number): Promise<void> {
    this.assertPlayerControls();
    if (!Number.isFinite(seconds) || seconds < 0) {
      throw new Error('Seek position must be a non-negative number');
    }
    await Promise.resolve(this.playerControls!.seek(seconds));
    this.playbackState = {
      ...this.playbackState,
      positionSeconds: seconds
    };
    this.notifyListeners();
  }

  async next(): Promise<void> {
    if (this.playerControls?.next) {
      await Promise.resolve(this.playerControls.next());
      this.notifyListeners();
      return;
    }

    const nextItem = playQueueManager.advanceToNext();
    if (!nextItem) {
      throw new Error('No next item available');
    }

    await this.play(nextItem.Id, playQueueManager.getState().sourceFolderId ?? undefined);
  }

  async prev(): Promise<void> {
    if (!this.playerControls?.prev) {
      throw new Error('Previous command is not available for current player');
    }
    await Promise.resolve(this.playerControls.prev());
    this.notifyListeners();
  }

  async remoteKey(key: RemoteKey, action: RemoteKeyAction = 'tap'): Promise<void> {
    if (!this.playerControls?.remoteKey) {
      throw new Error('Remote key control is not available for current player');
    }
    await Promise.resolve(this.playerControls.remoteKey(key, action));
  }

  async inputText(text: string): Promise<void> {
    if (!this.playerControls?.inputText) {
      throw new Error('Text input is not available for current player');
    }
    await Promise.resolve(this.playerControls.inputText(text));
  }

  async clearInput(): Promise<void> {
    if (!this.playerControls?.clearInput) {
      throw new Error('Input clear is not available for current player');
    }
    await Promise.resolve(this.playerControls.clearInput());
  }

  getFullState(): FullAppState {
    return {
      navigation: this.getCurrentRoute(),
      playback: { ...this.playbackState },
      queue: this.getQueueState(),
      library: this.getLibraryState()
    };
  }

  getQueueState(): QueueState {
    const state = playQueueManager.getState();
    return {
      queue: [...state.queue],
      currentIndex: state.currentIndex,
      isLoading: state.isLoading,
      sourceFolderId: state.sourceFolderId
    };
  }

  getLibraryState() {
    const state = libraryManager.getState();
    return {
      videos: [...state.videos],
      isLoading: state.isLoading,
      isLoadingMore: state.isLoadingMore,
      hasMoreResults: state.hasMoreResults,
      error: state.error,
      libraryName: state.libraryName
    };
  }

  private notifyListeners(): void {
    const state = this.getFullState();
    this.listeners.forEach((listener) => {
      listener(state);
    });
  }

  private assertPlayerControls(): void {
    if (!this.playerControls) {
      throw new Error('Player is not registered');
    }
  }

  private applyPlayerState(state: PlaybackControlState): void {
    this.playbackState = {
      status: state.status,
      jellyfinId: state.jellyfinId,
      positionSeconds: state.positionSeconds,
      durationSeconds: state.durationSeconds,
      playerRegistered: true
    };

    this.notifyListeners();
  }
}

export const playbackController = PlaybackController.getInstance();
