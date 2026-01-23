# tvOS Flattened Icons

This directory contains flattened composite images used by the `@react-native-tvos/config-tv` plugin to automatically generate tvOS app icons and top shelf images during prebuild.

## Files

### App Icons (Composites from layered sources)

These images are created by compositing the three layers (back, middle, front) from `assets/images/icon/` and `assets/images/app-store/`:

- **icon-400x240.png** - Home screen icon @1x
- **icon-800x480.png** - Home screen icon @2x  
- **icon-1280x768.png** - App Store icon (large)

### Top Shelf Images (Copied from Images.xcassets backup)

These are direct copies from the backup in `Images.xcassets/Brand Assets.brandassets/`:

- **topshelf-1920x720.png** - Top shelf @1x
- **topshelf-3840x1440.png** - Top shelf @2x
- **topshelf-wide-2320x720.png** - Top shelf wide @1x
- **topshelf-wide-4640x1440.png** - Top shelf wide @2x

## Automatic Generation

These images are automatically processed by the `@react-native-tvos/config-tv` plugin during `npm run prebuild` when `EXPO_TV=1` is set. The plugin:

1. Creates `TVAppIcon.brandassets` in the iOS project
2. Generates imagestack layers from the flattened icons
3. Copies top shelf images for the tvOS home screen
4. Configures the Xcode project to use these assets

See `app.json` plugin configuration and `CLAUDE-tvos-icons.md` for more details.

## Regenerating Composite Icons

If you need to regenerate the composite icons from source layers, use the Python script in `/tmp/composite_icons.py` (temporary location during build):

```bash
python3 /tmp/composite_icons.py /home/runner/work/tomotv/tomotv
```

This will composite the back, middle, and front layers into single flattened images.
