# RadmediaTV

Custom Apple TV media and smart home application. Forked from [keiver/radmedia](https://github.com/keiver/radmedia).

**Project Status:** Jellyfin client (MVP) → Media discovery (Seerr) → Smart home (HA) → AI SDUI.

## Project Overview

RadmediaTV is a video streaming application optimized for Apple TV (tvOS). It connects to a Jellyfin media server and intelligently handles video playback by direct-playing compatible formats (H.264, HEVC) and automatically transcoding unsupported ones.

## Tech Stack

- **Framework:** Expo 54 (React Native tvOS 0.81.4-0)
- **Routing:** Expo Router 6.0.14 (File-based)
- **Playback:** react-native-video 6.19.0 / Expo Video 3.0.14
- **Language:** TypeScript 5.9.2
- **Native:** Swift (MultiAudioResourceLoader), SwiftUI (expo-tvos-search)

## Project Structure

| Directory | Description |
|-----------|-------------|
| `app/` | Expo Router screens and file-based routes |
| `components/` | Reusable UI components (VideoGridItem, VideoShelf) |
| `contexts/` | React Context providers and singleton manager wrappers |
| `hooks/` | Custom hooks (useVideoPlayback, useAppStateRefresh) |
| `services/` | API integration (Jellyfin) and singleton state managers |
| `native/` | **Source of truth** for native Swift/Kotlin modules |
| `memories/` | Project-specific documentation and lessons learned |
| `plugins/` | Expo config plugins |
| `types/` | TypeScript type definitions |
| `utils/` | Utility functions (logger, retry, formatting) |

## Build & Dev Commands

```bash
npm install           # Install dependencies
npm start             # Start Expo dev server
npm run prebuild:tv   # Regenerate native projects (sets EXPO_TV=1)
npm run ios           # Build and run on Apple TV simulator
npm test              # Run Jest test suite
npm run lint          # Run ESLint and Prettier check
```

### Deploying to Apple TV (Living Room)

**MANDATORY:** After ANY native code change (Swift, Objective-C, CocoaPods, prebuild), always build and deploy to the physical Apple TV. JS-only changes hot-reload via Metro automatically — no rebuild needed.

```bash
# 1. Prebuild (regenerates ios/ from native/)
EXPO_TV=1 expo prebuild --clean

# 2. Build for device (xcodebuild uses its own device ID, not the CoreDevice UUID)
xcodebuild -workspace ios/RadMedia.xcworkspace -scheme RadMedia \
  -destination 'id=96e38ba14a39565bc83898eb7adcc66436e640d3' \
  -configuration Debug build

# 3. Install on Apple TV (devicectl uses the CoreDevice UUID)
xcrun devicectl device install app \
  --device 3E2E1550-1549-58F4-8690-DA1CDA2BB713 \
  ~/Library/Developer/Xcode/DerivedData/RadMedia-*/Build/Products/Debug-appletvos/RadMedia.app

# 4. Launch
xcrun devicectl device process launch \
  --device 3E2E1550-1549-58F4-8690-DA1CDA2BB713 \
  com.hasson.radmedia
```

**Device:** Apple TV Living Room
- **CoreDevice UUID (devicectl):** `3E2E1550-1549-58F4-8690-DA1CDA2BB713`
- **xcodebuild destination ID:** `96e38ba14a39565bc83898eb7adcc66436e640d3`
**Bundle ID:** `com.hasson.radmedia` (simulator) / `com.hassoncs.radbot` (physical device via TestFlight)
**Scheme:** `RadMedia` (workspace: `ios/RadMedia.xcworkspace`)

## Key Architecture Patterns

- **File-based Routing:** Uses `NativeTabs` for an optimized tvOS tab experience.
- **State Management:** Singleton Manager + Context wrapper pattern for global state.
- **Streaming Strategy:** Direct Play first for H.264/HEVC; HLS Transcode fallback for others.
- **Native Modules:** Custom Swift modules for multi-audio track switching and native search.
- **CRITICAL:** Always edit files in `native/`, NOT `ios/`. The `ios/` folder is deleted and regenerated during `prebuild:tv`.

## Git Workflow

- **Origin:** `github.com/hassoncs/radmedia` (Our fork)
- **Upstream:** `github.com/keiver/radmedia` (Original)
- **Sync Upstream:** `git fetch upstream && git merge upstream/main`
- **Commits:** Conventional format (`feat:`, `fix:`, `chore:`, `docs:`)

## Environment Configuration

Create a `.env.local` file for development:
- `EXPO_PUBLIC_DEV_JELLYFIN_SERVER`: `http://jellyfin.lan:8096` (IP: `192.168.1.202`)
- `EXPO_PUBLIC_DEV_API_KEY`: Your Jellyfin API Key
- `EXPO_PUBLIC_DEV_USER_ID`: Your Jellyfin User ID

## Roadmap

- **Phase 1 (MVP):** Jellyfin library browser and playback (Current)
- **Phase 2:** Seerr integration for media discovery and requests
- **Phase 3:** Home Assistant bridge for smart home control
- **Phase 4:** AI-powered Server-Driven UI (SDUI)

## Coding Style

- **TypeScript:** Strict mode, no `any` without justification.
- **Formatting:** 2-space indent, single quotes, semicolons.
- **Naming:** `PascalCase` for components/hooks, `camelCase` for services/utils.
- **Styles:** Prefer `StyleSheet.create` located beside the component.

## Testing

- **Framework:** Jest via `jest-expo`.
- **Location:** `__tests__` directories mirroring the target file.
- **Target:** ≥80% statement coverage.
- **Tools:** `react-test-renderer` for hooks and contexts.
