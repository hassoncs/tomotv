#!/bin/bash
# Process generated Ernie assets: convert, resize, remove backgrounds, place into app
set -euo pipefail

GEN="/Users/hassoncs/Workspaces/Personal/automation/radmedia/generated-assets"
APP="/Users/hassoncs/Workspaces/Personal/automation/radmedia"
PROCESSED="$GEN/processed"
mkdir -p "$PROCESSED"

echo "=== Processing Ernie Assets ==="

# ── Prompt A: App Icon (1024x1024) ──
echo ""
echo "── Prompt A: App Icon ──"
SRC_A="$GEN/prompt-a/flux-orange/ernie-head-robotic.jpg"

# Convert to PNG and place at all icon locations
magick "$SRC_A" "$PROCESSED/icon-1024.png"
cp "$PROCESSED/icon-1024.png" "$APP/icon.png"
cp "$PROCESSED/icon-1024.png" "$APP/assets/images/icon.png"
cp "$PROCESSED/icon-1024.png" "$APP/assets/images/input-icon.png"
echo "  ✓ icon.png, assets/images/icon.png, assets/images/input-icon.png"

# Android foreground (needs transparency — remove the orange bg)
magick "$SRC_A" -fuzz 15% -transparent "srgb(244,123,32)" -transparent "srgb(241,130,42)" PNG32:"$APP/assets/images/adaptive-icon/foreground.png"
echo "  ✓ adaptive-icon/foreground.png (transparent bg)"

# Splash logos at various scales
magick "$SRC_A" -resize 200x200 "$APP/assets/images/app-store/v2/200-icon@1x.png"
magick "$SRC_A" -resize 400x400 "$APP/assets/images/app-store/v2/200-icon@2x.png"
magick "$SRC_A" -resize 600x600 "$APP/assets/images/app-store/v2/200-icon@3x.png"
echo "  ✓ 200-icon@{1x,2x,3x}.png"

# ── Prompt B: Back Layer (1280x768, opaque) ──
echo ""
echo "── Prompt B: Back Layer ──"
SRC_B="$GEN/prompt-b/ernie-back-layer.jpg"

magick "$SRC_B" -resize 400x240\! "$APP/assets/images/icon/back@1x.png"
magick "$SRC_B" -resize 800x480\! "$APP/assets/images/icon/back@2x.png"
magick "$SRC_B" -resize 1280x768\! "$APP/assets/images/app-store/v2/back@1x.png"
magick "$SRC_B" -resize 2560x1536\! "$APP/assets/images/app-store/v2/back@2x.png"
echo "  ✓ icon/back@{1x,2x}.png, app-store/v2/back@{1x,2x}.png"

# ── Prompt C: Middle Layer (1280x768, needs transparency) ──
echo ""
echo "── Prompt C: Middle Layer ──"
SRC_C="$GEN/prompt-c/ernie-middle-layer.jpg"

# Remove beige background (srgb 246,237,222) with fuzz
magick "$SRC_C" -fuzz 20% -transparent "srgb(246,237,222)" PNG32:"$PROCESSED/middle-transparent.png"

magick "$PROCESSED/middle-transparent.png" -resize 400x240\! PNG32:"$APP/assets/images/icon/middle@1x.png"
magick "$PROCESSED/middle-transparent.png" -resize 800x480\! PNG32:"$APP/assets/images/icon/middle@2x.png"
magick "$PROCESSED/middle-transparent.png" -resize 1280x768\! PNG32:"$APP/assets/images/app-store/v2/middle@1x.png"
magick "$PROCESSED/middle-transparent.png" -resize 2560x1536\! PNG32:"$APP/assets/images/app-store/v2/middle@2x.png"
echo "  ✓ icon/middle@{1x,2x}.png, app-store/v2/middle@{1x,2x}.png (transparent)"

# ── Prompt D: Front Layer (1280x768, needs transparency) ──
echo ""
echo "── Prompt D: Front Layer ──"
SRC_D="$GEN/prompt-d/ernie-front-layer.jpg"

# Remove white background with fuzz
magick "$SRC_D" -fuzz 12% -transparent white PNG32:"$PROCESSED/front-transparent.png"

magick "$PROCESSED/front-transparent.png" -resize 400x240\! PNG32:"$APP/assets/images/icon/front@1x.png"
magick "$PROCESSED/front-transparent.png" -resize 800x480\! PNG32:"$APP/assets/images/icon/front@2x.png"
magick "$PROCESSED/front-transparent.png" -resize 1280x768\! PNG32:"$APP/assets/images/app-store/v2/front@1x.png"
magick "$PROCESSED/front-transparent.png" -resize 2560x1536\! PNG32:"$APP/assets/images/app-store/v2/front@2x.png"
echo "  ✓ icon/front@{1x,2x}.png, app-store/v2/front@{1x,2x}.png (transparent)"

# ── Prompt E: Top Shelf Banner (1920x720) ──
echo ""
echo "── Prompt E: Top Shelf Banner ──"
SRC_E="$GEN/prompt-e/ernie-topshelf.jpg"

magick "$SRC_E" -resize 1920x720\! "$APP/assets/images/wide/top@1px.png"
magick "$SRC_E" -resize 3840x1440\! "$APP/assets/images/wide/top@2x.png"
echo "  ✓ wide/top@{1px,2x}.png"

# ── Prompt F: Top Shelf Wide Banner (2048x640 → 2320x720 / 4640x1440) ──
echo ""
echo "── Prompt F: Top Shelf Wide Banner ──"
SRC_F="$GEN/prompt-f/ernie-topshelf-wide.jpg"

magick "$SRC_F" -resize 2320x720\! "$APP/assets/images/wide/wide@1px.png"
magick "$SRC_F" -resize 4640x1440\! "$APP/assets/images/wide/wide@2px.png"
echo "  ✓ wide/wide@{1px,2px}.png"

# ── Prompt G: Login Background (1920x1008 → 7680x4032) ──
echo ""
echo "── Prompt G: Login Background ──"
SRC_G="$GEN/prompt-g/ernie-login-bg.jpg"

magick "$SRC_G" -resize 7680x4032\! "$APP/assets/images/input-bg.png"
echo "  ✓ assets/images/input-bg.png (7680x4032)"

# ── Prompt H: Android Background (1024x1024) ──
echo ""
echo "── Prompt H: Android Background ──"
SRC_H="$GEN/prompt-h/ernie-android-bg.jpg"

magick "$SRC_H" "$APP/assets/images/adaptive-icon/background.png"
echo "  ✓ adaptive-icon/background.png"

echo ""
echo "=== All assets processed and placed! ==="
echo ""
echo "Next steps:"
echo "  1. Regenerate flattened composites:"
echo "     python3 $APP/assets/images/tvos-flattened/composite.py"
echo "  2. Rebuild native projects:"
echo "     cd $APP && npm run prebuild:tv"
echo "  3. Build and verify:"
echo "     cd $APP && npm run ios"
