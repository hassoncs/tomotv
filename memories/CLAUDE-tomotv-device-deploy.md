# TommoTV: Building and Deploying to Physical Apple TV

**Last Updated:** 2026-03-01

## Device Info

| Field | Value |
|-------|-------|
| Device | Apple TV 4K (AppleTV6,2) "Living Room" |
| tvOS | 26.3 |
| xcodebuild destination ID | `96e38ba14a39565bc83898eb7adcc66436e640d3` |
| devicectl UUID | `3E2E1550-1549-58F4-8690-DA1CDA2BB713` |
| Bundle ID | `com.hassoncs.tommotv` |

**Critical:** xcodebuild and devicectl use DIFFERENT ID formats for the same device.
- `-destination "id=..."` → use the **xctrace/xcodebuild ID** (`96e38ba...`)
- `xcrun devicectl ... --device ...` → use the **devicectl UUID** (`3E2E1550...`)

Get them with:
```bash
xctrace list devices          # gives xcodebuild destination IDs
xcrun devicectl list devices  # gives devicectl UUIDs
```

## Build + Deploy Sequence

```bash
# 1. Prebuild (only needed when package.json or native code changed)
cd tomotv
EXPO_TV=1 npx expo prebuild --platform ios
# (if "directory not empty" error: rm -rf ios first)

# 2. Build for physical Apple TV
cd tomotv/ios
xcodebuild \
  -workspace TommoTV.xcworkspace \
  -scheme TommoTV \
  -destination "id=96e38ba14a39565bc83898eb7adcc66436e640d3" \
  -configuration Debug \
  build

# 3. Install the built app
APP_PATH=$(find ~/Library/Developer/Xcode/DerivedData/TommoTV-*/Build/Products/Debug-appletvos -name TommoTV.app -maxdepth 1 | head -1)
xcrun devicectl device install app \
  --device 3E2E1550-1549-58F4-8690-DA1CDA2BB713 \
  "$APP_PATH"

# 4. Launch the app
xcrun devicectl device process launch \
  --device 3E2E1550-1549-58F4-8690-DA1CDA2BB713 \
  com.hassoncs.tommotv
```

## When Prebuild Is Required

Prebuild regenerates the `ios/` native project. Required when:
- `package.json` modified (new npm deps added)
- `app.json` / `app.config.ts` modified
- Native Swift code in `native/` changed
- First time after cloning

Not required for:
- TypeScript/JS-only changes (bridge, services, components)
- Skill/CLI changes (those deploy via n100-sync.sh)

After JS-only changes, just build+install — no prebuild needed.

## Common Failure Points

| Error | Cause | Fix |
|-------|-------|-----|
| `ENOTEMPTY rmdir ios` | prebuild --clean can't delete | `rm -rf ios` first |
| `No tvOS devices available in Simulator.app` | `expo run:ios` can't find physical TV | Use xcodebuild directly (it works) |
| Device disconnected immediately (devicectl error 4000) | Wrong UUID format | Use correct UUID per tool (see above) |
| `CoreDeviceService unable to locate device` | Wrong ID format for xcodebuild | Use xctrace ID not devicectl UUID |

## Relay Bridge

The app auto-connects to `ws://openclaw.lan:9091/tomotv` on startup (hardcoded default).
After launch, check it connected:

```bash
ssh root@openclaw.lan "docker logs bridge-relay --tail 5"
# Should show: [bridge-relay] App connected
```

Test end-to-end:
```bash
ssh root@openclaw.lan "docker exec openclaw tommo status" | python3 -m json.tool | head -20
```
