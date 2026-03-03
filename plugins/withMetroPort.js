/**
 * withMetroPort.js
 *
 * Exactly mirrors the working pattern from slopcade/apps/amen/plugins/withMetroPort.js.
 *
 * The root problem: when ios.buildReactNativeFromSource is NOT 'true', the Podfile sets
 * ENV['RCT_USE_PREBUILT_RNCORE'] = '1' which makes CocoaPods use the prebuilt React Core
 * xcframework. That binary has RCT_METRO_PORT=8081 hardcoded — no xcconfig or pbxproj
 * edit can change it after the fact.
 *
 * Fix:
 *   1. withPodfileProperties → ios.buildReactNativeFromSource: true → forces source build
 *   2. withDangerousMod → injects ENV['RCT_METRO_PORT']='8031' at top of Podfile so
 *      pod install compiles React-Core with the correct port baked in
 */

const { withDangerousMod, withPodfileProperties } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const METRO_PORT = 8031;

function withMetroPort(config) {
  // ── Step 1: Force source build (disable prebuilt React Core) ─────────────
  // Without this, RCT_USE_PREBUILT_RNCORE=1 and port changes have no effect.
  config = withPodfileProperties(config, (config) => {
    config.modResults["ios.buildReactNativeFromSource"] = "true";
    console.log("[withMetroPort] ✓ Podfile.properties.json → ios.buildReactNativeFromSource: true");
    return config;
  });

  // ── Step 2: Inject ENV['RCT_METRO_PORT'] into Podfile ────────────────────
  // This Ruby env var is read by CocoaPods scripts during pod install and flows
  // through to GCC_PREPROCESSOR_DEFINITIONS, compiling the port into React-Core.
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      let podfile = fs.readFileSync(podfilePath, "utf8");
      const metroPortLine = `ENV['RCT_METRO_PORT'] = '${METRO_PORT}'`;

      if (podfile.includes("ENV['RCT_METRO_PORT']")) {
        // Replace existing value
        podfile = podfile.replace(/ENV\['RCT_METRO_PORT'\] = '\d+'/, metroPortLine);
        fs.writeFileSync(podfilePath, podfile);
        console.log(`[withMetroPort] ✓ Podfile → updated RCT_METRO_PORT=${METRO_PORT}`);
        return config;
      }

      // Inject before the first require/platform line
      const insertMarker = /^(require |platform :)/m;
      const insertBlock = `# Metro bundler port (non-standard to avoid conflicts)\n${metroPortLine}\n\n`;
      podfile = podfile.replace(insertMarker, insertBlock + "$1");
      fs.writeFileSync(podfilePath, podfile);
      console.log(`[withMetroPort] ✓ Podfile → injected ENV['RCT_METRO_PORT']=${METRO_PORT}`);
      return config;
    },
  ]);

  return config;
}

module.exports = withMetroPort;
