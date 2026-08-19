---
name: 3d-asset-converter
description: >
  Convert industrial-design 3D assets (FBX, GLB) into optimized, web-ready GLB
  files using Blender Python scripts. Covers the full pipeline: inspect, decimate,
  preserve materials, join meshes safely, remove unwanted geometry, and export
  with Draco compression. Use this skill whenever the user mentions converting
  3D models, FBX to GLB, optimizing meshes for WebGL/Three.js, running Blender
  scripts, reducing polygon count, or integrating 3D device renders into a web
  prototype. Also trigger when the user mentions receiving new 3D assets from
  designers, CAD exports, KeyShot renders, or wants to get a model "web-ready."
---

# 3D Asset Converter — Blender FBX/GLB → Web-Ready GLB

This skill encodes hard-won patterns from iterative 3D model conversion work.
The core challenge: industrial-design models from tools like KeyShot, SolidWorks,
or Fusion 360 are beautiful but far too heavy for real-time web rendering
(50–500 MB, millions of polygons). This skill guides you through converting them
to lightweight GLBs (2–10 MB) without destroying the visual fidelity that the
designers intended.

## The Two-Pass Workflow

Every conversion starts with **inspect**, then **convert**. Never skip inspect.

**Pass 1 — Inspect:** Import the source file, dump the mesh hierarchy, face
counts, material names, and PBR properties. This reveals the model's structure
so you can configure decimation overrides, identify delicate geometry, and plan
material handling.

```
blender --background --python scripts/convert-<device>.py -- --inspect
```

**Pass 2 — Convert:** Run the full pipeline with the configuration tuned from
the inspect output.

```
blender --background --python scripts/convert-<device>.py
```

The user runs these commands locally (Blender must be installed). You write and
iterate on the Python script; the user runs it and shares results (screenshots,
terminal output, file sizes).

## Pipeline Steps (in order)

Every conversion script should follow this sequence:

1. **clear_scene()** — Wipe Blender's default scene
2. **import** — Load FBX (`import_scene.fbx`) or GLB (`import_scene.gltf`)
3. **remove_non_mesh()** — Delete cameras, lights, childless empties
4. **remove_unwanted()** — Delete cables, connectors, or other geometry the user doesn't want (configurable per-device)
5. **decimate_meshes()** — Reduce polygon count (see Decimation section)
6. **assign_materials()** — Preserve or remap materials (see Materials section)
7. **join_by_material()** — Merge meshes to reduce draw calls (see Joining section)
8. **rename_meshes()** — Clean names based on material assignment
9. **center_and_normalize()** — Center at origin, scale to ~3 unit height
10. **export_glb()** — Export with Draco compression

## Decimation — The Hardest Part

Decimation is where most visual quality is lost. The key insight: **different
parts of a model need wildly different treatment.** A smooth plastic shell can
lose 75% of its faces and look fine. An earpad's thin-walled cushion or a
honeycomb grille pattern will be destroyed at even 40% reduction.

### Strategy: Named Overrides + Keyword Protection + Fallback Tiers

Use a layered approach. Each mesh is evaluated in this order:

1. **Thin-wall keyword check** — If the mesh or material name contains a
   delicate-geometry keyword, skip decimation entirely (ratio 1.0). This is the
   most important protection layer.

2. **Named group override** — If the mesh (or its parent in the hierarchy)
   matches a key in `DECIMATE_OVERRIDE`, use that ratio. Populated from the
   inspect output.

3. **Global default ratio** — Everything else gets this. Start conservative
   (0.25 = keep 25%) and tighten later if the file is too large.

### Thin-Wall Keywords

These catch geometry that decimation destroys regardless of ratio:

```python
THIN_WALL_KEYWORDS = [
    "earpad", "ear_pad", "cushion",
    "mesh_n", "grille", "grill", "honeycomb",
    "sponge", "cloth", "velvet",
]
```

Extend this list per-device based on the inspect output. The pattern: anything
with a repeating geometric pattern (grilles, vents, mesh screens) or thin-walled
construction (cushions, gaskets, fabric) should be here.

### The get_parent_group Bug

When writing `get_parent_group(obj)` to walk the hierarchy for named overrides,
**always check the object's own name first**, then walk up parents. FBX imports
sometimes make the group name the object itself rather than a parent empty:

```python
def get_parent_group(obj):
    # Check object's own name FIRST
    own_name = obj.name.split(".")[0]
    if own_name in DECIMATE_OVERRIDE:
        return own_name
    # Then walk parents
    parent = obj.parent
    while parent:
        name = parent.name.split(".")[0]
        if name in DECIMATE_OVERRIDE:
            return name
        parent = parent.parent
    return None
```

Omitting the self-check was a bug that caused honeycomb grilles to be decimated
despite having ratio 1.0, because they were the named objects themselves rather
than children of named empties.

### Starting Ratios

For a first pass, use these as starting points and adjust after visual review:

| Part type | Starting ratio | Notes |
|-----------|---------------|-------|
| Grilles, earpads, mesh screens | 1.0 | Skip entirely — pattern IS the detail |
| Logo-bearing surfaces (headband, buckles) | 0.60–0.75 | Embossed/debossed text needs high poly count |
| Outer shell, visible structure | 0.25–0.35 | Smooth surfaces decimate well |
| Small hardware (screws, springs) | 0.15 | Barely visible, aggressive is fine |
| Hidden internals | 0.10–0.15 | User won't see these |

### make_single_user — Eliminating "Multi-User Data" Errors

Blender's Decimate modifier fails silently on instanced (multi-user) mesh data
with "Modifiers cannot be applied to multi-user data." Always call this before
applying any modifier:

```python
def make_single_user(obj):
    if obj.data and obj.data.users > 1:
        obj.data = obj.data.copy()
```

Call it before `modifier_apply` in `decimate_meshes()` AND before `join()` in
`join_by_material()`. This single fix eliminated a class of errors that caused
meshes to silently skip decimation while other parts were over-decimated.

## Materials — Preserve the Designer's Intent

Industrial designers spend significant time tuning materials in KeyShot,
SolidWorks Visualize, or similar tools. The default approach should be to
**preserve the original material colors and PBR properties**, not replace them
with a simplified palette.

### Preservation Strategy

When the source file's materials already have Principled BSDF nodes (which is
the case for most FBX and all GLB exports from professional tools), keep them:

```python
def assign_materials(clean_mats):
    for obj in bpy.data.objects:
        if obj.type != 'MESH' or not obj.data or not obj.data.materials:
            continue
        mat = obj.data.materials[0]
        if not mat:
            continue

        # Check for existing Principled BSDF
        bsdf = None
        if mat.use_nodes:
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            if not bsdf:
                for node in mat.node_tree.nodes:
                    if "Principled" in node.name:
                        bsdf = node
                        break

        if bsdf:
            preserved += 1  # Keep original colors
        else:
            # No usable BSDF — fall back to clean palette
            target = resolve_material(obj)
            clean_mat = clean_mats.get(target)
            if clean_mat:
                obj.data.materials.clear()
                obj.data.materials.append(clean_mat)
```

Only fall back to a replacement palette (`ls-*` or similar) when materials are
corrupt or missing shader nodes.

### When Replacement IS Needed

Some scenarios where you do want to replace materials:

- The source file has no PBR materials (very old FBX exports, STL files)
- The user explicitly asks for a simplified/stylized look
- Materials reference external textures that won't be bundled

In those cases, create a small palette of `MeshStandardMaterial`-compatible
PBR materials and use a `MATERIAL_REMAP` dict mapping source material names
to palette names. Use the inspect output to build this mapping.

## Joining Meshes — The Protected Group Pattern

After decimation and material assignment, join meshes that share the same
material to reduce draw calls. But naive joining destroys delicate geometry
by merging it with unrelated parts that happen to share a material.

The fix: **partition meshes into "joinable" and "protected" groups.** Protected
meshes are only joined within their own group — never with other geometry.

```python
def is_protected(obj):
    """Dual-path detection: hierarchy-based AND keyword-based."""
    group = get_parent_group(obj)
    if group in PROTECTED_GROUPS:
        return True
    return is_thin_wall(obj)  # keyword fallback

def join_by_material():
    joinable = {}    # material_name → [objects]
    protected = {}   # unique_key → [objects]

    for obj in list(bpy.data.objects):
        if obj.type != 'MESH' or not obj.data.materials:
            continue
        mat_name = obj.data.materials[0].name

        if is_protected(obj):
            group = get_parent_group(obj) or obj.name.split(".")[0]
            key = f"protected__{group}__{mat_name}"
            protected.setdefault(key, []).append(obj)
        else:
            joinable.setdefault(mat_name, []).append(obj)

    # Join each group separately, calling make_single_user first
    for groups in [joinable, protected]:
        for key, objects in groups.items():
            if len(objects) <= 1:
                continue
            for obj in objects:
                make_single_user(obj)
            bpy.ops.object.select_all(action='DESELECT')
            for obj in objects:
                obj.select_set(True)
            bpy.context.view_layer.objects.active = objects[0]
            bpy.ops.object.join()
```

The key insight: `is_protected` uses **both** hierarchy-based `PROTECTED_GROUPS`
(for known parts from the inspect output) **and** keyword-based `is_thin_wall`
(as a safety net for meshes that don't match the hierarchy). Belt and suspenders.

## Removing Unwanted Geometry

Models from industrial designers often include cables, connectors, screws, and
internal components that shouldn't appear in the final render. Remove these
early in the pipeline (before decimation) to save processing time and avoid
artifacts.

Use a two-pronged approach:

```python
REMOVE_GROUPS = {"USB ASM"}  # Entire hierarchy subtrees to delete

REMOVE_NAME_KEYWORDS = [     # Object name substring matches
    "braided", "usb ", "usb_",
    "pj35a", "dc-nei",       # connector part numbers
]

REMOVE_MATERIAL_KEYWORDS = [ # Material name substring matches
    "braided_cable", "usb rubber", "usb metal",
]
```

Log each removed object so the user can verify nothing important was deleted.
Be conservative with keywords — better to leave something in and let the user
ask you to remove it than to silently delete part of the product.

## Export Settings

Always export with Draco mesh compression for web delivery:

```python
bpy.ops.export_scene.gltf(
    filepath=GLB_PATH,
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
)
```

These settings provide a good balance of compression vs. quality. The position
quantization (14 bits) preserves fine detail; normal quantization (10 bits) is
sufficient for smooth shading.

## Center and Normalize

Always center the model at the origin and scale to a consistent height (~3
units). This makes the model predictable for any viewer that loads it:

```python
def center_and_normalize():
    from mathutils import Vector
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # Compute bounding box across all meshes
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
    scale = 3.0 / max(dims.x, dims.y, dims.z, 0.001)

    for obj in bpy.data.objects:
        if obj.type != 'MESH' or not obj.data.vertices:
            continue
        for v in obj.data.vertices:
            v.co = (v.co - center) * scale
        obj.data.update()
```

## GLB-to-GLB Optimization (Alternative Path)

When the source file is already a GLB (e.g., from a designer's KeyShot export),
a simpler pipeline works. The key differences from FBX conversion:

- **No named hierarchy** — GLB exports typically flatten the object tree, so
  you can't use named overrides. Use face-count-based decimation tiers instead:

  ```python
  DECIMATION_TIERS = [
      (500_000, 0.03),  # monster meshes
      (100_000, 0.06),  # very high poly
      (50_000,  0.10),
      (10_000,  0.15),
      (2_000,   0.25),
      (0,       1.0),   # tiny: skip
  ]
  ```

- **Materials are already PBR** — glTF materials have Principled BSDF nodes
  by default, so preservation is straightforward.

- **Thin-wall detection by keyword is even more important** since there's no
  hierarchy to fall back on.

## Iterating on Results

Expect 3–6 rounds of iteration. The typical progression:

1. **Round 1:** Inspect + first conversion. Usually too aggressive — holes in
   earpads, distorted grilles.
2. **Rounds 2–3:** Increase ratios for problem areas. Discover that thin-walled
   geometry can't be decimated at all.
3. **Rounds 4–5:** Add protected groups and keyword detection. Fix the
   `get_parent_group` self-name bug. Fix `join_by_material` cross-contamination.
4. **Round 6+:** Fine-tune logo surfaces, remove unwanted geometry, adjust
   material handling.

After each round, ask the user to share Blender screenshots from multiple angles.
Look specifically for: holes in surfaces, distorted patterns/logos, missing parts,
and geometry that should have been removed.

## Three.js Integration Notes

When loading the optimized GLB in a Three.js scene:

- Use `GLTFLoader` with `DRACOLoader` for decompression
- If the model has no emissive zones (purely a product shot), use scene-wide
  point lights for ambient RGB lighting rather than per-zone emissive lights
- Set `envMapIntensity` on materials for consistent look against dark backgrounds
- The model is already normalized to ~3 units, so camera framing is predictable

## File Size Targets

| Source size | Target GLB | Acceptable range |
|-------------|-----------|-----------------|
| < 50 MB     | 2–4 MB   | Up to 6 MB      |
| 50–200 MB   | 4–8 MB   | Up to 12 MB     |
| > 200 MB    | 6–12 MB  | Up to 15 MB     |

If the output exceeds the target, tighten decimation on the largest meshes first
(inspect output shows face counts sorted by size). Draco compression typically
provides 3–5x additional reduction on top of decimation.
