# SDUI Component Audit & Roadmap

## Architecture Overview

TommoTV uses a **Server-Driven UI (SDUI)** system where the radbot (OpenClaw) sends structured JSON payloads over WebSocket that render as native tvOS components.

**Data flow:**
```
radbot → tommo ui:render → WebSocket relay → sduiHandlers.ts → componentRegistry → component
```

**Key design traits:**
- Every component has a **Zod schema** for prop validation (invalid props → silent rejection, no crash)
- Components self-describe via `getManifest()` — the LLM sees what it can render
- Focus management is handled per-component (`focusConfig` in registry)
- SmartGlassView (Liquid Glass / BlurView fallback) exists and should be used in SDUI components

---

## Current Tab Structure

```
Library  |  Search  |  Settings  |  Help
```

**Plan:** Replace **Help** with **AI** tab. The AI tab becomes the dedicated canvas for all dynamic SDUI content. When the bot needs to show something, it navigates the user to the AI tab and renders there — not as an overlay on top of everything.

The Help tab is just a static about/QR screen — low-value real estate.

---

## Existing App Components (Reusable)

These are the app's battle-tested media display components. **SDUI should reuse them, not duplicate.**

### VideoGridItem
**File:** `components/video-grid-item.tsx`
**Used by:** Library screen (folder browsing), Search screen (results grid)

Takes a `JellyfinVideoItem` and renders a 2:3 poster card with:
- Poster image (expo-image, disk-cached, recycled)
- SmartGlassView metadata overlay on focus (codec, resolution, duration, title)
- Focus border with gold (#FFC312) shadow
- `onPress` callback with the full `JellyfinVideoItem`

**Props:** `{ video: JellyfinVideoItem, onPress, index, onItemFocus?, onItemBlur?, hasTVPreferredFocus?, nextFocusUp? }`

**Key insight:** This is a highly optimized component (React.memo, lazy metadata, conditional rendering). Any SDUI media grid should wrap this rather than building its own card.

### VideoShelf
**File:** `components/VideoShelf.tsx`
**Used by:** Library home screen (Continue Watching, Next Up, Recently Added)

Horizontal scrollable shelf with poster or landscape cards.

**Props:** `{ title: string, items: JellyfinItem[], onItemPress, cardStyle?: 'poster' | 'landscape' }`

### HeroBillboard
**File:** `components/HeroBillboard.tsx`
**Used by:** Library home screen (top hero section, rotates through 5 items)

Large backdrop image with gradient, title, metadata, Play + More Info buttons. Auto-rotates every 8s.

**Props:** `{ items: JellyfinItem[], onPlay, onInfo? }`

### JellyfinVideoItem (data shape everything uses)
```typescript
interface JellyfinVideoItem {
  Id: string;
  Name: string;
  Type: string;              // "Movie", "Episode", "Series", etc.
  RunTimeTicks: number;
  Path: string;
  Overview?: string;
  PremiereDate?: string;
  ProductionYear?: number;
  CommunityRating?: number;
  OfficialRating?: string;
  Genres?: string[];
  SeriesName?: string;
  SeasonName?: string;
  IndexNumber?: number;       // Episode number
  ParentIndexNumber?: number; // Season number
  ImageTags?: { Primary?: string };
  BackdropImageTags?: string[];
  MediaStreams?: JellyfinMediaStream[];
  PrimaryImageAspectRatio?: number;
}
```

**Key insight:** The existing components all speak `JellyfinVideoItem`. If SDUI components also accept this type (or a lightweight subset), we get reuse for free. The poster URL is derived from `Id` via `getPosterUrl(id, size)` — it's not passed as a prop.

---

## Current SDUI Components (4)

### 1. Toast (currently named TextMessage)
**File:** `components/sdui/TextMessage.tsx`
**Rename to:** `Toast`

Pops over everything — this is the one component that _should_ be an overlay. Quick notifications, confirmations, errors.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | string | — | Message text |
| `style` | `info \| success \| warning \| error` | `info` | Color-coded left border |
| `duration` | number | `5` | Auto-dismiss seconds (0 = persistent) |

**Verdict:** Keep as overlay. Rename to Toast. Good as-is for MVP.

### 2. NowPlayingCard
**File:** `components/sdui/NowPlayingCard.tsx`

Poster + title + series info + progress bar. **Not used anywhere else in the app.** The player screen (`app/player.tsx`) has its own playback UI — this is purely for the "what's playing?" SDUI query.

**Verdict:** Keep. It's a standalone info display — the bot assembles the data from `tommo status` and renders it. Renders on the AI tab, not as overlay.

### 3. MovieGrid ← **Replace with reusable MediaGrid**
**File:** `components/sdui/MovieGrid.tsx`

Custom grid that duplicates what `VideoGridItem` + `FlatList` already do in the app. Uses its own card styling, its own poster rendering, its own focus handling — all inferior to the battle-tested `VideoGridItem`.

**Problems:**
- Duplicates `VideoGridItem` functionality
- Own data shape (`{id, title, year?, rating?, posterUrl?}`) instead of `JellyfinVideoItem`
- Selection does nothing (no `onPress` → play)
- Named "MovieGrid" but displays any media

**Verdict:** Delete. Replace with a single `MediaGrid` that wraps the existing `VideoGridItem` and `FlatList` pattern from the library/search screens. Accepts `JellyfinVideoItem[]`.

### 4. SearchResults ← **Merge into MediaGrid**
**File:** `components/sdui/SearchResults.tsx`

Vertical list of mixed results. Different visual from MovieGrid (row-based vs poster grid), but same fundamental purpose: "here are items, pick one."

**Verdict:** Merge into MediaGrid. One component, one data shape. The grid vs list distinction can be a layout prop if needed, but for MVP a poster grid covers both use cases.

---

## Revised Component Plan

### Rendering Model Change

**Before (current):** All SDUI components render as overlays via `sdui.tsx` backdrop.
**After:** Two rendering modes:

| Mode | When | Where |
|------|------|-------|
| **Toast** | Quick notifications, confirmations | Overlay on top of current screen |
| **Canvas** | Rich content (grids, cards, info displays) | AI tab — full screen real estate |

When the bot triggers a canvas component, the app navigates to the AI tab (if not already there) and renders the component. The AI tab is the dedicated space for bot-driven interactions.

---

### Phase 0: Foundation

#### 0a. Add the AI Tab
Replace Help tab with AI tab in `app/(tabs)/_layout.tsx`. Route: `app/(tabs)/ai.tsx`.

The AI tab:
- Subscribes to `componentRegistry.onRender()` (like `sdui.tsx` does today)
- Renders canvas components in a scrollable container
- Shows a nice empty state when no active content ("Ask me anything")
- Auto-navigates here when bot triggers a canvas render

#### 0b. Rename TextMessage → Toast, Keep as Overlay
Toast stays in the overlay system. Everything else moves to the AI tab canvas.

#### 0c. Wire up Selection → Playback
When user presses Select on any media item in an SDUI component:
1. Emit `event.ui.select` back through the bridge with the `jellyfinId`
2. The bot receives it and can call `tommo play <id>`
3. OR the component directly calls the existing `handleItemPress` pattern (navigate to `/player`)

---

### Phase 1: Core Components (MVP)

#### MediaGrid
**One component to replace MovieGrid + SearchResults.**

Reuses the app's existing `VideoGridItem` component in a `FlatList` grid. Same poster cards, same focus behavior, same press-to-play pattern the user is already used to from the Library and Search tabs.

| Prop | Type | Description |
|------|------|-------------|
| `items` | `JellyfinVideoItem[]` | Media items to display (same type the whole app uses) |
| `title` | string? | Optional header text |
| `columns` | number? | Grid columns (default: 5 on TV) |

**Why this works:** The bot already gets Jellyfin data via `seedbox library:search`. Instead of transforming it into a custom SDUI shape, pass the raw `JellyfinVideoItem[]` straight through. The existing `VideoGridItem` handles poster URLs, focus, metadata — all of it.

**Selection:** `onPress` navigates to `/player` with the selected item, same as the Library tab does.

#### ConfirmationCard
**"Should I do this?" — yes/no with context.**

| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Question/action |
| `message` | string? | Additional context |
| `confirmLabel` | string | e.g. "Play", "Download", "Yes" |
| `cancelLabel` | string? | e.g. "Cancel", "No" (default: "Cancel") |
| `style` | `default \| destructive`? | Visual treatment |

Selection emits `event.ui.confirm` or `event.ui.cancel` back through the bridge.

---

### Phase 2: Rich Display

#### InfoCard (Generic Rich Display)
**The "Nest Hub" component — show text + image for any kind of answer.**

Instead of a highly structured MediaDetailCard with 13 typed props, keep this intentionally flexible. Think of it as "the bot wants to show you something interesting."

| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Main heading |
| `body` | string? | Paragraph text (could be a synopsis, an answer, instructions, etc.) |
| `imageUrl` | string? | Optional image (poster, photo, diagram, etc.) |
| `subtitle` | string? | Secondary line (year, genre, metadata) |
| `badges` | string[]? | Small tags (e.g. ["4K", "HDR", "2024"]) |
| `actions` | `{label: string, id: string}[]`? | Optional action buttons |

**Use cases:**
- "Tell me about Andor" → title + poster + overview + "Play" action
- "What's the weather?" → title + body (if we ever add that)
- "Show me the download status of X" → title + body with progress info
- Bot wants to explain something → title + body text

Actions emit `event.ui.action` with the action `id` back through the bridge.

#### EpisodeList
**"Show me Severance episodes" → Season tabs + episode rows → Select to play.**

| Prop | Type | Description |
|------|------|-------------|
| `showName` | string | Series title |
| `episodes` | `JellyfinVideoItem[]` | All episodes (component groups by season using `ParentIndexNumber`) |

Uses the existing `JellyfinVideoItem` type. The component groups episodes by `ParentIndexNumber` (season number) and shows `IndexNumber` (episode number). Selecting an episode navigates to `/player`.

---

### Phase 3: Future (not MVP)

| Component | Idea | Notes |
|-----------|------|-------|
| **ContinueWatchingShelf** | "What was I watching?" | Fun but not MVP. Could reuse `VideoShelf` with landscape cards. |
| **HomeStatusCard** | Generic smart home display | Deferred — unclear what this looks like yet. |
| **QueueView** | Current playback queue | Nice-to-have polish. |
| **LoadingCard** | "Searching..." spinner with context | Useful when bot is doing slow work (Sonarr search, etc.) |

---

## Build Order

```
Phase 0:  AI Tab + Toast rename + Selection wiring
Phase 1:  MediaGrid + ConfirmationCard
Phase 2:  InfoCard + EpisodeList
Phase 3:  Future components as needed
```

Phase 0 + 1 unlocks the core loop: **bot shows content → user selects → thing happens.**
Phase 2 adds richness: detail views, episode browsing.

---

## Key Design Decisions

1. **Reuse over rebuild.** SDUI MediaGrid wraps existing `VideoGridItem` — one component for media display across the entire app.
2. **AI tab over overlays.** Rich content renders in its own tab, not floating over the library. Toasts are the only overlay.
3. **JellyfinVideoItem everywhere.** Don't invent new data shapes. The bot produces Jellyfin data, the app consumes Jellyfin data.
4. **Generic over specific.** InfoCard handles "tell me about X" generically rather than separate MovieDetail / ShowDetail / DownloadStatus components.
5. **Selection completes the loop.** Every interactive component emits events back through the bridge so the bot can act on user choices.

---

## Adding a New Component (Checklist)

1. Create `components/sdui/YourComponent.tsx` with Zod `propsSchema` export
2. Register in `components/sdui/registerComponents.ts` with name + description
3. The bot auto-discovers it via `tommo ui:components`
4. Update `chrisbot/skills/tomotv-control/SKILL.md` with usage examples
5. Test via `tommo ui:render '{"component":"YourComponent","props":{...}}'`
6. If canvas component: ensure AI tab renders it properly
7. If interactive: wire `event.ui.*` emission back through bridge
