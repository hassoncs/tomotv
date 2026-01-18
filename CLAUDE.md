# CLAUDE.md

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

- **GitHub**: [github.com/keiver/expo-tvos-search](https://github.com/keiver/expo-tvos-search)
- **Local clone**: `~/@keiver/expo-tvos-search`
- **Package reference**: `"expo-tvos-search": "github:keiver/expo-tvos-search"`

This package provides a native SwiftUI search interface for tvOS using the `.searchable` modifier. It handles:

- Native tvOS keyboard integration
- Grid display of search results with poster images
- Focus management and card styling
- Fixed 280x420 card dimensions (2:3 aspect ratio) for consistent layout

**When modifying search UI behavior:**

1. Make changes in `~/@keiver/expo-tvos-search/ios/ExpoTvosSearchView.swift`
2. Commit and push to the repo
3. Update this project: `npm install github:keiver/expo-tvos-search#branch-name`
4. Rebuild: `npm run prebuild:tv && npm run ios`

**Note**: Changes to `packages/expo-tvos-search/` in this repo are NOT used. The actual package comes from GitHub via npm.

### Folder Structure

```
app/              # Expo Router screens (file-based routing)
  (tabs)/         # Tab navigation group (Settings, Library, Search, Help)
  player.tsx      # Full-screen video player (modal)
components/       # Reusable UI components
contexts/         # React Context providers + singleton manager wrappers
hooks/            # Custom React hooks (useVideoPlayback, useColorScheme)
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

#### 3. Jellyfin API Integration (`services/jellyfinApi.ts`)

Single service for all Jellyfin communication with:

- Retry logic with exponential backoff (3 attempts max)
- Request timeouts (10-30 seconds)
- Configuration caching for synchronous URL generation
- Development fallback to `.env.local` credentials
- Quality preset system (480p, 540p, 720p, 1080p)

Important functions:

- `getConfig()` - Retrieve cached Jellyfin configuration
- `syncDevCredentials()` - Sync dev env vars to SecureStore on app load
- `fetchLibraryVideos()` - Get paginated videos with retry logic (fetchVideos is deprecated)
- `fetchFolderContents()` - Get folder contents with pagination
- `fetchPlaylistContents()` - Get playlist items using playlist-specific endpoint
- `fetchVideoDetails()` - Get video metadata and codec info
- `getVideoStreamUrl()` - Direct download URL (for supported codecs)
- `getTranscodingStreamUrl()` - HLS master.m3u8 URL with quality settings
- `isCodecSupported()` - Check if codec can be direct-played
- `needsTranscoding()` - Determine if transcoding required
- `isFolder()` - Check if item is navigable (Folder, Playlist, Series, UserView, etc.)

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

- `LibraryManager` - Manages video library with pagination, caching (5-min TTL), and subscriber notifications
- `FolderNavigationManager` - Manages folder navigation with breadcrumb stack

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
const { state, videoRef, currentSubtitleTrack, availableSubtitleTracks, error, playVideo, retryPlayback, changeSubtitleTrack } = useVideoPlayback();
```

The hook handles:

- Codec detection and transcoding decisions
- Stream URL generation
- Error recovery with retry
- Subtitle track switching

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

### Unit Tests

- Located alongside source files (e.g., `jellyfinApi.test.ts`)
- Test utilities, services, and hooks in isolation
- Use Jest with `jest-expo` preset

### Threading Tests

- Special tests for concurrent operations (e.g., `player.threading.test.tsx`)
- Ensure state machine is thread-safe
- Test cleanup on unmount

### Component Tests

- Test contexts (e.g., `LoadingContext.test.tsx`)
- Focus on behavior, not implementation details

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

