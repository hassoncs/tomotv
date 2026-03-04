#!/bin/bash
# deploy-tv.sh — Build and deploy RadMedia to the physical Apple TV (Living Room)
#
# Usage:
#   ./scripts/deploy-tv.sh              # Full: prebuild + build + install + launch
#   ./scripts/deploy-tv.sh --skip-build # JS-only: just install existing build + launch
#   ./scripts/deploy-tv.sh --build-only # Build without installing or launching
#   ./scripts/deploy-tv.sh --metro-only # Just start Metro (no build/install)
#
# Metro is started automatically if not already running.
# The Mac's LAN IP is auto-detected and written to ip.txt during build.

set -euo pipefail

# ─── Device constants ───────────────────────────────────────────────────────
DEVICE_XCODE_ID="96e38ba14a39565bc83898eb7adcc66436e640d3"   # xcodebuild destination
DEVICE_UUID="3E2E1550-1549-58F4-8690-DA1CDA2BB713"          # devicectl UUID
BUNDLE_ID="com.hasson.radmedia"
WORKSPACE="ios/RadMedia.xcworkspace"
SCHEME="RadMedia"
METRO_PORT=8081

# ─── Paths ──────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ─── Colors ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()  { echo -e "${BLUE}▸${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC} $*"; }
err()   { echo -e "${RED}✗${NC} $*" >&2; }
header() { echo -e "\n${BLUE}━━━ $* ━━━${NC}"; }

# ─── Parse flags ────────────────────────────────────────────────────────────
SKIP_BUILD=false
BUILD_ONLY=false
METRO_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --build-only) BUILD_ONLY=true ;;
    --metro-only) METRO_ONLY=true ;;
    -h|--help)
      echo "Usage: $0 [--skip-build | --build-only | --metro-only]"
      echo ""
      echo "  (default)      Full: start Metro + prebuild + build + install + launch"
      echo "  --skip-build   JS-only change: install existing build + launch"
      echo "  --build-only   Build without installing or launching"
      echo "  --metro-only   Just start Metro (no build/install/launch)"
      exit 0
      ;;
    *)
      err "Unknown flag: $arg"
      exit 1
      ;;
  esac
done

# ─── Detect Mac LAN IP ─────────────────────────────────────────────────────
get_mac_ip() {
  local ip=""
  for iface in en0 en1 en2 en3 en4 en5; do
    ip=$(ipconfig getifaddr "$iface" 2>/dev/null || true)
    if [[ -n "$ip" ]]; then
      echo "$ip"
      return
    fi
  done
  # Fallback: any non-loopback IPv4
  ip=$(ifconfig | grep 'inet ' | grep -v ' 127\.' | grep -v ' 169\.254\.' | awk '{print $2}' | head -1)
  echo "${ip:-localhost}"
}

MAC_IP=$(get_mac_ip)

header "RadMedia → Apple TV Deploy"
info "Mac IP:  $MAC_IP"
info "Metro:   $MAC_IP:$METRO_PORT"
info "Device:  Living Room (Apple TV 4K)"
info "Bundle:  $BUNDLE_ID"

# ─── Ensure Metro is running ───────────────────────────────────────────────
ensure_metro() {
  if curl -s --max-time 2 "http://localhost:$METRO_PORT/status" | grep -q "packager-status:running" 2>/dev/null; then
    ok "Metro already running on port $METRO_PORT"
    return 0
  fi

  header "Starting Metro"
  info "Starting Expo dev server in background..."

  # Start Metro in a background process, logging to a file
  local log_file="$PROJECT_DIR/.metro.log"
  EXPO_TV=1 npx expo start --port "$METRO_PORT" > "$log_file" 2>&1 &
  local metro_pid=$!
  echo "$metro_pid" > "$PROJECT_DIR/.metro.pid"

  # Wait for Metro to become ready (up to 30s)
  local waited=0
  while [[ $waited -lt 30 ]]; do
    if curl -s --max-time 1 "http://localhost:$METRO_PORT/status" | grep -q "packager-status:running" 2>/dev/null; then
      ok "Metro started (PID $metro_pid, port $METRO_PORT)"
      return 0
    fi
    # Check if process died
    if ! kill -0 "$metro_pid" 2>/dev/null; then
      err "Metro process died. Check $log_file"
      tail -20 "$log_file" 2>/dev/null
      exit 1
    fi
    sleep 1
    waited=$((waited + 1))
  done

  err "Metro failed to start within 30s. Check $log_file"
  tail -20 "$log_file" 2>/dev/null
  exit 1
}

cd "$PROJECT_DIR"
ensure_metro

if $METRO_ONLY; then
  ok "Metro running. Use Ctrl+C or 'kill \$(cat .metro.pid)' to stop."
  exit 0
fi

# ─── Verify device is available ─────────────────────────────────────────────
header "Checking Apple TV"
device_list=$(xcrun devicectl list devices 2>&1 || true)
if echo "$device_list" | grep -q "$DEVICE_UUID"; then
  ok "Apple TV detected (Living Room)"
else
  err "Apple TV not found. Is it on the same network and paired?"
  info "Expected UUID: $DEVICE_UUID"
  info "Run: xcrun devicectl list devices"
  exit 1
fi

# ─── Build ──────────────────────────────────────────────────────────────────
if ! $SKIP_BUILD; then
  header "Building RadMedia (Debug → Apple TV)"
  info "This may take a few minutes..."

  xcodebuild \
    -workspace "$WORKSPACE" \
    -scheme "$SCHEME" \
    -destination "id=$DEVICE_XCODE_ID" \
    -configuration Debug \
    build 2>&1 | tail -5

  ok "Build succeeded"
fi

# ─── Find the built .app ───────────────────────────────────────────────────
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/RadMedia-*/Build/Products/Debug-appletvos -name "RadMedia.app" -maxdepth 1 -type d 2>/dev/null | head -1)

if [[ -z "$APP_PATH" ]]; then
  err "Built app not found in DerivedData."
  info "Try a full build: $0 (without --skip-build)"
  exit 1
fi

# Verify ip.txt has the correct IP
if [[ -f "$APP_PATH/ip.txt" ]]; then
  local_ip=$(cat "$APP_PATH/ip.txt" | tr -d '[:space:]')
  if [[ "$local_ip" == "$MAC_IP" ]]; then
    ok "ip.txt has correct Metro host: $local_ip"
  else
    warn "ip.txt has stale IP ($local_ip), updating to $MAC_IP"
    echo "$MAC_IP" > "$APP_PATH/ip.txt"
  fi
else
  warn "ip.txt missing — injecting Metro host: $MAC_IP"
  echo "$MAC_IP" > "$APP_PATH/ip.txt"
fi

if $BUILD_ONLY; then
  ok "Build complete: $APP_PATH"
  exit 0
fi

# ─── Install ────────────────────────────────────────────────────────────────
header "Installing on Apple TV"
xcrun devicectl device install app \
  --device "$DEVICE_UUID" \
  "$APP_PATH" 2>&1 | tail -3

ok "Installed"

# ─── Launch ─────────────────────────────────────────────────────────────────
header "Launching RadMedia"
xcrun devicectl device process launch \
  --device "$DEVICE_UUID" \
  "$BUNDLE_ID" 2>&1 | tail -3

ok "Launched!"

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
header "Ready"
info "App should connect to Metro at $MAC_IP:$METRO_PORT"
info "JS changes will hot-reload automatically"
info "To stop Metro: kill \$(cat .metro.pid) or Ctrl+C in that terminal"
echo ""
info "Dev menu on Apple TV: long-press Play/Pause on Siri Remote"
info "If Metro host is wrong: Dev Menu → Dev Settings → Debug server host & port"
