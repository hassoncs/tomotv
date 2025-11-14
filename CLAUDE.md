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
npm test               # Run all tests once
npm run test:watch     # Watch mode for tests
npm run test:coverage  # Generate coverage report
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
2. Add Jellyfin credentials (API key and User ID)
3. `scripts/update-dev-ip.js` writes your active LAN IP (falls back to `http://localhost:8096`) so simulators and on-network devices target the same machine
4. The `prestart`/`preios`/`preandroid` hooks automatically refresh the value before each run

## Architecture

### Technology Stack

- **React Native TVOS** (`npm:react-native-tvos@0.81.4-0`) - TV-optimized React Native
- **Expo Router** 6.0.14 - File-based routing with typed routes
- **Expo Video** 3.0.14 - Native video playback with full codec support
- **React Native Reanimated** 4.1.0 - GPU-accelerated animations
- **TypeScript** 5.9.2 - Full type safety
- **Jest** 30.2.0 - Testing framework

### Folder Structure

```
app/              # Expo Router screens (file-based routing)
  (tabs)/         # Tab navigation group (Library, Settings, Help)
  player.tsx      # Full-screen video player (modal)
components/       # Reusable UI components
contexts/         # React Context providers (LoadingContext)
hooks/            # Custom React hooks (useVideoPlayback, useColorScheme)
services/         # API integration layer (jellyfinApi.ts)
utils/            # Utility functions (logger, retry)
types/            # TypeScript type definitions
```

### Key Architectural Patterns

#### 1. File-Based Routing (Expo Router)

Routes are automatically generated from the `app/` folder structure:

- `app/(tabs)/index.tsx` → Home/Library screen
- `app/(tabs)/settings.tsx` → Settings screen
- `app/(tabs)/help.tsx` → Help screen
- `app/player.tsx` → Video player (fullScreenModal)

Navigation uses **NativeTabs** for iOS/tvOS optimized tab experience.

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
- `fetchVideos()` - Get all videos with retry logic
- `fetchVideoDetails()` - Get video metadata and codec info
- `getVideoStreamUrl()` - Direct download URL (for supported codecs)
- `getTranscodingStreamUrl()` - HLS master.m3u8 URL with quality settings
- `isCodecSupported()` - Check if codec can be direct-played
- `needsTranscoding()` - Determine if transcoding required

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
- Native-driver animations (GPU-accelerated)
- Image priority caching (first 10 items high priority)
- Platform-specific sizing (TV vs phone)

**FlatList Optimization:**

- Configurable columns (5 for TV, 3 for phone)
- Custom `getItemLayout` for predictable heights
- `windowSize` optimization
- `removeClippedSubviews` enabled
- `updateCellsBatchingPeriod` for batch updates

#### 6. State Management

- **LoadingContext:** Global loading state (modal spinner)
- **SecureStore:** Persistent storage for credentials (iCloud Keychain/Android Keystore)
- **Component State:** React hooks (`useState`, `useReducer`) for local state
- **Configuration:** Three-tier fallback (user settings → dev credentials → defaults)

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
- API key passed in headers and URLs

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
- The `scripts/update-dev-ip.js` auto-detects Mac IP before each start

### Apple TV Specific

- Uses `react-native-tvos` fork instead of standard React Native
- Configured with `@react-native-tvos/config-tv` plugin
- Larger UI elements (150px vs 100px posters)
- Native tab support with `NativeTabs`
- Menu button handling for navigation

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
const {
  state,
  videoRef,
  currentSubtitleTrack,
  availableSubtitleTracks,
  error,
  playVideo,
  retryPlayback,
  changeSubtitleTrack
} = useVideoPlayback()
```

The hook handles:

- Codec detection and transcoding decisions
- Stream URL generation
- Error recovery with retry
- Subtitle track switching

### Showing Global Loading

```typescript
import {useLoading} from "@/contexts/LoadingContext"

const {showGlobalLoader, hideGlobalLoader} = useLoading()

showGlobalLoader()
// ... async operation
hideGlobalLoader()
```

### Logging

```typescript
import {logger} from "@/utils/logger"

logger.info("Operation started", {videoId: "123"})
logger.error("Operation failed", {error: err})
```

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
npm test              # Run once
npm run test:watch   # Watch mode (recommended during development)
npm run test:coverage # Check coverage
```

## Known Issues & Limitations

1. **Codec Support:** Only H.264 and HEVC are direct-played; all others require transcoding
2. **Subtitle Burning:** External subtitles are burned into video during transcoding (cannot be toggled)
3. **Network:** HTTP connections limited to local networks; public Jellyfin servers must use HTTPS
4. **Jellyfin Only:** Only works with Jellyfin servers (not Plex, Emby, etc.)

## Additional Resources

- `DEVELOPMENT.md` - Detailed development setup guide
- `PERFORMANCE_ANALYSIS.md` - Performance optimization notes
- `TVOS_ICONS.md` - Apple TV icon guidelines
- `.env.example` - Environment variable template

## RULES

1. Unless intentionally, DO NOT run commands on the `node_modules` directory, it only wates tokens.
