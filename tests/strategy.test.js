// Strategy edition: the turn timetable and turn rules, checked without a screen.

import { test, assert, assertEqual } from './harness.js';
import { evaluateFlow, evaluateSubmission } from '../engine/rules.js';
import { starsFor } from '../game/logic.js';
import { RULES, buildTurnPlan, newGame, spawnTurn, endTurn, forecast, activeRequests, traceFlow } from '../strategy/turns.js';

// Plays a whole level. `wallFor(game)` returns the wall to use from this turn on, or null to keep it.
function playLevel(c, wallFor) {
  const game = newGame(c);
  spawnTurn(game);
  const log = [];
  let guard = 0;
  while (!game.over && guard < 100) {
    const next = wallFor(game);
    if (next) game.wall = next;
    log.push(...endTurn(c, game, evaluateFlow));
    guard += 1;
  }
  return { game, log };
}

// The wall a careful player would have: reference gates for the requests announced so far.
function referenceSoFar(c, game) {
  const needed = new Set(activeRequests(game).flatMap((r) => r.flows));
  const flows = c.requiredFlows.filter((f) => needed.has(f.id));
  return c.referenceSolution.filter((entry, i, all) => {
    const rule = c.rules[entry.ruleId];
    if (rule.action === 'deny') return true;
    return flows.some((f) => evaluateFlow([entry], c.rules, f).verdict === 'allowed');
  });
}

export function register(content) {
  for (const level of content.levels) {
    const c = level.challenges.expert;
    const plan = buildTurnPlan(c);

    test(`strategy ${level.id}: every flow, attack, and probe appears at least twice`, () => {
      for (const flow of [...c.requiredFlows, ...c.attackSteps, ...c.probes]) {
        const n = plan.spawns.filter((s) => s.flow.id === flow.id).length;
        assert(n >= 2, `${flow.id} appears ${n} times`);
      }
    });

    test(`strategy ${level.id}: nothing hostile reaches the gatehouse before the end of turn 4`, () => {
      const first = plan.spawns.find((s) => s.kind !== 'wanted');
      assert(first.turn + RULES.TRAVEL - 1 >= 4, `first hostile unit is judged on turn ${first.turn + RULES.TRAVEL - 1}`);
    });

    test(`strategy ${level.id}: a request's traffic never appears before the request`, () => {
      for (const s of plan.spawns.filter((x) => x.kind === 'wanted')) {
        assert(s.turn >= plan.requestTurn[s.flow.id], `${s.flow.id} appears on turn ${s.turn}`);
      }
      assertEqual(plan.requests[0].turn, 1);
    });

    test(`strategy ${level.id}: the level ends when the last unit has been judged`, () => {
      const last = Math.max(...plan.spawns.map((s) => s.turn + RULES.TRAVEL - 1));
      assertEqual(plan.lastTurn, last);
    });

    test(`strategy ${level.id}: the reference wall, built as requests arrive, wins with three stars`, () => {
      const { game } = playLevel(c, (g) => referenceSoFar(c, g));
      assertEqual(game.over, 'win');
      assertEqual(game.hp, RULES.MAX_HP);
      assertEqual(game.trust, RULES.MAX_TRUST);
      assertEqual(game.exposed, 0);
      const result = evaluateSubmission(c, game.wall);
      assertEqual(starsFor(result, { leaks: game.leaks, blocked: game.blocked, exposed: game.exposed, hp: game.hp }), 3);
      assert(game.rivalDownTurn !== null, 'the rival never went down');
    });

    test(`strategy ${level.id}: an empty wall loses to an outage, never a breach`, () => {
      const { game } = playLevel(c, () => null);
      assertEqual(game.over, 'outage');
      assertEqual(game.hp, RULES.MAX_HP);
    });

    test(`strategy ${level.id}: letting everything through is breached`, () => {
      const open = Object.entries(c.rules).filter(([, r]) => r.action === 'allow')
        .map(([ruleId, r]) => ({ ruleId, controls: Object.fromEntries(Object.keys(r.controls || {}).map((n) => [n, false])) }));
      const { game } = playLevel(c, () => open);
      assertEqual(game.over, 'breach');
    });

    test(`strategy ${level.id}: the forecast on a unit matches what then happens to it`, () => {
      const game = newGame(c);
      spawnTurn(game);
      game.wall = c.rival.ruleBase.map((e) => ({ ...e }));
      let checked = 0;
      while (!game.over && checked < 200) {
        const due = game.units.filter((u) => u.step === game.plan.travel - 1).map((u) => ({ id: u.id, f: forecast(c, game.wall, u, evaluateFlow) }));
        const events = endTurn(c, game, evaluateFlow).filter((e) => e.unit && e.outcome);
        for (const d of due) {
          const e = events.find((x) => x.unit.id === d.id);
          if (!e) continue; // the level ended before this unit was judged
          assertEqual(e.outcome, d.f.outcome, `unit ${d.id}`);
          checked += 1;
        }
      }
      assert(checked > 0);
    });
  }

  for (const level of content.levels) {
    const c = level.challenges.expert;
    test(`strategy ${level.id}: a trace names the same deciding gate as the engine`, () => {
      const walls = [c.referenceSolution, c.rival.ruleBase, Object.keys(c.rules).map((ruleId) => ({ ruleId, controls: {} })), []];
      for (const wall of walls) {
        for (const flow of [...c.requiredFlows, ...c.attackSteps, ...c.probes]) {
          const v = evaluateFlow(wall, c.rules, flow);
          const trace = traceFlow(c, wall, flow, evaluateFlow);
          assertEqual(trace.length, wall.length);
          const decider = trace.find((s) => s.result === 'decides');
          assertEqual(decider ? decider.gate - 1 : null, v.matchedIndex, flow.id);
          trace.forEach((s, i) => {
            const want = v.matchedIndex === null || i < v.matchedIndex ? 'no-match' : i === v.matchedIndex ? 'decides' : 'not-reached';
            assertEqual(s.result, want, `${flow.id} gate ${i + 1}`);
          });
        }
      }
    });
  }

  test('strategy: actions reset each turn and the score never goes below zero', () => {
    const c = content.levels[0].challenges.expert;
    const game = newGame(c);
    spawnTurn(game);
    game.actions = 0;
    endTurn(c, game, evaluateFlow);
    assertEqual(game.actions, RULES.ACTIONS);
    assert(game.score >= 0);
  });
}
