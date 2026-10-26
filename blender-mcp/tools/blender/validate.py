"""Closed TerraVox B3.3 validation script. Invoked only by the worker allowlist."""
import argparse
import json
import math
import os
import sys

import bpy
import mathutils


def args():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--correlation-id", required=True)
    return parser.parse_args(values)


def triangle_count(mesh):
    return sum(max(0, len(poly.vertices) - 2) for poly in mesh.polygons)


def texture_dimensions():
    dimensions = []
    external = []
    for image in bpy.data.images:
        if image.source == "FILE" and image.filepath and not image.packed_file:
            external.append(image.filepath)
        if image.size[0] > 0 and image.size[1] > 0:
            dimensions.append((image.size[0], image.size[1]))
    return dimensions, external


def base_center(meshes):
    points = []
    for obj in meshes:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ mathutils.Vector(corner))
    if not points:
        return False
    min_z = min(point.z for point in points)
    center_x = (min(point.x for point in points) + max(point.x for point in points)) / 2
    center_y = (min(point.y for point in points) + max(point.y for point in points)) / 2
    return abs(center_x) < 0.0001 and abs(center_y) < 0.0001 and abs(min_z) < 0.0001


def main():
    value = args()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    dimensions, external = texture_dimensions()
    metrics = {
        "triangles": sum(triangle_count(obj.data) for obj in meshes),
        "materials": len(bpy.data.materials),
        "textures": len(dimensions),
        "maxTextureWidth": max((item[0] for item in dimensions), default=0),
        "maxTextureHeight": max((item[1] for item in dimensions), default=0),
        "glbBytes": 0,
        "unit": "meters" if bpy.context.scene.unit_settings.system == "METRIC" and bpy.context.scene.unit_settings.scale_length == 1.0 else "unknown",
        "origin": "base_center" if base_center(meshes) else "other",
        "animationCount": len(bpy.data.actions),
        "armatureCount": sum(1 for obj in bpy.context.scene.objects if obj.type == "ARMATURE"),
        "externalReferences": sorted(external),
    }
    errors = []
    if not meshes:
        errors.append({"code": "ASSET_VALIDATION_FAILED", "message": "Asset has no mesh objects"})
    result = {"schemaVersion": 1, "correlationId": value.correlation_id, "metrics": metrics, "errors": errors, "warnings": []}
    temporary = value.output + ".tmp"
    with open(temporary, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, allow_nan=False, sort_keys=True)
    os.replace(temporary, value.output)


main()
