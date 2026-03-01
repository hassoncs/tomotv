# TommoTV

Custom Apple TV media and smart home application. Forked from [keiver/tomotv](https://github.com/keiver/tomotv).

**Project Status:** Jellyfin client (MVP) → Media discovery (Seerr) → Smart home (HA) → AI SDUI.

## Project Overview

TommoTV is a video streaming application optimized for Apple TV (tvOS). It connects to a Jellyfin media server and intelligently handles video playback by direct-playing compatible formats (H.264, HEVC) and automatically transcoding unsupported ones.

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

## Key Architecture Patterns

- **File-based Routing:** Uses `NativeTabs` for an optimized tvOS tab experience.
- **State Management:** Singleton Manager + Context wrapper pattern for global state.
- **Streaming Strategy:** Direct Play first for H.264/HEVC; HLS Transcode fallback for others.
- **Native Modules:** Custom Swift modules for multi-audio track switching and native search.
- **CRITICAL:** Always edit files in `native/`, NOT `ios/`. The `ios/` folder is deleted and regenerated during `prebuild:tv`.

## Git Workflow

- **Origin:** `github.com/hassoncs/tomotv` (Our fork)
- **Upstream:** `github.com/keiver/tomotv` (Original)
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
