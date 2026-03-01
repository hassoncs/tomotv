# SDUI Component Audit & Roadmap

## Architecture Overview

TommoTV uses a **Server-Driven UI (SDUI)** system where the radbot (OpenClaw) sends structured JSON payloads over WebSocket that render as native tvOS components. No chat bubbles — the bot speaks through rich overlays on the TV screen.

**Data flow:**
```
radbot → tommo ui:render → WebSocket relay → sduiHandlers.ts → componentRegistry → sdui.tsx overlay
```

**Key design traits:**
- Every component has a **Zod schema** for prop validation (invalid props → silent rejection, no crash)
- Components self-describe via `getManifest()` — the LLM sees what it can render
- The `sdui.tsx` screen renders components in a semi-transparent backdrop overlay (modal-style)
- Focus management is handled per-component (`focusConfig` in registry)
- SmartGlassView (Liquid Glass / BlurView fallback) exists but isn't used by SDUI components yet

---

## Current Components (4)

### 1. TextMessage
**Purpose:** Simple text notification/alert overlay.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `text` | string | — | Message text to display |
| `style` | `info \| success \| warning \| error` | `info` | Color-coded left border |
| `duration` | number | `5` | Auto-dismiss seconds (0 = persistent) |

**Strengths:** Clean, simple, works well for confirmations ("Lights dimmed") and errors.
**Gaps:** No icon support, no action buttons, no rich formatting (bold, links).

---

### 2. NowPlayingCard
**Purpose:** Rich "what's playing" overlay with poster, progress bar, and metadata.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `title` | string | — | Item title |
| `seriesName` | string? | — | TV show name |
| `seasonEpisode` | string? | — | e.g. "S02 E05" |
| `positionSeconds` | number | `0` | Current playback position |
| `durationSeconds` | number | `0` | Total duration |
| `posterUrl` | string? | — | Poster/thumbnail URL |

**Strengths:** Good visual density, progress bar works well.
**Gaps:** No playback controls (pause/skip buttons), no "up next" info, read-only display.

---

### 3. MovieGrid
**Purpose:** Focusable poster grid for curated movie/show lists.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `movies` | `{id, title, year?, rating?, posterUrl?}[]` | — | Items to display |
| `columns` | 1-8 | `4` | Grid columns |
| `onSelectId` | string? | — | Pre-selected ID (unused) |

**Strengths:** Focusable cards with tvOS remote navigation, poster art, metadata.
**Gaps:**
- **`onSelect` doesn't trigger playback.** Items are focusable but pressing Select does nothing — there's no callback wired to `tommo play <id>`. This is the biggest gap.
- No genre/category badges
- No "watched" indicator or progress overlay on posters
- Named "MovieGrid" but could show any media — naming is limiting

---

### 4. SearchResults
**Purpose:** Vertical list of mixed media search results.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `results` | `{id, type, title, subtitle?, thumbnailUrl?}[]` | — | Mixed results |
| `title` | string | `"Results"` | Header text |

**Supported types:** Movie, Series, Episode, Audio, MusicAlbum

**Strengths:** Handles mixed media types, type icons, good information density.
**Gaps:**
- Same as MovieGrid — **selecting an item does nothing** (no playback trigger)
- No pagination or "load more"
- No empty state ("No results found")

---

## Critical Gap: Selection → Action

**The biggest issue across all interactive components (MovieGrid, SearchResults):**

Items are focusable and visually respond to focus, but pressing Select on the Apple TV remote doesn't do anything. There's no mechanism to:
1. Send the selected item's ID back to the bot
2. Trigger `tommo play <jellyfinId>` from the component
3. Navigate to a detail view

The SKILL.md mentions `event.ui.select` as a planned event, but it's not implemented. This means the bot can *show* content but the user can't *act* on it through SDUI — they'd need to separately ask the bot to play a specific title by name.

**This should be the #1 priority fix before building new components.**

---

## Recommended New Components (Priority Order)

### Priority 1: Foundation (enable core workflows)

#### A. Wire up Selection → Playback (not a new component — a fix)
When user presses Select on a MovieGrid/SearchResults item, emit `event.ui.select` back through the bridge with the `jellyfinId`. The bot can then call `tommo play <id>` or show a detail view.

#### B. EpisodeList
**Workflow:** "Show me Severance episodes" → Season picker + episode list → Select to play

| Prop | Type | Description |
|------|------|-------------|
| `showName` | string | Series title |
| `seasons` | `{number, episodeCount}[]` | Available seasons |
| `episodes` | `{id, title, seasonNumber, episodeNumber, overview?, thumbnailUrl?, durationMinutes?, watched?}[]` | Episodes for selected season |
| `selectedSeason` | number | Initially focused season |

**Why first:** The bot already handles `seedbox library:find-episode` which returns episode IDs — this is the missing visual layer. "Play Severance S02E01" works today, but "show me Severance episodes" has no good display.

#### C. ConfirmationCard
**Workflow:** "Should I play this?" / "Add to library?" / "Download in 4K?" → Yes/No

| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Question/action description |
| `message` | string? | Additional context |
| `confirmLabel` | string | e.g. "Play", "Download", "Yes" |
| `cancelLabel` | string | e.g. "Cancel", "No" |
| `style` | `default \| destructive` | Visual treatment |

**Why early:** Every interactive workflow needs a confirmation step. Without this, the bot has to assume intent.

---

### Priority 2: Rich Information Display

#### D. MediaDetailCard
**Workflow:** "Tell me about Andor" → Rich detail view with poster, synopsis, ratings, cast → "Play" button

| Prop | Type | Description |
|------|------|-------------|
| `id` | string | Jellyfin item ID |
| `title` | string | Title |
| `type` | `Movie \| Series` | Media type |
| `year` | number? | Release year |
| `rating` | number? | Score |
| `overview` | string? | Synopsis/plot summary |
| `posterUrl` | string? | Poster image |
| `backdropUrl` | string? | Background image |
| `genres` | string[]? | Genre tags |
| `runtime` | string? | e.g. "2h 15m" |
| `cast` | `{name, role}[]`? | Top cast |
| `watched` | boolean? | Watched status |
| `progress` | number? | 0-1 resume progress |

**Why:** Bridges the gap between "search" and "play". Right now MovieGrid shows title + poster + year — not enough to decide whether to watch something.

#### E. ContinueWatchingShelf
**Workflow:** "What was I watching?" → Horizontal shelf of in-progress items with resume positions

| Prop | Type | Description |
|------|------|-------------|
| `items` | `{id, title, seriesName?, seasonEpisode?, posterUrl?, progress, remainingMinutes}[]` | In-progress items |

**Why:** Natural entry point for returning users. Jellyfin already tracks watch progress.

#### F. DownloadStatusCard
**Workflow:** "What's downloading?" → Active Sonarr/Radarr downloads with progress bars

| Prop | Type | Description |
|------|------|-------------|
| `downloads` | `{title, type, progress, sizeGB?, eta?, status}[]` | Active downloads |
| `diskFreeGB` | number? | Remaining disk space |

**Why:** The bot already has `seedbox dl:list` — this is the visual companion.

---

### Priority 3: Smart Home Integration

#### G. HomeStatusCard
**Workflow:** "What's the house status?" → Room-by-room light/device summary

| Prop | Type | Description |
|------|------|-------------|
| `rooms` | `{name, lights, devices}[]` | Room states |
| `scenes` | `{name, id, active}[]`? | Available scenes |

#### H. SceneSelector
**Workflow:** "Show me scenes" → Grid of scenes to activate (Movie Night, Bedtime, etc.)

| Prop | Type | Description |
|------|------|-------------|
| `scenes` | `{id, name, icon?, description?}[]` | Available HA scenes |

---

### Priority 4: Quality of Life

#### I. ErrorCard (enhanced TextMessage)
Structured error display with retry action and context.

#### J. LoadingCard
"Searching..." / "Finding episodes..." — spinner with context message. Useful when the bot needs time (Sonarr search, etc.).

#### K. QueueView
Current playback queue with reorder/remove capabilities.

---

## Build Order Recommendation

```
Phase 0 (Fix):   Wire up onSelect → event.ui.select for MovieGrid + SearchResults
Phase 1 (Core):  EpisodeList → ConfirmationCard
Phase 2 (Rich):  MediaDetailCard → ContinueWatchingShelf
Phase 3 (Ops):   DownloadStatusCard
Phase 4 (HA):    HomeStatusCard → SceneSelector
Phase 5 (QoL):   ErrorCard, LoadingCard, QueueView
```

Each phase unlocks a new category of workflows:
- **Phase 0:** Users can browse AND play from SDUI (currently broken)
- **Phase 1:** Bot can show TV episodes and ask for confirmation
- **Phase 2:** Full media discovery loop (search → detail → play)
- **Phase 3:** Download monitoring from the TV
- **Phase 4:** Smart home control from the TV
- **Phase 5:** Polish and error handling

---

## Adding a New Component (Checklist)

1. Create `components/sdui/YourComponent.tsx` with Zod `propsSchema` export
2. Register in `components/sdui/registerComponents.ts` with name + description
3. The bot auto-discovers it via `tommo ui:components`
4. Update `chrisbot/skills/tomotv-control/SKILL.md` with usage examples
5. Test via `tommo ui:render '{"component":"YourComponent","props":{...}}'`
