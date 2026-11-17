// Strategy edition: the 3D hex board. It draws what main.js tells it and decides nothing.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
  hills: { color: 0xa89f6e, h: 0.5 },
  desert: { color: 0xdfcd93, h: 0.28 },
  stone: { color: 0xb7b2a6, h: 0.36 },
};
const KIND_COLOR = { wanted: 0x2f9e5b, attack: 0xc8322f, unneeded: 0x7d6bb5 };

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

function makeUnit(kind) {
  const g = new THREE.Group();
  if (kind === 'wanted') {
    g.add(at(box(0.62, 0.16, 0.36, 0x9a6b3c), 0, 0.2, 0));
    const cover = cyl(0.2, 0.2, 0.56, 10, 0xf3ecd8); cover.rotation.z = Math.PI / 2; g.add(at(cover, 0, 0.34, 0));
    for (const [x, z] of [[-0.2, 0.2], [0.2, 0.2], [-0.2, -0.2], [0.2, -0.2]]) { const w = cyl(0.11, 0.11, 0.05, 10, 0x4a3320); w.rotation.x = Math.PI / 2; g.add(at(w, x, 0.11, z)); }
    g.add(at(cyl(0.015, 0.015, 0.5, 5, 0x4a3320), 0.26, 0.6, 0));
    g.add(at(box(0.22, 0.14, 0.02, KIND_COLOR.wanted), 0.38, 0.78, 0));
  } else if (kind === 'attack') {
    g.add(at(cyl(0.26, 0.3, 0.2, 6, 0x3a2b2b), 0, 0.1, 0));
    g.add(at(cyl(0.0, 0.24, 0.5, 6, KIND_COLOR.attack), 0, 0.45, 0));
    for (const a of [0, 2.1, 4.2]) { const s = cyl(0, 0.06, 0.3, 4, 0x2a1f1f); s.rotation.z = Math.PI / 2.6; s.rotation.y = a; g.add(at(s, Math.cos(a) * 0.24, 0.32, -Math.sin(a) * 0.24)); }
    g.add(at(cyl(0.015, 0.015, 0.5, 5, 0x2a1f1f), -0.22, 0.6, 0));
    g.add(at(box(0.22, 0.14, 0.02, 0x1d1414), -0.34, 0.78, 0));
  } else {
    g.add(at(cyl(0.2, 0.24, 0.12, 12, 0x5d5080), 0, 0.06, 0));
    g.add(at(cyl(0.1, 0.18, 0.3, 12, KIND_COLOR.unneeded), 0, 0.27, 0));
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), mat(0xa99ad6)); head.castShadow = true; g.add(at(head, 0, 0.52, 0));
  }
  return g;
}

function makeDistrict(hostile, seed) {
  const g = new THREE.Group();
  const wallColor = hostile ? 0x5a4a6e : 0xe9e2d0;
  const roof = hostile ? 0x33284a : [0xc0563a, 0x3f7fb5, 0x4f9a6a][seed % 3];
  g.add(at(cyl(0.92, 0.96, 0.08, 6, hostile ? 0x6f6680 : 0xcfc7b3), 0, 0.04, 0));
  const spots = [[0, 0, 0.5, 0.62], [-0.42, 0.22, 0.3, 0.3], [0.4, -0.2, 0.32, 0.36], [0.1, 0.46, 0.26, 0.24], [-0.3, -0.4, 0.28, 0.28]];
  spots.forEach(([x, z, w, h]) => {
    g.add(at(box(w, h, w, wallColor), x, 0.08 + h / 2, z));
    const r = cyl(0, w * 0.78, w * 0.6, 4, roof); r.rotation.y = Math.PI / 4; g.add(at(r, x, 0.08 + h + w * 0.3, z));
  });
  g.add(at(cyl(0.015, 0.015, 0.5, 5, 0x4a3320), 0, 1.3, 0));
  g.add(at(box(0.26, 0.16, 0.02, hostile ? 0x7a2a8a : 0x2f6fb5), 0.14, 1.45, 0));
  const fire = new THREE.Group();
  for (let i = 0; i < 6; i += 1) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 5), new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb02e : 0xff5a1f }));
    fire.add(at(f, Math.cos(i * 1.05) * 0.38, 0.75, Math.sin(i * 1.05) * 0.38));
  }
  fire.visible = false;
  g.add(fire);
  g.userData.fire = fire;
  return g;
}

export function createBoard(container, labelLayer) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.prepend(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PAPER);
  scene.fog = new THREE.Fog(PAPER, 34, 70);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(-0.6, 17, 13.5);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-0.6, 0, 0.4);
  controls.enableDamping = true;
  controls.minDistance = 9;
  controls.maxDistance = 36;
  controls.minPolarAngle = 0.25;
  controls.maxPolarAngle = 1.2;
  controls.screenSpacePanning = false;
  controls.update();

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8a882, 0.95));
  const sun = new THREE.DirectionalLight(0xfff2d6, 1.25);
  sun.position.set(-10, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 14, bottom: -14, near: 1, far: 60 });
  scene.add(sun);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: PAPER }));
  table.rotation.x = -Math.PI / 2; table.position.y = -0.02; table.receiveShadow = true;
  scene.add(table);

  // ----- static map -----
  const tileGeo = {};
  const tileMat = {};
  for (const [name, t] of Object.entries(TERRAIN)) { tileGeo[name] = new THREE.CylinderGeometry(S * 0.97, S * 0.97, t.h, 6); tileMat[name] = mat(t.color); }
  const topOf = (col, row) => TERRAIN[terrainAt(col, row)].h;
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const name = terrainAt(col, row);
      const p = cell(col, row);
      const tile = new THREE.Mesh(tileGeo[name], tileMat[name]);
      tile.position.set(p.x, TERRAIN[name].h / 2, p.z);
      tile.receiveShadow = true;
      scene.add(tile);
      const h = hash(col, row);
      if (name === 'forest') {
        for (let i = 0; i < 3; i += 1) {
          const a = h + i * 2.1;
          scene.add(at(cyl(0, 0.2, 0.5, 6, 0x356b39), p.x + Math.cos(a) * 0.4, TERRAIN.forest.h + 0.3, p.z + Math.sin(a) * 0.4));
          scene.add(at(cyl(0.04, 0.04, 0.12, 5, 0x5b4025), p.x + Math.cos(a) * 0.4, TERRAIN.forest.h + 0.05, p.z + Math.sin(a) * 0.4));
        }
      } else if (name === 'hills') {
        const bump = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42), mat(0x958b5c)); bump.castShadow = true;
        scene.add(at(bump, p.x + 0.1, TERRAIN.hills.h, p.z));
      } else if (name === 'farm') {
        for (let i = -1; i <= 1; i += 1) scene.add(at(box(1.0, 0.03, 0.12, 0xb89a3a), p.x, TERRAIN.farm.h + 0.015, p.z + i * 0.3));
      }
    }
  }
  // The wall and its gatehouse.
  const stoneTop = TERRAIN.stone.h;
  for (let row = 1; row < ROWS - 1; row += 1) {
    const p = cell(WALL_COL, row);
    if (row !== GATE_ROW) scene.add(at(cyl(0.3, 0.34, 0.9, 8, 0x8d877a), p.x, stoneTop + 0.45, p.z));
    if (row < ROWS - 2) {
      const q = cell(WALL_COL, row + 1);
      const seg = box(0.26, 0.62, p.distanceTo(q), 0x9c968a);
      seg.position.set((p.x + q.x) / 2, stoneTop + 0.31, (p.z + q.z) / 2);
      seg.lookAt(q.x, stoneTop + 0.31, q.z);
      scene.add(seg);
    }
  }
  const gate = cell(WALL_COL, GATE_ROW);
  for (const dz of [-0.55, 0.55]) scene.add(at(cyl(0.3, 0.36, 1.5, 8, 0x7c766a), gate.x, stoneTop + 0.75, gate.z + dz));
  for (const dz of [-0.55, 0.55]) { const r = cyl(0, 0.4, 0.45, 8, 0x2f6fb5); scene.add(at(r, gate.x, stoneTop + 1.72, gate.z + dz)); }
  scene.add(at(box(0.4, 0.3, 1.1, 0x7c766a), gate.x, stoneTop + 1.2, gate.z));
  const gateGlow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.9, 0.7), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0 }));
  scene.add(at(gateGlow, gate.x, stoneTop + 0.5, gate.z));

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
      const d = makeDistrict(h.hostile, i);
      d.scale.setScalar(1.35);
      d.position.set(p.x, topOf(col, row), p.z);
      level.add(d);
      districts[h.address] = { group: d, pos: new THREE.Vector3(p.x, topOf(col, row), p.z), name: h.name };
      label(`d:${h.address}`, `lbl-district${h.hostile ? ' hostile' : ''}`).textContent = h.name;
    });
    const rp = cell(2, 1);
    rivalCity = makeDistrict(false, 1);
    rivalCity.scale.setScalar(0.8);
    rivalCity.position.set(rp.x, topOf(2, 1), rp.z);
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
    p.y = 0.34;
    return p;
  }
  function tween(obj, to, dur, opts = {}) {
    return new Promise((resolve) => {
      if (instant) { obj.position.copy(to); if (opts.onDone) opts.onDone(); resolve(); return; }
      tweens.push({ obj, from: obj.position.clone(), to: to.clone(), t: 0, dur, hop: opts.hop || 0, resolve, onDone: opts.onDone });
    });
  }
  let instant = false;

  // Puts every unit where it should be this turn and updates its banner.
  function sync(units, travel, bannerFor) {
    const seen = new Set();
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
      const node = label(`u:${u.id}`, `lbl-unit kind-${u.kind}${b.bad ? ' bad' : ' ok'}${b.selected ? ' selected' : ''}`);
      node.innerHTML = '';
      const top = document.createElement('b'); top.textContent = `${b.shape} ${b.title}`; node.append(top);
      if (b.who) { const w = document.createElement('i'); w.textContent = b.who; node.append(w); }
      const f = document.createElement('span'); f.textContent = `${b.bad ? '✕' : '✓'} ${b.forecast}`; node.append(f);
      node.dataset.unit = String(u.id);
    }
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
    const gatePos = new THREE.Vector3(gate.x + (m.unit.outbound ? 0.5 : -0.5), 0.36, gate.z);
    await tween(m.group, gatePos, 0.4, { hop: 0.2 });
    onJudge();
    const through = e.verdict.verdict !== 'denied-by-rule' && e.verdict.verdict !== 'denied-implicit';
    gateGlow.material.color.set(through ? 0x8ff0a0 : 0xff6b5e);
    gateGlow.material.opacity = 0.85;
    const above = gatePos.clone(); above.y = 1.6;
    if (!through) {
      float(e.outcome === 'turned-away' ? 'TURNED AWAY' : 'BLOCKED', above, e.outcome === 'turned-away' ? 'bad' : 'good');
      const back = gatePos.clone().lerp(en.start, 0.25); back.y = -0.6;
      await tween(m.group, back, 0.45, { hop: 0.5 });
    } else if (e.verdict.verdict === 'stopped-by-control') {
      const mid = gatePos.clone().lerp(en.goal, 0.3); mid.y = 0.36;
      await tween(m.group, mid, 0.35);
      float(e.verdict.control === 'dnsFiltering' ? 'FILTERED' : 'SCANNED', mid.clone().setY(1.4), 'good');
      const down = mid.clone(); down.y = -0.6;
      await tween(m.group, down, 0.3);
    } else {
      const goal = en.goal.clone(); goal.y = 0.4;
      await tween(m.group, goal, 0.6, { hop: 0.3 });
      const top = goal.clone().setY(1.7);
      if (e.outcome === 'breach') { burn(m.unit.host, 3.5); float('BREACH', top, 'bad'); }
      else if (e.outcome === 'exposed') float('NOT NEEDED', top, 'warn');
      else float(`+${e.points}`, top, 'good');
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
    for (const d of [...Object.values(districts).map((x) => x.group), rivalCity].filter(Boolean)) {
      const fire = d.userData.fire;
      if (fire.visible) {
        if (time > (d.userData.fireUntil || 0)) fire.visible = false;
        fire.children.forEach((f, i) => { f.scale.y = 0.7 + Math.abs(Math.sin(time * 9 + i * 1.7)) * 0.9; });
      }
    }
    gateGlow.material.opacity = Math.max(0, gateGlow.material.opacity - dt * 1.6);
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
    resetView() { camera.position.set(-0.6, 17, 13.5); controls.target.set(-0.6, 0, 0.4); controls.update(); },
  };
}
