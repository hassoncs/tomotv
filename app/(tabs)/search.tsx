import { FocusableButton } from "@/components/FocusableButton";
import { VideoGridItem } from "@/components/video-grid-item";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLoading } from "@/contexts/LoadingContext";
import { searchVideos, syncDevCredentials } from "@/services/jellyfinApi";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, findNodeHandle, FlatList, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function SearchScreen() {
  const router = useRouter();
  const { showGlobalLoader } = useLoading();
  const { isLoading, error } = useLibrary();
  const [searchResults, setSearchResults] = useState<JellyfinVideoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [nextStartIndex, setNextStartIndex] = useState(0);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const searchDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstResultRef = useRef<TouchableOpacity>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const handleVideoPress = useCallback(
    (video: JellyfinVideoItem) => {
      showGlobalLoader();
      router.push({
        pathname: "/player" as const,
        params: { videoId: video.Id, videoName: video.Name },
      });
    },
    [router, showGlobalLoader],
  );

  const focusFirstResult = useCallback(() => {
    if (Platform.isTV && firstResultRef.current) {
      (firstResultRef.current as unknown as { requestTVFocus: () => void }).requestTVFocus();
    }
  }, []);

  useEffect(() => {
    syncDevCredentials();
  }, []);

  useEffect(() => {
    if (isLoading && searchError) {
      setSearchError(null);
    }
  }, [isLoading, searchError]);

  const executeSearch = useCallback(
    async (term: string, append: boolean = false) => {
      const trimmed = term.trim();
      if (!trimmed) return;

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
        const { items, total } = await searchVideos(trimmed, { limit: pageSize, startIndex });

        if (append) {
          setSearchResults((prev) => {
            const newResults = [...prev, ...items];
            setHasMoreResults(total !== undefined && newResults.length < total);
            return newResults;
          });
        } else {
          setSearchResults(items);
          setHasMoreResults(total !== undefined && items.length < total);
        }
        setNextStartIndex(startIndex + items.length);
        setActiveQuery(trimmed);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to search. Please try again.";
        setSearchError(message);
        if (!append) setSearchResults([]);
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
    if (searchQuery.trim().length >= 2) {
      executeSearch(searchQuery.trim());
    }
  }, [searchQuery, executeSearch]);

  const handleLoadMore = useCallback(() => {
    if (hasMoreResults && !isLoadingMore && !isSearching && activeQuery) {
      executeSearch(activeQuery, true);
    }
  }, [hasMoreResults, isLoadingMore, isSearching, activeQuery, executeSearch]);

  useEffect(() => {
    if (searchDelayRef.current) {
      clearTimeout(searchDelayRef.current);
    }

    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    searchDelayRef.current = setTimeout(() => executeSearch(trimmed), 300);
    return () => {
      if (searchDelayRef.current) clearTimeout(searchDelayRef.current);
    };
  }, [searchQuery, executeSearch]);

  const hasSearchQuery = searchQuery.trim().length >= 2;
  const shouldShowResults = hasSearchQuery && searchResults.length > 0;
  const numColumns = Platform.isTV ? 5 : 3;

  const itemDimensions = useMemo(() => {
    const screenWidth = Platform.isTV ? 1080 : 400;
    const itemWidth = screenWidth / numColumns;
    const itemHeight = itemWidth * 1.5 + 40;
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

  const [searchInputHandle, setSearchInputHandle] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (Platform.isTV && searchInputRef.current) {
      const handle = findNodeHandle(searchInputRef.current);
      setSearchInputHandle(handle ?? undefined);
    }
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: JellyfinVideoItem; index: number }) => {
      const isFirstRow = index < numColumns;
      return (
        <VideoGridItem
          ref={index === 0 ? firstResultRef : undefined}
          video={item}
          onPress={handleVideoPress}
          index={index}
          hasTVPreferredFocus={index === 0 && shouldShowResults}
          nextFocusUp={isFirstRow ? searchInputHandle : undefined}
        />
      );
    },
    [handleVideoPress, shouldShowResults, numColumns, searchInputHandle],
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
        {searchResults.length} {searchResults.length === 1 ? "result" : "results"}
      </Text>
    );
  }, [isLoadingMore, searchResults.length]);

  const renderEmpty = useCallback(() => {
    if (hasSearchQuery) {
      if (isSearching) {
        return (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="small" color="#FFC312" />
            <Text style={styles.loadingText}>Searching...</Text>
          </View>
        );
      }
      if (searchError) {
        return (
          <View style={styles.centerContainer}>
            <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
            <Text style={styles.errorTitle}>Search Failed</Text>
            <Text style={styles.errorText}>{searchError}</Text>
            <FocusableButton title="Try Again" variant="retry" onPress={handleRetrySearch} hasTVPreferredFocus />
          </View>
        );
      }
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color="#98989D" />
          <Text style={styles.emptyText}>No results for &quot;{searchQuery}&quot;</Text>
        </View>
      );
    }

    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="small" color="#FFC312" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Unable to Load</Text>
          <Text style={styles.errorText}>{error}</Text>
          <FocusableButton
            title="Go to Settings"
            variant="primary"
            onPress={() => router.push("/(tabs)/settings")}
            icon={<Ionicons name="settings-outline" size={24} color="#000" />}
            hasTVPreferredFocus
          />
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="search-outline" size={64} color="#98989D" />
        <Text style={styles.emptyText}>Search your library</Text>
      </View>
    );
  }, [hasSearchQuery, isSearching, searchError, searchQuery, isLoading, error, router, handleRetrySearch]);

  const renderHeader = useCallback(
    () => (
      <View style={styles.searchContainer}>
        <View style={styles.searchInputWrapper}>
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            placeholder="Search movies and videos..."
            placeholderTextColor={isInputFocused ? "#636366" : "#8E8E93"}
            autoCorrect={false}
            autoCapitalize="none"
            onChangeText={setSearchQuery}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            onSubmitEditing={() => {
              if (shouldShowResults) {
                focusFirstResult();
              }
            }}
            style={[styles.searchInput, isInputFocused && styles.searchInputFocused]}
            multiline={false}
            numberOfLines={1}
            returnKeyType="search"
          />
        </View>
      </View>
    ),
    [searchQuery, shouldShowResults, focusFirstResult, isInputFocused],
  );

  return (
    <View style={styles.container}>
      {shouldShowResults ? (
        <FlatList
          data={searchResults}
          renderItem={renderItem}
          keyExtractor={(item) => item.Id}
          getItemLayout={getItemLayout}
          numColumns={numColumns}
          key={numColumns}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={3}
          removeClippedSubviews
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
        />
      ) : (
        <View style={styles.emptyContainer}>
          {renderHeader()}
          {renderEmpty()}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1C1C1E",
  },
  emptyContainer: {
    flex: 1,
  },
  searchContainer: {
    paddingTop: Platform.isTV ? 150 : 60,
    paddingHorizontal: Platform.isTV ? 80 : 16,
    paddingBottom: Platform.isTV ? 24 : 16,
    alignItems: "center",
  },
  searchInputWrapper: {
    width: "100%",
    maxWidth: 800,
    borderRadius: Platform.isTV ? 28 : 25,
    overflow: "hidden",
  },
  searchInput: {
    width: "100%",
    minHeight: Platform.isTV ? 56 : 50,
    backgroundColor: "#1C1C1E",
    paddingHorizontal: Platform.isTV ? 28 : 20,
    fontSize: Platform.isTV ? 24 : 20,
    color: "#FFFFFF",
  },
  searchInputFocused: {
    color: "#1C1C1E",
  },
  gridContent: {
    paddingBottom: Platform.isTV ? 120 : 100,
    paddingHorizontal: Platform.isTV ? 40 : 16,
  },
  columnWrapper: {
    justifyContent: "flex-start",
    paddingVertical: Platform.isTV ? 24 : 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  loadingText: {
    marginTop: 24,
    fontSize: Platform.isTV ? 20 : 16,
    color: "#98989D",
    fontWeight: "500",
  },
  errorTitle: {
    marginTop: 16,
    fontSize: Platform.isTV ? 24 : 20,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  errorText: {
    marginTop: 8,
    fontSize: Platform.isTV ? 18 : 15,
    color: "#98989D",
    textAlign: "center",
    lineHeight: 24,
  },
  emptyText: {
    marginTop: 16,
    fontSize: Platform.isTV ? 20 : 16,
    color: "#98989D",
    textAlign: "center",
  },
  resultsLabel: {
    marginTop: -8,
    marginLeft: 16,
    fontSize: Platform.isTV ? 16 : 13,
    color: "#98989D",
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
  },
});
