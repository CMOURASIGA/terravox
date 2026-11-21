#!/usr/bin/env python3
"""Convert the verified Poly Haven glTF source bundle into self-contained GLB assets.

Run after scripts/stage-forest-v2-assets.py. Fails closed if a source is missing.
"""
import json
import pathlib
import sys
import trimesh

SOURCE = pathlib.Path("artifacts/forest-v2-source")
DEST = pathlib.Path("public/assets/forest-v2/nature")
NAMES = {"fern": "fern_02", "rock": "boulder_01", "moss": "moss_01", "wood": "pine_roots"}


def main():
    manifest = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
    assets = {entry["category"]: entry for entry in manifest["assets"]}
    DEST.mkdir(parents=True, exist_ok=True)
    results = []
    for category, expected in NAMES.items():
        entry = assets.get(category)
        if entry is None or entry["id"] != expected:
            raise ValueError(f"Unexpected {category} asset: expected {expected}, got {entry}")
        source = SOURCE / entry["model"]
        if source.suffix.lower() not in (".gltf", ".glb"):
            raise ValueError(f"Unsupported source model: {source}")
        scene = trimesh.load(str(source), force="scene", process=False)
        if not scene.geometry:
            raise ValueError(f"No geometry in {source}")
        destination = DEST / f"{expected}.glb"
        payload = scene.export(file_type="glb")
        if not isinstance(payload, bytes) or len(payload) < 1000 or payload[:4] != b"glTF":
            raise ValueError(f"Invalid GLB for {expected}")
        destination.write_bytes(payload)
        results.append({"category": category, "name": expected, "file": destination.name,
                        "bytes": len(payload), "source": entry["source"], "license": "CC0-1.0"})
        print(f"GLB_READY {expected} {len(payload)} bytes")
    (DEST / "manifest.json").write_text(json.dumps({"provider": "Poly Haven", "assets": results}, indent=2), encoding="utf-8")
    print("NATURE_GLB_EXPORT_PASS")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"NATURE_GLB_EXPORT_FAIL: {exc}", file=sys.stderr)
        raise
