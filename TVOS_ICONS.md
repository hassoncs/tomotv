# tvOS Multilayer Icon Setup

## Overview

tvOS uses **multilayer parallax icons** that create a 3D depth effect when users navigate with the Apple TV remote. These icons require manual configuration in Xcode after running `npx expo prebuild`.

## Your Layered Icon Assets

Your app already has multilayer icon assets prepared in `assets/images/icon/`:

- **Front layer**: `front.png` (1024×1024) / `front@2x.png` (2048×2048)
- **Middle layer**: `middle.png` (1024×1024) / `middle@2x.png` (2048×2048)
- **Back layer**: `back.png` (1024×1024) / `back2@.png` (2048×2048)

## tvOS Icon Requirements

- **Minimum layers**: 2 (tvOS requirement)
- **Maximum layers**: 5 (Apple's limit)
- **Your setup**: 3 layers (front, middle, back) ✅
- **Size**: 1024×1024 px base, 2048×2048 px @2x
- **Format**: PNG with transparency support
- **Effect**: Parallax 3D depth when focused

## Setup Instructions

### 1. Generate Native iOS Project

```bash
npm run prebuild
# or
npm run prebuild:tv  # with EXPO_TV=1
```

This creates the `ios/` directory with Xcode project files.

### 2. Open in Xcode

```bash
open ios/tomotv.xcworkspace
```

Or open `ios/tomotv.xcodeproj` directly.

### 3. Configure App Icon Layers

1. In Xcode's **Project Navigator** (left sidebar), navigate to:
   ```
   tomotv → Assets.xcassets → AppIcon.appiconset
   ```

2. Select **"App Icon - Apple TV"** in the asset catalog

3. You'll see slots for different icon sizes:
   - **App Icon - Small** (400×240 px) - Home screen icon
   - **App Icon - Large** (1280×768 px) - Top Shelf when app is featured

4. For each icon size, drag and drop your layer files:
   - Drag `front.png` → Front layer slot
   - Drag `middle.png` → Middle layer slot
   - Drag `back.png` → Back layer slot

5. For @2x variants, use the `@2x.png` files:
   - `front@2x.png` → Front layer @2x slot
   - `middle@2x.png` → Middle layer @2x slot
   - `back2@.png` → Back layer @2x slot

### 4. Preview the Parallax Effect

1. In Xcode, select the **App Icon - Small** asset
2. Click the **Attributes Inspector** (right panel)
3. Check **"Enable Parallax Preview"**
4. Use your mouse to simulate remote movement and see the 3D effect

Alternatively, use Apple's **Parallax Previewer** app to preview LSR files.

### 5. Build and Test

```bash
npm run ios
# Select Apple TV simulator when prompted
```

Navigate to your app icon on the Apple TV home screen and move the remote focus over it to see the parallax effect.

## Important Notes

### Expo Prebuild Persistence

**Caveat**: Running `npx expo prebuild --clean` will **delete your custom icon configuration** in Xcode.

**Workarounds**:
1. **Don't use `--clean`**: Run `npx expo prebuild` without the clean flag to preserve manual changes
2. **Config Plugin**: Consider creating a custom Expo config plugin to automate icon layer setup
3. **Version Control**: Commit your `ios/` directory to git after manual configuration
4. **Script Automation**: Use Xcode build scripts to copy icon layers on prebuild

### No app.json Support

Expo's `app.json` **does not support** multilayer icon configuration. The `"tvos.icon"` field in app.json is a placeholder for documentation but won't generate multilayer icons automatically.

### Layer Design Tips

1. **Front layer**: Main icon graphic with sharp details
2. **Middle layer**: Supporting elements, shadows, depth cues
3. **Back layer**: Background color, gradients, subtle patterns
4. **Transparency**: Use alpha channels for depth perception
5. **Safety margins**: Keep important content within safe area (avoid edges)

## Testing Checklist

- [ ] All 3 layers load correctly in Xcode asset catalog
- [ ] Both 1x and 2x variants are configured
- [ ] Parallax preview shows smooth 3D movement
- [ ] App builds without asset errors
- [ ] Icon appears correctly on Apple TV home screen
- [ ] Focus animation shows parallax effect
- [ ] Layers are visually balanced (not too extreme or flat)

## Resources

- [Apple TV Programming Guide - Parallax Artwork](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppleTV_PG/CreatingParallaxArtwork.html)
- [Human Interface Guidelines - tvOS Icons](https://developer.apple.com/design/human-interface-guidelines/tvos/icons-and-images/app-icon/)
- [Layered Image Generation Tools (GitHub)](https://github.com/SRGSSR/layered-image-generation-apple)
- [Parallax Previewer App](https://itunespartner.apple.com/apps/parallax-previewer)

## Troubleshooting

### Icon appears flat (no parallax)
- Verify all layers are loaded in asset catalog
- Check that transparency is preserved in PNG files
- Ensure layers have sufficient visual separation

### Build fails with icon errors
- Confirm all icon slots are filled (or remove unused sizes)
- Verify PNG format and size requirements
- Check for corrupted image files

### Prebuild overwrites icons
- Avoid `--clean` flag
- Commit ios/ directory changes to git
- Consider creating an Expo config plugin for automation
