// Arcade edition: everything that can be worked out without a screen.
// No DOM, clock, or randomness here, so the test suite can check it.
// Verdicts never come from this file; they come from engine/rules.js.

export const TUNING = {
  T_APPROACH: 2.4,  // seconds from spawn to the wall face
  T_CHECK: 0.11,    // per gate that does not match
  T_CROSS: 0.2,     // through an open gate
  T_TRAVEL: 0.75,   // from the wall to a server
  T_FADE: 0.45,
  WARMUP: 9,        // friendly traffic only; nothing is lost yet
  WAVE_LEN: 18,
  ORDER_GRACE: 7,   // seconds after a new order before blocked traffic costs patience
  MAX_HP: 5,
  MAX_PATIENCE: 5,
  RIVAL_HP: 3,
};

export const CONTROL_SHORT = { threatInspection: 'SCAN', tlsDecryption: 'DECRYPT', dnsFiltering: 'DNS FILTER' };
export const CONTROL_KEYS = { threatInspection: 's', tlsDecryption: 'd', dnsFiltering: 'f' };
const PAYLOAD = { malware: 'MALWARE', exploit: 'EXPLOIT', 'malicious-domain': 'BAD DOMAIN' };

export const waveTime = (w) => (w <= 0 ? 0 : TUNING.WARMUP + (w - 1) * TUNING.WAVE_LEN);

// Per-level arcade settings, with defaults for anything a level leaves out.
export function arcadeOf(c) {
  const a = c.arcade || {};
  return {
    orders: a.orders || [{ wave: 0, text: 'LET YOUR TRAFFIC THROUGH', short: 'TRAFFIC IN', flows: c.requiredFlows.map((f) => f.id) }],
    tags: a.tags || {},
    names: a.names || {},
    apps: a.apps || {},
    inside: a.inside || c.topology.zones.slice(1),
    friend: a.friend || 'CUSTOMERS',
    hp: a.hp || 'SERVERS',
    intro: a.intro || [],
  };
}

export const usesApps = (c) => Object.values(c.rules).some((r) => r.application);
export const usesControls = (c) => Object.values(c.rules).some((r) => Object.keys(r.controls || {}).length > 0);
export const usesDecrypt = (c) => Object.values(c.rules).some((r) => 'tlsDecryption' in (r.controls || {}));

// The hosts drawn on the protected (right-hand) side of the wall.
export function insideHosts(c) {
  const inside = arcadeOf(c).inside;
  return c.topology.hosts.filter((h) => inside.includes(h.zone));
}
export const isOutbound = (c, flowOrRule) => arcadeOf(c).inside.includes(flowOrRule.fromZone);

export function nameOf(c, address) {
  if (!address) return 'ANY';
  const a = arcadeOf(c);
  if (a.names[address]) return a.names[address];
  if (a.tags[address]) return a.tags[address];
  const host = c.topology.hosts.find((h) => h.address === address);
  return (host ? host.name : address).toUpperCase();
}
export const shortApp = (c, app) => arcadeOf(c).apps[app] || app.toUpperCase();

// A fixed timetable, so the same play always meets the same traffic.
// Warm-up: friendly traffic only. Then one wave per attack step; each wave adds
// that attack and it keeps coming. Orders arrive on set waves and add new
// friendly traffic that must be let through.
export function buildSchedule(c) {
  const { WARMUP, WAVE_LEN } = TUNING;
  const items = [];
  const waves = c.attackSteps.length;
  const end = WARMUP + waves * WAVE_LEN;
  const every = (flow, kind, from, gap) => {
    for (let t = from; t < end - 2; t += gap) items.push({ t, flow, kind });
  };
  const { orders } = arcadeOf(c);
  const orderTime = {};
  orders.forEach((o) => o.flows.forEach((id) => { orderTime[id] = waveTime(o.wave); }));
  c.requiredFlows.forEach((flow, i) => {
    const from = orderTime[flow.id] || 0;
    every(flow, 'customer', from + 0.4 + i * 0.7, i === 0 ? 1.7 : 3.4);
  });
  const waveStarts = [];
  for (let k = 0; k < waves; k += 1) {
    const start = WARMUP + k * WAVE_LEN;
    waveStarts.push(start);
    every(c.attackSteps[k], 'attacker', start + 2.6 + k * 0.3, 3.1);
  }
  c.probes.forEach((flow, i) => every(flow, 'stray', WARMUP + Math.min(waves - 1, 1 + i) * WAVE_LEN + 4 + i * 2.2, 7.5));
  items.sort((a, b) => a.t - b.t);
  return { items, waveStarts, end, orderTime, orders: orders.map((o) => ({ ...o, t: waveTime(o.wave), shown: false })) };
}

function portsOf(flowOrRule) {
  if (flowOrRule.services) return flowOrRule.services.map((s) => s.port).join('+');
  if (flowOrRule.port !== undefined) return String(flowOrRule.port);
  return null;
}

// What floats above a packet: who sent it (when that matters), its port, the
// application riding on it, and anything nasty it carries.
export function flowLabel(c, flow) {
  const a = arcadeOf(c);
  const parts = [portsOf(flow)];
  if (usesApps(c) && flow.application) parts.push(shortApp(c, flow.application));
  const outbound = isOutbound(c, flow);
  if (outbound) parts.push('OUT');
  const payload = usesControls(c) && PAYLOAD[flow.carries] ? PAYLOAD[flow.carries] : null;
  return {
    who: a.tags[flow.srcAddress] || (outbound ? nameOf(c, flow.srcAddress) : null),
    main: parts.filter(Boolean).join(' '),
    payload,
    locked: Boolean(flow.encrypted) && usesDecrypt(c),
  };
}
export function flowText(c, flow) {
  const l = flowLabel(c, flow);
  return [l.who, l.main, l.payload ? `+ ${l.payload}` : null].filter(Boolean).join(' ');
}

// What a gate tile says: who it lets through, what kind of traffic, and where to.
export function ruleParts(c, rule) {
  const a = arcadeOf(c);
  const outbound = isOutbound(c, rule);
  const leftZones = c.topology.zones.filter((z) => !a.inside.includes(z));
  let who = null;
  if (rule.userGroup) who = rule.userGroup.toUpperCase();
  else if (rule.srcAddress) who = nameOf(c, rule.srcAddress);
  else if (!outbound && leftZones.length > 1) who = rule.fromZone.toUpperCase();
  let kind = 'any';
  let what = 'ANY';
  if (rule.application) { kind = 'app'; what = shortApp(c, rule.application); }
  else if (rule.services) { kind = 'port'; what = portsOf(rule); }
  const where = outbound ? 'OUT' : rule.dstAddress ? nameOf(c, rule.dstAddress) : 'ANY';
  return { who, kind, what, where, showKind: usesApps(c) && kind !== 'any' };
}
export function ruleText(c, rule) {
  const p = ruleParts(c, rule);
  const what = p.showKind ? `${p.kind === 'app' ? 'APP' : 'PORT'} ${p.what}` : p.what;
  return `${rule.action === 'allow' ? 'ALLOW' : 'BLOCK'} ${p.who ? `${p.who} ` : ''}${what} TO ${p.where}`;
}

export const CONTROL_HELP = {
  threatInspection: 'SCAN: looks inside traffic this gate lets through and stops malware and exploits.',
  tlsDecryption: 'DECRYPT: unlocks encrypted traffic so SCAN can see inside it.',
  dnsFiltering: 'DNS FILTER: stops lookups of known-bad domains.',
};

// The switches on this gate that, turned on, would have stopped what got through.
export function leakFix(flow, verdict, rule) {
  const offers = Object.keys(rule.controls || {});
  const has = (n) => offers.includes(n);
  if (verdict.reasonCode === 'inspection-blind-encrypted') return has('tlsDecryption') ? ['tlsDecryption'] : [];
  if (verdict.reasonCode !== 'no-control') return [];
  if (flow.carries === 'malicious-domain') return has('dnsFiltering') ? ['dnsFiltering'] : [];
  if (!has('threatInspection')) return [];
  return flow.encrypted && has('tlsDecryption') ? ['threatInspection', 'tlsDecryption'] : ['threatInspection'];
}

// One line telling the player how to stop what just got through gate `n`.
export function leakHint(c, flow, verdict, rule, n) {
  const offers = Object.keys(rule.controls || {});
  const payload = PAYLOAD[flow.carries];
  if (verdict.reasonCode === 'inspection-blind-encrypted') {
    return offers.includes('tlsDecryption')
      ? `GATE ${n}: SCAN IS BLIND TO LOCKED TRAFFIC. SWITCH ON DECRYPT.`
      : `GATE ${n} CANNOT DECRYPT. SWAP IT FOR A GATE THAT CAN.`;
  }
  if (payload && verdict.reasonCode === 'no-control') {
    if (flow.carries === 'malicious-domain') {
      return offers.includes('dnsFiltering') ? `GATE ${n}: SWITCH ON DNS FILTER TO CATCH THE ${payload}.` : `GATE ${n} HAS NO DNS FILTER. SWAP IT.`;
    }
    if (offers.includes('threatInspection')) {
      const both = flow.encrypted && offers.includes('tlsDecryption');
      return `GATE ${n}: SWITCH ON SCAN${both ? ' AND DECRYPT' : ''} TO CATCH THE ${payload}.`;
    }
  }
  return `GATE ${n} IS TOO WIDE: IT LETS ${flowText(c, flow)} IN. SWAP IT.`;
}

// Spare gates that would, on their own, let this wanted traffic through.
// `judge` is engine/rules.js evaluateFlow, passed in so this file decides nothing.
export function candidatesFor(c, flow, judge) {
  return Object.keys(c.rules).filter((ruleId) => judge([{ ruleId, controls: {} }], c.rules, flow).verdict === 'allowed');
}

// Stars for a finished run. `result` is engine/rules.js evaluateSubmission of the final wall.
export function starsFor(result, run) {
  const tight = result.completed && result.exposures.length === 0;
  const clean = run.leaks === 0 && run.blocked === 0 && run.exposed === 0;
  if (tight && clean) return 3;
  if (result.completed && run.hp >= 3) return 2;
  return 1;
}
