# Handoff: Skia Shader Spike + Socket Agent Control

Two independent workstreams. Can be tackled in parallel or sequentially.

---

## Workstream 1: Socket Agent Control

### Goal
Make it trivial for the AI agent (running on the Mac) to control the Radmedia Apple TV app via WebSocket commands — navigate tabs, trigger SDUI renders, send remote key events, take screenshots, and verify UI state. The agent should be able to put the app into any state it needs without manual user interaction.

### What Already Exists

**Full WebSocket bridge infrastructure** is built and working in the app:

| File | What It Does |
|------|-------------|
| `services/remoteBridgeService.ts` | WebSocket connection to relay, dispatches JSON-RPC messages |
| `bridge/protocol.ts` | Zod schemas for all JSON-RPC methods |
| `bridge/handlers/navigationHandlers.ts` | `navigation.push`, `navigation.back`, `navigation.getCurrentRoute` |
| `bridge/handlers/remoteHandlers.ts` | `remote.key` (D-pad: up/down/left/right/select/menu), `input.text`, `input.clear` |
| `bridge/handlers/sduiHandlers.ts` | `ui.render` — push arbitrary React components to screen |
| `services/playbackController.ts` | Central singleton for playback + navigation, receives router from root layout |
| `app/_layout.tsx` | Root layout registers Expo Router with `playbackController`, starts `remoteBridgeService` |

**Available JSON-RPC methods:**
- `navigation.push` — `{ route: "/(tabs)/ai", params?: {} }` → navigate to any route
- `navigation.back` — go back
- `navigation.getCurrentRoute` — get current route
- `remote.key` — `{ key: "select"|"up"|"down"|"left"|"right"|"menu"|"play_pause", action?: "tap"|"hold" }`
- `input.text` — `{ text: "query string" }` → type into focused input
- `input.clear` — clear focused input
- `ui.render` — `{ name: "ComponentName", props: {...}, navigateToTab?: true }` → push SDUI component
- Playback: `playback.play`, `playback.pause`, `playback.resume`, `playback.stop`, `playback.seek`, `playback.next`, `playback.prev`
- `playback.status` — full playback + queue state

**The `tv` CLI** (`openclaw/skills/tv/scripts/tv`) wraps all of this as a bash script. It works on the N100 container where `ws` is globally installed but fails on the Mac because `require('ws')` is missing.

### The Problem

The relay runs at `ws://openclaw.lan:9091/radmedia`. The simulator app connects to it via `EXPO_PUBLIC_REMOTE_BRIDGE_RELAY_URL` from `.env.local`. The `tv` CLI connects to the same relay as a "cli" client.

**Connection tested from Mac:**
- HTTP to `openclaw.lan:9091` → returns 426 (Upgrade Required) — relay IS running
- Native `WebSocket` in Node 24 → connects, but `HELLO cli` gets no `HELLO_ACK` response
- Possible causes: relay protocol mismatch with Node native WebSocket, or app not connected to relay, or HELLO_ACK requires an app client to be present

### What Needs to Happen

1. **Diagnose why the Mac-side WebSocket doesn't get HELLO_ACK** — check the relay source code (likely in `openclaw/` or on the N100), verify the simulator app is actually connected to the relay, check if the relay needs the `ws` npm module's specific WebSocket subprotocol headers

2. **Make a Mac-local script that can send JSON-RPC to the app** — options:
   - Fix the relay connection (preferred — uses existing infra)
   - Install `ws` globally on Mac and use the `tv` CLI directly: `npm install -g ws`
   - Create a simple wrapper that uses Node 24's native WebSocket with whatever handshake the relay needs
   - Or bypass the relay entirely: add a direct WebSocket server inside the app that agents can connect to locally (the simulator exposes localhost ports)

3. **Create an agent-friendly tool/script** — something that can be called from the agent like:
   ```bash
   ./scripts/tv-local.sh navigate "/(tabs)/ai"
   ./scripts/tv-local.sh screenshot
   ./scripts/tv-local.sh status
   ./scripts/tv-local.sh render '{"name":"MediaGrid","props":{...}}'
   ```

4. **Integrate with sim-screenshot** — the `sim-screenshot` skill (`~/.claude/skills/sim-screenshot/scripts/sim-screenshot.sh`) already captures the simulator screen. The agent workflow should be: send command → wait briefly → screenshot → verify.

### Key Files to Read

- `services/remoteBridgeService.ts` — how the app connects, HELLO handshake format
- `bridge/protocol.ts` — all method schemas
- `bridge/handlers/*.ts` — all handlers
- `openclaw/skills/tv/scripts/tv` — full CLI implementation (251 lines)
- `.env.local` — `EXPO_PUBLIC_REMOTE_BRIDGE_RELAY_URL` value

### Relay Architecture

```
Mac (agent)                    N100 Server                    Simulator (or real Apple TV)
┌─────────┐                    ┌──────────────┐               ┌──────────────┐
│ tv CLI  │──WebSocket───────→│ Bridge Relay │←──WebSocket───│ Radmedia App │
│ (cli)   │                    │ :9091        │               │ (app client) │
└─────────┘                    └──────────────┘               └──────────────┘
    HELLO cli →                   routes msgs                   ← HELLO app <deviceId>
    ← HELLO_ACK                   between clients               ← HELLO_ACK
    → JSON-RPC request            ─────────→                    → JSON-RPC request
    ← JSON-RPC response           ←─────────                   ← JSON-RPC response
```

---

## Workstream 2: Skia Shader Spike

### Goal
Prove that `@shopify/react-native-skia` SkSL shaders work on tvOS by rendering an animated iridescent shader as a full-screen background on the AI page. If successful, the technique can be expanded to the Library page for a clear-top/blur-bottom shader replacing `DynamicBackground`.

### Current State — CODE IS WRITTEN AND PASSES ALL CHECKS

The implementation is done and verified. Just needs visual confirmation on the simulator.

**Changes made:**

| File | Change |
|------|--------|
| `components/SkiaShaderBackground.tsx` | **NEW** — Full-screen Skia Canvas with animated iridescent SkSL shader |
| `app/(tabs)/ai.tsx` | Replaced `DynamicBackground` import/usage with `SkiaShaderBackground` |
| `jest.setup.js` | Added `@shopify/react-native-skia` mock for Jest |

**Verification results:**
- ✅ `tsc --noEmit` — passes clean (0 errors)
- ✅ Prettier — files formatted
- ✅ Lint — 0 errors in changed files (all errors are pre-existing in other files)
- ✅ Tests — 26 pass, 2 pre-existing failures (Worklets mock issue, unrelated)

**Also fixed:** Pre-existing duplicate `<TvosSearchViewWithChildren` tags in `ai.tsx` (lines 227-228 and 291-292 were duplicated).

### Skia Findings

| Aspect | Status |
|--------|--------|
| `@shopify/react-native-skia` | v2.4.21 installed, in package.json |
| Native pods linked | ✅ In Podfile.lock, `react-native-skia 2.4.21` compiled |
| Previously used in app | ❌ Zero imports before this change |
| tvOS shader support | ✅ Confirmed — Metal acceleration, tvOS ≥ 13.0 |
| SkSL RuntimeEffect | ✅ Supported, `vec4 main(vec2 pos)` entry point |

### The Shader

Located in `components/SkiaShaderBackground.tsx`. Uses IQ's cosine palette technique for an iridescent fractal effect:
- Animated via Reanimated `useSharedValue` + `withRepeat(withTiming(...))`
- Compiled once at module level via `Skia.RuntimeEffect.Make()`
- Dimmed to 35% opacity to work as a background
- `pointerEvents="none"` so it doesn't capture tvOS focus
- Seamless looping (target is multiple of 2π)

### What Needs to Happen

1. **Navigate to the AI tab** (use Workstream 1's socket control once working, or manually)
2. **Take a screenshot** to verify the shader renders
3. **If it works:** success — shaders are proven on tvOS
4. **If it doesn't render:** check Skia's Metal compatibility, try a simpler shader first (solid color fill), check if Canvas even mounts

### Future Vision (after spike succeeds)

On the Library page, replace `DynamicBackground.tsx` (expo-image blurRadius + expo-linear-gradient) with a Skia shader that:
- Takes the current backdrop image as a texture input via `ImageShader`
- Top half: crystal clear (no blur)
- Bottom half: blurry (via a box/gaussian blur kernel in SkSL)
- The blur line position is a `uniform float u_blurLine` controlled from JS
- As users scroll down from the carousel, the blur line moves up dynamically
- Full control over the transition — no dependency on `expo-blur` limitations

**Variable blur shader pattern (from research):**
```sksl
uniform shader image;
uniform float u_blurRadius;  // 0.0 to 20.0+
uniform float u_blurLine;    // 0.0 (top) to 1.0 (bottom)
uniform vec2 u_resolution;

vec4 main(vec2 pos) {
    vec2 uv = pos / u_resolution;
    float blurAmount = smoothstep(u_blurLine - 0.1, u_blurLine + 0.1, uv.y) * u_blurRadius;
    // 9-tap box blur with variable radius
    vec4 color = vec4(0.0);
    float total = 0.0;
    for (float x = -2.0; x <= 2.0; x++) {
        for (float y = -2.0; y <= 2.0; y++) {
            color += image.eval(pos + vec2(x, y) * blurAmount);
            total += 1.0;
        }
    }
    return color / total;
}
```

### Current Blur Implementation (for reference, NOT Skia)

- `components/DynamicBackground.tsx` — `expo-image` with `blurRadius={50}` + `expo-linear-gradient` overlays + Reanimated cross-fade
- `components/SmartGlassView.tsx` — `expo-blur` `BlurView` for glass effects on cards/carousel
- `components/HeroBillboard.tsx` — carousel uses `SmartGlassView` for metadata panel

---

## Environment State

- **Apple TV simulator:** Booted (`CCD5D246-2222-401D-8EC4-A1759F4E589C`)
- **Metro:** Running on port 8081 (JS changes hot-reload automatically)
- **Current tab:** Library (showing RuPaul's Drag Race hero)
- **Relay:** Running at `openclaw.lan:9091` (HTTP 426 confirms it's up)
- **Node:** v24.2.0 (has native WebSocket)
- **No native rebuild needed:** All changes are JS-only

## Git Status

Uncommitted changes in radmedia/:
- `components/SkiaShaderBackground.tsx` (new)
- `app/(tabs)/ai.tsx` (modified — SkiaShaderBackground import, fixed duplicate tags)
- `jest.setup.js` (modified — added Skia mock)
