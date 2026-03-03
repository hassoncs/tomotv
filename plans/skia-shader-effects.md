# Skia Shader Effects Plan

Advanced GPU-accelerated backgrounds for the RadmediaTV Apple TV app using `@shopify/react-native-skia`.

## Goal

Replace the library page's `DynamicBackground` (expo-image `blurRadius` + expo-linear-gradient) with a Skia shader-based background that provides:
- Clear image at top → blurred image at bottom with smooth `smoothstep` transition
- Cross-fade between images when focus changes (500ms)
- Scroll-driven blur line animation (blur line moves up as user scrolls down)
- Foundation for advanced transition effects (ripple dissolve, directional wipe)
- Locked 60fps on Apple TV A15 chip

---

## Current State

### What Exists

| Component | Status | Notes |
|-----------|--------|-------|
| `SkiaShaderBackground.tsx` | ✅ Created | AI page animated iridescent fractal shader. Working on sim + physical TV. |
| `DynamicBackground.tsx` | ✅ Existing | Library page. expo-image blurRadius=50 + LinearGradient overlay. Cross-fade on focus change. |
| `SkiaLibraryBackground.tsx` | ❌ Not created yet | Was planned in previous session but never built. This plan covers its implementation. |
| Skia native pods | ✅ Linked | `@shopify/react-native-skia` v2.4.21, Metal acceleration confirmed on tvOS |
| Jest mock | ✅ Added | Canvas, Fill, Shader, Group, ImageShader, useImage, Skia.RuntimeEffect.Make |

### Library Page Background Flow (Current)

```
BackgroundContext.backdropUrl
    ↓ (set by HeroBillboard.onItemChange or VideoShelf.onItemFocus)
app/(tabs)/index.tsx
    ↓ (passes currentImageSource prop)
DynamicBackground.tsx
    ├── Previous image (expo-image, blurRadius=50, full opacity)
    ├── Current image (expo-image, blurRadius=50, animated fade-in 500ms)
    └── LinearGradient overlay (10% top → 30% bottom darkening)
```

### Library Page Scroll Infrastructure (Current)

- `app/(tabs)/index.tsx` uses `ScrollView` for the home view (HeroBillboard + VideoShelves)
- **No `onScroll` handlers exist** — scroll-based animation will require adding these
- `HeroBillboard` sits at the top of the ScrollView
- Focus changes between shelf items trigger `onItemFocus` which updates backdrop URL with 150ms debounce

---

## Implementation Plan

### Phase 1: SkiaLibraryBackground — Clear-to-Blur Shader

Create `components/SkiaLibraryBackground.tsx` that replaces `DynamicBackground` on the library page.

#### Architecture

```
SkiaLibraryBackground
    ├── Skia Canvas (full screen, pointerEvents="none")
    │   ├── Fill + Shader (clear/blur masking shader)
    │   │   ├── ImageShader (clear image — full-res 1920px from Jellyfin)
    │   │   └── ImageShader (blur image — 200px low-res from Jellyfin, upscaled = natural blur)
    │   └── Group opacity (animated cross-fade between old/new image pairs)
    └── No LinearGradient needed — shader handles the graduated darkening
```

#### The Low-Res Blur Trick

Instead of running an expensive GPU blur kernel:
1. Request a 200px-wide image from Jellyfin: `getBackdropUrl(itemId, 200)`
2. Skia upscales it with bilinear filtering to 1920×1080 → natural, free blur
3. Add a tiny 9-tap box blur boost in the shader for extra smoothness (cost: ~9 texture samples per pixel in the blurred region only)

**Performance**: Bilinear upscale is free. The 9-tap blur only runs on the bottom portion of the screen (below `u_blurLine`). Well under budget for A15 at 1080p 60fps.

#### SkSL Shader

```glsl
uniform shader clearImg;    // Full-res (1920px) — sharp
uniform shader blurImg;     // Low-res (200px) — naturally blurred by upscale
uniform vec2 u_resolution;
uniform float u_blurLine;   // 0.0 (top) to 1.0 (bottom) — where clear meets blur

vec4 sampleBlurred(shader img, vec2 pos) {
    // 9-tap box blur for slight extra smoothing
    vec4 sum = vec4(0.0);
    float r = 3.0;
    for (float x = -1.0; x <= 1.0; x += 1.0) {
        for (float y = -1.0; y <= 1.0; y += 1.0) {
            sum += img.eval(pos + vec2(x, y) * r);
        }
    }
    return sum / 9.0;
}

vec4 main(vec2 pos) {
    vec2 uv = pos / u_resolution;
    
    // Clear image at top, blurred at bottom
    vec4 clear = clearImg.eval(pos);
    vec4 blur = sampleBlurred(blurImg, pos);
    float t = smoothstep(u_blurLine - 0.1, u_blurLine + 0.1, uv.y);
    vec4 color = mix(clear, blur, t);
    
    // Graduated darkening overlay (replaces LinearGradient)
    // 10% dark at top → 45% dark at bottom
    float darkness = mix(0.10, 0.45, uv.y);
    color.rgb *= (1.0 - darkness);
    
    return color;
}
```

#### Props Interface

```typescript
interface SkiaLibraryBackgroundProps {
  imageUrl?: string;   // Full Jellyfin backdrop URL (maxWidth=1920)
  blurLine?: number;   // 0.0–1.0, default 0.45 (clear top 45%, blur bottom 55%)
}
```

#### Cross-Fade Strategy

Same pattern as `DynamicBackground` — committed/previous image pair:

1. When `imageUrl` changes, start loading both clear (1920px) and blur (200px) versions
2. When **both** are loaded, "commit" them — move current to previous, new to current
3. Render previous pair at full opacity, current pair fading in via `<Group opacity={fadeAnim}>`
4. After fade completes, discard previous pair

This ensures no flash of empty content during image loading.

#### Integration in `app/(tabs)/index.tsx`

```typescript
// Replace:
import { DynamicBackground } from "@/components/DynamicBackground";
// With:
import { SkiaLibraryBackground } from "@/components/SkiaLibraryBackground";

// In JSX, replace:
<DynamicBackground source={currentImageSource} />
// With:
<SkiaLibraryBackground imageUrl={backdropUrl} />
```

The `backdropUrl` is extracted from `currentImageSource` (which is either a `{uri: string}` object or a require'd asset number). For Skia, we only use the URL string — ambient assets won't be supported initially (dark fallback instead).

### Phase 2: Scroll-Based Blur Line Animation

Wire the `blurLine` uniform to the ScrollView's scroll position so the blur transition moves up as the user scrolls down past the hero carousel.

#### Concept

```
Scroll = 0 (top):
  ┌─────────────────────┐
  │  CLEAR (hero area)  │  ← u_blurLine = 0.45
  │─ ─ ─ transition ─ ─ │
  │  BLURRED (shelves)  │
  └─────────────────────┘

Scroll = heroHeight:
  ┌─────────────────────┐
  │  BLURRED (all)      │  ← u_blurLine = 0.0 (everything blurred)
  │                     │
  │                     │
  └─────────────────────┘
```

#### Implementation

1. **Add `onScroll` to ScrollView** in `app/(tabs)/index.tsx`:
```typescript
const scrollY = useSharedValue(0);

const scrollHandler = useAnimatedScrollHandler({
  onScroll: (event) => {
    scrollY.value = event.contentOffset.y;
  },
});
```

2. **Derive `blurLine` from scroll position**:
```typescript
const HERO_HEIGHT = 500; // HeroBillboard height in pixels

const blurLine = useDerivedValue(() => {
  // Map scroll 0→HERO_HEIGHT to blurLine 0.45→0.0
  const progress = Math.min(scrollY.value / HERO_HEIGHT, 1);
  return 0.45 * (1 - progress);
});
```

3. **Pass to SkiaLibraryBackground**:
```tsx
<SkiaLibraryBackground imageUrl={backdropUrl} blurLine={blurLine} />
```

4. **Accept SharedValue in component**:
```typescript
interface SkiaLibraryBackgroundProps {
  imageUrl?: string;
  blurLine?: SharedValue<number> | number; // Accept both animated and static values
}
```

#### tvOS Focus Considerations

On tvOS, `ScrollView` scrolls automatically when focus moves between items. The `onScroll` handler fires during these focus-driven scrolls. This means the blur line will naturally animate as the user navigates through shelves — no extra work needed.

**Potential issue**: tvOS `ScrollView` may not support `Animated.ScrollView` with Reanimated's `useAnimatedScrollHandler`. If not, fall back to the standard `onScroll` event and drive a shared value manually:
```typescript
onScroll={(e) => {
  scrollY.value = e.nativeEvent.contentOffset.y;
}}
scrollEventThrottle={16}
```

### Phase 3: Advanced Transition Effects

These are stretch goals — the infrastructure from Phase 1 makes them straightforward.

#### 3A: Ripple Dissolve

When focus changes to a new item, instead of a linear cross-fade, the new image "ripples" in from the center.

```glsl
uniform float u_transition;  // 0.0 → 1.0
uniform vec2 u_center;       // Ripple origin (focus point)

vec4 main(vec2 pos) {
    vec2 uv = pos / u_resolution;
    float dist = distance(uv, u_center);
    float ripple = smoothstep(u_transition - 0.15, u_transition + 0.05, dist);
    // Mix new image where ripple has passed, old where it hasn't
    return mix(newColor, oldColor, ripple);
}
```

**Trigger**: When `imageUrl` changes, set `u_center` to the focused item's screen position and animate `u_transition` from 0 → 1 over 600ms.

#### 3B: Directional Wipe

New image wipes in from the direction of focus movement (left→right when pressing right on D-pad).

```glsl
uniform float u_transition;
uniform vec2 u_direction;  // (1,0) for right, (-1,0) for left, etc.

vec4 main(vec2 pos) {
    vec2 uv = pos / u_resolution;
    float edge = dot(uv - 0.5, u_direction) + 0.5;
    float t = smoothstep(u_transition - 0.1, u_transition + 0.1, edge);
    return mix(oldColor, newColor, t);
}
```

**Trigger**: Track which D-pad direction caused the focus change, pass as `u_direction`.

#### 3C: Color-Aware Transition

Extract the dominant color from the new image (already available via `BackgroundContext.accentColor`) and use it as the transition color — the old image fades to the accent color, then the accent color fades to the new image.

```glsl
uniform vec3 u_accentColor;
uniform float u_transition;

vec4 main(vec2 pos) {
    vec4 accent = vec4(u_accentColor, 1.0);
    if (u_transition < 0.5) {
        // Phase 1: old → accent
        float t = u_transition * 2.0;
        return mix(oldColor, accent, t);
    } else {
        // Phase 2: accent → new
        float t = (u_transition - 0.5) * 2.0;
        return mix(accent, newColor, t);
    }
}
```

---

## Performance Budget

| Operation | Cost | Notes |
|-----------|------|-------|
| Bilinear upscale (200px → 1080p) | Free | GPU does this natively |
| 9-tap box blur (bottom region only) | ~9 samples/pixel | Only below blurLine (~55% of screen) |
| smoothstep transition | Negligible | Single lerp per pixel |
| Darkness overlay | Negligible | Single multiply per pixel |
| Cross-fade (2 image pairs) | 1 `saveLayer` | Acceptable on A15 for simple compositing |
| Image decode (useImage) | Off-thread | Skia handles async decode |

**Target**: Locked 60fps on Apple TV 4K (A15). The shader does ~20 texture samples per pixel worst case (9 blur + 2 clear + 9 previous blur + 2 previous clear during cross-fade). At 1080p that's ~40M samples/frame. A15's GPU handles this easily.

---

## File Plan

| File | Action | Description |
|------|--------|-------------|
| `components/SkiaLibraryBackground.tsx` | **Create** | Clear-to-blur Skia shader with image transitions |
| `app/(tabs)/index.tsx` | **Modify** | Replace DynamicBackground with SkiaLibraryBackground, add scroll handler |
| `components/DynamicBackground.tsx` | **Keep** | Don't delete — may be used on other screens or as fallback |
| `components/SkiaShaderBackground.tsx` | **Keep** | AI page shader, already working |
| `jest.setup.js` | **May modify** | Add `useImage` mock if not already present |

---

## Verification Checklist

### Phase 1
- [ ] `SkiaLibraryBackground` renders on simulator with clear top / blur bottom
- [ ] Cross-fade transitions when focus changes between items
- [ ] Dark fallback when no imageUrl (no crash, no white flash)
- [ ] `tsc --noEmit` passes clean
- [ ] Tests pass (26/28, 2 pre-existing failures)
- [ ] Screenshot confirms visual quality matches or exceeds DynamicBackground
- [ ] Deploy to physical Apple TV, verify 60fps

### Phase 2
- [ ] Blur line moves up when scrolling down
- [ ] Blur line returns to default when scrolling back to top
- [ ] Smooth animation (no jank or flicker)
- [ ] Focus-driven scroll triggers blur line animation

### Phase 3 (Stretch)
- [ ] At least one advanced transition implemented and visually verified
- [ ] No performance regression from transition effects

---

## Key References

- react-native-skia docs: https://shopify.github.io/react-native-skia/docs/shaders/runtime-effects
- Skia shaders playground: https://shaders.skia.org/
- Jellyfin image API: `{server}/Items/{id}/Images/Backdrop?api_key={key}&maxWidth={width}`
- `jellyfinApi.ts` line 2301: `getBackdropUrl(itemId, maxWidth)`
- IQ cosine palette (AI page shader reference): https://iquilezles.org/articles/palettes/
