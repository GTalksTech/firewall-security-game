// Arcade edition: the timetable, the labels, and the hints, checked without a screen.
// Every verdict used here comes from the rule engine, never from the arcade code.

import { test, assert, assertEqual } from './harness.js';
import { evaluateFlow, evaluateSubmission } from '../engine/rules.js';
import {
  TUNING, arcadeOf, buildSchedule, insideHosts, isOutbound, flowLabel, flowText, ruleText, leakHint, starsFor,
} from '../game/logic.js';

// The arcade plays the expert challenge of each level.
const arcadeChallenges = (content) => content.levels.map((level) => ({ id: level.id, c: level.challenges.expert }));

// Plays a fixed wall against the whole timetable and counts what happens.
function play(c, wall) {
  const out = { served: 0, blocked: 0, leaks: 0, exposed: 0, stopped: 0 };
  for (const item of buildSchedule(c).items) {
    const v = evaluateFlow(wall, c.rules, item.flow).verdict;
    if (item.kind === 'customer') out[v === 'allowed' ? 'served' : 'blocked'] += 1;
    else if (item.kind === 'attacker') out[v === 'allowed' ? 'leaks' : 'stopped'] += 1;
    else if (v === 'allowed') out.exposed += 1;
  }
  return out;
}

export function register(content) {
  registerTry(content);
  test('arcade: all three levels have an arcade setup on the expert challenge', () => {
    assertEqual(content.levels.length, 3);
    for (const { id, c } of arcadeChallenges(content)) assert(c.arcade && c.arcade.orders.length > 0, `${id} has no arcade orders`);
  });

  for (const { id, c } of arcadeChallenges(content)) {
    const cfg = arcadeOf(c);
    const plan = buildSchedule(c);

    test(`arcade ${id}: orders cover every required flow exactly once`, () => {
      const ordered = cfg.orders.flatMap((o) => o.flows).sort();
      assertEqual(ordered.join(','), c.requiredFlows.map((f) => f.id).sort().join(','));
    });

    test(`arcade ${id}: the first order starts with the level and later ones before the last wave`, () => {
      assertEqual(cfg.orders[0].wave, 0);
      for (const o of cfg.orders) assert(o.wave < c.attackSteps.length, `order on wave ${o.wave} arrives too late`);
    });

    test(`arcade ${id}: the timetable sends every flow, attack, and probe at least 3 times`, () => {
      for (const flow of [...c.requiredFlows, ...c.attackSteps, ...c.probes]) {
        const n = plan.items.filter((i) => i.flow.id === flow.id).length;
        assert(n >= 3, `${flow.id} is sent ${n} times`);
      }
    });

    test(`arcade ${id}: one wave per attack step, in order, after the warm-up`, () => {
      assertEqual(plan.waveStarts.length, c.attackSteps.length);
      assertEqual(plan.waveStarts[0], TUNING.WARMUP);
      c.attackSteps.forEach((step, k) => {
        const first = plan.items.find((i) => i.flow.id === step.id);
        assert(first.t >= plan.waveStarts[k], `${step.id} arrives before its wave`);
      });
      const firstThreat = plan.items.find((i) => i.kind !== 'customer');
      assert(firstThreat.t >= TUNING.WARMUP, 'something hostile arrives during the warm-up');
    });

    test(`arcade ${id}: ordered traffic does not arrive before its order`, () => {
      for (const item of plan.items.filter((i) => i.kind === 'customer')) {
        assert(item.t >= plan.orderTime[item.flow.id], `${item.flow.id} arrives before its order`);
      }
    });

    test(`arcade ${id}: the reference wall serves everything and lets nothing hostile through`, () => {
      const out = play(c, c.referenceSolution);
      assertEqual(out.blocked, 0, 'blocked');
      assertEqual(out.leaks, 0, 'leaks');
      assertEqual(out.exposed, 0, 'exposed');
      assert(out.served > 0 && out.stopped > 0);
      const result = evaluateSubmission(c, c.referenceSolution);
      assertEqual(starsFor(result, { leaks: out.leaks, blocked: out.blocked, exposed: out.exposed, hp: TUNING.MAX_HP }), 3);
    });

    test(`arcade ${id}: the rival wall takes enough hits to go down`, () => {
      const out = play(c, c.rival.ruleBase);
      assert(out.leaks >= TUNING.RIVAL_HP, `the rival is hit ${out.leaks} times`);
    });

    test(`arcade ${id}: an empty wall blocks all wanted traffic`, () => {
      const out = play(c, []);
      assertEqual(out.served, 0);
      assertEqual(out.leaks, 0);
    });

    test(`arcade ${id}: every gate reads differently`, () => {
      const texts = Object.values(c.rules).map((r) => ruleText(c, r));
      assertEqual(new Set(texts).size, texts.length, texts.join(' | '));
    });

    test(`arcade ${id}: attacks and wanted traffic never share a label unless the engine treats them alike`, () => {
      for (const atk of c.attackSteps) {
        for (const req of c.requiredFlows) {
          if (flowText(c, atk) !== flowText(c, req)) continue;
          const same = Object.keys(c.rules).every((ruleId) => {
            const wall = [{ ruleId, controls: {} }];
            return evaluateFlow(wall, c.rules, atk).verdict === evaluateFlow(wall, c.rules, req).verdict;
          });
          assert(same, `${atk.id} and ${req.id} both read "${flowText(c, atk)}" but are judged differently`);
        }
      }
    });

    test(`arcade ${id}: every flow starts or ends at a host drawn behind the wall`, () => {
      const drawn = new Set(insideHosts(c).map((h) => h.address));
      for (const flow of [...c.requiredFlows, ...c.attackSteps, ...c.probes]) {
        const address = isOutbound(c, flow) ? flow.srcAddress : flow.dstAddress;
        assert(drawn.has(address), `${flow.id} uses ${address}, which is not drawn`);
      }
    });

    test(`arcade ${id}: a leak hint names the gate and a real fix`, () => {
      for (const atk of c.attackSteps) {
        for (const [ruleId, rule] of Object.entries(c.rules)) {
          const controls = Object.fromEntries(Object.keys(rule.controls || {}).map((n) => [n, false]));
          const v = evaluateFlow([{ ruleId, controls }], c.rules, atk);
          if (v.verdict !== 'allowed') continue;
          const hint = leakHint(c, atk, v, rule, 1);
          assert(hint.startsWith('GATE 1'), hint);
          if (hint.includes('SWITCH ON')) {
            const all = Object.fromEntries(Object.keys(rule.controls || {}).map((n) => [n, true]));
            const fixed = evaluateFlow([{ ruleId, controls: all }], c.rules, atk);
            assertEqual(fixed.verdict, 'stopped-by-control', `${atk.id} through ${ruleId}: "${hint}"`);
          }
        }
      }
    });
  }

  test('arcade: packet labels show payloads only on levels with scanner switches', () => {
    const [l1, l2] = arcadeChallenges(content).map((x) => x.c);
    assert(l1.attackSteps.every((f) => flowLabel(l1, f).payload === null), 'level 1 shows a payload');
    assert(l2.attackSteps.some((f) => flowLabel(l2, f).payload === 'MALWARE'), 'level 2 shows no malware');
    assert(l2.requiredFlows.some((f) => flowLabel(l2, f).locked), 'level 2 shows no locked traffic');
  });

  test('arcade: stars need a tight final wall and a clean run', () => {
    const ok = { completed: true, exposures: [] };
    assertEqual(starsFor(ok, { leaks: 0, blocked: 0, exposed: 0, hp: 5 }), 3);
    assertEqual(starsFor(ok, { leaks: 1, blocked: 0, exposed: 0, hp: 4 }), 2);
    assertEqual(starsFor(ok, { leaks: 3, blocked: 0, exposed: 0, hp: 2 }), 1);
    assertEqual(starsFor({ completed: true, exposures: ['P1'] }, { leaks: 0, blocked: 0, exposed: 1, hp: 5 }), 2);
    assertEqual(starsFor({ completed: false, exposures: [] }, { leaks: 0, blocked: 0, exposed: 0, hp: 5 }), 1);
  });
}

// Appended checks for the "TRY" markers.
import { candidatesFor, leakFix } from '../game/logic.js';
export function registerTry(content) {
  for (const level of content.levels) {
    const c = level.challenges.expert;
    test(`arcade ${level.id}: the switches flagged after a leak are exactly enough to stop it`, () => {
      let flagged = 0;
      for (const atk of [...c.attackSteps, ...c.probes]) {
        for (const [ruleId, rule] of Object.entries(c.rules)) {
          const off = Object.fromEntries(Object.keys(rule.controls || {}).map((n) => [n, false]));
          const v = evaluateFlow([{ ruleId, controls: off }], c.rules, atk);
          if (v.verdict !== 'allowed') continue;
          const fix = leakFix(atk, v, rule);
          if (fix.length === 0) continue;
          flagged += 1;
          const on = { ...off, ...Object.fromEntries(fix.map((n) => [n, true])) };
          assertEqual(evaluateFlow([{ ruleId, controls: on }], c.rules, atk).verdict, 'stopped-by-control', `${atk.id} via ${ruleId}`);
          for (const drop of fix) {
            const partial = { ...on, [drop]: false };
            assertEqual(evaluateFlow([{ ruleId, controls: partial }], c.rules, atk).verdict, 'allowed', `${atk.id} via ${ruleId} without ${drop}`);
          }
        }
      }
      if (Object.values(c.rules).some((r) => Object.keys(r.controls || {}).length > 0)) assert(flagged > 0, 'no leak was ever flagged');
    });
  }
  for (const level of content.levels) {
    const c = level.challenges.expert;
    test(`arcade ${level.id}: every wanted flow has a "TRY" gate, and the reference gate is among them`, () => {
      const ref = new Set(c.referenceSolution.map((e) => e.ruleId));
      for (const flow of c.requiredFlows) {
        const ids = candidatesFor(c, flow, evaluateFlow);
        assert(ids.length > 0, `${flow.id} has no candidate gate`);
        assert(ids.some((id) => ref.has(id)), `${flow.id}: no reference gate among ${ids.join(',')}`);
        assert(ids.every((id) => c.rules[id].action === 'allow'), 'a blocking gate is marked TRY');
      }
    });
  }
}
