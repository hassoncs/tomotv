import {VideoGridItem} from "@/components/video-grid-item"
import {useLoading} from "@/contexts/LoadingContext"
import {fetchLibraryName, fetchVideos, syncDevCredentials} from "@/services/jellyfinApi"
import {JellyfinVideoItem} from "@/types/jellyfin"
import {Ionicons} from "@expo/vector-icons"
import {useRouter} from "expo-router"
import * as SecureStore from "expo-secure-store"
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react"
import {ActivityIndicator, FlatList, Platform, StyleSheet, Text, TouchableOpacity, View} from "react-native"
import {SafeAreaView} from "react-native-safe-area-context"

export default function VideoLibraryScreen() {
  const [videos, setVideos] = useState<JellyfinVideoItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [serverInfo, setServerInfo] = useState<string>("")
  const router = useRouter()
  const {showGlobalLoader} = useLoading()
  const loadingRef = useRef(false)

  const loadServerInfo = useCallback(async () => {
    try {
      const [serverIp, serverPort, serverProtocol, apiKey, userId] = await Promise.all([
        SecureStore.getItemAsync("jellyfin_server_ip"),
        SecureStore.getItemAsync("jellyfin_server_port"),
        SecureStore.getItemAsync("jellyfin_server_protocol"),
        SecureStore.getItemAsync("jellyfin_api_key"),
        SecureStore.getItemAsync("jellyfin_user_id")
      ])

      if (__DEV__) {
        console.log("=== SecureStore Debug ===")
        console.log("Server IP:", serverIp)
        console.log("Server Port:", serverPort)
        console.log("Server Protocol:", serverProtocol)
        console.log("API Key exists:", !!apiKey)
        console.log("User ID exists:", !!userId)
        console.log("========================")
      }

      let serverUrl = ""
      if (serverIp && serverIp.trim()) {
        const ip = serverIp.trim()
        const port = serverPort?.trim() || "8096"
        const protocol = serverProtocol?.trim() || "http"

        serverUrl = `${protocol}://${ip}:${port}`
      } else {
        const devServer = process.env.EXPO_PUBLIC_DEV_JELLYFIN_SERVER

        if (devServer) {
          serverUrl = devServer
        } else {
          serverUrl = "JELLYFIN"
        }
      }

      const libraryName = await fetchLibraryName()

      if (__DEV__) {
        console.log("Setting server info:", libraryName)
      }

      setServerInfo(libraryName)
    } catch (err) {
      if (__DEV__) {
        console.error("Error loading server info:", err)
      }
      setServerInfo("JELLYFIN")
    }
  }, [])

  const loadVideos = useCallback(async () => {
    if (loadingRef.current) {
      if (__DEV__) {
        console.log("Already loading, ignoring duplicate call")
      }
      return
    }

    try {
      loadingRef.current = true
      setIsLoading(true)
      setError(null)

      const fetchedVideos = await fetchVideos()
      setVideos(fetchedVideos)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to load videos"
      setError(errorMessage)

      if (__DEV__) {
        console.error("Error loading videos:", err)
      }
    } finally {
      setIsLoading(false)
      loadingRef.current = false
    }
  }, [])

  const handleVideoPress = useCallback(
    (video: JellyfinVideoItem) => {
      showGlobalLoader()

      router.push({
        pathname: "/player" as const,
        params: {
          videoId: video.Id,
          videoName: video.Name
        }
      })
    },
    [router, showGlobalLoader]
  )

  const handleRefresh = useCallback(() => {
    loadVideos()
  }, [loadVideos])

  useEffect(() => {
    let isMounted = true

    syncDevCredentials().then(() => {
      if (isMounted) {
        loadVideos()
        loadServerInfo()
      }
    })

    return () => {
      isMounted = false
    }
  }, [loadVideos, loadServerInfo])

  const renderEmpty = useCallback(() => {
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
  }, [isLoading, error, router, handleRefresh])

  const numColumns = useMemo(() => (Platform.isTV ? 5 : 3), [])

  const itemDimensions = useMemo(() => {
    const screenWidth = Math.min(Platform.isTV ? 1920 : 1080, Platform.isTV ? 1080 : 1920)
    const itemWidth = screenWidth / numColumns
    const itemHeight = itemWidth * (3 / 2) + 40

    return {itemHeight}
  }, [numColumns])

  const getItemLayout = useCallback(
    (_: ArrayLike<JellyfinVideoItem> | null | undefined, index: number) => ({
      length: itemDimensions.itemHeight,
      offset: itemDimensions.itemHeight * Math.floor(index / numColumns),
      index
    }),
    [itemDimensions, numColumns]
  )

  const renderItem = useCallback(
    ({item, index}: {item: JellyfinVideoItem; index: number}) => (
      <VideoGridItem video={item} onPress={handleVideoPress} index={index} />
    ),
    [handleVideoPress]
  )

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.serverLabelContainer}>
        <View style={styles.serverLabelWrapper}>
          <Text style={styles.serverLabel} numberOfLines={1}>
            {serverInfo || "JELLYFIN"}
          </Text>
        </View>
      </View>
      {videos.length === 0 ? (
        renderEmpty()
      ) : (
        <FlatList
          data={videos}
          renderItem={renderItem}
          keyExtractor={item => item.Id}
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
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000"
  },
  serverLabelContainer: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 10,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    zIndex: 999,
    pointerEvents: "none"
  },
  serverLabelWrapper: {
    justifyContent: "center",
    alignItems: "center"
  },
  serverLabel: {
    color: "#a3cb38",
    fontSize: Platform.isTV ? 14 : 12,
    fontFamily: "monospace",
    fontWeight: "300",
    letterSpacing: 1.5,
    textAlign: "center"
  },
  gridContent: {
    paddingTop: Platform.isTV ? 40 : 20,
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
    borderRadius: 32,
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
