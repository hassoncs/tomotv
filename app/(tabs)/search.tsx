import { VideoGridItem } from "@/components/video-grid-item";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLoading } from "@/contexts/LoadingContext";
import { syncDevCredentials } from "@/services/jellyfinApi";
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
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SearchScreen() {
  const router = useRouter();
  const { showGlobalLoader } = useLoading();
  const { videos, isLoading, error, refreshLibrary } = useLibrary();
  const [filteredVideos, setFilteredVideos] = useState<JellyfinVideoItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);
  const focusedGridItemsCountRef = useRef(0);
  const [isGridFocused, setIsGridFocused] = useState(false);

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

  // Filter videos based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredVideos([]);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = videos.filter((video) => {
      const name = video.Name?.toLowerCase() || "";
      const overview = video.Overview?.toLowerCase() || "";

      return name.includes(query) || overview.includes(query);
    });

    setFilteredVideos(filtered);
  }, [searchQuery, videos]);

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

  const renderEmpty = useCallback(() => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
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
          <Text style={styles.errorText}>Check Settings</Text>
          {isConfigError ? (
            <TouchableOpacity
              style={[styles.retryButton, styles.settingsButton]}
              onPress={() => router.push("/(tabs)/settings")}
              isTVSelectable={true}
            >
              <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
              <Text style={styles.retryButtonText}>Go to Settings</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRefresh}
              isTVSelectable={true}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    if (searchQuery.trim()) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="search-outline" size={64} color="#98989D" />
          <Text style={styles.emptyText}>No results found for</Text>
          <Text style={styles.emptyQueryText}>&quot;{searchQuery}&quot;</Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="search-outline" size={64} color="#98989D" />
        <Text style={styles.emptyText}>Search your library</Text>
      </View>
    );
  }, [isLoading, error, searchQuery, router, handleRefresh]);

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

      {filteredVideos.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={filteredVideos}
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
          ListFooterComponent={
            <Text style={styles.resultsLabel}>
              {filteredVideos.length}{" "}
              {filteredVideos.length === 1 ? "result" : "results"}
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
    backgroundColor: "#1C1C1E",
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
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: "#007AFF",
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  retryButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  settingsButton: {
    backgroundColor: "#FFC312",
  },
});
