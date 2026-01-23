/**
 * withMultiAudioResourceLoader.js
 *
 * Expo config plugin for integrating MultiAudioResourceLoader Swift module.
 *
 * This plugin ensures the Swift module directory structure exists and provides
 * instructions for manual Xcode integration.
 *
 * IMPORTANT: Swift files must be manually added to Xcode project after prebuild.
 * This is a limitation of Expo's prebuild system with Swift modules.
 *
 * Manual Steps Required (After `expo prebuild`):
 * 1. Open ios/[YourAppName].xcworkspace in Xcode
 * 2. Right-click on [YourAppName] project → Add Files to "[YourAppName]"
 * 3. Navigate to ios/MultiAudioResourceLoader
 * 4. Select all .swift and .m files
 * 5. Ensure "Copy items if needed" is UNCHECKED
 * 6. Ensure "Create groups" is selected
 * 7. Ensure "Add to targets" has [YourAppName] checked
 * 8. Click "Add"
 * 9. Build Settings → Swift Compiler - General → Objective-C Bridging Header
 *    Set to: $(PROJECT_DIR)/MultiAudioResourceLoader/MultiAudioResourceLoader-Bridging-Header.h
 * 10. Build and run
 *
 * Created: January 23, 2026
 */

const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Expo config plugin to set up MultiAudioResourceLoader
 * @param {Object} config - Expo config object
 * @returns {Object} Modified config object
 */
function withMultiAudioResourceLoader(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosPath = path.join(projectRoot, "ios");
      const modulePath = path.join(iosPath, "MultiAudioResourceLoader");

      // Ensure the MultiAudioResourceLoader directory exists
      if (!fs.existsSync(modulePath)) {
        console.log(
          "[MultiAudioResourceLoader] Creating MultiAudioResourceLoader directory..."
        );
        fs.mkdirSync(modulePath, { recursive: true });
      } else {
        console.log(
          "[MultiAudioResourceLoader] MultiAudioResourceLoader directory already exists."
        );
      }

      // Check if Swift files exist
      const swiftFiles = [
        "MultiAudioResourceLoader.swift",
        "HLSManifestParser.swift",
        "HLSManifestGenerator.swift",
        "MultiAudioResourceLoader.m",
        "MultiAudioResourceLoader-Bridging-Header.h",
      ];

      const missingFiles = swiftFiles.filter(
        (file) => !fs.existsSync(path.join(modulePath, file))
      );

      if (missingFiles.length > 0) {
        console.warn(
          "[MultiAudioResourceLoader] WARNING: Missing Swift module files:"
        );
        missingFiles.forEach((file) => {
          console.warn(`  - ${file}`);
        });
        console.warn(
          "[MultiAudioResourceLoader] Please ensure all Swift module files are in ios/MultiAudioResourceLoader"
        );
      } else {
        console.log(
          "[MultiAudioResourceLoader] All Swift module files found."
        );
      }

      // Print manual integration instructions
      console.log("\n" + "=".repeat(80));
      console.log("[MultiAudioResourceLoader] MANUAL INTEGRATION REQUIRED");
      console.log("=".repeat(80));
      console.log("\nAfter running 'expo prebuild', you must manually add the Swift files to Xcode:");
      console.log("\n1. Open ios/[YourAppName].xcworkspace in Xcode");
      console.log("2. Right-click on [YourAppName] project → Add Files to \"[YourAppName]\"");
      console.log("3. Navigate to ios/MultiAudioResourceLoader");
      console.log("4. Select all .swift and .m files");
      console.log("5. Ensure \"Copy items if needed\" is UNCHECKED");
      console.log("6. Ensure \"Create groups\" is selected");
      console.log("7. Ensure \"Add to targets\" has [YourAppName] checked");
      console.log("8. Click \"Add\"");
      console.log("9. Build Settings → Swift Compiler - General → Objective-C Bridging Header");
      console.log("   Set to: $(PROJECT_DIR)/MultiAudioResourceLoader/MultiAudioResourceLoader-Bridging-Header.h");
      console.log("10. Build and run\n");
      console.log("=".repeat(80) + "\n");

      return config;
    },
  ]);
}

module.exports = withMultiAudioResourceLoader;
