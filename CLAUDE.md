# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TomoTV** is a React Native (Expo) application that streams video content from a Jellyfin media server. It's designed for iOS, tvOS (Apple TV), and mobile platforms. The app features video library browsing, automatic codec detection, and intelligent transcoding when needed.

## Essential Commands

### Development
```bash
npm start                    # Start Expo dev server
npm run ios                  # Run on iOS simulator (or press 'i' in dev server)
npm run android             # Run on Android emulator
npm run web                 # Run web version
```

**To run on Apple TV:**
1. `npm start`
2. Press `i` for iOS
3. Select an Apple TV simulator from the list
4. Or run: `npx expo run:ios` and choose Apple TV when prompted

**First-time setup:**
```bash
cp .env.example .env.local   # Copy environment template
# Edit .env.local with your Jellyfin server credentials
```

See [DEVELOPMENT.md](DEVELOPMENT.md) for complete setup instructions.

### Code Quality
```bash
npm run lint                # Run ESLint (expo lint)
npm test                    # Run Jest tests
npm run typecheck           # Run TypeScript type checker
```

### Building
```bash
npm run prebuild           # Generate native projects
npm run prebuild:tv        # Generate native projects with TV support (sets EXPO_TV=1)
npm run deploy             # Export for web and deploy via EAS
```

### Dependencies
```bash
npm install                # Install deps and run patches (postinstall: patch-package)
```

## Architecture

### Platform Targets
- **iOS/tvOS**: Primary target platform using `react-native-tvos` fork
- **Apple TV**: Full native support with TV-specific navigation and focus management
- **Mobile**: iOS and Android phone/tablet support
- **Web**: Limited support via `react-native-web`

### Core Technologies
- **Expo Router 6.x**: File-based routing with typed routes (`experiments.typedRoutes: true`)
- **Expo Video**: Native video playback with HLS and transcoding support
- **React Native tvOS**: Custom fork (`react-native-tvos@0.81.4-0`) for Apple TV support
- **New Architecture**: Enabled via `newArchEnabled: true` in app.json
- **React Compiler**: Experimental React Compiler enabled via `experiments.reactCompiler`

### Directory Structure

```
app/
  ├── _layout.tsx              # Root navigation layout (Stack navigator)
  ├── (tabs)/                  # Tab-based navigation group
  │   ├── _layout.tsx          # Tab bar layout (NativeTabs)
  │   ├── index.tsx            # Video library screen (main screen)
  │   └── settings.tsx         # Jellyfin server settings
  └── player.tsx               # Full-screen video player modal

services/
  └── jellyfinApi.ts           # Jellyfin API integration (fetch videos, streaming URLs, codec checks)

types/
  ├── jellyfin.ts              # Jellyfin API type definitions
  └── react-native-tvos.d.ts   # TV-specific prop augmentations (isTVSelectable, hasTVPreferredFocus)

components/
  ├── video-grid-item.tsx      # Video thumbnail grid item with poster images
  ├── video-debug-overlay.tsx  # Debug overlay for video playback issues
  ├── themed-view.tsx          # Theme-aware View component
  ├── themed-text.tsx          # Theme-aware Text component
  └── error-boundary.tsx       # Error boundary wrapper
```

### Jellyfin API Service (`services/jellyfinApi.ts`)

**Critical service** that handles all Jellyfin media server communication:

- **Configuration Management**: Uses `expo-secure-store` for iCloud Keychain sync across devices
  - Server IP, API key, and User ID stored securely
  - Cached config for synchronous URL generation
  - `refreshConfig()` must be called after settings changes

- **Video Fetching**: `fetchVideos()` retrieves all movies/videos with metadata (path, media streams, overview, genres, ratings)

- **Codec Detection**: `needsTranscoding()` checks video codec compatibility
  - Supported: H.264/AVC (universal), HEVC/H.265 (modern devices)
  - Requires transcoding: MPEG-4, VP8/VP9, AV1, VC-1, MPEG-2, DivX/Xvid
  - Default to transcoding for unknown codecs to prevent black screens

- **Stream URL Generation**:
  - `getVideoStreamUrl()`: Direct download (no transcoding)
  - `getTranscodingStreamUrl()`: HLS transcoding to H.264/AAC
  - Always uses cached config for synchronous calls

- **Subtitles**: `getSubtitleTracks()` detects external subtitle files
  - When external subtitles are detected, player uses HLS transcoding
  - **Always requires full H.264 transcode** - subtitle burn-in cannot use copy mode
  - Subtitles are burned into video frames using `SubtitleMethod=Encode`
  - Subtitles are permanently visible (cannot be toggled off)
  - Uses aggressive optimization: 540p @ 1.5Mbps with 8-second segments for speed
  - Uses `/master.m3u8` HLS endpoint with TS segments
  - Transcoding is CPU-intensive on server (requires FFmpeg with libass)

- **Image URLs**: `getPosterUrl()`, `getBackdropUrl()`, `hasPoster()`

### Video Player (`app/player.tsx`)

Full-screen modal player with intelligent playback:

1. **Codec & Subtitle Check**: Fetches video details to check codec compatibility and detect external subtitles
2. **Stream Selection**:
   - No subtitles + H.264/HEVC → Direct play (download, fastest)
   - With subtitles (any codec) → HLS transcode with **full H.264 re-encode** + subtitle burn-in
   - No subtitles + unsupported codec → HLS transcode
3. **Automatic Fallback**: If direct play fails, automatically retries with HLS transcoding
4. **Loading States**: Shows codec check → streaming preparation → ready to play
5. **Error Handling**: Detailed error messages with troubleshooting steps for failures
6. **Platform-specific Controls**:
   - iOS: Custom back button overlay
   - tvOS: Menu button closes player (via `useTVEventHandler`)
   - Android TV: Hardware back button support

### TV-Specific Features

The app is optimized for Apple TV:

- **Focus Management**: `isTVSelectable` and `hasTVPreferredFocus` props on interactive elements
- **TV Navigation**: `NativeTabs` for native tab bar with SF Symbols icons
- **Remote Events**: `useTVEventHandler` for Menu button handling
- **Grid Layout**: 5 columns on TV vs 3 on mobile (`Platform.isTV` checks)
- **Type Augmentation**: `types/react-native-tvos.d.ts` adds TV props to TouchableOpacity
- **Multilayer Icons**: tvOS uses parallax 3D icons with front/middle/back layers
  - Icon layers stored in `assets/images/icon/` (front.png, middle.png, back.png)
  - **Manual setup required**: Must be configured in Xcode after `npm run prebuild`
  - See [TVOS_ICONS.md](TVOS_ICONS.md) for complete setup instructions
  - **Important**: Expo's `app.json` does not support automatic multilayer icon generation

### Settings & Configuration

Settings screen (`app/(tabs)/settings.tsx`) manages:
- Jellyfin server IP address (auto-adds http:// and :8096 port if missing)
- API key (from Jellyfin Dashboard → API Keys)
- User ID (from Jellyfin user settings)

All saved to `expo-secure-store` which syncs to iCloud Keychain. After saving, **must call** `refreshConfig()` to update the cached config.

## Important Patterns

### Threading Safety (CRITICAL)
**All React state updates triggered by player event listeners MUST use `InteractionManager.runAfterInteractions()`** to ensure they execute on the main thread. This prevents segmentation faults from Auto Layout violations.

**WRONG - Will crash on corrupted files:**
```typescript
player.addListener('statusChange', (payload) => {
  if (payload.status === 'error') {
    setState({ type: 'ERROR' }); // ❌ Crashes! Running on JS thread
  }
});
```

**CORRECT - Thread-safe:**
```typescript
import { InteractionManager } from 'react-native';

player.addListener('statusChange', (payload) => {
  if (payload.status === 'error') {
    InteractionManager.runAfterInteractions(() => {
      setState({ type: 'ERROR' }); // ✅ Safe! Running on main thread
    });
  }
});
```

**Why This Matters:**
- Player event callbacks execute on the React Native JavaScript thread
- UIKit/Auto Layout operations MUST only run on the main thread
- When corrupted files trigger errors, state updates cause UI changes
- Without `InteractionManager`, you get `EXC_CRASH (SIGABRT)` with `_AssertAutoLayoutOnAllowedThreadsOnly`

**When to Use:**
- ALL player event listeners (`statusChange`, `playingChange`, etc.)
- Any state updates from timers/callbacks that affect UI
- Error handlers that update component state

**Reference Implementation:**
- `hooks/useVideoPlayback.ts:396-491` - Player event listeners
- `app/player.tsx:86-99` - Audio player state updates

### Codec Detection Flow
Always fetch video details before playback to check codec compatibility:
```typescript
const details = await fetchVideoDetails(videoId);
const requiresTranscoding = needsTranscoding(details);
```

### Path Aliases
Use `@/*` imports mapped to project root via `tsconfig.json`:
```typescript
import { fetchVideos } from '@/services/jellyfinApi';
import { JellyfinVideoItem } from '@/types/jellyfin';
```

### Platform-Specific Styling
Use `Platform.isTV` for conditional styles:
```typescript
numColumns: Platform.isTV ? 5 : 3
fontSize: Platform.isTV ? 22 : 18
```

### TV Interactivity
Add TV props to all interactive elements:
```typescript
<TouchableOpacity
  isTVSelectable={true}
  hasTVPreferredFocus={true}
  onPress={handlePress}
>
```

## Known Issues & Limitations

1. **FFmpeg Requirements**: Jellyfin server must have FFmpeg installed with libass support for:
   - Videos with unsupported codecs (MPEG-4, VP8/VP9, AV1, etc.) - requires transcoding
   - Videos with external subtitles - requires subtitle burn-in (even for H.264)

2. **Subtitle Burn-in**: External subtitles require full video transcode (CPU-intensive). Users cannot:
   - Toggle subtitles on/off
   - Switch between different subtitle tracks
   - Videos with subtitles will take longer to start (transcoding delay)

3. **react-native-tvos Fork**: Using community fork `react-native-tvos@0.81.4-0` which is excluded from Expo's install command (see `expo.install.exclude` in package.json).

4. **Patch Package**: Custom patches applied via `patch-package` on postinstall. Patches stored in `patches/` directory.

## Fixed Issues

### Threading Crash on Corrupted Files (Partial Fix)
**Issue**: App crashed with `EXC_CRASH (SIGABRT)` segmentation fault when playing corrupted video files.

**Root Cause**: Player event listeners were updating React state on the JavaScript thread, triggering Auto Layout operations that must only run on the main thread. The crash occurred in `_AssertAutoLayoutOnAllowedThreadsOnly` when corrupted files triggered error events.

**Fix**: All state updates from player event listeners now use `InteractionManager.runAfterInteractions()` to ensure execution on the main thread. See **Threading Safety** pattern above.

**Files Changed**:
- `hooks/useVideoPlayback.ts` - Wrapped all `dispatch()` calls in player listeners
- `app/player.tsx` - Wrapped `setIsPlaying()` in audio player listener

**Limitation**: This fixes crashes from event callbacks, but some corrupted files may still crash during native player initialization before JavaScript can handle the error. For deeply corrupted files, the best solution is to fix or remove them from the Jellyfin library.

**Manual Testing**: Play corrupted files to verify error handling without crashes

## File-Based Routing

Expo Router uses file-based routing:
- `app/(tabs)/` = Tab group at root level
- `app/player.tsx` = Modal screen (presentation: 'fullScreenModal')
- `(tabs)` = Route group (doesn't appear in URL)
- `_layout.tsx` = Layout wrapper for child routes

Navigation: `router.push('/player')` or `router.back()`

## Testing

### Test Setup
- **Test Framework**: Jest with `jest-expo` preset
- **Test Location**: Tests live in `__tests__` folders next to source files
  - `hooks/__tests__/` - Hook tests
  - `services/__tests__/` - Service tests
  - `app/__tests__/` - Component tests
- **Configuration**: `jest.config.js` with path alias support (`@/*`)
- **Setup File**: `jest.setup.js` - Global mocks and test utilities

### Running Tests
```bash
npm test                              # Run all tests
npm test -- hooks/__tests__/          # Run specific test directory
npm test -- --watch                   # Watch mode
npm test -- --coverage                # Generate coverage report
```

### Important: NO --legacy-peer-deps
**NEVER use `--legacy-peer-deps` when installing dependencies.** This project uses `react-native-tvos@0.81.4-0` which has specific peer dependency requirements. Using `--legacy-peer-deps` can break the tvOS fork compatibility.

### Manual Testing for Threading Safety
The app previously crashed with `EXC_CRASH (SIGABRT)` when corrupted files triggered error events, because Auto Layout operations were happening on the React Native JavaScript thread instead of the main thread.

**To verify the threading fix:**
1. Play a corrupted video file
2. Verify app shows error message (not crash)
3. Play an audio file and toggle play/pause
4. Navigate back while playing
5. No crashes should occur in any scenario

All state updates from player event listeners are wrapped in `InteractionManager.runAfterInteractions()` to ensure they execute on the main thread.

### Test Mocks
`jest.setup.js` provides global mocks for:
- `expo-secure-store` - Secure storage
- `expo-video` - Video player
- `InteractionManager` - Threading safety (executes callbacks immediately in tests)
- Console methods - Reduced noise in test output

## Configuration Files

- `app.json`: Expo config with iOS bundle ID, TV support, splash screen, plugins
- `tsconfig.json`: TypeScript config with strict mode and path aliases
- `package.json`: Scripts, dependencies, and react-native exclusion rule
- `eslint.config.js`: ESLint configuration (expo lint)
- `jest.config.js`: Jest test configuration with path aliases
- `jest.setup.js`: Global test mocks and utilities
