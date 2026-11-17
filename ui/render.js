// Builds the views from session state. Rendering only: no state changes here.
// Contract: specs/001-firewall-faceoff/contracts/ui-contract.md
// Every input is a native button, checkbox, or radio. There is no text field,
// no drag and drop, and nothing shown only on hover.

import { explainResult, controlLabel, describeFlow } from '../engine/feedback.js';
import { attachModel, PLAYFIELD_SIZE } from './playfield.js';

const TIER_NAMES = { standard: 'Standard', expert: 'Expert' };

// Tiny DOM helper. Text always goes in as text nodes, never as HTML.
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (name === 'class') el.className = value;
    else if (name === 'dataset') Object.assign(el.dataset, value);
    else if (value === true) el.setAttribute(name, '');
    else el.setAttribute(name, value);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

// ---------- inline SVG art ----------
// All art is drawn here; nothing is fetched. Art is decorative (aria-hidden)
// or carries a text label, and the same facts always appear as text nearby.

const SVG_NS = 'http://www.w3.org/2000/svg';
let artId = 0;

function s(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    el.setAttribute(name, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

const SHIELD_PATH = 'M60 6 L110 24 V70 C110 104 88 126 60 136 C32 126 10 104 10 70 V24 Z';

// A firewall drawn as a shield of bricks. side: 'player' | 'rival'.
// state: 'intact' | 'breached' | 'won'. Decorative: the state is always in text beside it.
function shieldArt(side, state = 'intact', size = 120) {
  artId += 1;
  const clip = `shield-clip-${artId}`;
  const bricks = [];
  for (let row = 0; row < 8; row += 1) {
    const y = 6 + row * 17;
    bricks.push(s('line', { x1: 0, y1: y, x2: 120, y2: y }));
    for (let x = row % 2 === 0 ? 20 : 40; x < 120; x += 40) {
      bricks.push(s('line', { x1: x, y1: y, x2: x, y2: y + 17 }));
    }
  }
  return s('svg', {
    class: `shield shield-${side} shield-${state}`, viewBox: '0 0 120 142', width: size, height: Math.round(size * 1.18),
    'aria-hidden': 'true', focusable: 'false',
  },
    s('defs', {}, s('clipPath', { id: clip }, s('path', { d: SHIELD_PATH }))),
    s('path', { class: 'shield-body', d: SHIELD_PATH }),
    s('g', { class: 'shield-bricks', 'clip-path': `url(#${clip})` }, bricks),
    state === 'breached'
      ? s('g', { class: 'shield-crack' },
          s('path', { d: 'M66 8 L52 40 L70 58 L48 86 L66 104 L56 134', fill: 'none' }),
          s('path', { d: 'M52 40 L34 50 M70 58 L90 62 M48 86 L30 96', fill: 'none' }))
      : null,
    state === 'won'
      ? s('path', { class: 'shield-check', d: 'M38 72 L54 88 L84 52', fill: 'none' })
      : null,
    s('path', { class: 'shield-rim', d: SHIELD_PATH, fill: 'none' }),
  );
}

// Zones in a row, each joined to one firewall bar across the top. The same
// information is in the text description and host table next to it.
function topologyDiagram(challenge) {
  const zones = challenge.topology.zones;
  const hosts = challenge.topology.hosts || [];
  const colW = 190;
  const gap = 16;
  const rowH = 40;
  const maxHosts = Math.max(1, ...zones.map((z) => hosts.filter((host) => host.zone === z).length));
  const width = zones.length * colW + (zones.length + 1) * gap;
  const zoneTop = 78;
  const zoneH = 34 + maxHosts * rowH + 8;
  const height = zoneTop + zoneH + gap;
  const parts = [
    s('rect', { class: 'topo-fw', x: gap, y: 12, width: width - gap * 2, height: 30, rx: 6 }),
    s('text', { class: 'topo-fw-label', x: width / 2, y: 32, 'text-anchor': 'middle' }, 'Your firewall'),
  ];
  zones.forEach((zone, i) => {
    const x = gap + i * (colW + gap);
    const zoneHosts = hosts.filter((host) => host.zone === zone);
    parts.push(
      s('line', { class: 'topo-link', x1: x + colW / 2, y1: 42, x2: x + colW / 2, y2: zoneTop }),
      s('rect', { class: `topo-zone topo-zone-${i % 3}`, x, y: zoneTop, width: colW, height: zoneH, rx: 10 }),
      s('text', { class: 'topo-zone-label', x: x + 12, y: zoneTop + 22 }, `${zone} zone`),
    );
    zoneHosts.forEach((host, j) => {
      const y = zoneTop + 34 + j * rowH;
      parts.push(
        s('rect', { class: 'topo-host', x: x + 10, y, width: colW - 20, height: rowH - 6, rx: 6 }),
        s('text', { class: 'topo-host-name', x: x + 18, y: y + 14 }, host.name + (host.userGroup ? ` · ${host.userGroup}` : '')),
        s('text', { class: 'topo-host-addr', x: x + 18, y: y + 28 }, host.address),
      );
    });
  });
  return h('div', { class: 'diagram-scroll' },
    s('svg', {
      class: 'topology', viewBox: `0 0 ${width} ${height}`, width, height,
      role: 'img', 'aria-label': `Network diagram. ${challenge.topology.description}`, focusable: 'false',
    }, parts));
}

// Two bars comparing strengths. Decorative: the numbers are in the text beside it.
function strengthMeter(you, rival) {
  const max = Math.max(you, rival, 1);
  const bar = (cls, value) => h('span', { class: `meter-bar ${cls}`, style: `width:${Math.round((value / max) * 100)}%` });
  return h('span', { class: 'meter', 'aria-hidden': 'true' },
    h('span', { class: 'meter-track' }, bar('meter-you', you)),
    h('span', { class: 'meter-track' }, bar('meter-rival', rival)));
}

function button(label, action, opts = {}) {
  return h('button', {
    type: 'button',
    class: opts.primary ? 'btn btn-primary' : 'btn',
    'aria-label': opts.name || null,
    disabled: opts.disabled || false,
    dataset: { action, key: opts.key || action, ...(opts.data || {}) },
  }, label);
}

function heading(text) {
  return h('h1', { tabindex: '-1', dataset: { heading: 'true' } }, text);
}

function levelTitle(vm) {
  return `Level ${vm.levelIndex + 1} of ${vm.levelCount}: ${vm.level.title}`;
}

function hostNames(challenge) {
  const map = {};
  for (const host of challenge.topology.hosts || []) map[host.address] = host.name;
  return map;
}

function address(value, names) {
  if (value === null || value === undefined) return 'any';
  return names[value] ? `${value} (${names[value]})` : value;
}

function services(rule) {
  if (!rule.services) return 'any';
  return rule.services.map((s) => `${s.protocol.toUpperCase()} ${s.port}`).join(', ');
}

// The columns a level's rule tables show. A match field that is "any" for
// every rule in the level is left out, and the table caption says so, which
// keeps the table narrow enough to read without scrolling on a laptop.
function ruleColumns(challenge) {
  const rules = Object.values(challenge.rules);
  const names = hostNames(challenge);
  const used = (field) => rules.some((r) => r[field] !== null && r[field] !== undefined);
  const columns = [
    { title: 'Action', cell: (r) => h('span', { class: `action action-${r.action}` }, r.action === 'allow' ? 'Allow' : 'Deny') },
    { title: 'From and to zone', cell: (r) => `${r.fromZone} to ${r.toZone}` },
    used('srcAddress') ? { title: 'Source', cell: (r) => address(r.srcAddress, names) } : null,
    used('dstAddress') ? { title: 'Destination', cell: (r) => address(r.dstAddress, names) } : null,
    used('services') ? { title: 'Service', cell: (r) => services(r) } : null,
    used('application') ? { title: 'Application', cell: (r) => r.application || 'any' } : null,
    used('userGroup') ? { title: 'User group', cell: (r) => r.userGroup || 'any' } : null,
  ].filter(Boolean);
  const hidden = [['srcAddress', 'source'], ['dstAddress', 'destination'], ['services', 'service'], ['application', 'application'], ['userGroup', 'user group']]
    .filter(([field]) => !used(field)).map(([, word]) => word);
  return {
    columns,
    hasControls: rules.some((r) => Object.keys(r.controls || {}).length > 0),
    hiddenNote: hidden.length > 0 ? ` Not shown because every rule in this level uses "any": ${hidden.join(', ')}.` : '',
  };
}

// The rule's ID and name, so hints and feedback that say "R1" can be followed.
function ruleIdentity(ruleId, rule) {
  return h('td', { class: 'rule-id-cell' },
    h('span', { class: 'rule-id' }, ruleId), ' ', rule.label,
    rule.note ? h('span', { class: 'rule-note' }, ` Note: ${rule.note}.`) : null);
}

function controlsText(rule, entry) {
  const names = Object.keys(rule.controls || {});
  if (names.length === 0) return 'none';
  return names
    .map((name) => {
      const on = entry.controls && name in entry.controls ? entry.controls[name] : rule.controls[name];
      return `${controlLabel(name)} ${on ? 'on' : 'off'}`;
    })
    .join(', ');
}

// A read-only rule table, optionally marking which rule decided a step.
function readOnlyRuleTable(caption, ruleBase, challenge, marker) {
  const cols = ruleColumns(challenge);
  const rows = ruleBase.map((entry, i) => {
    const rule = challenge.rules[entry.ruleId];
    let mark = '';
    if (marker) {
      if (marker.matchedIndex === i) mark = 'matched here';
      else if (marker.matchedIndex !== null && i > marker.matchedIndex) mark = 'not reached';
      else if (marker.matchedIndex === null) mark = 'no match';
      else mark = 'no match';
    }
    return h('tr', { class: mark === 'matched here' ? 'row-matched' : mark === 'not reached' ? 'row-unreached' : null },
      h('th', { scope: 'row' }, String(i + 1)),
      marker ? h('td', { class: 'marker' }, mark) : null,
      ruleIdentity(entry.ruleId, rule),
      ...cols.columns.map((col) => h('td', {}, col.cell(rule))),
      cols.hasControls ? h('td', {}, controlsText(rule, entry)) : null,
    );
  });
  return h('div', { class: 'table-scroll', role: 'region', 'aria-label': caption, tabindex: '0' },
    h('table', {},
      h('caption', {}, caption),
      h('thead', {}, h('tr', {},
        h('th', { scope: 'col' }, '#'),
        marker ? h('th', { scope: 'col' }, marker.title) : null,
        h('th', { scope: 'col' }, 'Rule'),
        ...cols.columns.map((col) => h('th', { scope: 'col' }, col.title)),
        cols.hasControls ? h('th', { scope: 'col' }, 'Controls') : null,
      )),
      h('tbody', {}, rows.length > 0 ? rows : h('tr', {}, h('td', { colspan: '12' }, 'No rules. Everything is denied by the implicit deny.'))),
    ),
  );
}

// ---------- tower-defense playfield ----------
// A canvas showing packets being checked gate by gate. It illustrates results
// that are always written as text beside it; it never decides anything.

function gatesOf(ruleBase, challenge) {
  return ruleBase.map((entry) => ({ id: entry.ruleId, action: challenge.rules[entry.ruleId].action }));
}

function playfieldCanvas(kind, model, description) {
  const canvas = h('canvas', {
    class: `playfield playfield-${kind}`, width: PLAYFIELD_SIZE.width, height: PLAYFIELD_SIZE.height,
    role: 'img', 'aria-label': description, dataset: { playfield: kind },
  });
  attachModel(canvas, model);
  return h('div', { class: 'cabinet' }, canvas);
}

function sideModel(who, name, ruleBase, challenge, verdict, flow, extra = {}) {
  return {
    who, name, gates: gatesOf(ruleBase, challenge), verdict: verdict || null,
    fromZone: flow ? flow.fromZone.toUpperCase() : null, toZone: flow ? flow.toZone.toUpperCase() : null,
    controlName: verdict && verdict.control ? controlLabel(verdict.control).toUpperCase() : null,
    ...extra,
  };
}

// A canned run for the title screen: your wall denies, the rival's is breached.
function demoPlayfield() {
  const model = {
    title: 'SAME ATTACK, TWO FIREWALLS',
    sides: [
      { who: 'player', name: 'YOUR FIREWALL', fromZone: 'INTERNET', toZone: 'DMZ',
        gates: [{ id: 'R1', action: 'allow' }, { id: 'R3', action: 'deny' }],
        verdict: { matchedIndex: 1, verdict: 'denied-by-rule', control: null } },
      { who: 'rival', name: 'RIVAL FIREWALL', fromZone: 'INTERNET', toZone: 'DMZ',
        gates: [{ id: 'R5', action: 'allow' }, { id: 'R1', action: 'allow' }],
        verdict: { matchedIndex: 0, verdict: 'allowed', control: null } },
    ],
  };
  return playfieldCanvas('battle', model, 'Animation: the same attack reaches two firewalls. Yours checks its rules from the top and rule 2 denies it. The rival\'s rule 1 allows it and the rival is breached.');
}

// ---------- progress track, badges, celebration ----------

// Where the player is across the levels. Each state is written out in words.
function levelTrack(vm) {
  return h('ol', { class: 'track', 'aria-label': 'Level progress in this tier' }, vm.levels.map((l, i) => {
    const current = i === vm.levelIndex && vm.view !== 'summary';
    const state = l.status !== 'ok' ? 'Not available' : l.completed ? 'Completed' : current ? 'Current' : l.available ? 'Open' : 'Locked';
    return h('li', { class: `track-item track-${state.toLowerCase().replace(' ', '-')} ${current ? 'is-current' : ''}`, 'aria-current': current ? 'step' : null },
      h('span', { class: 'track-num' }, l.completed ? '\u2713' : String(i + 1)),
      h('span', { class: 'track-text' }, h('span', { class: 'track-title' }, l.title), h('span', { class: 'track-state' }, state)));
  }));
}

function capabilityBadge(text) {
  return h('span', { class: 'badge' },
    s('svg', { viewBox: '0 0 24 24', width: 18, height: 18, 'aria-hidden': 'true', focusable: 'false' },
      s('path', { d: 'M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z', fill: 'currentColor', opacity: '0.25' }),
      s('path', { d: 'M12 2 L20 5 V11 C20 16 16.5 20 12 22 C7.5 20 4 16 4 11 V5 Z M8 12 L11 15 L16.5 9', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linejoin': 'round', 'stroke-linecap': 'round' })),
    text);
}

// A short burst of falling pieces on a win. Purely decorative, never covers
// a control (pointer-events: none), and hidden when reduced motion is asked for.
function confetti() {
  const pieces = [];
  for (let i = 0; i < 18; i += 1) {
    pieces.push(h('span', { class: `confetti-piece confetti-${i % 4}`, style: `left:${4 + ((i * 53) % 92)}%;animation-delay:${(i % 6) * 0.07}s` }));
  }
  return h('div', { class: 'confetti', 'aria-hidden': 'true' }, pieces);
}

// Strength side by side. The numbers are written on the bars as text.
function compareBars(you, rival) {
  const max = Math.max(you, rival, 1);
  const row = (cls, label, value) => h('div', { class: 'compare-row' },
    h('span', { class: 'compare-label' }, label),
    h('span', { class: 'compare-track' }, h('span', { class: `compare-bar ${cls}`, style: `width:${Math.max(6, Math.round((value / max) * 100))}%` }, String(value))));
  return h('div', { class: 'compare' }, row('compare-you', 'Your firewall', you), row('compare-rival', 'Rival firewall', rival));
}

// ---------- status bar ----------

export function renderStatusBar(vm, ui = {}) {
  if (!vm.tier || vm.view === 'tier-select') return [];
  const other = vm.tier === 'standard' ? 'expert' : 'standard';
  const items = [
    h('span', { class: 'status-item' }, `Tier: ${TIER_NAMES[vm.tier]}`),
    vm.level && vm.view !== 'summary' ? h('span', { class: 'status-item' }, `Level ${vm.levelIndex + 1} of ${vm.levelCount}`) : null,
    h('span', { class: 'status-item status-strength' },
      `Your firewall strength: ${vm.strength}. Rival: ${vm.rivalStrength}.`, strengthMeter(vm.strength, vm.rivalStrength)),
    button(`Switch to ${TIER_NAMES[other]}`, 'switch-tier', { data: { tier: other } }),
    vm.view !== 'summary' ? button('Progress summary', 'summary') : null,
    h('button', { type: 'button', class: 'btn', 'aria-pressed': ui.sound ? 'true' : 'false', dataset: { action: 'toggle-sound', key: 'toggle-sound' } },
      `Sound: ${ui.sound ? 'on' : 'off'}`),
    button('Restart', 'restart'),
  ];
  return items.filter(Boolean);
}

// ---------- confirmation ----------

function renderConfirm(confirm) {
  const text = confirm.kind === 'restart'
    ? 'Restart the game? All progress in both tiers will be cleared.'
    : `Switch to ${TIER_NAMES[confirm.tier]}? The rule base you have not submitted for this level will be discarded.`;
  return h('section', { class: 'confirm', role: 'alertdialog', 'aria-labelledby': 'confirm-title', 'aria-describedby': 'confirm-text' },
    h('h2', { id: 'confirm-title' }, 'Please confirm'),
    h('p', { id: 'confirm-text' }, text),
    h('div', { class: 'actions' },
      button('Cancel', 'confirm-no'),
      button(confirm.kind === 'restart' ? 'Yes, restart' : 'Yes, switch tier', 'confirm-yes', { primary: true }),
    ),
  );
}

// ---------- tier selection ----------

function renderTierSelect(vm, ui) {
  const option = (tier, text) => h('label', { class: 'choice' },
    h('input', { type: 'radio', name: 'tier', value: tier, checked: ui.tierChoice === tier, dataset: { action: 'pick-tier', key: `tier:${tier}` } }),
    h('span', {}, h('strong', {}, TIER_NAMES[tier]), ` ${text}`),
  );
  return [
    heading('Firewall Security Faceoff'),
    demoPlayfield(),
    h('p', { class: 'lead' }, 'You are the firewall engineer. Build a rule base that meets a business request, then watch a penetration test hit your firewall and a rival\'s, one attack at a time. The firewall that is breached first loses.'),
    h('ol', { class: 'howto', 'aria-label': 'How a level works' },
      h('li', {}, h('strong', {}, 'Read the request. '), 'A short briefing teaches the idea, then the business tells you what must work.'),
      h('li', {}, h('strong', {}, 'Build your rule base. '), 'Add, order, and tune rules. Take as long as you like.'),
      h('li', {}, h('strong', {}, 'Face the penetration test. '), 'The same attacks hit you and the rival. Every result names the rule behind it.')),
    h('p', {}, 'Each level you complete makes your firewall stronger and adds a capability. There is no timer and no penalty for retries or hints. The firewall in this game is vendor-neutral.'),
    h('fieldset', {},
      h('legend', {}, 'Choose a difficulty tier'),
      option('standard', 'For anyone new to next-generation firewall policy. You build each rule base from rule cards.'),
      option('expert', 'For experienced firewall engineers. You inherit a larger rule base and repair it.'),
    ),
    h('p', {}, 'You can switch tier at any time. Progress is kept separately for each tier.'),
    h('div', { class: 'actions' }, button('Start', 'start', { primary: true })),
  ];
}

// ---------- briefing ----------

function renderBriefing(vm, sources) {
  const b = vm.challenge.briefing;
  const cited = (b.sourceIds || []).map((id) => sources.find((s) => s.id === id)).filter(Boolean);
  return [
    heading(`${levelTitle(vm)}. Briefing`),
    levelTrack(vm),
    h('p', { class: 'lead' }, `Concept: ${vm.level.concept}.`),
    h('h2', {}, 'Key ideas'),
    h('ol', { class: 'ideas' }, b.paragraphs.map((p) => h('li', {}, p))),
    h('h2', {}, 'Worked example'),
    h('p', { class: 'callout' }, b.workedExample),
    h('h2', {}, 'Your mission'),
    h('div', { class: 'mission' },
      shieldArt('player', 'intact', 56),
      h('div', {},
        h('p', { class: 'request' }, vm.challenge.request),
        h('p', {}, `Complete it to add "${vm.level.capability}" to your firewall. The rival has built a rule base for the same request.`))),
    h('h2', {}, 'What this level leaves out'),
    h('ul', {}, b.simplifications.map((s) => h('li', {}, s))),
    h('h2', {}, 'Sources'),
    h('ul', {}, cited.map((s) => h('li', {},
      h('a', { href: s.url, rel: 'noopener', target: '_blank' }, `${s.title}, ${s.section}`), `: ${s.claim}`))),
    h('div', { class: 'actions' }, button('Start building', 'start-build', { primary: true })),
  ];
}

// ---------- build ----------

function topologySection(challenge) {
  return h('section', { 'aria-labelledby': 'topology-h' },
    h('h2', { id: 'topology-h' }, 'Network'),
    topologyDiagram(challenge),
    h('p', {}, challenge.topology.description),
    h('details', { class: 'host-details' },
      h('summary', {}, 'Host table (the diagram as text)'),
      h('div', { class: 'table-scroll', role: 'region', 'aria-label': 'Hosts', tabindex: '0' },
        h('table', {},
          h('caption', {}, 'Hosts by zone'),
          h('thead', {}, h('tr', {}, ['Host', 'Zone', 'Address', 'User group'].map((t) => h('th', { scope: 'col' }, t)))),
          h('tbody', {}, challenge.topology.hosts.map((host) => h('tr', {},
            h('th', { scope: 'row' }, host.name), h('td', {}, host.zone), h('td', {}, host.address), h('td', {}, host.userGroup || 'none')))),
        ),
      ),
    ),
  );
}

function ruleBaseSection(vm, ui) {
  const c = vm.challenge;
  const cols = ruleColumns(c);
  const total = vm.workingRuleBase.length;
  const rows = vm.workingRuleBase.map((entry, i) => {
    const rule = c.rules[entry.ruleId];
    const n = i + 1;
    const controlNames = Object.keys(rule.controls || {});
    const controls = controlNames.length === 0
      ? 'none'
      : controlNames.map((name) => h('label', { class: 'switch' },
          h('input', {
            type: 'checkbox',
            checked: Boolean(entry.controls[name]),
            'aria-label': `${controlLabel(name)} for rule ${n}`,
            dataset: { action: 'control', index: String(i), control: name, key: `ctl:${entry.ruleId}:${name}` },
          }),
          h('span', {}, controlLabel(name)),
        ));
    return h('tr', { class: ui && ui.flash === entry.ruleId ? 'row-flash' : null },
      h('th', { scope: 'row' }, h('span', { class: 'order-num' }, String(n))),
      ruleIdentity(entry.ruleId, rule),
      ...cols.columns.map((col) => h('td', {}, col.cell(rule))),
      cols.hasControls ? h('td', {}, controls) : null,
      h('td', { class: 'row-actions' },
        button('\u25B2', 'up', { name: `Move rule ${n} up`, disabled: i === 0, key: `up:${entry.ruleId}`, data: { index: String(i) } }),
        button('\u25BC', 'down', { name: `Move rule ${n} down`, disabled: i === total - 1, key: `down:${entry.ruleId}`, data: { index: String(i) } }),
        button('\u2715', 'remove', { name: `Remove rule ${n}: ${rule.label}`, key: `remove:${entry.ruleId}`, data: { index: String(i) } }),
      ),
    );
  });

  return h('section', { 'aria-labelledby': 'rulebase-h' },
    h('h2', { id: 'rulebase-h' }, 'Your rule base'),
    h('p', {}, 'Each rule is a gate on your wall. Every packet is checked from the top gate down. The first gate that matches decides. A packet that matches no gate falls to the implicit deny.'),
    playfieldCanvas('preview', {
      title: `YOUR WALL: ${total} GATE${total === 1 ? '' : 'S'}`,
      sides: [sideModel('player', 'YOUR FIREWALL', vm.workingRuleBase, c, null, c.requiredFlows[0])],
    }, `Picture of your wall with ${total} gate${total === 1 ? '' : 's'}, in the same order as the rule table below. Green gates allow, red gates deny.`),
    h('div', { class: 'table-scroll', role: 'region', 'aria-label': 'Your rule base, in evaluation order', tabindex: '0' },
      h('table', {},
        h('caption', {}, `Rule base: ${total} rule${total === 1 ? '' : 's'}.${cols.hiddenNote}`),
        h('thead', {}, h('tr', {},
          h('th', { scope: 'col' }, '#'),
          h('th', { scope: 'col' }, 'Rule'),
          ...cols.columns.map((col) => h('th', { scope: 'col' }, col.title)),
          cols.hasControls ? h('th', { scope: 'col' }, 'Security controls') : null,
          h('th', { scope: 'col' }, 'Move or remove'),
        )),
        h('tbody', {}, rows.length > 0 ? rows : h('tr', {}, h('td', { class: 'empty-row', colspan: '12' }, 'No rules yet. Right now everything is denied. Add a rule from the list below.'))),
      ),
    ),
  );
}

function availableSection(vm) {
  const c = vm.challenge;
  const names = hostNames(c);
  const inherited = c.startingRuleBase.length > 0;
  const title = inherited ? 'Removed rules' : 'Available rules';
  const items = vm.availableRuleIds.map((id) => {
    const rule = c.rules[id];
    const controlNames = Object.keys(rule.controls || {});
    return h('li', { class: `card card-${rule.action}` },
      h('div', {},
        h('div', { class: 'card-title' },
          h('span', { class: 'rule-id' }, id),
          h('span', { class: `action action-${rule.action}` }, rule.action === 'allow' ? 'Allow' : 'Deny'),
          h('strong', {}, rule.label)),
        h('div', { class: 'card-detail' },
          `${rule.action === 'allow' ? 'Allow' : 'Deny'}. From ${rule.fromZone} to ${rule.toZone}. ` +
          `Source ${address(rule.srcAddress, names)}. Destination ${address(rule.dstAddress, names)}. ` +
          `Service ${services(rule)}. Application ${rule.application || 'any'}. User group ${rule.userGroup || 'any'}.` +
          (controlNames.length > 0 ? ` Offers: ${controlNames.map(controlLabel).join(', ')}.` : '') +
          (rule.note ? ` Note: ${rule.note}.` : '')),
      ),
      button(inherited ? 'Restore' : 'Add', 'add', { name: `${inherited ? 'Restore' : 'Add'} rule: ${rule.label}`, key: `add:${id}`, data: { rule: id } }),
    );
  });
  return h('section', { 'aria-labelledby': 'available-h' },
    h('h2', { id: 'available-h' }, title),
    items.length > 0
      ? h('ul', { class: 'cards' }, items)
      : h('p', {}, inherited ? 'Nothing removed. A rule you remove appears here and can be restored at the bottom of the rule base.' : 'Every rule is in your rule base.'),
  );
}

function hintPanel(vm) {
  const c = vm.challenge;
  const hint = vm.hint;
  if (!hint) return null;
  const names = hostNames(c);
  const titles = { 1: 'Hint 1 of 3: method', 2: 'Hint 2 of 3: one worked step', 3: 'Hint 3 of 3: worked solution' };
  return h('div', { class: 'hint', role: 'note' },
    h('h3', {}, titles[hint.stage]),
    hint.stage < 3
      ? h('p', {}, hint.text)
      : [
          h('p', {}, 'One rule base that completes this level. Viewing it is recorded as assistance. You still have to build and submit it.'),
          h('ol', {}, hint.solution.map((entry) => {
            const rule = c.rules[entry.ruleId];
            const on = Object.keys(rule.controls || {}).filter((n) => (n in entry.controls ? entry.controls[n] : rule.controls[n]));
            return h('li', {}, `${rule.label}${on.length > 0 ? `, with ${on.map(controlLabel).join(' and ')} on` : ''} (destination ${address(rule.dstAddress, names)})`);
          })),
        ],
  );
}

function renderBuild(vm, ui) {
  const c = vm.challenge;
  const p = vm.progress;
  const hintsLeft = p.hintStage < 3;
  const count = vm.workingRuleBase.length;
  return [
    heading(`${levelTitle(vm)}. ${vm.hardening ? 'Harden your rule base' : 'Build your rule base'}`),
    levelTrack(vm),
    vm.hardening ? h('p', { class: 'note' }, `This level is completed with ${p.bankedScore} points. A higher score replaces it. A lower or failing result changes nothing.`) : null,
    h('div', { class: 'build-grid' },
      h('div', { class: 'build-side' },
        h('section', { 'aria-labelledby': 'request-h' },
          h('h2', { id: 'request-h' }, 'Business request'),
          h('p', { class: 'request' }, c.request),
          h('h3', {}, 'Traffic that must keep working'),
          h('ul', { class: 'flow-list' }, c.requiredFlows.map((f) => h('li', {}, h('strong', {}, f.label), h('div', { class: 'values' }, describeFlow(f))))),
        ),
        topologySection(c),
      ),
      h('div', { class: 'build-main' },
        ruleBaseSection(vm, ui),
        availableSection(vm),
        h('section', { 'aria-labelledby': 'help-h' },
          h('h2', { id: 'help-h' }, 'Progress and help'),
          h('p', {}, `Attempts on this level: ${p.attempts}. Hints used: ${p.hintStage} of 3${p.hintStage === 3 ? ' (worked solution viewed)' : ''}. Hints and retries carry no penalty.`),
          h('div', { class: 'actions' }, button(hintsLeft ? `Show hint ${p.hintStage + 1} of 3` : 'Show worked solution again', 'hint')),
          hintPanel(vm),
        ),
      ),
    ),
    vm.guidance ? h('p', { class: 'guidance', role: 'alert' }, vm.guidance) : null,
    h('div', { class: 'actions sticky-actions' },
      button('Run penetration test', 'submit', { primary: true }),
      h('span', { class: 'bar-note' }, `${count} rule${count === 1 ? '' : 's'} in your rule base. No time limit.`)),
  ];
}

// ---------- result ----------

function verdictLine(owner, side) {
  return h('p', { class: 'verdict-line' },
    h('strong', {}, `${owner}: `),
    h('span', { class: `verdict verdict-${side.verdict}` }, side.word),
    `. ${side.text}`,
  );
}

function renderResult(vm) {
  const c = vm.challenge;
  const result = vm.lastResult;
  const ex = explainResult(result, c, vm.workingRuleBase);
  const p = vm.progress;
  const total = ex.steps.length;
  const shown = vm.revealedSteps;
  const allShown = total === 0 || shown >= total;

  const parts = [
    heading(`${levelTitle(vm)}. ${ex.heading}`),
    levelTrack(vm),
    h('div', { class: `outcome outcome-${ex.tone} outcome-${result.outcome}` },
      result.completed ? confetti() : null,
      result.outcome === 'outage' ? null : shieldArt('player', result.completed ? 'won' : 'breached', 72),
      h('div', { class: 'outcome-text' },
        h('p', {}, h('strong', {}, `Result: ${ex.heading}. `), ex.intro),
        result.completed ? h('p', { class: 'unlocked' }, 'Capability on your firewall: ', capabilityBadge(vm.level.capability)) : null)),
    ex.nextStep ? h('p', { class: 'next-step' }, ex.nextStep) : null,
    ex.why ? h('p', { class: 'why' }, ex.why) : null,
    h('section', { 'aria-labelledby': 'service-h' },
      h('h2', { id: 'service-h' }, 'Required traffic check'),
      h('ul', {}, ex.service.map((s) => h('li', {},
        h('strong', {}, `${s.label}: `),
        h('span', { class: `verdict verdict-${s.ok ? 'allowed-good' : 'blocked-bad'}` }, s.ok ? 'Allowed' : `${s.word} (should be allowed)`),
        `. ${s.text}`,
        h('div', { class: 'values' }, s.values)))),
    ),
  ];

  if (result.outcome === 'outage') {
    parts.push(h('section', { 'aria-labelledby': 'pentest-h' },
      h('h2', { id: 'pentest-h' }, 'Penetration test'),
      (() => {
        const failing = result.serviceCheck.find((v) => v.verdict !== 'allowed');
        const flow = c.requiredFlows.find((f) => f.id === failing.flowId);
        return playfieldCanvas('battle', {
          title: 'CUSTOMER TRAFFIC',
          sides: [sideModel('player', 'YOUR FIREWALL', vm.workingRuleBase, c, failing, flow, { friendly: true })],
        }, `Animation: a customer packet is blocked at your wall. ${ex.intro}`);
      })(),
      h('p', {}, 'The penetration test did not run, because the business cannot operate with required traffic blocked. Blocking everything is an outage, not a defense.')));
  } else {
    const last = shown > 0 ? ex.steps[shown - 1] : null;

    // The arena reflects only the steps revealed so far.
    const fighter = (side, name, breachStep) => {
      const fallen = breachStep !== null && breachStep <= shown;
      const state = fallen ? 'breached' : allShown && breachStep === null ? 'won' : 'intact';
      const held = ex.steps.slice(0, shown).filter((st) => st[side].verdict !== 'allowed').length;
      const statusText = fallen
        ? `Breached at step ${breachStep}`
        : shown === 0 ? 'Waiting for the first attack' : allShown ? 'Survived every attack' : `Holding after step ${shown}`;
      const lastVerdict = shown > 0 ? ex.steps[shown - 1][side].verdict : null;
      const hit = lastVerdict === null ? '' : lastVerdict === 'allowed' ? 'hit-through' : 'hit-stopped';
      return h('div', { class: `fighter fighter-${side} ${fallen ? 'is-breached' : ''} ${state === 'won' ? 'is-won' : ''} ${hit}` },
        shieldArt(side, state, 96),
        h('div', { class: 'fighter-text' },
          h('h3', {}, name),
          h('p', { class: 'fighter-status' }, statusText),
          h('p', { class: 'fighter-count' }, `Attacks stopped: ${held} of ${shown} shown`),
          h('span', { class: 'pips', 'aria-hidden': 'true' }, ex.steps.map((st, i) => h('span', {
            class: `pip ${i >= shown ? 'pip-pending' : st[side].verdict === 'allowed' ? 'pip-through' : 'pip-stopped'}`,
          }))),
        ));
    };

    parts.push(h('section', { 'aria-labelledby': 'pentest-h' },
      h('h2', { id: 'pentest-h' }, 'Penetration test, one attack at a time'),
      (() => {
        const i = shown - 1;
        const flow = last ? c.attackSteps[i] : c.attackSteps[0];
        const side = (who, name, base, r) => sideModel(who, name, base, c, last ? r.attacks[i] : null, flow, {
          fallenBefore: r.breachStep !== null && r.breachStep < Math.max(shown, 1) && shown > 0,
          won: allShown && r.breachStep === null,
        });
        const text = last
          ? `Animation of attack ${last.n} of ${total}, ${last.label}. Your firewall: ${last.player.word}. Rival firewall: ${last.rival.word}. The details are written below.`
          : `Both walls are ready. ${total} attacks are queued. Use the button below to launch the first attack.`;
        return playfieldCanvas('battle', {
          title: last ? `ATTACK ${last.n}/${total}` : `${total} ATTACKS QUEUED`,
          sides: [side('player', 'YOUR FIREWALL', vm.workingRuleBase, result.player), side('rival', 'RIVAL FIREWALL', c.rival.ruleBase, result.rival)],
        }, text);
      })(),
      h('div', { class: 'arena' },
        fighter('player', 'Your firewall', result.player.breachStep),
        h('div', { class: 'arena-mid' },
          h('span', { class: 'vs', 'aria-hidden': 'true' }, 'VS'),
          last
            ? h('p', { class: 'incoming' }, h('span', { class: 'incoming-label' }, `Attack ${last.n} of ${total}`), last.label)
            : h('p', { class: 'incoming incoming-idle' }, `${total} attacks queued`)),
        fighter('rival', 'Rival firewall', result.rival.breachStep)),
      h('p', {}, `The same ${total} attack steps hit both firewalls in the same order. Showing ${shown} of ${total}.`),
      h('ol', { class: 'steps' }, ex.steps.slice(0, shown).map((s) => h('li', { class: `step ${s.n === shown ? 'step-new' : ''} ${s.player.verdict === 'allowed' ? 'step-through' : 'step-held'}` },
        h('h3', {}, `Step ${s.n}: ${s.label}`),
        h('p', { class: 'values' }, `${s.values}. Technique: ATT&CK ${s.techniqueIds.join(', ')}.`),
        verdictLine('Your firewall', s.player),
        verdictLine('Rival firewall', s.rival),
        s.lesson ? h('p', { class: 'lesson' }, s.lesson) : null,
      ))),
      allShown ? null : h('div', { class: 'actions' },
        button(shown === 0 ? 'Launch first attack' : 'Launch next attack', 'next-step', { primary: true }),
        button('Show full results', 'reveal-all')),
      last ? h('div', { class: 'faceoff' },
        readOnlyRuleTable(`Your rule base at step ${last.n}`, vm.workingRuleBase, c, { title: `Step ${last.n}`, matchedIndex: last.player.matchedIndex }),
        readOnlyRuleTable(`Rival rule base at step ${last.n}`, c.rival.ruleBase, c, { title: `Step ${last.n}`, matchedIndex: last.rival.matchedIndex }),
      ) : null,
    ));

    if (allShown) {
      parts.push(h('section', { 'aria-labelledby': 'score-h' },
        h('h2', { id: 'score-h' }, 'Score'),
        h('p', {}, `This rule base scores ${ex.score}: 10 for each attack step stopped, 5 for each piece of unrequested traffic denied. The rival's rule base scores ${ex.rivalScore}.`),
        h('p', {}, result.completed
          ? `Banked score for this level: ${p.bankedScore}. Only your best completed result counts; scores are never added together.`
          : 'Nothing is banked, because the level is not completed. Points bank only when required traffic passes and every attack step is stopped.'),
        ex.rivalNote ? h('p', {}, `About the rival: ${ex.rivalNote}`) : null,
      ));
      if (ex.exposures.length > 0) {
        parts.push(h('section', { 'aria-labelledby': 'exposure-h' },
          h('h2', { id: 'exposure-h' }, 'Exposure: traffic the request did not ask for'),
          h('ul', {}, ex.exposures.map((e) => h('li', {},
            h('strong', {}, `${e.label}: `), h('span', { class: 'verdict verdict-allowed' }, 'Allowed'), `. ${e.text} ${e.lesson || ''}`,
            h('div', { class: 'values' }, e.values)))),
        ));
      } else if (result.completed) {
        parts.push(h('p', { class: 'why' }, 'No exposure: nothing the request did not ask for gets through.'));
      }
    }
  }

  const actions = [];
  if (p.completed) {
    if (result.outcome !== 'survived-won' || ex.exposures.length > 0) actions.push(button('Harden further', 'harden'));
    actions.push(button(vm.isLastLevel ? 'See session summary' : 'Next level', 'next', { primary: true }));
  } else {
    actions.push(button('Retry this level', 'retry', { primary: true }));
  }
  parts.push(h('div', { class: 'actions' }, actions));
  return parts;
}

// ---------- summary ----------

function renderSummary(vm, summary) {
  const tierTable = (tier) => {
    const t = summary[tier];
    const done = t.levels.filter((l) => l.completed).length;
    return h('section', { 'aria-labelledby': `sum-${tier}` },
      h('h2', { id: `sum-${tier}` }, `${TIER_NAMES[tier]} tier`),
      h('p', {}, `Levels completed: ${done} of ${t.levels.length}. Firewall strength: ${t.strength}. Rival strength on the same levels: ${t.rivalStrength}.`),
      done > 0 ? compareBars(t.strength, t.rivalStrength) : null,
      t.capabilities.length > 0
        ? h('p', { class: 'badge-row' }, 'Capabilities learned: ', t.capabilities.map((cap) => capabilityBadge(cap)))
        : h('p', {}, 'Capabilities learned: none yet.'),
      h('div', { class: 'table-scroll', role: 'region', 'aria-label': `${TIER_NAMES[tier]} tier progress`, tabindex: '0' },
        h('table', {},
          h('caption', {}, `${TIER_NAMES[tier]} tier, level by level`),
          h('thead', {}, h('tr', {}, ['Level', 'Status', 'Attempts', 'Assistance used', 'Banked score'].map((x) => h('th', { scope: 'col' }, x)))),
          h('tbody', {}, t.levels.map((l, i) => h('tr', {},
            h('th', { scope: 'row' }, `${i + 1}. ${l.title}`),
            h('td', {}, l.status !== 'ok' ? 'Not available in this release' : l.completed ? 'Completed' : 'Not completed'),
            h('td', {}, String(l.attempts)),
            h('td', {}, l.hintStage === 0 ? 'None' : l.hintStage === 3 ? 'All 3 hints, including the worked solution' : `${l.hintStage} of 3 hints`),
            h('td', {}, String(l.bankedScore))))),
        ),
      ),
    );
  };
  return [
    heading('Session summary'),
    h('p', { class: 'lead' }, 'Completed levels, attempts, and assistance are shown separately. A completed level shows what you built; it does not by itself show you could do it unaided.'),
    tierTable('standard'),
    tierTable('expert'),
    h('p', {}, 'Progress is kept for this page session only. Reloading the page starts again.'),
    h('div', { class: 'actions' }, vm.levels.some((l) => !l.completed && l.available && l.status === 'ok')
      ? button('Continue playing', 'continue', { primary: true }) : null),
  ];
}

// ---------- content error ----------

function renderContentError(vm) {
  if (vm.fileErrors.length > 0 || !vm.tier) {
    return [
      heading('The game content could not be read'),
      h('p', {}, 'This is a problem with the game\'s level file, not with anything you did. Nothing was graded.'),
      h('ul', {}, vm.fileErrors.map((e) => h('li', {}, e))),
      h('div', { class: 'actions' }, button('Retry loading', 'retry-load', { primary: true })),
    ];
  }
  const s = vm.challengeStatus;
  const other = vm.tier === 'standard' ? 'expert' : 'standard';
  return [
    heading(`${levelTitle(vm)}. ${s.status === 'unavailable' ? 'Not available in this release' : 'Content error'}`),
    s.status === 'unavailable'
      ? h('p', {}, `The ${TIER_NAMES[vm.tier]} version of this level is not available in this release.`)
      : h('p', {}, 'This level has a content error and cannot be graded. This is an authoring problem, not a mistake by you. No attempt, score, or progress is recorded.'),
    s.errors.length > 0 ? h('ul', {}, s.errors.map((e) => h('li', {}, e))) : null,
    h('div', { class: 'actions' },
      button(`Switch to ${TIER_NAMES[other]}`, 'switch-tier', { primary: true, key: 'switch-tier-main', data: { tier: other } }),
      button('Progress summary', 'summary', { key: 'summary-main' })),
  ];
}

// ---------- entry point ----------

export function renderApp(vm, ui, extras) {
  const parts = [];
  if (ui.confirm) parts.push(renderConfirm(ui.confirm));
  let body;
  switch (vm.view) {
    case 'tier-select': body = renderTierSelect(vm, ui); break;
    case 'briefing': body = renderBriefing(vm, extras.sources); break;
    case 'build': body = renderBuild(vm, ui); break;
    case 'result': body = renderResult(vm); break;
    case 'summary': body = renderSummary(vm, extras.summary); break;
    default: body = renderContentError(vm);
  }
  return parts.concat(body).flat().filter(Boolean);
}

export { explainResult };
