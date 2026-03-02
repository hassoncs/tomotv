#!/usr/bin/env python3
"""Fix parallax layers with clean transparency using Pillow + ImageMagick."""
from PIL import Image
import subprocess
import os

APP = "/Users/hassoncs/Workspaces/Personal/automation/radmedia"
GEN = f"{APP}/generated-assets"
PROCESSED = f"{GEN}/processed"

SIZES = {
    "icon": [(400, 240, "1x"), (800, 480, "2x")],
    "app-store": [(1280, 768, "1x"), (2560, 1536, "2x")],
}


def magick_remove_bg(input_path, output_path, color, fuzz_pct=15):
    """Use ImageMagick for bg removal with edge smoothing."""
    subprocess.run([
        "magick", input_path,
        "-fuzz", f"{fuzz_pct}%", "-transparent", color,
        "-channel", "A", "-blur", "0x1", "-level", "50%,100%", "+channel",
        f"PNG32:{output_path}",
    ], check=True)


def center_on_canvas(subject_path, canvas_w, canvas_h, scale=0.65):
    """Center a subject on a transparent canvas."""
    subject = Image.open(subject_path).convert("RGBA")
    canvas = Image.new("RGBA", (canvas_w, canvas_h), (0, 0, 0, 0))
    subj_w, subj_h = subject.size
    target_h = int(canvas_h * scale)
    target_w = int(subj_w * target_h / subj_h)
    if target_w > canvas_w * 0.85:
        target_w = int(canvas_w * 0.85)
        target_h = int(subj_h * target_w / subj_w)
    resized = subject.resize((target_w, target_h), Image.LANCZOS)
    x = (canvas_w - target_w) // 2
    y = (canvas_h - target_h) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas


print("── Extracting cat head (clean bg removal) ──")
icon_path = f"{GEN}/prompt-a/flux-orange/ernie-head-robotic.jpg"
cat_clean = f"{PROCESSED}/cat-head-transparent.png"
magick_remove_bg(icon_path, cat_clean, "rgb(244,123,32)", fuzz_pct=18)
print(f"  ✓ Cat head extracted")

print("\n── Creating Front Layers ──")
for group, sizes in SIZES.items():
    for w, h, scale in sizes:
        canvas = center_on_canvas(cat_clean, w, h, scale=0.70)
        if group == "icon":
            out = f"{APP}/assets/images/icon/front@{scale}.png"
        else:
            out = f"{APP}/assets/images/app-store/v2/front@{scale}.png"
        canvas.save(out, "PNG")
        print(f"  ✓ {out.split('assets/')[-1]} ({w}x{h})")

print("\n── Creating Middle Layers ──")
middle_src = f"{GEN}/prompt-c/ernie-middle-layer.jpg"
middle_clean = f"{PROCESSED}/middle-transparent.png"
magick_remove_bg(middle_src, middle_clean, "rgb(246,237,222)", fuzz_pct=20)
middle_img = Image.open(middle_clean).convert("RGBA")
for group, sizes in SIZES.items():
    for w, h, scale in sizes:
        resized = middle_img.resize((w, h), Image.LANCZOS)
        if group == "icon":
            out = f"{APP}/assets/images/icon/middle@{scale}.png"
        else:
            out = f"{APP}/assets/images/app-store/v2/middle@{scale}.png"
        resized.save(out, "PNG")
        print(f"  ✓ {out.split('assets/')[-1]} ({w}x{h})")

print("\n── Fixing Android Foreground ──")
cat = Image.open(cat_clean).convert("RGBA")
canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
fg = cat.resize((660, 660), Image.LANCZOS)
canvas.paste(fg, (182, 182), fg)
canvas.save(f"{APP}/assets/images/adaptive-icon/foreground.png", "PNG")
print("  ✓ adaptive-icon/foreground.png")

print("\n── Updating xcassets ──")
XC = f"{APP}/Images.xcassets/AppIcon.brandassets"
for scale in ["1x", "2x"]:
    for layer in ["back", "middle", "front"]:
        src = f"{APP}/assets/images/icon/{layer}@{scale}.png"
        dst = f"{XC}/App Icon.imagestack/{layer.capitalize()}.imagestacklayer/Content.imageset/{layer}@{scale}.png"
        if os.path.exists(dst):
            subprocess.run(["cp", src, dst], check=True)
print("  ✓ App Icon imagestack")

for layer in ["back", "middle", "front"]:
    src = f"{APP}/assets/images/app-store/v2/{layer}@1x.png"
    if layer == "back":
        dst = f"{XC}/App Icon - App Store.imagestack/Back.imagestacklayer/Content.imageset/back.png"
    else:
        dst = f"{XC}/App Icon - App Store.imagestack/{layer.capitalize()}.imagestacklayer/Content.imageset/{layer}@1x.png"
    if os.path.exists(dst):
        subprocess.run(["cp", src, dst], check=True)
print("  ✓ App Store imagestack")

print("\n── Regenerating Flattened Composites ──")
flat = f"{APP}/assets/images/tvos-flattened"
base = f"{APP}/assets/images"

def composite(bp, mp, fp, op):
    b = Image.open(bp).convert("RGBA")
    m = Image.open(mp).convert("RGBA")
    f = Image.open(fp).convert("RGBA")
    result = Image.alpha_composite(Image.alpha_composite(b, m), f)
    result.convert("RGB").save(op, "PNG")
    print(f"  ✓ {os.path.basename(op)}")

composite(f"{base}/icon/back@1x.png", f"{base}/icon/middle@1x.png", f"{base}/icon/front@1x.png", f"{flat}/icon-400x240.png")
composite(f"{base}/icon/back@2x.png", f"{base}/icon/middle@2x.png", f"{base}/icon/front@2x.png", f"{flat}/icon-800x480.png")
composite(f"{base}/app-store/v2/back@1x.png", f"{base}/app-store/v2/middle@1x.png", f"{base}/app-store/v2/front@1x.png", f"{flat}/icon-1280x768.png")

print("\n=== All parallax layers fixed and composites regenerated ===")
