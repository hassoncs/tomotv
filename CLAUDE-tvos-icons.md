# tvOS App Icons & Top Shelf Images

This document covers Apple TV icon setup, folder structure, naming requirements, and common validation errors.

## Backup & Restore

There is a backup copy of Image.xcassets in the `./Images.xcassets` folder. This contains the multilayer icon setup for tvOS. If `npm run prebuild` is ran, copy the contents of this folder back into the `./ios/tomotv/Images.xcassets` folder to restore the multilayer icon setup.

```bash
export EXPO_TV=1
npm run prebuild
```

After prebuild, restore the backup:
```bash
cp -r ./Images.xcassets/* ./ios/tomotv/Images.xcassets/
```

## Asset Location

Located in `ios/tomotv/Images.xcassets/Brand Assets.brandassets/`

## Required Structure

```
Brand Assets.brandassets/
├── Contents.json
├── App Icon.imagestack/           # Home screen icon (400x240)
│   ├── Front.imagestacklayer/
│   ├── Middle.imagestacklayer/
│   └── Back.imagestacklayer/
├── App Icon - App Store.imagestack/  # App Store icon (1280x768)
│   ├── Front.imagestacklayer/
│   ├── Middle.imagestacklayer/
│   └── Back.imagestacklayer/
├── Top Shelf Image.imageset/      # Top shelf (1920x720 @1x, @2x)
└── Top Shelf Image Wide.imageset/ # Top shelf wide (2320x720 @1x, @2x)
```

## Critical Naming Requirements

Asset names in `Contents.json` must match exactly:
- `"App Icon"` (with space)
- `"App Icon - App Store"` (with spaces and hyphen)
- `"Top Shelf Image"` (with spaces)
- `"Top Shelf Image Wide"` (with spaces)

## Xcode Project Settings

In `project.pbxproj`:
```
ASSETCATALOG_COMPILER_APPICON_NAME = "Brand Assets"
```

In Xcode UI:
1. App Icon -> `Brand Assets`

## Info.plist Required Keys

```xml
<key>CFBundleIcons</key>
<dict>
  <key>CFBundlePrimaryIcon</key>
  <string>App Icon</string>
</dict>
<key>TVTopShelfImage</key>
<dict>
  <key>TVTopShelfPrimaryImage</key>
  <string>Top Shelf Image</string>
  <key>TVTopShelfPrimaryImageWide</key>
  <string>Top Shelf Image Wide</string>
</dict>
```

## Common Validation Errors

| Error | Solution |
|-------|----------|
| `Missing Info.plist Key 'CFBundleIcons.CFBundlePrimaryIcon'` | Add CFBundleIcons to Info.plist |
| `Missing 'TVTopShelfImage.TVTopShelfPrimaryImageWide'` | Add TVTopShelfImage to Info.plist |
| App icon not showing | Check `ASSETCATALOG_COMPILER_APPICON_NAME` matches brand assets folder name |

## Image Dimensions

| Asset | Size | Scale |
|-------|------|-------|
| App Icon (Home) | 400x240 | @1x |
| App Icon (App Store) | 1280x768 | @1x |
| Top Shelf | 1920x720 | @1x, @2x |
| Top Shelf Wide | 2320x720 | @1x, @2x |

## Layered Icon Structure

tvOS icons use a parallax effect with 3 layers:
- **Front** - Foreground elements (logo, text)
- **Middle** - Mid-ground elements (secondary graphics)
- **Back** - Background (solid color, gradient, or pattern)

Each layer is a separate PNG in its respective `.imagestacklayer` folder.
