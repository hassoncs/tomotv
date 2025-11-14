import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
  useEffect,
} from "react";
import { libraryManager } from "@/services/libraryManager";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { logger } from "@/utils/logger";

interface LibraryContextType {
  videos: JellyfinVideoItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreResults: boolean;
  error: string | null;
  libraryName: string;
  refreshLibrary: () => Promise<void>;
  loadLibrary: (force?: boolean) => Promise<void>;
  loadMore: () => Promise<void>;
}

const LibraryContext = createContext<LibraryContextType | undefined>(
  undefined,
);

export function LibraryProvider({ children }: { children: ReactNode }) {
  // Get initial state from singleton
  const initialState = libraryManager.getState();

  const [videos, setVideos] = useState<JellyfinVideoItem[]>(
    initialState.videos,
  );
  const [isLoading, setIsLoading] = useState(initialState.isLoading);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [error, setError] = useState<string | null>(initialState.error);
  const [libraryName, setLibraryName] = useState<string>(
    initialState.libraryName,
  );

  // Subscribe to singleton state changes
  useEffect(() => {
    let isFirstCall = true;

    const unsubscribe = libraryManager.subscribe((state) => {
      // Skip first call since we already initialized from getState()
      if (isFirstCall) {
        isFirstCall = false;
        logger.debug("Skipping first notification (already initialized)", {
          context: "LibraryContext",
        });
        return;
      }

      logger.debug("Received state update", {
        context: "LibraryContext",
        videoCount: state.videos.length,
        isLoading: state.isLoading,
        isLoadingMore: state.isLoadingMore,
        hasMoreResults: state.hasMoreResults,
        hasError: !!state.error,
        libraryName: state.libraryName,
      });

      setVideos(state.videos);
      setIsLoading(state.isLoading);
      setIsLoadingMore(state.isLoadingMore);
      setHasMoreResults(state.hasMoreResults);
      setError(state.error);
      setLibraryName(state.libraryName);
    });

    // Auto-load library on mount
    libraryManager.loadLibrary();

    return unsubscribe;
  }, []);

  // Stable function references (no dependencies needed)
  const loadLibrary = useCallback(
    async (force = false) => {
      await libraryManager.loadLibrary(force);
    },
    [],
  );

  const refreshLibrary = useCallback(async () => {
    logger.debug("refreshLibrary called", { context: "LibraryContext" });
    await libraryManager.refreshLibrary();
  }, []);

  const loadMore = useCallback(async () => {
    logger.debug("loadMore called", { context: "LibraryContext" });
    await libraryManager.loadMore();
  }, []);

  const value = useMemo(
    () => ({
      videos,
      isLoading,
      isLoadingMore,
      hasMoreResults,
      error,
      libraryName,
      refreshLibrary,
      loadLibrary,
      loadMore,
    }),
    [videos, isLoading, isLoadingMore, hasMoreResults, error, libraryName, refreshLibrary, loadLibrary, loadMore],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (context === undefined) {
    throw new Error("useLibrary must be used within a LibraryProvider");
  }
  return context;
}
