import {VideoGridItem} from "@/components/video-grid-item"
import {fetchVideos} from "@/services/jellyfinApi"
import {JellyfinVideoItem} from "@/types/jellyfin"
import {Ionicons} from "@expo/vector-icons"
import {useRouter} from "expo-router"
import React, {useEffect, useState} from "react"
import {ActivityIndicator, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View} from "react-native"
import {SafeAreaView} from "react-native-safe-area-context"

export default function VideoLibraryScreen() {
  const [videos, setVideos] = useState<JellyfinVideoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    loadVideos()
  }, [])

  const loadVideos = async () => {
    try {
      setIsLoading(true)
      setError(null)
      const fetchedVideos = await fetchVideos()
      setVideos(fetchedVideos)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load videos"
      setError(errorMessage)
      console.error("Error loading videos:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleVideoPress = (video: JellyfinVideoItem) => {
    router.push({
      pathname: "/player" as any,
      params: {
        videoId: video.Id,
        videoName: video.Name
      }
    })
  }

  const handleRefresh = () => {
    loadVideos()
  }

  const renderEmpty = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading videos...</Text>
        </View>
      )
    }

    if (error) {
      const isConfigError = error.includes("not configured")
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Unable to Load Videos</Text>
          <Text style={styles.errorText}>{error}</Text>
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
            <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} isTVSelectable={true}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )
    }

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="film-outline" size={64} color="#98989D" />
        <Text style={styles.emptyText}>No videos found</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh} isTVSelectable={true}>
          <Text style={styles.retryButtonText}>Refresh</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // Calculate number of columns based on platform
  // TV: 4-5 columns for posters look better
  // Mobile: 3 columns for portrait orientation
  const numColumns = Platform.isTV ? 5 : 3

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {videos.length === 0 ? (
        renderEmpty()
      ) : (
        <>
          <FlatList
            data={videos}
            renderItem={({item, index}) => <VideoGridItem video={item} onPress={handleVideoPress} index={index} />}
            keyExtractor={item => item.Id}
            numColumns={numColumns}
            // key={numColumns} // Force re-render when columns change
            contentContainerStyle={styles.gridContent}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={true}
            initialNumToRender={Platform.isTV ? 15 : 12}
            maxToRenderPerBatch={Platform.isTV ? 15 : 12}
            windowSize={5}
            // removeClippedSubviews={false}
          />
        </>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3d3d3d"
  },
  gridContent: {
    paddingTop: 60,
    paddingBottom: 60
  },
  columnWrapper: {
    justifyContent: "flex-start",
    paddingVertical: 24
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40
  },
  loadingText: {
    marginTop: 36,
    fontSize: 20,
    color: "#98989D",
    fontWeight: "500"
  },
  errorTitle: {
    marginTop: 16,
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center"
  },
  errorText: {
    marginTop: 8,
    fontSize: 17,
    color: "#98989D",
    textAlign: "center",
    lineHeight: 24
  },
  emptyText: {
    marginTop: 16,
    fontSize: 20,
    color: "#98989D",
    textAlign: "center"
  },
  retryButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: "#007AFF",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  retryButtonText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF"
  },
  settingsButton: {
    backgroundColor: "#FFC312"
  }
})
