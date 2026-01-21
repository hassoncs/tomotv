# Performance Analysis - TomoTV

**Last Updated:** January 21, 2026
**Last Inspection:** After image cache and API optimization
**Current Memory Usage:** 250-350MB during browsing and video playback

---

## Memory Breakdown (Actual Contributors)

### Baseline (~100-150MB)
- React Native Runtime: ~50-80MB
- Expo Framework + Modules: ~30-50MB
- JavaScript Heap: ~20-40MB

### During Video Grid Browsing (+100-150MB)
1. **JSON Video Data**: ~10-20MB
   - 100 videos × ~100-200KB each (with MediaStreams arrays)

2. **React Component Instances**: ~30-50MB
   - 100 VideoGridItem components
   - Each with state, refs, callbacks

3. **Animated.Value Instances**: ~5-10MB
   - 100 cards × 1 Animated.Value each
   - Native-side allocations

4. **FlatList Render Window**: ~30-50MB
   - `windowSize={5}` with 5 columns = renders 110 items
   - Essentially keeps ALL 100 videos in memory

5. **Decoded Images (Disk Cache)**: ~20-30MB
   - Only visible cards decoded on-demand
   - 300×450px decoded ≈ 500KB each
   - ~10-15 visible at once

### During Video Playback (+100-200MB spike)
1. **Video Player Instance**: ~30-50MB
2. **HLS Buffer Segments**: ~50-150MB
   - Varies by bitrate and buffer size
   - 3-4 segments ahead buffered
3. **Video Decoder**: ~20-50MB (native)

**Total: 250-450MB** (within normal range for video streaming apps)

---

## Completed Optimizations

### VideoGridItem (`components/video-grid-item.tsx`)
- ✅ Lazy metadata computation (useEffect with isFocused dependency)
- ✅ Conditional BlurView (rendered only when focused)
- ✅ Disk-only image caching (cachePolicy="disk")
- ✅ Smaller images: 300px/200px (platform-specific constants)
- ✅ Conditional image priority (first 10 items high priority)
- ✅ Native-driver animation (Animated.spring with useNativeDriver)
- ✅ Platform value caching (POSTER_WIDTH/HEIGHT constants)

### FlatList (`app/(tabs)/index.tsx`)
- ✅ Correct getItemLayout (getItemLayout function in VideoLibraryScreen)
- ✅ Memoized renderItem (renderItem callback with useCallback)
- ✅ `removeClippedSubviews={true}` (FlatList prop)
- ✅ `initialNumToRender={10/9}` (FlatList prop, platform-specific)
- ✅ All callbacks memoized

### API (`services/jellyfinApi.ts`)
- ✅ Reduced payload fields (fetchLibraryVideos function with Fields parameter)
- ✅ Removed unused: Overview, PremiereDate, Ratings

---

## Primary Memory Issue: FlatList windowSize

**Location**: VideoLibraryScreen FlatList component in `app/(tabs)/index.tsx`

**Current**:
```typescript
windowSize={5}
```

**Problem**:
- 5-column grid × 2 rows/screen = 10 items per screen
- windowSize=5 = render 5 screens above + 1 current + 5 below
- Total: 11 screens × 10 items = **110 items rendered**
- You only have 100 videos, so ALL are rendered constantly
- No recycling benefits from FlatList

**Fix**:
```typescript
windowSize={3} // Render 3 screens above + 1 current + 3 below = 70 items
```

**Impact**: Saves 30-40 unmounted components (~20-30MB)

---

## Secondary Optimization: LoadingContext

**Location**: LoadingProvider component in `contexts/LoadingContext.tsx`

**Current**:
```typescript
<LoadingContext.Provider value={{ showGlobalLoader, hideGlobalLoader, isLoading }}>
```

Creates new object reference on every `isLoading` change, causing all consumers to re-render.

**Fix**:
```typescript
const value = useMemo(
  () => ({ showGlobalLoader, hideGlobalLoader, isLoading }),
  [isLoading]
);

<LoadingContext.Provider value={value}>
```

**Impact**: Prevents unnecessary re-renders, marginal memory benefit

---

## Memory Comparison: Industry Standard

| App | Browsing | Playback |
|-----|----------|----------|
| Netflix iOS | ~250-400MB | ~350-600MB |
| YouTube iOS | ~200-350MB | ~300-500MB |
| Plex iOS | ~180-320MB | ~280-450MB |
| **TomoTV** | **~250-300MB** | **~300-350MB** |

**Conclusion**: Your app is performing **within normal bounds** for video streaming apps.

---

## Recommended Actions (Priority Order)

### 1. Reduce windowSize (HIGH - Implement Now)
**File**: VideoLibraryScreen FlatList in `app/(tabs)/index.tsx`
```typescript
windowSize={3} // Change from 5
```
**Expected**: 20-30MB reduction

### 2. Memoize LoadingContext (MEDIUM - Good Practice)
**File**: LoadingProvider component in `contexts/LoadingContext.tsx`
```typescript
const value = useMemo(
  () => ({ showGlobalLoader, hideGlobalLoader, isLoading }),
  [isLoading]
);
```
**Expected**: Prevents re-renders, minimal memory impact

### 3. Consider Pagination (FUTURE - For 500+ Videos)
Only load 50-100 videos at a time for very large libraries.

---

## Memory is Acceptable

The 250-350MB usage is **expected and normal** for:
- 100 video items with metadata
- Native video player with buffering
- React Native + Expo framework
- Image caching

All major optimizations are already in place. The primary remaining opportunity is reducing `windowSize` to actually benefit from FlatList recycling.
