# RadmediaTV Remote Control Bridge + Generative UI

**Status:** Implementation in progress (Layer 1 + 2 wiring, Layer 3 foundation)
**Last Updated:** 2026-03-01

---

## Vision

Connect Home Assistant voice → OpenClaw bot → WebSocket relay → RadmediaTV app.
Every capability available via the Apple TV pyatv API — plus unique app-native capabilities —
controllable by voice, automation, or AI-generated UI.

```
HA Voice → OpenClaw (N100) → radmedia CLI → WS Relay (openclaw.lan:9091) → RadmediaTV app
                                                   ↑
                                        JSON-RPC 2.0 over WebSocket
```

---

## Three Layers

### Layer 1: Integration Glue (OpenClaw Skill)

**Files:**
- `openclaw/skills/tv/SKILL.md` — tool definition for the LLM
- `openclaw/skills/tv/scripts/tv` — bash CLI wrapping the relay API

**radmedia CLI commands:**
| Command | What It Does |
|---------|-------------|
| `radmedia status` | Full state: screen, playback, position, metadata, queue |
| `radmedia play <jellyfinId> [folderId]` | Deep-link play a specific Jellyfin item |
| `radmedia pause` | Pause playback |
| `radmedia resume` | Resume playback |
| `radmedia stop` | Stop and return to library |
| `radmedia next` | Next in queue |
| `radmedia prev` | Previous in queue |
| `radmedia seek <seconds>` | Seek to absolute position |
| `radmedia navigate <route>` | Navigate to screen (e.g. `/(tabs)/search`) |
| `radmedia remote <key>` | D-pad input (up/down/left/right/select/menu/play_pause) |
| `radmedia text <string>` | Send text input to search field |
| `radmedia ui:render <json>` | SDUI: render dynamic component on screen |
| `radmedia ui:components` | SDUI: list available components + schemas |

**Bot Tool Definition** (in `evals/tools/radmedia-tools.json`):
```json
{
  "type": "function",
  "function": {
    "name": "radmedia",
    "description": "Control the RadmediaTV Apple TV app...",
    "parameters": { "type": "object", "properties": { "command": { "type": "string" } } }
  }
}
```

### Layer 2: Command Bridge (WebSocket)

**Architecture: Client → Relay → App**

```
radmedia CLI ──WS──▶ Relay (openclaw.lan:9091/radmedia) ◀──WS── RadmediaTV app
```

The RadmediaTV app is a WebSocket **client** that connects to a relay server running on the N100
alongside OpenClaw. The relay brokers commands from the `radmedia` CLI to the app and forwards
state events from the app back to the CLI.

**Relay server:** `seedbox/services/bridge-relay/`
- Node.js, runs in the Docker LXC alongside other services
- Port 9091, path `/radmedia`
- Identifies app connection vs CLI connections
- Broadcasts CLI commands → app, streams app events → pending CLI responses

**RadmediaTV app side** (`radmedia/services/remoteBridgeService.ts`):
- WebSocket client connecting to `ws://openclaw.lan:9091/radmedia`
- Sends `HELLO app` on connect to identify itself
- Receives JSON-RPC requests, dispatches to handlers
- Pushes state events back to relay

**JSON-RPC 2.0 Protocol:**
```json
// Command (CLI → relay → app)
{ "jsonrpc": "2.0", "method": "playback.pause", "id": 1 }
{ "jsonrpc": "2.0", "method": "playback.play", "params": { "jellyfinId": "abc123" }, "id": 2 }
{ "jsonrpc": "2.0", "method": "navigation.push", "params": { "route": "/(tabs)/search" }, "id": 3 }
{ "jsonrpc": "2.0", "method": "state.status", "id": 4 }

// Response (app → relay → CLI)
{ "jsonrpc": "2.0", "id": 1, "result": { "ok": true } }
{ "jsonrpc": "2.0", "id": 4, "result": { "playback": { "status": "playing", ... }, "navigation": {...} } }

// Events (app → relay, pushed proactively)
{ "jsonrpc": "2.0", "method": "event.playback", "params": { "status": "playing", "positionSeconds": 342 } }
{ "jsonrpc": "2.0", "method": "event.navigation", "params": { "route": "/player", "params": {} } }
```

**PlaybackController singleton** (`radmedia/services/playbackController.ts`):
- Bridges React hooks ↔ bridge handlers
- `registerPlayer(controls)` — called by `player.tsx` on mount
- `unregisterPlayer()` — called by `player.tsx` on unmount
- `registerRouter(router)` — called by `_layout.tsx` on mount
- `getFullState()` → complete app state snapshot

**App initialization** (`radmedia/app/_layout.tsx`):
- `remoteBridgeService.start()` — opens WS connection on app boot
- `playbackController.registerRouter(router)` — wires Expo Router

**Player wiring** (`radmedia/app/player.tsx`):
- `playbackController.registerPlayer({pause, resume, stop, seek, next, prev, playById, getState, subscribe})`
- `playbackController.unregisterPlayer()` on unmount

### Layer 3: Generative UI (SDUI)

**Architecture:**

```
Bot decides to render UI:
  radmedia ui:render '{"component":"MovieGrid","props":{"movies":[...]}}'
    → relay → app
    → ComponentRegistry validates props with Zod
    → App renders <MovieGrid> as overlay
    → User selects item → event.ui.select pushed back
    → Bot receives event → calls radmedia play <id>
```

**ComponentRegistry** (`radmedia/services/componentRegistry.ts`):
- Singleton, mirrors `playQueueManager` / `libraryManager` pattern
- `registry.register({ name, description, component, propsSchema, focusConfig })`
- `registry.render(name, props)` → validates with Zod, returns React element
- `registry.getManifest()` → JSON schema array sent to LLM via `radmedia ui:components`

**SDUI Canvas screen** (`radmedia/app/sdui.tsx`):
- Subscribes to SDUI render events from `remoteBridgeService`
- Renders registered components as overlays or full screens
- Pushes `event.ui.select` back when user selects an item

**Initial components:**
| Component | Purpose |
|-----------|---------|
| `TextMessage` | Show text notification on screen |
| `NowPlayingCard` | Rich now-playing overlay with art, progress |
| `MovieGrid` | Focusable poster grid for dynamic movie lists |
| `SearchResults` | Mixed-type search results (movies + episodes + shows) |

---

## File Map

### RadmediaTV App (`radmedia/`)
| File | Status | Purpose |
|------|--------|---------|
| `bridge/types.ts` | ✅ Done | All TypeScript types |
| `bridge/protocol.ts` | ✅ Done | Zod schemas, JSON-RPC types |
| `bridge/handlers/playbackHandlers.ts` | ✅ Done | play/pause/stop/seek/next/prev |
| `bridge/handlers/navigationHandlers.ts` | ✅ Done | push/back/getCurrentRoute |
| `bridge/handlers/stateHandlers.ts` | ✅ Done | status/queue/library |
| `bridge/handlers/remoteHandlers.ts` | ✅ Done | remote.key, input.text/clear |
| `services/remoteBridgeService.ts` | ✅ Done | WS client transport + dispatcher |
| `services/playbackController.ts` | ✅ Done | Singleton bridge between hooks and bridge |
| `app/_layout.tsx` | ✅ Wired | Bridge start + router registration |
| `app/player.tsx` | ✅ Wired | registerPlayer/unregisterPlayer |
| `services/componentRegistry.ts` | ✅ Done | SDUI component registration |
| `app/sdui.tsx` | ✅ Done | SDUI canvas screen |
| `components/sdui/TextMessage.tsx` | ✅ Done | Base SDUI component |
| `components/sdui/NowPlayingCard.tsx` | ✅ Done | Now playing overlay |
| `components/sdui/MovieGrid.tsx` | ✅ Done | Dynamic movie grid |
| `components/sdui/SearchResults.tsx` | ✅ Done | Mixed search results |

### Relay Server (`seedbox/services/bridge-relay/`)
| File | Status | Purpose |
|------|--------|---------|
| `index.ts` | ✅ Done | WS relay server on port 9091 |
| `package.json` | ✅ Done | Node.js + ws dependency |

### OpenClaw Skill (`openclaw/skills/tv/`)
| File | Status | Purpose |
|------|--------|---------|
| `SKILL.md` | ✅ Done | Tool definitions + command reference |
| `scripts/radmedia` | ✅ Done | Bash CLI wrapping relay WS API |

### Evals (`evals/`)
| File | Status | Purpose |
|------|--------|---------|
| `tests/radmedia.yaml` | ✅ Done | Eval test cases for radmedia tool routing |
| `tools/radmedia-tools.json` | ✅ Done | Tool definition for promptfoo |

---

## Integration: Cinema Mode via RadmediaTV Events

RadmediaTV pushes `event.playback` → relay → HA webhook → bot notified:
- `status: playing` → `ha script cinema_preshow` (dim lights)
- `status: paused` → `ha script cinema_pause` (brighten)
- `status: playing` (after pause) → `ha script cinema_resume` (re-dim)
- `status: stopped/idle` → `ha script cinema_end` (restore scene)

HA webhook URL: `http://ha.lan:8123/api/webhook/radmedia_playback_event`

---

## Deployment

### Relay Server (N100 Docker LXC)
```bash
# Add to docker-compose.n100.yml as a new service
# Expose port 9091
# Auto-start with the rest of the stack
./scripts/n100-sync.sh relay   # future sync script entry
```

### OpenClaw Skill
```bash
./scripts/n100-sync.sh skills  # syncs all skills including tv
```

### RadmediaTV App
```bash
# Set env var before build
EXPO_PUBLIC_REMOTE_BRIDGE_RELAY_URL=ws://openclaw.lan:9091/radmedia
npm run prebuild:tv && npm run ios
```

---

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| WS topology | Client (app) → Relay → CLI | App can't run a server reliably on tvOS; relay avoids NAT/discovery issues |
| Protocol | JSON-RPC 2.0 | Standard, bash-friendly with `websocat`, error handling built-in |
| Relay language | Node.js | Already in the Docker LXC; no new runtime needed |
| SDUI validation | Zod | Single source of truth for schemas + LLM manifest generation |
| App identification | `HELLO app` message on connect | Simple, no auth overhead on local network |
