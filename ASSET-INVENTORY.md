Can we hack it so like we always just return one quote unquote search result but our search will be like whatever we want. We can like render our own component there. It could be a grid, it could be a word, it could be an image, anything we want. That's kind of the idea I was thinking.# RadmediaTV Asset Inventory — Ernie (Robot Cat) Theming

Complete inventory of all replaceable visual assets. Organized by what you actually need to create vs. what gets auto-generated.

## How the Asset Pipeline Works

```
Source Files (YOU EDIT THESE)
  ├── assets/images/icon.png ──────────────► Expo generates android/, .expo/ cache, ios/ AppIcon
  ├── assets/images/adaptive-icon/ ────────► Android adaptive icon layers
  ├── assets/images/icon/ (layers) ────────► tvOS parallax icon (home screen)
  ├── assets/images/app-store/v2/ (layers) ► tvOS App Store icon
  ├── assets/images/wide/ ─────────────────► tvOS Top Shelf banners
  ├── Images.xcassets/ ────────────────────► withTVImageAssets plugin copies to ios/
  └── assets/images/tvos-flattened/ ───────► @react-native-tvos/config-tv fallback
```

**Rule:** Edit source files → run `npm run prebuild:tv` → generated files update automatically.

---

## UNIQUE DESIGNS NEEDED

These are the distinct visuals you need to create. Each group is a single design at different scales.

---

### 1. Universal App Icon (Square)

The main app icon used everywhere as the canonical source.

| File | Size | Aspect Ratio | Notes |
|------|------|-------------|-------|
| `icon.png` | 1024x1024 | 1:1 | Root-level, Expo uses this to generate all platform icons |
| `assets/images/icon.png` | 1024x1024 | 1:1 | Same design, referenced in app.json `"icon"` |

---

### 2. tvOS App Icon — Parallax Layers (Home Screen)

tvOS icons are 3 stacked layers that shift with parallax on the Siri Remote. Each layer needs transparency for the parallax depth effect. Aspect ratio is **5:3**.

| Layer | File (Source of Truth) | Size @1x | Size @2x |
|-------|----------------------|----------|----------|
| **Back** | `assets/images/icon/back@1x.png` | 400x240 | — |
| **Back** | `assets/images/icon/back@2x.png` | — | 800x480 |
| **Middle** | `assets/images/icon/middle@1x.png` | 400x240 | — |
| **Middle** | `assets/images/icon/middle@2x.png` | — | 800x480 |
| **Front** | `assets/images/icon/front@1x.png` | 400x240 | — |
| **Front** | `assets/images/icon/front@2x.png` | — | 800x480 |

**Design guidance:**
- **Back**: Background scene/color/gradient (moves least)
- **Middle**: Secondary elements, mid-ground decorations
- **Front**: Main logo/character (moves most, should have transparent areas)

Also mirrored to `Images.xcassets/AppIcon.brandassets/App Icon.imagestack/` (same files, copied by plugin).

---

### 3. tvOS App Icon — App Store Version (Large)

Larger version of the parallax icon for the App Store listing. Same 3-layer concept. Aspect ratio **5:3**.

| Layer | File (Source of Truth) | Size @1x | Size @2x |
|-------|----------------------|----------|----------|
| **Back** | `assets/images/app-store/back.png` | 1280x768 | — |
| **Back** | `assets/images/app-store/v2/back@2x.png`* | — | *(missing — needs creation: 2560x1536)* |
| **Middle** | `assets/images/app-store/v2/middle@1x.png` | 1280x768 | — |
| **Middle** | `assets/images/app-store/v2/middle@2x.png` | — | 2560x1536 |
| **Front** | `assets/images/app-store/v2/front@1x.png` | 1280x768 | — |
| **Front** | `assets/images/app-store/v2/front@2x.png` | — | 2560x1536 |

Also mirrored to `Images.xcassets/AppIcon.brandassets/App Icon - App Store.imagestack/`.

---

### 4. tvOS Top Shelf Image (Standard)

Banner displayed when the app is highlighted on the tvOS home screen top row. Aspect ratio **8:3**.

| File (Source of Truth) | Size | Scale |
|----------------------|------|-------|
| `assets/images/wide/top@1px.png` | 1920x720 | @1x |
| `assets/images/wide/top@2x.png` | 3840x1440 | @2x |

Also at `Images.xcassets/AppIcon.brandassets/Top Shelf Image.imageset/`.

---

### 5. tvOS Top Shelf Image (Wide)

Wider variant of the top shelf banner. Aspect ratio **29:9** (≈3.22:1).

| File (Source of Truth) | Size | Scale |
|----------------------|------|-------|
| `assets/images/wide/wide@1px.png` | 2320x720 | @1x |
| `assets/images/wide/wide@2px.png` | 4640x1440 | @2x |

Also at `Images.xcassets/AppIcon.brandassets/Top Shelf Image Wide.imageset/`.

---

### 6. Splash Screen Logo

The icon shown on the launch screen. Square. Used across iOS, tvOS, and Android.

| File (Source of Truth) | Size | Scale | Platform |
|----------------------|------|-------|----------|
| `assets/images/app-store/v2/200-icon@1x.png` | 200x200 | @1x | iOS |
| `assets/images/app-store/v2/200-icon@2x.png` | 400x400 | @2x | iOS |
| `assets/images/app-store/v2/200-icon@3x.png` | 600x600 | @3x | iOS |

Copied to `Images.xcassets/SplashScreenLogo.imageset/` (with tv-specific variants `200-icon-tv@1x.png` 200x200, `200-icon-tv@2x.png` 400x400).

---

### 7. Splash Screen Input Assets

Used on the login/server connection screen.

| File | Size | Aspect Ratio | Notes |
|------|------|-------------|-------|
| `assets/images/input-icon.png` | 1024x1024 | 1:1 | Icon on the splash/input screen (referenced in app.json) |
| `assets/images/input-bg.png` | 7680x4032 | 40:21 (≈1.9:1) | Full background image for input screen |

---

### 8. Android Adaptive Icon

Android uses a two-layer system (foreground + background). Both layers are square with safe zone padding.

| File | Size | Aspect Ratio | Notes |
|------|------|-------------|-------|
| `assets/images/adaptive-icon/foreground.png` | 1024x1024 | 1:1 | Logo/icon on transparent background |
| `assets/images/adaptive-icon/background.png` | 1024x1024 | 1:1 | Solid color or pattern background |

**Also has SVG source:** `assets/images/adaptive-icon/radmediattv-svg.svg`

---

### 9. tvOS Flattened Composites (Prebuild Fallback)

Pre-composited (back+middle+front merged) versions used by `@react-native-tvos/config-tv`. These should be regenerated from the layer sources above after updating them.

| File | Size | Aspect Ratio | Source Layers |
|------|------|-------------|---------------|
| `assets/images/tvos-flattened/icon-400x240.png` | 400x240 | 5:3 | icon/ @1x layers |
| `assets/images/tvos-flattened/icon-800x480.png` | 800x480 | 5:3 | icon/ @2x layers |
| `assets/images/tvos-flattened/icon-1280x768.png` | 1280x768 | 5:3 | app-store/ @1x layers |
| `assets/images/tvos-flattened/topshelf-1920x720.png` | 1920x720 | 8:3 | Copy of wide/top@1px |
| `assets/images/tvos-flattened/topshelf-3840x1440.png` | 3840x1440 | 8:3 | Copy of wide/top@2x |
| `assets/images/tvos-flattened/topshelf-wide-2320x720.png` | 2320x720 | 29:9 | Copy of wide/wide@1px |
| `assets/images/tvos-flattened/topshelf-wide-4640x1440.png` | 4640x1440 | 29:9 | Copy of wide/wide@2px |

---

### 10. App Store Screenshots

Marketing screenshots for the tvOS App Store listing. All **16:9**.

| File | Size | Aspect Ratio |
|------|------|-------------|
| `applestore/01.png` | 1920x1080 | 16:9 |
| `applestore/02.png` | 1920x1080 | 16:9 |
| `applestore/03.png` | 1920x1080 | 16:9 |
| `applestore/04.png` | 1920x1080 | 16:9 |
| `applestore/05.png` | 1920x1080 | 16:9 |
| `applestore/06.png` | 1920x1080 | 16:9 |
| `applestore/07.png` | 1920x1080 | 16:9 |
| `applestore/08.png` | 1920x1080 | 16:9 |
| `applestore/09.png` | 1920x1080 | 16:9 |

Also stored as webp at `assets/images/screenshots/` (1920x1080):
`folder-exploration.webp`, `help-page.webp`, `multi-audio-track.webp`, `native-search.webp`, `open-movies.webp`, `quick-connect.webp`, `subtitle-support.webp`, `up-next-overlay.webp`, `username-password.webp`

---

### 11. Support / Reference Files

Not directly used in the build but may be useful references or originals.

| File | Size/Type | Notes |
|------|----------|-------|
| `assets/images/support/App Icon Front.png` | 1024x1024 | Original front layer reference |
| `assets/images/support/green-jelly.png` | 1024x1024 | Current jellyfish mascot |
| `assets/images/support/tv-robot.svg` | SVG | Robot icon reference |
| `assets/images/support/Firefly green jellyfish icon 415602.svg` | SVG | AI-generated jellyfish source |
| `assets/images/radmedia-qr-1000px.png` | 740x740 | QR code (probably don't theme this) |

---

## SUMMARY: What to Generate for Ernie Theming

| # | Design | Sizes to Produce | Aspect Ratio | Format |
|---|--------|-------------------|-------------|--------|
| 1 | **App Icon** (universal square) | 1024x1024 | 1:1 | PNG |
| 2 | **tvOS Icon — Back Layer** | 400x240, 800x480, 1280x768 | 5:3 | PNG (transparency) |
| 3 | **tvOS Icon — Middle Layer** | 400x240, 800x480, 1280x768 | 5:3 | PNG (transparency) |
| 4 | **tvOS Icon — Front Layer** | 400x240, 800x480, 1280x768, 2560x1536 | 5:3 | PNG (transparency) |
| 5 | **Top Shelf Banner** | 1920x720, 3840x1440 | 8:3 | PNG |
| 6 | **Top Shelf Wide Banner** | 2320x720, 4640x1440 | 29:9 | PNG |
| 7 | **Splash Logo** | 200x200, 400x400, 600x600 | 1:1 | PNG |
| 8 | **Input/Login Icon** | 1024x1024 | 1:1 | PNG |
| 9 | **Input/Login Background** | 7680x4032 | 40:21 | PNG |
| 10 | **Android Icon Foreground** | 1024x1024 | 1:1 | PNG (transparency) |
| 11 | **Android Icon Background** | 1024x1024 | 1:1 | PNG |
| 12 | **App Store Screenshots** (×9) | 1920x1080 | 16:9 | PNG |

**Total unique designs: 12** (some at multiple scales = ~30 files)

---

## After Generating: Rebuild Steps

```bash
# 1. Replace source files listed above
# 2. Regenerate flattened composites (from the 3 layers):
python3 assets/images/tvos-flattened/composite.py  # or use the script from README.md

# 3. Rebuild native projects (generates ios/, android/ from sources):
cd radmedia && npm run prebuild:tv

# 4. Build and verify:
npm run ios
```

---

## IMAGE GENERATION PROMPTS

### Character Description (Ernie)

> **Ernie** is a kawaii robot cat. Black, white, and gray coloring. Cute oversized eyes (Disney/kawaii style). Mechanical/robotic details — antenna, panel lines, small bolts, maybe a little LED ear. Friendly, approachable, cartoon mascot energy.

### Style Reference (match the existing jellyfish)

The current jellyfish uses: **lineless flat vector art, soft volumetric shading, inner-shadow edge gradients, rounded geometric shapes, matte finish, no outlines.** The new cat should match this exact style — clean iOS icon aesthetic, simple drawn look.

**Background color:** Warm mustard-orange `#F39C12` (keep the current yellowy-orange).

---

### Prompt A — App Icon / Square Icon (1:1)

*For: `icon.png`, `assets/images/icon.png`, `input-icon.png`, Android foreground, splash logo*

```
Kawaii robot cat head, centered, facing forward, black white and gray coloring, cute oversized round eyes with small sparkle highlights, tiny mechanical antenna on one ear, subtle panel lines and small bolt details on cheeks, friendly smile. Lineless flat vector art style, soft volumetric shading with inner-shadow edge gradients, rounded geometric shapes, matte finish, no outlines or strokes. Solid warm mustard-orange background (#F39C12). Simple clean iOS app icon aesthetic. Minimal scattered organic blob accents in coral pink and terracotta floating in background. Square composition, subject fills 70% of frame.
```

---

### Prompt B — tvOS Parallax: Back Layer (5:3, transparent)

*For: `assets/images/icon/back@*.png`, `assets/images/app-store/*/back*.png`*

```
Abstract warm background for app icon parallax layer. Solid warm mustard-orange (#F39C12) with subtle radial gradient slightly darker at edges. A few scattered small organic blob shapes in coral pink, terracotta, and pale cream floating randomly. Lineless flat vector style, no outlines, matte finish. No text, no characters. Transparent PNG where edges fade softly. 5:3 aspect ratio.
```

---

### Prompt C — tvOS Parallax: Middle Layer (5:3, transparent)

*For: `assets/images/icon/middle@*.png`, `assets/images/app-store/*/middle*.png`*

```
Mid-ground decorative elements for app icon parallax layer, transparent background. Soft geometric circuit-board-like traces and tiny gear shapes in muted warm gray and light orange, subtle and understated. A few small floating organic blob accents in coral and cream. Lineless flat vector art, soft volumetric shading, inner-shadow edges, matte finish. No text, no main character. Elements loosely centered but asymmetric. 5:3 aspect ratio, transparent PNG.
```

---

### Prompt D — tvOS Parallax: Front Layer (5:3, transparent)

*For: `assets/images/icon/front@*.png`, `assets/images/app-store/*/front*.png`*

```
Kawaii robot cat head, centered, facing forward, black white and gray coloring, cute oversized round eyes with sparkle highlights, tiny mechanical antenna on one ear, subtle panel lines and small bolt accents on cheeks, friendly gentle smile. Lineless flat vector art, soft volumetric shading with inner-shadow edge gradients, rounded geometric shapes, matte finish, no outlines. Transparent background (PNG alpha). Subject fills approximately 60-65% of frame, centered. 5:3 aspect ratio.
```

---

### Prompt E — Top Shelf Banner (8:3)

*For: `assets/images/wide/top@*.png`*

```
Wide banner for tvOS top shelf. Warm radial gradient background from bright mustard-orange (#F39C12) at edges to deeper reddish-orange at center. Kawaii robot cat head centered horizontally, positioned slightly above vertical midpoint — black white and gray, cute oversized eyes, mechanical antenna, friendly smile. Lineless flat vector art style, soft shading. Below the cat, the text RADMEDIA in light gray retro pixelated 8-bit style font. Scattered small organic blob accents in coral pink and terracotta. 8:3 aspect ratio, ultrawide horizontal composition with generous negative space on sides.
```

---

### Prompt F — Top Shelf Wide Banner (29:9)

*For: `assets/images/wide/wide@*.png`*

```
Extra-wide banner for tvOS top shelf. Same composition as standard top shelf but stretched wider with more negative space on both sides. Warm radial gradient background from bright mustard-orange (#F39C12) to deeper reddish-orange. Kawaii robot cat head centered with RADMEDIA in light gray pixelated 8-bit font below. Lineless flat vector style, scattered coral and terracotta blob accents. Very wide 29:9 aspect ratio — character and text occupy only the center third.
```

---

### Prompt G — Login Background (40:21, ultrawide)

*For: `assets/images/input-bg.png`*

```
Abstract background pattern, warm mustard-orange (#F39C12) solid base color. Sparse scattered irregular organic blob and pebble shapes in pale cream, light coral, and terracotta. Flat vector graphics, no gradients, no outlines, no texture — pure solid color fills. Asymmetric randomized layout with heavy negative space (terrazzo/confetti style). Very high resolution, seamless feel. 40:21 ultrawide aspect ratio.
```

---

### Prompt H — Android Icon Background (1:1)

*For: `assets/images/adaptive-icon/background.png`*

```
Solid warm mustard-orange (#F39C12) square background with a few sparse scattered organic blob shapes in coral pink, terracotta, and pale cream. Flat vector, no outlines, no gradients, matte finish. Square 1:1 composition. Simple, clean.
```

---

### Notes for Image Generation

- **Generate at the largest size needed**, then downscale for smaller variants (e.g., generate front layer at 2560x1536 then resize to 1280x768, 800x480, 400x240)
- **Transparency matters** for parallax layers (B, C, D) and Android foreground — request PNG with alpha channel
- **Consistency is key** — generate the cat head once at high quality, then adapt it into each composition rather than regenerating from scratch each time
- The **splash logo** (200-600px) is just the square icon at small sizes — no separate design needed
- **App Store screenshots** (prompt not included) — these are actual UI screenshots of the app running, not generated art. Re-capture after theming the icon/splash assets
