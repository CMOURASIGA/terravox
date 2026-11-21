"""Closed TerraVox B3.3 GLB exporter. It never evaluates data from the asset."""
import argparse
import json
import os
import sys

import bpy
import mathutils


def args():
    values = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--glb-output", required=True)
    parser.add_argument("--correlation-id", required=True)
    return parser.parse_args(values)


def normalize_meshes():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("ASSET_VALIDATION_FAILED:no_meshes")
    points = []
    for obj in meshes:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ mathutils.Vector(corner))
    min_z = min(point.z for point in points)
    center_x = (min(point.x for point in points) + max(point.x for point in points)) / 2
    center_y = (min(point.y for point in points) + max(point.y for point in points)) / 2
    for obj in meshes:
        obj.location.x -= center_x
        obj.location.y -= center_y
        obj.location.z -= min_z
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        obj.select_set(False)
    return meshes


def main():
    value = args()
    normalize_meshes()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.ops.wm.save_as_mainfile(filepath=bpy.data.filepath, check_existing=False)
    bpy.ops.export_scene.gltf(filepath=value.glb_output, export_format="GLB", export_animations=False,
                              export_cameras=False, export_lights=False, export_apply=True)
    if not os.path.isfile(value.glb_output) or os.path.getsize(value.glb_output) <= 0:
        raise RuntimeError("EXPORT_FAILED:no_glb")
    result = {"schemaVersion": 1, "correlationId": value.correlation_id, "glbPath": "output.glb"}
    temporary = value.output + ".tmp"
    with open(temporary, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False, allow_nan=False, sort_keys=True)
    os.replace(temporary, value.output)


main()
