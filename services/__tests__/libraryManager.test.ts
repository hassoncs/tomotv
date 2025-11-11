import { libraryManager } from "../libraryManager";
import { fetchVideos, fetchLibraryName } from "../jellyfinApi";
import { JellyfinVideoItem } from "@/types/jellyfin";

// Mock dependencies
jest.mock("../jellyfinApi");
jest.mock("@/utils/logger");

const mockFetchVideos = fetchVideos as jest.MockedFunction<typeof fetchVideos>;
const mockFetchLibraryName = fetchLibraryName as jest.MockedFunction<
  typeof fetchLibraryName
>;

describe("LibraryManager", () => {
  const mockVideos: JellyfinVideoItem[] = [
    {
      Id: "1",
      Name: "Test Video 1",
      Type: "Movie",
      RunTimeTicks: 36000000000,
      Path: "/media/video1.mp4",
    },
    {
      Id: "2",
      Name: "Test Video 2",
      Type: "Movie",
      RunTimeTicks: 36000000000,
      Path: "/media/video2.mp4",
    },
  ];

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset singleton state
    libraryManager.clearCache();

    // Default mock implementations
    mockFetchVideos.mockResolvedValue(mockVideos);
    mockFetchLibraryName.mockResolvedValue("Test Library");
  });

  describe("singleton pattern", () => {
    it("should return the same instance", () => {
      const instance1 = libraryManager;
      const instance2 = libraryManager;
      expect(instance1).toBe(instance2);
    });
  });

  describe("loadLibrary", () => {
    it("should load videos and library name on first call", async () => {
      await libraryManager.loadLibrary();

      const state = libraryManager.getState();

      expect(mockFetchVideos).toHaveBeenCalledTimes(1);
      expect(mockFetchLibraryName).toHaveBeenCalledTimes(1);
      expect(state.videos).toEqual(mockVideos);
      expect(state.libraryName).toBe("Test Library");
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe(null);
    });

    it("should use cache on subsequent calls within TTL", async () => {
      // First load
      await libraryManager.loadLibrary();
      expect(mockFetchVideos).toHaveBeenCalledTimes(1);

      // Second load (should use cache)
      await libraryManager.loadLibrary();
      expect(mockFetchVideos).toHaveBeenCalledTimes(1); // Still 1, not 2

      const state = libraryManager.getState();
      expect(state.videos).toEqual(mockVideos);
    });

    it("should bypass cache when force=true", async () => {
      // First load
      await libraryManager.loadLibrary();
      expect(mockFetchVideos).toHaveBeenCalledTimes(1);

      // Forced load (should bypass cache)
      await libraryManager.loadLibrary(true);
      expect(mockFetchVideos).toHaveBeenCalledTimes(2); // Called again

      const state = libraryManager.getState();
      expect(state.videos).toEqual(mockVideos);
    });

    it("should reload library name when force=true", async () => {
      // First load
      await libraryManager.loadLibrary();
      expect(mockFetchLibraryName).toHaveBeenCalledTimes(1);

      // Change mock return value
      mockFetchLibraryName.mockResolvedValue("New Library");

      // Forced load (should reload library name)
      await libraryManager.loadLibrary(true);
      expect(mockFetchLibraryName).toHaveBeenCalledTimes(2);

      const state = libraryManager.getState();
      expect(state.libraryName).toBe("New Library");
    });

    it("should prevent duplicate simultaneous loads", async () => {
      // Start two loads simultaneously
      const promise1 = libraryManager.loadLibrary();
      const promise2 = libraryManager.loadLibrary();

      await Promise.all([promise1, promise2]);

      // Should only call fetchVideos once
      expect(mockFetchVideos).toHaveBeenCalledTimes(1);
    });

    it("should handle fetch errors gracefully", async () => {
      const error = new Error("Network error");
      mockFetchVideos.mockRejectedValue(error);

      await libraryManager.loadLibrary();

      const state = libraryManager.getState();
      expect(state.error).toBe("Network error");
      expect(state.isLoading).toBe(false);
      expect(state.videos).toEqual([]);
    });

    it("should clear error on successful retry", async () => {
      // First attempt fails
      mockFetchVideos.mockRejectedValueOnce(new Error("Network error"));
      await libraryManager.loadLibrary(true);

      let state = libraryManager.getState();
      expect(state.error).toBe("Network error");

      // Second attempt succeeds
      mockFetchVideos.mockResolvedValue(mockVideos);
      await libraryManager.loadLibrary(true);

      state = libraryManager.getState();
      expect(state.error).toBe(null);
      expect(state.videos).toEqual(mockVideos);
    });

    it("should set isLoading to true during fetch and false after", async () => {
      let loadingDuringFetch = false;

      mockFetchVideos.mockImplementation(async () => {
        loadingDuringFetch = libraryManager.getState().isLoading;
        return mockVideos;
      });

      await libraryManager.loadLibrary();

      expect(loadingDuringFetch).toBe(true);
      expect(libraryManager.getState().isLoading).toBe(false);
    });
  });

  describe("refreshLibrary", () => {
    it("should force reload bypassing cache", async () => {
      // Initial load
      await libraryManager.loadLibrary();
      expect(mockFetchVideos).toHaveBeenCalledTimes(1);

      // Refresh should force reload
      await libraryManager.refreshLibrary();
      expect(mockFetchVideos).toHaveBeenCalledTimes(2);
    });
  });

  describe("subscribe", () => {
    it("should notify listener immediately with current state", () => {
      const listener = jest.fn();

      libraryManager.subscribe(listener);

      expect(listener).toHaveBeenCalledWith({
        videos: [],
        isLoading: false,
        error: null,
        libraryName: "JELLYFIN",
      });
    });

    it("should notify listener on state changes", async () => {
      const listener = jest.fn();
      libraryManager.subscribe(listener);

      // Clear initial call
      listener.mockClear();

      // Load library
      await libraryManager.loadLibrary();

      // Should be called multiple times during load (loading start + loading end)
      expect(listener).toHaveBeenCalled();

      // Final call should have videos
      const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0];
      expect(lastCall.videos).toEqual(mockVideos);
      expect(lastCall.isLoading).toBe(false);
    });

    it("should return unsubscribe function", async () => {
      const listener = jest.fn();
      const unsubscribe = libraryManager.subscribe(listener);

      // Clear initial call
      listener.mockClear();

      // Unsubscribe
      unsubscribe();

      // Load library
      await libraryManager.loadLibrary();

      // Listener should NOT be called after unsubscribe
      expect(listener).not.toHaveBeenCalled();
    });

    it("should support multiple subscribers", async () => {
      const listener1 = jest.fn();
      const listener2 = jest.fn();

      libraryManager.subscribe(listener1);
      libraryManager.subscribe(listener2);

      // Clear initial calls
      listener1.mockClear();
      listener2.mockClear();

      // Load library
      await libraryManager.loadLibrary();

      // Both listeners should be notified
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });
  });

  describe("getState", () => {
    it("should return current state synchronously", () => {
      const state = libraryManager.getState();

      expect(state).toEqual({
        videos: [],
        isLoading: false,
        error: null,
        libraryName: "JELLYFIN",
      });
    });

    it("should return updated state after load", async () => {
      await libraryManager.loadLibrary();

      const state = libraryManager.getState();

      expect(state.videos).toEqual(mockVideos);
      expect(state.libraryName).toBe("Test Library");
    });
  });

  describe("clearCache", () => {
    it("should reset all state to initial values", async () => {
      // Load library
      await libraryManager.loadLibrary();

      let state = libraryManager.getState();
      expect(state.videos.length).toBeGreaterThan(0);
      expect(state.libraryName).not.toBe("JELLYFIN");

      // Clear cache
      libraryManager.clearCache();

      state = libraryManager.getState();
      expect(state.videos).toEqual([]);
      expect(state.libraryName).toBe("JELLYFIN");
      expect(state.error).toBe(null);
    });

    it("should reset cache timestamp", async () => {
      // Load library
      await libraryManager.loadLibrary();

      // Cache age should be >= 0 after loading (could be 0 if very fast)
      const ageBeforeClear = libraryManager.getCacheAge();
      expect(ageBeforeClear).toBeGreaterThanOrEqual(0);

      // Clear cache
      libraryManager.clearCache();

      // After clear, should definitely be 0
      expect(libraryManager.getCacheAge()).toBe(0);
    });

    it("should notify listeners after clearing", () => {
      const listener = jest.fn();
      libraryManager.subscribe(listener);

      // Clear initial call
      listener.mockClear();

      // Clear cache
      libraryManager.clearCache();

      // Listener should be notified
      expect(listener).toHaveBeenCalledWith({
        videos: [],
        isLoading: false,
        error: null,
        libraryName: "JELLYFIN",
      });
    });
  });

  describe("getCacheAge", () => {
    it("should return 0 when no data has been loaded", () => {
      expect(libraryManager.getCacheAge()).toBe(0);
    });

    it("should return age in seconds after loading", async () => {
      await libraryManager.loadLibrary();

      const age = libraryManager.getCacheAge();
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(5); // Should be less than 5 seconds
    });
  });

  describe("cache TTL behavior", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should refetch after cache TTL expires", async () => {
      // Initial load
      await libraryManager.loadLibrary();
      expect(mockFetchVideos).toHaveBeenCalledTimes(1);

      // Advance time by 6 minutes (more than 5 min TTL)
      jest.advanceTimersByTime(6 * 60 * 1000);

      // Load again (cache should be stale)
      await libraryManager.loadLibrary();
      expect(mockFetchVideos).toHaveBeenCalledTimes(2);
    });

    it("should use cache within TTL window", async () => {
      // Initial load
      await libraryManager.loadLibrary();
      expect(mockFetchVideos).toHaveBeenCalledTimes(1);

      // Advance time by 4 minutes (less than 5 min TTL)
      jest.advanceTimersByTime(4 * 60 * 1000);

      // Load again (cache should still be valid)
      await libraryManager.loadLibrary();
      expect(mockFetchVideos).toHaveBeenCalledTimes(1); // Still 1
    });
  });
});
