# TommoTV tvOS Build Debug Log

## What's Working ✅

1. **ReactNativeFactoryProvider fixed** — `expo-tvos-search@2.0.0` had `"expo-modules-core": "*"` peer dep, pulling v55.0.13 (SDK 55) to root. Pods linked root version which lacked the protocol. Fix: added `expo-modules-core@~3.0.25` as direct dep + override in package.json. All three consumers now resolve to `3.0.29` deduped.

2. **Code signing fixed** — Added `"appleTeamId": "24T4GAP365"` to app.json `ios` section so `DEVELOPMENT_TEAM` survives `prebuild --clean`.

3. **Prebuild works** — `EXPO_TV=1 expo prebuild --clean` succeeds, CocoaPods install clean.

4. **Physical Apple TV detected** — "Living Room (2)" Apple TV 4K (AppleTV6,2), Xcode UDID: `96e38ba14a39565bc83898eb7adcc66436e640d3`

5. **Swift compilation works** — Got past all Swift/ObjC compilation. Build progresses to asset catalog and storyboard compilation before failing.

## Environment

- **macOS**: Tahoe (macOS 26) — ONLY Xcode 26.x works. Xcode 16.x refuses to launch ("not compatible with macOS Tahoe").
- **Xcode**: Updating from 26.2 → 26.3 via App Store (in progress)
- **Expo**: 54.0.23
- **react-native**: npm:react-native-tvos@0.81.4-0
- **Apple ID**: hassoncs@gmail.com (2FA enabled)

## Current Blocker ❌

**tvOS simulator runtime won't register — needed even for physical device builds.**

Two sub-issues:
1. **Xcode 26.2**: SDK build `23K50` vs runtime build `23K51` mismatch → runtime shows "Unavailable"
2. **tvOS 18.5 runtime** (for Xcode 16.4): Download succeeds but install fails with I/O error: `SimDiskImageErrorDomain Code=5 "(100005 UNIX[Input/output error]"`

Both `actool` (asset catalog) and `ibtool` (storyboard) require a registered simulator runtime even when targeting a physical device.

## Current Plan

**Updating Xcode 26.2 → 26.3** via App Store. Xcode 26.3 says it includes tvOS 26.2 SDK — the version bump may fix the 23K50/23K51 mismatch.

**If that fails**: Track B — bypass the runtime requirement using an Expo config plugin to remove SplashScreen.storyboard + xcodebuild flags to skip actool's simulator check.

## Failed Attempts (DO NOT RETRY)

1. ❌ `xcodebuild -downloadPlatform tvOS` — re-downloads same 23K51
2. ❌ `xcodebuild -downloadAllPlatforms` — same result
3. ❌ `xcrun simctl runtime match set "appletvos26.2" <UUID>` — sets user override but runtime still "unavailable"
4. ❌ `sudo killall -9 com.apple.CoreSimulator.CoreSimulatorService` — no change after restart
5. ❌ `xcrun simctl runtime scan-and-mount` — no change
6. ❌ Delete runtime + re-download — same 23K51 build re-downloaded
7. ❌ Build with `ENABLE_ONLY_ACTIVE_RESOURCES=NO` + skip thinning flags — storyboard still fails
8. ❌ Build with `generic/platform=tvOS` destination — same storyboard error
9. ❌ Patch version.plist (23K50→23K51) via sudo tmux session — plists changed BUT broke device destination resolution. Xcode no longer recognized its own tvOS platform.
10. ❌ **Install Xcode 16.4 stable** — macOS Tahoe REFUSES to launch it. "The version of Xcode installed on this Mac is not compatible with macOS Tahoe."
11. ❌ tvOS 18.5 runtime install (for Xcode 16.4) — I/O error on verification: `SimDiskImageErrorDomain Code=5`

## Track B: Bypass Runtime (FALLBACK)

From librarian research — if Xcode 26.3 doesn't fix it:

### Remove storyboard from build
Create `plugins/withNoStoryboard.js`:
```javascript
const { withInfoPlist, withXcodeProject } = require('@expo/config-plugins');
module.exports = (config) => {
  config = withInfoPlist(config, (config) => {
    delete config.modResults.UILaunchStoryboardName;
    config.modResults.UILaunchScreen = {
      "UIColorName": "SplashScreenBackground",
      "UIImageName": "SplashScreen",
    };
    return config;
  });
  config = withXcodeProject(config, (config) => {
    config.modResults.removeResourceFile('SplashScreen.storyboard');
    return config;
  });
  return config;
};
```

### Skip actool simulator check
```bash
xcodebuild ... \
  ASSETCATALOG_COMPILER_SKIP_APP_ICON_COMPILATION=YES \
  ASSETCATALOG_COMPILER_GENERATE_ASSET_SYMBOLS=NO \
  EXCLUDED_SOURCE_FILE_NAMES="SplashScreen.storyboard"
```

## Key Device Info

| Item | Value |
|------|-------|
| Apple TV name | Living Room (2) |
| Apple TV model | Apple TV 4K (AppleTV6,2) |
| Xcode UDID | `96e38ba14a39565bc83898eb7adcc66436e640d3` |
| CoreDevice ID | `3E2E1550-1549-58F4-8690-DA1CDA2BB713` |
| Dev Team | `24T4GAP365` |
| Bundle ID | `com.hassoncs.tommotv` |
