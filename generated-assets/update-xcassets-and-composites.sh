#!/bin/bash
# Update xcassets with new Ernie assets and regenerate flattened composites
set -euo pipefail

APP="/Users/hassoncs/Workspaces/Personal/automation/radmedia"
XC="$APP/Images.xcassets"
ICON_STACK="$XC/AppIcon.brandassets/App Icon.imagestack"
STORE_STACK="$XC/AppIcon.brandassets/App Icon - App Store.imagestack"
SHELF="$XC/AppIcon.brandassets/Top Shelf Image.imageset"
SHELF_WIDE="$XC/AppIcon.brandassets/Top Shelf Image Wide.imageset"
SPLASH="$XC/SplashScreenLogo.imageset"
FLAT="$APP/assets/images/tvos-flattened"

echo "=== Updating xcassets ==="

# ── App Icon (home screen, @1x/@2x) ──
echo ""
echo "── App Icon imagestack ──"
cp "$APP/assets/images/icon/back@1x.png"   "$ICON_STACK/Back.imagestacklayer/Content.imageset/back@1x.png"
cp "$APP/assets/images/icon/back@2x.png"   "$ICON_STACK/Back.imagestacklayer/Content.imageset/back@2x.png"
cp "$APP/assets/images/icon/middle@1x.png" "$ICON_STACK/Middle.imagestacklayer/Content.imageset/middle@1x.png"
cp "$APP/assets/images/icon/middle@2x.png" "$ICON_STACK/Middle.imagestacklayer/Content.imageset/middle@2x.png"
cp "$APP/assets/images/icon/front@1x.png"  "$ICON_STACK/Front.imagestacklayer/Content.imageset/front@1x.png"
cp "$APP/assets/images/icon/front@2x.png"  "$ICON_STACK/Front.imagestacklayer/Content.imageset/front@2x.png"
echo "  ✓ App Icon imagestack (back/middle/front @1x/@2x)"

# ── App Store Icon (1280x768) ──
echo ""
echo "── App Store imagestack ──"
cp "$APP/assets/images/app-store/v2/back@1x.png"   "$STORE_STACK/Back.imagestacklayer/Content.imageset/back.png"
cp "$APP/assets/images/app-store/v2/middle@1x.png" "$STORE_STACK/Middle.imagestacklayer/Content.imageset/middle@1x.png"
cp "$APP/assets/images/app-store/v2/front@1x.png"  "$STORE_STACK/Front.imagestacklayer/Content.imageset/front@1x.png"
echo "  ✓ App Store imagestack (back/middle/front)"

# ── Top Shelf ──
echo ""
echo "── Top Shelf images ──"
cp "$APP/assets/images/wide/top@1px.png" "$SHELF/top@1x.png"
cp "$APP/assets/images/wide/top@2x.png"  "$SHELF/top@2x.png"
echo "  ✓ Top Shelf @1x/@2x"

# ── Top Shelf Wide ──
cp "$APP/assets/images/wide/wide@1px.png" "$SHELF_WIDE/wide@1x.png"
cp "$APP/assets/images/wide/wide@2px.png" "$SHELF_WIDE/wide@2x.png"
echo "  ✓ Top Shelf Wide @1x/@2x"

# ── Splash Screen Logo ──
echo ""
echo "── Splash Screen Logo ──"
cp "$APP/assets/images/app-store/v2/200-icon@1x.png" "$SPLASH/200-icon@1x.png"
cp "$APP/assets/images/app-store/v2/200-icon@2x.png" "$SPLASH/200-icon@2x.png"
cp "$APP/assets/images/app-store/v2/200-icon@3x.png" "$SPLASH/200-icon@3x.png"
# TV variants (same images, just different filenames)
cp "$APP/assets/images/app-store/v2/200-icon@1x.png" "$SPLASH/200-icon-tv@1x.png"
cp "$APP/assets/images/app-store/v2/200-icon@2x.png" "$SPLASH/200-icon-tv@2x.png"
echo "  ✓ SplashScreenLogo (iOS + TV variants)"

echo ""
echo "=== Generating flattened composites ==="

# Composite: back + middle + front → flattened
python3 -c "
from PIL import Image

def composite_layers(back_path, middle_path, front_path, output_path):
    back = Image.open(back_path).convert('RGBA')
    middle = Image.open(middle_path).convert('RGBA')
    front = Image.open(front_path).convert('RGBA')
    result = Image.alpha_composite(Image.alpha_composite(back, middle), front)
    result.convert('RGB').save(output_path, 'PNG')
    print(f'  ✓ {output_path.split(\"/\")[-1]}')

base = '$APP/assets/images'
flat = '$FLAT'

# Home screen icons
composite_layers(
    f'{base}/icon/back@1x.png',
    f'{base}/icon/middle@1x.png',
    f'{base}/icon/front@1x.png',
    f'{flat}/icon-400x240.png'
)
composite_layers(
    f'{base}/icon/back@2x.png',
    f'{base}/icon/middle@2x.png',
    f'{base}/icon/front@2x.png',
    f'{flat}/icon-800x480.png'
)

# App Store icon
composite_layers(
    f'{base}/app-store/v2/back@1x.png',
    f'{base}/app-store/v2/middle@1x.png',
    f'{base}/app-store/v2/front@1x.png',
    f'{flat}/icon-1280x768.png'
)
"

# Top shelf: just copy
cp "$APP/assets/images/wide/top@1px.png" "$FLAT/topshelf-1920x720.png"
cp "$APP/assets/images/wide/top@2x.png"  "$FLAT/topshelf-3840x1440.png"
cp "$APP/assets/images/wide/wide@1px.png" "$FLAT/topshelf-wide-2320x720.png"
cp "$APP/assets/images/wide/wide@2px.png" "$FLAT/topshelf-wide-4640x1440.png"
echo "  ✓ topshelf @1x/@2x, topshelf-wide @1x/@2x"

echo ""
echo "=== All xcassets and composites updated! ==="
