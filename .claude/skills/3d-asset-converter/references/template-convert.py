"""
3D Asset Conversion Template — Blender Python Script
=====================================================
Copy this template and customize for each new device.

Run:  blender --background --python scripts/convert-<device>.py
Inspect:  blender --background --python scripts/convert-<device>.py -- --inspect

Customize these sections per-device:
  - Paths (INPUT_PATH, OUTPUT_PATH)
  - PROTECTED_GROUPS (from inspect output)
  - THIN_WALL_KEYWORDS (extend per-device)
  - DECIMATE_OVERRIDE (from inspect output)
  - REMOVE_GROUPS / REMOVE_NAME_KEYWORDS / REMOVE_MATERIAL_KEYWORDS
"""

import bpy
import os
import sys

# ── Paths (customize per-device) ──────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
INPUT_PATH = os.path.join(PROJECT_ROOT, "Assets", "3d-devices", "CHANGEME.fbx")
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "Assets", "3d-devices", "CHANGEME.glb")
INPUT_FORMAT = "fbx"  # "fbx" or "glb"

# ── Protected groups (from inspect output) ────────────────────────────
# Meshes in these groups skip decimation and are joined only within their
# own group.  Populate after running --inspect.
PROTECTED_GROUPS = set()

# ── Thin-wall keywords (extend per-device) ────────────────────────────
# Any mesh/material name containing these keywords is protected from
# decimation and cross-group joining.
THIN_WALL_KEYWORDS = [
    "earpad", "ear_pad", "cushion",
    "mesh_n", "grille", "grill", "honeycomb",
    "sponge", "cloth", "velvet", "fabric",
]

# ── Decimation ────────────────────────────────────────────────────────
DECIMATE_RATIO = 0.25  # Global default: keep 25%

# Per-group overrides (populate from inspect output).
# Use 1.0 to skip decimation entirely.
DECIMATE_OVERRIDE = {}

# Face-count tiers (used for GLB imports where hierarchy is flat)
DECIMATION_TIERS = [
    (500_000, 0.03),
    (100_000, 0.06),
    (50_000,  0.10),
    (10_000,  0.15),
    (2_000,   0.25),
    (0,       1.0),
]

# ── Geometry removal ──────────────────────────────────────────────────
REMOVE_GROUPS = set()              # Parent group names to delete entirely
REMOVE_NAME_KEYWORDS = []          # Object name substrings
REMOVE_MATERIAL_KEYWORDS = []      # Material name substrings

# ── Fallback material palette (only used when original has no BSDF) ──
MATERIALS = {
    "fallback-body": {
        "color": (0.15, 0.15, 0.16, 1.0),
        "roughness": 0.45,
        "metallic": 0.1,
    },
    "fallback-dark": {
        "color": (0.08, 0.08, 0.09, 1.0),
        "roughness": 0.55,
        "metallic": 0.05,
    },
    "fallback-metal": {
        "color": (0.65, 0.65, 0.67, 1.0),
        "roughness": 0.3,
        "metallic": 0.9,
    },
}

# Optional: map source material names → fallback palette names.
# Only used when a material has no Principled BSDF node.
MATERIAL_REMAP = {}


# ═══════════════════════════════════════════════════════════════════════
#  Core functions — generally don't need customization
# ═══════════════════════════════════════════════════════════════════════

def log(msg):
    print(f"[3D Convert] {msg}")
    sys.stdout.flush()


def clear_scene():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)


def import_model():
    log(f"Importing: {INPUT_PATH}")
    if not os.path.exists(INPUT_PATH):
        log(f"ERROR: File not found at {INPUT_PATH}")
        sys.exit(1)

    if INPUT_FORMAT == "fbx":
        bpy.ops.import_scene.fbx(
            filepath=INPUT_PATH,
            use_custom_normals=True,
            use_image_search=False,
            force_connect_children=False,
        )
    elif INPUT_FORMAT == "glb":
        bpy.ops.import_scene.gltf(filepath=INPUT_PATH)
    else:
        log(f"ERROR: Unknown format '{INPUT_FORMAT}'")
        sys.exit(1)

    mesh_count = len([o for o in bpy.data.objects if o.type == 'MESH'])
    total_faces = sum(len(o.data.polygons) for o in bpy.data.objects
                      if o.type == 'MESH' and o.data)
    log(f"Imported {len(bpy.data.objects)} objects, {mesh_count} meshes, {total_faces:,} faces")


def remove_non_mesh():
    removed = 0
    for obj in list(bpy.data.objects):
        if obj.type in ('CAMERA', 'LIGHT', 'LAMP'):
            bpy.data.objects.remove(obj, do_unlink=True)
            removed += 1
    log(f"Removed {removed} non-mesh objects")


def remove_unwanted():
    removed = 0

    def _remove_hierarchy(obj):
        nonlocal removed
        for child in list(obj.children):
            _remove_hierarchy(child)
        bpy.data.objects.remove(obj, do_unlink=True)
        removed += 1

    for obj in list(bpy.data.objects):
        name = obj.name.split(".")[0]
        if name in REMOVE_GROUPS:
            _remove_hierarchy(obj)

    for obj in list(bpy.data.objects):
        if obj.type != 'MESH':
            continue
        obj_name = obj.name.lower()
        mat_name = ""
        if obj.data and obj.data.materials and obj.data.materials[0]:
            mat_name = obj.data.materials[0].name.lower()

        should_remove = False
        for kw in REMOVE_MATERIAL_KEYWORDS:
            if kw in mat_name:
                should_remove = True
                break
        if not should_remove:
            for kw in REMOVE_NAME_KEYWORDS:
                if kw in obj_name:
                    should_remove = True
                    break
        if should_remove:
            log(f"  Removing: {obj.name} (mat: {mat_name})")
            bpy.data.objects.remove(obj, do_unlink=True)
            removed += 1

    log(f"Removed {removed} unwanted objects")


def inspect():
    log("=" * 60)
    log("INSPECT MODE")
    log("=" * 60)

    # Materials
    mat_names = set()
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or not obj.data.materials:
            continue
        for mat in obj.data.materials:
            if mat:
                mat_names.add(mat.name)
    log(f"Found {len(mat_names)} unique materials:")
    for name in sorted(mat_names):
        log(f"  '{name}'")

    # Hierarchy with face counts
    log("\nObject hierarchy:")
    roots = [obj for obj in bpy.data.objects if obj.parent is None]
    def _dump(obj, indent=0):
        prefix = "  " * indent
        mesh_info = ""
        if obj.type == 'MESH' and obj.data:
            faces = len(obj.data.polygons)
            mat_name = obj.data.materials[0].name if obj.data.materials else "no-mat"
            mesh_info = f" [{faces:,} faces, mat: {mat_name}]"
        log(f"  {prefix}{obj.name} ({obj.type}){mesh_info}")
        for child in obj.children:
            _dump(child, indent + 1)
    for root in roots:
        _dump(root)

    # PBR properties
    log("\nPBR properties:")
    for mat in bpy.data.materials:
        if not mat.use_nodes:
            continue
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if not bsdf:
            for node in mat.node_tree.nodes:
                if "Principled" in node.name:
                    bsdf = node
                    break
        if bsdf:
            try:
                color = tuple(round(c, 3) for c in bsdf.inputs["Base Color"].default_value)
                rough = round(bsdf.inputs["Roughness"].default_value, 3)
                metal = round(bsdf.inputs["Metallic"].default_value, 3)
                log(f"  {mat.name}: color={color}, rough={rough}, metal={metal}")
            except Exception as e:
                log(f"  {mat.name}: error — {e}")

    log("=" * 60)
    log("Review above, then populate PROTECTED_GROUPS, DECIMATE_OVERRIDE,")
    log("REMOVE_GROUPS, and keyword lists.  Run again without --inspect.")
    log("=" * 60)


def get_parent_group(obj):
    # Check object's own name first (FBX sometimes makes the group the object)
    own_name = obj.name.split(".")[0]
    if own_name in DECIMATE_OVERRIDE:
        return own_name
    parent = obj.parent
    while parent:
        name = parent.name.split(".")[0]
        if name in DECIMATE_OVERRIDE:
            return name
        parent = parent.parent
    return None


def is_thin_wall(obj):
    name_lower = obj.name.lower()
    for kw in THIN_WALL_KEYWORDS:
        if kw in name_lower:
            return True
    if obj.data and obj.data.materials and obj.data.materials[0]:
        mat_name = obj.data.materials[0].name.lower()
        for kw in THIN_WALL_KEYWORDS:
            if kw in mat_name:
                return True
    return False


def is_protected(obj):
    group = get_parent_group(obj)
    if group in PROTECTED_GROUPS:
        return True
    return is_thin_wall(obj)


def make_single_user(obj):
    if obj.data and obj.data.users > 1:
        obj.data = obj.data.copy()


def get_decimation_ratio(face_count):
    """Face-count tier fallback (for GLB imports without named hierarchy)."""
    for min_faces, ratio in DECIMATION_TIERS:
        if face_count >= min_faces:
            return ratio
    return 1.0


def decimate_meshes():
    total_before = 0
    total_after = 0
    skipped_thin = 0

    mesh_objects = [o for o in bpy.data.objects if o.type == 'MESH']
    log(f"Decimating {len(mesh_objects)} meshes...")

    for obj in mesh_objects:
        if not obj.data or len(obj.data.polygons) == 0:
            continue
        face_count = len(obj.data.polygons)
        total_before += face_count

        if is_thin_wall(obj):
            total_after += face_count
            skipped_thin += 1
            continue

        group = get_parent_group(obj)
        if group and group in DECIMATE_OVERRIDE:
            ratio = DECIMATE_OVERRIDE[group]
        elif INPUT_FORMAT == "glb" and not DECIMATE_OVERRIDE:
            ratio = get_decimation_ratio(face_count)
        else:
            ratio = DECIMATE_OVERRIDE.get(group, DECIMATE_RATIO)

        if face_count < 100 or ratio >= 1.0:
            total_after += face_count
            continue

        make_single_user(obj)
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)

        mod = obj.modifiers.new(name="Decimate", type='DECIMATE')
        mod.ratio = ratio
        mod.use_collapse_triangulate = True

        try:
            bpy.ops.object.modifier_apply(modifier=mod.name)
        except Exception as e:
            log(f"  Warning: decimate failed for {obj.name}: {e}")
            try:
                obj.modifiers.remove(mod)
            except Exception:
                pass

        obj.select_set(False)
        total_after += len(obj.data.polygons)

    reduction = (1 - total_after / max(total_before, 1)) * 100
    log(f"Decimation: {total_before:,} → {total_after:,} faces ({reduction:.1f}% reduction)")
    log(f"  Skipped {skipped_thin} thin-wall meshes")


def resolve_material(obj):
    if not obj.data or not obj.data.materials:
        return "fallback-body"
    mat_name = obj.data.materials[0].name if obj.data.materials else ""
    for pattern, target in MATERIAL_REMAP.items():
        if pattern.lower() in mat_name.lower():
            return target
    return "fallback-body"


def create_materials():
    created = {}
    for name, props in MATERIALS.items():
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get("Principled BSDF")
        if not bsdf:
            bsdf = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
        bsdf.inputs["Base Color"].default_value = props["color"]
        bsdf.inputs["Roughness"].default_value = props["roughness"]
        bsdf.inputs["Metallic"].default_value = props["metallic"]
        if "emissive" in props:
            r, g, b = props["emissive"]
            em_name = "Emission Color" if "Emission Color" in bsdf.inputs else "Emission"
            bsdf.inputs[em_name].default_value = (r, g, b, 1.0)
            bsdf.inputs["Emission Strength"].default_value = props["emissive_strength"]
        created[name] = mat
    return created


def assign_materials(clean_mats):
    preserved = 0
    replaced = 0
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or not obj.data or not obj.data.materials:
            continue
        mat = obj.data.materials[0]
        if not mat:
            continue

        bsdf = None
        if mat.use_nodes:
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            if not bsdf:
                for node in mat.node_tree.nodes:
                    if "Principled" in node.name:
                        bsdf = node
                        break

        if bsdf:
            preserved += 1
        else:
            target = resolve_material(obj)
            clean_mat = clean_mats.get(target)
            if clean_mat:
                obj.data.materials.clear()
                obj.data.materials.append(clean_mat)
                replaced += 1

    log(f"Materials: {preserved} preserved, {replaced} replaced (fallback)")


def join_by_material():
    bpy.ops.object.select_all(action='DESELECT')
    joinable = {}
    protected = {}

    for obj in list(bpy.data.objects):
        if obj.type != 'MESH' or not obj.data.materials:
            continue
        mat_name = obj.data.materials[0].name if obj.data.materials else "unknown"

        if is_protected(obj):
            group = get_parent_group(obj) or obj.name.split(".")[0]
            key = f"protected__{group}__{mat_name}"
            protected.setdefault(key, []).append(obj)
        else:
            joinable.setdefault(mat_name, []).append(obj)

    total = sum(len(v) for v in joinable.values()) + sum(len(v) for v in protected.values())
    log(f"Joining: {total} objects ({len(protected)} protected groups)")

    def do_join(groups, label):
        for key, objects in groups.items():
            if len(objects) <= 1:
                continue
            for obj in objects:
                make_single_user(obj)
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            try:
                bpy.ops.object.join()
            except Exception as e:
                log(f"  Warning: join failed for {label} {key}: {e}")

    do_join(joinable, "normal")
    do_join(protected, "protected")

    final = len([o for o in bpy.data.objects if o.type == 'MESH'])
    log(f"After joining: {final} mesh objects")


def rename_meshes():
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or not obj.data.materials:
            continue
        obj.name = obj.data.materials[0].name


def center_and_normalize():
    from mathutils import Vector
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    all_min = Vector((float('inf'),) * 3)
    all_max = Vector((float('-inf'),) * 3)
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or not obj.data.vertices:
            continue
        for v in obj.data.vertices:
            for i in range(3):
                all_min[i] = min(all_min[i], v.co[i])
                all_max[i] = max(all_max[i], v.co[i])

    center = (all_min + all_max) / 2.0
    dims = all_max - all_min
    max_dim = max(dims.x, dims.y, dims.z, 0.001)
    scale = 3.0 / max_dim

    for obj in bpy.data.objects:
        if obj.type != 'MESH' or not obj.data.vertices:
            continue
        for v in obj.data.vertices:
            v.co = (v.co - center) * scale
        obj.data.update()

    log(f"Normalized: dims ({dims.x:.1f}, {dims.y:.1f}, {dims.z:.1f}), scale {scale:.6f}")


def export_glb():
    log(f"Exporting: {OUTPUT_PATH}")
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_PATH,
        export_format='GLB',
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_apply=True,
        export_materials='EXPORT',
        export_colors=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        use_selection=False,
    )

    if os.path.exists(OUTPUT_PATH):
        size_mb = os.path.getsize(OUTPUT_PATH) / (1024 * 1024)
        log(f"Exported: {size_mb:.1f} MB")
    else:
        log("ERROR: GLB was not created!")
        sys.exit(1)


def main():
    inspect_mode = "--inspect" in sys.argv

    log("=" * 60)
    log("3D Asset Conversion")
    log("=" * 60)

    clear_scene()
    import_model()
    remove_non_mesh()
    remove_unwanted()

    if inspect_mode:
        inspect()
        return

    decimate_meshes()
    clean_mats = create_materials()
    assign_materials(clean_mats)
    join_by_material()
    rename_meshes()
    center_and_normalize()
    export_glb()

    log("=" * 60)
    log("DONE")
    log("=" * 60)


if __name__ == "__main__":
    main()
