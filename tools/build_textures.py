#!/usr/bin/env python3
# Draws the surface textures used on the 3D models and writes them to assets/textures/*.png.
#
#   python3 tools/build_textures.py
#
# Every texture is original, drawn here from arithmetic and a seeded random number
# generator. Each is a grey "detail" image that repeats seamlessly; the game multiplies
# it with a model's own colour, so one stone texture serves every stone colour.
# No libraries: the PNG files are written by hand with zlib.

import math
import os
import random
import struct
import zlib

N = 256
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'textures')


def save(name, pixel):
    rows = bytearray()
    for y in range(N):
        rows.append(0)
        for x in range(N):
            rows.append(max(0, min(255, int(pixel(x, y) * 255 + 0.5))))
    def chunk(kind, data):
        body = kind + data
        return struct.pack('>I', len(data)) + body + struct.pack('>I', zlib.crc32(body) & 0xffffffff)
    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', N, N, 8, 0, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b'')
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, name + '.png')
    with open(path, 'wb') as f:
        f.write(png)
    print(f'TEXTURE {name}: {len(png) // 1024} KB')


def noise(seed, cells):
    """Smooth noise that wraps at the edges, so the texture tiles."""
    rnd = random.Random(seed)
    grid = [[rnd.random() for _ in range(cells)] for _ in range(cells)]
    def at(x, y):
        fx, fy = x / N * cells, y / N * cells
        x0, y0 = int(fx) % cells, int(fy) % cells
        x1, y1 = (x0 + 1) % cells, (y0 + 1) % cells
        tx, ty = fx - int(fx), fy - int(fy)
        tx, ty = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
        top = grid[y0][x0] * (1 - tx) + grid[y0][x1] * tx
        bot = grid[y1][x0] * (1 - tx) + grid[y1][x1] * tx
        return top * (1 - ty) + bot * ty
    return at


def blocks(name, bw, bh, seed, mortar=0.6, lo=0.84):
    rnd = random.Random(seed)
    shade = {}
    fine, broad = noise(seed + 1, 64), noise(seed + 2, 8)
    def pixel(x, y):
        row = y // bh
        xs = (x + (bw // 2 if row % 2 else 0)) % N
        col = xs // bw
        key = (row, col)
        if key not in shade:
            shade[key] = lo + rnd.random() * (1 - lo)
        edge = min(xs % bw, bw - 1 - xs % bw, y % bh, bh - 1 - y % bh)
        if edge < 1:
            return mortar
        bevel = 0.93 if edge < 2 else 1.0
        return shade[key] * bevel * (0.95 + fine(x, y) * 0.07) * (0.96 + broad(x, y) * 0.06)
    save(name, pixel)


def wood():
    rnd = random.Random(7)
    plank = [0.86 + rnd.random() * 0.14 for _ in range(8)]
    grain, knots = noise(8, 128), noise(9, 6)
    def pixel(x, y):
        p = x // 32
        if x % 32 < 1:
            return 0.58
        streak = grain((x * 7 + p * 37) % N, (y // 6 + p * 11) % N)      # long thin lines down each plank
        return plank[p] * (0.9 + streak * 0.12) * (0.97 + knots(x, y) * 0.05)
    save('wood', pixel)


def shingle():
    rnd = random.Random(11)
    shade = [[0.86 + rnd.random() * 0.14 for _ in range(8)] for _ in range(8)]
    fine = noise(12, 64)
    def pixel(x, y):
        row = y // 32
        xs = (x + (16 if row % 2 else 0)) % N
        col = xs // 32
        fx, fy = xs % 32, y % 32
        scallop = fy > 22 + 8 * math.cos((fx - 16) / 16 * math.pi / 2)   # the rounded lower edge of each tile
        if fx < 1 or scallop:
            return 0.6
        lap = 0.82 + 0.18 * min(1, fy / 10)                               # shadow under the row above
        return shade[row % 8][col % 8] * lap * (0.96 + fine(x, y) * 0.06)
    save('shingle', pixel)


def plaster():
    broad, mid, fine = noise(21, 5), noise(22, 20), noise(23, 96)
    save('plaster', lambda x, y: 0.9 + broad(x, y) * 0.06 + mid(x, y) * 0.03 + (0.02 if fine(x, y) > 0.82 else 0) - (0.05 if fine(x, y) < 0.08 else 0))


def cloth():
    broad = noise(31, 6)
    def pixel(x, y):
        weave = 0.5 + 0.5 * math.sin(x * math.pi / 2) * math.sin(y * math.pi / 2)
        return 0.9 + weave * 0.07 + broad(x, y) * 0.04 - 0.02
    save('cloth', pixel)


def rock():
    a, b, c, d = noise(41, 4), noise(42, 11), noise(43, 32), noise(44, 90)
    def pixel(x, y):
        v = a(x, y) * 0.45 + b(x, y) * 0.3 + c(x, y) * 0.17 + d(x, y) * 0.08
        crack = 0.82 if abs(b(x, y) - 0.5) < 0.012 else 1.0
        return (0.78 + v * 0.26) * crack
    save('rock', pixel)


def foliage():
    a, b, c = noise(51, 9), noise(52, 26), noise(53, 80)
    save('foliage', lambda x, y: 0.8 + a(x, y) * 0.08 + b(x, y) * 0.08 + (0.06 if c(x, y) > 0.7 else 0) - (0.06 if c(x, y) < 0.22 else 0))


def grass():
    rnd = random.Random(61)
    blades = {}
    for _ in range(900):
        x, y, h = rnd.randrange(N), rnd.randrange(N), rnd.randrange(3, 7)
        tone = 0.86 if rnd.random() < 0.5 else 1.0
        for k in range(h):
            blades[(x, (y + k) % N)] = tone
    broad, mid = noise(62, 5), noise(63, 24)
    save('grass', lambda x, y: (0.9 + broad(x, y) * 0.06 + mid(x, y) * 0.04) * blades.get((x, y), 0.96))


def soil():
    a, b = noise(71, 10), noise(72, 70)
    save('soil', lambda x, y: 0.88 + a(x, y) * 0.07 + (0.05 if b(x, y) > 0.75 else 0) - (0.07 if b(x, y) < 0.15 else 0))


blocks('stone', 64, 32, 1)
blocks('brick', 32, 16, 2, 0.66, 0.8)
wood(); shingle(); plaster(); cloth(); rock(); foliage(); grass(); soil()
