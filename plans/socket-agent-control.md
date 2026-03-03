# Socket Agent Control Plan

Full remote control of the RadmediaTV Apple TV app from the Mac-side AI agent via WebSocket.

## Goal

The AI agent running on the Mac can send WebSocket commands to the Radmedia app to:
- Switch tabs (Library, AI, Search, Settings)
- Navigate focus with D-pad (up/down/left/right/select/menu)
- Trigger searches by typing text into the search field
- Push GenUI/SDUI components to the AI tab
- Control playback (play/pause/seek/next/prev)
- Query app state (current route, playback status, queue)
- Take screenshots via `sim-screenshot` after each action for verification

The agent should be able to put the app into any state without manual user interaction.

---

## Current Architecture

```
Mac (agent)                    N100 LXC 101                   Simulator / Apple TV
┌─────────────┐                ┌──────────────┐               ┌──────────────┐
│ tv-local.sh │──WebSocket───→│ Bridge Relay │←──WebSocket───│ Radmedia App │
│ (cli client)│                │ :9091        │               │ (app client) │
└─────────────┘                └──────────────┘               └──────────────┘
    HELLO cli →                   routes msgs                   ← HELLO app <deviceId>
    → JSON-RPC request            ─────────→                    → JSON-RPC request
    ← JSON-RPC response           ←─────────                   ← JSON-RPC response
```

**Relay server**: `seedbox/services/bridge-relay/index.js` — stateless Node.js broker using the `ws` npm module. Runs at `ws://openclaw.lan:9091/radmedia`.

**App client**: `radmedia/services/remoteBridgeService.ts` — React Native WebSocket, sends `HELLO app <deviceId>` on connect, dispatches JSON-RPC requests to registered handlers.

**Existing CLI**: `openclaw/skills/tv/scripts/tv` — bash wrapper calling Node.js with `require('ws')`. Works on N100 container. Fails on Mac because `ws` module not installed globally.

---

## The HELLO_ACK Problem

The `tv` CLI script (line 46) waits for a message with `msg.type === 'HELLO_ACK'` after sending `HELLO cli`. But the relay server (`bridge-relay/index.js` lines 76-81) **never sends HELLO_ACK** — it just registers the cli client and returns. The app also never sends HELLO_ACK.

This means the `tv` script hangs waiting for an ACK that never comes, then the 10s timeout fires.

**Root cause**: The `tv` script was written expecting an ACK that was never implemented in the relay.

**Fix options**:
1. **Fix the relay** (preferred): Add `ws.send('HELLO_ACK')` after registering CLI clients (line 80 of `bridge-relay/index.js`)
2. **Fix the tv script**: Remove the HELLO_ACK wait — send the JSON-RPC payload immediately after `HELLO cli` (there's no timing issue since the relay processes messages synchronously)
3. **Do both**: Add ACK to relay for robustness, and update the tv script to handle both cases

**Recommendation**: Option 3. Add `ws.send('HELLO_ACK')` to the relay, and update the `tv` script to send the payload immediately on HELLO_ACK (keeping backward compatibility).

---

## Implementation Plan

### Task 1: Fix the Bridge Relay (HELLO_ACK)

**File**: `seedbox/services/bridge-relay/index.js`

After line 80 (`return;`), add:
```js
ws.send('HELLO_ACK');
return;
```

This single line fixes the entire handshake. CLI clients get confirmation before sending payloads.

**Deploy**: `ssh root@openclaw.lan "cd /opt/automation/seedbox && docker restart bridge-relay"` (or however the relay container is managed).

### Task 2: Create Mac-Local Bridge Script

**File**: `radmedia/scripts/tv-bridge.mjs` (ES module, uses Node 24 native WebSocket)

A lightweight Node.js script that:
1. Connects to `ws://openclaw.lan:9091/radmedia` using native `WebSocket` (Node 22+, no npm deps)
2. Sends `HELLO cli`
3. Waits for `HELLO_ACK` (with 3s timeout fallback — send anyway if no ACK)
4. Sends the JSON-RPC payload
5. Waits for the response
6. Prints JSON to stdout and exits

**Interface**:
```bash
# Direct JSON-RPC
node scripts/tv-bridge.mjs '{"method":"state.status"}'

# Or with method + params shorthand
node scripts/tv-bridge.mjs navigation.push '{"route":"/(tabs)/ai"}'
```

**Why not just `npm install -g ws`?**: We want zero external deps. Node 24 has native `WebSocket`. The script should be self-contained.

### Task 3: Create Agent Wrapper Script

**File**: `radmedia/scripts/tv-local.sh`

Bash wrapper around `tv-bridge.mjs` with the same interface as the `tv` CLI:

```bash
./scripts/tv-local.sh status                          # App state
./scripts/tv-local.sh navigate "/(tabs)/ai"           # Switch to AI tab
./scripts/tv-local.sh navigate "/(tabs)/search"       # Switch to Search tab
./scripts/tv-local.sh navigate "/(tabs)/index"        # Switch to Library tab
./scripts/tv-local.sh dpad select                     # Press select
./scripts/tv-local.sh dpad up                         # D-pad up
./scripts/tv-local.sh text "breaking bad"             # Type into search
./scripts/tv-local.sh text:clear                      # Clear search input
./scripts/tv-local.sh ui:render '{"component":"MediaGrid","props":{...}}'
./scripts/tv-local.sh play <jellyfinId>               # Start playback
./scripts/tv-local.sh pause                           # Pause
./scripts/tv-local.sh screenshot                      # Capture sim screenshot
```

The `screenshot` command delegates to the `sim-screenshot` skill script.

### Task 4: Verify End-to-End

1. Start the simulator with the app running
2. Confirm the app connects to the relay (check relay logs)
3. Run `./scripts/tv-local.sh status` — should return full app state JSON
4. Run `./scripts/tv-local.sh navigate "/(tabs)/search"` — app switches tabs
5. Run `./scripts/tv-local.sh text "breaking bad"` — text appears in search
6. Run `./scripts/tv-local.sh dpad select` — search executes
7. Take screenshot to verify

### Task 5: Agent Integration Patterns

Once the script works, the agent workflow becomes:

```bash
# Navigate to search, type a query, verify results
./scripts/tv-local.sh navigate "/(tabs)/search"
sleep 0.5
./scripts/tv-local.sh text "The Bear"
sleep 0.5
./scripts/tv-local.sh dpad select
sleep 1
# Take screenshot to see results
sim-screenshot.sh

# Push a GenUI component to the AI tab
./scripts/tv-local.sh ui:render '{"component":"MediaGrid","props":{"title":"Recommended","items":[...]}}'
sleep 1
sim-screenshot.sh
```

---

## Available JSON-RPC Methods (Reference)

| Method | Params | Description |
|--------|--------|-------------|
| `state.status` | none | Full app state (navigation, playback, queue) |
| `state.queue` | none | Current play queue |
| `state.library` | none | Library state |
| `playback.play` | `{jellyfinId, folderId?}` | Play a Jellyfin item |
| `playback.pause` | none | Pause |
| `playback.resume` | none | Resume |
| `playback.stop` | none | Stop |
| `playback.seek` | `{position}` (seconds) | Seek to position |
| `playback.next` | none | Next in queue |
| `playback.prev` | none | Previous in queue |
| `navigation.push` | `{route, params?}` | Navigate to route |
| `navigation.back` | none | Go back |
| `navigation.getCurrentRoute` | none | Current route info |
| `remote.key` | `{key, action?}` | D-pad key (up/down/left/right/select/menu/play_pause) |
| `input.text` | `{text}` | Type text into focused input |
| `input.clear` | none | Clear focused input |
| `ui.render` | `{component, props, target?, navigateToTab?}` | Render SDUI component |
| `ui.components` | none | List available SDUI components |

## App Events (App → CLI)

| Event | Payload | Description |
|-------|---------|-------------|
| `event.playback` | `PlaybackState` | Playback state change |
| `event.navigation` | `NavigationState` | Route change |
| `event.queue` | `QueueState` | Queue change |
| `event.ui.select` | `{component, itemId, itemType?, title?}` | User selected SDUI item |
| `event.ui.action` | `{component, actionId, value?}` | User triggered SDUI action |
| `event.ui.dismiss` | `{component?, source}` | SDUI canvas dismissed |

## Tab Routes

| Tab | Route |
|-----|-------|
| Library (Home) | `/(tabs)/index` |
| AI | `/(tabs)/ai` |
| Search | `/(tabs)/search` |
| Settings | `/(tabs)/settings` |

---

## Key Files

| File | Role |
|------|------|
| `seedbox/services/bridge-relay/index.js` | Relay server (needs HELLO_ACK fix) |
| `services/remoteBridgeService.ts` | App-side WebSocket client |
| `bridge/protocol.ts` | Zod schemas for all messages |
| `bridge/handlers/navigationHandlers.ts` | navigation.push, navigation.back |
| `bridge/handlers/playbackHandlers.ts` | playback.play, pause, resume, etc. |
| `bridge/handlers/remoteHandlers.ts` | remote.key (D-pad), input.text |
| `bridge/handlers/sduiHandlers.ts` | ui.render, ui.components |
| `bridge/handlers/stateHandlers.ts` | state.status, state.queue, state.library |
| `services/componentRegistry.ts` | SDUI component manifest |
| `openclaw/skills/tv/scripts/tv` | Existing CLI (N100 only) |

## Success Criteria

- [ ] `tv-local.sh status` returns valid JSON from the app
- [ ] Tab switching works via `navigate`
- [ ] D-pad navigation works via `remote.key`
- [ ] Text input works for search
- [ ] `ui:render` pushes components to AI tab
- [ ] Agent can compose multi-step workflows (navigate → type → select → screenshot)
- [ ] Works on both simulator and physical Apple TV
