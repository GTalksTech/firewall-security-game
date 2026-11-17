// The tower-defense playfield: a pixel-style canvas that shows a packet flying
// to each firewall and being checked gate by gate, top to bottom.
//
// It is presentation only. The whole result exists before anything is drawn,
// the same facts are written as text below the canvas, and nothing here can
// change a verdict. With reduced motion requested it draws the final frame.

const W = 960;
const H = 396;
const BAND = 44; // caption band along the bottom
const HALF = W / 2;

const C = {
  bg: '#0b1020', grid: '#141b33', ground: '#1d2748', text: '#e8ecf4', dim: '#8a96b3',
  you: '#4fd1dc', rival: '#ff7fb1', allow: '#5ee08a', deny: '#ff5d6c', warn: '#ffd166',
  brick: '#3b4670', mortar: '#232b4a', door: '#0b1020', pit: '#101a3a', attacker: '#ff5d6c',
  friend: '#5ee08a', base: '#c9d3e6', beam: '#ffd166',
};

const FONT = 'bold 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_BIG = 'bold 20px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const FONT_SMALL = 'bold 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

// Timings in seconds.
const T_FLY = 0.75;
const T_GATE = 0.3;
const T_DECIDE = 0.45;
const T_THROUGH = 0.65;
const T_HOLD = 0.6;

const SKULL = ['.XXXXX.', 'XXXXXXX', 'X.XXX.X', 'XXXXXXX', '.XX.XX.', '.X.X.X.'];
const PARCEL = ['XXXXXXX', 'X..X..X', 'XXXXXXX', 'X..X..X', 'X..X..X', 'XXXXXXX'];

const models = new WeakMap();
let running = null; // { raf, canvas }
let audio = null;

export function attachModel(canvas, model) {
  models.set(canvas, model);
}

// ---------- sound ----------

function beep(freq, duration, type = 'square', gain = 0.04) {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    amp.gain.setValueAtTime(gain, audio.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duration);
    osc.connect(amp).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + duration);
  } catch (err) {
    // Sound is optional. If audio is unavailable the game is unaffected.
  }
}

const SOUNDS = {
  check: () => beep(520, 0.05, 'square', 0.025),
  deny: () => { beep(180, 0.18, 'sawtooth'); },
  pit: () => { beep(240, 0.1, 'triangle'); window.setTimeout(() => beep(150, 0.16, 'triangle'), 90); },
  open: () => beep(700, 0.08, 'square', 0.03),
  zap: () => { beep(980, 0.07, 'square'); window.setTimeout(() => beep(1320, 0.1, 'square'), 70); },
  breach: () => { beep(110, 0.35, 'sawtooth', 0.06); window.setTimeout(() => beep(70, 0.4, 'sawtooth', 0.06), 160); },
};

// ---------- drawing helpers ----------

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function sprite(ctx, map, cx, cy, px, color) {
  const w = map[0].length * px;
  const h = map.length * px;
  ctx.fillStyle = color;
  map.forEach((row, r) => {
    for (let c = 0; c < row.length; c += 1) {
      if (row[c] === 'X') ctx.fillRect(Math.round(cx - w / 2 + c * px), Math.round(cy - h / 2 + r * px), px, px);
    }
  });
}

function label(ctx, text, x, y, color, font = FONT, align = 'left') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, Math.round(x), Math.round(y));
}

function bricks(ctx, x, y, w, h) {
  rect(ctx, x, y, w, h, C.brick);
  ctx.fillStyle = C.mortar;
  for (let row = 0; row * 12 < h; row += 1) {
    ctx.fillRect(x, y + row * 12, w, 2);
    for (let bx = row % 2 === 0 ? 12 : 0; bx < w; bx += 24) ctx.fillRect(x + bx, y + row * 12, 2, 12);
  }
}

const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

// ---------- geometry for one side ----------

function layout(side, ox, width) {
  const n = side.gates.length;
  const wallX = ox + Math.round(width * 0.5);
  const wallW = 46;
  const top = 64;
  const groundY = 312;
  const gateH = n > 0 ? Math.max(18, Math.min(34, Math.floor((groundY - top - 26) / n))) : 0;
  return {
    ox, width, wallX, wallW, top, groundY, gateH,
    gateY: (k) => top + k * gateH + gateH / 2,
    spawnX: ox + 26,
    faceX: wallX - 46,
    baseX: ox + width - 62,
    baseY: 190,
    scanX: wallX + wallW + Math.round((ox + width - 62 - wallX - wallW) / 2),
  };
}

// Where the packet is and what has happened at time t (seconds) for one side.
function simulate(side, L, t) {
  const n = side.gates.length;
  const m = side.verdict.matchedIndex;
  const checks = m === null ? n : m;
  const tChecks = T_FLY + checks * T_GATE;
  const s = {
    x: L.spawnX, y: n > 0 ? L.gateY(0) : L.top + 20, visible: true,
    checked: -1, decidedGate: null, doorOpen: false, event: null, done: false, events: [],
  };

  if (t < T_FLY) {
    s.x = lerp(L.spawnX, L.faceX, t / T_FLY);
    return s;
  }
  s.x = L.faceX;

  // Gates that do not match, one after another.
  const idx = Math.floor((t - T_FLY) / T_GATE);
  s.checked = Math.min(checks - 1, idx);
  for (let k = 0; k <= s.checked; k += 1) s.events.push(`check${k}`);
  if (t < tChecks) {
    const k = Math.min(checks - 1, idx);
    const into = (t - T_FLY - k * T_GATE) / T_GATE;
    const next = k + 1 < n ? L.gateY(k + 1) : L.groundY + 14;
    s.y = lerp(L.gateY(k), into > 0.6 ? next : L.gateY(k), (into - 0.6) / 0.4);
    return s;
  }

  const td = t - tChecks;

  if (m === null) {
    // Fell past every gate: the implicit deny.
    s.event = 'pit';
    s.events.push('pit');
    s.y = lerp(n > 0 ? L.gateY(n - 1) : L.top + 20, L.groundY + 14, td / T_DECIDE);
    s.x = lerp(L.faceX, L.wallX - 40, td / T_DECIDE);
    s.visible = td < T_DECIDE;
    s.done = td >= T_DECIDE + T_HOLD;
    return s;
  }

  s.decidedGate = m;
  s.y = L.gateY(m);
  const gate = side.gates[m];

  if (gate.action === 'deny') {
    s.event = 'denied';
    s.events.push('deny');
    s.x = L.faceX - Math.sin(Math.min(1, td / T_DECIDE) * Math.PI) * 14;
    s.visible = td < T_DECIDE;
    s.done = td >= T_DECIDE + T_HOLD;
    return s;
  }

  // Allow rule: the gate opens and the packet goes through.
  s.doorOpen = true;
  s.events.push('open');
  if (td < T_DECIDE) return s;
  const tt = (td - T_DECIDE) / T_THROUGH;
  const stopped = side.verdict.verdict === 'stopped-by-control';
  const endX = stopped ? L.scanX : L.baseX - 18;
  s.x = lerp(L.faceX, endX, tt);
  s.y = lerp(L.gateY(m), L.baseY, tt);
  if (tt >= 1) {
    s.event = stopped ? 'stopped' : 'breached';
    s.events.push(stopped ? 'zap' : 'breach');
    s.visible = !stopped && side.friendly ? true : false;
    if (side.friendly && !stopped) s.event = 'delivered';
    s.done = td >= T_DECIDE + T_THROUGH + T_HOLD;
  }
  return s;
}

function duration(side) {
  const m = side.verdict.matchedIndex;
  const checks = m === null ? side.gates.length : m;
  const base = T_FLY + checks * T_GATE + T_DECIDE + T_HOLD;
  if (m !== null && side.gates[m].action === 'allow') return base + T_THROUGH;
  return base;
}

// ---------- one side of the field ----------

function drawSide(ctx, side, ox, width, t, frame) {
  const L = layout(side, ox, width);
  const s = side.verdict ? simulate(side, L, t) : null;
  const color = side.who === 'rival' ? C.rival : C.you;
  const fallenNow = s && s.event === 'breached';
  const fallen = side.fallenBefore || fallenNow;

  // The implicit-deny pit in front of the wall.
  rect(ctx, L.wallX - 74, L.groundY, 70, 30, C.pit);
  for (let i = 0; i < 6; i += 1) rect(ctx, L.wallX - 70 + i * 11, L.groundY + 20, 6, 10, C.deny);
  label(ctx, 'IMPLICIT DENY', L.wallX - 84, L.groundY + 16, C.dim, FONT_SMALL, 'right');

  // Header: name, then status in words.
  label(ctx, side.name, ox + 14, 20, color, FONT);
  ctx.font = FONT;
  const nameW = ctx.measureText(side.name).width;
  const status = fallen ? 'BREACHED' : side.won ? 'SURVIVED' : 'HOLDING';
  label(ctx, status, ox + 26 + nameW, 20, fallen ? C.deny : side.won ? C.allow : C.text, FONT);
  rect(ctx, ox + 14, 34, width - 28, 2, color);

  // Zone labels.
  label(ctx, `FROM ${side.fromZone || 'OUTSIDE'}`, L.spawnX - 12, 50, C.dim, FONT_SMALL);
  label(ctx, side.toZone || 'PROTECTED', ox + width - 14, 20, C.dim, FONT_SMALL, 'right');

  // The wall: one gate per rule, checked from the top.
  const shake = fallenNow ? Math.round(Math.sin(frame * 1.7) * 2) : 0;
  bricks(ctx, L.wallX + shake, L.top - 8, L.wallW, L.groundY - L.top + 8);
  side.gates.forEach((gate, k) => {
    const y = L.gateY(k);
    const gy = y - L.gateH / 2 + 2;
    const gh = L.gateH - 4;
    const isDecider = s && s.decidedGate === k;
    const wasChecked = s && k <= s.checked;
    const open = isDecider && s.doorOpen;
    const doorColor = open ? C.door : gate.action === 'allow' ? C.allow : C.deny;
    rect(ctx, L.wallX + 6 + shake, gy, L.wallW - 12, gh, doorColor);
    if (!open) rect(ctx, L.wallX + 10 + shake, gy + 3, L.wallW - 20, Math.max(2, gh - 6), 'rgba(11,16,32,0.35)');
    if (isDecider) {
      ctx.strokeStyle = C.warn;
      ctx.lineWidth = 3;
      ctx.strokeRect(L.wallX + 4.5 + shake, gy - 1.5, L.wallW - 9, gh + 3);
    }
    label(ctx, `${k + 1}`, L.wallX - 6, y, wasChecked || isDecider ? C.warn : C.text, FONT, 'right');
    if (gh >= 14) label(ctx, gate.id, L.wallX + L.wallW / 2 + shake, y, open ? C.allow : C.bg, FONT_SMALL, 'center');
    if (wasChecked && !isDecider) label(ctx, 'no match', L.wallX + L.wallW + 8, y, C.dim, FONT_SMALL);
  });
  if (side.gates.length === 0) label(ctx, 'NO RULES', L.wallX + L.wallW / 2, L.top + 30, C.dim, FONT_SMALL, 'center');

  // The base being protected.
  const baseColor = fallen ? C.deny : C.base;
  rect(ctx, L.baseX, L.baseY - 34, 40, 68, C.mortar);
  for (let i = 0; i < 4; i += 1) {
    rect(ctx, L.baseX + 4, L.baseY - 30 + i * 16, 32, 12, baseColor);
    rect(ctx, L.baseX + 30, L.baseY - 27 + i * 16, 4, 4, fallen ? C.warn : C.allow);
  }
  if (fallen) {
    for (let i = 0; i < 5; i += 1) {
      const fx = L.baseX + 4 + i * 8;
      const fh = 8 + ((frame + i * 3) % 6) * 2;
      rect(ctx, fx, L.baseY - 36 - fh, 5, fh, i % 2 === 0 ? C.warn : C.deny);
    }
  }

  // Inspection scanner, shown when the deciding rule had a control stop the packet.
  if (s && s.event === 'stopped') {
    rect(ctx, L.scanX - 5, L.top, 10, L.groundY - L.top, C.mortar);
    rect(ctx, L.scanX - 9, L.top - 8, 18, 12, C.beam);
    if (frame % 4 < 3) rect(ctx, L.scanX - 2, L.top + 4, 4, L.baseY - L.top - 4, C.beam);
  }

  if (!s) return s;

  // The packet.
  const map = side.friendly ? PARCEL : SKULL;
  const pColor = side.friendly ? C.friend : C.attacker;
  if (s.visible) {
    const bob = s.x < L.faceX ? Math.round(Math.sin(frame * 0.6) * 2) : 0;
    sprite(ctx, map, s.x, s.y + bob, 3, pColor);
  }

  // What just happened, in big letters.
  const callX = ox + width / 2;
  const callY = H - BAND / 2;
  if (s.event === 'denied') {
    sprite(ctx, ['X.X.X', '.XXX.', 'XXXXX', '.XXX.', 'X.X.X'], L.faceX, s.y, 4, C.warn);
    // Denying an attack is good; denying a customer is an outage.
    label(ctx, side.friendly ? `CUSTOMER BLOCKED BY RULE ${s.decidedGate + 1}` : `DENIED BY RULE ${s.decidedGate + 1}`,
      callX, callY, side.friendly ? C.deny : C.allow, FONT_BIG, 'center');
  } else if (s.event === 'pit') {
    label(ctx, side.friendly ? 'CUSTOMER BLOCKED: NO RULE ALLOWS IT' : 'NO MATCH: IMPLICIT DENY',
      callX, callY, side.friendly ? C.deny : C.allow, FONT_BIG, 'center');
  } else if (s.event === 'stopped') {
    sprite(ctx, ['X.X.X', '.XXX.', 'XXXXX', '.XXX.', 'X.X.X'], L.scanX, L.baseY, 4, C.warn);
    label(ctx, `STOPPED BY ${side.controlName || 'A CONTROL'}`, callX, callY, C.allow, FONT_BIG, 'center');
  } else if (s.event === 'breached') {
    label(ctx, `BREACHED THROUGH RULE ${s.decidedGate + 1}`, callX, callY, C.deny, FONT_BIG, 'center');
  } else if (s.event === 'delivered') {
    label(ctx, `DELIVERED BY RULE ${s.decidedGate + 1}`, callX, callY, C.allow, FONT_BIG, 'center');
  } else if (side.fallenBefore) {
    label(ctx, 'ALREADY BREACHED', callX, callY, C.deny, FONT_BIG, 'center');
  }
  return s;
}

function drawFrame(ctx, model, t, frame) {
  rect(ctx, 0, 0, W, H, C.bg);
  ctx.fillStyle = C.grid;
  for (let x = 0; x < W; x += 24) ctx.fillRect(x, 40, 1, 272);
  for (let y = 40; y < 312; y += 24) ctx.fillRect(0, y, W, 1);
  rect(ctx, 0, 312, W, H - 312 - BAND, C.ground); // ground
  rect(ctx, 0, H - BAND, W, BAND, '#05070f');       // caption band

  const states = [];
  if (model.sides.length === 1) {
    states.push(drawSide(ctx, model.sides[0], 160, 640, t, frame));
  } else {
    states.push(drawSide(ctx, model.sides[0], 0, HALF, t, frame));
    states.push(drawSide(ctx, model.sides[1], HALF, HALF, t, frame));
    rect(ctx, HALF - 1, 0, 2, H, C.ground);
  }
  if (model.title) {
    ctx.font = FONT;
    const tw = ctx.measureText(model.title).width + 20;
    // Two walls: the badge sits on the ground between them. One wall: top right.
    const single = model.sides.length === 1;
    const tx = single ? W - 14 - tw : HALF - tw / 2;
    const ty = single ? 50 : 320;
    rect(ctx, tx, ty, tw, 22, C.bg);
    ctx.strokeStyle = C.warn; ctx.lineWidth = 1; ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, 21);
    label(ctx, model.title, tx + tw / 2, ty + 11, C.warn, FONT, 'center');
  }
  return states;
}

// ---------- running ----------

function stop() {
  if (running) {
    window.cancelAnimationFrame(running.raf);
    running = null;
  }
}

function play(canvas, model, opts) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const moving = model.sides.filter((s) => s.verdict);
  const total = moving.length > 0 ? Math.max(...moving.map(duration)) : 0;

  if (!opts.animate || reduced || total === 0) {
    drawFrame(ctx, model, total + 1, 0); // the final frame, at once
    return;
  }

  const fired = new Set();
  const start = performance.now();
  let frame = 0;
  const tick = (now) => {
    const t = (now - start) / 1000;
    frame += 1;
    const states = drawFrame(ctx, model, t, frame);
    if (opts.sound) {
      states.forEach((s, i) => {
        if (!s) return;
        for (const ev of s.events) {
          const key = `${i}:${ev}`;
          if (fired.has(key)) continue;
          fired.add(key);
          const name = ev.startsWith('check') ? 'check' : ev;
          if (i === 0 || name === 'breach') (SOUNDS[name] || (() => {}))();
        }
      });
    }
    if (t < total + 0.2) running = { raf: window.requestAnimationFrame(tick), canvas };
    else running = null;
  };
  running = { raf: window.requestAnimationFrame(tick), canvas };
}

// Draws every playfield canvas under root. Only the one flagged for animation
// moves; the rest show their final frame.
export function runPlayfields(root, opts = {}) {
  stop();
  for (const canvas of root.querySelectorAll('canvas[data-playfield]')) {
    const model = models.get(canvas);
    if (!model) continue;
    play(canvas, model, { animate: Boolean(opts.animate) && canvas.dataset.playfield === 'battle', sound: Boolean(opts.sound) });
  }
}

export const PLAYFIELD_SIZE = { width: W, height: H };
