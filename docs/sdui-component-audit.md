# SDUI Component Audit & Roadmap

## Architecture Overview

RadmediaTV uses a **Server-Driven UI (SDUI)** system where the radbot (OpenClaw) sends structured JSON payloads over WebSocket that render as native tvOS components.

**Data flow:**
```
radbot → radmedia ui:render → WebSocket relay → sduiHandlers.ts → componentRegistry → component
```

**Key design traits:**
- Every component has a **Zod schema** for prop validation (invalid props → silent rejection, no crash)
- Components self-describe via `getManifest()` — the LLM sees what it can render
- Focus management is handled per-component (`focusConfig` in registry)
- SmartGlassView (Liquid Glass / BlurView fallback) exists and should be used in SDUI components

---

## Current Tab Structure

```
Library  |  Search  |  Settings  |  AI
```

The **Help** tab has been replaced with the **AI** tab. The AI tab is the dedicated canvas for all dynamic SDUI content. When the bot needs to show something, it navigates the user to the AI tab and renders there — not as an overlay on top of everything.

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

## Current SDUI Components (7)

### 1. Toast (primary) / TextMessage (deprecated alias)
**File:** `components/sdui/Toast.tsx`

Pops over everything — this is the one component that _should_ be an overlay. Quick notifications, confirmations, errors.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | string | — | Message text |
| `style` | `info \| success \| warning \| error` | `info` | Color-coded left border |
| `duration` | number | `5` | Auto-dismiss seconds (0 = persistent) |

**Verdict:** Keep as overlay. Primary notification component.

### 2. NowPlayingCard
**File:** `components/sdui/NowPlayingCard.tsx`

Poster + title + series info + progress bar. Renders on the AI tab canvas.

### 3. MediaGrid (primary) / MovieGrid & SearchResults (deprecated aliases)
**File:** `components/sdui/MediaGrid.tsx`

Focusable poster grid for displaying Jellyfin video items. Consolidates movie grid and search results into one reusable component. Wraps the app's existing `VideoGridItem`.

| Prop | Type | Description |
|------|------|-------------|
| `items` | `JellyfinVideoItem[]` | Media items to display |
| `title` | string? | Optional header title |
| `columns` | number? | Grid columns (default: 5) |

**Selection:** Emits `event.ui.select` with `itemId`.

### 4. ConfirmationCard
**File:** `components/sdui/ConfirmationCard.tsx`

Modal-style card with confirm and cancel buttons. Use when the bot needs explicit user approval.

| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Question/action |
| `message` | string? | Additional context |
| `confirmLabel` | string | Label for confirm button |
| `cancelLabel` | string | Label for cancel button |

**Selection:** Emits `event.ui.action` with `actionId` "confirm" or "cancel".

### 5. InfoCard
**File:** `components/sdui/InfoCard.tsx`

Rich info card with title, body text, optional image, and action buttons. Generic display for any rich content.

| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Card heading |
| `body` | string? | Body text or description |
| `imageUrl` | string? | Optional image URL |
| `actions` | `action[]` | List of `{label, actionId}` buttons |

**Selection:** Buttons emit `event.ui.action` with the `actionId`.

### 6. EpisodeList
**File:** `components/sdui/EpisodeList.tsx`

Scrollable list of TV episodes with season/episode labels. Use after fetching episodes for a series.

| Prop | Type | Description |
|------|------|-------------|
| `episodes` | `episode[]` | List of `{id, title, episodeNumber, seasonNumber, overview, durationMinutes}` |
| `seriesTitle` | string? | Series name shown as header |

**Selection:** Emits `event.ui.select` with `itemId`.

---

## Rendering Model

Two rendering modes:

| Mode | When | Where | `target` param |
|------|------|-------|----------------|
| **Overlay** | Quick notifications (Toast) | Floats over current screen | `"overlay"` |
| **Canvas** | Rich content (grids, cards, lists) | AI tab — full screen | `"canvas"` |

When `target: "canvas"` and `navigateToTab: true`, the app auto-navigates to `/(tabs)/ai` before rendering.

### `ui.render` Params

| Param | Type | Description |
|-------|------|-------------|
| `component` | string | Registered component name |
| `props` | object | Component-specific props |
| `target` | `overlay \| canvas` | Where to render (default: `"canvas"`) |
| `navigateToTab` | boolean | Auto-navigate to AI tab (default: `true` when canvas) |

---

## Future Components (Phase 3)

| Component | Idea | Notes |
|-----------|------|-------|
| **ContinueWatchingShelf** | "What was I watching?" | Reuse `VideoShelf` with landscape cards |
| **HomeStatusCard** | Generic smart home display | Deferred |
| **QueueView** | Current playback queue | Nice-to-have polish |
| **LoadingCard** | "Searching..." spinner | Useful for slow bot operations |

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
3. The bot auto-discovers it via `tv ui:components`
4. Update `chrisbot/skills/tv/SKILL.md` with usage examples
5. Test via `tv ui:render '{"component":"YourComponent","props":{...}}'`
6. If canvas component: ensure AI tab renders it properly
7. If interactive: wire `event.ui.*` emission back through bridge
