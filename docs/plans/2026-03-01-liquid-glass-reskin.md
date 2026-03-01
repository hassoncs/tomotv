# TommoTV Liquid Glass + Plex-Style Reskin

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform TommoTV from a simple grid-based Jellyfin browser into a cinematic, Plex-like media experience with Apple's Liquid Glass design language.

**Architecture:** Replace the flat poster grid with a hero billboard + horizontal shelf layout (like Plex/Apple TV app). Apply Liquid Glass via `@callstack/liquid-glass` to all chrome surfaces (tab bar, overlays, controls, metadata panels). Add backdrop blur with dynamic color extraction for immersive full-screen visuals. All changes are purely UI/styling — no API or playback logic changes.

**Tech Stack:** React Native tvOS 0.81.4, Expo 54, `@callstack/liquid-glass` 0.7.0, `expo-blur`, `expo-image`, `react-native-reanimated` (for transitions)

---

## Current State

The app currently has:
- **Library screen:** 5-column grid of 2:3 portrait poster cards with `BlurView` info overlay on focus
- **Tab bar:** `NativeTabs` with `blurEffect="systemChromeMaterial"` (already glass-like)
- **Player:** Native `react-native-video` controls + custom `UpNextOverlay`
- **Settings/Help:** Standard form layouts with dark backgrounds
- **Colors:** `#1C1C1E` (bg), `#2C2C2E` (cards), `#FFC312` (accent), `#98989D` (muted text)
- **Design constants:** `constants/app.ts` with border radius values

## Target State (Plex-Inspired + Liquid Glass)

Think: Apple TV app meets Plex. Full-screen backdrops, horizontal shelves, glass overlays that refract content beneath them.

---

## Phase 1: Foundation — Install Dependencies & Design Tokens

### Task 1.1: Install `@callstack/liquid-glass`

**Files:**
- Modify: `package.json`

**Step 1: Install the package**
```bash
cd tomotv && npm install @callstack/liquid-glass
```

**Step 2: Rebuild native project**
```bash
EXPO_TV=1 npx expo prebuild --platform ios --clean
```

**Step 3: Verify import works**
Create a quick smoke test — import `isLiquidGlassSupported` in `app/_layout.tsx` and log it.

**Step 4: Commit**
```
feat: install @callstack/liquid-glass
```

---

### Task 1.2: Create Design Token System

**Files:**
- Create: `constants/theme.ts`
- Modify: `constants/app.ts` (re-export from theme)

**Step 1: Create `constants/theme.ts`**

This replaces scattered hardcoded colors with a centralized token system that supports Liquid Glass.

```typescript
import { isLiquidGlassSupported } from "@callstack/liquid-glass";

export const COLORS = {
  // Backgrounds
  background: "#0A0A0A",          // Darker than current #1C1C1E for better glass contrast
  backgroundElevated: "#1C1C1E",  // Cards, panels
  backgroundCard: "#2C2C2E",      // Fallback card bg when no poster

  // Glass
  glassTint: "rgba(255, 255, 255, 0.06)",
  glassTintFocused: "rgba(255, 255, 255, 0.12)",
  glassTintAccent: "rgba(255, 195, 18, 0.08)",

  // Accent
  accent: "#FFC312",
  accentMuted: "rgba(255, 195, 18, 0.5)",

  // Text
  textPrimary: "#FFFFFF",
  textSecondary: "#98989D",
  textTertiary: "#636366",

  // Semantic
  error: "#FF3B30",
  success: "#30D158",

  // Borders
  borderSubtle: "rgba(255, 255, 255, 0.08)",
  borderFocused: "rgba(255, 195, 18, 0.4)",
} as const;

export const SPACING = {
  screenPadding: 80,    // Left/right padding for TV content
  sectionGap: 48,       // Gap between shelves/sections
  shelfItemGap: 20,     // Gap between items in a horizontal shelf
  cardPadding: 16,
} as const;

export const TYPOGRAPHY = {
  heroTitle: { fontSize: 56, fontWeight: "800" as const, letterSpacing: -1 },
  heroSubtitle: { fontSize: 24, fontWeight: "500" as const },
  sectionTitle: { fontSize: 32, fontWeight: "700" as const },
  cardTitle: { fontSize: 20, fontWeight: "600" as const },
  body: { fontSize: 22, fontWeight: "400" as const },
  caption: { fontSize: 18, fontWeight: "400" as const },
} as const;

export const GLASS = {
  isSupported: isLiquidGlassSupported,
  fallbackBlurIntensity: 60,
  fallbackBlurTint: "dark" as const,
} as const;
```

**Step 2: Commit**
```
feat: add centralized design token system for liquid glass reskin
```

---

### Task 1.3: Create `SmartGlassView` Wrapper Component

**Files:**
- Create: `components/SmartGlassView.tsx`

This is the foundational component — wraps `LiquidGlassView` with automatic fallback to `BlurView` on unsupported hardware.

```typescript
import { LiquidGlassView, isLiquidGlassSupported } from "@callstack/liquid-glass";
import { BlurView } from "expo-blur";
import { GLASS } from "@/constants/theme";
import { StyleProp, ViewStyle } from "react-native";

interface SmartGlassViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  effect?: "regular" | "clear";
  tintColor?: string;
  interactive?: boolean;
}

export function SmartGlassView({
  children,
  style,
  effect = "regular",
  tintColor,
  interactive = false,
}: SmartGlassViewProps) {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView
        effect={effect}
        tintColor={tintColor}
        interactive={interactive}
        style={style}
      >
        {children}
      </LiquidGlassView>
    );
  }

  return (
    <BlurView
      intensity={GLASS.fallbackBlurIntensity}
      tint={GLASS.fallbackBlurTint}
      style={style}
    >
      {children}
    </BlurView>
  );
}
```

**Step 3: Commit**
```
feat: add SmartGlassView with automatic liquid glass/blur fallback
```

---

## Phase 2: Hero Billboard — The Signature Plex Feature

This is the biggest visual change. Replace the flat grid at the top with a full-screen hero image that showcases a featured item, with metadata overlay on glass.

### Task 2.1: Create `HeroBillboard` Component

**Files:**
- Create: `components/HeroBillboard.tsx`

The hero billboard is a full-width, ~60% screen height section showing:
- Full-screen backdrop image (landscape/fanart if available, poster fallback)
- Gradient fade from image to background at bottom
- Title + metadata on a glass panel (bottom-left)
- "Play" and "More Info" buttons

```typescript
// Key structure:
// <View style={fullWidth, 60vh}>
//   <Image source={backdropUrl} style={absoluteFill} />
//   <LinearGradient from transparent to background />
//   <SmartGlassView style={bottomLeft, metadataPanel}>
//     <Text style={heroTitle}>{title}</Text>
//     <Text style={heroSubtitle}>{year} • {genre} • {duration}</Text>
//     <View style={buttonRow}>
//       <FocusableButton title="Play" variant="primary" />
//       <FocusableButton title="More Info" variant="secondary" />
//     </View>
//   </SmartGlassView>
// </View>
```

**API needed from Jellyfin:**
- Backdrop image: `/Items/{id}/Images/Backdrop?api_key=...&maxWidth=1920`
- The `JellyfinItem` already has `BackdropImageTags` — check if populated

**Step 1: Add `getBackdropUrl` helper to `jellyfinApi.ts`**
```typescript
export function getBackdropUrl(itemId: string, maxWidth = 1920): string {
  if (!cachedConfig.server || !cachedConfig.apiKey) return "";
  return `${cachedConfig.server}/Items/${itemId}/Images/Backdrop?api_key=${cachedConfig.apiKey}&maxWidth=${maxWidth}`;
}
```

**Step 2: Build the `HeroBillboard` component**
- Uses `expo-image` for the backdrop
- Uses `expo-linear-gradient` for the bottom fade
- Uses `SmartGlassView` for the metadata panel
- Accepts a `JellyfinItem` and `onPlay`/`onInfo` callbacks
- Focus should land on the "Play" button by default

**Step 3: Add billboard rotation**
- Accept an array of featured items
- Auto-rotate every 8 seconds (or on swipe left/right)
- Crossfade transition between items

**Step 4: Commit**
```
feat: add HeroBillboard component with backdrop, glass metadata, and auto-rotation
```

---

### Task 2.2: Create `VideoShelf` Horizontal Scroll Component

**Files:**
- Create: `components/VideoShelf.tsx`

Plex's signature UI: a section title + horizontally scrolling row of poster cards.

```typescript
// Structure:
// <View>
//   <Text style={sectionTitle}>{title}</Text>  // "Continue Watching", "Recently Added", etc.
//   <FlatList
//     horizontal
//     data={items}
//     renderItem={({ item }) => <ShelfCard item={item} />}
//     showsHorizontalScrollIndicator={false}
//     snapToInterval={cardWidth + gap}
//   />
// </View>
```

**Key behaviors:**
- Horizontal `FlatList` with snap-to-item scrolling
- Cards are 2:3 portrait posters (reuse existing poster logic)
- On focus: card scales up slightly (1.08x via `magnification` prop on tvOS)
- Section title fades/shifts when shelf is focused
- Shelf auto-scrolls to keep focused item centered

**Step 1: Build `ShelfCard` sub-component**
- Similar to current `VideoGridItem` but horizontal layout optimized
- On focus: show title below card (not overlaid)
- Glass info overlay is optional (toggled by shelf type)

**Step 2: Build `VideoShelf` container**
- Props: `title: string`, `items: JellyfinItem[]`, `onItemPress`, `cardStyle?: "poster" | "landscape"`
- Poster style: 2:3 ratio (movies, shows)
- Landscape style: 16:9 ratio (episodes, continue watching)

**Step 3: Commit**
```
feat: add VideoShelf horizontal scroll component with poster and landscape card styles
```

---

### Task 2.3: Redesign Library Screen with Billboard + Shelves

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `services/jellyfinApi.ts` (add shelf data fetching)

**Step 1: Add API helpers for shelf data**

Add to `jellyfinApi.ts`:
```typescript
// Fetch "Recently Added" items
export async function getRecentlyAdded(limit = 20): Promise<JellyfinItem[]> { ... }

// Fetch "Continue Watching" (resume items)
export async function getContinueWatching(): Promise<JellyfinItem[]> { ... }

// Fetch "Next Up" (next episode in series)
export async function getNextUp(limit = 20): Promise<JellyfinItem[]> { ... }

// Fetch items by genre
export async function getByGenre(genre: string, limit = 20): Promise<JellyfinItem[]> { ... }
```

Jellyfin API endpoints:
- Recently Added: `GET /Users/{userId}/Items/Latest?Limit=20&Fields=...`
- Resume: `GET /Users/{userId}/Items/Resume?MediaTypes=Video&Limit=20`
- Next Up: `GET /Shows/NextUp?UserId={userId}&Limit=20`
- By Genre: `GET /Users/{userId}/Items?GenreIds={id}&Recursive=true&Limit=20`

**Step 2: Redesign the library screen layout**

Replace the current `FlatList` grid with:
```
<ScrollView vertical>
  <HeroBillboard items={featured} onPlay={handlePlay} />

  {continueWatching.length > 0 && (
    <VideoShelf title="Continue Watching" items={continueWatching} cardStyle="landscape" />
  )}

  {nextUp.length > 0 && (
    <VideoShelf title="Next Up" items={nextUp} cardStyle="landscape" />
  )}

  <VideoShelf title="Recently Added" items={recentlyAdded} cardStyle="poster" />

  <VideoShelf title="Movies" items={movies} cardStyle="poster" />
  <VideoShelf title="TV Shows" items={tvShows} cardStyle="poster" />
</ScrollView>
```

**Step 3: Keep the grid view for folder navigation**

When user drills into a folder/show/season, switch back to a grid layout (current behavior). The billboard+shelf layout is only for the root library view.

**Step 4: Commit**
```
feat: redesign library screen with hero billboard and horizontal shelves
```

---

## Phase 3: Liquid Glass Chrome — Overlays, Controls, Navigation

### Task 3.1: Glass Metadata Overlay on Poster Cards

**Files:**
- Modify: `components/video-grid-item.tsx`
- Modify: `components/folder-grid-item.tsx`

**Step 1: Replace `BlurView` with `SmartGlassView`**

In `video-grid-item.tsx`, replace:
```typescript
// Before
<BlurView intensity={80} style={styles.infoOverlay} tint="dark">

// After
<SmartGlassView effect="clear" style={styles.infoOverlay}>
```

**Step 2: Update focus border to glass glow**

Replace the solid border with a subtle glass-edge glow:
```typescript
borderOverlayFocused: {
  borderColor: "rgba(255, 255, 255, 0.3)",
  shadowColor: "#FFC312",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 16,
},
```

**Step 3: Commit**
```
feat: replace BlurView with liquid glass on poster card overlays
```

---

### Task 3.2: Glass Player Controls Overlay

**Files:**
- Modify: `app/player.tsx`
- Create: `components/PlayerGlassOverlay.tsx`

**Step 1: Create a glass transport bar**

Replace the current error/loading overlays with glass-backed versions:
```typescript
// Loading state: glass pill in center
<SmartGlassView effect="regular" style={styles.loadingPill}>
  <ActivityIndicator color={COLORS.accent} />
  <Text>Loading...</Text>
</SmartGlassView>

// Error state: glass panel with retry
<SmartGlassView effect="regular" style={styles.errorPanel}>
  <Text style={styles.errorTitle}>Playback Error</Text>
  <FocusableButton title="Retry" variant="primary" />
</SmartGlassView>
```

**Step 2: Glass UpNext overlay**

Modify `components/up-next-overlay.tsx` to use `SmartGlassView` instead of `rgba(0,0,0,0.7)`.

**Step 3: Commit**
```
feat: apply liquid glass to player overlays and up-next panel
```

---

### Task 3.3: Glass Settings Screen

**Files:**
- Modify: `components/settings/styles.ts`
- Modify: `components/settings/ConnectedSection.tsx`
- Modify: `components/settings/NotConnectedSection.tsx`

**Step 1: Glass section containers**

Wrap each settings section in `SmartGlassView` with `effect="clear"`:
```typescript
<SmartGlassView effect="clear" style={styles.section}>
  <Text style={styles.sectionTitle}>Server</Text>
  {/* ... section content */}
</SmartGlassView>
```

**Step 2: Glass input fields**

Style `TextInput` with glass backgrounds instead of solid `#2C2C2E`.

**Step 3: Commit**
```
feat: apply liquid glass to settings screen sections and inputs
```

---

## Phase 4: Immersive Backgrounds — Full-Screen Backdrops

### Task 4.1: Dynamic Background on Library Screen

**Files:**
- Create: `components/DynamicBackground.tsx`
- Modify: `app/(tabs)/index.tsx`

**Step 1: Create `DynamicBackground`**

When user focuses on a poster card, the screen background crossfades to a blurred version of that poster's backdrop image.

```typescript
// Structure:
// <View style={absoluteFill}>
//   <Image source={currentBackdropUrl} style={absoluteFill} blurRadius={40} />
//   <View style={[absoluteFill, { backgroundColor: 'rgba(0,0,0,0.6)' }]} />
// </View>
```

- Uses `expo-image` with `blurRadius` for the backdrop
- Animated crossfade (300ms) when focus changes
- Dark overlay ensures text readability
- Only activates when browsing folders (not on billboard which has its own backdrop)

**Step 2: Wire into library screen**

Track which item is focused via `onItemFocus` callback. Pass focused item's ID to `DynamicBackground`.

**Step 3: Commit**
```
feat: add dynamic blurred background that responds to focused item
```

---

### Task 4.2: Backdrop on Detail/Episode Views

**Files:**
- Modify: `app/(tabs)/index.tsx` (folder drill-down state)

When inside a TV show (viewing seasons/episodes), show the show's backdrop as a persistent blurred background behind the episode grid.

**Step 1: Pass parent item backdrop through folder navigation**

Store the show's backdrop URL when navigating into it, persist through season/episode drill-downs.

**Step 2: Render as `DynamicBackground` behind the grid**

**Step 3: Commit**
```
feat: show persistent show backdrop when browsing seasons/episodes
```

---

## Phase 5: Polish & Micro-Interactions

### Task 5.1: Focus Animations

**Files:**
- Modify: `components/video-grid-item.tsx`
- Modify: `components/FocusableButton.tsx`

**Step 1: Enhanced focus scale**

Use tvOS `magnification` prop for native-feeling scale on focus (1.05-1.08x). This is built into react-native-tvos and is more performant than JS-driven scale animations.

**Step 2: Glass effect mode transition on focus**

When a glass element receives focus, transition from `effect="clear"` to `effect="regular"` for a subtle "thickening" effect.

**Step 3: Commit**
```
feat: add focus scale and glass mode transitions
```

---

### Task 5.2: Breadcrumb as Glass Pill

**Files:**
- Modify: `components/breadcrumb.tsx`

Replace current breadcrumb overlay with a glass pill:
```typescript
<SmartGlassView effect="clear" style={styles.breadcrumbPill}>
  <Text>{breadcrumbText}</Text>
</SmartGlassView>
```

**Step 1: Implement**

**Step 2: Commit**
```
feat: replace breadcrumb overlay with glass pill
```

---

### Task 5.3: Update Color Palette to Darker Background

**Files:**
- Modify: `app/_layout.tsx` (CustomDarkTheme)
- Modify: `app/(tabs)/index.tsx`
- Modify all screens using hardcoded `#1C1C1E`

**Step 1: Update theme background**

Change from `#3d3d3d` / `#1C1C1E` to `#0A0A0A` (near-black). Liquid Glass looks dramatically better against very dark backgrounds — the refraction/light effects pop more.

**Step 2: Global find-replace**

Replace all hardcoded color values with imports from `constants/theme.ts`.

**Step 3: Commit**
```
refactor: centralize colors and darken background for liquid glass contrast
```

---

## Phase 6: Search Screen Refresh

### Task 6.1: Glass Search Bar

**Files:**
- Modify: `app/(tabs)/search.tsx`

**Step 1: Replace search input background with glass**

Wrap the search `TextInput` in a `SmartGlassView` instead of the current bordered box.

**Step 2: Glass result cards**

Search results use the same `ShelfCard` / `VideoGridItem` components (already glass-ified in Phase 3).

**Step 3: Commit**
```
feat: apply liquid glass to search bar and results
```

---

## Summary: Effort Estimate

| Phase | Description | Effort |
|-------|-------------|--------|
| **Phase 1** | Foundation (install, tokens, SmartGlassView) | ~2 hours |
| **Phase 2** | Hero Billboard + Shelves (biggest change) | ~6-8 hours |
| **Phase 3** | Glass Chrome (overlays, controls, settings) | ~3-4 hours |
| **Phase 4** | Immersive Backgrounds | ~3-4 hours |
| **Phase 5** | Polish & Micro-interactions | ~2-3 hours |
| **Phase 6** | Search refresh | ~1-2 hours |
| **Total** | | **~17-23 hours** |

## Dependencies & Risk

| Risk | Mitigation |
|------|-----------|
| `@callstack/liquid-glass` doesn't support tvOS | Library says iOS 26+ but tvOS may need testing. Fallback: `SmartGlassView` degrades to `BlurView` automatically. |
| Performance with many glass elements | Use `LiquidGlassContainerView` to share refraction context. Limit to 2-3 visible glass surfaces at once. |
| Backdrop image loading latency | Use `expo-image` disk cache + low-priority prefetch. Show gradient placeholder during load. |
| N100 transcoding + heavy UI | UI is client-side (Apple TV GPU). Transcoding is server-side (N100). No conflict. |

## Non-Goals (Out of Scope)

- Playback logic changes (already fixed separately)
- New Jellyfin API features (Seerr, HA integration)
- Android/mobile support (tvOS-first)
- Custom video player controls (keeping native controls for now)
