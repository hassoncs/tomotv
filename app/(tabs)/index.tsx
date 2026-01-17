import { BackGridItem } from "@/components/back-grid-item";
import { Breadcrumb } from "@/components/breadcrumb";
import { FocusableButton } from "@/components/FocusableButton";
import { FolderGridItem } from "@/components/folder-grid-item";
import { VideoGridItem } from "@/components/video-grid-item";
import { useFolderNavigation } from "@/contexts/FolderNavigationContext";
import { useLoading } from "@/contexts/LoadingContext";
import { isFolder, syncDevCredentials } from "@/services/jellyfinApi";
import { JellyfinItem } from "@/types/jellyfin";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo } from "react";
import { ActivityIndicator, BackHandler, FlatList, Platform, StyleSheet, Text, View, useTVEventHandler } from "react-native";

// Special marker for the ".." back navigation item
const BACK_ITEM_ID = "__BACK__";
type GridItem = JellyfinItem | { Id: typeof BACK_ITEM_ID; _isBackItem: true };

export default function VideoLibraryScreen() {
  const router = useRouter();
  const { showGlobalLoader } = useLoading();
  const { items, isLoading, isLoadingMore, hasMoreResults, error, folderStack, currentFolder, navigateToFolder, navigateBack, loadMore } = useFolderNavigation();

  // Handle TV menu button for back navigation
  useTVEventHandler((event) => {
    if (event.eventType === "menu" && folderStack.length > 1) {
      navigateBack();
    }
  });

  // Handle Android back button
  useEffect(() => {
    const handleBackPress = () => {
      if (folderStack.length > 1) {
        navigateBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
    return () => subscription.remove();
  }, [folderStack, navigateBack]);

  // Sync dev credentials on mount
  useEffect(() => {
    syncDevCredentials();
  }, []);

  const handleItemPress = useCallback(
    (item: JellyfinItem) => {
      if (isFolder(item)) {
        navigateToFolder({
          id: item.Id,
          name: item.Name,
          parentId: item.ParentId,
        });
      } else {
        showGlobalLoader();
        router.push({
          pathname: "/player" as const,
          params: {
            videoId: item.Id,
            videoName: item.Name,
          },
        });
      }
    },
    [navigateToFolder, router, showGlobalLoader],
  );


  const numColumns = useMemo(() => (Platform.isTV ? 5 : 3), []);

  // Show back item when inside a folder (not at root)
  const showBackItem = folderStack.length > 1;

  // Create grid data with optional back item prepended
  const gridData: GridItem[] = useMemo(() => {
    if (showBackItem) {
      return [{ Id: BACK_ITEM_ID, _isBackItem: true as const }, ...items];
    }
    return items;
  }, [items, showBackItem]);

  const itemDimensions = useMemo(() => {
    const screenWidth = Math.min(Platform.isTV ? 1920 : 1080, Platform.isTV ? 1080 : 1920);
    const itemWidth = screenWidth / numColumns;
    const itemHeight = itemWidth * (3 / 2) + 40;
    return { itemHeight };
  }, [numColumns]);

  const getItemLayout = useCallback(
    (_: ArrayLike<GridItem> | null | undefined, index: number) => ({
      length: itemDimensions.itemHeight,
      offset: itemDimensions.itemHeight * Math.floor(index / numColumns),
      index,
    }),
    [itemDimensions, numColumns],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: GridItem; index: number }) => {
      // Handle back navigation item
      if ("_isBackItem" in item && item._isBackItem) {
        return <BackGridItem onPress={navigateBack} hasTVPreferredFocus={index === 0} />;
      }

      // Handle regular items
      const jellyfinItem = item as JellyfinItem;
      if (isFolder(jellyfinItem)) {
        return <FolderGridItem folder={jellyfinItem} onPress={handleItemPress} index={index} />;
      }
      return <VideoGridItem video={jellyfinItem} onPress={handleItemPress} index={index} />;
    },
    [handleItemPress, navigateBack],
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
          <Text style={styles.errorTitle}>Unable to Load</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorText}></Text>
          <FocusableButton
            title="Go to Settings"
            variant="primary"
            onPress={() => router.push("/(tabs)/settings")}
            icon={<Ionicons name="settings-outline" size={Platform.isTV ? 24 : 20} color="#000000" />}
            hasTVPreferredFocus={true}
          />
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="folder-open-outline" size={64} color="#98989D" />
        <Text style={styles.emptyText}>This folder is empty</Text>
      </View>
    );
  }, [isLoading, error, router]);

  return (
    <View style={styles.container}>
      {items.length === 0 && !showBackItem ? (
        renderEmpty()
      ) : (
        <FlatList
          testID="library-list"
          data={gridData}
          renderItem={renderItem}
          keyExtractor={(item) => item.Id}
          getItemLayout={getItemLayout}
          numColumns={numColumns}
          key={numColumns}
          extraData={currentFolder?.id}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={true}
          updateCellsBatchingPeriod={50}
          initialNumToRender={Platform.isTV ? 15 : 12}
          maxToRenderPerBatch={Platform.isTV ? 15 : 12}
          windowSize={5}
          contentInsetAdjustmentBehavior="automatic"
          removeClippedSubviews={false}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={renderFooter}
        />
      )}
      <Breadcrumb stack={folderStack} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3d3d3d",
  },
  gridContent: {
    paddingTop: Platform.isTV ? 20 : 10,
    paddingBottom: 20,
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
});
