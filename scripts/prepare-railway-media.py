#!/usr/bin/env python3
"""Encode approved raster art without cropping and copy its editable components."""
import argparse
from hashlib import sha256
import json
from pathlib import Path
import shutil
from PIL import Image

HERE = Path(__file__).resolve().parents[1]
ART = {
    "hero": "title-hero",
    "map": "route-map",
    "intro": "meadow",
    "basic": "village",
    "full": "mountains",
    "ear": "night-tunnel",
    "mixed": "sea-bridge",
}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=HERE.parent / "railway_assets_v1")
    parser.add_argument("--quality", type=int, default=78)
    args = parser.parse_args()
    out = HERE / "public/art"
    vectors = HERE / "src/assets/railway/vector"
    out.mkdir(parents=True, exist_ok=True)
    vectors.mkdir(parents=True, exist_ok=True)
    entries = []
    for role, stem in ART.items():
        source = args.source / "raster" / f"{stem}.png"
        target = out / f"{stem}.webp"
        with Image.open(source) as im:
            original_size = im.size
            width = min(1280, im.width)
            size = (width, round(im.height * width / im.width))
            im = im.convert("RGB").resize(size, Image.Resampling.LANCZOS)
            im.save(target, format="WEBP", quality=args.quality, method=6)
        entries.append({
            "role": role, "url": f"/art/{stem}.webp", "width": size[0], "height": size[1],
            "bytes": target.stat().st_size, "sha256": sha256(target.read_bytes()).hexdigest(),
            "source": f"Interval_Railway_Assets_v1_20261111/raster/{stem}.png",
            "source_dimensions": original_size, "source_sha256": sha256(source.read_bytes()).hexdigest(),
            "encoding": {"format": "webp", "quality": args.quality, "crop": False},
        })
    originals = sorted((args.source / "vector").glob("*.svg"))
    for source in originals:
        shutil.copyfile(source, vectors / source.name)
    metadata = {
        "pack": "Interval Railway Assets v1", "prepared": "2026-11-11", "source_library_file_id": "libfile_7c15e1d81048819189910a22ba352a1e",
        "purpose": "Approved game artwork; resized and encoded only, never cropped or redrawn.",
        "raster_count": len(entries), "svg_count": len(originals), "total_raster_bytes": sum(x["bytes"] for x in entries),
        "assets": entries,
    }
    (out / "media-manifest.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"raster_bytes": metadata["total_raster_bytes"], "svg_count": len(originals), "assets": [{"role":x["role"],"bytes":x["bytes"],"size":[x["width"],x["height"]]} for x in entries]}))

if __name__ == "__main__":
    main()
