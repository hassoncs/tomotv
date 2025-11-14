import { FocusableButton } from "@/components/FocusableButton";
import { VideoGridItem } from "@/components/video-grid-item";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLoading } from "@/contexts/LoadingContext";
import { searchVideos, syncDevCredentials } from "@/services/jellyfinApi";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SearchScreen() {
  const router = useRouter();
  const { showGlobalLoader } = useLoading();
  const { isLoading, error, refreshLibrary } = useLibrary();
  const [searchResults, setSearchResults] = useState<JellyfinVideoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [nextStartIndex, setNextStartIndex] = useState(0);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const focusedGridItemsCountRef = useRef(0);
  const [isGridFocused, setIsGridFocused] = useState(false);
  const searchDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVideoPress = useCallback(
    (video: JellyfinVideoItem) => {
      showGlobalLoader();

      router.push({
        pathname: "/player" as const,
        params: {
          videoId: video.Id,
          videoName: video.Name,
        },
      });
    },
    [router, showGlobalLoader],
  );

  const handleRefresh = useCallback(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  // Sync dev credentials on mount (only once)
  useEffect(() => {
    syncDevCredentials();
  }, []);

  // Focus search input when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      // TextField should automatically receive focus as first focusable element
      // tvOS focus engine will handle this
    }, []),
  );

  const handleGridItemFocus = useCallback(() => {
    focusedGridItemsCountRef.current += 1;
    if (focusedGridItemsCountRef.current > 0) {
      setIsGridFocused(true);
    }
  }, []);

  const handleGridItemBlur = useCallback(() => {
    focusedGridItemsCountRef.current = Math.max(
      0,
      focusedGridItemsCountRef.current - 1,
    );
    if (focusedGridItemsCountRef.current === 0) {
      setIsGridFocused(false);
    }
  }, []);

  const executeSearch = useCallback(
    async (term: string, append: boolean = false) => {
      const trimmed = term.trim();
      if (!trimmed) {
        return;
      }

      // Determine if this is initial search or load more
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsSearching(true);
        setSearchError(null);
        setNextStartIndex(0);
        setHasMoreResults(false);
      }

      try {
        const startIndex = append ? nextStartIndex : 0;
        const pageSize = 60;

        const { items, total } = await searchVideos(trimmed, {
          limit: pageSize,
          startIndex,
        });

        if (append) {
          // Append to existing results
          setSearchResults((prev) => {
            const newResults = [...prev, ...items];
            // Calculate pagination state using updated array
            const hasMore = total !== undefined && newResults.length < total;
            setHasMoreResults(hasMore);
            return newResults;
          });
        } else {
          // Replace results (new search)
          setSearchResults(items);
          // Calculate pagination state for new search
          const hasMore = total !== undefined && items.length < total;
          setHasMoreResults(hasMore);
        }

        setNextStartIndex(startIndex + items.length);
        setActiveQuery(trimmed);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unable to search library. Please try again.";
        setSearchError(message);
        if (!append) {
          setSearchResults([]);
        }
      } finally {
        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsSearching(false);
        }
      }
    },
    [nextStartIndex],
  );

  const handleRetrySearch = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length >= 2) {
      executeSearch(trimmed);
    }
  }, [searchQuery, executeSearch]);

  const handleLoadMore = useCallback(() => {
    // Only load more if we have more results, not currently loading, and have an active query
    if (hasMoreResults && !isLoadingMore && !isSearching && activeQuery) {
      executeSearch(activeQuery, true);
    }
  }, [hasMoreResults, isLoadingMore, isSearching, activeQuery, executeSearch]);

  useEffect(() => {
    if (searchDelayRef.current) {
      clearTimeout(searchDelayRef.current);
      searchDelayRef.current = null;
    }

    const trimmed = searchQuery.trim();

    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    searchDelayRef.current = setTimeout(() => {
      executeSearch(trimmed);
    }, 300);

    return () => {
      if (searchDelayRef.current) {
        clearTimeout(searchDelayRef.current);
        searchDelayRef.current = null;
      }
    };
  }, [searchQuery, executeSearch]);

  const hasSearchQuery = searchQuery.trim().length >= 2;
  const shouldShowResults = hasSearchQuery && searchResults.length > 0;
  const numColumns = useMemo(() => (Platform.isTV ? 5 : 3), []);

  const itemDimensions = useMemo(() => {
    const screenWidth = Math.min(
      Platform.isTV ? 1920 : 1080,
      Platform.isTV ? 1080 : 1920,
    );
    const itemWidth = screenWidth / numColumns;
    const itemHeight = itemWidth * (3 / 2) + 40;

    return { itemHeight };
  }, [numColumns]);

  const getItemLayout = useCallback(
    (_: ArrayLike<JellyfinVideoItem> | null | undefined, index: number) => ({
      length: itemDimensions.itemHeight,
      offset: itemDimensions.itemHeight * Math.floor(index / numColumns),
      index,
    }),
    [itemDimensions, numColumns],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: JellyfinVideoItem; index: number }) => (
      <VideoGridItem
        video={item}
        onPress={handleVideoPress}
        index={index}
        onItemFocus={handleGridItemFocus}
        onItemBlur={handleGridItemBlur}
      />
    ),
    [handleVideoPress, handleGridItemFocus, handleGridItemBlur],
  );

  const renderFooter = useCallback(() => {
    if (isLoadingMore) {
      return (
        <View style={styles.footerLoading}>
          <ActivityIndicator size="small" color="#FFC312" />
          <Text style={styles.footerLoadingText}>Loading more...</Text>
        </View>
      );
    }

    return (
      <Text style={styles.resultsLabel}>
        {searchResults.length}{" "}
        {searchResults.length === 1 ? "result" : "results"}
      </Text>
    );
  }, [isLoadingMore, searchResults.length]);

  const renderEmpty = useCallback(() => {
    if (hasSearchQuery) {
      if (isSearching) {
        return (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color="#FFC312" />
            <Text style={styles.loadingText}>Searching Jellyfin...</Text>
          </View>
        );
      }

      if (searchError) {
        return (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
            <Text style={styles.errorTitle}>Search Failed</Text>
            <Text style={styles.errorText}>{searchError}</Text>
            <FocusableButton title="Try Again" variant="retry" onPress={handleRetrySearch} hasTVPreferredFocus={true} />
          </View>
        );
      }

      return (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color="#98989D" />
          <Text style={styles.emptyText}>No results found for</Text>
          <Text style={styles.emptyQueryText}>&quot;{searchQuery}&quot;</Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#FFC312" />
          <Text style={styles.loadingText}>Loading videos...</Text>
        </View>
      );
    }

    if (error) {
      const isConfigError = error.includes("not configured");

      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Unable to Load Videos</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorText}></Text>
          {isConfigError ? (
            <FocusableButton
              title="Go to Settings"
              variant="primary"
              onPress={() => router.push("/(tabs)/settings")}
              icon={
                <Ionicons
                  name="settings-outline"
                  size={Platform.isTV ? 24 : 20}
                  color="#000000"
                />
              }
              hasTVPreferredFocus={true}
            />
          ) : (
            <FocusableButton
              title="Retry"
              variant="retry"
              onPress={handleRefresh}
              hasTVPreferredFocus={true}
            />
          )}
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="search-outline" size={64} color="#98989D" />
        <Text style={styles.emptyText}>Search your library</Text>
      </View>
    );
  }, [
    hasSearchQuery,
    isSearching,
    searchError,
    searchQuery,
    isLoading,
    error,
    router,
    handleRefresh,
    handleRetrySearch,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {!isGridFocused && (
        <View style={styles.searchContainer} focusable>
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            placeholder="Search library"
            placeholderTextColor="#8E8E93"
            autoCorrect={false}
            onChangeText={setSearchQuery}
            style={styles.searchInput}
            multiline={false}
            autoFocus={false}
            numberOfLines={1}
            returnKeyType="search"
          />
        </View>
      )}

      {shouldShowResults ? (
        <FlatList
          testID="search-results-list"
          data={searchResults}
          renderItem={renderItem}
          keyExtractor={(item) => item.Id}
          getItemLayout={getItemLayout}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={true}
          updateCellsBatchingPeriod={100}
          initialNumToRender={Platform.isTV ? 10 : 9}
          maxToRenderPerBatch={Platform.isTV ? 10 : 9}
          windowSize={3}
          contentInsetAdjustmentBehavior="automatic"
          removeClippedSubviews={true}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      ) : (
        renderEmpty()
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3d3d3d",
  },
  searchContainer: {
    position: "absolute",
    top: 160,
    left: 0,
    right: 0,
    paddingHorizontal: Platform.isTV ? 80 : 16,
    zIndex: 999,
    pointerEvents: "box-none",
  },
  searchInput: {
    width: "100%",
    height: Platform.isTV ? 56 : 44,
    // backgroundColor: "#1C1C1E",
    borderRadius: 100,
    paddingHorizontal: Platform.isTV ? 24 : 16,
    fontSize: Platform.isTV ? 24 : 20,
    color: "#FFFFFF",
  },
  resultsLabel: {
    marginTop: -15,
    marginLeft: 15,
    paddingHorizontal: Platform.isTV ? 4 : 2,
    fontSize: Platform.isTV ? 16 : 13,
    color: "#98989D",
    fontWeight: "400",
  },
  gridContent: {
    paddingTop: Platform.isTV ? 60 : 20,
    paddingBottom: 60,
  },
  columnWrapper: {
    justifyContent: "flex-start",
    paddingVertical: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 36,
    fontSize: 20,
    color: "#98989D",
    fontWeight: "500",
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
  },
  errorText: {
    marginTop: 8,
    fontSize: 17,
    color: "#98989D",
    textAlign: "center",
    lineHeight: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 20,
    color: "#98989D",
    textAlign: "center",
  },
  emptyQueryText: {
    marginTop: 8,
    fontSize: Platform.isTV ? 24 : 18,
    color: "#FFFFFF",
    textAlign: "center",
    fontWeight: "600",
  },
  footerLoading: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 12,
  },
  footerLoadingText: {
    fontSize: Platform.isTV ? 18 : 15,
    color: "#98989D",
    fontWeight: "500",
  },
});
