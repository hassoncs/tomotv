# CLAUDE.md

**Last Updated:** January 24, 2026

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TomoTV** is a cross-platform video streaming application that connects to a Jellyfin media server. Built with React Native TVOS and Expo, it supports iOS, Android, Apple TV, and web platforms. The app intelligently handles video codecs, automatically transcoding unsupported formats while direct-playing compatible ones.

## WORKFLOW & DECISION-MAKING RULES

⚠️ **CRITICAL:** Follow these rules ALWAYS to prevent wasted time and going in circles.

### Communication Format

**Visual Padding:**

- Add 10 blank lines BEFORE my response text
- Add 10 blank lines AFTER my response text
- Provides visual breathing room in terminal output

### First Message Protocol

**When you give me a new task, I will ALWAYS:**

1. **Understand the task**
   - Restate it in my own words
   - Identify affected files/systems
   - Ask clarifying questions if ambiguous

2. **Check prerequisites**
   - Do I need to read files first?
   - Is this a codebase exploration task? (use Task tool)
   - Are there related CLAUDE-\*.md files to load?

3. **Present my approach**
   - "Should I: [1, 2, 3]?"
   - Platform context if relevant (iOS/tvOS native)
   - List files I'll read/change
   - **ALWAYS ask for confirmation** (don't assume)

4. **Wait for confirmation, then execute**

### Plan Presentation Template

**When presenting implementation plans:**

**Format:**

- Maximum 2 paragraphs of explanation
- Use bulleted lists for steps
- Use checkboxes for action items
- NO code snippets (unless absolutely critical to understanding)
- NO diffs or large code blocks

**Example Good Plan:**

```
I'll implement the video thumbnail caching system using expo-file-system.

**Approach:**
- Create `ThumbnailCache` service in `services/` folder
- Add 3 methods: get(), set(), clear()
- Hook into `VideoGridItem` to check cache before fetching
- Add cache expiration (7 days TTL)

**Files to modify:**
- [ ] Create `services/thumbnailCache.ts`
- [ ] Update `components/VideoGridItem.tsx` (add cache check)
- [ ] Update `services/jellyfinApi.ts` (cache integration)

Should I proceed with this approach?
```

**Example Bad Plan:**

- ❌ Showing full function implementations
- ❌ Showing before/after diffs
- ❌ Multi-page code snippets
- ❌ "Here's the code I'll add: [50 lines]"

### Efficiency First

**Before starting ANY task:**

1. **Read files first** - Use Read tool to understand current implementation
2. **Use Task tool for exploration** - Don't grep/glob manually for codebase questions
3. **Batch tool calls** - Multiple independent reads/searches in single message
4. **Ask once, implement once** - Get full requirements before coding

**When NOT to ask:**

- Obvious bugs with clear fixes
- User gave explicit, detailed instructions
- Single-file changes with no architectural impact

### Tool Selection Matrix

| Scenario                         | Tool            | Why                                 |
| -------------------------------- | --------------- | ----------------------------------- |
| "Where is X implemented?"        | Task (Explore)  | **ALWAYS use this - be aggressive** |
| "Read this specific file"        | Read            | Direct, no overhead                 |
| "Find all uses of function Y"    | Grep            | Exact matches, fast                 |
| "Understand how feature Z works" | Task (Explore)  | **ALWAYS use this - be aggressive** |
| "How does the codebase work?"    | Task (Explore)  | **ALWAYS use this - be aggressive** |
| Need to edit multiple files      | Edit (parallel) | Batch edits in one message          |

**Exploration Policy:**

- **BE AGGRESSIVE** with Task (Explore) tool for codebase questions
- Don't ask permission - just use it
- Only use manual Grep/Glob when you need exact file paths
- Task tool is faster and more comprehensive

### Platform Context

- **Primary Platform:** iOS/tvOS (React Native TVOS, Swift, AVPlayer, HLS)
- **State platform upfront** in every technical discussion
- **Remember:** Native behavior ≠ web behavior
- AVPlayer is the native video player (not web player)
- HLS manifest rules follow Apple's implementation (not generic HLS)
- Swift modules require rebuild via `npm run prebuild:tv`

### Research-First Protocol

1. ✅ **Read official documentation** (Apple HLS Authoring Spec, RFC 8216, library docs)
2. ✅ **Inspect actual source code files** before proposing changes
3. ✅ **Search for real-world examples** and known issues
4. ❌ **NEVER propose solutions based on assumptions alone**

**Example:**

- Before modifying HLS manifest generation, read Apple's HLS Authoring Specification
- Before changing Swift code, inspect the current implementation in `native/ios/`
- Before assuming iOS behavior, verify with official Apple documentation

### Decision Confirmation Protocol

- **ASK before committing** to technical approaches
- **Present options with evidence:** spec quotes, code snippets, research findings
- **User confirms direction** → THEN implement
- Don't iterate blindly on failed approaches

**Decision Thresholds (Ask vs Proceed):**

**MUST ASK:**

- Changes affecting >3 files
- Breaking changes to public APIs
- New dependencies (npm packages)
- Platform-specific behavior uncertainty
- Multiple valid approaches with tradeoffs

**CAN PROCEED:**

- Single-file bug fixes
- Adding tests for existing code
- Refactoring with identical behavior
- Documentation updates
- Obvious type errors

### Anti-Loop Protection

- **Track failed approaches** internally (mental checklist)
- **NEVER retry the same solution twice** without new evidence
- **After 2-3 failed attempts:** STOP, ask user for guidance
- **If context seems lost:** read relevant CLAUDE.md sections to regain context

**Red Flags:**

- "Let me try X again" (if X already failed)
- "Maybe if we adjust Y slightly" (without understanding why Y failed)
- Proposing solutions without reading specs/code

### Context Recovery Protocol

**If I seem to have lost context (repeating questions, forgetting decisions):**

1. **STOP immediately**
2. **Ask:** "What was our last confirmed decision?"
3. **Re-read relevant CLAUDE-\*.md files**
4. **Summarize understanding** before proceeding

**Signs of lost context:**

- Asking about already-discussed topics
- Proposing solutions we already rejected
- Forgetting platform constraints (iOS/tvOS)
- Repeating the same questions

### Code Inspection Requirements

- **Read implementation files BEFORE editing**
- **Understand current behavior first** (trace execution paths)
- **Test assumptions with actual code**, not theories
- Trace execution through multiple files if needed (e.g., TypeScript → Swift → AVPlayer)

**Full File Reading Policy:**

- **ALWAYS read FULL files** - never sample sections
- If file is too large for single read:
  - Split into minimum readable chunks (use offset/limit parameters)
  - Read ALL chunks sequentially to see complete file
- NO partial file reads unless you've read the full file first
- Be aware of ENTIRE file contents before proposing changes

**Workflow:**

1. Identify files involved in the feature
2. Read actual implementation code (FULL files)
3. Understand data flow and state management
4. Propose changes based on code reality

### Code Quality Standards

**Always:**

- Type safety (no `any` types without explicit justification)
- Error handling (try-catch around async operations)
- Cleanup (useEffect cleanup, unsubscribe functions)
- Comments only where logic isn't self-evident

**Never:**

- Over-engineering (don't add features not requested)
- Premature abstraction (3 uses before extracting helper)
- Backwards compatibility hacks (delete unused code completely)
- Scale animations on grid items (performance rule)

### Task Completion Checklist

**Before marking task complete:**

- [ ] Code works (tested or high confidence)
- [ ] No console errors/warnings introduced
- [ ] Types compile (no TypeScript errors)
- [ ] Follows existing patterns (read similar code first)
- [ ] User's EXACT request satisfied (not what I think they need)

**Don't add unless requested:**

- Tests (unless fixing a bug)
- Comments (unless logic is complex)
- Extra features (scope creep)

### Memory Bank Usage

**I automatically load these files when you mention:**

**Implementation Details:**

- "API" / "jellyfinApi" / "functions" → `memories/CLAUDE-api-reference.md`
- "state" / "manager" / "context" → `memories/CLAUDE-state-management.md`
- "audio tracks" / "multi-audio" → `memories/CLAUDE-multi-audio.md`
- "config" / "credentials" / "SecureStore" → `memories/CLAUDE-configuration.md`
- "pattern" / "how do I" / "example" → `memories/CLAUDE-patterns.md`
- "external" / "expo-tvos-search" / "dependencies" → `memories/CLAUDE-external-dependencies.md`
- "lessons" / "bug" / "debugging" → `memories/CLAUDE-lessons-learned.md`

**Testing & Components:**

- "testing" / "tests" / "coverage" / "jest" → `memories/CLAUDE-testing.md`
- "components" / "UI" / "design system" → `memories/CLAUDE-components.md`

**Security & Performance:**

- "security" / "audit" / "vulnerability" → `memories/CLAUDE-security.md`
- "performance" / "optimization" / "slow" → `memories/CLAUDE-app-performance.md`

**Development & Deployment:**

- "setup" / "install" / "development" → `memories/CLAUDE-development.md`
- "icons" / "tvOS icons" / "top shelf" → `memories/CLAUDE-tvos-icons.md`
- "App Store" / "metadata" / "screenshots" → `memories/CLAUDE-apple-store-metadata.md`
- "submission" / "checklist" / "release" → `memories/CLAUDE-apple-store-checklist.md`

**Other:**

- "image" / "vision" / "screenshot analysis" → `memories/CLAUDE-image-analysis.md`
- "Jellyfin API" / "server API" → Official API docs at <https://api.jellyfin.org/openapi/jellyfin-openapi-stable.json>

**You DON'T need to tell me to read these files.**

### Category-Based Loading

**When you need all files in a category:**

**Implementation (8 files):**

- "implementation files" / "all implementation docs" → Load: api-reference, state-management, multi-audio, configuration, patterns, external-dependencies, lessons-learned, components

**Testing (1 file):**

- "testing files" / "test documentation" → Load: testing

**Security (1 file):**

- "security files" / "security docs" → Load: security

**Performance (1 file):**

- "performance files" / "performance docs" → Load: app-performance

**Deployment (4 files):**

- "deployment files" / "deployment docs" / "App Store docs" → Load: development, tvos-icons, apple-store-metadata, apple-store-checklist

**Complete Context:**

- "all memory files" / "complete documentation" → Load all 16 memory bank files

### Lessons Learned

See `memories/CLAUDE-lessons-learned.md` for detailed case studies of bugs and issues encountered during development.

**Auto-Append Policy:**

- After resolving a significant bug/issue, I will **automatically append** a new lesson to `memories/CLAUDE-lessons-learned.md`
- Uses the template format in that file
- Captures: problem, root cause, solution, what went wrong, what worked
- No need to ask permission - just document it

**Most Recent:**

- **Audio Track Label Bug (January 2026):** iOS prioritizes LANGUAGE over NAME in HLS manifests. Solution: Omit LANGUAGE for "und" tracks.

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

### Native Code Development

**CRITICAL: Always edit files in `native/` folder, NOT `ios/` or `android/` folders!**

The `native/` folder contains the source files for native Swift/Kotlin modules:

```
native/
└── ios/
    └── MultiAudioResourceLoader/
        ├── HLSManifestGenerator.swift     # ← Edit this
        ├── HLSManifestParser.swift
        ├── MultiAudioResourceLoader.swift
        └── RNVideoPlugin.swift
```

**Why:**

- `npm run prebuild:tv` **deletes and regenerates** the `ios/` and `android/` folders
- Native source files are copied from `native/ios/` → `ios/` during prebuild
- Any edits to `ios/` directly will be **lost** on next prebuild

**Workflow:**

1. Edit files in `native/ios/MultiAudioResourceLoader/`
2. Run `npm run prebuild:tv` to copy changes to `ios/`
3. Run `npm run ios` to rebuild and test

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
- **expo-tvos-search** 1.3.1 - Native tvOS search UI (separate repo)

**External Dependencies:** See `memories/CLAUDE-external-dependencies.md` for details on `expo-tvos-search` and other external packages.

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

**Details:** See `memories/CLAUDE-patterns.md` for state flow diagram and implementation details.

### Error Classification System

**PlaybackErrorType Enum:**

| Error Type       | Description                               | Recovery Strategy               |
| ---------------- | ----------------------------------------- | ------------------------------- |
| `METADATA_FETCH` | Failed to fetch video details from server | User retry only                 |
| `STREAM_URL`     | Failed to generate stream URL             | User retry only                 |
| `PLAYBACK`       | Video player initialization failed        | **Auto-retry with transcoding** |
| `NETWORK`        | Network timeout or connection error       | User retry only                 |
| `UNKNOWN`        | Unclassified errors                       | User retry only                 |

**Auto-Retry Logic:**

- Only `PLAYBACK` errors trigger automatic retry
- First attempt: Direct play (if codec H.264/HEVC)
- Second attempt: Transcoding (if first attempt fails)
- Maximum 1 auto-retry per video session
- Prevents infinite retry loops

#### 3. Jellyfin API Integration

Single service for all Jellyfin communication with retry logic, timeouts, and configuration caching.

**Details:** See `memories/CLAUDE-api-reference.md` for complete function reference.

#### 4. Codec & Streaming Strategy

- **Direct Play:** H.264, HEVC (natively supported on iOS/tvOS)
- **Transcoding:** All other codecs (MPEG-4, VP8, VP9, AV1, VC-1, MPEG-2, DivX, Xvid)
- **HLS Master.m3u8:** Primary transcoding endpoint with adaptive bitrate
- **Direct Download:** Fallback for direct-compatible files
- **Subtitle Handling:** Both external (.srt) and embedded subtitle tracks included in HLS manifest as toggleable WebVTT streams via SubtitleMethod=Hls

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

The app uses a **Singleton Manager + Context wrapper** pattern for global state.

**Details:** See `memories/CLAUDE-state-management.md` for architecture diagram and complete API reference.

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

#### 9. Multi-Audio Track Switching

**Key Feature:** Seamless multi-audio track switching during transcoding using a custom Swift native module with multivariant HLS manifest generation.

**Details:** See `memories/CLAUDE-multi-audio.md` for technical implementation and Swift module architecture.

## Configuration Management

The app uses a smart fallback system for credentials and settings.

**Details:** See `memories/CLAUDE-configuration.md` for:

- Development vs production configuration
- Demo mode implementation
- SecureStore keys reference
- Configuration migration
- Environment variables
- Security considerations
- Settings screen patterns

## Common Development Patterns

**Details:** See `memories/CLAUDE-patterns.md` for:

- Adding new screens
- Adding new API methods
- Video playback implementation
- Custom React hooks usage
- Logging patterns
- Search implementation

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

See `memories/CLAUDE-tvos-icons.md` for detailed tvOS icon setup, folder structure, naming requirements, and common validation errors.

## Known Issues & Limitations

1. **Codec Support:** Only H.264 and HEVC are direct-played; all others require transcoding
2. **Network:** HTTP connections limited to local networks; public Jellyfin servers must use HTTPS
3. **Jellyfin Only:** Only works with Jellyfin servers (not Plex, Emby, etc.)

## Additional Resources

### Implementation Details

- `memories/CLAUDE-api-reference.md` - Complete API function reference
- `memories/CLAUDE-state-management.md` - State management architecture
- `memories/CLAUDE-multi-audio.md` - Multi-audio track switching feature
- `memories/CLAUDE-configuration.md` - Configuration and credential management
- `memories/CLAUDE-patterns.md` - Common development patterns
- `memories/CLAUDE-external-dependencies.md` - External packages and repositories
- `memories/CLAUDE-lessons-learned.md` - Bug case studies and debugging lessons

### Component & Testing Documentation

- `memories/CLAUDE-components.md` - UI component documentation
- `memories/CLAUDE-testing.md` - Testing strategy and coverage analysis

### Security & Performance

- `memories/CLAUDE-security.md` - Security architecture and audit findings
- `memories/CLAUDE-app-performance.md` - Performance optimization notes

### Apple Store & Development

- `memories/CLAUDE-tvos-icons.md` - Apple TV icon guidelines
- `memories/CLAUDE-apple-store-metadata.md` - App Store copy and metadata
- `memories/CLAUDE-apple-store-checklist.md` - Submission checklist
- `memories/CLAUDE-development.md` - Development setup guide

### Other Resources

- `memories/CLAUDE-image-analysis.md` - Image analysis skill
- `.env.example` - Environment variable template

## RULES

1. Unless intentionally, DO NOT run commands on the `node_modules` directory
   - Stop searching node_modules unless required to inspect current lib implementation

2. Plausible explanation for the observed behavior is NEVER an accepted solution, always confirm or research unknown facts, assumtion is not allowed
