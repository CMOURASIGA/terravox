#!/usr/bin/env python3
"""Download CC0 Poly Haven forest models with their glTF dependencies.

The output is a local asset staging directory, not a production release.
Requires Python 3.11+. Network is used only when this script is run.
"""
import argparse
import json
import pathlib
import urllib.parse
import urllib.request

API = "https://api.polyhaven.com"
UA = "TerraVox-forest-v2-asset-pipeline/0.1 (github.com/CMOURASIGA/terravox)"
CATEGORIES = {"fern": ("fern", "plant"), "rock": ("rock", "boulder"), "moss": ("moss", "stone"), "wood": ("stump", "log", "root")}


def get_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.load(response)


def download(url, destination):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    destination.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(req, timeout=120) as response, destination.open("wb") as out:
        while True:
            chunk = response.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)


def select_gltf(files):
    candidates = []
    for group in files.values():
        if not isinstance(group, dict):
            continue
        for resolution, formats in group.items():
            if not isinstance(formats, dict):
                continue
            for fmt, entry in formats.items():
                if fmt.lower() in ("gltf", "glb") and isinstance(entry, dict) and entry.get("url"):
                    candidates.append((0 if resolution == "1k" else 1 if resolution == "2k" else 2,
                                       0 if fmt.lower() == "glb" else 1, resolution, fmt, entry))
    if not candidates:
        raise RuntimeError("No glTF/GLB distribution found")
    return sorted(candidates, key=lambda c: c[:2])[0]


def dependency_items(entry):
    items = entry.get("include") or entry.get("dependencies") or {}
    if isinstance(items, dict):
        for name, item in items.items():
            if isinstance(item, dict) and item.get("url"):
                yield name, item
            elif isinstance(item, dict):
                yield from dependency_items(item)
    elif isinstance(items, list):
        for item in items:
            if isinstance(item, dict) and item.get("url"):
                yield item.get("name") or pathlib.PurePosixPath(urllib.parse.urlparse(item["url"]).path).name, item


def safe_name(name):
    path = pathlib.PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts:
        raise ValueError("Unsafe dependency path")
    return pathlib.Path(*path.parts)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="artifacts/forest-v2-source")
    args = parser.parse_args()
    output = pathlib.Path(args.output)
    manifest = {"provider": "Poly Haven", "license": "CC0-1.0", "api": API, "assets": []}
    catalog = get_json(f"{API}/assets?t=models")
    if not isinstance(catalog, dict):
        raise RuntimeError("Unexpected Poly Haven model catalog response")
    chosen = set()
    for category, terms in CATEGORIES.items():
        ranked = sorted(
            (key for key, metadata in catalog.items()
             if key not in chosen and any(term in (key + " " + " ".join(metadata.get("tags", []))).lower() for term in terms)),
            key=lambda key: (0 if any(term in key.lower() for term in terms) else 1, key),
        )
        asset = None
        for candidate in ranked:
            try:
                candidate_files = get_json(f"{API}/files/{candidate}")
                select_gltf(candidate_files)
                asset, files = candidate, candidate_files
                break
            except (RuntimeError, KeyError, ValueError):
                continue
        if not asset:
            raise RuntimeError(f"No usable glTF model for category {category}")
        chosen.add(asset)
        _, _, resolution, fmt, entry = select_gltf(files)
        folder = output / asset
        source_name = pathlib.PurePosixPath(urllib.parse.urlparse(entry["url"]).path).name
        download(entry["url"], folder / safe_name(source_name))
        dependencies = []
        for name, item in dependency_items(entry):
            target = safe_name(name)
            download(item["url"], folder / target)
            dependencies.append(str(target))
        manifest["assets"].append({
            "id": asset, "category": category, "source": f"https://polyhaven.com/a/{asset}",
            "resolution": resolution, "format": fmt,
            "model": str(pathlib.Path(asset) / source_name), "dependencies": dependencies,
        })
        print(f"STAGED {asset}: {fmt} {resolution}, {len(dependencies)} dependencies")
    output.mkdir(parents=True, exist_ok=True)
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("FOREST_V2_SOURCE_ASSETS_STAGED")


if __name__ == "__main__":
    main()
