# CLAUDE.md

**Last Updated:** January 22, 2026

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TomoTV** is a cross-platform video streaming application that connects to a Jellyfin media server. Built with React Native TVOS and Expo, it supports iOS, Android, Apple TV, and web platforms. The app intelligently handles video codecs, automatically transcoding unsupported formats while direct-playing compatible ones.

## Development Commands

### Starting Development

```bash
npm start              # Refreshes dev IP and starts Metro/Expo
npm run ios            # Build and run on iOS simulator
npm run android        # Build and run on Android
```

### Testing

```bash
npm test                          # Run all tests once
npm run test:watch                # Watch mode for tests
npm run test:coverage             # Generate coverage report
npm test -- path/to/file.test.ts  # Run a single test file
```

### Code Quality

```bash
npm run lint           # Lint and auto-fix code with ESLint
```

### Building

```bash
npm run prebuild       # Clean native prebuild
npm run prebuild:tv    # Prebuild with Apple TV support (EXPO_TV=1)
```

> Builds are produced locally via `expo run:*`; there is no remote deploy script.

### Development Setup

1. Copy `.env.example` to `.env.local`
2. Add Jellyfin credentials (server URL, API key, and User ID)

## Architecture

### Technology Stack

- **React Native TVOS** (`npm:react-native-tvos@0.81.4-0`) - TV-optimized React Native
- **Expo Router** 6.0.14 - File-based routing with typed routes
- **Expo Video** 3.0.14 - Native video playback with full codec support
- **React Native Reanimated** 4.1.0 - GPU-accelerated animations
- **TypeScript** 5.9.2 - Full type safety
- **Jest** 29.7.0 - Testing framework
- **expo-tvos-search** - Native tvOS search UI (see External Repositories below)

### External Repositories

#### expo-tvos-search

The native tvOS search functionality is maintained in a **separate repository**:

- **GitHub:** [github.com/keiver/expo-tvos-search](https://github.com/keiver/expo-tvos-search)
- **npm:** `expo-tvos-search@^1.3.1`
- **Package reference:** `"expo-tvos-search": "^1.3.1"` (npm registry)
- **Demo app:** Local clone at `~/@keiver/expo-tvos-search-demo`

This package provides a native SwiftUI search interface for tvOS using the `.searchable` modifier.

**Features:**
- Native tvOS keyboard integration
- Grid display with poster images (configurable columns)
- Marquee text scrolling for long titles
- Focus management with SwiftUI focus engine
- Comprehensive input validation (500-char limit, URL scheme checking)
- Customizable card dimensions (default 280×420, 2:3 aspect ratio)
- Image content modes: fill, fit, contain
- Error and validation warning events

**Current Integration:**
- Version: 1.3.1 (npm registry)
- Last updated: January 21, 2026
- Status: Stable, production-ready
- No local modifications needed

**Usage in TomoTV:**
```typescript
import { TvosSearchView, isNativeSearchAvailable } from 'expo-tvos-search';

if (isNativeSearchAvailable()) {
  // Use native search on tvOS
} else {
  // Fallback to React Native TextInput
}
```

**Modifying Search UI:**
To contribute to the search package:
1. Clone: `git clone https://github.com/keiver/expo-tvos-search.git`
2. Make changes to `ios/ExpoTvosSearchView.swift`
3. Submit PR to repository
4. After merge, update TomoTV: `npm install expo-tvos-search@latest`
5. Rebuild: `npm run prebuild:tv && npm run ios`

**Note:** The package at `~/@keiver/expo-tvos-search` is for reference only. TomoTV uses the npm registry version, not a local file dependency.

### Folder Structure

```
app/              # Expo Router screens (file-based routing)
  (tabs)/         # Tab navigation group (Settings, Library, Search, Help)
  player.tsx      # Full-screen video player (modal)
components/       # Reusable UI components
contexts/         # React Context providers + singleton manager wrappers
hooks/            # Custom React hooks (useVideoPlayback, useColorScheme, useAppStateRefresh)
services/         # API integration + singleton state managers
utils/            # Utility functions (logger, retry)
types/            # TypeScript type definitions
```

### Key Architectural Patterns

#### 1. File-Based Routing (Expo Router)

Routes are automatically generated from the `app/` folder structure:

- `app/(tabs)/index.tsx` → Library screen (home)
- `app/(tabs)/search.tsx` → Search screen with text input
- `app/(tabs)/settings.tsx` → Settings screen
- `app/(tabs)/help.tsx` → Help screen
- `app/player.tsx` → Video player (fullScreenModal)

Navigation uses **NativeTabs** (`expo-router/unstable-native-tabs`) for iOS/tvOS optimized tab experience with SF Symbols icons.

#### 2. Video Playback State Machine

The `useVideoPlayback` hook implements a state machine for video playback:

```
IDLE → FETCHING_METADATA → CREATING_STREAM → INITIALIZING_PLAYER → READY → PLAYING
                                                                            ↓
                                                                          ERROR
```

Key features:

- Codec detection (H.264, HEVC supported natively; others transcode)
- Automatic retry with transcoding on failure
- Subtitle track management (burned-in or separate)
- Thread-safe with proper cleanup

### Error Classification System

**PlaybackErrorType Enum:**

| Error Type | Description | Recovery Strategy |
|------------|-------------|-------------------|
| `METADATA_FETCH` | Failed to fetch video details from server | User retry only |
| `STREAM_URL` | Failed to generate stream URL | User retry only |
| `PLAYBACK` | Video player initialization failed | **Auto-retry with transcoding** |
| `NETWORK` | Network timeout or connection error | User retry only |
| `UNKNOWN` | Unclassified errors | User retry only |

**Auto-Retry Logic:**
- Only `PLAYBACK` errors trigger automatic retry
- First attempt: Direct play (if codec H.264/HEVC)
- Second attempt: Transcoding (if first attempt fails)
- Maximum 1 auto-retry per video session
- Prevents infinite retry loops

**Error Pattern Matching:**
Errors are classified by matching against known patterns:
- Metadata: "fetch", "metadata", "details"
- Stream URL: "stream URL", "generate", "transcod"
- Playback: Native player errors, codec issues
- Network: "timeout", "network", "connection"

**User-Facing Messages:**
All errors show user-friendly messages without technical details or credentials.

#### 3. Jellyfin API Integration (`services/jellyfinApi.ts`)

Single service for all Jellyfin communication with:

- Retry logic with exponential backoff (3 attempts max)
- Request timeouts (10-30 seconds)
- Configuration caching for synchronous URL generation
- Development fallback to `.env.local` credentials
- Quality preset system with adaptive bitrates

**Video Quality Presets:**

| Preset | Resolution | Bitrate | Use Case |
|--------|-----------|---------|----------|
| 480p | 854×480 | 1.5 Mbps | Slow connections, data saving |
| 540p | 960×540 | 2.5 Mbps | Balanced quality |
| 720p | 1280×720 | 4 Mbps | HD quality, good bandwidth |
| 1080p | 1920×1080 | 8 Mbps | Full HD, fast connections |

**Note:** Bitrates are optimized for quality (increased from original 1/1.5/3/5 Mbps values).

### API Functions Reference

#### Configuration Management

| Function | Purpose | Returns |
|----------|---------|---------|
| `refreshConfig()` | Reload from SecureStore (async) | `Promise<void>` |
| `waitForConfig()` | Wait for initialization | `Promise<void>` |
| `isConfigReady()` | Check if config initialized | `boolean` |

#### Server Connection

| Function | Purpose | Returns |
|----------|---------|---------|
| `connectToDemoServer(clearCaches?)` | Connect to Jellyfin demo server | `Promise<void>` |
| `disconnectFromDemo()` | Disconnect and clear credentials | `Promise<void>` |
| `isDemoMode()` | Check if using demo server | `boolean` |
| `syncDevCredentials()` | Sync .env.local to SecureStore | `Promise<void>` |

#### Library & Content

| Function | Purpose | Returns |
|----------|---------|---------|
| `fetchLibraryVideos(startIndex, limit)` | Get paginated videos | `Promise<{items, total}>` |
| `fetchFolderContents(folderId, startIndex, limit)` | Get folder items | `Promise<{items, total}>` |
| `fetchPlaylistContents(playlistId, startIndex, limit)` | Get playlist items | `Promise<{items, total}>` |
| `fetchVideoDetails(videoId)` | Get video metadata | `Promise<VideoMetadata>` |
| `fetchUserViews()` | Get root library views | `Promise<JellyfinItem[]>` |

#### Search

| Function | Purpose | Returns |
|----------|---------|---------|
| `searchVideos(query, startIndex, limit)` | Search with year filtering | `Promise<{items, total}>` |

#### Streaming & URLs

| Function | Purpose | Returns |
|----------|---------|---------|
| `getVideoStreamUrl(itemId)` | Direct download URL | `string` |
| `getTranscodingStreamUrl(itemId, videoItem?)` | HLS transcode URL (async) | `Promise<string>` |
| `getPosterUrl(itemId, maxHeight?)` | Poster image URL | `string` |
| `getFolderThumbnailUrl(itemId, maxHeight?)` | Folder/collection thumbnail | `string` |
| `getSubtitleUrl(itemId, streamIndex, format?)` | Subtitle stream URL | `string` |

#### Utilities

| Function | Purpose | Returns |
|----------|---------|---------|
| `isCodecSupported(codec)` | Check native codec support | `boolean` |
| `needsTranscoding(videoItem)` | Determine if transcode needed | `boolean` |
| `isFolder(item)` | Check if item is navigable | `boolean` |
| `isAudioOnly(videoItem)` | Detect audio-only media | `boolean` |
| `hasPoster(item)` | Check if item has poster | `boolean` |
| `formatDuration(ticks)` | Ticks to human-readable | `string` |
| `getSubtitleTracks(videoItem)` | Get subtitle metadata | `SubtitleTrack[]` |

#### 4. Codec & Streaming Strategy

- **Direct Play:** H.264, HEVC (natively supported on iOS/tvOS)
- **Transcoding:** All other codecs (MPEG-4, VP8, VP9, AV1, VC-1, MPEG-2, DivX, Xvid)
- **HLS Master.m3u8:** Primary transcoding endpoint with adaptive bitrate
- **Direct Download:** Fallback for direct-compatible files
- **Subtitle Handling:** External subtitles burned into video during transcoding

#### 5. Performance Optimizations

**VideoGridItem Component:**

- `React.memo` with custom comparison function
- Lazy metadata computation (only when focused)
- No scale animations (instant focus feedback via border only)
- Image priority caching (first 10 items high priority)
- Platform-specific sizing (TV vs phone)
- BlurView only rendered when focused

**FlatList Optimization:**

- Configurable columns (5 for TV, 3 for phone)
- Custom `getItemLayout` for predictable heights
- `windowSize` optimization
- `removeClippedSubviews` enabled
- `updateCellsBatchingPeriod` for batch updates

**Animation Strategy:**

All scale animations were removed from grid items (VideoGridItem, FolderGridItem, BackGridItem) for performance. Focus feedback is now instant via border color change only. This eliminates jumpiness during folder navigation and app startup.

#### 6. State Management

The app uses a **Singleton Manager + Context wrapper** pattern for global state:

**Singleton Managers** (`services/`):

##### LibraryManager

**Public API:**
- `getInstance()` - Get singleton instance
- `getState()` - Get current state snapshot
  ```typescript
  {
    videos: JellyfinItem[];
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMoreResults: boolean;
    error: string | null;
    libraryName: string;
  }
  ```
- `subscribe(callback)` - Subscribe to state changes (returns unsubscribe function)
- `refreshLibrary()` - Force refresh from API
- `loadMore()` - Load next page
- `clearCache()` - Clear cached videos and state

**Cache Strategy:**
- 5-minute TTL on library data
- Automatic refresh on cache expiration
- Clears on credential changes

##### FolderNavigationManager

**Public API:**
- `getInstance()` - Get singleton instance
- `getState()` - Get navigation state snapshot
  ```typescript
  {
    items: JellyfinItem[];
    isLoading: boolean;
    isLoadingMore: boolean;
    hasMoreResults: boolean;
    error: string | null;
    folderStack: FolderStackEntry[];
    currentFolder: FolderStackEntry | null;
  }
  ```
- `subscribe(callback)` - Subscribe to state changes (returns unsubscribe function)
- `navigateToFolder(folder)` - Navigate into folder/playlist
- `navigateBack()` - Navigate to parent folder (returns boolean)
- `navigateToBreadcrumb(index)` - Jump to specific breadcrumb
- `loadRoot()` - Load root library views
- `loadMore()` - Load next page
- `clearCache()` - Clear all folder caches

**Folder Stack:**
Each entry tracks:
- `id` - Folder/playlist ID
- `name` - Display name
- `type` - Entry type (folder, playlist, root)
- Enables breadcrumb navigation

**Context Wrappers** (`contexts/`):

- `LibraryContext` - React wrapper for `LibraryManager`, provides `useLibrary()` hook
- `FolderNavigationContext` - React wrapper for `FolderNavigationManager`, provides `useFolderNavigation()` hook
- `LoadingContext` - Global loading state (modal spinner)

**Other State:**

- **SecureStore:** Persistent storage for credentials (iCloud Keychain/Android Keystore)
- **Component State:** React hooks (`useState`, `useReducer`) for local state
- **Configuration:** Three-tier fallback (user settings → dev credentials → defaults)

The manager pattern allows state to persist across component remounts and provides pub/sub updates to React.

#### 7. Error Handling

- Global `ErrorBoundary` at root layout catches React errors
- Try-catch blocks with structured logging via `utils/logger.ts`
- User-friendly error messages with "Go to Settings" or "Retry" buttons
- Debug info shown only in development
- Automatic retry with backoff for transient network errors

#### 8. Platform-Specific Features

- **iOS/tvOS:** Native tabs, TV event handlers (menu button), larger UI elements
- **Android:** Hardware back button support
- **Web:** React Native Web with responsive design
- **TV-Specific:** Focus management with `isTVSelectable`, directional navigation

## Important Implementation Details

### Development vs Production Configuration

The app uses a smart fallback system:

**Development (with `.env.local`):**

1. Checks SecureStore for user-configured settings
2. Falls back to `.env.local` credentials if empty
3. `syncDevCredentials()` runs on app load to populate SecureStore

**Production (App Store builds):**

1. `.env.local` is NOT included (git-ignored)
2. Users must configure via Settings screen
3. Credentials stored securely in native secure storage

**Demo Mode (Testing without setup):**

1. One-tap connection to Jellyfin's official demo server (`https://demo.jellyfin.org/stable`)
2. Credentials fetched dynamically via API (demo server resets hourly)
3. Stores demo credentials in SecureStore with `IS_DEMO_MODE` flag
4. Users can disconnect from demo and configure their own server anytime
5. Perfect for App Store reviewers or first-time users

**Demo Server Advanced Features:**

The `connectToDemoServer()` function supports cache management:

```typescript
connectToDemoServer(clearCaches: boolean = true)
```

**Parameters:**
- `clearCaches` (default: `true`): Controls cache behavior
  - `true`: Full cache clear (use when initially connecting to demo server)
  - `false`: Preserve UI state (use when refreshing expired credentials mid-session, e.g., during video playback)

**SecureStore Keys:**

| Key | Purpose | Type |
|-----|---------|------|
| `jellyfin_server_url` | Jellyfin server URL | string |
| `jellyfin_api_key` | API authentication token | string (hex) |
| `jellyfin_user_id` | User GUID | string (hex) |
| `app_video_quality` | Transcoding quality preset (0-3) | string (number) |
| `jellyfin_is_demo_mode` | Demo server connection flag | "true" \| null |

**Note:** All keys are stored in iCloud Keychain (iOS) / Android Keystore automatically.

**Protection Logic:**

The `syncDevCredentials()` function checks the `jellyfin_is_demo_mode` flag before syncing development credentials to SecureStore. This prevents `.env.local` credentials from overwriting demo server credentials during development.

### Configuration Initialization Pattern

The app uses `configInitPromise` to prevent race conditions between:
1. `syncDevCredentials()` writing to SecureStore (async, runs on app load)
2. Components calling `getConfig()` (sync, reads from cache)

**Solution:**
```typescript
let configInitPromise: Promise<void> | null = null;

export function waitForConfig(): Promise<void> {
  if (configInitPromise) return configInitPromise;
  return Promise.resolve();
}
```

Components that need guaranteed initialized config can await `waitForConfig()`.

### Configuration Migration

**Old Format (v1.x):**
- Separate keys: `JELLYFIN_SERVER_IP`, `JELLYFIN_SERVER_PORT`, `JELLYFIN_SERVER_PROTOCOL`
- Three discrete values combined into URL

**New Format (v2.x+):**
- Single key: `jellyfin_server_url` (full URL string)
- Simpler validation and usage

**Auto-Migration:**
On first load, `migrateOldConfigFormat()` in `services/jellyfinApi.ts`:
1. Checks for old keys in SecureStore
2. Combines into full URL format
3. Writes to new `jellyfin_server_url` key
4. Deletes old keys
5. One-time operation, no user intervention required

### Environment Variables

All environment variables must use `EXPO_PUBLIC_` prefix:

```bash
EXPO_PUBLIC_DEV_JELLYFIN_SERVER=http://localhost:8096
EXPO_PUBLIC_DEV_JELLYFIN_API_KEY=your_api_key
EXPO_PUBLIC_DEV_JELLYFIN_USER_ID=your_user_id
```

### Security Considerations

- Never commit `.env.local` (already in `.gitignore`)
- No hardcoded credentials in source code
- ATS (App Transport Security) allows HTTP for local networks only (HTTPS required for internet servers)
- Credentials stored in iCloud Keychain (iOS) / Android Keystore

**API Key in URLs (Jellyfin Limitation):**

The API key must be included in query parameters for certain URLs consumed by native components:

- **Image URLs:** Poster/thumbnail URLs passed to `<Image>` components
- **Video URLs:** Stream URLs passed to `expo-video` player
- **Download URLs:** Direct file download URLs

This is a Jellyfin API requirement - these native components cannot add custom headers to requests. The API key will appear in:

- Server access logs
- Browser history (web platform)
- Network capture tools during debugging

**Mitigations:**

- Use HTTPS for remote servers (encrypts URLs in transit)
- API keys have limited scope (Jellyfin API access only, not system-level)
- Users can regenerate API keys from Jellyfin dashboard if compromised
- For maximum security, use a dedicated API key for this app with minimal permissions

### Testing Production Behavior

To test the app without dev credentials:

```bash
mv .env.local .env.local.backup
npm start
# App will require manual configuration via Settings screen
mv .env.local.backup .env.local
```

### Network Configuration

- **iOS/tvOS:** `NSAppTransportSecurity` allows local HTTP connections
- **iOS/tvOS:** `NSLocalNetworkUsageDescription` for Bonjour discovery

### Apple TV Specific

- Uses `react-native-tvos` fork instead of standard React Native
- Configured with `@react-native-tvos/config-tv` plugin
- Larger UI elements (150px vs 100px posters)
- Native tab support with `NativeTabs`
- Menu button handling for navigation

### tvOS App Icons & Top Shelf Images

See `CLAUDE-tvos-icons.md` for detailed tvOS icon setup, folder structure, naming requirements, and common validation errors.

### Settings Screen Implementation

The Settings screen (`app/(tabs)/settings.tsx`) uses specialized patterns for credential management and UI state synchronization.

**Auto-Reload Pattern:**

The settings screen uses `useFocusEffect` instead of `useEffect` to reload credentials whenever the screen comes into focus:

```typescript
useFocusEffect(
  useCallback(() => {
    loadSettings();
  }, [])
);
```

This ensures:
- Demo server credentials are visible after connecting from error screens
- Settings always reflect current SecureStore state
- Multi-screen workflows work seamlessly

**Form State Management:**

Uses refs (`currentServerUrl.current`) alongside state to maintain sync between input fields and validation logic without causing unnecessary re-renders.

**Demo Mode UI:**

Demo server connection is NOT available from Settings screen (removed in commit 740d791). Demo mode is only accessible via:
- "Try Demo Server" button on Library error screen
- Programmatic `connectToDemoServer()` calls

## Common Patterns

### Adding a New Screen

1. Create file in `app/` folder (e.g., `app/profile.tsx`)
2. Export default component
3. Route is auto-generated (`/profile`)
4. Use `router.push('/profile')` to navigate

### Adding a New API Method

1. Add function to `services/jellyfinApi.ts`
2. Use `retryWithBackoff()` for network calls
3. Log errors with `utils/logger.ts`
4. Cache configuration with `getConfig()`

### Video Playback Implementation

Use the `useVideoPlayback` hook:

```typescript
const { state, videoRef, error, playVideo, retryPlayback } = useVideoPlayback();
```

The hook handles:

- Codec detection and transcoding decisions
- Stream URL generation
- Error recovery with retry

### Track Selection (Subtitles & Audio)

**TomoTV's Killer Feature: Seamless Multi-Audio Track Switching**

TomoTV is the **ONLY Jellyfin client** that provides perfect, seamless audio track switching during transcoding. This feature works exactly like Apple TV+, Netflix, and Disney+ - no video restarts, no interruptions, just instant audio switching.

#### How It Works

**Technical Implementation:**

TomoTV uses a custom Swift module (`MultiAudioResourceLoader`) that intercepts HLS manifest loading and generates proper multivariant playlists client-side:

1. **Detection:** When a video with multiple audio tracks needs transcoding, TomoTV detects this in `useVideoPlayback` hook
2. **Manifest Fetching:** Custom Swift module fetches individual Jellyfin HLS manifests for each audio track
3. **Manifest Generation:** Combines all manifests into a single multivariant HLS playlist with proper `#EXT-X-MEDIA` tags
4. **Custom Protocol:** Uses `jellyfin-multi://` protocol to trigger the custom resource loader
5. **Native Discovery:** AVPlayer discovers all audio tracks from the combined manifest
6. **Seamless Switching:** User can switch between tracks during playback without interruption

**User Experience:**

- **Native iOS/tvOS audio picker** shows all available audio tracks
- Track labels display language, codec, and channel info: "ENGLISH (AC3 5.1)", "SPANISH (AAC STEREO)"
- **Switching is instant and seamless** - no video restart, no buffering delay
- Works exactly like premium streaming services (Apple TV+, Netflix, Disney+)
- Respects user's language preferences and device settings
- **Works during transcoding** - no need for direct play compatibility

**Subtitles (Already Working):**

- `SubtitleMethod=Hls` parameter tells Jellyfin to include ALL subtitle tracks in the HLS manifest
- Includes both external (.srt files) AND embedded subtitle streams
- Each subtitle appears as a separate WebVTT stream in the manifest
- expo-video auto-discovers tracks from HLS `#EXT-X-MEDIA:TYPE=SUBTITLES` tags
- Native controls provide subtitle selection UI
- Toggle on/off during playback seamlessly

**API Functions:**

- `getSubtitleTracks(videoItem)` - Returns array of subtitle tracks (both external and embedded)
- `getAudioTracks(videoItem)` - Returns array of audio tracks with full metadata
- `prepareMultiAudioPlayback(videoId, videoItem, baseUrl, apiKey)` - Prepares multi-audio custom protocol URL
- `shouldUseMultiAudio(videoItem)` - Checks if video should use multi-audio loader
- `isMultiAudioAvailable()` - Checks if native module is available (iOS/tvOS only)

#### Competitive Advantage

TomoTV solves the exact problems users complain about in other Jellyfin clients:

| Feature | TomoTV | Swiftfin | Jellyfin Web |
|---------|--------|----------|--------------|
| **Multi-audio transcoding** | ✅ Seamless switching | ❌ Broken/random | ❌ Restart required |
| **Native track picker** | ✅ Always works | ⚠️ Sometimes | ❌ Custom UI |
| **Respects user settings** | ✅ Yes | ❌ No | ⚠️ Sometimes |
| **Subtitle handling** | ✅ Perfect | ⚠️ Random | ✅ Good |
| **UX quality** | ✅ Apple-level | ❌ Inconsistent | ⚠️ Web-based |

**Real User Complaints (Swiftfin):**

> "I've found that my personal settings for my user profiles aren't being read on the TVOS version of Swiftfin on my Apple TV... **languages going from English to Japanese randomly**" - App Store Review

TomoTV fixes these issues with its custom multi-audio implementation. Languages never switch randomly, settings are respected, and the experience is flawless.

#### Technical Details

**Swift Module Structure:**

```
ios/MultiAudioResourceLoader/
├── MultiAudioResourceLoader.swift      # AVAssetResourceLoaderDelegate
├── HLSManifestParser.swift            # Parse Jellyfin manifests
├── HLSManifestGenerator.swift         # Generate multivariant manifest
├── MultiAudioResourceLoader.m         # React Native bridge
└── MultiAudioResourceLoader-Bridging-Header.h
```

**Custom Protocol Flow:**

1. TypeScript detects multi-audio video during transcoding
2. Calls `prepareMultiAudioPlayback()` to configure native module
3. Native module generates `jellyfin-multi://...` URL
4. AVPlayer loads URL → triggers `AVAssetResourceLoaderDelegate`
5. Delegate fetches all Jellyfin manifests in parallel
6. Combines into multivariant playlist with all audio tracks
7. AVPlayer discovers tracks and enables native picker

**Example Generated Manifest:**

```m3u8
#EXTM3U
#EXT-X-VERSION:3

# Audio tracks
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="ENGLISH (AC3 5.1)",LANGUAGE="en",DEFAULT=YES,AUTOSELECT=YES,URI="..."
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="SPANISH (AAC STEREO)",LANGUAGE="es",AUTOSELECT=YES,URI="..."
#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="FRENCH (DTS 7.1)",LANGUAGE="fr",AUTOSELECT=YES,URI="..."

# Video stream with audio group reference
#EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1280x720,AUDIO="audio"
http://jellyfin:8096/Videos/abc123/video.m3u8?api_key=...
```

**Fallback Behavior:**

- **Single audio track:** Uses regular transcoding (no custom protocol overhead)
- **Direct play:** All audio tracks available natively (no custom protocol needed)
- **Non-iOS platforms:** Feature not available (iOS/tvOS only)
- **Module not available:** Falls back to regular transcoding gracefully

#### Why This Matters

- **Families with different language preferences** can each watch in their preferred language
- **International content** (anime, foreign films) works perfectly
- **Accessibility** for users who need different audio tracks
- **Professional quality** that matches or exceeds premium streaming services
- **True competitive differentiation** - no other Jellyfin client has this

### Custom React Hooks

- **`useVideoPlayback()`** - Video playback state machine with auto-retry
- **`useColorScheme()`** - Platform-specific dark/light mode detection
- **`useAppStateRefresh()`** - Auto-refresh data when app returns to foreground
  - Used in LibraryContext to refresh library on app resume
  - Hooks into `AppState` event listener
  - Prevents stale data after backgrounding

### Using Library State

```typescript
import { useLibrary } from "@/contexts/LibraryContext";

const { videos, isLoading, hasMoreResults, loadMore, refreshLibrary } = useLibrary();
```

### Using Folder Navigation

```typescript
import { useFolderNavigation } from "@/contexts/FolderNavigationContext";

const { items, folderStack, navigateToFolder, navigateBack, loadMore, isLoading } = useFolderNavigation();
```

Features:

- Breadcrumb sidebar (rotated text on left edge)
- Back item at grid start for parent navigation
- Per-folder caching with 5-minute TTL
- Pagination support via `loadMore()`
- Auto-navigates into first library on root load
- **Playlist support:** Playlists use a different API endpoint (`/Playlists/{id}/Items`) and are automatically detected via the `type` field in `FolderStackEntry`

### Showing Global Loading

```typescript
import { useLoading } from "@/contexts/LoadingContext";

const { showGlobalLoader, hideGlobalLoader } = useLoading();

showGlobalLoader();
// ... async operation
hideGlobalLoader();
```

### Logging

```typescript
import { logger } from "@/utils/logger";

logger.info("Operation started", { videoId: "123" });
logger.error("Operation failed", { error: err });
```

### Search Implementation

The search screen (`app/(tabs)/search.tsx`) has two implementations:

**Native tvOS Search** (when `isNativeSearchAvailable()` returns true):

- Uses `expo-tvos-search` package (external repo - see External Repositories section)
- Native SwiftUI `.searchable` modifier for keyboard integration
- Fixed 280x420 card grid with poster images
- To modify UI: edit `~/@keiver/expo-tvos-search/ios/ExpoTvosSearchView.swift`

**React Native Fallback** (iOS/Android):

- Debounced text input (300ms delay)
- Same grid layout as library view using `VideoGridItem` component

**Search API** (`services/jellyfinApi.ts`):

- `searchVideos()` searches across all libraries (Movies, Shows, Music)
- Supports year filtering: "action 2023", "90s", "2019-2023"
- Automatically expands Series results to playable Episodes
- Returns only playable items (Movie, Video, Episode, Audio)
- Path/folder names are searchable via Jellyfin's SearchTerm

## Testing Strategy

### Test Organization

**Unit Tests:**
- `services/__tests__/jellyfinApi.test.ts` - API methods, retry logic, mocking
- `utils/__tests__/logger.test.ts` - Logging utilities
- `utils/__tests__/retry.test.ts` - Exponential backoff
- `hooks/__tests__/useVideoPlayback.test.ts` - Playback state machine

**Integration Tests:**
- `contexts/__tests__/LibraryContext.test.tsx` - Manager + Context integration
- `contexts/__tests__/FolderNavigationContext.test.tsx` - Navigation flow
- `contexts/__tests__/LoadingContext.test.tsx` - Global loading state

**Threading & Concurrency Tests:**
- `app/__tests__/player.threading.test.tsx` - Concurrent playback operations
- `hooks/__tests__/useVideoPlayback.threading.test.ts` - Race condition safety
- Focus: Cleanup on unmount, state consistency under rapid changes

**UI Component Tests:**
- `app/(tabs)/__tests__/search.test.tsx` - Search screen behavior
- `app/(tabs)/__tests__/index.test.tsx` - Library screen pagination

**Test Patterns:**
- Use `react-test-renderer` for component testing
- Mock external dependencies with `jest.mock()`: `expo-secure-store`, `expo-router`
- Test harness pattern with refs for context testing
- Test behavior and outcomes, not implementation details
- Threading tests use `act()` from `react-test-renderer` for concurrency

### Running Tests

```bash
npm test                                # Run once
npm run test:watch                      # Watch mode (recommended during development)
npm run test:coverage                   # Check coverage
npm test -- services/jellyfinApi.test.ts  # Run single file
```

## UI Design System

### Color Palette

| Color          | Hex       | Usage                                    |
| -------------- | --------- | ---------------------------------------- |
| Background     | `#1C1C1E` | All screen backgrounds                   |
| Card/Section   | `#2C2C2E` | Settings sections, elevated surfaces     |
| Card Focused   | `#3A3A3C` | Focused card background                  |
| Primary/Gold   | `#FFC312` | Icons, focus borders, accents            |
| Success/Green  | `#34C759` | URLs, Jellyfin highlight, success states |
| Text Primary   | `#FFFFFF` | Headings, important text                 |
| Text Secondary | `#8E8E93` | Subtitles, labels                        |
| Text Tertiary  | `#636366` | Captions, hints                          |

### Help Screen (Landing Page)

The help screen (`app/(tabs)/help.tsx`) is a single-screen landing page:

- Hero: Round app icon with golden glow, title, tagline
- 3 feature cards with round icons and captions
- QR code (static asset) + documentation URL
- Jellyfin acknowledgment footer
- No scrolling required (TV-optimized)

## Known Issues & Limitations

1. **Codec Support:** Only H.264 and HEVC are direct-played; all others require transcoding
2. **Subtitle Burning:** External subtitles are burned into video during transcoding (cannot be toggled)
3. **Network:** HTTP connections limited to local networks; public Jellyfin servers must use HTTPS
4. **Jellyfin Only:** Only works with Jellyfin servers (not Plex, Emby, etc.)

## Additional Resources

- `CLAUDE-components.md` - UI component documentation
- `CLAUDE-security.md` - Security architecture and audit findings
- `CLAUDE-development.md` - Development setup guide
- `CLAUDE-app-performance.md` - Performance optimization notes
- `CLAUDE-tvos-icons.md` - Apple TV icon guidelines
- `CLAUDE-apple-store-metadata.md` - App Store copy and metadata
- `CLAUDE-apple-store-checklist.md` - Submission checklist
- `CLAUDE-image-analysis.md` - Image analysis skill
- `.env.example` - Environment variable template

## RULES

1. Unless intentionally, DO NOT run commands on the `node_modules` directory

- Stop searching node_modules unless required to inspect current lib implementation

