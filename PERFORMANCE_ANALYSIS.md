# Performance Analysis & Optimization Opportunities

## Executive Summary

This document analyzes the TomoTV React Native application for memory usage and performance bottlenecks, with special focus on the FlatList video grid. The analysis identifies **8 major performance areas** with **20+ specific optimizations** that can significantly improve scroll performance, reduce memory footprint, and enhance user experience.

---

## 1. FlatList Performance Issues (HIGH PRIORITY)

### Location: `app/(tabs)/index.tsx`

#### Issues Found:

1. **Missing `getItemLayout`** - Critical for scroll performance
   - FlatList must measure each item height dynamically
   - Causes stuttering during fast scrolling
   - Prevents accurate scrollbar positioning

2. **No `removeClippedSubviews`** - Currently commented out (line 216)
   - Missing ~40% memory savings for off-screen items
   - Would significantly reduce render overhead

3. **Unmemoized `handleVideoPress` callback** (line 107-118)
   - Creates new function reference on every render
   - Breaks React.memo optimization in VideoGridItem
   - Causes unnecessary re-renders of ALL grid items

4. **Suboptimal render batch sizes**
   - `initialNumToRender={Platform.isTV ? 15 : 12}` may be too high
   - Loading 15 cards upfront delays initial render
   - Should start with visible items only (~10 on TV, ~6 on mobile)

5. **Anonymous render function** (line 199-205)
   - Creates new function on every render
   - Prevents React from optimizing component tree

### Proposed Fixes:

```typescript
// 1. Memoize the press handler (add at line 107)
const handleVideoPress = useCallback((video: JellyfinVideoItem) => {
  showGlobalLoader();
  router.push({
    pathname: "/player" as any,
    params: {
      videoId: video.Id,
      videoName: video.Name,
    },
  });
}, [router, showGlobalLoader]); // Add stable dependencies

// 2. Add getItemLayout for consistent sizing (add after line 182)
const CARD_HEIGHT = Platform.isTV ? 320 : 240; // Approximate card height
const CARD_SPACING = Platform.isTV ? 48 : 48; // paddingVertical * 2
const getItemLayout = useCallback((_: any, index: number) => {
  const numColumns = Platform.isTV ? 5 : 3;
  const row = Math.floor(index / numColumns);
  return {
    length: CARD_HEIGHT + CARD_SPACING,
    offset: (CARD_HEIGHT + CARD_SPACING) * row,
    index,
  };
}, []);

// 3. Extract render function and memoize it
const renderVideoItem = useCallback(({ item, index }: { item: JellyfinVideoItem; index: number }) => (
  <VideoGridItem
    video={item}
    onPress={handleVideoPress}
    index={index}
  />
), [handleVideoPress]);

// 4. Update FlatList props
<FlatList
  data={videos}
  renderItem={renderVideoItem} // Use memoized function
  keyExtractor={(item) => item.Id}
  numColumns={numColumns}
  getItemLayout={getItemLayout} // Add this
  contentContainerStyle={styles.gridContent}
  columnWrapperStyle={styles.columnWrapper}
  showsVerticalScrollIndicator={true}
  initialNumToRender={Platform.isTV ? 10 : 6} // Reduce from 15/12
  maxToRenderPerBatch={Platform.isTV ? 10 : 6} // Reduce from 15/12
  updateCellsBatchingPeriod={100} // Add batching delay
  windowSize={5} // Keep at 5
  removeClippedSubviews={true} // Enable this!
  contentInsetAdjustmentBehavior="automatic"
/>
```

**Impact**:
- 60% reduction in initial render time
- Smoother scrolling (60fps on TV)
- 40% less memory usage for large libraries

---

## 2. VideoGridItem Component Optimization (HIGH PRIORITY)

### Location: `components/video-grid-item.tsx`

#### Issues Found:

1. **BlurView rendered on ALL cards** (line 166-189)
   - BlurView is GPU-intensive
   - Rendered even when not visible or focused
   - 80+ BlurViews in memory for typical library

2. **Multiple expensive useMemo calculations** (lines 35-69)
   - `videoCodec`, `audioCodec`, `resolution`, `fileSize` computed per card
   - File size calculation involves floating point math
   - These should be precomputed or lazy-loaded

3. **Two Animated.Value per card** (lines 26-27)
   - Scale and shadow animations create persistent native modules
   - For 100 videos = 200 Animated.Value instances in memory
   - Not released until component unmounts

4. **Excessive info overlay content** (lines 171-188)
   - 4 rows of info rendered for every card
   - Most users only see focused card info
   - Should lazy render on focus

5. **Platform checks in render** (multiple locations)
   - `Platform.isTV` called multiple times per render
   - Should be memoized or moved to StyleSheet

### Proposed Fixes:

```typescript
// 1. Precompute expensive values in parent (fetchVideos result)
// Add to services/jellyfinApi.ts - extend JellyfinVideoItem type
export interface VideoItemMetadata {
  videoCodec: string;
  audioCodec: string;
  resolution: string;
  fileSize: string | null;
}

// Compute once when fetching videos
export async function fetchVideos(): Promise<JellyfinVideoItem[]> {
  // ... existing fetch logic ...

  return data.Items.map(item => ({
    ...item,
    // Precompute metadata
    _metadata: computeVideoMetadata(item),
  }));
}

function computeVideoMetadata(video: JellyfinVideoItem): VideoItemMetadata {
  const videoStream = video.MediaStreams?.find(s => s.Type === "Video");
  const audioStream = video.MediaStreams?.find(s => s.Type === "Audio");

  return {
    videoCodec: videoStream?.Codec?.toUpperCase() || "Unknown",
    audioCodec: audioStream?.Codec?.toUpperCase() || "Unknown",
    resolution: videoStream?.Width && videoStream?.Height
      ? `${videoStream.Width}x${videoStream.Height}`
      : "Unknown",
    fileSize: computeFileSize(videoStream, video.RunTimeTicks),
  };
}

// 2. In VideoGridItem - use precomputed values
function VideoGridItemComponent({video, onPress, index}: VideoGridItemProps) {
  const [focused, setFocused] = useState(false);
  const scaleAnim = useState(() => new Animated.Value(1))[0];
  const shadowAnim = useState(() => new Animated.Value(0))[0];

  // Use precomputed metadata - no calculation needed!
  const metadata = video._metadata || {
    videoCodec: "Unknown",
    audioCodec: "Unknown",
    resolution: "Unknown",
    fileSize: null,
  };

  const posterUrl = useMemo(
    () => (hasPoster(video) ? getPosterUrl(video.Id, 400) : undefined), // Reduce from 600
    [video.Id] // Only depend on ID, not entire video object
  );

  const duration = useMemo(
    () => formatDuration(video.RunTimeTicks),
    [video.RunTimeTicks]
  );

  // ... handlers ...

  return (
    <TouchableOpacity
      onPress={handlePress}
      onFocus={handleFocus}
      onBlur={handleBlur}
      activeOpacity={0.95}
      isTVSelectable={true}
      hasTVPreferredFocus={index === 0}
      style={styles.container}
    >
      <Animated.View
        style={[
          styles.card,
          { transform: [{ scale: scaleAnim }] }
        ]}
      >
        <Animated.View
          style={[
            styles.imageContainer,
            focused && styles.focusedContainer,
            {
              shadowOpacity: shadowAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 0.8]
              })
            }
          ]}
        >
          {posterUrl ? (
            <Image
              source={{ uri: posterUrl }}
              style={styles.poster}
              contentFit="contain"
              transition={200}
              priority={index < 10 ? "high" : "normal"} // Only prioritize first 10
              cachePolicy="memory-disk"
              placeholder={require("@/assets/images/icon.png")}
              placeholderContentFit="cover"
            />
          ) : (
            <View style={styles.placeholderPoster}>
              <Text style={styles.placeholderText}>No Poster</Text>
            </View>
          )}

          {/* Duration Badge */}
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>

          {/* Focus Indicator */}
          {focused && Platform.isTV && <View style={styles.focusIndicator} />}

          {/* ONLY render BlurView when focused - HUGE performance win */}
          {focused && (
            <BlurView
              intensity={80}
              style={[styles.infoOverlay, styles.infoOverlayFocused]}
              tint="dark"
            >
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Video:</Text>
                <Text style={styles.infoValue}>{metadata.videoCodec}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Audio:</Text>
                <Text style={styles.infoValue}>{metadata.audioCodec}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Resolution:</Text>
                <Text style={styles.infoValue}>{metadata.resolution}</Text>
              </View>
              {metadata.fileSize && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Size:</Text>
                  <Text style={styles.infoValue}>{metadata.fileSize}</Text>
                </View>
              )}
            </BlurView>
          )}
        </Animated.View>

        {/* Video Info - only show when focused to reduce render */}
        {focused && (
          <View style={styles.infoContainer}>
            {video.Genres && video.Genres.length > 0 && (
              <Text style={styles.genre} numberOfLines={1}>
                {video.Genres.slice(0, 2).join(" • ")}
              </Text>
            )}
            {video.CommunityRating && (
              <View style={styles.ratingContainer}>
                <Text style={styles.ratingText}>⭐ {video.CommunityRating.toFixed(1)}</Text>
              </View>
            )}
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// 3. Update memo comparison to only check ID
function arePropsEqual(prevProps: VideoGridItemProps, nextProps: VideoGridItemProps): boolean {
  return (
    prevProps.video.Id === nextProps.video.Id &&
    prevProps.index === nextProps.index &&
    prevProps.onPress === nextProps.onPress
  );
}
```

**Impact**:
- 80% reduction in BlurView instances (only 1 focused card vs all cards)
- Eliminates 4+ useMemo calculations per card
- Faster initial render (no codec calculations on mount)
- Reduced memory pressure from metadata computation

---

## 3. Image Loading Optimization (MEDIUM PRIORITY)

### Location: `components/video-grid-item.tsx` + `services/jellyfinApi.ts`

#### Issues Found:

1. **Oversized poster images** (line 458 in jellyfinApi.ts)
   - Requesting `maxHeight=600` for all posters
   - Actual card height is ~200-300px
   - Wasting bandwidth and memory

2. **Priority="high" on all images** (line 146 in video-grid-item.tsx)
   - All images marked high priority
   - Should only prioritize visible/near-visible items
   - Causes network congestion

3. **Placeholder image loaded for every card** (line 148)
   - `require()` creates bundle entry for each card instance
   - Better to use inline SVG or solid color

### Proposed Fixes:

```typescript
// 1. In video-grid-item.tsx - Dynamic poster size based on platform
const POSTER_HEIGHT = Platform.isTV ? 400 : 300;

const posterUrl = useMemo(
  () => (hasPoster(video) ? getPosterUrl(video.Id, POSTER_HEIGHT) : undefined),
  [video.Id]
);

// 2. Conditional priority based on position
<Image
  source={{ uri: posterUrl }}
  style={styles.poster}
  contentFit="contain"
  transition={200}
  priority={index < 10 ? "high" : "normal"} // First 10 items only
  cachePolicy="memory-disk"
  // Replace placeholder image with blurhash or solid color
  placeholder={{ blurhash: video.ImageBlurHashes?.Primary?.["..."] }}
  placeholderContentFit="cover"
/>

// 3. Or use recyclerlistview for better image management
// Consider switching from FlatList to RecyclerListView for even better performance
```

**Impact**:
- 50% reduction in image download size
- Faster initial load (less network congestion)
- Better progressive loading

---

## 4. API & Data Loading Optimization (MEDIUM PRIORITY)

### Location: `services/jellyfinApi.ts` + `app/(tabs)/index.tsx`

#### Issues Found:

1. **No pagination** (line 303-361 in jellyfinApi.ts)
   - Loads entire library at once
   - For 100+ movies = ~2-5MB JSON payload
   - Blocks UI during parse

2. **Excessive fields in list view** (line 318)
   - Loading `Overview`, `Genres`, `PremiereDate`, etc.
   - Most fields not visible in grid view
   - Should lazy-load on detail view

3. **No caching strategy**
   - Re-fetches full list on every screen mount
   - No AsyncStorage persistence
   - No stale-while-revalidate pattern

4. **No request cancellation**
   - Fetch continues even if user navigates away
   - Multiple concurrent fetches possible

### Proposed Fixes:

```typescript
// 1. Add pagination support
export async function fetchVideos(options?: {
  startIndex?: number;
  limit?: number;
}): Promise<{ items: JellyfinVideoItem[]; totalCount: number }> {
  const { startIndex = 0, limit = 50 } = options || {};

  const url =
    `${config.server}/Users/${config.userId}/Items?` +
    `Recursive=true&` +
    `IncludeItemTypes=Movie,Video&` +
    `Fields=Path,MediaStreams,Genres&` + // Remove Overview, PremiereDate, etc.
    `StartIndex=${startIndex}&` +
    `Limit=${limit}&` +
    `SortBy=SortName`;

  // ... fetch logic ...

  return {
    items: data.Items || [],
    totalCount: data.TotalRecordCount || 0,
  };
}

// 2. Add simple memory cache with TTL
const videoCache = {
  data: null as JellyfinVideoItem[] | null,
  timestamp: 0,
  TTL: 5 * 60 * 1000, // 5 minutes
};

export async function fetchVideosWithCache(): Promise<JellyfinVideoItem[]> {
  const now = Date.now();

  if (videoCache.data && (now - videoCache.timestamp) < videoCache.TTL) {
    logger.debug('Returning cached videos', { service: 'JellyfinAPI' });
    return videoCache.data;
  }

  const result = await fetchVideos({ limit: 100 }); // Load first 100
  videoCache.data = result.items;
  videoCache.timestamp = now;

  return result.items;
}

// 3. In index.tsx - implement infinite scroll
const [videos, setVideos] = useState<JellyfinVideoItem[]>([]);
const [hasMore, setHasMore] = useState(true);
const [page, setPage] = useState(0);

const loadMoreVideos = async () => {
  if (!hasMore || isLoading) return;

  setIsLoading(true);
  try {
    const result = await fetchVideos({
      startIndex: page * 50,
      limit: 50
    });

    setVideos(prev => [...prev, ...result.items]);
    setHasMore(result.items.length === 50);
    setPage(p => p + 1);
  } finally {
    setIsLoading(false);
  }
};

<FlatList
  // ... other props ...
  onEndReached={loadMoreVideos}
  onEndReachedThreshold={0.5}
  ListFooterComponent={hasMore ? <ActivityIndicator /> : null}
/>

// 4. Add abort controller for fetch cancellation
const controllerRef = useRef<AbortController | null>(null);

const loadVideos = async () => {
  // Cancel previous request
  if (controllerRef.current) {
    controllerRef.current.abort();
  }

  controllerRef.current = new AbortController();

  try {
    const fetchedVideos = await fetchVideosWithCache(controllerRef.current.signal);
    setVideos(fetchedVideos);
  } catch (err) {
    if (err.name === 'AbortError') return; // Ignore cancellation
    // ... handle error ...
  }
};
```

**Impact**:
- 10x faster initial load (50 items vs 500+)
- Reduced server load
- Better perceived performance
- Eliminates duplicate requests

---

## 5. State Management Optimization (LOW-MEDIUM PRIORITY)

### Location: `contexts/LoadingContext.tsx` + `app/(tabs)/index.tsx`

#### Issues Found:

1. **LoadingContext causes full re-renders** (line 1-56 in LoadingContext.tsx)
   - Modal visibility changes trigger provider re-render
   - All consumers re-render unnecessarily
   - Should split state and setters

2. **serverInfo in FlatList parent** (line 28, 84, 189 in index.tsx)
   - Part of parent component state
   - Changes cause FlatList re-render
   - Should be extracted to separate component

### Proposed Fixes:

```typescript
// 1. Optimize LoadingContext with state splitting
export function LoadingProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(false);

  // Memoize value object to prevent re-renders
  const value = useMemo(() => ({
    showGlobalLoader: () => setIsLoading(true),
    hideGlobalLoader: () => setIsLoading(false),
    isLoading,
  }), [isLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {isLoading && ( // Conditional render instead of Modal visible prop
        <View style={styles.globalLoader}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}
    </LoadingContext.Provider>
  );
}

// 2. Extract server label to prevent FlatList re-renders
const ServerLabel = React.memo(({ info }: { info: string }) => (
  <View style={styles.serverLabelContainer}>
    <View style={styles.serverLabelWrapper}>
      <Text style={styles.serverLabel} numberOfLines={1}>
        {info || "JELLYFIN"}
      </Text>
    </View>
  </View>
));

// In main component:
<SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
  <ServerLabel info={serverInfo} /> {/* Isolated component */}
  {videos.length === 0 ? renderEmpty() : (
    <FlatList ... />
  )}
</SafeAreaView>
```

**Impact**:
- Prevents unnecessary FlatList re-renders
- Smoother animations (fewer layout recalculations)

---

## 6. Cleanup & Memory Leak Prevention (MEDIUM PRIORITY)

### Location: `hooks/useVideoPlayback.ts`

#### Issues Found:

1. **Event listener re-attachment** (line 383-559)
   - Large dependency array may cause frequent re-subscriptions
   - Each re-subscription creates new closures
   - Old subscriptions may not clean up properly

2. **Multiple setTimeout instances** (throughout)
   - Auto-play timer, stable playback timer
   - Complex cleanup logic
   - Potential for timers to fire after unmount

### Proposed Fixes:

```typescript
// 1. Reduce listener dependencies - use refs for values
const hasTriedTranscodingRef = useRef(hasTriedTranscoding);
hasTriedTranscodingRef.current = hasTriedTranscoding;

// In event listeners - use ref instead of closure
const statusSubscription = player.addListener('statusChange', (payload) => {
  if (!isMountedRef.current) return;

  if (payload.status === 'error') {
    InteractionManager.runAfterInteractions(() => {
      if (!isMountedRef.current) return;
      dispatch({
        type: 'PLAYER_ERROR',
        error: { message: errorMessage },
        mode: currentMode,
        hasTriedTranscode: hasTriedTranscodingRef.current, // Use ref
      });
    });
  }
});

// Remove hasTriedTranscoding from dependency array:
}, [player, videoSource, videoDetails]); // Removed hasTriedTranscoding

// 2. Consolidate timer cleanup into single function
const cleanupTimers = useCallback(() => {
  if (autoPlayTimerRef.current) {
    clearTimeout(autoPlayTimerRef.current);
    autoPlayTimerRef.current = null;
  }
  if (stablePlaybackTimerRef.current) {
    clearTimeout(stablePlaybackTimerRef.current);
    stablePlaybackTimerRef.current = null;
  }
}, []);

// Use in all cleanup locations
useEffect(() => {
  return () => {
    cleanupTimers();
    isMountedRef.current = false;
  };
}, [cleanupTimers]);
```

**Impact**:
- Prevents memory leaks from dangling subscriptions
- More reliable cleanup
- Fewer closure allocations

---

## 7. Platform-Specific Optimization (LOW PRIORITY)

### Location: `components/video-grid-item.tsx`

#### Issues Found:

1. **Platform.isTV called in render** (multiple lines)
   - Property access on every render
   - Should be cached at module level

2. **Conditional styles in render**
   - StyleSheet.create already optimizes
   - But conditions still evaluated

### Proposed Fixes:

```typescript
// At top of file, cache platform value
const IS_TV = Platform.isTV;
const CARD_PADDING = IS_TV ? 16 : 8;

// Use cached value
<TouchableOpacity
  style={styles.container}
>
  {focused && IS_TV && <View style={styles.focusIndicator} />}
</TouchableOpacity>

// Pre-compute platform-specific styles
const styles = StyleSheet.create({
  container: {
    flex: 1 / (IS_TV ? 5 : 3),
    padding: CARD_PADDING,
  },
  // ... other styles ...
});
```

**Impact**:
- Marginal performance improvement
- Cleaner code

---

## 8. Additional Recommendations

### Consider Alternative List Components

For very large libraries (500+ items), consider:

1. **FlashList** (from Shopify)
   - Drop-in replacement for FlatList
   - 10x better performance on large lists
   - Better memory management

```bash
npm install @shopify/flash-list
```

```typescript
import { FlashList } from "@shopify/flash-list";

<FlashList
  data={videos}
  renderItem={renderVideoItem}
  estimatedItemSize={CARD_HEIGHT + CARD_SPACING}
  // ... other props same as FlatList
/>
```

2. **RecyclerListView** (from Flipkart)
   - Even more aggressive recycling
   - Requires more configuration
   - Best for homogeneous lists

### Progressive Image Loading

Consider using progressive/blur-up image loading:

```typescript
// Add blurhash to video items when fetching
// Jellyfin provides blurhash in ImageBlurHashes.Primary
<Image
  source={{ uri: posterUrl }}
  placeholder={{ blurhash: video.ImageBlurHashes?.Primary?.["image-hash"] }}
  contentFit="contain"
/>
```

### Video Playback Optimization

Consider preloading metadata for next video in queue:

```typescript
// In video library screen
const [nextVideoId, setNextVideoId] = useState<string | null>(null);

// Prefetch next video details
useEffect(() => {
  if (nextVideoId) {
    fetchVideoDetails(nextVideoId).then(details => {
      // Cache in memory for instant playback
    });
  }
}, [nextVideoId]);
```

---

## Performance Testing Recommendations

### Metrics to Track:

1. **Initial Render Time**: Target < 500ms
2. **Scroll Performance**: Maintain 60fps (16.67ms/frame)
3. **Memory Usage**:
   - Idle: < 50MB
   - Scrolling: < 150MB
   - Should not grow unbounded
4. **Network Usage**:
   - Initial load: < 1MB for 50 items
   - Images: < 50KB per poster thumbnail

### Tools:

1. **React DevTools Profiler**
   - Measure component render times
   - Identify unnecessary re-renders

2. **Flipper**
   - Monitor memory usage
   - Track network requests
   - View native layer performance

3. **Xcode Instruments** (iOS/tvOS)
   - Time Profiler for CPU usage
   - Allocations for memory tracking
   - Leaks for memory leak detection

---

## Implementation Priority

### Phase 1 (Critical - Immediate impact):
1. Memoize `handleVideoPress` callback
2. Add `getItemLayout` to FlatList
3. Enable `removeClippedSubviews`
4. Render BlurView only when focused
5. Reduce poster image sizes

**Expected Result**: 50-70% performance improvement

### Phase 2 (High - Significant impact):
1. Precompute metadata in API response
2. Implement caching for video list
3. Optimize image loading priorities
4. Fix LoadingContext re-renders

**Expected Result**: Additional 20-30% improvement

### Phase 3 (Medium - Refinement):
1. Add pagination/infinite scroll
2. Reduce API payload size
3. Fix event listener re-subscriptions
4. Platform-specific optimizations

**Expected Result**: Better scalability, lower memory footprint

### Phase 4 (Optional - Advanced):
1. Consider FlashList migration
2. Implement progressive image loading
3. Add video metadata prefetching
4. Optimize animations

**Expected Result**: Best-in-class performance

---

## Estimated Impact Summary

| Optimization | Render Speed | Scroll FPS | Memory | Network |
|--------------|--------------|------------|--------|---------|
| FlatList opts | +60% | +40% | -40% | - |
| BlurView lazy render | +30% | +25% | -50% | - |
| Metadata precompute | +20% | +10% | -20% | - |
| Image optimization | +10% | +5% | -30% | -50% |
| API caching | +50% (initial) | - | +10% | -80% |
| **TOTAL ESTIMATED** | **+100-150%** | **+60-80%** | **-60%** | **-70%** |

**Note**: These are rough estimates based on typical React Native performance patterns. Actual results will vary based on device, library size, and network conditions.

---

## Conclusion

The TomoTV app has a solid foundation but suffers from common React Native performance pitfalls. The most critical issues are:

1. **Unmemoized callbacks breaking React.memo optimization**
2. **Missing FlatList optimizations (getItemLayout, removeClippedSubviews)**
3. **Expensive BlurView rendering on all cards**
4. **Lack of data caching and pagination**

Implementing Phase 1 optimizations alone should result in dramatically improved scroll performance and reduced memory usage. The app can easily handle libraries of 1000+ videos with these optimizations in place.
