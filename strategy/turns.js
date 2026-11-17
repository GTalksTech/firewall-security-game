// Strategy edition: the turn timetable and the rules of a turn.
// No DOM, no 3D, no clock, no randomness, so the test suite can check it.
// Verdicts never come from this file: `judge` is engine/rules.js evaluateFlow.

import { arcadeOf } from '../game/logic.js';

export const RULES = {
  TRAVEL: 3,        // turns a unit is on the map before it reaches the gatehouse
  ACTIONS: 3,       // changes to the gatehouse allowed per turn
  MAX_HP: 5,        // attacks that may get in before the level is lost
  MAX_TRUST: 5,     // wanted traffic that may be turned away before the level is lost
  RIVAL_HP: 2,
  POINTS: { served: 5, stopped: 10, denied: 2, exposed: -5 },
};

// The turn on which attack step k first appears on the map.
export const attackTurn = (k) => 2 + 2 * k;

// A fixed timetable of what appears on the map on which turn.
// Requests (business orders) are announced on a turn; their traffic starts the turn after.
// Each attack step appears twice, three turns apart, so a first hit can be answered.
export function buildTurnPlan(c) {
  const cfg = arcadeOf(c);
  const waves = c.attackSteps.length;
  const lastSpawn = attackTurn(waves - 1) + 3;
  const requests = cfg.orders.map((o) => ({ ...o, turn: o.wave <= 0 ? 1 : attackTurn(o.wave - 1) }));
  const requestTurn = {};
  requests.forEach((r) => r.flows.forEach((id) => { requestTurn[id] = r.turn; }));
  const spawns = [];
  c.requiredFlows.forEach((flow, i) => {
    const first = (requestTurn[flow.id] || 1) + (requestTurn[flow.id] > 1 ? 1 : 0) + (i % 2);
    for (let t = first; t <= lastSpawn; t += 3) spawns.push({ turn: t, flow, kind: 'wanted', lane: i });
  });
  c.attackSteps.forEach((flow, k) => {
    for (const t of [attackTurn(k), attackTurn(k) + 3]) spawns.push({ turn: t, flow, kind: 'attack', lane: k });
  });
  c.probes.forEach((flow, i) => {
    const first = attackTurn(Math.min(waves - 1, 1 + i)) + 1;
    for (const t of [first, first + 4]) if (t <= lastSpawn) spawns.push({ turn: t, flow, kind: 'unneeded', lane: i });
  });
  spawns.sort((a, b) => a.turn - b.turn);
  spawns.forEach((s, i) => { s.id = i; });
  return { spawns, requests, requestTurn, lastTurn: lastSpawn + RULES.TRAVEL - 1, travel: RULES.TRAVEL };
}

// What happens to one unit at the gatehouse. `verdict` is the engine's answer.
export function outcomeOf(kind, verdict) {
  const v = verdict.verdict;
  if (v === 'stopped-by-control') return kind === 'wanted' ? 'served' : 'scanned';
  if (v === 'allowed') return kind === 'wanted' ? 'served' : kind === 'attack' ? 'breach' : 'exposed';
  return kind === 'wanted' ? 'turned-away' : kind === 'attack' ? 'stopped' : 'denied';
}
export const isBad = (outcome) => outcome === 'breach' || outcome === 'turned-away' || outcome === 'exposed';

// The banner on a unit: what the gatehouse, as it stands now, will do with it.
export function forecast(c, wall, spawn, judge) {
  const verdict = judge(wall, c.rules, spawn.flow);
  const outcome = outcomeOf(spawn.kind, verdict);
  const gate = verdict.matchedIndex === null ? null : verdict.matchedIndex + 1;
  const text = {
    served: 'GETS IN', 'turned-away': 'TURNED AWAY', breach: 'WILL BREACH', stopped: 'BLOCKED',
    scanned: 'CAUGHT BY SCAN', denied: 'BLOCKED', exposed: 'SLIPS IN',
  }[outcome];
  return { verdict, outcome, gate, text, bad: isBad(outcome) };
}

// How the gatehouse reaches its answer for one flow: each gate from the top is either
// passed over (no match), decides (first match), or is never reached.
export function traceFlow(c, wall, flow, judge) {
  let decided = false;
  return wall.map((entry, i) => {
    if (decided) return { gate: i + 1, ruleId: entry.ruleId, result: 'not-reached' };
    const alone = judge([entry], c.rules, flow);
    if (alone.verdict === 'denied-implicit') return { gate: i + 1, ruleId: entry.ruleId, result: 'no-match' };
    decided = true;
    return { gate: i + 1, ruleId: entry.ruleId, result: 'decides', verdict: alone.verdict };
  });
}

// A fresh game state for a level.
export function newGame(c) {
  return {
    turn: 1, actions: RULES.ACTIONS, hp: RULES.MAX_HP, trust: RULES.MAX_TRUST, score: 0,
    rivalHp: RULES.RIVAL_HP, rivalDownTurn: null,
    wall: [], units: [], leaks: 0, blocked: 0, exposed: 0, over: null,
    plan: buildTurnPlan(c),
  };
}

// Puts this turn's new arrivals on the map edge.
export function spawnTurn(game) {
  for (const s of game.plan.spawns) {
    if (s.turn === game.turn) game.units.push({ ...s, step: 0 });
  }
}

// Ends the turn: every unit moves one step, and those reaching the gatehouse are judged
// against the wall as it stands. Returns what happened, in order, for the screen to show.
export function endTurn(c, game, judge) {
  const events = [];
  const arriving = [];
  for (const u of game.units) {
    u.step += 1;
    if (u.step >= game.plan.travel) arriving.push(u);
  }
  game.units = game.units.filter((u) => u.step < game.plan.travel);
  for (const u of arriving) {
    const verdict = judge(game.wall, c.rules, u.flow);
    const outcome = outcomeOf(u.kind, verdict);
    const ruleId = verdict.matchedIndex === null ? null : game.wall[verdict.matchedIndex].ruleId;
    let points = 0;
    if (outcome === 'served') points = RULES.POINTS.served;
    else if (outcome === 'stopped' || (outcome === 'scanned' && u.kind === 'attack')) points = RULES.POINTS.stopped;
    else if (outcome === 'denied' || outcome === 'scanned') points = RULES.POINTS.denied;
    else if (outcome === 'exposed') { points = RULES.POINTS.exposed; game.exposed += 1; }
    else if (outcome === 'breach') { game.hp -= 1; game.leaks += 1; }
    else if (outcome === 'turned-away') { game.trust -= 1; game.blocked += 1; }
    game.score = Math.max(0, game.score + points);
    events.push({ unit: u, verdict, outcome, ruleId, gate: verdict.matchedIndex === null ? null : verdict.matchedIndex + 1, points });

    if (game.rivalDownTurn === null && u.kind === 'attack' && judge(c.rival.ruleBase, c.rules, u.flow).verdict === 'allowed') {
      game.rivalHp -= 1;
      events.push({ rivalHit: true, unit: u });
      if (game.rivalHp <= 0) { game.rivalDownTurn = game.turn; events.push({ rivalDown: true }); }
    }
    if (game.hp <= 0) { game.over = 'breach'; break; }
    if (game.trust <= 0) { game.over = 'outage'; break; }
  }
  if (!game.over) {
    if (game.turn >= game.plan.lastTurn) game.over = 'win';
    else { game.turn += 1; game.actions = RULES.ACTIONS; spawnTurn(game); }
  }
  return events;
}

// Requests that have been announced by this turn.
export const activeRequests = (game) => game.plan.requests.filter((r) => r.turn <= game.turn);
