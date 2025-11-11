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

interface LibraryContextType {
  videos: JellyfinVideoItem[];
  isLoading: boolean;
  error: string | null;
  libraryName: string;
  refreshLibrary: () => Promise<void>;
  loadLibrary: (force?: boolean) => Promise<void>;
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
        return;
      }

      setVideos(state.videos);
      setIsLoading(state.isLoading);
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
    await libraryManager.refreshLibrary();
  }, []);

  const value = useMemo(
    () => ({
      videos,
      isLoading,
      error,
      libraryName,
      refreshLibrary,
      loadLibrary,
    }),
    [videos, isLoading, error, libraryName, refreshLibrary, loadLibrary],
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
