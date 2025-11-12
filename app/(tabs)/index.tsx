import { FocusableButton } from "@/components/FocusableButton";
import { VideoGridItem } from "@/components/video-grid-item";
import { useLibrary } from "@/contexts/LibraryContext";
import { useLoading } from "@/contexts/LoadingContext";
import { syncDevCredentials } from "@/services/jellyfinApi";
import { JellyfinVideoItem } from "@/types/jellyfin";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function VideoLibraryScreen() {
  const router = useRouter();
  const { showGlobalLoader } = useLoading();
  const { videos, isLoading, error, libraryName, refreshLibrary } =
    useLibrary();

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
        <Ionicons name="film-outline" size={64} color="#98989D" />
        <Text style={styles.emptyText}>No videos found</Text>
        <FocusableButton
          title="Refresh"
          variant="retry"
          onPress={handleRefresh}
          hasTVPreferredFocus={true}
        />
      </View>
    );
  }, [isLoading, error, router, handleRefresh]);

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
      <VideoGridItem video={item} onPress={handleVideoPress} index={index} />
    ),
    [handleVideoPress],
  );

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.serverLabelContainer}>
        <View style={styles.serverLabelWrapper}>
          <Text style={styles.serverLabel} numberOfLines={1}>
            {libraryName || ""}
          </Text>
        </View>
      </View>
      {videos.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={videos}
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
  serverLabelContainer: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 10,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    zIndex: 999,
    pointerEvents: "none",
  },
  serverLabelWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  serverLabel: {
    color: "#a3cb38",
    fontSize: Platform.isTV ? 14 : 12,
    fontFamily: "monospace",
    fontWeight: "600",
    letterSpacing: 1.5,
    textAlign: "center",
    textTransform: "uppercase",
  },
  gridContent: {
    paddingTop: Platform.isTV ? 40 : 20,
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
});
