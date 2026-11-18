# Builds every 3D model the strategy edition uses and writes them to assets/models/*.glb.
#
#   blender --background --python tools/blender/build_models.py
#
# Every model is original, made here from Blender primitives with bevels and smooth
# shading. Nothing is downloaded. Positions are written as (x, up, z) to match the
# game's map, where y is up; P() converts to Blender's z-up axes.

import math
import os
import random
import sys

import bpy

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'assets', 'models')
ONLY = [a for a in sys.argv[sys.argv.index('--') + 1:]] if '--' in sys.argv else []


def P(x, up, z):
    return (x, -z, up)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


_mats = {}


def M(name, hexcolor, rough=0.85, metal=0.0, emit=0.0):
    key = (name, hexcolor, rough, metal, emit)
    if key in _mats and _mats[key].name in bpy.data.materials:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
    r, g, bl = [((hexcolor >> s) & 255) / 255 for s in (16, 8, 0)]
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    col = (lin(r), lin(g), lin(bl), 1)
    b.inputs['Base Color'].default_value = col
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    if emit > 0:
        b.inputs['Emission Color'].default_value = col
        b.inputs['Emission Strength'].default_value = emit
    _mats[key] = m
    return m


def finish(obj, material, bevel=0.012, smooth=True, rot3=None):
    bpy.context.view_layer.objects.active = obj
    for o in bpy.context.selected_objects:
        o.select_set(False)
    obj.select_set(True)
    if rot3:
        rx, ry, rz = rot3
        obj.rotation_euler = (rx, -rz, ry)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(35)
    if smooth:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(48))
    return obj


def box(w, h, d, x, up, z, material, bevel=0.012, rot3=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(x, up, z))
    o = bpy.context.active_object
    o.scale = (w, d, h)
    return finish(o, material, bevel, True, rot3)


def cyl(rt, rb, h, x, up, z, material, verts=20, bevel=0.01, rot3=None):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=rb, radius2=rt, depth=h, location=P(x, up, z))
    return finish(bpy.context.active_object, material, bevel if rt > 0 else 0, True, rot3)


def ball(r, x, up, z, material, scale=(1, 1, 1), seg=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(8, seg // 2), radius=r, location=P(x, up, z))
    o = bpy.context.active_object
    o.scale = (scale[0], scale[2], scale[1])
    return finish(o, material, 0, True)


def rock(r, x, up, z, material, scale=(1, 1, 1), seed=1, rough=0.22, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=P(x, up, z))
    o = bpy.context.active_object
    rnd = random.Random(seed)
    for v in o.data.vertices:
        k = 1 + (rnd.random() - 0.5) * 2 * rough
        v.co *= k
    o.scale = (scale[0], scale[2], scale[1])
    return finish(o, material, 0, True)


def mesh(name, verts3, faces, material, bevel=0.008, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([P(*v) for v in verts3], [], faces)
    me.update()
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    # Make every face point outwards.
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    return finish(o, material, bevel, smooth)


def gable(w, d, h, x, up, z, material, turn=False, over=0.04):
    """A pitched roof. The ridge runs along x, or along z when turn is set."""
    a, b = (w / 2 + over, d / 2 + over)
    if turn:
        v = [(-a, 0, -b), (a, 0, -b), (a, 0, b), (-a, 0, b), (0, h, -b), (0, h, b)]
        f = [(0, 1, 4), (3, 5, 2), (0, 4, 5, 3), (1, 2, 5, 4), (0, 3, 2, 1)]
    else:
        v = [(-a, 0, -b), (a, 0, -b), (a, 0, b), (-a, 0, b), (-a, h, 0), (a, h, 0)]
        f = [(0, 4, 3), (1, 2, 5), (0, 1, 5, 4), (3, 4, 5, 2), (0, 3, 2, 1)]
    return mesh('roof', [(x + p[0], up + p[1], z + p[2]) for p in v], f, material, 0.006, False)


def box_uvs(obj):
    """Texture coordinates by box projection: each face is mapped flat along the axis it
    faces, one texture repeat per unit of length. Every part of every model then shows a
    texture at the same size, and the game sets how often each texture repeats."""
    me = obj.data
    uv = me.uv_layers.new(name='UVMap') if not me.uv_layers else me.uv_layers[0]
    for poly in me.polygons:
        n = poly.normal
        ax, ay, az = abs(n.x), abs(n.y), abs(n.z)
        for li in poly.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            if az >= ax and az >= ay:
                uv.data[li].uv = (co.x, co.y)          # tops and undersides
            elif ax >= ay:
                uv.data[li].uv = (co.y, co.z)          # faces looking along x
            else:
                uv.data[li].uv = (co.x, co.z)          # faces looking along y


def export(name):
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.convert(target='MESH')          # applies bevels and smoothing
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    box_uvs(obj)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_animations=False,
                              export_cameras=False, export_lights=False, export_yup=True)
    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    print(f'MODEL {name}: {tris} triangles, {os.path.getsize(path) // 1024} KB')


# ---------------------------------------------------------------- palette
WOOD, WOOD_D, CANVAS = 0x9a6b3c, 0x4a3320, 0xf3ecd8
STONE, STONE_D, STONE_L = 0x9a9488, 0x767064, 0xb9b3a6
PLASTER, PLAZA = 0xece5d3, 0xd2cab5
GREEN, RED, VIOLET = 0x2f9e5b, 0xc8322f, 0x7d6bb5
LIT = 0xffe9a0


def window(x, up, z, w=0.07, h=0.09, face='z', color=LIT):
    m = M('lit', color, 0.4, 0, 2.2)
    if face == 'z':
        return box(w, h, 0.012, x, up, z, m, 0)
    return box(0.012, h, w, x, up, z, m, 0)


def house(x, z, w, h, roof, wall=PLASTER, lit=LIT, turn=False, base=0.08):
    box(w, h, w, x, base + h / 2, z, M('plaster', wall))
    gable(w, w, w * 0.55, x, base + h, z, M('roof', roof, 0.7), turn)
    window(x - w * 0.2, base + h * 0.58, z + w / 2 + 0.004, w * 0.22, h * 0.3, 'z', lit)
    window(x + w / 2 + 0.004, base + h * 0.58, z, w * 0.22, h * 0.3, 'x', lit)
    box(w * 0.2, h * 0.5, 0.014, x + w * 0.18, base + h * 0.25, z + w / 2 + 0.003, M('door', WOOD_D), 0)
    cyl(0.018, 0.022, w * 0.35, x + w * 0.22, base + h + w * 0.42, z - w * 0.15, M('stone', STONE_D), 8, 0)


def plaza(color=PLAZA, ring=STONE_L):
    cyl(0.9, 0.95, 0.08, 0, 0.04, 0, M('plaza', color, 0.9), 6, 0.01)
    cyl(0.55, 0.55, 0.012, 0, 0.086, 0, M('paving', ring, 0.9), 24, 0)


def flag(x, up, z, color, h=0.5):
    cyl(0.011, 0.013, h, x, up + h / 2, z, M('pole', WOOD_D), 8, 0)
    box(0.22, 0.13, 0.012, x + 0.12, up + h - 0.08, z, M('flag', color, 0.7), 0.003)
    ball(0.02, x, up + h + 0.01, z, M('gold', 0xf2c96b, 0.3, 0.8))


def village(roof, wall=PLASTER, lit=LIT):
    for i, (x, z, w, h) in enumerate([(-0.52, 0.3, 0.22, 0.2), (0.5, -0.32, 0.24, 0.24), (0.22, 0.56, 0.2, 0.18), (-0.38, -0.5, 0.22, 0.2), (0.6, 0.22, 0.18, 0.16)]):
        house(x, z, w, h, roof, wall, lit, turn=i % 2 == 0)


def bush(x, z, s=1.0, color=0x4c8f44):
    rock(0.09 * s, x, 0.08 + 0.07 * s, z, M('leaf', color, 0.95), (1, 0.8, 1), int(x * 100 + z * 10), 0.18, 1)


# ---------------------------------------------------------------- units (they face +x)
def unit_wagon():
    wood, dark = M('wood', WOOD), M('wood dark', WOOD_D)
    box(0.56, 0.05, 0.34, -0.14, 0.2, 0, wood)
    for z in (-0.16, 0.16):
        box(0.56, 0.11, 0.025, -0.14, 0.27, z, wood)
    for x in (-0.41, 0.13):
        box(0.025, 0.11, 0.34, x, 0.27, 0, wood)
    cover = cyl(0.2, 0.2, 0.5, -0.14, 0.36, 0, M('canvas', CANVAS, 0.95), 24, 0.008, rot3=(0, 0, math.pi / 2))
    cover.scale = (1, 0.92, 1.05)
    for x in (-0.36, -0.14, 0.08):
        cyl(0.208, 0.208, 0.02, x, 0.36, 0, M('hoop', 0xd8cdb2), 24, 0, rot3=(0, 0, math.pi / 2))
    for x in (-0.33, 0.06):
        for z in (-0.2, 0.2):
            cyl(0.12, 0.12, 0.04, x, 0.12, z, dark, 20, 0.006, rot3=(math.pi / 2, 0, 0))
            cyl(0.035, 0.035, 0.06, x, 0.12, z, M('hub', 0xc9a66b), 12, 0.004, rot3=(math.pi / 2, 0, 0))
            for a in range(4):
                box(0.2, 0.014, 0.014, x, 0.12, z + (0.012 if z > 0 else -0.012), M('spoke', 0xc9a66b), 0, rot3=(0, 0, a * math.pi / 4))
    box(0.3, 0.02, 0.02, 0.3, 0.2, 0, dark, 0)                           # pole to the ox
    ox = M('ox', 0xb08a5a)
    ball(0.13, 0.5, 0.25, 0, ox, (1.45, 0.95, 0.9))
    ball(0.075, 0.71, 0.3, 0, ox, (1.15, 1, 0.95))
    box(0.06, 0.05, 0.07, 0.79, 0.275, 0, M('muzzle', 0xd9c0a0), 0.012)
    for z in (-0.06, 0.06):
        cyl(0.0, 0.016, 0.1, 0.7, 0.4, z * 1.35, M('horn', CANVAS, 0.5), 8, 0, rot3=(0.9 if z > 0 else -0.9, 0, 0))
        ball(0.012, 0.775, 0.315, z * 0.55, M('eye', 0x1d1414, 0.3))
    for x in (0.4, 0.6):
        for z in (-0.06, 0.06):
            cyl(0.022, 0.026, 0.16, x, 0.08, z, M('leg', 0x8a6a45), 8, 0.004)
    box(0.05, 0.04, 0.2, 0.62, 0.36, 0, wood, 0.01)                      # yoke
    flag(-0.4, 0.3, 0, GREEN, 0.52)
    export('unit-wanted')


def unit_raider():
    cloak, dark, steel = M('cloak', RED, 0.8), M('dark', 0x2a1f1f, 0.6), M('steel', 0xc9ccd2, 0.35, 0.9)
    for z in (-0.06, 0.06):
        box(0.1, 0.05, 0.06, 0.02, 0.025, z, M('boot', 0x1d1414), 0.012)
    cyl(0.1, 0.25, 0.46, 0, 0.26, 0, cloak, 20, 0.008)
    cyl(0.13, 0.11, 0.13, 0, 0.53, 0, dark, 16, 0.02)                     # shoulders
    box(0.3, 0.05, 0.06, 0, 0.56, 0, dark, 0.02, rot3=(0, math.pi / 2, 0))
    ball(0.105, 0, 0.68, 0, dark, (1, 1.05, 1))
    box(0.02, 0.03, 0.12, 0.095, 0.685, 0, M('eyes', 0xff3b30, 0.4, 0, 3.0), 0)
    cyl(0.112, 0.112, 0.03, 0, 0.7, 0, steel, 20, 0.004)
    for z in (-1, 1):
        cyl(0.0, 0.03, 0.2, 0, 0.82, z * 0.14, M('horn', CANVAS, 0.5), 10, 0, rot3=(z * 0.75, 0, 0))
        cyl(0.035, 0.04, 0.2, 0.06, 0.45, z * 0.16, dark, 10, 0.008, rot3=(0, 0, 0.5))
    cyl(0.011, 0.011, 1.0, 0.2, 0.52, 0.18, M('shaft', WOOD_D), 8, 0)
    cyl(0.0, 0.04, 0.15, 0.2, 1.09, 0.18, steel, 8, 0)
    box(0.2, 0.11, 0.012, 0.09, 0.9, 0.18, M('pennant', 0x1d1414), 0.003)
    cyl(0.17, 0.17, 0.03, 0.17, 0.36, -0.14, M('shield', 0x3a2b2b, 0.7), 24, 0.01, rot3=(0, 0, math.pi / 2))
    cyl(0.175, 0.175, 0.015, 0.165, 0.36, -0.14, steel, 24, 0.004, rot3=(0, 0, math.pi / 2))
    ball(0.045, 0.2, 0.36, -0.14, steel, (0.7, 1, 1))
    cape = box(0.02, 0.4, 0.3, -0.13, 0.36, 0, M('cape', 0x8a1f1f, 0.9), 0.008, rot3=(0, 0, -0.22))
    export('unit-attack')


def unit_drifter():
    robe, hood = M('robe', VIOLET, 0.9), M('hood', 0x5d5080, 0.9)
    cyl(0.07, 0.23, 0.48, 0, 0.24, 0, robe, 20, 0.008)
    ball(0.12, 0, 0.56, 0, hood, (1, 1, 1))
    cyl(0.0, 0.13, 0.2, -0.02, 0.72, 0, hood, 16, 0, rot3=(0, 0, 0.25))
    ball(0.085, 0.045, 0.555, 0, M('face', 0x16121f, 0.9), (0.8, 0.9, 0.9))
    for z in (-0.03, 0.03):
        ball(0.014, 0.115, 0.565, z, M('eyes', 0xfff0a8, 0.4, 0, 3.0))
    cyl(0.012, 0.014, 0.72, 0.2, 0.36, 0.08, M('staff', WOOD_D), 8, 0)
    box(0.1, 0.012, 0.012, 0.24, 0.7, 0.08, M('staff', WOOD_D), 0)
    box(0.07, 0.09, 0.07, 0.28, 0.63, 0.08, M('lantern', 0xfff0a8, 0.3, 0, 4.0), 0.012)
    box(0.085, 0.015, 0.085, 0.28, 0.685, 0.08, M('iron', 0x2a2a2a, 0.5, 0.8), 0.004)
    box(0.085, 0.015, 0.085, 0.28, 0.578, 0.08, M('iron', 0x2a2a2a, 0.5, 0.8), 0.004)
    rock(0.1, -0.16, 0.34, 0, M('sack', 0x9a8a6a, 0.95), (0.9, 1.1, 1), 4, 0.1)
    export('unit-unneeded')


# ---------------------------------------------------------------- districts
def district_web():
    plaza()
    village(0xc0563a)
    wall = M('marble', 0xf5f0e2, 0.6)
    box(0.74, 0.05, 0.6, 0, 0.105, 0, M('step', STONE_L))
    box(0.66, 0.05, 0.52, 0, 0.155, 0, M('step', STONE_L))
    box(0.56, 0.4, 0.42, 0, 0.38, 0, wall)
    for x in (-0.24, -0.08, 0.08, 0.24):
        cyl(0.028, 0.032, 0.4, x, 0.38, 0.25, wall, 12, 0.004)
        window(x * 0.9, 0.36, 0.212, 0.06, 0.16)
    box(0.62, 0.05, 0.6, 0, 0.605, 0.04, wall)
    gable(0.6, 0.16, 0.12, 0, 0.63, 0.25, M('roof', 0xc0563a, 0.7), turn=False)
    dome = ball(0.24, 0, 0.63, -0.02, M('dome', 0xc0563a, 0.5), (1, 0.85, 1))
    cyl(0.04, 0.05, 0.1, 0, 0.86, -0.02, wall, 12, 0.004)
    ball(0.035, 0, 0.93, -0.02, M('gold', 0xf2c96b, 0.3, 0.8))
    flag(-0.66, 0.08, -0.1, 0x2f6fb5)
    bush(-0.2, 0.5); bush(0.36, 0.42, 0.8)
    export('district-web')


def district_mail():
    plaza()
    village(0x3f7fb5)
    wall = M('plaster', PLASTER)
    box(0.5, 0.36, 0.44, 0, 0.26, 0, wall)
    gable(0.5, 0.44, 0.2, 0, 0.44, 0, M('roof', 0x3f7fb5, 0.7))
    cyl(0.13, 0.15, 0.62, -0.14, 0.75, -0.08, wall, 16, 0.008)
    cyl(0.17, 0.17, 0.04, -0.14, 1.07, -0.08, M('stone', STONE_L), 16, 0.006)
    cyl(0.0, 0.2, 0.3, -0.14, 1.24, -0.08, M('roof', 0x3f7fb5, 0.7), 16, 0)
    cyl(0.07, 0.07, 0.015, -0.14, 0.92, 0.075, M('clock', 0xfff8e0, 0.4, 0, 1.2), 20, 0, rot3=(math.pi / 2, 0, 0))
    for x in (-0.15, 0.12):
        window(x, 0.28, 0.224, 0.09, 0.12)
    box(0.24, 0.16, 0.012, 0.3, 0.52, 0.23, M('sign', CANVAS), 0.004)            # an envelope sign
    box(0.17, 0.012, 0.014, 0.3, 0.535, 0.238, M('ink', 0x3f7fb5), 0, rot3=(0, 0, 0.5))
    box(0.17, 0.012, 0.014, 0.3, 0.535, 0.238, M('ink', 0x3f7fb5), 0, rot3=(0, 0, -0.5))
    for i, (x, z) in enumerate([(0.34, 0.34), (0.44, 0.3), (0.38, 0.42)]):
        rock(0.06, x, 0.13, z, M('sack', 0xd9c79a, 0.95), (1, 1.1, 1), i + 9, 0.1, 1)
    flag(-0.66, 0.08, -0.1, 0x2f6fb5)
    bush(-0.3, 0.52)
    export('district-mail')


def district_jump():
    plaza()
    village(0x7a6a9c)
    st, sd = M('stone', 0xbdb6a6), M('stone dark', 0xa8a192)
    box(0.5, 0.86, 0.5, 0, 0.51, 0, st, 0.015)
    box(0.56, 0.05, 0.56, 0, 0.955, 0, sd)
    for x in (-0.22, 0, 0.22):
        for z in (-0.22, 0, 0.22):
            if x == 0 and z == 0:
                continue
            box(0.1, 0.1, 0.1, x * 1.05, 1.03, z * 1.05, st, 0.01)
    for x in (-0.25, 0.25):
        for z in (-0.25, 0.25):
            cyl(0.07, 0.07, 0.96, x, 0.56, z, sd, 12, 0.006)
            cyl(0.0, 0.085, 0.16, x, 1.12, z, M('roof', 0x7a6a9c, 0.7), 12, 0)
    for up in (0.4, 0.66):
        window(0, up, 0.254, 0.05, 0.12)
        window(0.254, up, 0, 0.05, 0.12, 'x')
    box(0.14, 0.2, 0.014, 0, 0.18, 0.254, M('door', WOOD_D), 0.004)
    box(0.16, 0.012, 0.18, 0, 0.09, 0.35, M('wood', WOOD), 0.004)                 # drawbridge
    flag(0, 0.98, 0, 0xf2c96b, 0.4)
    flag(-0.66, 0.08, -0.1, 0x2f6fb5)
    export('district-jump')


def district_db():
    plaza()
    village(0x4f9a6a)
    for i, (x, z, n, r) in enumerate([(-0.16, -0.02, 3, 0.2), (0.22, 0.06, 2, 0.19), (0.02, -0.3, 2, 0.15)]):
        for k in range(n):
            cyl(r, r, 0.19, x, 0.185 + k * 0.215, z, M('drum', 0xdbe7de if k % 2 == 0 else 0xbdd2c4, 0.45, 0.3), 28, 0.012)
            cyl(r + 0.008, r + 0.008, 0.028, x, 0.29 + k * 0.215, z, M('band', 0x3f8a5c, 0.5, 0.4), 28, 0.004)
            window(x, 0.2 + k * 0.215, z + r + 0.002, 0.06, 0.035, 'z', 0x9dffb8)
        cyl(0.0, r * 0.9, 0.08, x, 0.13 + n * 0.215, z, M('cap', 0x3f8a5c, 0.5, 0.4), 28, 0)
    cyl(0.02, 0.02, 0.4, 0.03, 0.5, 0.02, M('pipe', 0x8fa39a, 0.4, 0.8), 10, 0, rot3=(0, 0, math.pi / 2))
    for k in range(6):
        box(0.07, 0.01, 0.01, -0.16, 0.14 + k * 0.1, 0.19, M('pipe', 0x8fa39a, 0.4, 0.8), 0)
    flag(-0.66, 0.08, -0.1, 0x2f6fb5)
    bush(0.44, 0.44, 0.9)
    export('district-db')


def district_app():
    plaza()
    village(0xc98a2b)
    box(0.66, 0.34, 0.46, 0, 0.25, 0, M('brick', 0xcf8f6a, 0.9))
    for i in range(3):                                                        # a saw-tooth roof
        x = -0.22 + i * 0.22
        mesh('saw', [(x - 0.11, 0.42, -0.23), (x + 0.11, 0.42, -0.23), (x + 0.11, 0.42, 0.23), (x - 0.11, 0.42, 0.23), (x - 0.11, 0.56, -0.23), (x - 0.11, 0.56, 0.23)],
             [(0, 1, 4), (3, 5, 2), (1, 2, 5, 4), (0, 4, 5, 3), (0, 3, 2, 1)], M('roof', 0xc98a2b, 0.6), 0.004, False)
        window(x, 0.26, 0.234, 0.1, 0.12)
    cyl(0.055, 0.07, 0.56, 0.24, 0.62, -0.12, M('chimney', 0x8a5a4a, 0.9), 14, 0.006)
    cyl(0.065, 0.065, 0.03, 0.24, 0.9, -0.12, M('stone', STONE_D), 14, 0.004)
    for i, (dx, up, r) in enumerate([(0.02, 1.0, 0.06), (0.07, 1.1, 0.08), (0.03, 1.22, 0.1)]):
        rock(r, 0.24 + dx, up, -0.12, M('smoke', 0xf2f2f2, 1.0), (1, 0.8, 1), i + 3, 0.12, 1)
    gear = M('gear', 0xf2c96b, 0.35, 0.8)
    cyl(0.12, 0.12, 0.03, -0.2, 0.3, 0.25, gear, 20, 0.004, rot3=(math.pi / 2, 0, 0))
    for a in range(8):
        box(0.045, 0.045, 0.03, -0.2 + math.cos(a * math.pi / 4) * 0.13, 0.3 + math.sin(a * math.pi / 4) * 0.13, 0.25, gear, 0.004, rot3=(0, 0, a * math.pi / 4))
    cyl(0.04, 0.04, 0.04, -0.2, 0.3, 0.255, M('hub', WOOD_D), 12, 0, rot3=(math.pi / 2, 0, 0))
    flag(-0.66, 0.08, -0.1, 0x2f6fb5)
    export('district-app')


def district_dns():
    plaza()
    village(0x2f8f9a)
    wall = M('plaster', PLASTER)
    cyl(0.17, 0.2, 0.1, 0, 0.13, 0, M('stone', STONE_L), 8, 0.008)
    cyl(0.085, 0.13, 0.9, 0, 0.63, 0, wall, 8, 0.008)
    cyl(0.12, 0.12, 0.04, 0, 1.1, 0, M('stone', STONE_L), 8, 0.004)
    cyl(0.07, 0.07, 0.12, 0, 1.18, 0, M('lamp', 0xbff3ff, 0.3, 0, 4.0), 12, 0.004)
    cyl(0.0, 0.12, 0.14, 0, 1.31, 0, M('roof', 0x2f8f9a, 0.6), 8, 0)
    for i, (up, ry, col) in enumerate([(0.86, 0.3, 0x2f8f9a), (0.68, -1.0, 0xc98a2b), (0.5, 1.9, 0x2f8f9a), (0.34, -2.4, 0xc0563a)]):
        box(0.4, 0.085, 0.022, math.cos(ry) * 0.2, up, -math.sin(ry) * 0.2, M('sign', col, 0.7), 0.006, rot3=(0, ry, 0))
        cyl(0.0, 0.06, 0.09, math.cos(ry) * 0.43, up, -math.sin(ry) * 0.43, M('sign', col, 0.7), 4, 0, rot3=(0, ry, -math.pi / 2))
    flag(-0.66, 0.08, -0.1, 0x2f6fb5)
    bush(0.3, 0.4); bush(-0.24, -0.3, 0.8)
    export('district-dns')


def district_site():
    plaza()
    village(0xb5563f)
    for i, (x, z, col) in enumerate([(-0.18, 0.04, 0xc0563a), (0.2, 0.06, 0x3f7fb5), (0.02, -0.26, 0xe0b040)]):
        box(0.26, 0.14, 0.18, x, 0.15, z, M('wood', WOOD))
        box(0.3, 0.02, 0.26, x, 0.4, z + 0.02, M('awning', col, 0.8), 0.006, rot3=(0.22, 0, 0))
        for k in range(3):
            box(0.03, 0.022, 0.265, x - 0.1 + k * 0.1, 0.402, z + 0.02, M('stripe', CANVAS), 0, rot3=(0.22, 0, 0))
        for dx in (-0.13, 0.13):
            cyl(0.01, 0.01, 0.34, x + dx, 0.25, z + 0.1, M('pole', WOOD_D), 6, 0)
        for k, c in enumerate([0xd0453c, 0xe0b040, 0x4c8f44]):
            ball(0.028, x - 0.08 + k * 0.08, 0.24, z + 0.02, M('goods', c, 0.6))
    cyl(0.1, 0.1, 0.1, 0.02, 0.13, 0.34, M('stone', STONE), 14, 0.008)            # a well
    cyl(0.085, 0.085, 0.012, 0.02, 0.17, 0.34, M('water', 0x4a9bd0, 0.1), 14, 0)
    flag(-0.66, 0.08, -0.1, 0x2f6fb5)
    export('district-site')


def district_hostile():
    plaza(0x625a72, 0x4d4460)
    village(0x2a2038, 0x4d3f63, 0xd07bff)
    dark, darker = M('obsidian', 0x2f2540, 0.45, 0.2), M('obsidian dark', 0x1d1528, 0.4, 0.3)
    cyl(0.28, 0.42, 0.66, 0, 0.41, 0, dark, 6, 0.012)
    for i in range(6):
        a = i * math.pi / 3 + 0.3
        cyl(0.0, 0.07, 0.42, math.cos(a) * 0.3, 0.9, math.sin(a) * 0.3, darker, 5, 0, rot3=(math.sin(a) * 0.3, 0, -math.cos(a) * 0.3))
    for i, (x, z, h) in enumerate([(-0.34, 0.3, 0.6), (0.4, -0.2, 0.75)]):
        cyl(0.07, 0.1, h, x, 0.08 + h / 2, z, dark, 6, 0.008, rot3=(0.08, 0, 0.1 if i else -0.1))
        cyl(0.0, 0.09, 0.22, x, 0.2 + h, z, darker, 6, 0)
        window(x, 0.08 + h * 0.6, z + 0.09, 0.03, 0.09, 'z', 0xd07bff)
    rock(0.14, 0, 0.98, 0, M('crystal', 0xd07bff, 0.2, 0, 4.0), (0.8, 1.5, 0.8), 7, 0.15, 1)
    for a in range(3):
        window(math.cos(a * 2.1) * 0.33, 0.35, math.sin(a * 2.1) * 0.33 + 0.02, 0.04, 0.12, 'z', 0xd07bff)
    flag(-0.66, 0.08, -0.1, 0x7a2a8a)
    export('district-hostile')


def district_rival():
    plaza(0xd9c3cc, 0xc9aab8)
    village(0xb5466f)
    st = M('stone', 0xd9cfd3)
    box(0.5, 0.5, 0.4, 0, 0.33, 0, st)
    for x in (-0.28, 0.28):
        cyl(0.1, 0.11, 0.8, x, 0.48, 0, st, 14, 0.008)
        cyl(0.0, 0.14, 0.3, x, 1.03, 0, M('roof', 0xb5466f, 0.6), 14, 0)
    for x in (-0.14, 0.14):
        window(x, 0.36, 0.204, 0.07, 0.12, 'z', 0xffd0e2)
    flag(0, 0.58, 0, 0xe7a3bd, 0.5)
    export('district-rival')


# ---------------------------------------------------------------- the wall
def wall_tower():
    st, sd = M('stone', STONE), M('stone dark', STONE_D)
    cyl(0.25, 0.3, 0.95, 0, 0.475, 0, sd, 16, 0.012)
    cyl(0.32, 0.3, 0.1, 0, 1.0, 0, st, 16, 0.01)
    for i in range(8):
        a = i * math.pi / 4
        box(0.1, 0.13, 0.1, math.cos(a) * 0.27, 1.11, math.sin(a) * 0.27, st, 0.012, rot3=(0, -a, 0))
    for a in (0, math.pi):
        window(math.cos(a) * 0.268, 0.6, 0, 0.03, 0.16, 'x', 0x2a2a2a)
    export('wall-tower')


def wall_segment():
    """One unit long along z, centred; the game stretches it to fit between two towers."""
    st, sd = M('stone', STONE), M('stone dark', STONE_D)
    box(0.3, 0.66, 1.0, 0, 0.33, 0, st, 0.01)
    box(0.42, 0.06, 1.0, 0, 0.69, 0, sd, 0.008)
    for i in range(5):
        box(0.09, 0.12, 0.11, -0.16, 0.78, (i - 2) * 0.2, st, 0.012)
    for i in range(4):
        box(0.012, 0.3, 0.05, -0.152, 0.3, (i - 1.5) * 0.24, M('stone light', STONE_L), 0)   # buttress stripes
    export('wall-segment')


def gatehouse():
    st, sd, roof = M('stone', STONE), M('stone dark', STONE_D), M('roof', 0x2f6fb5, 0.6)
    for z in (-0.62, 0.62):
        cyl(0.33, 0.4, 1.7, 0, 0.85, z, sd, 20, 0.014)
        cyl(0.42, 0.38, 0.12, 0, 1.76, z, st, 20, 0.01)
        for i in range(8):
            a = i * math.pi / 4
            box(0.12, 0.15, 0.12, math.cos(a) * 0.36, 1.89, z + math.sin(a) * 0.36, st, 0.012, rot3=(0, -a, 0))
        cyl(0.0, 0.34, 0.62, 0, 2.14, z, roof, 20, 0)
        ball(0.04, 0, 2.47, z, M('gold', 0xf2c96b, 0.3, 0.8))
        for up in (0.7, 1.2):
            for a in (0, math.pi):
                window(math.cos(a) * 0.37, up, z, 0.04, 0.18, 'x')
        flag(0, 2.45, z, 0xf2c96b, 0.5)
    box(0.6, 0.55, 0.96, 0, 1.3, 0, sd, 0.012)                               # the bridge over the gate
    box(0.7, 0.07, 1.0, 0, 1.6, 0, st, 0.01)
    for i in range(5):
        for x in (-0.3, 0.3):
            box(0.1, 0.13, 0.12, x, 1.7, (i - 2) * 0.2, st, 0.012)
    for x in (-0.305, 0.305):
        for z in (-0.2, 0.2):
            window(x, 1.3, z, 0.06, 0.16, 'x')
    arch = cyl(0.36, 0.36, 0.62, 0, 1.02, 0, M('shadow', 0x2a251f), 24, 0, rot3=(0, 0, math.pi / 2))   # the dark of the archway
    box(0.5, 1.0, 0.72, 0, 0.5, 0, M('shadow', 0x2a251f), 0)
    wood = M('wood dark', WOOD_D)
    for z in (-0.3, -0.15, 0, 0.15, 0.3):                                    # a raised portcullis
        box(0.04, 0.5, 0.03, 0.27, 0.95, z, M('iron', 0x3a3a3a, 0.5, 0.8), 0)
    for up in (0.8, 1.0):
        box(0.04, 0.03, 0.66, 0.27, up, 0, M('iron', 0x3a3a3a, 0.5, 0.8), 0)
    for z in (-1.0, 1.0):                                                    # torch brackets; the game adds the flames
        for x in (-0.44, 0.44):
            cyl(0.02, 0.024, 0.5, x, 0.25, z, wood, 8, 0)
            cyl(0.05, 0.03, 0.06, x, 0.52, z, M('iron', 0x3a3a3a, 0.5, 0.8), 8, 0)
    box(0.9, 0.03, 0.8, -0.72, 0.015, 0, M('wood', WOOD), 0.006)             # a plank bridge to the road
    export('gatehouse')


# ---------------------------------------------------------------- the land
def tile():
    """One hex tile, 1 unit tall. The game colours 'top' and 'side' and scales the height."""
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=1.0, radius2=1.0, depth=0.86, location=P(0, 0.43, 0))
    finish(bpy.context.active_object, M('side', 0x8c7250, 0.95), 0.0, False)
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.985, radius2=0.9, depth=0.14, location=P(0, 0.93, 0))
    finish(bpy.context.active_object, M('top', 0x86b85c, 0.9), 0.02, False)
    export('tile')


def pine():
    trunk = M('trunk', 0x5b4025)
    cyl(0.03, 0.045, 0.2, 0, 0.1, 0, trunk, 8, 0)
    for i, (r, up, c) in enumerate([(0.22, 0.26, 0x2a6436), (0.17, 0.42, 0x33743f), (0.11, 0.57, 0x3d8449)]):
        cyl(0.0, r, 0.26, 0, up, 0, M('pine', c, 0.95), 9, 0)
    export('tree-pine')


def oak():
    cyl(0.035, 0.05, 0.24, 0, 0.12, 0, M('trunk', 0x5b4025), 8, 0)
    for i, (x, up, z, r) in enumerate([(0, 0.36, 0, 0.19), (0.11, 0.3, 0.05, 0.13), (-0.1, 0.32, -0.06, 0.13), (0.02, 0.47, -0.03, 0.12)]):
        rock(r, x, up, z, M('leaf', 0x4c8f44 if i % 2 == 0 else 0x5aa04f, 0.95), (1, 0.85, 1), i + 20, 0.16, 2)
    export('tree-oak')


def mountain():
    rnd = random.Random(5)
    for i, (x, z, r, h) in enumerate([(-0.08, 0, 0.8, 1.55), (0.44, 0.24, 0.5, 0.95), (-0.36, -0.3, 0.42, 0.7)]):
        bpy.ops.mesh.primitive_cone_add(vertices=9, radius1=r, radius2=0.02, depth=h, location=P(x, h / 2, z))
        o = bpy.context.active_object
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.subdivide(number_cuts=3)
        bpy.ops.object.mode_set(mode='OBJECT')
        for v in o.data.vertices:
            k = (v.co.z + h / 2) / h                       # 0 at the foot, 1 at the peak
            jitter = 0.11 * r * (1 - k * 0.6)
            v.co.x += (rnd.random() - 0.5) * 2 * jitter
            v.co.y += (rnd.random() - 0.5) * 2 * jitter
        o.data.materials.append(M('rock', 0x857c72 if i == 0 else 0x91887c, 0.95))
        o.data.materials.append(M('snow', 0xf6f5f1, 0.6))
        for p in o.data.polygons:
            top = sum(o.data.vertices[v].co.z for v in p.vertices) / len(p.vertices)
            p.material_index = 1 if (top + h / 2) > 0.95 and i == 0 or ((top + h / 2) > 0.74 and i == 1) else 0
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.shade_flat()
    export('mountain')


def hills():
    for i, (x, z, r, sy) in enumerate([(0.1, 0, 0.44, 0.5), (-0.34, 0.26, 0.3, 0.45), (-0.2, -0.34, 0.24, 0.42), (0.42, 0.34, 0.18, 0.4)]):
        rock(r, x, 0.0, z, M('hill', 0x97905f if i % 2 == 0 else 0xa39b68, 0.95), (1, sy, 1), i + 40, 0.1, 2)
    rock(0.07, 0.36, 0.05, -0.3, M('stone', STONE), (1, 0.8, 1), 50, 0.2, 1)
    export('hills')


def barn():
    box(0.26, 0.18, 0.22, 0, 0.09, 0, M('barn', 0xb5463a, 0.9))
    gable(0.26, 0.22, 0.13, 0, 0.18, 0, M('roof', 0x6b4a36, 0.8))
    box(0.09, 0.12, 0.012, 0, 0.06, 0.112, M('door', CANVAS), 0.003)
    cyl(0.06, 0.06, 0.2, 0.22, 0.1, 0.02, M('silo', 0xd9d2c2), 12, 0.006)
    cyl(0.0, 0.065, 0.07, 0.22, 0.235, 0.02, M('roof', 0x6b4a36, 0.8), 12, 0)
    export('barn')


def boulder():
    rock(0.16, 0, 0.08, 0, M('boulder', 0xbda77a, 0.95), (1, 0.7, 1), 60, 0.22, 1)
    rock(0.09, 0.17, 0.04, 0.08, M('boulder', 0xb39d70, 0.95), (1, 0.7, 1), 61, 0.22, 1)
    export('boulder')


MODELS = {
    'unit-wanted': unit_wagon, 'unit-attack': unit_raider, 'unit-unneeded': unit_drifter,
    'district-web': district_web, 'district-mail': district_mail, 'district-jump': district_jump, 'district-db': district_db,
    'district-app': district_app, 'district-dns': district_dns, 'district-site': district_site,
    'district-hostile': district_hostile, 'district-rival': district_rival,
    'wall-tower': wall_tower, 'wall-segment': wall_segment, 'gatehouse': gatehouse,
    'tile': tile, 'tree-pine': pine, 'tree-oak': oak, 'mountain': mountain, 'hills': hills, 'barn': barn, 'boulder': boulder,
}

for name, build in MODELS.items():
    if ONLY and name not in ONLY:
        continue
    reset()
    _mats.clear()
    build()
print('DONE', len(MODELS) if not ONLY else len(ONLY))
