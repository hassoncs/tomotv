# GenUI Integration — Master Plan

> **Status:** Ready for implementation
> **Date:** 2026-03-01 (revised)
> **Goal:** Complete end-to-end GenUI integration: AI tab search → OpenClaw bot → SDUI component rendering → native user interaction

---

## Executive Summary

The pipeline is ~70% wired. What's missing:

1. **3 new GenUI components** (ChatMessage, LoadingCard, SeriesDetail)
2. **Native navigation in SDUI components** — MediaGrid/EpisodeList items navigate like Search tab (app-controlled, not bot-controlled)
3. **AI tab orchestration** — arbitrate between text response and SDUI renders
4. **Bot prompt/skill updates** — teach the bot to prefer SDUI rendering
5. **End-to-end testing** — prove every workflow works

---

## Core Architecture Decision: App Owns Interaction

**The app controls all user interaction. The bot is a passive observer.**

When the bot renders a MediaGrid, the user browses and clicks items **natively** — same as the Search tab. The app handles navigation (click movie → player, click series → episode browser). The bot is notified via `event.ui.select` but doesn't need to orchestrate anything.

The bot CAN still send explicit commands ("select the first result") via `radmedia remote select`, but it's **not in the selection loop** by default.

### Why This Is Better
- **No blocking** — bot doesn't hold a socket open waiting for user input
- **Native UX** — D-pad browsing, focus, press all feel like the rest of the app
- **Simpler** — no `ui:render-wait`, no timeout handling, no race conditions
- **Bot stays informed** — events still flow through the relay for awareness/logging

### Architecture: Current vs Target

```
Current:
  User types → HTTP POST → OpenClaw → text response shown
                                     ↘ (sometimes) radmedia ui:render → component renders
  User clicks item → event.ui.select → relay → nobody listening (dead end)

Target:
  User types → HTTP POST → OpenClaw → bot calls radmedia ui:render → component renders
                                                                    ↓
                                                          User browses with D-pad
                                                                    ↓
                                                          Clicks item → APP navigates
                                                            (to player, to episode list, etc.)
                                                                    ↓
                                                          event.ui.select → relay → bot informed (passive)
```

---

## Gap 1: Native Navigation in SDUI Components

### The Problem
Today's MediaGrid emits `event.ui.select` but doesn't navigate anywhere. The Search tab navigates to the player:

```typescript
// Search tab — click → navigate to player
const handleVideoPress = (video) => {
  showGlobalLoader();
  router.push({ pathname: "/player", params: { videoId: video.Id, videoName: video.Name } });
};
```

### The Solution
SDUI components get native navigation. Each component type-checks the selected item and navigates:

| Item Type | Click Action |
|-----------|-------------|
| Movie | Navigate to `/player` with `videoId` |
| Episode | Navigate to `/player` with `videoId` |
| Series | Render `SeriesDetail` inline (or bot can send `EpisodeList`) |

Components ALSO emit `event.ui.select` for bot awareness, but navigation happens immediately without waiting for the bot.

### Implementation
- MediaGrid uses `useRouter()` from expo-router (it's in the React tree, so hooks work)
- `handlePress` does BOTH: navigate AND emit event
- For Series items: could either navigate to a series detail route or just emit the event and let the bot follow up with an EpisodeList render

### Bot-Initiated Selection
The bot can still say "play the first result" by calling:
```bash
radmedia remote select  # D-pad select on the currently focused item
```
This triggers the same `handlePress` in MediaGrid, so it navigates AND emits.

---

## Gap 2: New GenUI Components (3)

### ChatMessage
**Purpose:** Display bot's conversational text within the SDUI render flow (styled, consistent with other components).

```typescript
// Props (Zod)
{
  text: string;                              // Message text
  role: 'assistant' | 'system';             // Default: 'assistant'
  variant: 'default' | 'success' | 'warning' | 'error';  // Default: 'default'
}
```
- **Events:** None (display-only)
- **Use case:** General Q&A, confirmations without buttons, non-visual responses
- **File:** `components/sdui/ChatMessage.tsx`

### LoadingCard
**Purpose:** Show progress for slow bot operations (seedbox search, large lookups).

```typescript
// Props (Zod)
{
  title: string;                  // e.g. "Searching Sonarr..."
  subtitle?: string;              // e.g. "Looking for The Bear"
  progress?: number;              // 0-1, optional progress bar
  cancellable?: boolean;          // Show cancel button
}
```
- **Events:** `event.ui.action` with `actionId: 'cancel'` if cancellable
- **Use case:** Multi-step operations, seedbox search/add, large Jellyfin queries
- **File:** `components/sdui/LoadingCard.tsx`

### SeriesDetail
**Purpose:** Click-through from MediaGrid for TV series — show poster, overview, season list with native navigation.

```typescript
// Props (Zod)
{
  seriesId: string;
  title: string;
  overview?: string;
  posterUrl?: string;
  year?: number;
  rating?: string;                // e.g. "TV-MA"
  communityRating?: number;       // e.g. 8.7
  seasons: Array<{
    seasonNumber: number;
    episodeCount?: number;
    id?: string;                  // Jellyfin season ID
  }>;
  actions?: Array<{
    actionId: string;
    label: string;
  }>;
}
```
- **Events:** `event.ui.select` for season selection, `event.ui.action` for buttons
- **Navigation:** Season click → bot renders EpisodeList (or app could navigate to series route)
- **File:** `components/sdui/SeriesDetail.tsx`

---

## Gap 3: AI Tab Orchestration

### Current Behavior
The AI tab renders THREE independent things:
1. Loading spinner (while HTTP request is in-flight)
2. Text response card (from HTTP response)
3. SDUI components (from componentRegistry canvas renders)

### Target Behavior
**Smart arbitration:**
- If SDUI canvas renders arrive for the current query → suppress the plain text card (it's redundant — the bot said "here are some movies" as text AND rendered a MediaGrid)
- If only text comes back → show it as a styled ChatMessage component (consistent look)
- Loading state persists until EITHER text response OR first SDUI render arrives
- Stale renders from previous queries are dropped

### Implementation
- Track a `queryId` (incrementing counter) per submission
- When SDUI render arrives during active query, set a flag to suppress raw text
- Convert text-only responses to ChatMessage styling
- Clear components + text on new query

---

## Gap 4: Bot Prompt/Skill Configuration

### What Needs to Change

1. **SKILL.md update** — add workflow examples showing when to render which component
2. **Bot routing rules** — teach the bot WHEN to use which component:

| User Intent | Bot Action |
|-------------|------------|
| "Show me movies/shows" | `seedbox library:search` → `radmedia ui:render MediaGrid` (user browses natively) |
| "Show me episodes of X" | `seedbox library:find-episode` → `radmedia ui:render EpisodeList` (user browses natively) |
| "What is X?" / "Tell me about X" | `seedbox library:search` → `radmedia ui:render InfoCard` or `SeriesDetail` |
| "What's playing?" | `radmedia status` → `radmedia ui:render NowPlayingCard` |
| "Play the first result" | `radmedia remote select` (triggers native navigation on focused item) |
| "Download X" | `seedbox tv:add` / `seedbox movie:add` → `radmedia ui:render Toast` |
| "Turn on cinema mode" | `ha script cinema_preshow` → `radmedia ui:render Toast` |
| General question | Text response (AI tab renders as ChatMessage) |

3. **Eval updates** — add test cases for each workflow to `evals/tests/radmedia.yaml`

---

## Workflow Coverage (All 9 Requested)

### 1. "Show me action movies"
```
Bot: seedbox library:search "action movies"
Bot: radmedia ui:render '{"component":"MediaGrid","props":{"items":[...],"title":"Action Movies"}}'
→ User browses grid with D-pad, clicks "Die Hard"
→ App navigates to /player (same as Search tab)
→ event.ui.select emitted (bot informed passively)
```

### 2. "What's new in my library?"
```
Bot: seedbox library:recent
Bot: radmedia ui:render '{"component":"MediaGrid","props":{"items":[...],"title":"Recently Added"}}'
→ User browses and clicks anything → plays
```

### 3. "Show me episodes of Severance"
```
Bot: seedbox library:search "Severance"
Bot: seedbox library:find-episode "Severance" S02
Bot: radmedia ui:render '{"component":"EpisodeList","props":{"episodes":[...],"seriesTitle":"Severance S02"}}'
→ User browses episode list, clicks S02E01
→ App navigates to /player
```

### 4. "What's playing?"
```
Bot: radmedia status
Bot: radmedia ui:render '{"component":"NowPlayingCard","props":{"title":"Severance","positionSeconds":342,...}}'
```

### 5. "Tell me about Andor"
```
Bot: seedbox library:search "Andor"
Bot: radmedia ui:render '{"component":"SeriesDetail","props":{"title":"Andor","overview":"...","seasons":[...]}}'
→ User clicks Season 1 → event.ui.select → bot renders EpisodeList
```

### 6. "Download The Bear"
```
Bot: seedbox tv:search "The Bear"
Bot: seedbox tv:add <tvdbId>
Bot: radmedia ui:render '{"component":"Toast","props":{"text":"The Bear added! Downloading Season 1-3.","style":"success"},"target":"overlay"}'
```

### 7. "Turn on cinema mode"
```
Bot: ha script cinema_preshow
Bot: radmedia ui:render '{"component":"Toast","props":{"text":"Cinema mode activated","style":"success"},"target":"overlay"}'
```

### 8. General question ("What's the weather?")
```
Bot: (text response via HTTP)
AI tab: renders as ChatMessage component (styled consistently)
```

### 9. "Search for breaking bad"
```
Bot: seedbox library:search "breaking bad"
Bot: radmedia ui:render '{"component":"MediaGrid","props":{"items":[...],"title":"Breaking Bad"}}'
→ User clicks "Breaking Bad" (Type: Series)
→ App emits event.ui.select with itemType: "Series"
→ Bot receives event, responds with:
Bot: radmedia ui:render '{"component":"EpisodeList","props":{"episodes":[...],"seriesTitle":"Breaking Bad S01"}}'
→ User clicks S01E01 → App navigates to /player
```

### 10. Bot says "play the first one"
```
Bot: radmedia remote select    # D-pad select on the focused item
→ MediaGrid handlePress fires → navigates to /player + emits event
```

---

## File Change Manifest

### New Files
| File | Description |
|------|-------------|
| `radmedia/components/sdui/ChatMessage.tsx` | Bot text response component |
| `radmedia/components/sdui/LoadingCard.tsx` | Progress/loading component |
| `radmedia/components/sdui/SeriesDetail.tsx` | Series detail with season list + native season navigation |
| `radmedia/components/sdui/__tests__/chat-message.test.tsx` | ChatMessage tests |
| `radmedia/components/sdui/__tests__/loading-card.test.tsx` | LoadingCard tests |
| `radmedia/components/sdui/__tests__/series-detail.test.tsx` | SeriesDetail tests |

### Modified Files
| File | What Changes |
|------|-------------|
| `radmedia/components/sdui/MediaGrid.tsx` | Add `useRouter()` navigation on item press (Movie/Episode → player) |
| `radmedia/components/sdui/EpisodeList.tsx` | Add `useRouter()` navigation on episode press → player |
| `radmedia/components/sdui/registerComponents.ts` | Register 3 new components |
| `radmedia/app/(tabs)/ai.tsx` | Response arbitration (text vs SDUI), query tracking, ChatMessage fallback |
| `openclaw/skills/tv/SKILL.md` | Add workflow examples, document native navigation behavior |
| `evals/prompts/ha-chat.json` | Sync bot prompt with SDUI rendering rules |
| `evals/tests/radmedia.yaml` | Add eval cases for all workflows |

### NOT Needed (removed from plan)
| Item | Why |
|------|-----|
| `radmedia ui:render-wait` | App owns interaction — bot doesn't need to block on selections |
| `radmedia ui:wait-event` | Same reason — app navigates natively |
| Relay modifications | No event subscription changes needed |
| `openclawApi.ts` changes | No request correlation needed since app handles navigation |

---

## Implementation Order (Dependency Graph)

### Wave 1: Component Navigation (parallel)
1a. **MediaGrid** — add `useRouter()` + native navigation on press (Movie/Episode → player)
1b. **EpisodeList** — add `useRouter()` + native navigation on press → player
1c. **ChatMessage** — new display-only component
1d. **LoadingCard** — new component with cancel button
1e. **SeriesDetail** — new component with season selection

### Wave 2: Integration (after Wave 1)
2a. **Register new components** in `registerComponents.ts`
2b. **AI tab orchestration** — response arbitration, ChatMessage fallback for text-only responses
2c. **Bot prompt/skill updates** — SKILL.md workflow examples

### Wave 3: Verification (after Wave 2)
3a. **Tests** — unit tests for new components, navigation tests
3b. **Type check + lint** — `tsc --noEmit`, `npm run lint`
3c. **Eval** — run `npm run eval:current` for bot behavior
3d. **Manual E2E** — test all workflows on device/simulator

---

## Success Criteria

- [ ] MediaGrid items navigate to player on click (just like Search tab)
- [ ] EpisodeList items navigate to player on click
- [ ] All 3 new components render correctly via `radmedia ui:render`
- [ ] AI tab suppresses redundant text when SDUI renders arrive
- [ ] AI tab shows ChatMessage for text-only responses
- [ ] Bot chooses appropriate component for each query type
- [ ] User can: see results → browse with D-pad → click → play (no bot involvement)
- [ ] Bot can: say "play the first result" via `radmedia remote select`
- [ ] All existing tests pass (`npm test`)
- [ ] Type check passes (`npx tsc --noEmit`)
- [ ] Lint passes (`npm run lint`)
- [ ] Evals pass at 100% (`cd evals && npm run eval:current`)
