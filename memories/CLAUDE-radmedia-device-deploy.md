# RadmediaTV: Building and Deploying to Physical Apple TV

**Last Updated:** 2026-03-02

## Quick Deploy

```bash
cd radmedia
./scripts/deploy-tv.sh              # Full: Metro + build + install + launch
./scripts/deploy-tv.sh --skip-build # JS-only: reuse existing build
./scripts/deploy-tv.sh --metro-only # Just start Metro
```

## Device Info

| Field | Value |
|-------|-------|
| Device | Apple TV 4K (AppleTV6,2) "Living Room" |
| tvOS | 26.3 |
| xcodebuild destination ID | `96e38ba14a39565bc83898eb7adcc66436e640d3` |
| devicectl UUID | `3E2E1550-1549-58F4-8690-DA1CDA2BB713` |
| Bundle ID | `com.hasson.radmedia` |
| Workspace | `ios/RadMedia.xcworkspace` |
| Scheme | `RadMedia` |

**Critical:** xcodebuild and devicectl use DIFFERENT ID formats for the same device.
- `-destination "id=..."` → use the **xctrace/xcodebuild ID** (`96e38ba...`)
- `xcrun devicectl ... --device ...` → use the **devicectl UUID** (`3E2E1550...`)

Get them with:
```bash
xctrace list devices          # gives xcodebuild destination IDs
xcrun devicectl list devices  # gives devicectl UUIDs
```

## Manual Build + Deploy Sequence

If not using `deploy-tv.sh`, follow these steps in order:

```bash
cd radmedia

# 0. START METRO FIRST (required for Debug builds on real devices!)
#    Metro must be running so the app can load JS at runtime.
#    The build writes your Mac's LAN IP to ip.txt inside the .app,
#    so the Apple TV knows where to find Metro.
EXPO_TV=1 npx expo start &

# 1. Prebuild (only needed when package.json or native code changed)
EXPO_TV=1 npx expo prebuild --platform ios
# (if "directory not empty" error: rm -rf ios first)

# 2. Build for physical Apple TV
xcodebuild \
  -workspace ios/RadMedia.xcworkspace \
  -scheme RadMedia \
  -destination "id=96e38ba14a39565bc83898eb7adcc66436e640d3" \
  -configuration Debug \
  build

# 3. Install the built app
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/RadMedia-*/Build/Products/Debug-appletvos -name RadMedia.app -maxdepth 1 | head -1)
xcrun devicectl device install app \
  --device 3E2E1550-1549-58F4-8690-DA1CDA2BB713 \
  "$APP_PATH"

# 4. Launch the app
xcrun devicectl device process launch \
  --device 3E2E1550-1549-58F4-8690-DA1CDA2BB713 \
  com.hasson.radmedia
```

## How Metro Discovery Works (Debug builds)

In Debug mode, `react-native-xcode.sh` (the "Bundle React Native" build phase) does two things:
1. **Writes `ip.txt`** with your Mac's LAN IP to the .app bundle (before `SKIP_BUNDLING` check)
2. **Skips JS bundling** (`SKIP_BUNDLING=1` for Debug) — the app loads JS from Metro at runtime

When the app launches on the Apple TV:
1. `RCTBundleURLProvider` reads `ip.txt` → gets your Mac's IP (e.g., `192.168.1.194`)
2. Connects to `http://<mac-ip>:8081` to load the JS bundle from Metro
3. If Metro isn't running → **"metro seems to be not running"** error

The `deploy-tv.sh` script handles all of this automatically, including verifying `ip.txt` has the correct IP.

## When Prebuild Is Required

Prebuild regenerates the `ios/` native project. Required when:
- `package.json` modified (new npm deps added)
- `app.json` / `app.config.ts` modified
- Native Swift code in `native/` changed
- First time after cloning

Not required for:
- TypeScript/JS-only changes (bridge, services, components)
- Skill/CLI changes (those deploy via n100-sync.sh)

After JS-only changes: Metro hot-reloads automatically — no rebuild needed.
If app was uninstalled or `ip.txt` is stale: `./scripts/deploy-tv.sh --skip-build`

## Dev Menu on Apple TV

**Long-press the Play/Pause button** on the Siri Remote to open the React Native dev menu.

Useful for:
- Reload JS bundle
- Dev Settings → Debug server host & port (change Metro IP/port)
- Toggle inspector, performance overlay

## Common Failure Points

| Error | Cause | Fix |
|-------|-------|-----|
| "metro seems to be not running" | Metro not started before launching app | Start Metro: `EXPO_TV=1 npx expo start` |
| "metro seems to be not running" (Metro IS running) | ip.txt has wrong IP (Mac IP changed) | Rebuild, or use dev menu to set correct host |
| `ENOTEMPTY rmdir ios` | prebuild --clean can't delete | `rm -rf ios` first |
| `No tvOS devices available in Simulator.app` | `expo run:ios` can't find physical TV | Use xcodebuild directly (it works) |
| Device disconnected immediately (devicectl error 4000) | Wrong UUID format | Use correct UUID per tool (see above) |
| `CoreDeviceService unable to locate device` | Wrong ID format for xcodebuild | Use xctrace ID not devicectl UUID |

## Relay Bridge

The app auto-connects to `ws://openclaw.lan:9091/radmedia` on startup (hardcoded default).
After launch, check it connected:

```bash
ssh root@openclaw.lan "docker logs bridge-relay --tail 5"
# Should show: [bridge-relay] App connected
```

Test end-to-end:
```bash
ssh root@openclaw.lan "docker exec openclaw radmedia status" | python3 -m json.tool | head -20
```

## Network Troubleshooting

### Verifying Metro is LAN-Accessible

Metro must be reachable from the Apple TV over LAN. Test from the Mac itself:

```bash
# Test on localhost (should always work)
curl -s http://localhost:8081/status
# → packager-status:running

# Test on LAN IP (this is what the Apple TV uses)
curl -s http://192.168.1.194:8081/status
# → packager-status:running (if reachable)
# → empty reply or timeout (if something is blocking)
```

If localhost works but LAN IP doesn't → something is intercepting incoming LAN connections.

### Tailscale Blocks Incoming LAN Connections (KNOWN ISSUE)

**Symptom:** Metro runs fine, `curl localhost:8081/status` works, but `curl 192.168.1.194:8081/status` returns empty reply. Apple TV shows "metro seems to be not running".

**Root Cause:** The N100 Proxmox server (`100.114.25.36`) advertises `192.168.1.0/24` as a Tailscale subnet route. Even with `--accept-routes=false`, the macOS Tailscale GUI app's **Network Extension** (`io.tailscale.ipn.macsys.network-extension`) intercepts traffic for that range because the subnet is advertised in the tailnet. The extension's packet filter takes precedence over local routing.

**Quick workaround:** Quit Tailscale while developing.

**Permanent fix:** Switch from the Tailscale GUI app to the open-source `tailscaled` daemon:

```bash
# 1. Quit the GUI app
killall Tailscale

# 2. Install the CLI/daemon version (no System Extension)
brew install tailscale

# 3. Start the daemon (uses utun, no Network Extension filter)
sudo brew services start tailscale

# 4. Connect without accepting the conflicting subnet route
tailscale up --accept-routes=false
```

The open-source version uses a standard `utun` device and does NOT install the aggressive System Extension packet filter. Local `192.168.1.x` traffic stays on the native macOS networking stack.

**Key Tailscale GitHub issues:**
- [#1227](https://github.com/tailscale/tailscale/issues/1227) — When local route is available to a subnet, bypass tailscale subnet relay
- [#177](https://github.com/tailscale/tailscale/issues/177) — tailscaled: get working on macOS with homebrew
- [Tailscale macOS variants docs](https://tailscale.com/docs/concepts/macos-variants) — explains the three installation modes

**Why `--exit-node-allow-lan-access` doesn't help:** That flag controls *outgoing* traffic from the Mac to LAN while an exit node is active. It does not prevent the Network Extension from intercepting *incoming* connections.

### TripMode (Orphaned Network Filter)

TripMode installs a network filter extension. Deleting TripMode.app does NOT remove the extension.

**To remove:**
1. System Settings → General → Login Items & Extensions → Network Extensions
2. Disable the TripMode extension
3. Reboot (extension shows `[terminated waiting to uninstall on reboot]` until then)

### macOS Application Firewall

The macOS firewall can block incoming connections to Metro. If Tailscale is ruled out:

```bash
# Check firewall status
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Temporarily disable (re-enable after testing!)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate off
```

**Re-enable the firewall** once the network issue is resolved.
