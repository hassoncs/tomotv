import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { AppState, AppStateStatus } from "react-native";
import { folderNavigationManager } from "@/services/folderNavigationManager";
import { FolderStackEntry, JellyfinItem } from "@/types/jellyfin";
import { logger } from "@/utils/logger";

interface FolderNavigationContextType {
  items: JellyfinItem[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMoreResults: boolean;
  error: string | null;
  folderStack: FolderStackEntry[];
  currentFolder: FolderStackEntry | null;
  navigateToFolder: (folder: FolderStackEntry) => Promise<void>;
  navigateBack: () => Promise<boolean>;
  navigateToBreadcrumb: (index: number) => Promise<void>;
  loadRoot: () => Promise<void>;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

const FolderNavigationContext = createContext<FolderNavigationContextType | undefined>(undefined);

export function FolderNavigationProvider({ children }: { children: ReactNode }) {
  const initialState = folderNavigationManager.getState();

  const [items, setItems] = useState<JellyfinItem[]>(initialState.items);
  const [isLoading, setIsLoading] = useState(initialState.isLoading);
  const [isLoadingMore, setIsLoadingMore] = useState(initialState.isLoadingMore);
  const [hasMoreResults, setHasMoreResults] = useState(initialState.hasMoreResults);
  const [error, setError] = useState<string | null>(initialState.error);
  const [folderStack, setFolderStack] = useState<FolderStackEntry[]>(initialState.folderStack);

  useEffect(() => {
    let isFirstCall = true;

    const unsubscribe = folderNavigationManager.subscribe((state) => {
      if (isFirstCall) {
        isFirstCall = false;
        logger.debug("Skipping first notification (already initialized)", {
          context: "FolderNavigationContext",
        });
        return;
      }

      logger.debug("Received state update", {
        context: "FolderNavigationContext",
        itemCount: state.items.length,
        isLoading: state.isLoading,
        stackDepth: state.folderStack.length,
        currentFolder: state.currentFolder?.name,
      });

      setItems(state.items);
      setIsLoading(state.isLoading);
      setIsLoadingMore(state.isLoadingMore);
      setHasMoreResults(state.hasMoreResults);
      setError(state.error);
      setFolderStack(state.folderStack);
    });

    // Load root on mount
    folderNavigationManager.loadRoot();

    return unsubscribe;
  }, []);

  // Track app state for foreground refresh
  const appState = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === "active") {
        logger.info("App came to foreground, refreshing folder contents", {
          context: "FolderNavigationContext",
        });
        folderNavigationManager.refresh();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener("change", handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, []);

  const navigateToFolder = useCallback(async (folder: FolderStackEntry) => {
    await folderNavigationManager.navigateToFolder(folder);
  }, []);

  const navigateBack = useCallback(async () => {
    return await folderNavigationManager.navigateBack();
  }, []);

  const navigateToBreadcrumb = useCallback(async (index: number) => {
    await folderNavigationManager.navigateToBreadcrumb(index);
  }, []);

  const loadRoot = useCallback(async () => {
    await folderNavigationManager.loadRoot();
  }, []);

  const loadMore = useCallback(async () => {
    await folderNavigationManager.loadMore();
  }, []);

  const refresh = useCallback(async () => {
    await folderNavigationManager.refresh();
  }, []);

  const currentFolder = useMemo(() => {
    return folderStack.length > 0 ? folderStack[folderStack.length - 1] : null;
  }, [folderStack]);

  const value = useMemo(
    () => ({
      items,
      isLoading,
      isLoadingMore,
      hasMoreResults,
      error,
      folderStack,
      currentFolder,
      navigateToFolder,
      navigateBack,
      navigateToBreadcrumb,
      loadRoot,
      loadMore,
      refresh,
    }),
    [
      items,
      isLoading,
      isLoadingMore,
      hasMoreResults,
      error,
      folderStack,
      currentFolder,
      navigateToFolder,
      navigateBack,
      navigateToBreadcrumb,
      loadRoot,
      loadMore,
      refresh,
    ],
  );

  return (
    <FolderNavigationContext.Provider value={value}>{children}</FolderNavigationContext.Provider>
  );
}

export function useFolderNavigation() {
  const context = useContext(FolderNavigationContext);
  if (context === undefined) {
    throw new Error("useFolderNavigation must be used within a FolderNavigationProvider");
  }
  return context;
}
