// Firewall Security Faceoff, arcade edition.
//
// The whole screen is the playfield. Rule tiles are real buttons laid over a
// canvas, so they can be dragged with a pointer or moved with the keyboard.
// Packets are drawn on the canvas. Every verdict comes from engine/rules.js;
// nothing in this file decides whether traffic is allowed.

import { evaluateFlow, evaluateSubmission, evaluateRuleBase } from '../engine/rules.js';
import { validateContent } from '../engine/content.js';
import { explainVerdict } from '../engine/feedback.js';

const $ = (sel) => document.querySelector(sel);
const game = $('#game');
const stage = $('#stage');
const canvas = $('#field');
const ctx = canvas.getContext('2d');
const wallEl = $('#wall');
const trayEl = $('#tray');
const modal = $('#modal');
const bannerEl = $('#banner');
const liveEl = $('#live');
const logEl = $('#log');

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Timings, in seconds at 1x speed.
const T_APPROACH = 1.5;
const T_CHECK = 0.22;
const T_DECIDE = 0.28;
const T_TRAVEL = 0.9;
const T_FADE = 0.5;
const SPAWN_GAP = 0.85;
const CUSTOMERS_TO_OUTAGE = 3;

const COLOR = {
  bg: '#0b1020', grid: '#141b33', ground: '#1d2748', text: '#e8ecf4', dim: '#8a96b3',
  you: '#4fd1dc', rival: '#ff7fb1', good: '#5ee08a', bad: '#ff5d6c', warn: '#ffd166',
  brick: '#3b4670', mortar: '#232b4a', pit: '#101a3a', base: '#c9d3e6', stray: '#b9a6ff',
};
const FONT = 'bold 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_BIG = 'bold 15px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

const SPRITES = {
  attacker: ['.XXXXX.', 'XXXXXXX', 'X.XXX.X', 'XXXXXXX', '.XX.XX.', '.X.X.X.'],
  customer: ['XXXXXXX', 'X..X..X', 'XXXXXXX', 'X..X..X', 'X..X..X', 'XXXXXXX'],
  stray: ['.XXXXX.', 'XXXXXXX', 'XX.X.XX', 'XXXXXXX', 'XXXXXXX', 'X.X.X.X'],
  spark: ['X.X.X', '.XXX.', 'XXXXX', '.XXX.', 'X.X.X'],
};

const state = {
  phase: 'title', // title | build | wave | failing | modal
  content: null, level: null, challenge: null, outsideZone: null,
  wall: [],            // [{ ruleId, controls }]
  wave: 0, waves: [],
  packets: [], rivalPackets: [],
  clock: 0, speed: 1, sound: true,
  integrity: 1, uptime: 1, blocked: 0,
  score: 0, best: 0, awarded: new Set(), exposures: new Set(),
  rivalBreachedWave: null, launches: 0,
  effects: [], shake: 0,
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
  check: () => beep(540, 0.04, 'square', 0.018),
  deny: () => beep(190, 0.16, 'sawtooth'),
  pit: () => { beep(260, 0.09, 'triangle'); setTimeout(() => beep(150, 0.15, 'triangle'), 80); },
  open: () => beep(720, 0.07, 'square', 0.025),
  deliver: () => { beep(660, 0.07, 'triangle'); setTimeout(() => beep(880, 0.1, 'triangle'), 70); },
  breach: () => { beep(110, 0.4, 'sawtooth', 0.07); setTimeout(() => beep(65, 0.5, 'sawtooth', 0.07), 180); },
  expose: () => beep(330, 0.18, 'square', 0.03),
  place: () => beep(440, 0.05, 'square', 0.025),
  clear: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.14, 'square', 0.04), i * 110)),
  launch: () => { beep(200, 0.1, 'square'); setTimeout(() => beep(400, 0.16, 'square'), 90); },
};

// ---------- small helpers ----------

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

function announce(text) {
  liveEl.textContent = '';
  setTimeout(() => { liveEl.textContent = text; }, 30);
}

function logLine(text, kind = '') {
  logEl.append(el('li', { class: kind }, text));
  logEl.scrollTop = logEl.scrollHeight;
}

const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));
const ease = (t) => 1 - (1 - Math.max(0, Math.min(1, t))) ** 2;

function hostNames() {
  const map = {};
  for (const h of state.challenge.topology.hosts) map[h.address] = h.name;
  return map;
}

function serviceText(rule) {
  return rule.services ? rule.services.map((s) => `${s.protocol.toUpperCase()} ${s.port}`).join(' + ') : 'ANY PORT';
}

function flowTag(flow) {
  return `${flow.protocol.toUpperCase()} ${flow.port}`;
}

// ---------- waves ----------

// Wave k sends customers, every attack step up to k, and (from wave 2) the
// unrequested "stray" traffic. The last wave contains every flow in the level,
// so clearing it means exactly what the rule engine means by completing it.
function buildWaves(c) {
  const count = c.attackSteps.length;
  const waves = [];
  for (let k = 1; k <= count; k += 1) {
    const last = k === count;
    const seq = [];
    for (let i = 0; i < CUSTOMERS_TO_OUTAGE; i += 1) seq.push({ flow: c.requiredFlows[i % c.requiredFlows.length], kind: 'customer' });
    c.requiredFlows.slice(CUSTOMERS_TO_OUTAGE).forEach((flow) => seq.push({ flow, kind: 'customer' }));
    const strays = last ? c.probes : c.probes.slice(0, Math.max(0, k - 1));
    c.attackSteps.slice(0, k).forEach((flow, i) => {
      seq.push({ flow, kind: 'attacker' }, { flow, kind: 'attacker' });
      if (strays[i]) seq.push({ flow: strays[i], kind: 'stray' });
      seq.push({ flow: c.requiredFlows[i % c.requiredFlows.length], kind: 'customer' });
    });
    strays.slice(k).forEach((flow) => seq.push({ flow, kind: 'stray' }));
    waves.push({ number: k, sequence: seq, newAttack: c.attackSteps[k - 1] });
  }
  return waves;
}

// ---------- tiles ----------

function ruleSummary(rule) {
  const names = hostNames();
  const name = (addr) => (addr ? names[addr] || addr : 'ANY');
  const parts = [];
  if (rule.srcAddress) parts.push(`FROM ${name(rule.srcAddress)}`);
  parts.push(`TO ${name(rule.dstAddress)}`);
  if (rule.application) parts.push(rule.application.toUpperCase());
  else parts.push(serviceText(rule));
  if (rule.userGroup) parts.push(`GROUP ${rule.userGroup.toUpperCase()}`);
  return { zones: `${rule.fromZone} > ${rule.toZone}`.toUpperCase(), detail: parts.join(' · ') };
}

function tileEl(ruleId, inWall, index) {
  const rule = state.challenge.rules[ruleId];
  const sum = ruleSummary(rule);
  const where = inWall ? `Gate ${index + 1} of ${state.wall.length} on your wall.` : 'In the tray.';
  const how = inWall ? 'Arrow Up or Down moves it. Enter removes it.' : 'Enter adds it to the bottom of your wall.';
  const tile = el('button', {
    type: 'button', class: `tile tile-${rule.action}`, dataset: { rule: ruleId },
    'aria-label': `${ruleId}. ${rule.label}. ${where} ${how}`,
  },
    el('span', { class: 'tile-top' },
      inWall ? el('span', { class: 'tile-num' }, String(index + 1)) : null,
      el('span', { class: 'tile-id' }, ruleId),
      el('span', { class: 'tile-action' }, rule.action === 'allow' ? 'ALLOW' : 'DENY'),
      el('span', { class: 'tile-zones' }, sum.zones)),
    el('span', { class: 'tile-detail' }, sum.detail),
    rule.note ? el('span', { class: 'tile-note' }, `"${rule.note}"`) : null);
  return el('li', {}, tile);
}

function renderTiles(focusRule) {
  const c = state.challenge;
  const onWall = new Set(state.wall.map((e) => e.ruleId));
  wallEl.replaceChildren(...state.wall.map((e, i) => tileEl(e.ruleId, true, i)));
  if (state.wall.length === 0) {
    wallEl.append(el('li', { class: 'wall-empty' }, 'NO GATES. EVERYTHING FALLS TO THE IMPLICIT DENY. DROP RULE TILES HERE.'));
  }
  trayEl.replaceChildren(...Object.keys(c.rules).filter((id) => !onWall.has(id)).map((id) => tileEl(id, false, 0)));
  if (trayEl.children.length === 0) trayEl.append(el('li', { class: 'tray-empty' }, 'EVERY TILE IS ON YOUR WALL.'));
  const locked = state.phase !== 'build';
  for (const t of document.querySelectorAll('.tile')) t.disabled = locked;
  if (focusRule) {
    const target = document.querySelector(`.tile[data-rule="${focusRule}"]`);
    if (target) target.focus();
  }
  draw();
}

function wallIndex(ruleId) {
  return state.wall.findIndex((e) => e.ruleId === ruleId);
}

function addToWall(ruleId, at = state.wall.length) {
  if (wallIndex(ruleId) !== -1) return;
  const rule = state.challenge.rules[ruleId];
  state.wall.splice(at, 0, { ruleId, controls: { ...(rule.controls || {}) } });
  SFX.place();
  renderTiles(ruleId);
  announce(`${ruleId} placed as gate ${wallIndex(ruleId) + 1} of ${state.wall.length}.`);
}

function removeFromWall(ruleId) {
  const i = wallIndex(ruleId);
  if (i === -1) return;
  state.wall.splice(i, 1);
  SFX.place();
  renderTiles(ruleId);
  announce(`${ruleId} removed from your wall. ${state.wall.length} gate${state.wall.length === 1 ? '' : 's'} left.`);
}

function moveOnWall(ruleId, to) {
  const from = wallIndex(ruleId);
  if (from === -1) return;
  const target = Math.max(0, Math.min(state.wall.length - 1, to));
  if (target === from) return;
  const [entry] = state.wall.splice(from, 1);
  state.wall.splice(target, 0, entry);
  SFX.place();
  renderTiles(ruleId);
  announce(`${ruleId} is now gate ${target + 1} of ${state.wall.length}.`);
}

// Keyboard: the equivalent of every drag.
document.addEventListener('keydown', (event) => {
  const tile = event.target.closest && event.target.closest('.tile');
  if (!tile || state.phase !== 'build') return;
  const id = tile.dataset.rule;
  const i = wallIndex(id);
  const key = event.key;
  if (i === -1) {
    if (key === 'Enter' || key === ' ') { event.preventDefault(); addToWall(id); }
    return;
  }
  if (key === 'ArrowUp') { event.preventDefault(); moveOnWall(id, i - 1); }
  else if (key === 'ArrowDown') { event.preventDefault(); moveOnWall(id, i + 1); }
  else if (key === 'Enter' || key === ' ' || key === 'Delete' || key === 'Backspace') { event.preventDefault(); removeFromWall(id); }
});

// Pointer: drag a tile between the tray and the wall, or within the wall.
let drag = null;

function dropIndexAt(y) {
  const tiles = [...wallEl.querySelectorAll('.tile')].filter((t) => !drag || t !== drag.tile);
  for (let i = 0; i < tiles.length; i += 1) {
    const r = tiles[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return tiles.length;
}

function overWall(x, y) {
  const r = $('#wall-zone').getBoundingClientRect();
  return x > r.left - 50 && x < r.right + 50 && y > r.top - 30 && y < r.bottom + 60;
}

document.addEventListener('pointerdown', (event) => {
  const tile = event.target.closest('.tile');
  if (!tile || tile.disabled || state.phase !== 'build' || event.button !== 0) return;
  drag = { tile, id: tile.dataset.rule, x: event.clientX, y: event.clientY, moved: false };
});

document.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.moved && Math.hypot(dx, dy) < 6) return;
  drag.moved = true;
  drag.tile.classList.add('dragging');
  drag.tile.style.transform = `translate(${dx}px, ${dy}px) rotate(-2deg)`;
  const hot = overWall(event.clientX, event.clientY);
  $('#wall-zone').classList.toggle('drop-hot', hot);
  for (const t of wallEl.querySelectorAll('.tile')) t.classList.remove('drop-before');
  wallEl.classList.remove('drop-end');
  if (hot) {
    const idx = dropIndexAt(event.clientY);
    const others = [...wallEl.querySelectorAll('.tile')].filter((t) => t !== drag.tile);
    if (others[idx]) others[idx].classList.add('drop-before');
    else wallEl.classList.add('drop-end');
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
    // A plain click on a tray tile adds it; on a wall tile it just focuses.
    if (wallIndex(d.id) === -1 && event.type === 'pointerup') addToWall(d.id);
    return;
  }
  if (event.type === 'pointerup' && overWall(event.clientX, event.clientY)) {
    drag = { tile: d.tile };
    const idx = dropIndexAt(event.clientY);
    drag = null;
    const from = wallIndex(d.id);
    if (from === -1) addToWall(d.id, idx);
    else moveOnWall(d.id, idx);
  } else if (wallIndex(d.id) !== -1) {
    removeFromWall(d.id);
  } else {
    renderTiles();
  }
}
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// ---------- geometry ----------

function insideHosts() {
  return state.challenge.topology.hosts.filter((h) => h.zone !== state.outsideZone);
}

function playerGeom() {
  const sr = stage.getBoundingClientRect();
  const wr = wallEl.getBoundingClientRect();
  const gateYs = [...wallEl.querySelectorAll('.tile')].map((t) => {
    const b = t.getBoundingClientRect();
    return b.top - sr.top + b.height / 2;
  });
  const wallLeft = wr.left - sr.left;
  const wallRight = wr.right - sr.left;
  const hosts = {};
  const list = insideHosts();
  list.forEach((h, i) => {
    hosts[h.address] = {
      name: h.name, address: h.address,
      x: Math.min(sr.width - 60, wallRight + (sr.width - wallRight) * 0.62),
      y: sr.height * (list.length === 1 ? 0.45 : 0.28 + (0.42 * i) / (list.length - 1)),
    };
  });
  return {
    w: sr.width, h: sr.height, wallLeft, wallRight, wallTop: wr.top - sr.top, gateYs,
    ground: sr.height - 24, hosts, px: 4, x0: 0, portalX: 34,
    laneY: (i) => sr.height * (0.2 + (((i * 37) % 100) / 100) * 0.45),
  };
}

function rivalGeom(base) {
  const w = Math.min(300, base.w * 0.3);
  const h = 150;
  const x0 = 12;
  const y0 = base.h - h - 34;
  const n = state.challenge.rival.ruleBase.length;
  const gateYs = [];
  for (let i = 0; i < n; i += 1) gateYs.push(y0 + 40 + i * 18);
  const hosts = {};
  insideHosts().forEach((hst, i, list) => {
    hosts[hst.address] = { name: hst.name, address: hst.address, x: x0 + w - 26, y: y0 + 52 + (list.length === 1 ? 20 : (60 * i) / (list.length - 1)) };
  });
  return {
    inset: { x: x0, y: y0, w, h }, w: x0 + w, h: base.h,
    wallLeft: x0 + w * 0.5 - 10, wallRight: x0 + w * 0.5 + 10, wallTop: y0 + 28, gateYs,
    ground: y0 + h - 14, hosts, px: 2, x0, portalX: x0 + 12,
    laneY: (i) => y0 + 44 + ((i * 37) % 60),
  };
}

// ---------- packets ----------

function makePacket(item, index, ruleBase) {
  const flow = item.flow;
  return {
    flow, kind: item.kind, index,
    verdict: evaluateFlow(ruleBase, state.challenge.rules, flow),
    outbound: flow.fromZone !== state.outsideZone,
    spawn: index * SPAWN_GAP,
    decided: false, arrived: false, done: false, lastCheck: -1,
  };
}

function timing(p, gateCount) {
  const m = p.verdict.matchedIndex;
  const checks = m === null ? gateCount : m;
  const tDecide = p.spawn + T_APPROACH + checks * T_CHECK;
  const allowed = p.verdict.verdict === 'allowed';
  const passes = m !== null; // an allow rule matched (it may still be stopped by a control)
  const through = passes && p.verdict.verdict !== 'denied-by-rule';
  return { checks, tDecide, allowed, through, tEnd: tDecide + T_DECIDE + (through ? T_TRAVEL : 0) + T_FADE };
}

// Where a packet is at time t for a given geometry.
function packetPos(p, g, t) {
  const n = g.gateYs.length;
  const tm = timing(p, n);
  const faceX = p.outbound ? g.wallRight + 20 : g.wallLeft - 20;
  const farX = p.outbound ? g.wallLeft - 20 : g.wallRight + 20;
  const host = g.hosts[p.outbound ? p.flow.srcAddress : p.flow.dstAddress] || Object.values(g.hosts)[0];
  const lane = g.laneY(p.index);
  const start = p.outbound ? { x: host.x - 22, y: host.y } : { x: g.portalX, y: lane };
  const goal = p.outbound ? { x: g.x0 - 30, y: lane } : { x: host.x - 22, y: host.y };
  const topY = n > 0 ? g.gateYs[0] : g.wallTop + 16;
  const local = t - p.spawn;
  if (local < 0) return null;

  if (local < T_APPROACH) {
    const k = ease(local / T_APPROACH);
    return { x: lerp(start.x, faceX, k), y: lerp(start.y, topY, k), alpha: 1 };
  }
  const afterApproach = local - T_APPROACH;
  if (afterApproach < tm.checks * T_CHECK) {
    const k = Math.floor(afterApproach / T_CHECK);
    const into = (afterApproach - k * T_CHECK) / T_CHECK;
    const here = g.gateYs[k];
    const next = k + 1 < n ? g.gateYs[k + 1] : g.ground - 4;
    return { x: faceX, y: lerp(here, next, (into - 0.55) / 0.45), alpha: 1, checking: k };
  }
  const d = t - tm.tDecide;
  const m = p.verdict.matchedIndex;
  if (m === null) {
    const k = d / (T_DECIDE + T_FADE);
    return { x: lerp(faceX, faceX + (p.outbound ? 14 : -14), k), y: lerp(n > 0 ? g.gateYs[n - 1] : topY, g.ground + 6, ease(k)), alpha: 1 - Math.max(0, k - 0.6) / 0.4 };
  }
  const gy = g.gateYs[m];
  if (!tm.through) {
    const k = d / (T_DECIDE + T_FADE);
    const back = Math.sin(Math.min(1, k) * Math.PI * 0.5) * 46;
    return { x: faceX + (p.outbound ? back : -back), y: gy - Math.sin(Math.min(1, k) * Math.PI) * 16, alpha: 1 - k };
  }
  if (d < T_DECIDE) return { x: lerp(faceX, farX, d / T_DECIDE), y: gy, alpha: 1 };
  const k = (d - T_DECIDE) / T_TRAVEL;
  const stopped = p.verdict.verdict === 'stopped-by-control';
  const end = stopped ? { x: lerp(farX, goal.x, 0.45), y: lerp(gy, goal.y, 0.45) } : goal;
  if (k < 1) return { x: lerp(farX, end.x, ease(k)), y: lerp(gy, end.y, ease(k)), alpha: 1 };
  return { x: end.x, y: end.y, alpha: Math.max(0, 1 - (k - 1) * (T_TRAVEL / T_FADE)), atGoal: true };
}

// ---------- outcomes (state changes happen only here) ----------

function ruleName(index) {
  const entry = state.wall[index];
  return entry ? `rule ${index + 1} (${entry.ruleId})` : 'no rule';
}

function callout(g, text, color, x, y) {
  state.effects.push({ type: 'text', text, color, x, y, born: state.clock, life: 1.3 });
}

function burst(x, y, color) {
  state.effects.push({ type: 'burst', color, x, y, born: state.clock, life: 0.45 });
}

function flashGate(index, cls) {
  const tile = wallEl.querySelectorAll('.tile')[index];
  if (!tile || reducedMotion()) return;
  tile.classList.remove('gate-nomatch', 'gate-allow', 'gate-deny');
  void tile.offsetWidth; // restart the animation
  tile.classList.add(cls);
}

function onDecision(p, pos, silent) {
  const v = p.verdict;
  const m = v.matchedIndex;
  const tag = flowTag(p.flow);
  if (!silent) {
    if (m === null) { callout(null, 'NO MATCH · IMPLICIT DENY', p.kind === 'customer' ? COLOR.bad : COLOR.good, pos.x, pos.y); SFX.pit(); }
    else if (v.verdict === 'denied-by-rule') { flashGate(m, 'gate-deny'); burst(pos.x, pos.y, COLOR.warn); callout(null, `DENIED · GATE ${m + 1}`, p.kind === 'customer' ? COLOR.bad : COLOR.good, pos.x, pos.y); SFX.deny(); }
    else { flashGate(m, 'gate-allow'); SFX.open(); }
  }
  if (v.verdict === 'allowed' || (m !== null && v.verdict === 'stopped-by-control')) return; // settled on arrival

  if (p.kind === 'customer') {
    state.blocked += 1;
    state.uptime = Math.max(0, 1 - state.blocked / CUSTOMERS_TO_OUTAGE);
    logLine(`Customer ${tag} BLOCKED: ${m === null ? 'no rule allows it (implicit deny)' : `${ruleName(m)} denies it`}.`, 'bad');
    if (state.blocked >= CUSTOMERS_TO_OUTAGE) fail('outage', p);
  } else if (p.kind === 'attacker') {
    award(p, 10, pos, silent);
    logLine(`Attack "${p.flow.label}" ${tag} stopped: ${m === null ? 'no match, implicit deny' : `denied by ${ruleName(m)}`}.`, 'good');
  } else {
    award(p, 5, pos, silent);
    logLine(`Unrequested traffic ${tag} denied: ${m === null ? 'implicit deny' : ruleName(m)}.`, 'good');
  }
}

function award(p, points, pos, silent) {
  if (state.awarded.has(p.flow.id)) return;
  state.awarded.add(p.flow.id);
  state.score += points;
  if (!silent) callout(null, `+${points}`, COLOR.warn, pos.x, pos.y - 22);
}

function onArrival(p, pos, silent) {
  const v = p.verdict;
  const m = v.matchedIndex;
  const tag = flowTag(p.flow);
  if (v.verdict === 'stopped-by-control') {
    if (!silent) { burst(pos.x, pos.y, COLOR.warn); callout(null, 'STOPPED BY INSPECTION', COLOR.good, pos.x, pos.y); SFX.deny(); }
    if (p.kind === 'attacker') award(p, 10, pos, silent);
    else if (p.kind === 'stray') award(p, 5, pos, silent);
    logLine(`"${p.flow.label}" ${tag} allowed by ${ruleName(m)} then stopped by a security control.`, 'good');
    return;
  }
  if (p.kind === 'customer') {
    if (!silent) { callout(null, 'DELIVERED', COLOR.good, pos.x, pos.y - 14); SFX.deliver(); }
    logLine(`Customer ${tag} delivered through ${ruleName(m)}.`, 'good');
  } else if (p.kind === 'attacker') {
    state.integrity = 0;
    logLine(`BREACH: "${p.flow.label}" ${tag} got through ${ruleName(m)}.`, 'bad');
    fail('breach', p);
  } else {
    state.exposures.add(p.flow.id);
    if (!silent) { callout(null, 'EXPOSED · NOT REQUESTED', COLOR.warn, pos.x, pos.y - 14); SFX.expose(); }
    logLine(`Exposure: unrequested traffic ${tag} got through ${ruleName(m)}.`, 'warn');
  }
}

// ---------- phases ----------

function setPhase(phase) {
  state.phase = phase;
  game.className = `phase-${phase}`;
  const waving = phase === 'wave' || phase === 'failing';
  $('#btn-launch').hidden = waving;
  $('#btn-skip').hidden = !waving;
  $('#btn-speed').hidden = !waving;
  for (const t of document.querySelectorAll('.tile')) t.disabled = phase !== 'build';
  updateHud();
}

function updateHud() {
  const c = state.challenge;
  if (!c) return;
  $('#hud-level').textContent = `LEVEL 1 · WAVE ${Math.min(state.wave + 1, state.waves.length)}/${state.waves.length}`;
  const bar = (id, value, text) => {
    const node = $(id);
    node.querySelector('.hud-bar-fill').style.width = `${Math.round(value * 100)}%`;
    node.querySelector('.hud-bar-text').textContent = text;
    node.classList.toggle('is-low', value < 0.5);
  };
  bar('#bar-integrity', state.integrity, state.integrity > 0 ? 'SAFE' : 'BREACHED');
  bar('#bar-uptime', state.uptime, `${Math.round(state.uptime * 100)}%`);
  $('#hud-score').textContent = `SCORE ${state.score}${state.best ? ` · BEST ${state.best}` : ''}`;
  const rival = $('#hud-rival');
  rival.textContent = state.rivalBreachedWave ? `RIVAL: BREACHED IN WAVE ${state.rivalBreachedWave}` : 'RIVAL: HOLDING';
  rival.classList.toggle('is-down', Boolean(state.rivalBreachedWave));
  $('#btn-launch').textContent = `LAUNCH WAVE ${Math.min(state.wave + 1, state.waves.length)}`;
}

function banner(text, tone) {
  bannerEl.textContent = text;
  bannerEl.className = `show ${tone || ''}`;
  setTimeout(() => { bannerEl.className = ''; }, 1500);
}

// While a dialog is open nothing behind it can be focused or clicked.
function setBackgroundInert(on) {
  for (const id of ['#hud', '#stage', '#tray-zone', '#log-panel']) $(id).inert = on;
}

function showModal({ title, body, actions, tone }) {
  $('#modal-title').textContent = title;
  $('#modal-body').replaceChildren(...body);
  const buttons = actions.map((a) => {
    const b = a.href
      ? el('a', { class: a.primary ? 'big-btn' : 'small-btn', href: a.href }, a.label)
      : el('button', { type: 'button', class: a.primary ? 'big-btn' : 'small-btn' }, a.label);
    if (a.onClick) b.addEventListener('click', () => { modal.hidden = true; setBackgroundInert(false); a.onClick(); });
    return b;
  });
  $('#modal-actions').replaceChildren(...buttons);
  modal.className = tone || '';
  modal.hidden = false;
  setBackgroundInert(true);
  (buttons.find((b) => b.classList.contains('big-btn')) || buttons[0]).focus();
}

function startLevel() {
  const c = state.challenge;
  state.wall = c.startingRuleBase.map((ruleId) => ({ ruleId, controls: { ...(c.rules[ruleId].controls || {}) } }));
  state.wave = 0;
  state.score = 0;
  state.awarded = new Set();
  state.exposures = new Set();
  state.rivalBreachedWave = null;
  state.launches = 0;
  resetBars();
  logEl.replaceChildren();
  setPhase('build');
  renderTiles();
  showBriefing();
}

function resetBars() {
  state.integrity = 1; state.uptime = 1; state.blocked = 0;
  state.packets = []; state.rivalPackets = []; state.effects = []; state.clock = 0;
  state.breachedAddress = null; state.shake = 0;
}

function showBriefing() {
  const c = state.challenge;
  showModal({
    title: `LEVEL 1 · ${state.level.title.toUpperCase()}`,
    body: [
      el('p', { class: 'modal-mission' }, c.request),
      el('ul', { class: 'modal-list' },
        el('li', {}, el('strong', {}, 'Each rule is a gate. '), 'Drag rule tiles onto your wall. Every packet is checked from the top gate down.'),
        el('li', {}, el('strong', {}, 'The first gate that matches decides. '), 'It lets the packet through or bounces it. Gates below it are never reached.'),
        el('li', {}, el('strong', {}, 'No match means no entry. '), 'A packet that matches no gate drops into the implicit deny.'),
        el('li', {}, el('strong', {}, 'Keep customers flowing, keep attackers out. '), `Block ${CUSTOMERS_TO_OUTAGE} customers and you have an outage. Let one attacker reach a server and you are breached.`)),
      el('p', { class: 'modal-small' }, `${state.waves.length} waves. The rival's firewall faces the same waves in the corner. No time limit while you build, and retries are free.`),
    ],
    actions: [{ label: 'BUILD YOUR WALL', primary: true, onClick: () => { const first = trayEl.querySelector('.tile'); if (first) first.focus(); } }],
  });
}

function startWave() {
  if (state.phase !== 'build') return;
  const wave = state.waves[state.wave];
  resetBars();
  state.launches += 1;
  state.packets = wave.sequence.map((item, i) => makePacket(item, i, state.wall));
  state.rivalPackets = wave.sequence.map((item, i) => makePacket(item, i, state.challenge.rival.ruleBase));
  logLine(`— Wave ${wave.number} launched with ${state.wall.length} gate${state.wall.length === 1 ? '' : 's'}: ${state.wall.map((e) => e.ruleId).join(', ') || 'none'} —`, 'head');
  setPhase('wave');
  banner(`WAVE ${wave.number}`, 'neutral');
  announce(`Wave ${wave.number} launched. ${wave.sequence.length} packets incoming.`);
  SFX.launch();
  if (reducedMotion()) resolveInstantly();
}

// Applies every remaining outcome at once, in order. Used by Skip and when
// reduced motion is requested, so results never wait on animation.
function resolveInstantly() {
  if (state.phase !== 'wave') return;
  const g = playerGeom();
  for (const p of state.packets) {
    if (state.phase !== 'wave') break;
    const pos = { x: g.w / 2, y: g.h / 2 };
    if (!p.decided) { p.decided = true; onDecision(p, pos, true); }
    if (state.phase !== 'wave') break;
    if (!p.arrived && timing(p, g.gateYs.length).through) { p.arrived = true; onArrival(p, pos, true); }
    p.done = true;
  }
  for (const p of state.rivalPackets) { p.done = true; if (p.kind === 'attacker' && p.verdict.verdict === 'allowed') rivalBreached(); }
  state.effects = [];
  if (state.phase === 'wave') waveCleared();
  draw();
}

function rivalBreached() {
  if (state.rivalBreachedWave) return;
  state.rivalBreachedWave = state.waves[state.wave].number;
  logLine(`The rival's firewall was breached in wave ${state.rivalBreachedWave}.`, 'head');
  updateHud();
}

function fail(type, packet) {
  if (state.phase !== 'wave') return;
  setPhase('failing');
  state.shake = 0.6;
  if (type === 'breach') SFX.breach(); else SFX.deny();
  banner(type === 'breach' ? 'BREACHED!' : 'OUTAGE!', 'bad');
  const c = state.challenge;
  const why = explainVerdict(packet.verdict, { ruleBase: state.wall, rules: c.rules, flow: packet.flow });
  const m = packet.verdict.matchedIndex;
  const title = type === 'breach' ? 'BREACHED' : 'OUTAGE';
  const lead = type === 'breach'
    ? `"${packet.flow.label}" (${flowTag(packet.flow)}) reached your servers.`
    : `${CUSTOMERS_TO_OUTAGE} customers could not reach "${packet.flow.label}" (${flowTag(packet.flow)}). The business is down.`;
  const fix = type === 'breach'
    ? `Ask whether the mission needs ${ruleName(m)}. If not, pull it off the wall. If it does, use a narrower tile or put a deny above it.`
    : (m === null ? 'Add a gate that allows exactly what the mission asks for.' : `Gate ${m + 1} is checked before anything below it. Move the allow above it, or remove gate ${m + 1}.`);
  announce(`${title}. ${lead} ${why}`);
  const open = () => showModal({
    title, tone: 'bad',
    body: [
      el('p', { class: 'modal-lead' }, lead),
      el('p', {}, why),
      type === 'breach' && packet.flow.lesson ? el('p', {}, packet.flow.lesson) : null,
      el('p', { class: 'modal-fix' }, fix),
      el('p', { class: 'modal-small' }, 'Nothing is lost. Fix your wall and launch the same wave again.'),
    ],
    actions: [{ label: 'BACK TO THE WALL', primary: true, onClick: () => { resetBars(); setPhase('build'); renderTiles(); const t = wallEl.querySelector('.tile') || trayEl.querySelector('.tile'); if (t) t.focus(); } }],
  });
  if (reducedMotion()) open(); else setTimeout(open, 1100);
}

function waveCleared() {
  const wave = state.waves[state.wave];
  SFX.clear();
  if (state.wave === state.waves.length - 1) { victory(); return; }
  const next = state.waves[state.wave + 1];
  setPhase('modal');
  banner(`WAVE ${wave.number} CLEARED`, 'good');
  announce(`Wave ${wave.number} cleared.`);
  showModal({
    title: `WAVE ${wave.number} CLEARED`, tone: 'good',
    body: [
      el('p', { class: 'modal-lead' }, 'Every customer got through and no attacker reached a server.'),
      state.rivalBreachedWave === wave.number ? el('p', {}, `The rival was breached this wave. ${state.challenge.rival.note}`) : null,
      el('p', {}, el('strong', {}, `Wave ${next.number} adds: `), `${next.newAttack.label} (${flowTag(next.newAttack)}).`),
      el('p', { class: 'modal-small' }, 'Your wall stays as you built it. Change it if you think the new attack will get through.'),
    ],
    actions: [{ label: `PREPARE FOR WAVE ${next.number}`, primary: true, onClick: () => { state.wave += 1; resetBars(); setPhase('build'); renderTiles(); $('#btn-launch').focus(); } }],
  });
}

function victory() {
  const c = state.challenge;
  const result = evaluateSubmission(c, state.wall);
  const rival = evaluateRuleBase(c, c.rival.ruleBase);
  state.score = result.completed ? result.player.score : state.score;
  state.best = Math.max(state.best, state.score);
  setPhase('modal');
  banner('LEVEL CLEARED', 'good');
  const exposures = c.probes.filter((p) => result.exposures.includes(p.id));
  announce(`Level cleared. Score ${state.score}. Rival ${rival.score}.`);
  logLine(`— Level cleared. Score ${state.score}, rival ${rival.score}. —`, 'head');
  showModal({
    title: 'LEVEL CLEARED', tone: 'good',
    body: [
      el('div', { class: 'scoreline' },
        el('div', { class: 'score-you' }, el('span', {}, 'YOUR FIREWALL'), el('strong', {}, String(state.score))),
        el('div', { class: 'score-vs' }, 'VS'),
        el('div', { class: 'score-rival' }, el('span', {}, 'RIVAL'), el('strong', {}, String(rival.score)))),
      el('p', {}, `The rival fell at attack ${rival.breachStep}. ${c.rival.note}`),
      el('p', { class: 'modal-badge' }, 'CAPABILITY UNLOCKED: ', el('strong', {}, state.level.capability.toUpperCase())),
      exposures.length > 0
        ? el('div', {},
            el('p', { class: 'modal-lead warn' }, `${exposures.length} thing${exposures.length === 1 ? '' : 's'} got through that the mission never asked for:`),
            el('ul', { class: 'modal-list' }, exposures.map((p) => el('li', {}, el('strong', {}, `${p.label}. `), p.lesson || ''))))
        : el('p', { class: 'modal-lead' }, 'Perfect wall: nothing got through that the mission did not ask for.'),
      el('p', { class: 'modal-small' }, `Waves launched: ${state.launches}. Levels 2 and 3 are in the text edition while this edition is being built.`),
    ],
    actions: [
      exposures.length > 0 ? { label: 'HARDEN YOUR WALL', primary: true, onClick: () => { resetBars(); setPhase('build'); renderTiles(); } } : null,
      { label: 'PLAY AGAIN', primary: exposures.length === 0, onClick: startLevel },
      { label: 'TEXT EDITION: LEVELS 2 AND 3', href: 'classic.html' },
    ].filter(Boolean),
  });
}

// ---------- drawing ----------

function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function sprite(map, cx, cy, px, color, alpha = 1) {
  const w = map[0].length * px;
  const h = map.length * px;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  map.forEach((row, r) => {
    for (let c = 0; c < row.length; c += 1) {
      if (row[c] === 'X') ctx.fillRect(Math.round(cx - w / 2 + c * px), Math.round(cy - h / 2 + r * px), px, px);
    }
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

function drawHost(host, burning, small) {
  const s = small ? 0.55 : 1;
  const w = 44 * s;
  const h = 62 * s;
  rect(host.x - w / 2, host.y - h / 2, w, h, COLOR.mortar);
  for (let i = 0; i < 4; i += 1) {
    rect(host.x - w / 2 + 4 * s, host.y - h / 2 + (4 + i * 14) * s, w - 8 * s, 10 * s, burning ? COLOR.bad : COLOR.base);
    rect(host.x + w / 2 - 10 * s, host.y - h / 2 + (7 + i * 14) * s, 4 * s, 4 * s, burning ? COLOR.warn : COLOR.good);
  }
  if (burning) {
    const f = Math.floor(state.clock * 12);
    for (let i = 0; i < 5; i += 1) {
      const fh = (8 + ((f + i * 3) % 6) * 2) * s;
      rect(host.x - w / 2 + (4 + i * 8) * s, host.y - h / 2 - fh, 5 * s, fh, i % 2 === 0 ? COLOR.warn : COLOR.bad);
    }
  }
  if (!small) {
    text(host.name, host.x, host.y + h / 2 + 12, COLOR.text, FONT, 'center');
    text(host.address, host.x, host.y + h / 2 + 26, COLOR.dim, FONT, 'center');
  }
}

function packetColor(kind) {
  return kind === 'attacker' ? COLOR.bad : kind === 'customer' ? COLOR.good : COLOR.stray;
}

function drawPackets(list, g, labels) {
  for (const p of list) {
    if (p.done) continue;
    const pos = packetPos(p, g, state.clock);
    if (!pos || pos.alpha <= 0) continue;
    const bob = pos.checking === undefined && !pos.atGoal ? Math.sin(state.clock * 9 + p.index) * 2 : 0;
    sprite(SPRITES[p.kind], pos.x, pos.y + bob, g.px, packetColor(p.kind), pos.alpha);
    if (labels && pos.alpha > 0.5) text(flowTag(p.flow), pos.x, pos.y + bob - 22, packetColor(p.kind), FONT, 'center');
  }
}

function drawField() {
  const g = playerGeom();
  const dpr = window.devicePixelRatio || 1;
  if (canvas.width !== Math.round(g.w * dpr) || canvas.height !== Math.round(g.h * dpr)) {
    canvas.width = Math.round(g.w * dpr);
    canvas.height = Math.round(g.h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;

  const sx = state.shake > 0 ? Math.round(Math.sin(state.clock * 70) * 6 * state.shake) : 0;
  ctx.save();
  ctx.translate(sx, 0);

  rect(-10, 0, g.w + 20, g.h, COLOR.bg);
  ctx.fillStyle = COLOR.grid;
  for (let x = 0; x < g.w; x += 28) ctx.fillRect(x, 0, 1, g.h);
  for (let y = 0; y < g.h; y += 28) ctx.fillRect(0, y, g.w, 1);
  rect(-10, g.ground, g.w + 20, g.h - g.ground, COLOR.ground);

  const c = state.challenge;
  if (!c) { ctx.restore(); return; }

  // Zones.
  const insideZones = c.topology.zones.filter((z) => z !== state.outsideZone).join(' + ');
  text(state.outsideZone.toUpperCase(), 16, 58, COLOR.rival, FONT_BIG);
  text('ATTACKERS AND CUSTOMERS COME FROM HERE', 16, 76, COLOR.dim);
  text(insideZones.toUpperCase(), g.w - 16, 58, COLOR.you, FONT_BIG, 'right');
  text('WHAT YOU ARE PROTECTING', g.w - 16, 76, COLOR.dim, FONT, 'right');

  // Portal.
  const spin = Math.floor(state.clock * 8) % 4;
  for (let i = 0; i < 4; i += 1) rect(g.portalX - 14 + (i === spin ? 2 : 0), g.h * 0.2 + i * (g.h * 0.45 / 4), 8, g.h * 0.45 / 4 - 6, i === spin ? COLOR.rival : '#5a2440');

  // The wall behind the gate tiles, and the pit at its foot.
  bricks(g.wallLeft - 8, g.wallTop - 14, g.wallRight - g.wallLeft + 16, g.ground - g.wallTop + 14);
  rect(g.wallLeft - 96, g.ground, 86, 20, COLOR.pit);
  for (let i = 0; i < 7; i += 1) rect(g.wallLeft - 92 + i * 12, g.ground + 10, 7, 10, COLOR.bad);
  text('IMPLICIT DENY', g.wallLeft - 106, g.ground + 10, COLOR.dim, FONT, 'right');

  // Servers.
  for (const host of Object.values(g.hosts)) drawHost(host, state.integrity === 0 && state.breachedAddress === host.address, false);

  // Packets, with the gate each one is checking.
  for (const p of state.packets) {
    const pos = packetPos(p, g, state.clock);
    if (pos && pos.checking !== undefined && pos.checking !== p.lastCheck) {
      p.lastCheck = pos.checking;
      flashGate(pos.checking, 'gate-nomatch');
      SFX.check();
    }
  }
  drawPackets(state.packets, g, true);

  // Effects.
  for (const e of state.effects) {
    const age = (state.clock - e.born) / e.life;
    if (age >= 1) continue;
    if (e.type === 'text') {
      ctx.globalAlpha = 1 - age ** 2;
      text(e.text, e.x, e.y - 26 - age * 22, e.color, FONT_BIG, 'center');
      ctx.globalAlpha = 1;
    } else {
      sprite(SPRITES.spark, e.x, e.y, 3 + Math.floor(age * 4), e.color, 1 - age);
    }
  }
  state.effects = state.effects.filter((e) => state.clock - e.born < e.life);

  drawRival(g);
  ctx.restore();
}

function drawRival(base) {
  const r = rivalGeom(base);
  const b = r.inset;
  rect(b.x, b.y, b.w, b.h, '#05070f');
  ctx.strokeStyle = COLOR.rival; ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  text('RIVAL FIREWALL', b.x + 10, b.y + 14, COLOR.rival);
  text(state.rivalBreachedWave ? 'BREACHED' : 'HOLDING', b.x + b.w - 10, b.y + 14, state.rivalBreachedWave ? COLOR.bad : COLOR.text, FONT, 'right');
  bricks(r.wallLeft - 3, r.wallTop, r.wallRight - r.wallLeft + 6, r.ground - r.wallTop);
  state.challenge.rival.ruleBase.forEach((entry, i) => {
    const rule = state.challenge.rules[entry.ruleId];
    rect(r.wallLeft - 1, r.gateYs[i] - 7, r.wallRight - r.wallLeft + 2, 14, rule.action === 'allow' ? COLOR.good : COLOR.bad);
    text(entry.ruleId, r.wallRight + 8, r.gateYs[i], COLOR.dim);
  });
  rect(b.x + 2, r.ground, b.w - 4, b.y + b.h - r.ground - 2, COLOR.ground);
  for (const host of Object.values(r.hosts)) drawHost(host, Boolean(state.rivalBreachedWave), true);
  ctx.save();
  ctx.beginPath(); ctx.rect(b.x + 2, b.y + 22, b.w - 4, b.h - 24); ctx.clip();
  drawPackets(state.rivalPackets, r, false);
  ctx.restore();
}

function draw() {
  drawField();
}

// ---------- main loop ----------

let lastFrame = null;

function tick(now) {
  const dt = lastFrame === null ? 0 : Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;

  if (state.phase === 'wave' || state.phase === 'failing') {
    state.clock += dt * (state.phase === 'failing' ? 0.35 : state.speed);
    state.shake = Math.max(0, state.shake - dt);
  } else {
    state.clock += dt * 0.6; // idle animation only
  }

  if (state.phase === 'wave') {
    const g = playerGeom();
    const n = g.gateYs.length;
    for (const p of state.packets) {
      if (p.done || state.phase !== 'wave') continue;
      const tm = timing(p, n);
      if (!p.decided && state.clock >= tm.tDecide) {
        p.decided = true;
        onDecision(p, packetPos(p, g, tm.tDecide) || { x: g.wallLeft, y: g.wallTop }, false);
      }
      if (state.phase !== 'wave') break;
      if (tm.through && !p.arrived && state.clock >= tm.tDecide + T_DECIDE + T_TRAVEL) {
        p.arrived = true;
        const pos = packetPos(p, g, tm.tDecide + T_DECIDE + T_TRAVEL) || { x: g.w - 80, y: g.h / 2 };
        if (p.kind === 'attacker' && p.verdict.verdict === 'allowed') state.breachedAddress = p.flow.dstAddress;
        onArrival(p, pos, false);
      }
      if (state.clock >= tm.tEnd) p.done = true;
    }
    const rn = state.challenge.rival.ruleBase.length;
    for (const p of state.rivalPackets) {
      if (p.done) continue;
      const tm = timing(p, rn);
      if (p.kind === 'attacker' && p.verdict.verdict === 'allowed' && state.clock >= tm.tDecide + T_DECIDE + T_TRAVEL) rivalBreached();
      if (state.clock >= tm.tEnd) p.done = true;
    }
    updateHud();
    if (state.phase === 'wave' && state.packets.every((p) => p.done)) waveCleared();
  }

  draw();
  if (!reducedMotion()) window.requestAnimationFrame(tick);
}

// ---------- controls ----------

$('#btn-launch').addEventListener('click', startWave);
$('#btn-skip').addEventListener('click', resolveInstantly);
$('#btn-speed').addEventListener('click', () => {
  state.speed = state.speed === 1 ? 2 : state.speed === 2 ? 3 : 1;
  $('#btn-speed').textContent = `SPEED: ${state.speed}X`;
});
$('#btn-sound').addEventListener('click', () => {
  state.sound = !state.sound;
  $('#btn-sound').textContent = `SOUND: ${state.sound ? 'ON' : 'OFF'}`;
  $('#btn-sound').setAttribute('aria-pressed', String(state.sound));
});
$('#btn-log').addEventListener('click', () => {
  const panel = $('#log-panel');
  panel.hidden = !panel.hidden;
  $('#btn-log').setAttribute('aria-expanded', String(!panel.hidden));
});
$('#btn-help').addEventListener('click', () => { if (state.phase === 'build') showBriefing(); });
window.addEventListener('resize', draw);

// ---------- start ----------

function showTitle() {
  showModal({
    title: 'FIREWALL SECURITY FACEOFF',
    body: [
      el('p', { class: 'modal-tagline' }, 'Build a wall of firewall rules. Then watch it get attacked.'),
      el('ul', { class: 'modal-list' },
        el('li', {}, 'Drag rule tiles onto your wall. Each one is a gate.'),
        el('li', {}, 'Launch the wave. Customers must get in. Attackers must not.'),
        el('li', {}, 'A rival firewall faces the same wave. Outlast it.')),
      el('p', { class: 'modal-small' }, 'Vendor-neutral firewall rules. Plays with a mouse or the keyboard. A text edition with all levels and the Expert tier is linked below.'),
    ],
    actions: [
      { label: 'START', primary: true, onClick: startLevel },
      { label: 'TEXT EDITION', href: 'classic.html' },
    ],
  });
}

function showLoadError(messages) {
  showModal({
    title: 'THE GAME CONTENT COULD NOT BE READ', tone: 'bad',
    body: [el('p', {}, 'This is a problem with the level file, not with anything you did.'), el('ul', { class: 'modal-list' }, messages.map((m) => el('li', {}, m)))],
    actions: [{ label: 'RETRY', primary: true, onClick: () => window.location.reload() }],
  });
}

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
  const level = content && content.levels ? content.levels[0] : null;
  const status = level && validation.challenges[level.id] ? validation.challenges[level.id].standard : null;
  if (loadError || !validation.ok || !status || status.status !== 'ok') {
    showLoadError([loadError, ...validation.fileErrors, ...((status && status.errors) || [])].filter(Boolean));
    return;
  }
  state.content = content;
  state.level = level;
  state.challenge = level.challenges.standard;
  state.outsideZone = state.challenge.topology.zones[0];
  state.waves = buildWaves(state.challenge);
  $('#mission').textContent = `MISSION: ${state.challenge.request}`;
  renderTiles();
  updateHud();
  showTitle();
  if (reducedMotion()) draw(); else window.requestAnimationFrame(tick);
}

boot();
