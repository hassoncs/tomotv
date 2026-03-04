import { BackGridItem } from "@/components/back-grid-item";
import { Breadcrumb } from "@/components/breadcrumb";
import { FocusableButton } from "@/components/FocusableButton";
import { FolderGridItem } from "@/components/folder-grid-item";
import { HeroBillboard } from "@/components/HeroBillboard";
import { VideoGridItem } from "@/components/video-grid-item";
import { VideoShelf } from "@/components/VideoShelf";
import { SkiaLibraryBackground } from "@/components/SkiaLibraryBackground";
import { useFolderNavigation } from "@/contexts/FolderNavigationContext";
import { useLoading } from "@/contexts/LoadingContext";
import { usePlayQueue } from "@/contexts/PlayQueueContext";
import { useBackground } from "@/contexts/BackgroundContext";
import { connectToDemoServer, getBackdropUrl, getPosterUrl, getContinueWatching, getNextUp, getRecentlyAdded, isFolder } from "@/services/jellyfinApi";
import { JellyfinItem } from "@/types/jellyfin";
import { logger } from "@/utils/logger";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, BackHandler, Dimensions, FlatList, Platform, ScrollView, StyleSheet, Text, View, useTVEventHandler } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Special marker for the ".." back navigation item
const BACK_ITEM_ID = "__BACK__";
type GridItem = JellyfinItem | { Id: typeof BACK_ITEM_ID; _isBackItem: true };

// Uniform card sizing constants (all cards are 2:3 portrait)
const IS_TV = Platform.isTV;
const NUM_COLUMNS = IS_TV ? 5 : 3;
const CARD_PADDING = IS_TV ? 16 : 8;
const GRID_PADDING_H = (IS_TV ? 80 : 60) + (IS_TV ? 40 : 20);
const COLUMN_WRAPPER_PADDING_V = 24;

// TV tab bar is ~210px tall, phone tab bars are ~49px + safe area
const TAB_BAR_HEIGHT = IS_TV ? 210 : 49;

const itemDimensions = (() => {
  const screenWidth = Dimensions.get("window").width;
  const availableWidth = screenWidth - GRID_PADDING_H;
  const columnWidth = availableWidth / NUM_COLUMNS;
  const imageWidth = columnWidth - 2 * CARD_PADDING;
  const imageHeight = imageWidth * 1.5; // 2:3 aspect ratio → height = width * 3/2
  const rowHeight = imageHeight + 2 * CARD_PADDING + 2 * COLUMN_WRAPPER_PADDING_V;
  return { rowHeight };
})();

export default function VideoLibraryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showGlobalLoader, hideGlobalLoader } = useLoading();
  const { items, isLoading, isLoadingMore, hasMoreResults, error, folderStack, currentFolder, navigateToFolder, navigateBack, loadMore, refresh } = useFolderNavigation();
  const { buildQueue } = usePlayQueue();
  const { setBackdropUrl, setScreenContext, currentImageSource } = useBackground();
  // Extract URL string for SkiaLibraryBackground (ambient require() assets fall back to dark base)
  const backdropImageUrl = currentImageSource && typeof currentImageSource !== "number" ? currentImageSource.uri : undefined;
  const heroBackdropUrlRef = useRef<string | undefined>(undefined);
  const shelfFocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // True while the user is focused on a shelf item — carousel auto-rotate should not override backdrop
  const shelfFocusedRef = useRef(false);
  // Animated value: 1 = hero fully visible, 0 = hero collapsed
  const heroAnim = useRef(new Animated.Value(1)).current;

  const handleMoreInfo = useCallback(
    (item: JellyfinItem) => {
      router.push({ pathname: "/detail" as any, params: { itemId: item.Id, itemName: item.Name } });
    },
    [router],
  );
  const [isConnectingToDemo, setIsConnectingToDemo] = useState(false);

  const [homeData, setHomeData] = useState<{
    recentlyAdded: JellyfinItem[];
    continueWatching: JellyfinItem[];
    nextUp: JellyfinItem[];
  } | null>(null);
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(false);

  // Handle TV menu button for back navigation
  useTVEventHandler((event) => {
    if (event.eventType === "menu" && folderStack.length > 0) {
      navigateBack();
    }
  });

  // Handle Android back button
  useEffect(() => {
    const handleBackPress = () => {
      if (folderStack.length > 0) {
        navigateBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
    return () => subscription.remove();
  }, [folderStack, navigateBack]);

  useEffect(() => {
    if (folderStack.length === 0) {
      setIsLoadingHomeData(true);
      Promise.all([getRecentlyAdded(), getContinueWatching(), getNextUp()])
        .then(([recentlyAdded, continueWatching, nextUp]) => {
          setHomeData({ recentlyAdded, continueWatching, nextUp });
        })
        .catch((err) => {
          logger.warn("Failed to load home screen data", err, { service: "LibraryScreen" });
        })
        .finally(() => {
          setIsLoadingHomeData(false);
        });
    }
  }, [folderStack.length]);

  useEffect(() => {
    setScreenContext("home");
  }, [setScreenContext]);

  useEffect(() => {
    if (folderStack.length > 0) {
      setBackdropUrl(undefined);
    }
  }, [folderStack.length, setBackdropUrl]);

  const handleHeroItemChange = useCallback(
    (item: JellyfinItem) => {
      const url = item.BackdropImageTags && item.BackdropImageTags.length > 0 ? getBackdropUrl(item.Id) : undefined;
      heroBackdropUrlRef.current = url;
      // Don't override backdrop while user is focused on a shelf item
      if (!shelfFocusedRef.current) {
        setBackdropUrl(url);
      }
    },
    [setBackdropUrl],
  );

  // Called when focus returns to the hero area — clears shelf focus and restores carousel backdrop
  const handleHeroFocus = useCallback(() => {
    if (shelfFocusTimerRef.current) {
      clearTimeout(shelfFocusTimerRef.current);
      shelfFocusTimerRef.current = null;
    }
    shelfFocusedRef.current = false;
    if (heroBackdropUrlRef.current !== undefined) {
      setBackdropUrl(heroBackdropUrlRef.current);
    }
    Animated.timing(heroAnim, { toValue: 1, duration: 300, useNativeDriver: false }).start();
  }, [setBackdropUrl, heroAnim]);

  const handleShelfItemFocus = useCallback(
    (item: JellyfinItem) => {
      shelfFocusedRef.current = true;
      Animated.timing(heroAnim, { toValue: 0, duration: 300, useNativeDriver: false }).start();
      if (shelfFocusTimerRef.current) clearTimeout(shelfFocusTimerRef.current);
      shelfFocusTimerRef.current = setTimeout(() => {
        const url = item.BackdropImageTags && item.BackdropImageTags.length > 0 ? getBackdropUrl(item.Id) : getPosterUrl(item.Id, 1920);
        setBackdropUrl(url);
      }, 150);
    },
    [setBackdropUrl, heroAnim],
  );

  const handleItemPress = useCallback(
    (item: JellyfinItem) => {
      logger.debug("Item pressed", {
        service: "LibraryScreen",
        itemId: item.Id,
        itemName: item.Name,
        itemType: item.Type,
        isFolder: isFolder(item),
        currentFolder: currentFolder?.name,
        currentFolderType: currentFolder?.type,
      });

      if (isFolder(item)) {
        navigateToFolder({
          id: item.Id,
          name: item.Name,
          parentId: item.ParentId,
          type: item.Type === "Playlist" ? "playlist" : "folder",
        });
      } else if (currentFolder) {
        const folderType = currentFolder.type === "playlist" ? "playlist" : "folder";
        buildQueue(currentFolder.id, currentFolder.name, item.Id, folderType);
        showGlobalLoader();
        router.push({
          pathname: "/player" as const,
          params: { videoId: item.Id, videoName: item.Name, queueMode: "true" },
        });
      } else {
        showGlobalLoader();
        router.push({
          pathname: "/player" as const,
          params: { videoId: item.Id, videoName: item.Name },
        });
      }
    },
    [navigateToFolder, showGlobalLoader, router, currentFolder, buildQueue],
  );

  const numColumns = useMemo(() => (Platform.isTV ? 5 : 3), []);

  // Dynamic content padding that accounts for tab bar safe area
  const gridContentStyle = useMemo(
    () => ({
      ...styles.gridContent,
      paddingTop: (Platform.isTV ? 20 : 10) + insets.top + 80,
      paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 20,
    }),
    [insets.top, insets.bottom],
  );

  const getItemLayout = useCallback(
    (_data: ArrayLike<GridItem> | null | undefined, index: number) => ({
      length: itemDimensions.rowHeight,
      offset: itemDimensions.rowHeight * Math.floor(index / numColumns),
      index,
    }),
    [numColumns],
  );

  // Show back item when inside a library (can go back to library selection)
  const showBackItem = folderStack.length > 0;

  // Create grid data with optional back item prepended
  const gridData: GridItem[] = useMemo(() => {
    if (showBackItem) {
      return [{ Id: BACK_ITEM_ID, _isBackItem: true as const }, ...items];
    }
    return items;
  }, [items, showBackItem]);

  const renderItem = useCallback(
    ({ item, index }: { item: GridItem; index: number }) => {
      if ("_isBackItem" in item && item._isBackItem) {
        return <BackGridItem onPress={navigateBack} hasTVPreferredFocus={index === 0} isLoading={isLoading} />;
      }

      const jellyfinItem = item as JellyfinItem;
      if (isFolder(jellyfinItem)) {
        return <FolderGridItem folder={jellyfinItem} onPress={handleItemPress} index={index} hasTVPreferredFocus={index === 0} />;
      }
      return <VideoGridItem video={jellyfinItem} onPress={handleItemPress} index={index} hasTVPreferredFocus={index === 0} />;
    },
    [handleItemPress, navigateBack, isLoading],
  );

  const renderFooter = useCallback(() => {
    if (!isLoadingMore) {
      return null;
    }

    return (
      <View style={styles.footerLoading}>
        <ActivityIndicator size="small" color="#FFC312" />
        <Text style={styles.footerLoadingText}>Loading more...</Text>
      </View>
    );
  }, [isLoadingMore]);

  const handleLoadMore = useCallback(() => {
    if (hasMoreResults && !isLoadingMore && !isLoading) {
      loadMore();
    }
  }, [hasMoreResults, isLoadingMore, isLoading, loadMore]);

  const handleTryDemo = useCallback(async () => {
    if (isConnectingToDemo) return;

    setIsConnectingToDemo(true);
    let connected = false;

    try {
      showGlobalLoader();
      await connectToDemoServer();
      connected = true;

      await refresh();

      hideGlobalLoader();

      Alert.alert("Demo Server Connected", "You're now browsing Jellyfin's demo library. You can switch to your own server in Settings.", [{ text: "OK" }]);
    } catch (error) {
      hideGlobalLoader();

      if (connected) {
        Alert.alert("Connected to Demo", "Connected to demo server, but couldn't load the library. Please check your internet connection and try navigating again.", [{ text: "OK" }]);
      } else {
        Alert.alert("Connection Failed", error instanceof Error ? error.message : "Unable to connect to demo server", [{ text: "OK" }]);
      }
    } finally {
      setIsConnectingToDemo(false);
    }
  }, [isConnectingToDemo, showGlobalLoader, hideGlobalLoader, refresh]);

  const renderEmpty = useCallback(() => {
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
          <Text style={styles.errorTitle}>Error</Text>
          <Text style={styles.errorText}>{error}</Text>

          <View style={styles.buttonGroup}>
            <FocusableButton
              title="Try Demo Server"
              variant="secondary"
              onPress={handleTryDemo}
              disabled={isConnectingToDemo}
              icon={<Ionicons name="play-circle-outline" size={Platform.isTV ? 24 : 20} color="#FFC312" />}
              hasTVPreferredFocus={true}
            />
            <FocusableButton
              title="Go to Settings"
              variant="primary"
              onPress={() => router.push("/(tabs)/settings")}
              icon={<Ionicons name="settings-outline" size={Platform.isTV ? 24 : 20} color="#000000" />}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="folder-open-outline" size={64} color="#98989D" />
        <Text style={styles.emptyText}>This folder is empty</Text>
      </View>
    );
  }, [isLoading, error, isConnectingToDemo, router, handleTryDemo]);

  return (
    <View style={styles.container}>
      <SkiaLibraryBackground imageUrl={backdropImageUrl} />
      {folderStack.length === 0 ? (
        <>
          {isLoadingHomeData || !homeData ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="small" color="#FFC312" />
              <Text style={styles.loadingText}>Loading...</Text>
            </View>
          ) : error ? (
            renderEmpty()
          ) : homeData.recentlyAdded.length === 0 && homeData.continueWatching.length === 0 ? (
            renderEmpty()
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.homeScrollContent}>
              {homeData.recentlyAdded.length > 0 && (
                <HeroBillboard items={homeData.recentlyAdded.slice(0, 5)} onPlay={handleItemPress} onInfo={handleMoreInfo} onItemChange={handleHeroItemChange} onHeroFocus={handleHeroFocus} heroAnim={heroAnim} />
              )}
              {homeData.continueWatching.length > 0 && (
                <VideoShelf title="Continue Watching" items={homeData.continueWatching} onItemPress={handleItemPress} onItemFocus={handleShelfItemFocus} cardStyle="landscape" />
              )}
              {homeData.nextUp.length > 0 && <VideoShelf title="Next Up" items={homeData.nextUp} onItemPress={handleItemPress} onItemFocus={handleShelfItemFocus} cardStyle="landscape" />}
              {homeData.recentlyAdded.length > 0 && (
                <VideoShelf title="Recently Added" items={homeData.recentlyAdded} onItemPress={handleItemPress} onItemFocus={handleShelfItemFocus} cardStyle="poster" />
              )}
            </ScrollView>
          )}
        </>
      ) : (
        <>
          {items.length === 0 && !showBackItem ? (
            renderEmpty()
          ) : (
            <FlatList
              testID="library-list"
              data={gridData}
              renderItem={renderItem}
              keyExtractor={(item) => item.Id}
              numColumns={numColumns}
              key={numColumns}
              extraData={currentFolder?.id}
              contentContainerStyle={gridContentStyle}
              columnWrapperStyle={styles.columnWrapper}
              getItemLayout={getItemLayout}
              showsVerticalScrollIndicator={true}
              updateCellsBatchingPeriod={50}
              initialNumToRender={Platform.isTV ? 15 : 12}
              maxToRenderPerBatch={Platform.isTV ? 15 : 12}
              windowSize={5}
              contentInsetAdjustmentBehavior="never"
              removeClippedSubviews={false}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              ListFooterComponent={renderFooter}
            />
          )}
          <Breadcrumb stack={folderStack} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  gridContent: {
    paddingLeft: Platform.isTV ? 80 : 60,
    paddingRight: Platform.isTV ? 40 : 20,
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
    paddingLeft: Platform.isTV ? 80 : 60,
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
    marginTop: 18,
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
  footerLoading: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 30,
    gap: 12,
  },
  footerLoadingText: {
    fontSize: Platform.isTV ? 20 : 16,
    color: "#98989D",
    fontWeight: "500",
  },
  buttonGroup: {
    gap: Platform.isTV ? 16 : 12,
    marginTop: Platform.isTV ? 32 : 24,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  homeScrollContent: {
    paddingBottom: TAB_BAR_HEIGHT + 40,
  },
});
