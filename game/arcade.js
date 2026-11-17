// Firewall Security Faceoff, arcade edition.
//
// A real-time tower defense. Traffic never stops: customers, attackers, and
// stray packets fly at your wall while you drag gates on and off it. Each
// packet is judged by the rule engine against the wall as it stands at the
// moment the packet arrives. Nothing in this file decides a verdict.

import { evaluateFlow, evaluateSubmission } from '../engine/rules.js';
import { validateContent } from '../engine/content.js';
import { explainVerdict } from '../engine/feedback.js';
import {
  TUNING, CONTROL_SHORT, CONTROL_KEYS, arcadeOf, buildSchedule, insideHosts as hostsInside, isOutbound,
  nameOf, flowLabel, flowText, ruleParts, ruleText, leakHint, leakFix, starsFor, candidatesFor, CONTROL_HELP,
} from './logic.js';

const $ = (sel) => document.querySelector(sel);
const game = $('#game');
const stage = $('#stage');
const canvas = $('#field');
const ctx = canvas.getContext('2d');
const wallEl = $('#wall');
const trayEl = $('#tray');
const modal = $('#modal');
const bannerEl = $('#banner');
const coachEl = $('#coach');
const liveEl = $('#live');
const logEl = $('#log');

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const { T_APPROACH, T_CHECK, T_CROSS, T_TRAVEL, T_FADE, WARMUP, ORDER_GRACE, MAX_HP, MAX_PATIENCE, RIVAL_HP } = TUNING;

const COLOR = {
  bg: '#0b1020', grid: '#141b33', ground: '#1d2748', text: '#e8ecf4', dim: '#8a96b3',
  you: '#4fd1dc', rival: '#ff7fb1', good: '#5ee08a', bad: '#ff5d6c', warn: '#ffd166',
  brick: '#3b4670', mortar: '#232b4a', pit: '#101a3a', base: '#c9d3e6', stray: '#b9a6ff',
};
const FONT = 'bold 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_BIG = 'bold 16px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_HUGE = 'bold 22px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const SPRITES = {
  attacker: ['.XXXXX.', 'XXXXXXX', 'X.XXX.X', 'XXXXXXX', '.XX.XX.', '.X.X.X.'],
  customer: ['..XXX..', '.XXXXX.', 'XX.X.XX', 'XXXXXXX', 'X.XXX.X', '.XXXXX.'],
  stray: ['.XXXXX.', 'XXXXXXX', 'XX.X.XX', 'XXXXXXX', 'XXXXXXX', 'X.X.X.X'],
  spark: ['X.X.X', '.XXX.', 'XXXXX', '.XXX.', 'X.X.X'],
  heart: ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
  lock: ['.XXX.', 'X...X', 'XXXXX', 'XX.XX', 'XXXXX'],
};

const state = {
  phase: 'title', // title | play | over
  paused: false,
  levels: [], levelIndex: 0, progress: { stars: {}, best: {} }, cfg: null,
  challenge: null, level: null,
  wall: [],
  schedule: [], next: 0, t: 0, runLength: 1, waveStarts: [], wave: -1,
  packets: [], rival: { hp: RIVAL_HP, packets: [], downAt: null },
  hp: MAX_HP, patience: MAX_PATIENCE, score: 0, combo: 0, bestCombo: 0, streak: 0,
  stats: {}, leaked: new Set(), exposed: new Set(), blockedAfterWarmup: 0,
  effects: [], shake: 0, hover: null, sound: true, best: 0, coachUntil: 0, lastHit: null,
  orders: [], orderTime: {}, tryThese: new Set(), missionH: 40,
};

// ---------- sound ----------
let audio = null;
function beep(freq, duration, type = 'square', gain = 0.035) {
  if (!state.sound) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type; osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    osc.connect(amp).connect(audio.destination);
    osc.start(); osc.stop(audio.currentTime + duration);
  } catch (err) { /* sound is optional */ }
}
const SFX = {
  deny: () => beep(190, 0.12, 'sawtooth', 0.03),
  pit: () => beep(230, 0.1, 'triangle', 0.03),
  deliver: () => beep(520 + Math.min(state.combo, 16) * 40, 0.09, 'triangle', 0.04),
  stop: () => beep(300 + Math.min(state.combo, 16) * 30, 0.08, 'square', 0.03),
  hit: () => { beep(110, 0.3, 'sawtooth', 0.07); setTimeout(() => beep(70, 0.3, 'sawtooth', 0.06), 120); },
  angry: () => beep(160, 0.22, 'square', 0.04),
  expose: () => beep(330, 0.14, 'square', 0.03),
  place: () => beep(440, 0.05, 'square', 0.025),
  wave: () => { beep(220, 0.12, 'square', 0.05); setTimeout(() => beep(220, 0.12, 'square', 0.05), 200); setTimeout(() => beep(330, 0.25, 'square', 0.05), 400); },
  win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => beep(f, 0.16, 'square', 0.045), i * 110)),
  lose: () => [330, 262, 196, 131].forEach((f, i) => setTimeout(() => beep(f, 0.22, 'sawtooth', 0.05), i * 160)),
};

// ---------- helpers ----------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}
function announce(text) { liveEl.textContent = ''; setTimeout(() => { liveEl.textContent = text; }, 30); }
const clockText = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function logLine(text, kind = '') {
  logEl.append(el('li', { class: kind }, `${clockText(state.t)}  ${text}`));
  while (logEl.children.length > 200) logEl.firstChild.remove();
}
const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
const ease = (t) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 2;
const label = (flow) => flowText(state.challenge, flow);
function coach(text, seconds = 5) {
  coachEl.textContent = text;
  coachEl.classList.add('show');
  state.coachUntil = state.t + seconds;
}

// ---------- tiles ----------
function tileEl(ruleId, inWall, index) {
  const c = state.challenge;
  const rule = c.rules[ruleId];
  const parts = ruleParts(c, rule);
  const st = state.stats[ruleId] || {};
  const entry = inWall ? state.wall[index] : null;
  const offered = Object.keys(rule.controls || {});
  const where = inWall ? `Gate ${index + 1} of ${state.wall.length}.` : 'Spare gate.';
  const keys = offered.map((n) => `${CONTROL_KEYS[n].toUpperCase()} switches ${CONTROL_SHORT[n]}.`).join(' ');
  const how = inWall ? `Arrow Up or Down moves it. Enter removes it. ${keys}` : 'Enter adds it to the bottom of your wall.';
  const badge = inWall && st.leak ? el('span', { class: 'tile-badge badge-bad' }, `LEAK ×${st.leak}`)
    : inWall && st.block ? el('span', { class: 'tile-badge badge-bad' }, `BLOCKS ${state.cfg.friend} ×${st.block}`)
    : inWall && st.unscanned ? el('span', { class: 'tile-badge badge-warn' }, `SWITCH ON ${(st.need || []).map((n) => CONTROL_SHORT[n]).join(' + ') || 'SCAN'}`)
    : inWall && st.expose ? el('span', { class: 'tile-badge badge-warn' }, 'TOO WIDE')
    : null;
  const tile = el('button', {
    type: 'button', title: rule.label, class: `tile tile-${rule.action}${!inWall && state.tryThese.has(ruleId) ? ' tile-try' : ''}`, dataset: { rule: ruleId },
    'aria-label': `${ruleText(c, rule)}. ${where} ${how}${st.leak ? ` Attackers got through it ${st.leak} times.` : ''}${st.block ? ` It blocked wanted traffic ${st.block} times.` : ''}`,
  },
    inWall ? el('span', { class: 'tile-num' }, String(index + 1)) : null,
    el('span', { class: 'tile-icon' }, rule.action === 'allow' ? '✓' : '✕'),
    parts.who ? el('span', { class: 'tile-who' }, parts.who) : null,
    parts.showKind ? el('span', { class: 'tile-kind' }, parts.kind === 'app' ? 'APP' : 'PORT') : null,
    el('span', { class: 'tile-port' }, parts.what),
    el('span', { class: 'tile-arrow' }, '→'),
    el('span', { class: 'tile-dst' }, parts.where),
    !inWall && state.tryThese.has(ruleId) ? el('span', { class: 'tile-badge badge-try' }, 'TRY') : null,
    badge);
  const chips = offered.length === 0 ? null : el('span', { class: 'chips' }, offered.map((name) => {
    if (!inWall) return el('span', { class: 'chip ghost', title: CONTROL_HELP[name] }, CONTROL_SHORT[name]);
    const on = Boolean(entry.controls[name]);
    const need = !on && (st.need || []).includes(name);
    return el('button', {
      type: 'button', class: `chip ${on ? 'on' : 'off'}${need ? ' chip-need' : ''}`, 'aria-pressed': String(on), dataset: { rule: ruleId, control: name },
      title: CONTROL_HELP[name],
      'aria-label': `${CONTROL_SHORT[name]} on gate ${index + 1}${need ? '. Switch this on to stop the leak' : ''}`,
    }, `${need ? '! ' : ''}${on ? '●' : '○'} ${CONTROL_SHORT[name]} ${on ? 'ON' : 'OFF'}`);
  }));
  return el('li', { class: 'gate' }, tile, chips);
}

function renderTiles(focusRule, focusControl) {
  const c = state.challenge;
  const onWall = new Set(state.wall.map((e) => e.ruleId));
  wallEl.replaceChildren(...state.wall.map((e, i) => tileEl(e.ruleId, true, i)));
  if (state.wall.length === 0) wallEl.append(el('li', { class: 'wall-empty' }, 'DROP GATES HERE'));
  trayEl.replaceChildren(...Object.keys(c.rules).filter((id) => !onWall.has(id)).map((id) => tileEl(id, false, 0)));
  if (focusRule) {
    const target = document.querySelector(focusControl ? `.chip[data-rule="${focusRule}"][data-control="${focusControl}"]` : `.tile[data-rule="${focusRule}"]`);
    if (target) target.focus();
  }
}

const wallIndex = (ruleId) => state.wall.findIndex((e) => e.ruleId === ruleId);
const canEdit = () => state.phase === 'play';

function addToWall(ruleId, at = state.wall.length) {
  if (!canEdit() || wallIndex(ruleId) !== -1) return;
  const rule = state.challenge.rules[ruleId];
  state.wall.splice(at, 0, { ruleId, controls: { ...(rule.controls || {}) } });
  state.tryThese = new Set();
  delete state.stats[ruleId];
  SFX.place();
  renderTiles(ruleId);
  announce(`${ruleText(state.challenge, rule)} placed as gate ${wallIndex(ruleId) + 1} of ${state.wall.length}.`);
}
function removeFromWall(ruleId) {
  const i = wallIndex(ruleId);
  if (!canEdit() || i === -1) return;
  state.wall.splice(i, 1);
  delete state.stats[ruleId];
  SFX.place();
  renderTiles(ruleId);
  announce(`Gate removed. ${state.wall.length} left.`);
}
function moveOnWall(ruleId, to) {
  const from = wallIndex(ruleId);
  if (!canEdit() || from === -1) return;
  const target = Math.max(0, Math.min(state.wall.length - 1, to));
  if (target === from) return;
  const [entry] = state.wall.splice(from, 1);
  state.wall.splice(target, 0, entry);
  SFX.place();
  renderTiles(ruleId);
  announce(`Now gate ${target + 1} of ${state.wall.length}.`);
}

function toggleControl(ruleId, name) {
  const i = wallIndex(ruleId);
  if (!canEdit() || i === -1) return;
  const entry = state.wall[i];
  if (!(name in (state.challenge.rules[ruleId].controls || {}))) return;
  entry.controls[name] = !entry.controls[name];
  const left = ((state.stats[ruleId] || {}).need || []).filter((n) => !entry.controls[n]);
  if (left.length > 0) state.stats[ruleId] = { ...state.stats[ruleId], need: left }; else delete state.stats[ruleId];
  SFX.place();
  renderTiles(ruleId, name);
  announce(`${CONTROL_SHORT[name]} ${entry.controls[name] ? 'on' : 'off'} for gate ${i + 1}.`);
}
document.addEventListener('click', (event) => {
  const chip = event.target.closest && event.target.closest('.chip[data-control]');
  if (chip) toggleControl(chip.dataset.rule, chip.dataset.control);
});

document.addEventListener('keydown', (event) => {
  if ((event.key === 'p' || event.key === 'P') && state.phase === 'play' && modal.hidden) { togglePause(); return; }
  const tile = event.target.closest && event.target.closest('.tile');
  if (!tile || !canEdit()) return;
  const id = tile.dataset.rule;
  const i = wallIndex(id);
  if (i === -1) {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); addToWall(id); }
    return;
  }
  const control = Object.keys(CONTROL_KEYS).find((n) => CONTROL_KEYS[n] === event.key.toLowerCase());
  if (control) { toggleControl(id, control); renderTiles(id); return; }
  if (event.key === 'ArrowUp') { event.preventDefault(); moveOnWall(id, i - 1); }
  else if (event.key === 'ArrowDown') { event.preventDefault(); moveOnWall(id, i + 1); }
  else if (['Enter', ' ', 'Delete', 'Backspace'].includes(event.key)) { event.preventDefault(); removeFromWall(id); }
});

// Pointer drag.
let drag = null;
function dropIndexAt(y, skip) {
  const tiles = [...wallEl.querySelectorAll('.tile')].filter((t) => t !== skip);
  for (let i = 0; i < tiles.length; i += 1) {
    const r = tiles[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return tiles.length;
}
function overWall(x, y) {
  const r = $('#wall-zone').getBoundingClientRect();
  return x > r.left - 70 && x < r.right + 70 && y > r.top - 40 && y < Math.max(r.bottom + 80, r.top + 220);
}
document.addEventListener('pointerdown', (event) => {
  const tile = event.target.closest('.tile');
  if (!tile || !canEdit() || event.button !== 0) return;
  drag = { tile, id: tile.dataset.rule, x: event.clientX, y: event.clientY, moved: false };
});
document.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true;
  drag.tile.classList.add('dragging');
  drag.tile.style.transform = `translate(${dx}px, ${dy}px) rotate(-2deg) scale(1.05)`;
  const hot = overWall(event.clientX, event.clientY);
  $('#wall-zone').classList.toggle('drop-hot', hot);
  for (const t of wallEl.querySelectorAll('.tile')) t.classList.remove('drop-before');
  wallEl.classList.remove('drop-end');
  if (hot) {
    const others = [...wallEl.querySelectorAll('.tile')].filter((t) => t !== drag.tile);
    const idx = dropIndexAt(event.clientY, drag.tile);
    if (others[idx]) others[idx].classList.add('drop-before'); else wallEl.classList.add('drop-end');
  }
});
function endDrag(event) {
  if (!drag) return;
  const d = drag;
  drag = null;
  $('#wall-zone').classList.remove('drop-hot');
  wallEl.classList.remove('drop-end');
  d.tile.classList.remove('dragging');
  d.tile.style.transform = '';
  if (!d.moved) {
    if (event.type === 'pointerup' && wallIndex(d.id) === -1) addToWall(d.id);
    return;
  }
  if (event.type === 'pointerup' && overWall(event.clientX, event.clientY)) {
    const idx = dropIndexAt(event.clientY, d.tile);
    if (wallIndex(d.id) === -1) addToWall(d.id, idx); else moveOnWall(d.id, idx);
  } else if (wallIndex(d.id) !== -1) {
    removeFromWall(d.id);
  } else {
    renderTiles();
  }
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// Point at a packet to see which gate will decide it.
stage.addEventListener('pointermove', (event) => {
  const r = stage.getBoundingClientRect();
  state.hover = { x: event.clientX - r.left, y: event.clientY - r.top };
});
stage.addEventListener('pointerleave', () => { state.hover = null; });

// ---------- geometry ----------
const insideHosts = () => hostsInside(state.challenge);

function playerGeom() {
  const sr = stage.getBoundingClientRect();
  const wr = wallEl.getBoundingClientRect();
  const gateYs = [...wallEl.querySelectorAll('.tile')].filter((t) => !t.classList.contains('dragging')).map((t) => {
    const b = t.getBoundingClientRect();
    return b.top - sr.top + b.height / 2;
  });
  const wallLeft = wr.left - sr.left;
  const wallRight = wr.right - sr.left;
  const hosts = {};
  const list = state.challenge ? insideHosts() : [];
  const many = list.length > 3;
  const baseX = Math.min(sr.width - 56, wallRight + (sr.width - wallRight) * 0.6);
  const zig = many ? Math.min(62, (sr.width - wallRight) * 0.2) : 0;
  const tiny = sr.width < 520;
  list.forEach((h, i) => {
    hosts[h.address] = {
      name: nameOf(state.challenge, h.address), address: h.address, scale: tiny ? 0.55 : many ? 0.75 : 1, tiny,
      x: Math.min(sr.width - 44, baseX + (i % 2 === 0 ? -zig : zig)),
      y: sr.height * (list.length === 1 ? 0.45 : many ? 0.22 + (0.5 * i) / (list.length - 1) : 0.28 + (0.4 * i) / (list.length - 1)),
    };
  });
  return {
    w: sr.width, h: sr.height, wallLeft, wallRight, wallTop: wr.top - sr.top, gateYs,
    ground: sr.height - 22, hosts, px: sr.width < 520 ? 3 : 4, x0: 0, portalX: 30,
    laneY: (i) => sr.height * (0.2 + (((i * 37) % 100) / 100) * 0.42),
  };
}

function rivalGeom(base) {
  const w = Math.min(280, base.w * 0.28);
  const h = 132;
  const x0 = 10;
  const y0 = base.h - h - 30;
  const n = state.challenge.rival.ruleBase.length;
  const gateYs = [];
  for (let i = 0; i < n; i += 1) gateYs.push(y0 + 40 + i * 16);
  const hosts = {};
  insideHosts().forEach((hst, i, list) => {
    hosts[hst.address] = { name: hst.name, address: hst.address, x: x0 + w - 24, y: y0 + 50 + (list.length === 1 ? 16 : (52 * i) / (list.length - 1)) };
  });
  return {
    inset: { x: x0, y: y0, w, h }, w: x0 + w, h: base.h,
    wallLeft: x0 + w * 0.5 - 9, wallRight: x0 + w * 0.5 + 9, wallTop: y0 + 28, gateYs,
    ground: y0 + h - 12, hosts, px: 2, x0, portalX: x0 + 12,
    laneY: (i) => y0 + 42 + ((i * 37) % 50),
  };
}

// ---------- packets ----------
function spawn(item, index) {
  const outbound = isOutbound(state.challenge, item.flow);
  const make = () => ({ flow: item.flow, kind: item.kind, index, outbound, spawn: item.t, snap: null, decided: false, arrived: false, done: false });
  state.packets.push(make());
  if (state.rival.downAt === null) state.rival.packets.push(make());
}

// Fixes a packet's fate the moment it reaches the wall, against the wall as it is right then.
function snapshot(p, ruleBase, gateYs) {
  const verdict = evaluateFlow(ruleBase, state.challenge.rules, p.flow);
  const m = verdict.matchedIndex;
  const checks = m === null ? gateYs.length : m;
  const through = m !== null && verdict.verdict !== 'denied-by-rule';
  const tFace = p.spawn + T_APPROACH;
  const tDecide = tFace + checks * T_CHECK;
  const tArrive = tDecide + T_CROSS + T_TRAVEL;
  p.snap = {
    verdict, gateYs: gateYs.slice(), ruleId: m === null ? null : ruleBase[m].ruleId,
    tFace, tDecide, tArrive, through, tEnd: (through ? tArrive : tDecide) + T_FADE,
  };
}

function packetPos(p, g, t) {
  const ys = p.snap ? p.snap.gateYs : g.gateYs;
  const n = ys.length;
  const lag = (p.index % 4) * 20 * (g.px / 4); // fan packets out so they do not stack
  const faceX = p.outbound ? g.wallRight + 22 + lag : g.wallLeft - 22 - lag;
  const farX = p.outbound ? g.wallLeft - 22 : g.wallRight + 22;
  const host = g.hosts[p.outbound ? p.flow.srcAddress : p.flow.dstAddress] || Object.values(g.hosts)[0];
  const lane = g.laneY(p.index);
  const start = p.outbound ? { x: host.x - 24, y: host.y } : { x: g.portalX, y: lane };
  const goal = p.outbound ? { x: g.x0 - 30, y: lane } : { x: host.x - 24, y: host.y };
  const topY = n > 0 ? ys[0] : g.wallTop + 18;
  const local = t - p.spawn;
  if (local < 0) return null;
  if (!p.snap || local < T_APPROACH) {
    const k = ease(Math.min(1, local / T_APPROACH));
    return { x: lerp(start.x, faceX, k), y: lerp(start.y, topY, k), alpha: 1 };
  }
  const s = p.snap;
  const m = s.verdict.matchedIndex;
  if (t < s.tDecide) {
    const k = Math.floor((t - s.tFace) / T_CHECK);
    const into = ((t - s.tFace) - k * T_CHECK) / T_CHECK;
    const here = ys[Math.min(k, n - 1)];
    const next = k + 1 < n ? ys[k + 1] : g.ground - 4;
    return { x: faceX, y: lerp(here, next, into), alpha: 1 };
  }
  const d = t - s.tDecide;
  if (m === null) {
    const k = d / T_FADE;
    return { x: faceX, y: lerp(n > 0 ? ys[n - 1] : topY, g.ground + 8, ease(k)), alpha: 1 - Math.max(0, k - 0.5) * 2 };
  }
  const gy = ys[m];
  if (!s.through) {
    const k = d / T_FADE;
    const back = Math.sin(Math.min(1, k) * Math.PI * 0.5) * 60;
    return { x: faceX + (p.outbound ? back : -back), y: gy - Math.sin(Math.min(1, k) * Math.PI) * 22, alpha: 1 - k };
  }
  if (d < T_CROSS) return { x: lerp(faceX, farX, d / T_CROSS), y: gy, alpha: 1 };
  const k = (d - T_CROSS) / T_TRAVEL;
  const stopped = s.verdict.verdict === 'stopped-by-control';
  const end = stopped ? { x: lerp(farX, goal.x, 0.45), y: lerp(gy, goal.y, 0.45) } : goal;
  if (k < 1) return { x: lerp(farX, end.x, ease(k)), y: lerp(gy, end.y, ease(k)), alpha: 1 };
  return { x: end.x, y: end.y, alpha: Math.max(0, 1 - (k - 1) * (T_TRAVEL / T_FADE)) };
}

// ---------- outcomes ----------
function pop(text, color, x, y, big) { state.effects.push({ type: 'text', text, color, x, y, born: state.t, life: big ? 1.4 : 0.9, big }); }
function burst(x, y, color) { state.effects.push({ type: 'burst', color, x, y, born: state.t, life: 0.4 }); }
const mult = () => 1 + Math.min(4, Math.floor(state.combo / 5));
function gain(points, x, y) {
  const total = points * mult();
  state.score += total;
  pop(`+${total}`, COLOR.warn, x, y - 26);
}
function bumpCombo() { state.combo += 1; state.bestCombo = Math.max(state.bestCombo, state.combo); }
function breakCombo() { state.combo = 0; state.streak = 0; }
function stat(ruleId, key) {
  if (!ruleId) return;
  state.stats[ruleId] = state.stats[ruleId] || {};
  state.stats[ruleId][key] = (state.stats[ruleId][key] || 0) + 1;
  if (drag) return; // do not rebuild tiles mid-drag
  const data = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset : {};
  renderTiles(data.rule || null, data.control || null);
}
// Marks the spare gates that could let this wanted traffic through.
function suggest(flow) {
  const ids = candidatesFor(state.challenge, flow, evaluateFlow).filter((id) => wallIndex(id) === -1);
  const same = ids.length === state.tryThese.size && ids.every((id) => state.tryThese.has(id));
  if (same) return;
  state.tryThese = new Set(ids);
  if (!drag) { const d = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset : {}; renderTiles(d.rule || null, d.control || null); }
}
function flashGate(index, cls) {
  const tile = wallEl.querySelectorAll('.tile')[index];
  if (!tile) return;
  tile.classList.remove('gate-allow', 'gate-deny');
  void tile.offsetWidth;
  tile.classList.add(cls);
}
const gateNumber = (p) => (p.snap.verdict.matchedIndex === null ? null : p.snap.verdict.matchedIndex + 1);

function onDecision(p, pos) {
  const v = p.snap.verdict;
  const m = v.matchedIndex;
  const what = label(p.flow);
  if (m === null) SFX.pit();
  else if (v.verdict === 'denied-by-rule') { flashGate(m, 'gate-deny'); burst(pos.x, pos.y, COLOR.warn); SFX.deny(); }
  else flashGate(m, 'gate-allow');
  if (p.snap.through) return; // settled when it arrives

  if (p.kind === 'customer') {
    breakCombo();
    pop(m === null ? 'NO GATE FOR ME!' : `GATE ${m + 1} SAID NO!`, COLOR.bad, pos.x, pos.y);
    SFX.angry();
    logLine(`Wanted traffic (${what}) blocked: ${m === null ? 'no gate matches (implicit deny)' : `gate ${m + 1} denies`}.`, 'bad');
    if (state.t >= Math.max(WARMUP, (state.orderTime[p.flow.id] || 0) + ORDER_GRACE)) {
      state.patience -= 1;
      state.blockedAfterWarmup += 1;
      stat(p.snap.ruleId, 'block');
      if (state.patience <= 0) { lose('outage', p); return; }
    }
    if (m === null) suggest(p.flow);
    coach(m === null ? `NO GATE LETS ${what} IN. ADD ONE MARKED "TRY".` : `GATE ${m + 1} BLOCKS ${what}. MOVE IT DOWN OR PULL IT OFF.`);
  } else if (p.kind === 'attacker') {
    bumpCombo();
    gain(10, pos.x, pos.y);
    SFX.stop();
    logLine(`Attack (${what}) stopped: ${m === null ? 'no match, implicit deny' : `gate ${m + 1} denies`}.`, 'good');
  } else {
    gain(2, pos.x, pos.y);
    logLine(`Unneeded traffic (${what}) denied.`, 'good');
  }
}

function onArrival(p, pos) {
  const v = p.snap.verdict;
  const what = label(p.flow);
  const n = gateNumber(p);
  const rule = state.challenge.rules[p.snap.ruleId];
  if (v.verdict === 'stopped-by-control') {
    burst(pos.x, pos.y, COLOR.warn);
    pop(v.control === 'dnsFiltering' ? 'FILTERED!' : 'SCANNED!', COLOR.good, pos.x, pos.y);
    if (p.kind !== 'customer') { bumpCombo(); gain(10, pos.x, pos.y); SFX.stop(); }
    logLine(`${what} let through gate ${n}, then stopped by ${CONTROL_SHORT[v.control] || 'a scanner'}.`, 'good');
    return;
  }
  if (p.kind === 'customer') {
    bumpCombo();
    state.streak += 1;
    if (state.streak % 3 === 0 && state.patience < MAX_PATIENCE) state.patience += 1;
    gain(5, pos.x, pos.y);
    SFX.deliver();
    logLine(`Wanted traffic (${what}) served through gate ${n}.`, 'good');
  } else if (p.kind === 'attacker') {
    breakCombo();
    state.hp -= 1;
    state.shake = 0.5;
    state.leaked.add(p.flow.id);
    state.lastHit = { address: p.outbound ? p.flow.srcAddress : p.flow.dstAddress, until: state.t + 1.2 };
    burst(pos.x, pos.y, COLOR.bad);
    pop('HIT!', COLOR.bad, pos.x, pos.y, true);
    SFX.hit();
    (state.stats[p.snap.ruleId] = state.stats[p.snap.ruleId] || {}).need = leakFix(p.flow, v, rule);
    stat(p.snap.ruleId, 'leak');
    const hint = leakHint(state.challenge, p.flow, v, rule, n);
    state.lastHint = hint;
    logLine(`BREACH: ${what} got through gate ${n}. ${hint}`, 'bad');
    coach(hint, 6);
    if (state.hp <= 0) lose('breach', p);
  } else {
    state.exposed.add(p.flow.id);
    state.score = Math.max(0, state.score - 5);
    const fix = leakFix(p.flow, v, rule);
    pop(fix.length > 0 ? 'NOT SCANNED  -5' : 'NOT NEEDED  -5', COLOR.warn, pos.x, pos.y);
    SFX.expose();
    if (fix.length > 0) {
      (state.stats[p.snap.ruleId] = state.stats[p.snap.ruleId] || {}).need = fix;
      stat(p.snap.ruleId, 'unscanned');
      coach(leakHint(state.challenge, p.flow, v, rule, n), 6);
    } else {
      stat(p.snap.ruleId, 'expose');
    }
    logLine(`Exposure: ${fix.length > 0 ? 'unscanned' : 'unneeded'} traffic (${what}) got through gate ${n}.`, 'warn');
  }
}

// ---------- HUD ----------
function pips(node, value, max, on, off, label) {
  node.replaceChildren(el('span', { class: 'hud-small' }, label), ...Array.from({ length: max }, (_, i) => el('span', { class: `pip ${i < value ? 'on' : 'off'}` }, i < value ? on : off)));
  node.setAttribute('aria-label', `${label}: ${Math.max(0, value)} of ${max}`);
  node.classList.toggle('is-low', value <= 2);
}
let hudKey = '';
function updateHud() {
  const key = `${state.levelIndex}|${state.hp}|${state.patience}|${state.score}|${state.combo}|${state.wave}`;
  if (key !== hudKey) {
    hudKey = key;
    pips($('#hud-hp'), state.hp, MAX_HP, '♥', '♡', state.cfg ? state.cfg.hp : 'SERVERS');
    pips($('#hud-cust'), state.patience, MAX_PATIENCE, '☺', '☹', state.cfg ? state.cfg.friend : 'CUSTOMERS');
    $('#hud-score').textContent = String(state.score);
    const combo = $('#hud-combo');
    combo.textContent = state.combo >= 2 ? `COMBO ${state.combo}  ×${mult()}` : '';
    combo.classList.toggle('hot', mult() > 1);
    $('#wave-label').textContent = state.wave < 0 ? 'WARM-UP' : `WAVE ${state.wave + 1}/${state.waveStarts.length}`;
  }
  $('#wave-fill').style.width = `${Math.min(100, (state.t / state.runLength) * 100)}%`;
}
function banner(text, tone) {
  bannerEl.textContent = text;
  bannerEl.className = `show ${tone || ''}`;
  setTimeout(() => { bannerEl.className = ''; }, 1700);
}

// ---------- flow of play ----------
function setBackgroundInert(on) { for (const id of ['#hud', '#stage', '#tray-zone', '#log-panel']) $(id).inert = on; }
function closeModal() { modal.hidden = true; setBackgroundInert(false); }
function showModal({ title, body, actions, tone }) {
  $('#modal-title').textContent = title;
  $('#modal-body').replaceChildren(...body.filter(Boolean));
  const buttons = actions.filter(Boolean).map((a) => {
    const b = a.href ? el('a', { class: a.primary ? 'big-btn' : 'small-btn', href: a.href }, a.label)
      : el('button', { type: 'button', class: a.primary ? 'big-btn' : 'small-btn' }, a.label);
    if (a.onClick) b.addEventListener('click', () => { closeModal(); a.onClick(); });
    return b;
  });
  $('#modal-actions').replaceChildren(...buttons);
  modal.className = tone || '';
  modal.hidden = false;
  setBackgroundInert(true);
  const first = modal.querySelector('[data-autofocus]') || buttons.find((b) => b.classList.contains('big-btn')) || buttons[0];
  if (first) first.focus();
}

// ---------- levels ----------
const STORE = 'firewall-faceoff-arcade-v1';
function loadProgress() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE) || 'null');
    if (saved && saved.stars && saved.best) state.progress = saved;
  } catch (err) { /* progress is optional */ }
}
function saveProgress() {
  try { window.localStorage.setItem(STORE, JSON.stringify(state.progress)); } catch (err) { /* progress is optional */ }
}
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

function selectLevel(index) {
  const entry = state.levels[index];
  state.levelIndex = index;
  state.level = entry.level;
  state.challenge = entry.challenge;
  state.cfg = arcadeOf(entry.challenge);
  state.phase = 'title';
  state.wall = [];
  state.packets = [];
  state.rival = { hp: RIVAL_HP, packets: [], downAt: null };
  state.stats = {};
  state.orders = buildSchedule(state.challenge).orders;
  game.className = 'phase-title';
  showMission();
  renderTiles();
  hudKey = '';
  updateHud();
}

function showLevels() {
  const inPlay = state.phase === 'play';
  const cards = state.levels.map((entry, i) => {
    const stars = state.progress.stars[entry.level.id] || 0;
    const card = el('button', { type: 'button', class: 'level-card', 'data-autofocus': i === state.levelIndex ? true : null,
      'aria-label': `Level ${i + 1}: ${entry.level.title}. ${stars} of 3 stars.` },
      el('span', { class: 'level-num' }, String(i + 1)),
      el('span', { class: 'level-name' }, entry.level.title.toUpperCase()),
      el('span', { class: 'level-skill' }, entry.level.capability),
      el('span', { class: `level-stars ${stars ? 'has' : ''}` }, starText(stars)));
    card.addEventListener('click', () => { closeModal(); selectLevel(i); showIntro(); });
    return card;
  });
  showModal({
    title: 'FIREWALL FACEOFF',
    body: [
      el('p', { class: 'modal-tagline' }, 'Let the right traffic in. Keep the rest out.'),
      el('div', { class: 'level-grid' }, cards),
    ],
    actions: [
      inPlay ? { label: 'BACK TO THE GAME', onClick: () => {} } : null,
      { label: 'TEXT EDITION', href: 'classic.html' },
    ],
  });
}

function showIntro() {
  const n = state.levelIndex + 1;
  showModal({
    title: `LEVEL ${n}: ${state.level.title.toUpperCase()}`,
    body: [
      el('div', { class: 'howto' }, state.cfg.intro.map((row) => el('div', {}, el('span', { class: `howto-icon ${row.tone || ''}` }, row.icon), row.text))),
      reducedMotion() ? el('p', { class: 'modal-small' }, 'This edition is animated and plays in real time. You can pause at any moment and still change your wall. The text edition has no motion.') : null,
    ],
    actions: [
      { label: 'START', primary: true, onClick: startRun },
      { label: 'LEVELS', onClick: showLevels },
    ],
  });
}

function startRun() {
  const c = state.challenge;
  const plan = buildSchedule(c);
  Object.assign(state, {
    phase: 'play', paused: false,
    wall: [], // the arcade edition always starts from a bare wall
    orders: plan.orders, orderTime: plan.orderTime,
    schedule: plan.items, next: 0, t: 0, runLength: plan.end + 4, waveStarts: plan.waveStarts, wave: -1,
    packets: [], rival: { hp: RIVAL_HP, packets: [], downAt: null },
    hp: MAX_HP, patience: MAX_PATIENCE, score: 0, combo: 0, bestCombo: 0, streak: 0,
    stats: {}, leaked: new Set(), exposed: new Set(), blockedAfterWarmup: 0,
    effects: [], shake: 0, lastHit: null, lastHint: null, coachUntil: 0, tryThese: new Set(),
  });
  game.className = 'phase-play';
  $('#btn-pause').textContent = 'PAUSE';
  $('#btn-pause').setAttribute('aria-pressed', 'false');
  logEl.replaceChildren();
  renderTiles();
  updateHud();
  showMission();
  suggest(state.challenge.requiredFlows.find((f) => !state.orderTime[f.id]) || state.challenge.requiredFlows[0]);
  coach(`${state.cfg.friend} ARE COMING. DRAG A GATE MARKED "TRY" ONTO THE WALL.`, 8);
  const first = trayEl.querySelector('.tile');
  if (first) first.focus();
  announce(`Level ${state.levelIndex + 1} has started. Wanted traffic is arriving. Add a gate to your wall.`);
}

function showMission() {
  const active = state.orders.filter((o) => o.shown || o.t === 0);
  $('#mission').replaceChildren(el('span', { class: 'mission-label' }, 'ORDERS'), ...active.map((o) => el('span', { class: `order${o.t > 0 && state.t - o.t < 8 && state.phase === 'play' ? ' order-new' : ''}` }, o.short)), el('span', { class: 'order order-rest' }, 'BLOCK THE REST'));
  measureMission();
}
function measureMission() {
  state.missionH = $('#mission').offsetHeight || 40;
  stage.style.setProperty('--mission-h', `${state.missionH}px`);
}
window.addEventListener('resize', measureMission);

function togglePause() {
  if (state.phase !== 'play') return;
  state.paused = !state.paused;
  $('#btn-pause').textContent = state.paused ? 'RESUME' : 'PAUSE';
  $('#btn-pause').setAttribute('aria-pressed', String(state.paused));
  game.classList.toggle('is-paused', state.paused);
  announce(state.paused ? 'Paused. You can still change your wall.' : 'Resumed.');
}

function lessonsFor(ids) {
  const c = state.challenge;
  return [...c.attackSteps, ...c.probes].filter((f) => ids.has(f.id) && f.lesson).slice(0, 3)
    .map((f) => el('li', {}, el('strong', {}, `${label(f)}: `), `${f.lesson.split('. ')[0].replace(/\.$/, '')}.`));
}

function lose(type, p) {
  if (state.phase !== 'play') return;
  state.phase = 'over';
  game.className = 'phase-over';
  SFX.lose();
  banner(type === 'breach' ? 'BREACHED' : 'OUTAGE', 'bad');
  const n = gateNumber(p);
  const why = explainVerdict(p.snap.verdict, { ruleBase: state.wall, rules: state.challenge.rules, flow: p.flow });
  announce(`${type === 'breach' ? 'Breached' : 'Outage'}. ${why}`);
  logLine(`${type === 'breach' ? 'Breached' : 'Outage'}. ${why}`, 'bad');
  setTimeout(() => showModal({
    title: type === 'breach' ? 'BREACHED' : 'OUTAGE', tone: 'bad',
    body: [
      el('p', { class: 'modal-lead' }, type === 'breach'
        ? `Too many attacks got through gate ${n}.`
        : (n === null ? `No gate let ${label(p.flow)} through.` : `Gate ${n} kept turning ${label(p.flow)} away.`)),
      type === 'breach' && state.lastHint ? el('p', { class: 'modal-fix' }, state.lastHint) : null,
      el('p', { class: 'modal-small' }, `You lasted ${clockText(state.t)}. Score ${state.score}.`),
    ],
    actions: [{ label: 'TRY AGAIN', primary: true, onClick: startRun }, { label: 'LEVELS', onClick: showLevels }],
  }), reducedMotion() ? 0 : 1200);
}

function win() {
  if (state.phase !== 'play') return;
  state.phase = 'over';
  game.className = 'phase-over';
  const result = evaluateSubmission(state.challenge, state.wall);
  const stars = starsFor(result, { leaks: state.leaked.size, blocked: state.blockedAfterWarmup, exposed: state.exposed.size, hp: state.hp });
  const id = state.level.id;
  state.progress.stars[id] = Math.max(state.progress.stars[id] || 0, stars);
  state.progress.best[id] = Math.max(state.progress.best[id] || 0, state.score);
  saveProgress();
  const hasNext = state.levelIndex + 1 < state.levels.length;
  SFX.win();
  banner('LEVEL CLEAR', 'good');
  const rivalLine = state.rival.downAt !== null
    ? `The rival went down at ${clockText(state.rival.downAt)}. You held for ${clockText(state.t)}.`
    : 'The rival held too.';
  const lessons = lessonsFor(new Set([...state.leaked, ...state.exposed]));
  announce(`Level clear. ${stars} of 3 stars. Score ${state.score}. ${rivalLine}`);
  logLine(`Level clear: ${stars} of 3 stars, score ${state.score}.`, 'head');
  setTimeout(() => showModal({
    title: 'LEVEL CLEAR', tone: 'good',
    body: [
      el('p', { class: 'stars', role: 'img', 'aria-label': `${stars} of 3 stars` }, '★'.repeat(stars), el('span', { class: 'stars-off' }, '★'.repeat(3 - stars))),
      el('p', { class: 'final-score' }, String(state.score), el('span', {}, ` BEST COMBO ${state.bestCombo}`)),
      el('p', {}, rivalLine),
      stars === 3 ? el('p', { class: 'modal-lead' }, 'Perfect wall. Nothing got in that was not asked for.') : null,
      stars < 3 && lessons.length === 0 ? el('p', {}, result.completed ? 'Your final wall was tight, but it slipped along the way. Try for a clean run.' : 'Your wall still lets something through. Check the badges on your gates.') : null,
      lessons.length > 0 ? el('ul', { class: 'modal-list' }, lessons) : null,
      el('p', { class: 'modal-badge' }, 'UNLOCKED: ', el('strong', {}, state.level.capability.toUpperCase())),
    ],
    actions: [
      hasNext ? { label: 'NEXT LEVEL', primary: true, onClick: () => { selectLevel(state.levelIndex + 1); showIntro(); } } : null,
      { label: stars === 3 ? 'PLAY AGAIN' : 'GO FOR 3 STARS', primary: !hasNext, onClick: startRun },
      { label: 'LEVELS', onClick: showLevels },
    ],
  }), reducedMotion() ? 0 : 1300);
}

// ---------- drawing ----------
function rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
function sprite(map, cx, cy, px, color, alpha = 1) {
  const w = map[0].length * px;
  const h = map.length * px;
  ctx.globalAlpha = Math.max(0, alpha);
  ctx.fillStyle = color;
  map.forEach((row, r) => {
    for (let c = 0; c < row.length; c += 1) if (row[c] === 'X') ctx.fillRect(Math.round(cx - w / 2 + c * px), Math.round(cy - h / 2 + r * px), px, px);
  });
  ctx.globalAlpha = 1;
}
function text(str, x, y, color, font = FONT, align = 'left') {
  ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
  ctx.fillText(str, Math.round(x), Math.round(y));
}
function bricks(x, y, w, h) {
  rect(x, y, w, h, COLOR.brick);
  ctx.fillStyle = COLOR.mortar;
  for (let row = 0; row * 14 < h; row += 1) {
    ctx.fillRect(Math.round(x), Math.round(y + row * 14), Math.round(w), 2);
    for (let bx = row % 2 === 0 ? 14 : 0; bx < w; bx += 28) ctx.fillRect(Math.round(x + bx), Math.round(y + row * 14), 2, 14);
  }
}
function drawHost(host, hurt, small) {
  const s = small ? 0.5 : (host.scale || 1);
  const w = 46 * s;
  const h = 64 * s;
  rect(host.x - w / 2, host.y - h / 2, w, h, COLOR.mortar);
  for (let i = 0; i < 4; i += 1) {
    rect(host.x - w / 2 + 4 * s, host.y - h / 2 + (4 + i * 14.5) * s, w - 8 * s, 10 * s, hurt ? COLOR.bad : COLOR.base);
    rect(host.x + w / 2 - 10 * s, host.y - h / 2 + (7 + i * 14.5) * s, 4 * s, 4 * s, hurt ? COLOR.warn : COLOR.good);
  }
  if (hurt) {
    const f = Math.floor(state.t * 12);
    for (let i = 0; i < 5; i += 1) {
      const fh = (8 + ((f + i * 3) % 6) * 2) * s;
      rect(host.x - w / 2 + (4 + i * 8) * s, host.y - h / 2 - fh, 5 * s, fh, i % 2 === 0 ? COLOR.warn : COLOR.bad);
    }
  }
  if (!small) {
    ctx.font = host.tiny ? FONT : FONT_BIG;
    const half = ctx.measureText(host.name).width / 2 + 2;
    text(host.name, Math.min(host.x, ctx.canvas.clientWidth - half), host.y + h / 2 + (host.tiny ? 9 : 13), COLOR.text, host.tiny ? FONT : FONT_BIG, 'center');
  }
}
const packetColor = (kind) => (kind === 'attacker' ? COLOR.bad : kind === 'customer' ? COLOR.good : COLOR.stray);

function drawPackets(list, g, labels) {
  for (const p of list) {
    if (p.done) continue;
    const pos = packetPos(p, g, state.t);
    if (!pos || pos.alpha <= 0) continue;
    const bob = !p.snap ? Math.sin(state.t * 9 + p.index) * 3 : 0;
    sprite(SPRITES[p.kind], pos.x, pos.y + bob, g.px, packetColor(p.kind), pos.alpha);
    // Labels are for reading on the way in; they fade as the packet joins the queue at the wall.
    const near = (state.t - p.spawn) / T_APPROACH;
    const fade = p.snap ? 0 : Math.max(0, Math.min(1, (0.92 - near) / 0.2));
    if (labels && pos.alpha > 0.5 && flowLabel(state.challenge, p.flow).locked) sprite(SPRITES.lock, pos.x + 22, pos.y + bob + 2, 2, COLOR.warn, pos.alpha);
    if (labels && pos.alpha > 0.5 && fade > 0) {
      const l = flowLabel(state.challenge, p.flow);
      const color = packetColor(p.kind);
      const main = l.payload ? `${l.main} +${l.payload}` : l.main;
      const big = g.w < 520 ? FONT : FONT_BIG;
      ctx.font = big;
      const half = Math.max(ctx.measureText(main).width, l.who ? ctx.measureText(l.who).width : 0) / 2 + 4;
      const lx = Math.max(half, Math.min(g.w - half, pos.x));
      const below = p.index % 2 === 1; // alternate above and below so neighbours do not stack
      const ly = pos.y + bob + (below ? 26 : -24);
      ctx.globalAlpha = 0.72 * fade; rect(lx - half, ly - (l.who && !below ? 25 : 9), half * 2, l.who ? 34 : 18, COLOR.bg);
      ctx.globalAlpha = fade;
      text(main, lx, ly, color, big, 'center');
      if (l.who) text(l.who, lx, ly + (below ? 16 : -16), color, FONT, 'center');
      ctx.globalAlpha = 1;
    }
  }
}

function drawHoverTrace(g) {
  if (!state.hover || state.phase !== 'play') return;
  let best = null;
  for (const p of state.packets) {
    if (p.done || p.snap) continue;
    const pos = packetPos(p, g, state.t);
    if (!pos) continue;
    const d = Math.hypot(pos.x - state.hover.x, pos.y - state.hover.y);
    if (d < 46 && (!best || d < best.d)) best = { p, pos, d };
  }
  if (!best) return;
  const v = evaluateFlow(state.wall, state.challenge.rules, best.p.flow);
  const m = v.matchedIndex;
  const ty = m === null || g.gateYs[m] === undefined ? g.ground : g.gateYs[m];
  const tx = best.p.outbound ? g.wallRight + 6 : g.wallLeft - 6;
  const ok = (best.p.kind === 'customer') === (v.verdict === 'allowed');
  ctx.strokeStyle = ok ? COLOR.good : COLOR.bad;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.beginPath(); ctx.moveTo(best.pos.x, best.pos.y); ctx.lineTo(tx, ty); ctx.stroke();
  ctx.setLineDash([]);
  text(m === null ? 'NO GATE: OUT' : `GATE ${m + 1}: ${v.verdict === 'allowed' ? 'IN' : 'OUT'}`, best.pos.x, best.pos.y + 26, ok ? COLOR.good : COLOR.bad, FONT, 'center');
}

function draw() {
  const g = playerGeom();
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(g.w * dpr) || canvas.height !== Math.round(g.h * dpr)) {
    canvas.width = Math.round(g.w * dpr);
    canvas.height = Math.round(g.h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (state.shake > 0) ctx.translate(Math.round(Math.sin(state.t * 80) * 8 * state.shake), Math.round(Math.cos(state.t * 70) * 4 * state.shake));

  rect(-12, -12, g.w + 24, g.h + 24, COLOR.bg);
  ctx.fillStyle = COLOR.grid;
  const scroll = (state.t * 14) % 28;
  for (let x = -scroll; x < g.w; x += 28) ctx.fillRect(Math.round(x), 0, 1, g.h);
  for (let y = 0; y < g.h; y += 28) ctx.fillRect(0, y, g.w, 1);
  rect(-12, g.ground, g.w + 24, g.h - g.ground + 12, COLOR.ground);

  const c = state.challenge;
  if (!c) { ctx.restore(); return; }

  const zoneY = state.missionH + 16;
  const zoneFont = g.w < 520 ? FONT_BIG : FONT_HUGE;
  text(c.topology.zones.filter((z) => !state.cfg.inside.includes(z)).join(' + ').toUpperCase(), 14, zoneY, COLOR.rival, zoneFont);
  text(state.cfg.inside.join(' + ').toUpperCase(), g.w - 14, zoneY, COLOR.you, zoneFont, 'right');

  const spin = Math.floor(state.t * 8) % 4;
  for (let i = 0; i < 4; i += 1) rect(g.portalX - 16 + (i === spin ? 3 : 0), g.h * 0.2 + i * (g.h * 0.42 / 4), 9, g.h * 0.42 / 4 - 6, i === spin ? COLOR.rival : '#5a2440');

  bricks(g.wallLeft - 8, g.wallTop - 12, g.wallRight - g.wallLeft + 16, g.ground - g.wallTop + 12);
  rect(g.wallLeft - 92, g.ground, 82, 22, COLOR.pit);
  for (let i = 0; i < 7; i += 1) rect(g.wallLeft - 88 + i * 11.5, g.ground + 11, 7, 11, COLOR.bad);

  for (const host of Object.values(g.hosts)) {
    const hurt = state.hp <= 0 || (state.lastHit && state.lastHit.address === host.address && state.t < state.lastHit.until);
    drawHost(host, hurt, false);
  }

  drawHoverTrace(g);
  drawPackets(state.packets, g, true);

  for (const e of state.effects) {
    const age = (state.t - e.born) / e.life;
    if (age >= 1) continue;
    if (e.type === 'text') {
      ctx.globalAlpha = 1 - age ** 2;
      text(e.text, e.x, e.y - 30 - age * 26, e.color, e.big ? FONT_HUGE : FONT_BIG, 'center');
      ctx.globalAlpha = 1;
    } else {
      sprite(SPRITES.spark, e.x, e.y, 3 + Math.floor(age * 5), e.color, 1 - age);
    }
  }
  state.effects = state.effects.filter((e) => state.t - e.born < e.life);

  drawRival(g);
  ctx.restore();
}

function drawRival(base) {
  const r = rivalGeom(base);
  const b = r.inset;
  const down = state.rival.downAt !== null;
  rect(b.x, b.y, b.w, b.h, '#05070f');
  ctx.strokeStyle = COLOR.rival; ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  text('RIVAL', b.x + 10, b.y + 14, COLOR.rival, FONT_BIG);
  for (let i = 0; i < RIVAL_HP; i += 1) sprite(SPRITES.heart, b.x + b.w - 14 - i * 18, b.y + 14, 2, i < state.rival.hp ? COLOR.bad : '#3a2030');
  bricks(r.wallLeft - 3, r.wallTop, r.wallRight - r.wallLeft + 6, r.ground - r.wallTop);
  state.challenge.rival.ruleBase.forEach((entry, i) => {
    const rule = state.challenge.rules[entry.ruleId];
    rect(r.wallLeft - 1, r.gateYs[i] - 6, r.wallRight - r.wallLeft + 2, 12, rule.action === 'allow' ? COLOR.good : COLOR.bad);
  });
  rect(b.x + 2, r.ground, b.w - 4, b.y + b.h - r.ground - 2, COLOR.ground);
  for (const host of Object.values(r.hosts)) drawHost(host, down, true);
  ctx.save();
  ctx.beginPath(); ctx.rect(b.x + 2, b.y + 24, b.w - 4, b.h - 26); ctx.clip();
  drawPackets(state.rival.packets, r, false);
  ctx.restore();
  if (down) text('DOWN', b.x + b.w / 2, b.y + b.h / 2 + 6, COLOR.bad, FONT_HUGE, 'center');
}

// ---------- main loop ----------
function step(dt) {
  state.t += dt;
  state.shake = Math.max(0, state.shake - dt);
  const c = state.challenge;

  for (let k = state.waveStarts.length - 1; k > state.wave; k -= 1) {
    if (state.t >= state.waveStarts[k]) {
      state.wave = k;
      const atk = c.attackSteps[k];
      banner(`WAVE ${k + 1}`, 'neutral');
      if (!state.orders.some((o) => o.t === state.waveStarts[k])) coach(`INCOMING ATTACK: ${label(atk)}`, 5);
      SFX.wave();
      logLine(`Wave ${k + 1}: ${atk.label}.`, 'head');
      announce(`Wave ${k + 1}. ${atk.label}.`);
      break;
    }
  }

  for (const o of state.orders) {
    if (!o.shown && o.t > 0 && state.t >= o.t) {
      o.shown = true;
      showMission();
      banner('NEW ORDER', 'neutral');
      coach(o.text, 7);
      suggest(state.challenge.requiredFlows.find((f) => f.id === o.flows[0]));
      logLine(o.text, 'head');
      announce(o.text);
    }
  }

  while (state.next < state.schedule.length && state.schedule[state.next].t <= state.t) {
    spawn(state.schedule[state.next], state.next);
    state.next += 1;
  }

  const g = playerGeom();
  for (const p of state.packets) {
    if (p.done || state.phase !== 'play') continue;
    if (!p.snap && state.t >= p.spawn + T_APPROACH) snapshot(p, state.wall, g.gateYs);
    if (!p.snap) continue;
    if (!p.decided && state.t >= p.snap.tDecide) { p.decided = true; onDecision(p, packetPos(p, g, p.snap.tDecide)); }
    if (state.phase !== 'play') break;
    if (p.snap.through && !p.arrived && state.t >= p.snap.tArrive) { p.arrived = true; onArrival(p, packetPos(p, g, p.snap.tArrive)); }
    if (state.t >= p.snap.tEnd) p.done = true;
  }
  state.packets = state.packets.filter((p) => !p.done);

  // The rival faces the same traffic with its fixed wall.
  const rv = state.rival;
  const rg = rivalGeom(g);
  for (const p of rv.packets) {
    if (p.done) continue;
    if (!p.snap && state.t >= p.spawn + T_APPROACH) snapshot(p, c.rival.ruleBase, rg.gateYs);
    if (!p.snap) continue;
    if (p.snap.through && !p.arrived && state.t >= p.snap.tArrive) {
      p.arrived = true;
      if (p.kind === 'attacker' && p.snap.verdict.verdict === 'allowed' && rv.downAt === null) {
        rv.hp -= 1;
        if (rv.hp <= 0) {
          rv.downAt = state.t;
          banner('RIVAL DOWN', 'good');
          logLine('The rival firewall went down.', 'head');
          announce('The rival firewall went down.');
        }
      }
    }
    if (state.t >= p.snap.tEnd) p.done = true;
  }
  rv.packets = rv.packets.filter((p) => !p.done);

  if (state.coachUntil && state.t > state.coachUntil) { coachEl.classList.remove('show'); state.coachUntil = 0; }
  if (state.phase === 'play' && state.next >= state.schedule.length && state.packets.length === 0) win();
  updateHud();
}

// ?speed=4 in the address runs the clock faster. It is a testing aid, not a setting.
const SPEED = Math.max(1, Math.min(8, Math.round(Number(new URLSearchParams(window.location.search).get('speed')) || 1)));
let lastFrame = null;
function tick(now) {
  const dt = lastFrame === null ? 0 : Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (state.phase === 'play' && !state.paused && modal.hidden) { for (let i = 0; i < SPEED && state.phase === 'play'; i += 1) step(dt); }
  else if (state.phase === 'over') { state.t += dt * 0.3; state.shake = Math.max(0, state.shake - dt); }
  draw();
  window.requestAnimationFrame(tick);
}

// ---------- controls ----------
$('#btn-pause').addEventListener('click', togglePause);
$('#btn-restart').addEventListener('click', () => { if (state.challenge) startRun(); });
$('#btn-levels').addEventListener('click', () => { if (state.levels.length) showLevels(); });
$('#btn-sound').addEventListener('click', () => {
  state.sound = !state.sound;
  $('#btn-sound').textContent = `SOUND ${state.sound ? 'ON' : 'OFF'}`;
  $('#btn-sound').setAttribute('aria-pressed', String(state.sound));
});
$('#btn-log').addEventListener('click', () => {
  const panel = $('#log-panel');
  panel.hidden = !panel.hidden;
  $('#btn-log').setAttribute('aria-expanded', String(!panel.hidden));
});

// ---------- start ----------
async function boot() {
  let content = null;
  let loadError = null;
  try {
    const response = await fetch('data/levels.json');
    if (!response.ok) throw new Error(`the server answered ${response.status}`);
    content = await response.json();
  } catch (err) {
    loadError = `data/levels.json could not be loaded (${err.message}).`;
  }
  const validation = validateContent(content);
  // Each arcade level is built on the richer of its two challenges: more orders, more attacks.
  const levels = [];
  const problems = [];
  for (const level of (content && content.levels) || []) {
    const v = validation.challenges[level.id] || {};
    const tier = ['expert', 'standard'].find((t) => v[t] && v[t].status === 'ok');
    if (tier) levels.push({ level, challenge: level.challenges[tier] });
    else problems.push(...Object.values(v).flatMap((x) => x.errors || []));
  }
  if (loadError || !validation.ok || levels.length === 0) {
    showModal({
      title: 'THE GAME CONTENT COULD NOT BE READ', tone: 'bad',
      body: [el('ul', { class: 'modal-list' }, [loadError, ...validation.fileErrors, ...problems].filter(Boolean).map((m) => el('li', {}, m)))],
      actions: [{ label: 'RETRY', primary: true, onClick: () => window.location.reload() }],
    });
    return;
  }
  state.levels = levels;
  loadProgress();
  const firstOpen = levels.findIndex((entry) => !state.progress.stars[entry.level.id]);
  selectLevel(firstOpen === -1 ? 0 : firstOpen);
  showLevels();
  window.requestAnimationFrame(tick);
}

boot();
