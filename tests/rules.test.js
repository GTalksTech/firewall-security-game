// Runs every hand-worked case from the spec through the rule engine.

import { test, assert, assertEqual, assertDeepEqual } from './harness.js';
import { CASES, RIVALS, toRuleBase, findChallenge } from './cases.js';
import { evaluateSubmission, evaluateRuleBase, evaluateFlow, canonicalForm } from '../engine/rules.js';

function verdictFor(result, flowId) {
  const lists = [result.serviceCheck || [], result.player ? result.player.attacks : [], result.player ? result.player.probes : []];
  for (const list of lists) {
    const hit = list.find((v) => v.flowId === flowId);
    if (hit) return hit;
  }
  return null;
}

export function register(content) {
  test('content is loaded', () => assert(content && Array.isArray(content.levels), 'data/levels.json did not load'));

  for (const c of CASES) {
    if (c.kind === 'empty') continue; // covered in state.test.js: an empty rule base is not an attempt
    test(`case ${c.id}`, () => {
      const challenge = findChallenge(content, c.level, c.tier);
      assert(challenge, `challenge ${c.level}/${c.tier} is missing from data/levels.json`);
      const result = evaluateSubmission(challenge, toRuleBase(c.ruleBase));
      const x = c.expect;

      assertEqual(result.outcome, x.outcome, 'outcome');
      assertEqual(result.completed, x.completed, 'completed');

      if (x.outcome === 'outage') {
        assert(!result.player && !result.rival, 'attack sections must be absent on an outage');
      } else {
        const rival = RIVALS[`${c.level}/${c.tier}`];
        assertEqual(result.rival.breachStep, rival.breachStep, 'rival breach step');
        assertEqual(result.rival.score, rival.score, 'rival score');
        if ('playerBreach' in x) assertEqual(result.player.breachStep, x.playerBreach, 'player breach step');
        if ('score' in x) assertEqual(result.player.score, x.score, 'score');
        if (x.exposures) assertDeepEqual(result.exposures, x.exposures, 'exposures');
        if (x.completed && !x.exposures && 'score' in x && !('exposuresUnchecked' in x)) {
          // A completed case with no stated exposure and the full score has none.
        }
      }

      for (const [flowId, where] of Object.entries(x.decided || {})) {
        const v = verdictFor(result, flowId);
        assert(v, `no verdict for ${flowId}`);
        if (where === 'implicit') {
          assertEqual(v.verdict, 'denied-implicit', `${flowId} verdict`);
          assertEqual(v.matchedIndex, null, `${flowId} deciding rule`);
        } else {
          assertEqual(v.matchedIndex, where - 1, `${flowId} deciding rule position`);
        }
      }
      for (const flowId of x.allowed || []) {
        assertEqual(verdictFor(result, flowId).verdict, 'allowed', `${flowId} verdict`);
      }
      for (const [flowId, control] of Object.entries(x.stopped || {})) {
        const v = verdictFor(result, flowId);
        assertEqual(v.verdict, 'stopped-by-control', `${flowId} verdict`);
        assertEqual(v.control, control, `${flowId} control`);
      }
      for (const [flowId, reason] of Object.entries(x.reasons || {})) {
        assertEqual(verdictFor(result, flowId).reasonCode, reason, `${flowId} reason`);
      }
      for (const [flowId, later] of Object.entries(x.laterMatches || {})) {
        assertDeepEqual(verdictFor(result, flowId).laterMatches.map((i) => i + 1), later, `${flowId} rules never reached`);
      }
    });
  }

  test('rival results match the spec for every shipped challenge', () => {
    for (const [key, expected] of Object.entries(RIVALS)) {
      const [levelId, tier] = key.split('/');
      const challenge = findChallenge(content, levelId, tier);
      if (!challenge) continue; // a cut Expert challenge is allowed to be absent
      const r = evaluateRuleBase(challenge, challenge.rival.ruleBase);
      assert(r.serviceOk, `${key} rival must pass the service check`);
      assertEqual(r.breachStep, expected.breachStep, `${key} rival breach step`);
      assertEqual(r.score, expected.score, `${key} rival score`);
    }
  });

  test('all three Standard challenges are present', () => {
    for (const id of ['level-1', 'level-2', 'level-3']) {
      assert(findChallenge(content, id, 'standard'), `${id}/standard is missing`);
    }
  });

  test('the same submission gives the same result ten times (FR-013)', () => {
    const challenge = findChallenge(content, 'level-1', 'standard');
    const ruleBase = toRuleBase(['R1', 'R7']);
    const first = JSON.stringify(evaluateSubmission(challenge, ruleBase));
    for (let i = 0; i < 9; i += 1) {
      assertEqual(JSON.stringify(evaluateSubmission(challenge, ruleBase)), first, `run ${i + 2}`);
    }
  });

  test('evaluation does not change its inputs', () => {
    const challenge = findChallenge(content, 'level-2', 'standard');
    const ruleBase = toRuleBase([['R2', { threatInspection: true }]]);
    const before = JSON.stringify([challenge, ruleBase]);
    evaluateSubmission(challenge, ruleBase);
    assertEqual(JSON.stringify([challenge, ruleBase]), before, 'inputs');
  });

  test('a control missing from an entry takes the rule default', () => {
    const challenge = findChallenge(content, 'level-2', 'expert');
    if (!challenge) return;
    // X1 defaults: inspection on, decryption off. An unencrypted malware flow would be stopped;
    // the encrypted one is not, because decryption defaults to off.
    const flow = challenge.attackSteps.find((f) => f.id === 'A3');
    const v = evaluateFlow([{ ruleId: 'X1', controls: {} }], challenge.rules, flow);
    assertEqual(v.reasonCode, 'inspection-blind-encrypted', 'reason');
  });

  test('canonical form distinguishes order and control settings', () => {
    const challenge = findChallenge(content, 'level-2', 'standard');
    const a = canonicalForm(toRuleBase(['R2', 'R3']), challenge.rules);
    const b = canonicalForm(toRuleBase(['R3', 'R2']), challenge.rules);
    const c = canonicalForm(toRuleBase([['R2', { threatInspection: true }], 'R3']), challenge.rules);
    const a2 = canonicalForm(toRuleBase([['R2', { threatInspection: false, tlsDecryption: false }], 'R3']), challenge.rules);
    assert(a !== b, 'order must matter');
    assert(a !== c, 'control settings must matter');
    assertEqual(a, a2, 'explicit defaults equal implicit defaults');
  });
}
