// Firewall Security Faceoff, strategy edition.
//
// A turn-based hex-map game. Your firewall is a gatehouse; its rules are gates
// checked top to bottom. Each turn you change the gates, then end the turn and
// everything on the road moves one step. Every verdict comes from the rule
// engine (engine/rules.js); the turn rules live in turns.js.

import { evaluateFlow, evaluateSubmission } from '../engine/rules.js';
import { validateContent } from '../engine/content.js';
import {
  arcadeOf, insideHosts, isOutbound, nameOf, flowLabel, flowText, ruleParts, ruleText,
  leakHint, leakFix, starsFor, candidatesFor, CONTROL_SHORT, CONTROL_HELP,
} from '../game/logic.js';
import { RULES, newGame, spawnTurn, endTurn, forecast, activeRequests, traceFlow } from './turns.js';
import { createBoard, loadModels } from './board.js';
import { createMusic } from './music.js';
import { PIECE_FOR_LEVEL } from './score.js';

const $ = (sel) => document.querySelector(sel);
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (k === 'onclick') node.addEventListener('click', v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const ch of children.flat(Infinity)) {
    if (ch === null || ch === undefined || ch === false) continue;
    node.append(ch instanceof Node ? ch : document.createTextNode(String(ch)));
  }
  return node;
}

const state = {
  levels: [], index: 0, level: null, c: null, cfg: null, game: null,
  busy: false, stats: {}, selected: null, log: [], undo: [],
  guide: { on: false, i: 0, shown: false },
  progress: { stars: {}, best: {} }, sound: true, board: null,
};

// ---------- sound ----------
let audio = null;
function beep(freq, dur, type = 'triangle', gain = 0.04) {
  if (!state.sound) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + dur);
    o.connect(g).connect(audio.destination);
    o.start(); o.stop(audio.currentTime + dur);
  } catch (err) { /* sound is optional */ }
}
const SFX = {
  click: () => beep(520, 0.05, 'square', 0.02),
  good: () => beep(660, 0.1),
  stop: () => beep(330, 0.1, 'square', 0.03),
  bad: () => { beep(140, 0.3, 'sawtooth', 0.06); },
  turn: () => { beep(392, 0.08); setTimeout(() => beep(523, 0.12), 90); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => beep(f, 0.18), i * 120)),
  lose: () => [330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.25, 'sawtooth', 0.05), i * 170)),
};

// ---------- music ----------
// Starts on the first click or key press, because browsers do not let a page make sound before that.
let music = null;
const MUSIC_STORE = 'firewall-faceoff-music';
function musicWanted() { try { return window.localStorage.getItem(MUSIC_STORE) !== 'off'; } catch (err) { return true; } }
function startMusic() {
  if (!musicWanted() || (music && music.playing())) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    if (!music) music = createMusic(audio);
    music.start();
    setMusicMood();
  } catch (err) { /* music is optional */ }
}
function setMusicWanted(on) {
  try { window.localStorage.setItem(MUSIC_STORE, on ? 'on' : 'off'); } catch (err) { /* optional */ }
  if (on) startMusic(); else if (music) music.stop();
}
// Calm while everything is handled, tense while something bad is on its way, quieter on the menus.
function setMusicMood() {
  if (!music || music.mood() === 'sting') return;
  if (state.level) music.setPiece(PIECE_FOR_LEVEL[state.index % PIECE_FOR_LEVEL.length]);
  if (!$('#screen').hidden || !state.game) { music.setMood('menu'); return; }
  const alarm = state.game.units.some((u) => { const f = fc(u); return f.outcome === 'breach' || f.outcome === 'turned-away'; });
  music.setMood(alarm ? 'tense' : 'calm');
}
for (const type of ['pointerdown', 'keydown']) window.addEventListener(type, startMusic, { passive: true });

// ---------- small helpers ----------
function announce(text) { const n = $('#live'); n.textContent = ''; setTimeout(() => { n.textContent = text; }, 30); }
let toastTimer = null;
function toast(text) {
  const n = $('#toast');
  n.textContent = text;
  n.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => n.classList.remove('show'), 2600);
}
const STORE = 'firewall-faceoff-strategy-v1';
function loadProgress() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORE) || 'null');
    if (saved && saved.stars && saved.best) state.progress = saved;
  } catch (err) { /* progress is optional */ }
}
function saveProgress() { try { window.localStorage.setItem(STORE, JSON.stringify(state.progress)); } catch (err) { /* optional */ } }
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const turnsWord = (n) => (n === 1 ? 'this turn' : `in ${n} turns`);
const KIND_WORD = { wanted: 'Wanted traffic', attack: 'Attack', unneeded: 'Unneeded traffic' };
const KIND_SHAPE = { wanted: '■', attack: '▲', unneeded: '●' };

// What a unit is, in a few words: "443 → WEB-1".
function unitTitle(u) {
  const { c } = state;
  const l = flowLabel(c, u.flow);
  const dest = isOutbound(c, u.flow) ? 'OUT' : nameOf(c, u.flow.dstAddress);
  return `${l.main.replace(/ OUT$/, '')}${l.payload ? ` +${l.payload}` : ''} → ${dest}`;
}
const unitWho = (u) => flowLabel(state.c, u.flow).who;
const unitName = (u) => [unitWho(u), unitTitle(u)].filter(Boolean).join(' ');
const fc = (u) => forecast(state.c, state.game.wall, u, evaluateFlow);

// ---------- gates ----------
function gateText(rule) {
  const p = ruleParts(state.c, rule);
  const what = p.kind === 'app' ? `app ${p.what}` : p.kind === 'port' ? `port ${p.what}` : 'anything';
  const where = p.where === 'ANY' ? 'anywhere' : p.where === 'OUT' ? 'going out' : p.where;
  return [
    el('span', { class: 'verb' }, rule.action === 'allow' ? 'ALLOW' : 'BLOCK'), ' ',
    p.who ? [el('span', { class: 'who' }, p.who), ' '] : null,
    el('span', { class: 'what' }, what), ' → ', el('span', { class: 'where' }, where),
  ];
}
// The same words a gate shows in the side panel, as plain text.
function gatePlain(rule) {
  const p = ruleParts(state.c, rule);
  const what = p.kind === 'app' ? `app ${p.what}` : p.kind === 'port' ? `port ${p.what}` : 'anything';
  const where = p.where === 'ANY' ? 'anywhere' : p.where === 'OUT' ? 'going out' : p.where;
  return `${rule.action === 'allow' ? 'ALLOW' : 'BLOCK'} ${p.who ? `${p.who} ` : ''}${what} → ${where}`;
}
const wallIndex = (ruleId) => state.game.wall.findIndex((e) => e.ruleId === ruleId);
const canAct = () => state.game && !state.game.over && !state.busy;

function spend(what) {
  if (!canAct()) return false;
  if (state.game.actions <= 0) {
    toast('No changes left this turn. Press End turn.');
    announce('No changes left this turn. Press End turn.');
    return false;
  }
  state.undo.push({ wall: state.game.wall.map((e) => ({ ruleId: e.ruleId, controls: { ...e.controls } })), stats: JSON.stringify(state.stats) });
  state.before = new Map(state.game.units.map((u) => [u.id, fc(u).text]));
  state.game.actions -= 1;
  SFX.click();
  announce(`${what} ${state.game.actions} changes left this turn.`);
  return true;
}
// Says what a change did to the units on the road.
function reportChange() {
  if (!state.before) return;
  const changed = state.game.units.filter((u) => state.before.get(u.id) !== fc(u).text);
  state.before = null;
  if (changed.length === 0) { toast('No change to anything on the road.'); return; }
  const first = changed[0];
  const f = fc(first);
  toast(`${unitName(first)}: now ${f.text}${changed.length > 1 ? `, and ${changed.length - 1} more changed` : ''}`);
  announce(changed.map((u) => `${unitName(u)} now ${fc(u).text}.`).join(' '));
}
function undoChange() {
  if (!canAct() || state.undo.length === 0) return;
  const last = state.undo.pop();
  state.game.wall = last.wall;
  state.stats = JSON.parse(last.stats);
  state.game.actions += 1;
  SFX.click();
  announce('Change undone.');
  render({ focus: '#undo, #end-turn' });
}
function addGate(ruleId) {
  if (wallIndex(ruleId) !== -1) return;
  const rule = state.c.rules[ruleId];
  if (!spend(`${ruleText(state.c, rule)} added as the last gate.`)) return;
  state.game.wall.push({ ruleId, controls: { ...(rule.controls || {}) } });
  delete state.stats[ruleId];
  render({ focus: `#wall [data-rule="${ruleId}"] .btn-x` });
}
function removeGate(ruleId) {
  const i = wallIndex(ruleId);
  if (i === -1 || !spend(`Gate ${i + 1} removed.`)) return;
  state.game.wall.splice(i, 1);
  delete state.stats[ruleId];
  render({ focus: `#spare [data-rule="${ruleId}"]` });
}
function moveGate(ruleId, by) {
  const i = wallIndex(ruleId);
  const j = i + by;
  if (i === -1 || j < 0 || j >= state.game.wall.length) return;
  if (!spend(`Gate moved to position ${j + 1}.`)) return;
  const [entry] = state.game.wall.splice(i, 1);
  state.game.wall.splice(j, 0, entry);
  render({ focus: `#wall [data-rule="${ruleId}"] .${by < 0 ? 'btn-up' : 'btn-down'}` });
}
function toggleSwitch(ruleId, name) {
  const i = wallIndex(ruleId);
  if (i === -1) return;
  const entry = state.game.wall[i];
  if (!spend(`${CONTROL_SHORT[name]} switched ${entry.controls[name] ? 'off' : 'on'} for gate ${i + 1}.`)) return;
  entry.controls[name] = !entry.controls[name];
  const st = state.stats[ruleId];
  if (st && st.need) st.need = st.need.filter((n) => !entry.controls[n]);
  render({ focus: `#wall [data-rule="${ruleId}"] [data-control="${name}"]` });
}

// Spare gates that would let in wanted traffic that is currently being turned away.
function tryGates() {
  const { c, game } = state;
  const ids = new Set();
  const flows = new Map();
  for (const u of game.units) if (u.kind === 'wanted') flows.set(u.flow.id, u.flow);
  for (const r of activeRequests(game)) for (const id of r.flows) flows.set(id, c.requiredFlows.find((f) => f.id === id));
  for (const flow of flows.values()) {
    if (evaluateFlow(game.wall, c.rules, flow).verdict !== 'denied-implicit') continue;
    for (const id of candidatesFor(c, flow, evaluateFlow)) if (wallIndex(id) === -1) ids.add(id);
  }
  return ids;
}

function renderGates() {
  const { c, game } = state;
  const locked = !canAct();
  const wall = $('#wall');
  const picked = game.units.find((u) => u.id === state.selected);
  const trace = picked ? traceFlow(c, game.wall, picked.flow, evaluateFlow) : null;
  const note = $('#trace-note');
  if (picked) {
    const f = fc(picked);
    note.hidden = false;
    note.replaceChildren(el('strong', {}, `Tracing ${unitName(picked)}`), ` — ${f.gate ? `gate ${f.gate} decides` : 'no gate matches, so it is turned away'}: ${f.text}. `,
      el('button', { type: 'button', class: 'link', onclick: () => { state.selected = null; render(); } }, 'Stop tracing'));
  } else { note.hidden = true; }
  wall.replaceChildren(...game.wall.map((entry, i) => {
    const rule = c.rules[entry.ruleId];
    const st = state.stats[entry.ruleId] || {};
    const offered = Object.keys(rule.controls || {});
    const tr = trace ? trace[i] : null;
    return el('li', { class: `gate ${rule.action === 'allow' ? 'allow' : 'block'}${tr ? ` trace-${tr.result}` : ''}`, dataset: { rule: entry.ruleId }, title: rule.label },
      tr ? el('span', { class: 'trace' }, tr.result === 'decides' ? `◀ MATCH: this gate decides (${rule.action === 'allow' ? 'lets it through' : 'blocks it'})` : tr.result === 'no-match' ? 'no match, keep going ↓' : 'never reached') : null,
      el('span', { class: 'num' }, String(i + 1)),
      el('span', { class: 'txt' }, gateText(rule)),
      el('span', { class: 'btns' },
        el('button', { type: 'button', class: 'btn-up', disabled: locked || i === 0, 'aria-label': `Move gate ${i + 1} up`, title: 'Move up (checked earlier)', onclick: () => moveGate(entry.ruleId, -1) }, '▲'),
        el('button', { type: 'button', class: 'btn-down', disabled: locked || i === game.wall.length - 1, 'aria-label': `Move gate ${i + 1} down`, title: 'Move down (checked later)', onclick: () => moveGate(entry.ruleId, 1) }, '▼'),
        el('button', { type: 'button', class: 'btn-x', disabled: locked, 'aria-label': `Remove gate ${i + 1}`, title: 'Remove this gate', onclick: () => removeGate(entry.ruleId) }, '✕')),
      offered.length > 0 ? el('span', { class: 'chips' }, offered.map((name) => {
        const on = Boolean(entry.controls[name]);
        const need = !on && (st.need || []).includes(name);
        return el('button', {
          type: 'button', class: `chip ${on ? 'on' : 'off'}${need ? ' need' : ''}`, disabled: locked, 'aria-pressed': String(on),
          dataset: { control: name }, title: CONTROL_HELP[name], onclick: () => toggleSwitch(entry.ruleId, name),
        }, `${need ? '! ' : ''}${CONTROL_SHORT[name]}: ${on ? 'ON' : 'OFF'}`);
      })) : null,
      st.leak ? el('span', { class: 'badge' }, `Let ${st.leak} attack${st.leak > 1 ? 's' : ''} in`)
        : st.block ? el('span', { class: 'badge' }, `Turned away wanted traffic ×${st.block}`)
        : st.unscanned ? el('span', { class: 'badge warn' }, 'Let something through unscanned')
        : st.expose ? el('span', { class: 'badge warn' }, 'Wider than it needs to be') : null);
  }));
  if (game.wall.length === 0) wall.append(el('li', { class: 'wall-empty' }, 'No gates yet. Add one from the list below.'));

  const tries = tryGates();
  const onWall = new Set(game.wall.map((e) => e.ruleId));
  $('#spare').replaceChildren(...Object.entries(c.rules).filter(([id]) => !onWall.has(id)).map(([id, rule]) => {
    const offered = Object.keys(rule.controls || {});
    return el('li', {}, el('button', {
      type: 'button', class: `gate ${rule.action === 'allow' ? 'allow' : 'block'}${tries.has(id) ? ' try' : ''}`, disabled: locked,
      dataset: { rule: id }, title: rule.label, 'aria-label': `Add gate: ${ruleText(c, rule)}${tries.has(id) ? '. Suggested' : ''}`, onclick: () => addGate(id),
    },
      el('span', { class: 'num' }, '+'),
      el('span', { class: 'txt' }, gateText(rule)),
      tries.has(id) ? el('span', { class: 'try-tag' }, 'TRY') : el('span', {}),
      offered.length > 0 ? el('span', { class: 'chips' }, offered.map((n) => el('span', { class: 'ghost' }, CONTROL_SHORT[n]))) : null));
  }));

  const used = RULES.ACTIONS - game.actions;
  $('#actions').replaceChildren(
    el('strong', {}, `${game.actions} of ${RULES.ACTIONS} changes left `),
    el('span', { 'aria-hidden': 'true' }, Array.from({ length: RULES.ACTIONS }, (_, i) => el('span', { class: `dot${i < used ? ' used' : ''}` }, '●'))));
  $('#undo').disabled = locked || state.undo.length === 0;
  $('#end-turn').disabled = locked || guideBlocks();
  $('#end-turn').textContent = game.turn >= game.plan.lastTurn ? 'Final turn' : 'End turn';
}

// ---------- left panel and top bar ----------
function requestMet(r) {
  const { c, game } = state;
  return r.flows.every((id) => evaluateFlow(game.wall, c.rules, c.requiredFlows.find((f) => f.id === id)).verdict === 'allowed');
}
function renderLeft() {
  const { game } = state;
  $('#requests').replaceChildren(
    ...activeRequests(game).map((r) => {
      const met = requestMet(r);
      return el('li', { class: met ? 'met' : 'unmet' }, el('span', { class: 'tick' }, met ? '✓' : '✕'), el('span', {}, r.short, el('span', { class: 'sr-only' }, met ? ' (allowed)' : ' (not allowed yet)')));
    }),
    el('li', { class: 'rest' }, el('span', { class: 'tick' }, '·'), 'Turn everything else away'));
  const units = [...game.units].sort((a, b) => (b.step - a.step) || (a.id - b.id));
  $('#approach').replaceChildren(...(units.length === 0 ? [el('li', { class: 'empty' }, 'Nothing on the road.')] : units.map((u) => {
    const f = fc(u);
    return el('li', {}, el('button', {
      type: 'button', class: `kind-${u.kind} ${f.bad ? 'bad' : 'ok'}`, 'aria-pressed': String(state.selected === u.id),
      'aria-label': `${KIND_WORD[u.kind]}: ${unitName(u)}. Arrives ${turnsWord(game.plan.travel - u.step)}. ${f.text}${f.gate ? ` at gate ${f.gate}` : ''}.`,
      onclick: () => { state.selected = state.selected === u.id ? null : u.id; render(); },
    },
      el('span', { class: 'shape' }, KIND_SHAPE[u.kind]),
      el('span', { class: 'what' }, unitName(u)),
      el('span', { class: 'eta' }, turnsWord(game.plan.travel - u.step)),
      el('span', { class: 'fc' }, `${f.bad ? '✕' : '✓'} ${f.text}${f.gate ? ` (gate ${f.gate})` : ''}`)));
  })));
}
function pips(node, value, max, on, off, label) {
  node.replaceChildren(el('small', {}, label), ...Array.from({ length: max }, (_, i) => el('span', { class: `pip ${i < value ? 'on' : 'off'}` }, i < value ? on : off)));
  node.setAttribute('aria-label', `${label}: ${Math.max(0, value)} of ${max}`);
  node.classList.toggle('low', value <= 2);
}
const shown = { hp: 0, trust: 0, score: 0, rivalHp: 0 };
function renderTop() {
  const { game, cfg } = state;
  $('#tb-level').replaceChildren(el('small', {}, `Level ${state.index + 1}`), el('strong', {}, state.level.title));
  $('#tb-turn').replaceChildren(el('small', {}, 'Turn'), el('strong', {}, `${Math.min(game.turn, game.plan.lastTurn)} / ${game.plan.lastTurn}`));
  pips($('#tb-hp'), shown.hp, RULES.MAX_HP, '♥', '♡', cfg.hp);
  pips($('#tb-trust'), shown.trust, RULES.MAX_TRUST, '☺', '☹', `${cfg.friend} trust`);
  $('#tb-score').replaceChildren(el('small', {}, 'Score'), el('strong', {}, String(shown.score)));
  $('#tb-rival').replaceChildren(el('small', {}, 'Rival'), el('strong', {}, shown.rivalHp <= 0 ? 'FALLEN' : `${'♥'.repeat(shown.rivalHp)} standing`));
}
function syncShown() { Object.assign(shown, { hp: state.game.hp, trust: state.game.trust, score: state.game.score, rivalHp: state.game.rivalHp }); }

function renderLog() {
  $('#log').replaceChildren(...state.log.slice(-9).map((l) => el('li', { class: l.tone }, l.text)));
}
function logLine(text, tone = '') { state.log.push({ text, tone }); }

// ---------- advisor and the guided first level ----------
const GUIDE = [
  { text: 'Welcome. The buildings on the right are your servers: WEB-1, JUMP-1 and MAIL-1. Everything coming from the Internet, on the left, has to pass through your gatehouse in the wall.', next: true },
  { text: 'The green wagon is wanted traffic: customers on port 443 heading for WEB-1. Its banner says TURNED AWAY, because your gatehouse has no gates yet and anything no gate allows is turned away.', next: true },
  { text: 'Add a gate. In "Available gates" on the right, click one marked TRY. "ALLOW port 443 → WEB-1" lets in exactly what was asked for and nothing more.', spot: '#spare', until: (g, c) => evaluateFlow(g.wall, c.rules, c.requiredFlows[0]).verdict === 'allowed' },
  { text: 'The wagon\'s banner now says GETS IN. Press End turn. Everything on the road moves one step, and whatever reaches the gatehouse is judged by your gates.', spot: '#end-turn', until: (g) => g.turn > 1 },
  { when: (g) => g.units.some((u) => u.kind === 'attack'), text: 'A red raider is an attack. Its banner says BLOCKED: none of your gates matches it, so the wall stops it. You never need a gate to block something that nothing allows. Keep ending turns.', next: true },
  { when: (g) => activeRequests(g).length > 1, text: 'A new request: the support partner needs port 22 to JUMP-1. Two gates would do it. "port 22 → anywhere" also lets attackers in on port 22. The one naming PARTNER lets in only the partner. Always pick the narrowest gate that does the job.', next: true },
  { when: (g, c) => g.units.some((u) => u.kind === 'attack' && u.flow.carries === 'exploit' && forecast(c, g.wall, u, evaluateFlow).bad),
    text: 'This raider comes from a known-bad address on port 443, the same port as your customers, so your 443 gate lets it in. Gates are checked top to bottom and the first match decides. Add "BLOCK BAD IP" and use ▲ to move it above the 443 gate.',
    until: (g, c) => !g.units.some((u) => u.kind === 'attack' && forecast(c, g.wall, u, evaluateFlow).bad) },
  { when: (g) => g.turn >= 9, text: 'That is the whole game: allow what is asked for, as narrowly as you can, in the right order. Watch the banners; they always tell you what your gates will do. You are on your own now.', next: true },
];
function guideStep() {
  const g = state.guide;
  if (!g.on) return null;
  while (g.i < GUIDE.length) {
    const step = GUIDE[g.i];
    if (!g.shown) {
      if (step.when && !step.when(state.game, state.c)) return null;
      g.shown = true;
    }
    if (step.until && step.until(state.game, state.c)) { g.i += 1; g.shown = false; continue; }
    return step;
  }
  g.on = false;
  return null;
}
function guideBlocks() { const s = guideStep(); return Boolean(s && s.next); }

function advice() {
  const { c, game } = state;
  const units = [...game.units].sort((a, b) => b.step - a.step);
  for (const u of units.filter((x) => x.kind === 'attack')) {
    const f = fc(u);
    if (f.outcome !== 'breach') continue;
    const rule = c.rules[game.wall[f.verdict.matchedIndex].ruleId];
    const lead = `An attack (${unitName(u)}) arrives ${turnsWord(game.plan.travel - u.step)} and will get in through gate ${f.gate}.`;
    // A blocking gate made for this attack beats swapping out a gate that wanted traffic needs.
    const blocker = Object.keys(c.rules).find((id) => c.rules[id].action === 'deny' && evaluateFlow([{ ruleId: id, controls: {} }], c.rules, u.flow).verdict === 'denied-by-rule');
    if (blocker && leakFix(u.flow, f.verdict, rule).length === 0) {
      const at = wallIndex(blocker);
      return { tone: 'alarm', text: at === -1
        ? `${lead} Add the gate "${gatePlain(c.rules[blocker])}" and move it above gate ${f.gate}: the first match decides.`
        : `${lead} Your blocking gate ${at + 1} is below it and never gets a say. Move it above gate ${f.gate}.` };
    }
    return { tone: 'alarm', text: `${lead} ${sentence(leakHint(c, u.flow, f.verdict, rule, f.gate))}` };
  }
  for (const u of units.filter((x) => x.kind === 'wanted')) {
    const f = fc(u);
    if (f.outcome !== 'turned-away') continue;
    return { tone: 'alarm', text: f.gate
      ? `Gate ${f.gate} blocks wanted traffic (${unitName(u)}). Move it below the gate that should let this in, or remove it.`
      : `No gate lets wanted traffic (${unitName(u)}) in. Add a gate marked TRY.` };
  }
  for (const u of units.filter((x) => x.kind === 'unneeded')) {
    const f = fc(u);
    if (f.outcome !== 'exposed') continue;
    const rule = c.rules[game.wall[f.verdict.matchedIndex].ruleId];
    return { tone: '', text: `Nobody asked for ${unitName(u)}, but it will slip in. ${sentence(leakHint(c, u.flow, f.verdict, rule, f.gate))}` };
  }
  const unmet = activeRequests(game).find((r) => !requestMet(r));
  if (unmet) return { tone: '', text: `Request not met yet: ${unmet.short}. Add a gate marked TRY before that traffic arrives.` };
  return { tone: 'calm', text: 'Everything on the road is handled. Press End turn.' };
}
// Hints from the shared logic are written in capitals for the arcade; make them a sentence here.
function sentence(text) {
  const lower = text.toLowerCase().replace(/\bgate (\d+)/g, 'Gate $1');
  const keep = ['SCAN', 'DECRYPT', 'DNS FILTER', ...Object.values(state.cfg.names), ...Object.values(state.cfg.tags), ...Object.values(state.cfg.apps), 'MALWARE', 'EXPLOIT', 'BAD DOMAIN'];
  let out = lower;
  for (const k of keep) out = out.split(k.toLowerCase()).join(k);
  return out.replace(/(^|\. )([a-z])/g, (m, a, b) => a + b.toUpperCase()).replace(/Swap it\.$/, 'Swap it for a narrower gate.');
}

function renderAdvisor() {
  const box = $('#advisor');
  for (const n of document.querySelectorAll('.spot')) n.classList.remove('spot');
  const step = state.busy || state.game.over ? null : guideStep();
  const actions = $('#advisor-actions');
  if (step) {
    box.className = '';
    $('#advisor-title').textContent = `Guide · step ${state.guide.i + 1} of ${GUIDE.length}`;
    $('#advisor-text').textContent = step.text;
    actions.replaceChildren(
      step.next ? el('button', { type: 'button', class: 'btn', id: 'guide-next', onclick: () => { state.guide.i += 1; state.guide.shown = false; render({ focus: '#guide-next, .spot button:not(:disabled), button.spot, #end-turn' }); } }, 'Next') : null,
      el('button', { type: 'button', class: 'btn minor', onclick: () => { state.guide.on = false; render(); } }, 'Skip the guide'));
    if (step.spot) { const target = $(step.spot); if (target) target.classList.add('spot'); }
    return;
  }
  const a = state.busy ? { tone: '', text: 'The turn is playing out…' } : advice();
  box.className = a.tone;
  $('#advisor-title').textContent = 'Advisor';
  $('#advisor-text').textContent = a.text;
  actions.replaceChildren();
}

// ---------- board ----------
function boardUnits() {
  const { c } = state;
  return state.game.units.map((u) => {
    const outbound = isOutbound(c, u.flow);
    return { ...u, outbound, host: outbound ? u.flow.srcAddress : u.flow.dstAddress };
  });
}
function syncBoard() {
  const { game } = state;
  state.board.sync(boardUnits(), game.plan.travel, (u) => {
    const f = fc(u);
    return { through: f.verdict.verdict === 'allowed' || f.verdict.verdict === 'stopped-by-control', shape: KIND_SHAPE[u.kind], title: unitTitle(u), who: unitWho(u), forecast: f.text, bad: f.bad, eta: turnsWord(game.plan.travel - u.step), selected: state.selected === u.id };
  });
}
$('#labels').addEventListener('click', (event) => {
  const node = event.target.closest('.lbl-unit');
  if (!node) return;
  const id = Number(node.dataset.unit);
  state.selected = state.selected === id ? null : id;
  render();
});

function render(opts = {}) {
  if (!state.game) return;
  renderTop();
  renderLeft();
  renderGates();
  renderLog();
  renderAdvisor();
  syncBoard();
  reportChange();
  setMusicMood();
  if (opts.focus) { const t = $(opts.focus); if (t && !t.disabled) t.focus(); }
}

// ---------- a turn ----------
function describe(e) {
  const name = unitName(e.unit);
  const gate = e.gate ? `gate ${e.gate}` : null;
  switch (e.outcome) {
    case 'served': return { tone: 'good', text: `${name} was let in by ${gate}. +${e.points}` };
    case 'stopped': return { tone: 'good', text: `Attack ${name} was blocked${gate ? ` by ${gate}` : ': no gate allows it'}. +${e.points}` };
    case 'denied': return { tone: 'good', text: `Unneeded ${name} was turned away. +${e.points}` };
    case 'scanned': return { tone: 'good', text: `${name} passed ${gate} and was caught by ${CONTROL_SHORT[e.verdict.control]}. +${e.points}` };
    case 'breach': return { tone: 'bad', text: `BREACH: attack ${name} got in through ${gate}.` };
    case 'turned-away': return { tone: 'bad', text: `Wanted traffic ${name} was turned away${gate ? ` by ${gate}` : ': no gate allows it'}.` };
    default: return { tone: 'warn', text: `${name} slipped in through ${gate}; nobody asked for it. ${e.points}` };
  }
}
function flashGate(index, cls) {
  const node = $('#wall').children[index];
  if (!node || !node.classList.contains('gate')) return;
  node.classList.remove('flash-in', 'flash-out');
  void node.offsetWidth;
  node.classList.add(cls);
}

async function onEndTurn() {
  if (!canAct() || guideBlocks()) return;
  const { c, game } = state;
  const guided = state.guide.on;
  state.busy = true;
  state.selected = null;
  state.undo = [];
  state.before = null;
  SFX.turn();
  logLine(`Turn ${game.turn}`, 'head');
  if (guided) { game.hp += 100; game.trust += 100; }
  const events = endTurn(c, game, evaluateFlow);
  if (guided) { game.hp = Math.max(1, game.hp - 100); game.trust = Math.max(1, game.trust - 100); }
  renderGates(); renderAdvisor();
  const quick = reducedMotion();
  state.board.setInstant(quick);
  let judged = 0;
  for (const e of events) {
    if (e.rivalDown) { shown.rivalHp = 0; state.board.setRivalDown(true); logLine('The rival firewall has fallen.', 'head'); toast('The rival firewall has fallen.'); renderTop(); continue; }
    if (e.rivalHit) { shown.rivalHp = Math.max(0, shown.rivalHp - 1); renderTop(); continue; }
    judged += 1;
    const d = describe(e);
    await state.board.playEvent({ ...e, unit: { ...e.unit } }, () => {
      const through = e.verdict.verdict === 'allowed' || e.verdict.verdict === 'stopped-by-control';
      if (e.gate) flashGate(e.gate - 1, through ? 'flash-in' : 'flash-out');
      if (e.outcome === 'breach') { shown.hp = Math.max(guided ? 1 : 0, shown.hp - 1); SFX.bad(); const st = (state.stats[e.ruleId] = state.stats[e.ruleId] || {}); st.leak = (st.leak || 0) + 1; st.need = leakFix(e.unit.flow, e.verdict, c.rules[e.ruleId]); }
      else if (e.outcome === 'turned-away') { shown.trust = Math.max(guided ? 1 : 0, shown.trust - 1); SFX.bad(); if (e.ruleId) { const st = (state.stats[e.ruleId] = state.stats[e.ruleId] || {}); st.block = (st.block || 0) + 1; } }
      else if (e.outcome === 'exposed') { const st = (state.stats[e.ruleId] = state.stats[e.ruleId] || {}); const fix = leakFix(e.unit.flow, e.verdict, c.rules[e.ruleId]); if (fix.length > 0) { st.unscanned = 1; st.need = fix; } else st.expose = 1; SFX.stop(); }
      else if (e.outcome === 'served') SFX.good(); else SFX.stop();
      shown.score = Math.max(0, shown.score + e.points);
      logLine(d.text, d.tone);
      announce(d.text);
      renderTop(); renderLog();
    });
    if (quick) await wait(60);
  }
  if (judged === 0) { logLine('Nothing reached the gatehouse.', ''); await wait(quick ? 0 : 350); }
  if (guided && (game.over === 'breach' || game.over === 'outage')) game.over = null;
  state.busy = false;
  syncShown();
  if (game.over) { render(); finish(); return; }
  for (const r of game.plan.requests) if (r.turn === game.turn && r.turn > 1) { toast(`New request: ${r.short}`); logLine(`New request: ${r.short}`, 'head'); announce(r.text); }
  render({ focus: '#end-turn' });
}
$('#end-turn').addEventListener('click', onEndTurn);
$('#undo').addEventListener('click', undoChange);

// ---------- screens ----------
function showScreen({ title, body, actions, solid }) {
  $('#screen-title').textContent = title;
  $('#screen-body').replaceChildren(...body.flat().filter(Boolean));
  $('#screen-actions').replaceChildren(...actions.filter(Boolean));
  $('#screen').className = solid ? 'solid' : '';
  $('#screen').hidden = false;
  for (const id of ['#topbar', '#map', '#side']) $(id).inert = true;
  setMusicMood();
  const first = $('#screen [data-autofocus]') || $('#screen-actions .btn') || $('#screen button, #screen a');
  if (first) first.focus();
}
function closeScreen() { $('#screen').hidden = true; for (const id of ['#topbar', '#map', '#side']) $(id).inert = false; setMusicMood(); }
const btn = (label, onclick, minor, extra = {}) => el('button', { type: 'button', class: `btn${minor ? ' minor' : ''}`, onclick, ...extra }, label);

function nextLevelIndex() {
  const i = state.levels.findIndex((entry) => !state.progress.stars[entry.level.id]);
  return i === -1 ? 0 : i;
}
function showHome() {
  const next = nextLevelIndex();
  const started = Object.keys(state.progress.stars).length > 0;
  showScreen({
    title: 'Firewall Security Faceoff', solid: true,
    body: [
      el('p', { class: 'tagline' }, 'A turn-based strategy game about firewall rules. Let the right traffic through your gatehouse, turn the rest away, and outlast the rival.'),
      el('div', { class: 'menu' },
        el('button', { type: 'button', class: 'btn', 'data-autofocus': true, onclick: () => showBriefing(next) }, started ? `Continue: Level ${next + 1}` : 'Play', el('small', {}, started ? state.levels[next].level.title : 'Starts with a guided first level')),
        el('button', { type: 'button', class: 'btn minor', onclick: showLevels }, 'Choose a level'),
        el('button', { type: 'button', class: 'btn minor', onclick: () => showHowTo(showHome) }, 'How to play'),
        el('button', { type: 'button', class: 'btn minor', id: 'music-btn', 'aria-pressed': String(musicWanted()), onclick: () => { setMusicWanted(!musicWanted()); showHome(); } }, `Music: ${musicWanted() ? 'on' : 'off'}`),
        el('button', { type: 'button', class: 'btn minor', id: 'sound-btn', 'aria-pressed': String(state.sound), onclick: () => { state.sound = !state.sound; showHome(); } }, `Sound effects: ${state.sound ? 'on' : 'off'}`)),
      el('p', { class: 'editions' }, 'Other versions of the same lessons: ', el('a', { href: 'arcade.html' }, 'real-time arcade'), ' · ', el('a', { href: 'classic.html' }, 'text only, no motion')),
    ],
    actions: [],
  });
}
function showLevels() {
  showScreen({
    title: 'Choose a level', solid: true,
    body: [el('div', { class: 'level-grid' }, state.levels.map((entry, i) => {
      const stars = state.progress.stars[entry.level.id] || 0;
      return el('button', { type: 'button', class: 'level-card', 'data-autofocus': i === 0 ? true : null, 'aria-label': `Level ${i + 1}: ${entry.level.title}. ${entry.level.capability}. ${stars} of 3 stars.`, onclick: () => showBriefing(i) },
        el('span', { class: 'n' }, String(i + 1)), el('span', { class: 'name' }, entry.level.title), el('span', { class: 'stars' }, starText(stars)), el('span', { class: 'skill' }, entry.level.capability));
    }))],
    actions: [btn('Back', showHome, true)],
  });
}
function showHowTo(back) {
  const card = (title, ...body) => el('div', { class: 'rule-card' }, el('h3', {}, title), ...body);
  showScreen({
    title: 'How to play', solid: true,
    body: [el('div', { class: 'rules' },
      card('Your goal', el('p', {}, 'Requests tell you which traffic the business needs. Let that traffic through your gatehouse and turn everything else away, until the last turn.')),
      card('What is on the road', el('ul', {},
        el('li', {}, el('span', { class: 'kw good' }, '■ Wagon'), ': wanted traffic. It should get in.'),
        el('li', {}, el('span', { class: 'kw bad' }, '▲ Raider'), ': an attack. It must not get in.'),
        el('li', {}, el('span', { class: 'kw stray' }, '● Drifter'), ': traffic nobody asked for. Keep it out too.')),
        el('p', {}, 'Each one shows its port, where it is going, and what your gates will do with it.')),
      card('Your gatehouse', el('p', {}, 'Each gate allows or blocks one kind of traffic. Traffic is checked against your gates from the top down, and the first gate that matches decides. If no gate matches, it is turned away.')),
      card('Your turn', el('p', {}, `You may make ${RULES.ACTIONS} changes a turn: add a gate, remove one, move one up or down, or flip a switch. Undo gives a change back. Click any banner on the map to trace it through your gates. Then press End turn. Everything moves one step; it takes ${RULES.TRAVEL} turns to reach the gatehouse, so you can see trouble coming.`)),
      card('Winning and losing', el('p', {}, `Each attack that gets in costs a heart. Each piece of wanted traffic turned away costs trust. Lose all ${RULES.MAX_HP} of either and the level is lost. Reach the last turn to win.`), el('p', {}, 'Three stars: nothing wrongly let in or turned away, and no gate wider than it needs to be.')),
      card('Switches (Levels 2 and 3)', el('p', {}, 'Some gates have switches. SCAN catches malware and exploits in traffic the gate lets through. Encrypted traffic also needs DECRYPT, or SCAN cannot see inside. DNS FILTER stops lookups of bad domains.')))],
    actions: [btn('Back', back, false)],
  });
}
function showBriefing(i) {
  selectLevel(i);
  const b = state.cfg.briefing || {};
  showScreen({
    title: `Level ${i + 1}: ${state.level.title}`,
    body: [el('div', { class: 'brief' },
      el('div', {}, el('h3', {}, 'The situation'), el('p', {}, b.story || state.level.concept)),
      el('div', {}, el('h3', {}, 'Your job'), el('p', {}, b.goal || '')),
      el('div', {}, el('h3', {}, i === 0 ? 'Your tool' : 'New in this level'), el('p', {}, b.tool || '')),
      el('div', {}, el('h3', {}, 'First request'), el('p', {}, sentence(state.game.plan.requests[0].text)))),
    i === 0 && state.guide.on ? el('p', {}, 'A guide will walk you through the first few turns. You cannot lose while it is on.') : null],
    actions: [btn('Begin', () => { closeScreen(); state.board.flyIn(); render({ focus: '#guide-next, #spare button' }); }, false), btn('How to play', () => showHowTo(() => showBriefing(i)), true), btn('Home', showHome, true)],
  });
}
function showMenu() {
  showScreen({
    title: 'Paused',
    body: [el('p', {}, `Level ${state.index + 1}: ${state.level.title}. Turn ${state.game.turn} of ${state.game.plan.lastTurn}.`)],
    actions: [btn('Back to the game', closeScreen, false), btn(`Music: ${musicWanted() ? 'on' : 'off'}`, () => { setMusicWanted(!musicWanted()); showMenu(); }, true), btn('Restart level', () => showBriefing(state.index), true), btn('How to play', () => showHowTo(showMenu), true), btn('Home', showHome, true)],
  });
}
$('#btn-menu').addEventListener('click', showMenu);
$('#btn-help').addEventListener('click', () => showHowTo(closeScreen));

function finish() {
  const { c, game } = state;
  const won = game.over === 'win';
  if (!won) {
    if (music && music.playing()) music.sting('lose'); else SFX.lose();
    const text = game.over === 'breach' ? 'Too many attacks got through your gatehouse.' : `You turned away too much wanted traffic, and ${state.cfg.friend.toLowerCase()} gave up.`;
    announce(text);
    setTimeout(() => showScreen({
      title: game.over === 'breach' ? 'Breached' : 'Outage',
      body: [el('p', {}, text), el('p', {}, game.over === 'breach' ? 'Watch for red banners that say WILL BREACH, and read the advisor: it names the gate at fault.' : 'Blocking everything is not a defense. Watch for green banners that say TURNED AWAY.'), el('p', {}, `You reached turn ${game.turn} of ${game.plan.lastTurn}. Score ${game.score}.`)],
      actions: [btn('Try again', () => showBriefing(state.index), false), btn('Home', showHome, true)],
    }), reducedMotion() ? 0 : 900);
    return;
  }
  const result = evaluateSubmission(c, game.wall);
  const stars = starsFor(result, { leaks: game.leaks, blocked: game.blocked, exposed: game.exposed, hp: game.hp });
  const id = state.level.id;
  state.progress.stars[id] = Math.max(state.progress.stars[id] || 0, stars);
  state.progress.best[id] = Math.max(state.progress.best[id] || 0, game.score);
  saveProgress();
  if (music && music.playing()) music.sting('win'); else SFX.win();
  const hasNext = state.index + 1 < state.levels.length;
  const why = stars === 3 ? 'A perfect defense: nothing got in that was not asked for, and nothing wanted was turned away.'
    : !result.completed ? 'You survived, but your final gatehouse still lets an attack in or blocks something wanted.'
    : game.leaks + game.blocked > 0 ? 'Your final gatehouse is right, but there were slips along the way.'
    : 'Close. Something nobody asked for got through; a narrower gate or a switch would stop it.';
  const rival = game.rivalDownTurn !== null ? `The rival fell on turn ${game.rivalDownTurn}. You held for all ${game.plan.lastTurn}.` : 'The rival held too.';
  announce(`Level complete. ${stars} of 3 stars. ${why}`);
  setTimeout(() => showScreen({
    title: 'Level complete',
    body: [
      el('p', { class: 'big-stars', role: 'img', 'aria-label': `${stars} of 3 stars` }, '★'.repeat(stars), el('span', { class: 'off' }, '★'.repeat(3 - stars))),
      el('p', { class: 'final' }, `Score ${game.score}`),
      el('p', {}, why), el('p', {}, rival),
      el('p', {}, 'You practiced: ', el('strong', {}, state.level.capability), '.'),
    ],
    actions: [
      hasNext ? btn('Next level', () => showBriefing(state.index + 1), false) : null,
      btn(stars === 3 ? 'Play again' : 'Go for 3 stars', () => showBriefing(state.index), hasNext),
      btn('Home', showHome, true),
    ],
  }), reducedMotion() ? 0 : 900);
}

// ---------- levels ----------
function selectLevel(i) {
  const entry = state.levels[i];
  state.index = i;
  state.level = entry.level;
  state.c = entry.challenge;
  state.cfg = arcadeOf(entry.challenge);
  state.game = newGame(state.c);
  spawnTurn(state.game);
  state.stats = {};
  state.undo = [];
  state.log = [];
  state.selected = null;
  state.busy = false;
  state.guide = { on: i === 0 && !state.progress.stars[entry.level.id], i: 0, shown: false };
  if (music) music.endSting();
  syncShown();
  const zones = state.c.topology.zones;
  state.board.load({
    hosts: insideHosts(state.c).map((h) => ({ address: h.address, name: nameOf(state.c, h.address), hostile: state.cfg.hostile.includes(h.address) })),
    leftName: zones.filter((z) => !state.cfg.inside.includes(z)).join(' + '),
    rightName: state.cfg.inside.join(' + '),
    rivalName: 'RIVAL',
  });
  state.board.setRivalDown(false);
  state.board.resetView();
  render();
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
  const levels = [];
  const problems = [];
  for (const level of (content && content.levels) || []) {
    const v = validation.challenges[level.id] || {};
    const tier = ['expert', 'standard'].find((t) => v[t] && v[t].status === 'ok');
    if (tier) levels.push({ level, challenge: level.challenges[tier] });
    else problems.push(...Object.values(v).flatMap((x) => x.errors || []));
  }
  if (loadError || !validation.ok || levels.length === 0) {
    showScreen({
      title: 'The game content could not be read', solid: true,
      body: [el('ul', {}, [loadError, ...validation.fileErrors, ...problems].filter(Boolean).map((m) => el('li', {}, m)))],
      actions: [btn('Retry', () => window.location.reload(), false)],
    });
    return;
  }
  state.levels = levels;
  loadProgress();
  try {
    state.board = createBoard($('#map'), $('#labels'), await loadModels());
  } catch (err) {
    showScreen({
      title: 'This browser cannot draw the 3D map', solid: true,
      body: [el('p', {}, 'The same lessons are available in two other versions that do not need 3D.')],
      actions: [el('a', { class: 'btn', href: 'arcade.html' }, 'Arcade version'), el('a', { class: 'btn minor', href: 'classic.html' }, 'Text version')],
    });
    return;
  }
  selectLevel(nextLevelIndex());
  showHome();
}

boot();
