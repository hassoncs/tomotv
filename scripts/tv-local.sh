#!/usr/bin/env bash
# tv-local — TV control CLI for Mac (Radmedia app via WebSocket relay)
#
# Uses Node 24 native WebSocket (zero deps) to communicate with the
# Radmedia app running on simulator or Apple TV.
#
# Usage: tv-local <command> [args...]
#
# Note: This script does NOT include ATV hardware commands (on/off/vol/etc).
# For those, use the full `tv` CLI on the N100 container.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRIDGE="$SCRIPT_DIR/tv-bridge.mjs"

RELAY_URL="${RADMEDIA_RELAY_URL:-ws://openclaw.lan:9091/radmedia}"
export RADMEDIA_RELAY_URL

# ── Helpers ──────────────────────────────────────────────────────────────────

die() { echo "tv-local: error: $*" >&2; exit 1; }

# Send JSON-RPC request via bridge
rpc() {
  local method="$1"
  local params="${2:-}"
  
  if [[ -n "$params" ]]; then
    node "$BRIDGE" "$method" "$params"
  else
    node "$BRIDGE" "$method"
  fi
}

# ── Command dispatch ──────────────────────────────────────────────────────────

COMMAND="${1:-}"
shift || true

case "$COMMAND" in

  # ── Radmedia / Jellyfin (WebSocket relay) ────────────────────────────────

  status)
    rpc "state.status"
    ;;

  play)
    JELLYFIN_ID="${1:-}"
    FOLDER_ID="${2:-}"
    [[ -n "$JELLYFIN_ID" ]] || die "Usage: tv-local play <jellyfinId> [folderId]"
    if [[ -n "$FOLDER_ID" ]]; then
      rpc "playback.play" "{\"jellyfinId\":\"$JELLYFIN_ID\",\"folderId\":\"$FOLDER_ID\"}"
    else
      rpc "playback.play" "{\"jellyfinId\":\"$JELLYFIN_ID\"}"
    fi
    ;;

  pause)   rpc "playback.pause" ;;
  resume)  rpc "playback.resume" ;;
  stop)    rpc "playback.stop" ;;
  next)    rpc "playback.next" ;;

  prev|previous)
    rpc "playback.prev"
    ;;

  seek)
    POS="${1:-}"
    [[ -n "$POS" ]] || die "Usage: tv-local seek <seconds>"
    rpc "playback.seek" "{\"position\":$POS}"
    ;;

  navigate)
    ROUTE="${1:-}"
    PARAMS="${2:-}"
    [[ -n "$ROUTE" ]] || die "Usage: tv-local navigate <route> [params-json]"
    if [[ -n "$PARAMS" ]]; then
      rpc "navigation.push" "{\"route\":\"$ROUTE\",\"params\":$PARAMS}"
    else
      rpc "navigation.push" "{\"route\":\"$ROUTE\"}"
    fi
    ;;

  back)    rpc "navigation.back" ;;
  route)   rpc "navigation.getCurrentRoute" ;;

  dpad)
    KEY="${1:-}"
    ACTION="${2:-tap}"
    [[ -n "$KEY" ]] || die "Usage: tv-local dpad <up|down|left|right|select|menu|play_pause> [tap|hold]"
    rpc "remote.key" "{\"key\":\"$KEY\",\"action\":\"$ACTION\"}"
    ;;

  text)
    TEXT="${1:-}"
    [[ -n "$TEXT" ]] || die "Usage: tv-local text <string>"
    ESCAPED="${TEXT//\"/\\\"}"
    rpc "input.text" "{\"text\":\"$ESCAPED\"}"
    ;;

  text:clear)
    rpc "input.clear"
    ;;

  ui:components)
    rpc "state.status" | python3 -c "
import json, sys
state = json.load(sys.stdin)
manifest = state.get('sduiComponents', [])
print(json.dumps(manifest, indent=2))
" 2>/dev/null || rpc "state.status"
    ;;

  ui:render)
    PAYLOAD="${1:-}"
    [[ -n "$PAYLOAD" ]] || die "Usage: tv-local ui:render '{\"component\":\"Name\",\"props\":{...}}'"
    COMPONENT=$(echo "$PAYLOAD" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['component'])")
    PROPS=$(echo "$PAYLOAD" | python3 -c "import json,sys; d=json.load(sys.stdin); print(json.dumps(d.get('props', {})))")
    TARGET=$(echo "$PAYLOAD" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('target','canvas'))")
    NAV=$(echo "$PAYLOAD" | python3 -c "import json,sys; d=json.load(sys.stdin); print(str(d.get('navigateToTab',True)).lower())")
    rpc "ui.render" "{\"component\":\"$COMPONENT\",\"props\":$PROPS,\"target\":\"$TARGET\",\"navigateToTab\":$NAV}"
    ;;

  queue)   rpc "state.queue" ;;
  library) rpc "state.library" ;;

  # ── Screenshot (delegates to sim-screenshot skill) ─────────────────────────
  
  screenshot)
    # Use the sim-screenshot skill to capture the simulator
    if command -v sim-screenshot.sh &> /dev/null; then
      sim-screenshot.sh
    elif [[ -x "$SCRIPT_DIR/sim-screenshot.sh" ]]; then
      "$SCRIPT_DIR/sim-screenshot.sh"
    else
      die "sim-screenshot.sh not found. Install the sim-screenshot skill."
    fi
    ;;

  ""|--help|-h)
    cat <<'EOF'
tv-local — TV Control for Mac (Radmedia app via WebSocket)

JELLYFIN PLAYBACK:
  tv-local status                     Full app state (screen, playback, position, queue)
  tv-local play <id> [folderId]       Play Jellyfin item in Radmedia
  tv-local pause / resume / stop      Playback control
  tv-local next / prev                Queue navigation
  tv-local seek <seconds>             Seek to absolute position

NAVIGATION:
  tv-local navigate <route>           Push route (e.g. "/(tabs)/search")
  tv-local back                       Go back
  tv-local route                      Current route

REMOTE CONTROL:
  tv-local dpad <key> [action]        D-pad (up/down/left/right/select/menu/play_pause)
  tv-local text <string>              Send text to focused input
  tv-local text:clear                 Clear input

SDUI (SERVER-DRIVEN UI):
  tv-local ui:components              List available SDUI components + schemas
  tv-local ui:render '<json>'         Render a component on screen

STATE:
  tv-local queue                      Current play queue
  tv-local library                    Library state

UTILITIES:
  tv-local screenshot                 Capture simulator screenshot

TAB ROUTES:
  /(tabs)/index    Library (Home)
  /(tabs)/ai       AI tab
  /(tabs)/search   Search
  /(tabs)/settings Settings

EXAMPLES:
  tv-local status
  tv-local navigate "/(tabs)/search"
  tv-local text "The Bear"
  tv-local dpad select
  tv-local ui:render '{"component":"Toast","props":{"text":"Done!","style":"success"}}'

For ATV hardware control (on/off/vol/etc), use the full `tv` CLI on the N100 container.
EOF
    exit 0
    ;;

  *)
    die "Unknown command: $COMMAND. Run 'tv-local --help' for usage."
    ;;

esac
