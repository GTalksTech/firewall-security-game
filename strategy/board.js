// Strategy edition: the 3D hex board. It draws what main.js tells it and decides nothing.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// The models are built in Blender by tools/blender/build_models.py and shipped in assets/models.
// If one cannot be loaded, the board falls back to a simpler shape made in code.
const MODEL_NAMES = [
  'unit-wanted', 'unit-attack', 'unit-unneeded',
  'district-web', 'district-mail', 'district-jump', 'district-db', 'district-app', 'district-dns', 'district-site', 'district-hostile', 'district-rival',
  'wall-tower', 'wall-segment', 'gatehouse', 'tile', 'tree-pine', 'tree-oak', 'mountain', 'hills', 'barn', 'boulder',
];
// Surface textures are drawn by tools/build_textures.py. Each is a grey detail image that the
// model's own colour is multiplied with. A material's name decides which one it gets, and
// the number is how many times the texture repeats per unit of length.
const SURFACES = [
  [/^(stone|plaza|paving|step|marble|obsidian|chimney|silo)/, 'stone', 3],
  [/^brick/, 'brick', 3],
  [/^(wood|door|pole|shaft|staff|trunk|barn|spoke)/, 'wood', 4],
  [/^(roof|dome|cap|awning)/, 'shingle', 5],
  [/^plaster/, 'plaster', 2],
  [/^(canvas|sack|flag|cloak|cape|robe|hood|pennant|sign|hoop)/, 'cloth', 8],
  [/^(rock|hill|boulder)/, 'rock', 1.5],
  [/^(leaf|pine)/, 'foliage', 3],
];
const TEXTURE_NAMES = { stone: 3, brick: 3, wood: 4, shingle: 5, plaster: 2, cloth: 8, rock: 1.5, foliage: 3, grass: 1.2, soil: 1.2 };
const TEXTURES = {};
// Loads one file, trying again once if the server drops the connection. Resolves to null if it cannot.
function fetchWith(loader, url) {
  const once = () => new Promise((resolve) => loader.load(url, resolve, undefined, () => resolve(null)));
  return once().then((got) => got || new Promise((r) => setTimeout(r, 250)).then(once));
}
// Runs the jobs a few at a time; a simple local server drops connections if asked for everything at once.
async function inBatches(items, size, job) {
  for (let i = 0; i < items.length; i += size) await Promise.all(items.slice(i, i + size).map(job));
}
function loadTextures(base) {
  const loader = new THREE.TextureLoader();
  return inBatches(Object.entries(TEXTURE_NAMES), 5, async ([name, repeat]) => {
    const tex = await fetchWith(loader, `${base}${name}.png`);
    if (!tex) return;
    tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat, repeat);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    TEXTURES[name] = tex;
  });
}
function texture(material) {
  if (material.map || (material.emissiveIntensity > 0 && material.emissive && material.emissive.getHex() !== 0)) return;
  const hit = SURFACES.find(([pattern]) => pattern.test(material.name || ''));
  if (hit && TEXTURES[hit[1]]) { material.map = TEXTURES[hit[1]]; material.needsUpdate = true; }
}

export async function loadModels(base = 'assets/models/', textureBase = 'assets/textures/') {
  await loadTextures(textureBase);
  const loader = new GLTFLoader();
  const models = {};
  await inBatches(MODEL_NAMES, 6, async (name) => {
    const gltf = await fetchWith(loader, `${base}${name}.glb`);
    if (!gltf) return;
    gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; texture(o.material); } });
    models[name] = gltf.scene;
  });
  return models;
}
let MODELS = {};
const inst = (name) => (MODELS[name] ? MODELS[name].clone(true) : null);

const S = 1;                 // hex size
const COLS = 15;
const ROWS = 11;
const WALL_COL = 7;
const GATE_ROW = 5;
const SQ3 = Math.sqrt(3);

const PAPER = 0xe8dcc2;
const TERRAIN = {
  water: { color: 0x4f9fd1, h: 0.14 },
  plains: { color: 0xc8c46c, h: 0.3 },
  grass: { color: 0x86b85c, h: 0.32 },
  farm: { color: 0xd9c35a, h: 0.31 },
  forest: { color: 0x5c9950, h: 0.34 },
  hills: { color: 0xa89f6e, h: 0.36 },
  desert: { color: 0xdfcd93, h: 0.28 },
  stone: { color: 0xb7b2a6, h: 0.4 },
  mountain: { color: 0x9a9184, h: 0.4 },
};
// Flat land varies a little in height so the map does not look like a tabletop.
function heightAt(col, row) {
  const name = terrainAt(col, row);
  const t = TERRAIN[name];
  if (name === 'water' || name === 'stone') return t.h;
  return Math.min(0.42, t.h + (hash(col + 7, row + 3) % 5) * 0.022);
}
const KIND_COLOR = { wanted: 0x2f9e5b, attack: 0xc8322f, unneeded: 0x7d6bb5 };

const CAP = 0.07;      // thickness of the coloured top of a tile
const GROUND = 0.5;    // the height units travel at, just above the tallest flat tile
function neighbours(col, row) {
  const odd = row & 1;
  return [[col - 1, row], [col + 1, row], [col - 1 + odd, row - 1], [col + odd, row - 1], [col - 1 + odd, row + 1], [col + odd, row + 1]]
    .filter(([c, r]) => c >= 0 && r >= 0 && c < COLS && r < ROWS);
}
const hash = (c, r) => (((c * 73856093) ^ (r * 19349663)) >>> 0) % 100;
function cell(col, row) {
  return new THREE.Vector3(
    S * SQ3 * (col + (row & 1) * 0.5) - S * SQ3 * (COLS / 2),
    0,
    1.5 * S * row - 1.5 * S * ((ROWS - 1) / 2),
  );
}
function terrainAt(col, row) {
  if (col === 0 || row === 0 || col === COLS - 1 || row === ROWS - 1) return 'water';
  if (col === WALL_COL) return 'stone';
  const h = hash(col, row);
  if ((row === 1 || row === ROWS - 2) && col >= 3 && col <= 5 && h < 62) return 'mountain';
  if (col === COLS - 2 && (row === 2 || row === 5 || row === 8)) return 'mountain';
  if (row === GATE_ROW) return col < WALL_COL ? 'plains' : 'grass';
  if (col < WALL_COL) return h < 18 ? 'forest' : h < 30 ? 'hills' : h < 46 ? 'desert' : 'plains';
  return h < 14 ? 'farm' : h < 24 ? 'forest' : 'grass';
}
const DISTRICT_CELLS = {
  1: [[11, 5]],
  2: [[11, 3], [11, 7]],
  3: [[10, 2], [12, 5], [10, 8]],
  4: [[10, 2], [12, 4], [12, 7], [10, 8]],
  5: [[10, 1], [12, 3], [10, 5], [12, 7], [10, 9]],
  6: [[10, 1], [12, 2], [11, 4], [12, 6], [10, 7], [12, 9]],
};
const LANE_ROWS = { wanted: [5, 4, 6, 3, 7], attack: [2, 8, 1, 9, 3, 7], unneeded: [6, 4, 8, 2] };

const mat = (color, extra = {}) => new THREE.MeshLambertMaterial({ color, flatShading: true, ...extra });
function box(w, h, d, color) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.castShadow = true; m.receiveShadow = true; return m; }
function cyl(rt, rb, h, seg, color) { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color)); m.castShadow = true; m.receiveShadow = true; return m; }
function at(mesh, x, y, z) { mesh.position.set(x, y, z); return mesh; }

const glow = (color) => new THREE.MeshBasicMaterial({ color });
function ball(r, color, basic) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), basic ? glow(color) : mat(color)); m.castShadow = !basic; return m; }

// Each kind of traffic has its own outline, so it reads without colour:
// a wagon pulled by an ox, a horned raider with a spear, a hooded drifter with a lantern.
function makeUnit(kind) {
  const model = inst(`unit-${kind}`);
  if (model) {
    const g = new THREE.Group();
    g.add(model);
    g.userData.body = model;
    return g;
  }
  const body = new THREE.Group();
  if (kind === 'wanted') {
    body.add(at(box(0.6, 0.14, 0.36, 0x9a6b3c), -0.12, 0.2, 0));
    const cover = cyl(0.21, 0.21, 0.54, 10, 0xf3ecd8); cover.rotation.z = Math.PI / 2; body.add(at(cover, -0.12, 0.36, 0));
    for (const [x, z] of [[-0.32, 0.2], [0.08, 0.2], [-0.32, -0.2], [0.08, -0.2]]) { const w = cyl(0.12, 0.12, 0.05, 10, 0x4a3320); w.rotation.x = Math.PI / 2; body.add(at(w, x, 0.12, z)); }
    body.add(at(box(0.34, 0.2, 0.2, 0xb08a5a), 0.44, 0.24, 0));          // the ox
    body.add(at(box(0.14, 0.14, 0.16, 0xb08a5a), 0.66, 0.3, 0));
    for (const z of [-0.07, 0.07]) body.add(at(cyl(0, 0.02, 0.1, 4, 0xf3ecd8), 0.68, 0.42, z));
    for (const [x, z] of [[0.32, 0.07], [0.56, 0.07], [0.32, -0.07], [0.56, -0.07]]) body.add(at(box(0.05, 0.14, 0.05, 0x7d5f3c), x, 0.07, z));
    body.add(at(cyl(0.014, 0.014, 0.56, 5, 0x4a3320), -0.36, 0.62, 0));
    body.add(at(box(0.24, 0.15, 0.02, KIND_COLOR.wanted), -0.23, 0.82, 0));
  } else if (kind === 'attack') {
    body.add(at(cyl(0.1, 0.26, 0.5, 8, KIND_COLOR.attack), 0, 0.25, 0));   // cloak
    body.add(at(cyl(0.12, 0.14, 0.16, 8, 0x2a1f1f), 0, 0.5, 0));           // shoulders
    body.add(at(ball(0.12, 0x2a1f1f), 0, 0.66, 0));                         // helmet
    for (const z of [-0.1, 0.1]) { const horn = cyl(0, 0.035, 0.2, 5, 0xe8e0c8); horn.rotation.x = z > 0 ? 0.7 : -0.7; body.add(at(horn, 0, 0.78, z * 1.3)); }
    body.add(at(cyl(0.014, 0.014, 0.95, 5, 0x2a1f1f), 0.2, 0.5, 0.16));     // spear
    body.add(at(cyl(0, 0.045, 0.14, 5, 0xd9d9d9), 0.2, 1.04, 0.16));
    body.add(at(box(0.2, 0.12, 0.02, 0x1d1414), 0.09, 0.88, 0.16));
    const shield = cyl(0.17, 0.17, 0.04, 10, 0x3a2b2b); shield.rotation.z = Math.PI / 2; body.add(at(shield, 0.16, 0.34, -0.12));
    const boss = cyl(0.06, 0.06, 0.05, 8, KIND_COLOR.attack); boss.rotation.z = Math.PI / 2; body.add(at(boss, 0.18, 0.34, -0.12));
  } else {
    body.add(at(cyl(0.08, 0.24, 0.5, 10, KIND_COLOR.unneeded), 0, 0.25, 0));
    body.add(at(ball(0.13, 0x5d5080), 0, 0.58, 0));
    body.add(at(cyl(0, 0.16, 0.2, 10, 0x5d5080), 0, 0.74, 0));              // hood
    body.add(at(cyl(0.012, 0.012, 0.5, 5, 0x4a3320), 0.2, 0.4, 0));
    body.add(at(ball(0.06, 0xfff0a8, true), 0.2, 0.68, 0));                  // lantern
  }
  const g = new THREE.Group();
  g.add(body);
  g.userData.body = body;
  return g;
}

// What a district looks like follows from its name. This is decoration only.
function districtKind(name, hostile) {
  if (hostile) return 'hostile';
  if (/DB|DATA/.test(name)) return 'db';
  if (/MAIL/.test(name)) return 'mail';
  if (/JUMP/.test(name)) return 'jump';
  if (/DNS/.test(name)) return 'dns';
  if (/APP/.test(name)) return 'app';
  if (/VENDOR|SITE/.test(name)) return 'site';
  return 'web';
}
function house(g, x, z, w, h, wall, roof, lit = 0xffe9a0) {
  g.add(at(box(w, h, w, wall), x, 0.08 + h / 2, z));
  const r = cyl(0, w * 0.8, w * 0.62, 4, roof); r.rotation.y = Math.PI / 4; g.add(at(r, x, 0.08 + h + w * 0.31, z));
  const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, h * 0.3, 0.02), glow(lit));
  g.add(at(win, x, 0.08 + h * 0.55, z + w / 2 + 0.006));
  const win2 = win.clone(); win2.rotation.y = Math.PI / 2; g.add(at(win2, x - w / 2 - 0.006, 0.08 + h * 0.55, z));
}
function makeDistrict(name, hostile, seed) {
  const kind = name === 'RIVAL' ? 'rival' : districtKind(name, hostile);
  const g = new THREE.Group();
  const model = inst(`district-${kind}`);
  if (model) {
    g.add(model);
    const blaze = new THREE.Group();
    for (let i = 0; i < 7; i += 1) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 5), glow(i % 2 ? 0xffb02e : 0xff5a1f));
      blaze.add(at(f, Math.cos(i * 0.9) * 0.36, 0.8, Math.sin(i * 0.9) * 0.36));
    }
    blaze.visible = false;
    g.add(blaze);
    g.userData.fire = blaze;
    return g;
  }
  const wall = hostile ? 0x4d3f63 : 0xece5d3;
  const roof = { web: 0xc0563a, mail: 0x3f7fb5, jump: 0x7a6a9c, db: 0x4f9a6a, app: 0xc98a2b, dns: 0x2f8f9a, site: 0xb5563f, hostile: 0x2a2038 }[kind];
  const lit = hostile ? 0xd07bff : 0xffe9a0;
  g.add(at(cyl(0.93, 0.97, 0.08, 6, hostile ? 0x625a72 : 0xd2cab5), 0, 0.04, 0));
  for (const [x, z, w, h] of [[-0.5, 0.28, 0.26, 0.26], [0.48, -0.3, 0.28, 0.3], [0.2, 0.52, 0.24, 0.22], [-0.36, -0.46, 0.26, 0.26], [0.56, 0.24, 0.22, 0.2]]) house(g, x, z, w, h, wall, roof, lit);
  if (kind === 'web') {                       // a domed hall
    g.add(at(box(0.62, 0.5, 0.5, wall), 0, 0.33, 0));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(roof)); dome.castShadow = true; g.add(at(dome, 0, 0.58, 0));
    for (const x of [-0.22, 0, 0.22]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.24, 0.02), glow(lit)), x, 0.3, 0.256));
    for (const x of [-0.32, 0.32]) g.add(at(cyl(0.04, 0.04, 0.5, 8, 0xf5f0e2), x, 0.33, 0.3));
  } else if (kind === 'mail') {               // a post tower with a big flag
    g.add(at(box(0.44, 0.44, 0.44, wall), 0, 0.3, 0));
    g.add(at(cyl(0.16, 0.18, 0.7, 8, wall), 0, 0.87, 0));
    g.add(at(cyl(0, 0.24, 0.3, 8, roof), 0, 1.37, 0));
    g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.02), glow(lit)), 0, 0.3, 0.226));
    g.add(at(box(0.2, 0.12, 0.02, 0xf5f0e2), 0.26, 0.52, 0.24));
  } else if (kind === 'jump') {               // a square keep
    g.add(at(box(0.5, 0.9, 0.5, 0xbdb6a6), 0, 0.53, 0));
    for (const [x, z] of [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]) g.add(at(box(0.12, 0.14, 0.12, 0xa8a192), x, 1.05, z));
    for (const y of [0.45, 0.75]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.02), glow(lit)), 0, y, 0.256));
  } else if (kind === 'db') {                 // stacked drums
    for (const [x, z, n] of [[-0.14, 0, 3], [0.2, 0.08, 2]]) for (let i = 0; i < n; i += 1) {
      g.add(at(cyl(0.2, 0.2, 0.2, 14, i % 2 ? 0xd9e6dc : 0xb9cfc0), x, 0.19 + i * 0.23, z));
      g.add(at(cyl(0.21, 0.21, 0.03, 14, roof), x, 0.3 + i * 0.23, z));
    }
  } else if (kind === 'app') {                // a workshop with a chimney
    g.add(at(box(0.66, 0.36, 0.46, wall), 0, 0.26, 0));
    const r = box(0.7, 0.05, 0.3, roof); r.rotation.x = 0.5; g.add(at(r, 0, 0.5, 0.12));
    const r2 = box(0.7, 0.05, 0.3, roof); r2.rotation.x = -0.5; g.add(at(r2, 0, 0.5, -0.12));
    g.add(at(cyl(0.06, 0.07, 0.5, 8, 0x8a5a4a), 0.22, 0.6, -0.12));
    for (const x of [-0.18, 0.1]) g.add(at(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.02), glow(lit)), x, 0.28, 0.236));
  } else if (kind === 'dns') {                // a signpost obelisk
    g.add(at(cyl(0.1, 0.18, 0.95, 4, wall), 0, 0.55, 0));
    g.add(at(cyl(0, 0.12, 0.2, 4, roof), 0, 1.12, 0));
    for (const [y, ry] of [[0.8, 0.3], [0.62, -0.9], [0.44, 1.8]]) { const sign = box(0.4, 0.09, 0.03, roof); sign.rotation.y = ry; g.add(at(sign, Math.cos(ry) * 0.18, y, -Math.sin(ry) * 0.18)); }
  } else if (kind === 'site') {               // market stalls
    for (const [x, z, c] of [[-0.14, 0.02, 0xc0563a], [0.2, 0.02, 0x3f7fb5], [0.03, -0.26, 0xe0b040]]) {
      g.add(at(box(0.26, 0.18, 0.2, 0x9a6b3c), x, 0.17, z));
      const aw = box(0.32, 0.03, 0.28, c); aw.rotation.x = 0.25; g.add(at(aw, x, 0.42, z));
      for (const dx of [-0.13, 0.13]) g.add(at(cyl(0.012, 0.012, 0.34, 4, 0x4a3320), x + dx, 0.25, z + 0.1));
    }
  } else {                                    // a dark spiked fort
    g.add(at(cyl(0.3, 0.42, 0.7, 6, 0x2f2540), 0, 0.43, 0));
    for (let i = 0; i < 6; i += 1) g.add(at(cyl(0, 0.07, 0.36, 4, 0x1d1528), Math.cos(i * 1.047) * 0.3, 0.9, Math.sin(i * 1.047) * 0.3));
    g.add(at(ball(0.13, 0xd07bff, true), 0, 0.95, 0));
  }
  g.add(at(cyl(0.014, 0.014, 0.5, 5, 0x4a3320), -0.6, 0.55, -0.1));
  g.add(at(box(0.24, 0.15, 0.02, hostile ? 0x7a2a8a : 0x2f6fb5), -0.47, 0.72, -0.1));
  const fire = new THREE.Group();
  for (let i = 0; i < 7; i += 1) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.55, 5), glow(i % 2 ? 0xffb02e : 0xff5a1f));
    fire.add(at(f, Math.cos(i * 0.9) * 0.36, 0.8, Math.sin(i * 0.9) * 0.36));
  }
  fire.visible = false;
  g.add(fire);
  g.userData.fire = fire;
  return g;
}

export function createBoard(container, labelLayer, models = {}) {
  MODELS = models;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  container.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  scene.fog = new THREE.Fog(PAPER, 34, 70);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(-1.3, 18, 14.4);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-1.3, 0, 0.5);
  controls.enableDamping = true;
  controls.minDistance = 9;
  controls.maxDistance = 36;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.2;
  controls.screenSpacePanning = false;
  controls.update();
  renderer.domElement.addEventListener('pointerdown', () => { intro = null; });

  scene.add(new THREE.HemisphereLight(0xdfeeff, 0xb39a6a, 1.15));
  const sun = new THREE.DirectionalLight(0xffe2b0, 2.1);
  sun.position.set(-12, 15, 9);
  sun.shadow.bias = -0.0006;
  sun.shadow.radius = 4;
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14, near: 1, far: 60 });
  scene.add(sun);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: PAPER }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.02; table.receiveShadow = true;
  scene.add(table);

  // ----- static map -----
  const landTop = (col, row) => heightAt(col, row) + CAP;
  const water = [];
  const shaded = (hex, k) => new THREE.Color(hex).multiplyScalar(k).getHex();
  const capGeo = new THREE.CylinderGeometry(S * 0.9, S * 0.97, CAP, 6);
  const mats = {};
  const m = (color) => (mats[color] = mats[color] || mat(color));
  const stds = {};
  const std = (color, rough, tex) => (stds[`${color}${tex}`] = stds[`${color}${tex}`] || new THREE.MeshStandardMaterial({ color, roughness: rough, map: TEXTURES[tex] || null }));
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const name = terrainAt(col, row);
      const p = cell(col, row);
      const hgt = heightAt(col, row);
      const hsh = hash(col, row);
      if (name === 'water') {
        const tile = new THREE.Mesh(new THREE.CylinderGeometry(S, S, hgt, 6), new THREE.MeshPhongMaterial({ color: hsh % 3 === 0 ? 0x4a9bd0 : 0x57a8d8, shininess: 90, specular: 0xbfe6ff, flatShading: true, transparent: true, opacity: 0.93 }));
        tile.position.set(p.x, hgt / 2, p.z);
        tile.receiveShadow = true;
        scene.add(tile);
        water.push({ tile, base: hgt / 2, phase: col * 0.9 + row * 1.3 });
        continue;
      }
      const shore = neighbours(col, row).some(([c, r]) => terrainAt(c, r) === 'water');
      const sideColor = name === 'stone' ? 0x8f897c : shore ? 0xd8c696 : 0x8c7250;
      const tint = 0.94 + (hsh % 7) * 0.02;
      const topColor = shaded(TERRAIN[name].color, tint);
      const top = hgt + CAP;
      const tileModel = inst('tile');
      if (tileModel) {
        tileModel.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = false;
          const topTex = name === 'stone' ? 'stone' : ['grass', 'forest', 'farm', 'mountain', 'hills'].includes(name) ? 'grass' : 'soil';
          o.material = o.material.name === 'top' ? std(topColor, 0.9, topTex) : std(sideColor, 0.95, 'rock');
        });
        tileModel.scale.set(S * 0.985, top, S * 0.985);
        tileModel.position.set(p.x, 0, p.z);
        scene.add(tileModel);
      } else {
        const side = new THREE.Mesh(new THREE.CylinderGeometry(S * 0.985, S * 0.985, hgt, 6), m(sideColor));
        side.position.set(p.x, hgt / 2, p.z);
        side.receiveShadow = true;
        scene.add(side);
        const cap = new THREE.Mesh(capGeo, m(topColor));
        cap.position.set(p.x, hgt + CAP / 2, p.z);
        cap.receiveShadow = true;
        scene.add(cap);
      }
      const prop = (model, x, z, scale, turn) => { model.position.set(x, top, z); model.scale.setScalar(scale); model.rotation.y = turn; scene.add(model); return true; };
      if (name === 'forest') {
        for (let i = 0; i < 4; i += 1) {
          const ang = hsh + i * 1.7;
          const rad = 0.28 + (i % 2) * 0.22;
          const x = p.x + Math.cos(ang) * rad;
          const z = p.z + Math.sin(ang) * rad;
          const sc = 0.8 + ((hsh + i * 13) % 5) * 0.09;
          const tree = inst((hsh + i) % 3 === 0 ? 'tree-oak' : 'tree-pine');
          if (tree) { prop(tree, x, z, sc * 1.15, ang); continue; }
          scene.add(at(cyl(0.035 * sc, 0.045 * sc, 0.16 * sc, 5, 0x5b4025), x, top + 0.08 * sc, z));
          if ((hsh + i) % 3 === 0) {
            const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2 * sc, 0), m(0x4c8f44)); crown.castShadow = true;
            scene.add(at(crown, x, top + 0.3 * sc, z));
          } else {
            scene.add(at(cyl(0, 0.2 * sc, 0.3 * sc, 6, 0x2f6b3a), x, top + 0.28 * sc, z));
            scene.add(at(cyl(0, 0.15 * sc, 0.26 * sc, 6, 0x3a7d45), x, top + 0.46 * sc, z));
          }
        }
      } else if (name === 'hills') {
        const hm = inst('hills');
        if (hm) prop(hm, p.x, p.z, 1, hsh);
        else for (const [dx, dz, r] of [[0.12, 0, 0.42], [-0.3, 0.25, 0.26], [-0.2, -0.3, 0.2]]) {
          const bump = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), m(0x97905f)); bump.castShadow = true; bump.scale.y = 0.6;
          scene.add(at(bump, p.x + dx, top + 0.02, p.z + dz));
        }
      } else if (name === 'mountain' && inst('mountain')) {
        prop(inst('mountain'), p.x, p.z, 1.05, hsh * 0.7);
      } else if (name === 'mountain') {
        scene.add(at(cyl(0, 0.78, 1.5, 6, 0x857c72), p.x - 0.1, top + 0.75, p.z));
        scene.add(at(cyl(0, 0.3, 0.56, 6, 0xf5f3ee), p.x - 0.1, top + 1.23, p.z));
        scene.add(at(cyl(0, 0.5, 0.9, 5, 0x91887c), p.x + 0.42, top + 0.45, p.z + 0.25));
      } else if (name === 'farm') {
        for (let i = -2; i <= 2; i += 1) scene.add(at(box(1.0 - Math.abs(i) * 0.16, 0.035, 0.1, i % 2 ? 0xc9a63c : 0xa8bf4f), p.x, top + 0.018, p.z + i * 0.19));
        if (hsh % 2 === 0 && inst('barn')) prop(inst('barn'), p.x + 0.45, p.z - 0.45, 1.1, hsh);
        else if (hsh % 2 === 0) { scene.add(at(box(0.22, 0.18, 0.2, 0xe9e2d0), p.x + 0.5, top + 0.09, p.z - 0.45)); const r = cyl(0, 0.2, 0.14, 4, 0xa6452f); r.rotation.y = Math.PI / 4; scene.add(at(r, p.x + 0.5, top + 0.25, p.z - 0.45)); }
      } else if (name === 'desert' && hsh % 3 === 0 && inst('boulder')) {
        prop(inst('boulder'), p.x + 0.3, p.z - 0.2, 1.2, hsh);
      } else if (name === 'desert' && hsh % 3 === 0) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), m(0xbda77a)); rock.castShadow = true;
        scene.add(at(rock, p.x + 0.3, top + 0.06, p.z - 0.2));
      } else if (name === 'plains' && hsh % 4 === 0) {
        for (let i = 0; i < 3; i += 1) scene.add(at(cyl(0, 0.05, 0.12, 4, 0x8fa24a), p.x + Math.cos(hsh + i * 2) * 0.4, top + 0.06, p.z + Math.sin(hsh + i * 2) * 0.4));
      }
    }
  }

  // The wall and its gatehouse.
  const stoneTop = TERRAIN.stone.h + CAP;
  const STONE = 0x9a9488;
  const STONE_DARK = 0x7a7468;
  function tower(x, z, r, hgt, roofColor) {
    const g = new THREE.Group();
    g.add(at(cyl(r, r * 1.12, hgt, 10, STONE_DARK), 0, hgt / 2, 0));
    g.add(at(cyl(r * 1.18, r * 1.18, 0.12, 10, STONE), 0, hgt + 0.06, 0));
    for (let i = 0; i < 6; i += 1) g.add(at(box(0.11, 0.14, 0.11, STONE), Math.cos(i * 1.047) * r * 1.05, hgt + 0.19, Math.sin(i * 1.047) * r * 1.05));
    if (roofColor) g.add(at(cyl(0, r * 1.05, r * 1.7, 10, roofColor), 0, hgt + 0.12 + r * 0.85, 0));
    g.position.set(x, stoneTop, z);
    scene.add(g);
    return g;
  }
  for (let row = 1; row < ROWS - 1; row += 1) {
    const p = cell(WALL_COL, row);
    const tm = row !== GATE_ROW ? inst('wall-tower') : null;
    if (tm) { tm.position.set(p.x, stoneTop, p.z); scene.add(tm); }
    else if (row !== GATE_ROW) tower(p.x, p.z, 0.27, 0.95, null);
    if (row < ROWS - 2) {
      const q = cell(WALL_COL, row + 1);
      const len = p.distanceTo(q);
      const seg = new THREE.Group();
      const sm = inst('wall-segment');
      if (sm) { sm.scale.z = len; seg.add(sm); }
      else {
        seg.add(at(box(0.3, 0.66, len, STONE), 0, 0.33, 0));
        seg.add(at(box(0.4, 0.06, len, STONE_DARK), 0, 0.69, 0));
        for (let i = 0; i < 5; i += 1) seg.add(at(box(0.09, 0.12, 0.16, STONE), -0.15, 0.78, (i - 2) * (len / 5.4)));
      }
      seg.position.set((p.x + q.x) / 2, stoneTop, (p.z + q.z) / 2);
      seg.lookAt(q.x, stoneTop, q.z);
      scene.add(seg);
    }
  }
  const gate = cell(WALL_COL, GATE_ROW);
  const gm = inst('gatehouse');
  if (gm) { gm.position.set(gate.x, stoneTop, gate.z); scene.add(gm); }
  else {
  for (const dz of [-0.62, 0.62]) tower(gate.x, gate.z + dz, 0.36, 1.7, 0x2f6fb5);
    scene.add(at(box(0.62, 0.5, 1.0, STONE_DARK), gate.x, stoneTop + 1.25, gate.z));
    scene.add(at(box(0.7, 0.08, 1.1, STONE), gate.x, stoneTop + 1.54, gate.z));
    for (let i = -2; i <= 2; i += 1) scene.add(at(box(0.12, 0.14, 0.12, STONE), gate.x - 0.3, stoneTop + 1.65, gate.z + i * 0.22));
    scene.add(at(box(0.16, 0.9, 0.84, 0x5b4025), gate.x, stoneTop + 0.5, gate.z)); // the doors
    for (const dz of [-0.2, 0.2]) scene.add(at(box(0.18, 0.86, 0.03, 0x3d2a17), gate.x, stoneTop + 0.5, gate.z + dz));
    for (const dz of [-0.62, 0.62]) {
      scene.add(at(cyl(0.012, 0.012, 0.6, 5, 0x3d2a17), gate.x, stoneTop + 2.75, gate.z + dz));
      scene.add(at(box(0.3, 0.2, 0.02, 0xf2c96b), gate.x + 0.16, stoneTop + 2.92, gate.z + dz));
    }
  }
  const torches = [];
  for (const dz of [-1.0, 1.0]) for (const dx of [-0.44, 0.44]) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 5), new THREE.MeshBasicMaterial({ color: 0xffb02e }));
    if (!gm) scene.add(at(cyl(0.02, 0.02, 0.5, 5, 0x3d2a17), gate.x + dx, stoneTop + 0.25, gate.z + dz));
    scene.add(at(flame, gate.x + dx, stoneTop + 0.64, gate.z + dz));
    torches.push(flame);
  }
  const gateGlow = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.0, 0.9), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
  scene.add(at(gateGlow, gate.x, stoneTop + 0.5, gate.z));

  // A road runs from the edge of the map to the gatehouse; level roads continue to each district.
  function road(from, to, parent) {
    const len = from.distanceTo(to);
    const seg = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, len), m(0xcbb485));
    seg.position.set((from.x + to.x) / 2, GROUND - 0.005, (from.z + to.z) / 2);
    seg.lookAt(to.x, GROUND - 0.005, to.z);
    seg.receiveShadow = true;
    parent.add(seg);
  }
  road(cell(0, GATE_ROW), cell(WALL_COL, GATE_ROW), scene);

  // ----- per-level things -----
  let level = new THREE.Group();
  scene.add(level);
  let districts = {};
  let rivalCity = null;
  const unitMeshes = new Map();
  const labels = new Map();
  const tweens = [];
  const floaters = [];

  function label(key, cls) {
    let node = labels.get(key);
    if (!node) {
      node = document.createElement('div');
      labelLayer.append(node);
      labels.set(key, node);
    }
    node.className = `lbl ${cls}`;
    return node;
  }
  function clearLevel() {
    scene.remove(level);
    level = new THREE.Group();
    scene.add(level);
    for (const m of unitMeshes.values()) scene.remove(m.group);
    unitMeshes.clear();
    for (const n of labels.values()) n.remove();
    labels.clear();
    tweens.length = 0;
    districts = {};
  }

  function load({ hosts, leftName, rightName, rivalName }) {
    clearLevel();
    const cells = DISTRICT_CELLS[Math.min(6, Math.max(1, hosts.length))];
    hosts.forEach((h, i) => {
      const [col, row] = cells[i % cells.length];
      const p = cell(col, row);
      const d = makeDistrict(h.name, h.hostile, i);
      d.scale.setScalar(1.35);
      d.position.set(p.x, landTop(col, row), p.z);
      level.add(d);
      districts[h.address] = { group: d, pos: new THREE.Vector3(p.x, landTop(col, row), p.z), name: h.name };
      road(cell(WALL_COL, GATE_ROW), p, level);
      label(`d:${h.address}`, `lbl-district${h.hostile ? ' hostile' : ''}`).textContent = h.name;
    });
    const rp = cell(2, 1);
    rivalCity = makeDistrict(MODELS['district-rival'] ? 'RIVAL' : 'JUMP', false, 1);
    rivalCity.scale.setScalar(0.8);
    rivalCity.position.set(rp.x, landTop(2, 1), rp.z);
    level.add(rivalCity);
    label('rival', 'lbl-rival').textContent = rivalName;
    label('zone-left', 'lbl-zone').textContent = leftName;
    label('zone-right', 'lbl-zone').textContent = rightName;
    label('gatehouse', 'lbl-gate').textContent = 'YOUR GATEHOUSE';
  }

  const laneRow = (kind, lane) => LANE_ROWS[kind][lane % LANE_ROWS[kind].length];
  function ends(u) {
    const outFront = cell(WALL_COL - 1, GATE_ROW);
    const inFront = cell(WALL_COL + 1, GATE_ROW);
    const edge = cell(1, laneRow(u.kind, u.lane));
    const host = districts[u.host] || Object.values(districts)[0];
    return u.outbound
      ? { start: host.pos.clone(), front: inFront, goal: edge }
      : { start: edge, front: outFront, goal: host.pos.clone() };
  }
  function restPos(u, travel) {
    const e = ends(u);
    const p = e.start.clone().lerp(e.front, Math.min(u.step, travel - 1) / travel);
    p.y = GROUND;
    return p;
  }
  function tween(obj, to, dur, opts = {}) {
    return new Promise((resolve) => {
      if (instant) { obj.position.copy(to); if (opts.onDone) opts.onDone(); resolve(); return; }
      tweens.push({ obj, from: obj.position.clone(), to: to.clone(), t: 0, dur, hop: opts.hop || 0, resolve, onDone: opts.onDone });
    });
  }
  // The route of the unit being traced: dots along the road, a cross where it is stopped.
  let pathGroup = new THREE.Group();
  scene.add(pathGroup);
  function drawPath(picked, travel) {
    scene.remove(pathGroup);
    pathGroup = new THREE.Group();
    scene.add(pathGroup);
    if (!picked) return;
    const { u, b } = picked;
    const e = ends(u);
    const gatePos = new THREE.Vector3(gate.x, 0, gate.z);
    const color = b.bad ? 0xd0342c : 0x1f9d55;
    const legs = [[restPos(u, travel), e.front], [e.front, gatePos]];
    if (b.through) legs.push([gatePos, e.goal]);
    for (const [from, to] of legs) {
      const n = Math.max(1, Math.round(from.distanceTo(to) / 0.45));
      for (let i = 1; i <= n; i += 1) {
        const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 10), new THREE.MeshBasicMaterial({ color }));
        dot.position.lerpVectors(from, to, i / n);
        dot.position.y = GROUND + 0.04;
        pathGroup.add(dot);
      }
    }
    if (!b.through) {
      for (const r of [Math.PI / 4, -Math.PI / 4]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.16), new THREE.MeshBasicMaterial({ color }));
        bar.rotation.y = r;
        bar.position.set(e.front.x, GROUND + 0.12, e.front.z);
        pathGroup.add(bar);
      }
    }
  }
  let instant = false;
  const sparks = [];
  const HOME = new THREE.Vector3(-1.3, 18, 14.4);
  let intro = null;
  // Small pieces thrown up when the gatehouse judges a unit.
  function burst(pos, color, n = 14, speed = 2.2) {
    if (instant) return;
    for (let i = 0; i < n; i += 1) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.07), new THREE.MeshBasicMaterial({ color, transparent: true }));
      mesh.position.copy(pos);
      const a = (i / n) * Math.PI * 2;
      scene.add(mesh);
      sparks.push({ mesh, t: 0, life: 0.75, vel: new THREE.Vector3(Math.cos(a) * speed * (0.5 + (i % 3) * 0.3), 2.4 + (i % 4) * 0.5, Math.sin(a) * speed * (0.5 + (i % 3) * 0.3)) });
    }
  }
  function shock(pos, color) {
    if (instant) return;
    const mesh = new THREE.Mesh(new THREE.RingGeometry(0.34, 0.42, 24), new THREE.MeshBasicMaterial({ color, transparent: true, side: THREE.DoubleSide }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(pos.x, GROUND + 0.03, pos.z);
    scene.add(mesh);
    sparks.push({ mesh, t: 0, life: 0.6, ring: true });
  }
  // A ring on the ground in front of the gatehouse: this is where units are judged.
  const judgeRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.8, 6), new THREE.MeshBasicMaterial({ color: 0xf2c96b, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
  judgeRing.rotation.x = -Math.PI / 2;
  judgeRing.rotation.z = Math.PI / 6;
  { const jp = cell(WALL_COL - 1, GATE_ROW); judgeRing.position.set(jp.x, GROUND + 0.02, jp.z); }
  scene.add(judgeRing);

  // Puts every unit where it should be this turn and updates its banner.
  function sync(units, travel, bannerFor) {
    const seen = new Set();
    let picked = null;
    for (const u of units) {
      seen.add(u.id);
      let m = unitMeshes.get(u.id);
      const target = restPos(u, travel);
      if (!m) {
        m = { group: makeUnit(u.kind), unit: u };
        m.group.position.copy(target);
        m.group.scale.setScalar(0.01);
        m.grow = 0;
        scene.add(m.group);
        unitMeshes.set(u.id, m);
      } else if (m.group.position.distanceTo(target) > 0.01) {
        tween(m.group, target, 0.45, { hop: 0.25 });
      }
      m.unit = u;
      const e = ends(u);
      m.group.lookAt(e.front.x, m.group.position.y, e.front.z);
      m.group.rotateY(-Math.PI / 2);
      const b = bannerFor(u);
      const node = label(`u:${u.id}`, `lbl-unit kind-${u.kind}${b.bad ? ' bad' : ' ok'}${b.selected ? ' selected' : ''}${!b.bad && !b.selected ? ' compact' : ''}`);
      if (b.selected) picked = { u, b };
      node.innerHTML = '';
      const top = document.createElement('b'); top.textContent = `${b.shape} ${b.title}`; node.append(top);
      if (b.who) { const w = document.createElement('i'); w.textContent = b.who; node.append(w); }
      const f = document.createElement('span'); f.textContent = `${b.bad ? '✕' : '✓'} ${b.forecast}`; node.append(f);
      node.dataset.unit = String(u.id);
    }
    drawPath(picked, travel);
    for (const [id, m] of unitMeshes) {
      if (!seen.has(id) && !m.leaving) { scene.remove(m.group); unitMeshes.delete(id); const n = labels.get(`u:${id}`); if (n) { n.remove(); labels.delete(`u:${id}`); } }
    }
  }

  function float(text, pos, tone) {
    const node = document.createElement('div');
    node.className = `lbl lbl-float ${tone}`;
    node.textContent = text;
    labelLayer.append(node);
    floaters.push({ node, pos: pos.clone(), t: 0 });
  }
  function burn(address, seconds) {
    const d = districts[address];
    if (!d) return;
    d.group.userData.fire.visible = true;
    d.group.userData.fireUntil = clock.elapsedTime + seconds;
  }
  function setRivalDown(down) { if (rivalCity) rivalCity.userData.fire.visible = down; if (rivalCity) rivalCity.userData.fireUntil = down ? Infinity : 0; }

  // Plays one unit's moment at the gatehouse. `onJudge` fires as the gate decides.
  async function playEvent(e, onJudge) {
    const m = unitMeshes.get(e.unit.id);
    if (!m) { onJudge(); return; }
    m.leaving = true;
    const n = labels.get(`u:${e.unit.id}`);
    if (n) { n.remove(); labels.delete(`u:${e.unit.id}`); }
    const en = ends(m.unit);
    const gatePos = new THREE.Vector3(gate.x + (m.unit.outbound ? 0.6 : -0.6), GROUND, gate.z);
    await tween(m.group, gatePos, 0.4, { hop: 0.2 });
    onJudge();
    const through = e.verdict.verdict !== 'denied-by-rule' && e.verdict.verdict !== 'denied-implicit';
    gateGlow.material.color.set(through ? 0x8ff0a0 : 0xff6b5e);
    gateGlow.material.opacity = 0.85;
    const above = gatePos.clone(); above.y = 1.6;
    if (!through) {
      burst(gatePos.clone().setY(0.9), e.outcome === 'turned-away' ? 0xd0453c : 0xb7b2a6); shock(gatePos, 0xd0453c);
      float(e.outcome === 'turned-away' ? 'TURNED AWAY' : 'BLOCKED', above, e.outcome === 'turned-away' ? 'bad' : 'good');
      const back = gatePos.clone().lerp(en.start, 0.25); back.y = -0.6;
      await tween(m.group, back, 0.45, { hop: 0.5 });
    } else if (e.verdict.verdict === 'stopped-by-control') {
      const mid = gatePos.clone().lerp(en.goal, 0.3); mid.y = GROUND;
      await tween(m.group, mid, 0.35);
      shock(mid, 0x3fd0e0); burst(mid.clone().setY(0.8), 0x3fd0e0, 18, 1.6);
      float(e.verdict.control === 'dnsFiltering' ? 'FILTERED' : 'SCANNED', mid.clone().setY(1.4), 'good');
      const down = mid.clone(); down.y = -0.6;
      await tween(m.group, down, 0.3);
    } else {
      const goal = en.goal.clone(); goal.y = GROUND;
      await tween(m.group, goal, 0.6, { hop: 0.3 });
      const top = goal.clone().setY(1.7);
      if (e.outcome === 'breach') { burn(m.unit.host, 3.5); burst(goal.clone().setY(0.9), 0xff7a1f, 22, 2.8); shock(goal, 0xff5a1f); float('BREACH', top, 'bad'); }
      else if (e.outcome === 'exposed') float('NOT NEEDED', top, 'warn');
      else { burst(goal.clone().setY(0.9), 0xf2c96b, 10, 1.3); float(`+${e.points}`, top, 'good'); }
    }
    scene.remove(m.group);
    unitMeshes.delete(e.unit.id);
  }

  // ----- frame loop -----
  const clock = new THREE.Clock();
  const v = new THREE.Vector3();
  function place(node, pos, dy = 0) {
    v.copy(pos); v.y += dy; v.project(camera);
    const w = container.clientWidth;
    const h = container.clientHeight;
    const hidden = v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.1 || v.y > 1.1;
    node.style.display = hidden ? 'none' : '';
    node.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
  }
  function frame() {
    const dt = Math.min(0.05, clock.getDelta());
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / Math.max(1, h);
      // Narrow screens need the camera further back to keep the whole map in view.
      camera.fov = camera.aspect < 1 ? 62 : camera.aspect < 1.5 ? 46 : 38;
      camera.updateProjectionMatrix();
    }
    for (let i = tweens.length - 1; i >= 0; i -= 1) {
      const t = tweens[i];
      t.t += dt / t.dur;
      const k = Math.min(1, t.t);
      const e = k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2;
      t.obj.position.lerpVectors(t.from, t.to, e);
      t.obj.position.y += Math.sin(k * Math.PI) * t.hop;
      if (k >= 1) { tweens.splice(i, 1); if (t.onDone) t.onDone(); t.resolve(); }
    }
    for (const m of unitMeshes.values()) {
      if (m.grow !== undefined && m.grow < 1) { m.grow = Math.min(1, m.grow + dt * 4); m.group.scale.setScalar(Math.max(0.01, m.grow * 1.5)); }
    }
    const time = clock.elapsedTime;
    if (!instant) {
      for (const [id, um] of unitMeshes) {
        const body = um.group.userData.body;
        const k = um.unit.kind;
        if (k === 'wanted') { body.position.y = Math.abs(Math.sin(time * 5 + id)) * 0.025; body.rotation.z = Math.sin(time * 5 + id) * 0.02; }
        else if (k === 'attack') { body.rotation.y = Math.sin(time * 2.2 + id) * 0.25; body.position.y = Math.abs(Math.sin(time * 3 + id)) * 0.03; }
        else { body.position.y = 0.06 + Math.sin(time * 2 + id) * 0.05; body.rotation.y = time * 0.6 + id; }
      }
    }
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const sp = sparks[i];
      sp.t += dt;
      if (sp.ring) { const k = sp.t / sp.life; sp.mesh.scale.setScalar(0.3 + k * 2.4); sp.mesh.material.opacity = 0.9 * (1 - k); }
      else { sp.vel.y -= 5.5 * dt; sp.mesh.position.addScaledVector(sp.vel, dt); sp.mesh.rotation.x += dt * 6; sp.mesh.material.opacity = 1 - sp.t / sp.life; }
      if (sp.t >= sp.life) { scene.remove(sp.mesh); sparks.splice(i, 1); }
    }
    judgeRing.material.opacity = 0.35 + Math.sin(time * 2.5) * 0.15;
    if (intro) {
      intro.t = Math.min(1, intro.t + dt / 1.8);
      const k = 1 - (1 - intro.t) ** 3;
      camera.position.lerpVectors(intro.from, HOME, k);
      if (intro.t >= 1) intro = null;
    }
    for (const d of [...Object.values(districts).map((x) => x.group), rivalCity].filter(Boolean)) {
      const fire = d.userData.fire;
      if (fire.visible) {
        if (time > (d.userData.fireUntil || 0)) fire.visible = false;
        fire.children.forEach((f, i) => { f.scale.y = 0.7 + Math.abs(Math.sin(time * 9 + i * 1.7)) * 0.9; });
      }
    }
    gateGlow.material.opacity = Math.max(0, gateGlow.material.opacity - dt * 1.6);
    for (const wt of water) wt.tile.position.y = wt.base + Math.sin(time * 1.3 + wt.phase) * 0.018;
    torches.forEach((f, i) => { f.scale.y = 0.8 + Math.abs(Math.sin(time * 11 + i * 2.3)) * 0.7; });
    controls.update();
    renderer.render(scene, camera);

    // Unit banners are pushed apart on screen so every one can be read.
    const banners = [];
    for (const [key, node] of labels) {
      if (!key.startsWith('u:')) continue;
      const m = unitMeshes.get(Number(key.slice(2)));
      if (!m) continue;
      v.copy(m.group.position); v.y += 1.0; v.project(camera);
      if (v.z > 1) { node.style.display = 'none'; continue; }
      node.style.display = '';
      const bw = node.offsetWidth;
      const bh = node.offsetHeight;
      banners.push({ node, w: bw, h: bh, x: ((v.x + 1) / 2) * w - bw / 2, y: ((1 - v.y) / 2) * h - bh - 8 });
    }
    banners.sort((a, b) => b.y - a.y);
    const placed = [];
    for (const b of banners) {
      b.x = Math.max(4, Math.min(w - b.w - 4, b.x));
      for (let tries = 0; tries < 12; tries += 1) {
        const hit = placed.find((o) => b.x < o.x + o.w + 4 && b.x + b.w + 4 > o.x && b.y < o.y + o.h + 4 && b.y + b.h + 4 > o.y);
        if (!hit) break;
        b.y = hit.y - b.h - 5;
      }
      placed.push(b);
      b.node.style.transform = `translate(${Math.round(b.x)}px, ${Math.round(Math.max(62, b.y))}px)`;
    }
    for (const [key, node] of labels) {
      if (key.startsWith('u:')) continue;
      else if (key.startsWith('d:')) place(node, districts[key.slice(2)].pos, 1.75);
      else if (key === 'rival' && rivalCity) place(node, rivalCity.position, 1.5);
      else if (key === 'zone-left') place(node, cell(3, ROWS - 2), 0.4);
      else if (key === 'zone-right') place(node, cell(11, ROWS - 2), 0.4);
      else if (key === 'gatehouse') place(node, gate, 2.3);
    }
    for (let i = floaters.length - 1; i >= 0; i -= 1) {
      const f = floaters[i];
      f.t += dt;
      place(f.node, f.pos, f.t * 0.9);
      f.node.style.opacity = String(Math.max(0, 1 - f.t / 1.3));
      if (f.t > 1.3) { f.node.remove(); floaters.splice(i, 1); }
    }
    window.requestAnimationFrame(frame);
  }
  window.requestAnimationFrame(frame);

  return {
    load, sync, playEvent, setRivalDown,
    setInstant(on) { instant = on; },
    resetView() { controls.target.set(-1.3, 0, 0.5); camera.position.copy(HOME); controls.update(); },
    // A slow glide in from high above when a level begins.
    flyIn() { if (instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; controls.target.set(-1.3, 0, 0.5); intro = { t: 0, from: new THREE.Vector3(-9, 27, 21) }; },
  };
}
