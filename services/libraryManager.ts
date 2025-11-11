import { fetchVideos, fetchLibraryName } from "@/services/jellyfinApi";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { logger } from "@/utils/logger";

type LibraryListener = (data: {
  videos: JellyfinVideoItem[];
  isLoading: boolean;
  error: string | null;
  libraryName: string;
}) => void;

/**
 * Singleton service for managing library data
 * Handles caching, deduplication, and state updates
 */
class LibraryManager {
  private static instance: LibraryManager;

  private videos: JellyfinVideoItem[] = [];
  private libraryName: string = "JELLYFIN";
  private isLoading: boolean = false;
  private error: string | null = null;

  private isLoadingRef: boolean = false;
  private lastFetchTime: number = 0;
  private libraryNameLoaded: boolean = false;

  private listeners: Set<LibraryListener> = new Set();

  // Cache TTL: 5 minutes
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private constructor() {
    // Private constructor for singleton
  }

  static getInstance(): LibraryManager {
    if (!LibraryManager.instance) {
      LibraryManager.instance = new LibraryManager();
    }
    return LibraryManager.instance;
  }

  /**
   * Subscribe to library state changes
   */
  subscribe(listener: LibraryListener): () => void {
    this.listeners.add(listener);

    // Immediately notify with current state
    listener({
      videos: this.videos,
      isLoading: this.isLoading,
      error: this.error,
      libraryName: this.libraryName,
    });

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify all listeners of state changes
   */
  private notifyListeners() {
    const state = {
      videos: this.videos,
      isLoading: this.isLoading,
      error: this.error,
      libraryName: this.libraryName,
    };

    this.listeners.forEach((listener) => listener(state));
  }

  /**
   * Get current state (synchronous)
   */
  getState() {
    return {
      videos: this.videos,
      isLoading: this.isLoading,
      error: this.error,
      libraryName: this.libraryName,
    };
  }

  /**
   * Load library name (cached, but can be forced to reload)
   */
  private async loadLibraryName(force = false): Promise<void> {
    if (!force && this.libraryNameLoaded) {
      return;
    }

    try {
      const name = await fetchLibraryName();
      this.libraryName = name;
      this.libraryNameLoaded = true;
      this.notifyListeners();
    } catch (err) {
      logger.error("Error loading library name", err, {
        service: "LibraryManager",
      });
      this.libraryName = "JELLYFIN";
    }
  }

  /**
   * Load library data with caching
   */
  async loadLibrary(force = false): Promise<void> {
    // Prevent duplicate loads
    if (this.isLoadingRef) {
      logger.debug("Already loading library, ignoring duplicate call", {
        service: "LibraryManager",
      });
      return;
    }

    // Check cache TTL
    const now = Date.now();
    const cacheAge = now - this.lastFetchTime;
    if (!force && cacheAge < this.CACHE_TTL && this.videos.length > 0) {
      logger.debug("Using cached library data", {
        service: "LibraryManager",
        cacheAge: Math.round(cacheAge / 1000),
        videoCount: this.videos.length,
      });
      return;
    }

    try {
      this.isLoadingRef = true;
      this.isLoading = true;
      this.error = null;
      this.notifyListeners();

      logger.info("Loading library...", {
        service: "LibraryManager",
        forced: force,
      });

      // Fetch videos
      const fetchedVideos = await fetchVideos();
      this.videos = fetchedVideos;
      this.lastFetchTime = now;

      // Load library name (force reload if this is a forced refresh)
      await this.loadLibraryName(force);

      this.isLoading = false;
      this.notifyListeners();

      logger.info("Successfully loaded library", {
        service: "LibraryManager",
        videoCount: fetchedVideos.length,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to load videos";
      this.error = errorMessage;
      this.isLoading = false;
      this.notifyListeners();

      logger.error("Error loading library", err, {
        service: "LibraryManager",
      });
    } finally {
      this.isLoadingRef = false;
    }
  }

  /**
   * Force refresh library (bypass cache)
   */
  async refreshLibrary(): Promise<void> {
    logger.info("Forcing library refresh", { service: "LibraryManager" });
    await this.loadLibrary(true);
  }

  /**
   * Clear cache and reset state
   */
  clearCache(): void {
    this.videos = [];
    this.lastFetchTime = 0;
    this.error = null;
    this.libraryNameLoaded = false;
    this.libraryName = "JELLYFIN";
    this.notifyListeners();

    logger.info("Cache cleared", { service: "LibraryManager" });
  }

  /**
   * Get cache age in seconds
   */
  getCacheAge(): number {
    if (this.lastFetchTime === 0) return 0;
    return Math.round((Date.now() - this.lastFetchTime) / 1000);
  }
}

// Export singleton instance
export const libraryManager = LibraryManager.getInstance();
