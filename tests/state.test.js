// Session state: transitions, attempts, assistance, banking, unlocks, tiers, restart.

import { test, assert, assertEqual, assertDeepEqual } from './harness.js';
import { validateContent } from '../engine/content.js';
import { createSession } from '../engine/state.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

export function register(content) {
  const fresh = (doc = content) => createSession(doc, validateContent(doc));
  const ids = (s) => s.getState().workingRuleBase.map((e) => e.ruleId);

  // Builds a rule base in the build view: removes everything, then adds in order.
  const build = (s, ruleIds, controls = {}) => {
    while (s.getState().workingRuleBase.length > 0) s.removeRule(0);
    ruleIds.forEach((id) => s.addRule(id));
    for (const [id, settings] of Object.entries(controls)) {
      const index = ids(s).indexOf(id);
      for (const [name, on] of Object.entries(settings)) s.setControl(index, name, on);
    }
  };
  const toBuild = (tier = 'standard') => {
    const s = fresh();
    s.chooseTier(tier);
    s.startBuild();
    return s;
  };
  const completeLevel1 = (s) => { build(s, ['R1']); return s.submit(); };

  // ---- User Story 1: core flow ----

  test('a fresh session starts at tier selection', () => {
    assertEqual(fresh().getState().view, 'tier-select', 'view');
  });

  test('choosing a tier opens the Level 1 briefing before any editing', () => {
    const s = fresh();
    s.chooseTier('standard');
    const st = s.getState();
    assertEqual(st.view, 'briefing', 'view');
    assertEqual(st.level.id, 'level-1', 'level');
    assertEqual(st.tier, 'standard', 'tier');
  });

  test('editing is ignored until the build view is open', () => {
    const s = fresh();
    s.chooseTier('standard');
    s.addRule('R1');
    assertEqual(s.getState().workingRuleBase.length, 0, 'rule base');
  });

  test('add, remove, and move edit the working rule base', () => {
    const s = toBuild();
    s.addRule('R3'); s.addRule('R1');
    assertDeepEqual(ids(s), ['R3', 'R1'], 'after add');
    s.moveRule(1, 'up');
    assertDeepEqual(ids(s), ['R1', 'R3'], 'after move up');
    s.moveRule(0, 'down');
    assertDeepEqual(ids(s), ['R3', 'R1'], 'after move down');
    s.removeRule(0);
    assertDeepEqual(ids(s), ['R1'], 'after remove');
  });

  test('out-of-range moves, unknown rules, and duplicate adds are ignored', () => {
    const s = toBuild();
    s.addRule('R1'); s.addRule('R3');
    s.moveRule(0, 'up'); s.moveRule(1, 'down'); s.moveRule(7, 'up');
    s.addRule('R1'); s.addRule('NOPE'); s.removeRule(9);
    assertDeepEqual(ids(s), ['R1', 'R3'], 'rule base');
  });

  test('an empty submission gives guidance and is not an attempt', () => {
    const s = toBuild();
    const r = s.submit();
    assertEqual(r.kind, 'guidance', 'kind');
    const st = s.getState();
    assertEqual(st.view, 'build', 'view');
    assertEqual(st.progress.attempts, 0, 'attempts');
    assert(st.guidance, 'guidance text is shown');
  });

  test('a failing submission shows a result, counts one attempt, and can be retried', () => {
    const s = toBuild();
    build(s, ['R3', 'R1']);
    const r = s.submit();
    assertEqual(r.kind, 'result', 'kind');
    assertEqual(r.result.outcome, 'outage', 'outcome');
    let st = s.getState();
    assertEqual(st.view, 'result', 'view');
    assertEqual(st.progress.attempts, 1, 'attempts');
    assertEqual(st.progress.completed, false, 'completed');
    s.retry();
    st = s.getState();
    assertEqual(st.view, 'build', 'view after retry');
    assertDeepEqual(ids(s), ['R3', 'R1'], 'rule base kept');
  });

  test('a correct submission completes the level and banks the score', () => {
    const s = toBuild();
    const r = completeLevel1(s);
    assertEqual(r.result.outcome, 'survived-won', 'outcome');
    const st = s.getState();
    assertEqual(st.progress.completed, true, 'completed');
    assertEqual(st.progress.bankedScore, 40, 'banked score');
    assertEqual(st.strength, 40, 'strength');
    assertEqual(st.rivalStrength, 30, 'rival strength');
  });

  test('attack steps are revealed one at a time or all at once', () => {
    const s = toBuild();
    completeLevel1(s);
    assertEqual(s.getState().revealedSteps, 0, 'start');
    s.revealNextStep();
    assertEqual(s.getState().revealedSteps, 1, 'after one');
    s.revealAll();
    assertEqual(s.getState().revealedSteps, 3, 'after all');
    s.revealNextStep();
    assertEqual(s.getState().revealedSteps, 3, 'does not pass the end');
  });

  test('Next does nothing until the level is completed', () => {
    const s = toBuild();
    build(s, ['R1', 'R2']);
    s.submit();
    s.next();
    assertEqual(s.getState().level.id, 'level-1', 'level');
    assertEqual(s.getState().view, 'result', 'view');
  });

  // ---- User Story 2: help and honest progress ----

  test('hints go method, worked step, worked solution, and never complete the level', () => {
    const s = toBuild();
    const h1 = s.requestHint();
    assertEqual(h1.stage, 1, 'stage 1');
    assert(typeof h1.text === 'string' && h1.text.length > 0, 'method text');
    const h2 = s.requestHint();
    assertEqual(h2.stage, 2, 'stage 2');
    const h3 = s.requestHint();
    assertEqual(h3.stage, 3, 'stage 3');
    assert(Array.isArray(h3.solution) && h3.solution.length > 0, 'worked solution');
    const h4 = s.requestHint();
    assertEqual(h4.stage, 3, 'stays at 3');
    const st = s.getState();
    assertEqual(st.progress.hintStage, 3, 'hint stage recorded');
    assertEqual(st.progress.completed, false, 'not completed');
    assertEqual(st.progress.attempts, 0, 'no attempt');
    assertEqual(st.view, 'build', 'still building');
  });

  test('hints do not reduce the banked score', () => {
    const s = toBuild();
    s.requestHint(); s.requestHint(); s.requestHint();
    completeLevel1(s);
    assertEqual(s.getState().progress.bankedScore, 40, 'score');
  });

  test('each new failing submission is one attempt', () => {
    const s = toBuild();
    build(s, ['R3', 'R1']); s.submit(); s.retry();
    build(s, ['R1', 'R2']); s.submit();
    assertEqual(s.getState().progress.attempts, 2, 'attempts');
  });

  test('an identical resubmission of a failed rule base is not a new attempt', () => {
    const s = toBuild();
    build(s, ['R3', 'R1']);
    const first = s.submit();
    s.retry();
    const second = s.submit();
    assertEqual(second.repeated, true, 'flagged as repeated');
    assertEqual(JSON.stringify(second.result), JSON.stringify(first.result), 'same result shown');
    assertEqual(s.getState().progress.attempts, 1, 'attempts');
  });

  test('resubmitting after completion changes nothing', () => {
    const s = toBuild();
    completeLevel1(s);
    s.hardenFurther();
    s.submit(); s.hardenFurther(); s.submit();
    const st = s.getState();
    assertEqual(st.progress.attempts, 1, 'attempts');
    assertEqual(st.progress.bankedScore, 40, 'score not doubled');
    assertEqual(st.strength, 40, 'strength');
    assertEqual(st.capabilities.length, 1, 'capability added once');
  });

  test('Harden Further raises the banked score to the higher value, never the sum', () => {
    const s = toBuild();
    build(s, ['R4']);
    s.submit();
    assertEqual(s.getState().progress.bankedScore, 35, 'first score');
    s.hardenFurther();
    assertEqual(s.getState().view, 'build', 'back to build');
    build(s, ['R1']);
    s.submit();
    const st = s.getState();
    assertEqual(st.progress.bankedScore, 40, 'raised to 40, not 75');
    assertEqual(st.progress.attempts, 1, 'hardening is not an attempt');
  });

  test('a lower or failing hardening submission changes nothing', () => {
    const s = toBuild();
    completeLevel1(s);
    s.hardenFurther(); build(s, ['R4']); s.submit();
    assertEqual(s.getState().progress.bankedScore, 40, 'lower score ignored');
    s.hardenFurther(); build(s, ['R3', 'R1']); s.submit();
    const st = s.getState();
    assertEqual(st.progress.bankedScore, 40, 'failing submission ignored');
    assertEqual(st.progress.completed, true, 'still completed');
  });

  test('Harden Further is unavailable before completion', () => {
    const s = toBuild();
    build(s, ['R1', 'R2']); s.submit();
    s.hardenFurther();
    assertEqual(s.getState().view, 'result', 'view');
  });

  test('a completed level adds its capability once', () => {
    const s = toBuild();
    completeLevel1(s);
    assertDeepEqual(s.getState().capabilities, ['Least-privilege rule base'], 'capabilities');
  });

  test('the summary reports each tier separately', () => {
    const s = toBuild();
    s.requestHint();
    build(s, ['R3', 'R1']); s.submit(); s.retry();
    completeLevel1(s);
    const sum = s.summary();
    const std = sum.standard.levels[0];
    assertEqual(std.completed, true, 'standard level 1 completed');
    assertEqual(std.attempts, 2, 'attempts');
    assertEqual(std.hintStage, 1, 'assistance');
    assertEqual(sum.standard.strength, 40, 'strength');
    assertEqual(sum.standard.rivalStrength, 30, 'rival strength');
    assertEqual(sum.expert.levels[0].completed, false, 'expert level 1 not completed');
    assertEqual(sum.expert.strength, 0, 'expert strength');
  });

  test('Restart needs confirmation; cancel changes nothing, confirm clears everything', () => {
    const s = toBuild();
    completeLevel1(s);
    s.restart(false);
    assertEqual(s.getState().progress.completed, true, 'cancel keeps progress');
    assertEqual(s.getState().view, 'result', 'cancel keeps the view');
    s.restart(true);
    const st = s.getState();
    assertEqual(st.view, 'tier-select', 'back to tier selection');
    assertEqual(s.summary().standard.strength, 0, 'progress cleared');
    assertEqual(s.summary().standard.levels[0].attempts, 0, 'attempts cleared');
  });

  // ---- User Story 4: controls, inherited rule bases, unlocks ----

  test('Level 2 is locked until Level 1 is completed', () => {
    const s = toBuild();
    assertEqual(s.getState().levels[1].available, false, 'locked');
    completeLevel1(s);
    assertEqual(s.getState().levels[1].available, true, 'unlocked');
  });

  test('Next opens the following level briefing, and the summary after the last level', () => {
    const s = toBuild();
    completeLevel1(s);
    s.next();
    assertEqual(s.getState().view, 'briefing', 'briefing');
    assertEqual(s.getState().level.id, 'level-2', 'level 2');
    s.startBuild();
    build(s, ['R2', 'R3'], { R2: { threatInspection: true, tlsDecryption: true }, R3: { dnsFiltering: true } });
    assertEqual(s.submit().result.outcome, 'survived-won', 'level 2 outcome');
    s.next();
    s.startBuild();
    build(s, ['R3', 'R4'], { R3: { threatInspection: true }, R4: { threatInspection: true } });
    assertEqual(s.submit().result.outcome, 'survived-won', 'level 3 outcome');
    s.next();
    assertEqual(s.getState().view, 'summary', 'summary');
    const sum = s.summary().standard;
    assertEqual(sum.strength, 40 + 40 + 55, 'strength');
    assertEqual(sum.rivalStrength, 30 + 15 + 40, 'rival strength');
    assertEqual(sum.capabilities.length, 3, 'capabilities');
  });

  test('setControl switches a control the rule offers and ignores others', () => {
    const s = toBuild();
    completeLevel1(s); s.next(); s.startBuild();
    s.addRule('R2');
    s.setControl(0, 'threatInspection', true);
    assertEqual(s.getState().workingRuleBase[0].controls.threatInspection, true, 'switched on');
    s.setControl(0, 'dnsFiltering', true);
    assert(!('dnsFiltering' in s.getState().workingRuleBase[0].controls), 'unoffered control ignored');
  });

  test('a level with an inherited rule base starts with it, and a removed rule can be restored', () => {
    const s = toBuild();
    completeLevel1(s); s.next(); s.startBuild();
    build(s, ['R2', 'R3'], { R2: { threatInspection: true, tlsDecryption: true }, R3: { dnsFiltering: true } });
    s.submit(); s.next(); s.startBuild();
    assertDeepEqual(ids(s), ['R1', 'R2', 'R3', 'R4', 'R5'], 'starting rule base');
    assertDeepEqual(s.getState().availableRuleIds, [], 'nothing spare');
    s.removeRule(0);
    assertDeepEqual(s.getState().availableRuleIds, ['R1'], 'removed rule is available again');
    s.addRule('R1');
    assertDeepEqual(ids(s), ['R2', 'R3', 'R4', 'R5', 'R1'], 'restored at the bottom');
  });

  // ---- User Story 5: tiers ----

  test('switching tier between levels is free and keeps the other tier\'s progress', () => {
    const s = toBuild();
    completeLevel1(s);
    const r = s.switchTier('expert', false);
    assert(!r.needsConfirm, 'no confirmation needed after a submission');
    const st = s.getState();
    assertEqual(st.tier, 'expert', 'tier');
    assertEqual(st.view, 'briefing', 'view');
    assertEqual(st.level.id, 'level-1', 'stays on the same level');
    assertEqual(st.progress.completed, false, 'Standard completion is not an Expert completion');
    assertEqual(s.summary().standard.levels[0].completed, true, 'standard progress kept');
    assertEqual(st.levels[1].available, true, 'level 2 unlocked at both tiers');
  });

  test('switching tier with an unsubmitted rule base needs confirmation and then discards it', () => {
    const s = toBuild();
    s.addRule('R1');
    const r = s.switchTier('expert', false);
    assertEqual(r.needsConfirm, true, 'asks first');
    assertEqual(s.getState().tier, 'standard', 'unchanged until confirmed');
    s.switchTier('expert', true);
    assertEqual(s.getState().tier, 'expert', 'switched');
    s.switchTier('standard', false);
    s.startBuild();
    assertDeepEqual(ids(s), [], 'the unsubmitted rule base was discarded');
  });

  test('Expert challenges start with their inherited rule base', () => {
    const s = toBuild('expert');
    assertEqual(ids(s).length, 9, 'nine inherited rules');
  });

  test('a missing Expert challenge is unavailable and cannot be graded', () => {
    const doc = clone(content);
    delete doc.levels[0].challenges.expert;
    const s = fresh(doc);
    s.chooseTier('expert');
    assertEqual(s.getState().view, 'content-error', 'view');
    assertEqual(s.getState().challengeStatus.status, 'unavailable', 'status');
    assertEqual(s.submit().kind, 'content-error', 'submit refused');
    assertEqual(s.summary().expert.levels[0].status, 'unavailable', 'summary shows it');
  });

  test('a challenge that fails validation cannot be graded', () => {
    const doc = clone(content);
    doc.levels[0].challenges.standard.rival.ruleBase = [{ ruleId: 'R1', controls: {} }]; // rival survives everything
    const s = fresh(doc);
    s.chooseTier('standard');
    assertEqual(s.getState().view, 'content-error', 'view');
    assertEqual(s.submit().kind, 'content-error', 'submit refused');
    assertEqual(s.getState().progress.attempts, 0, 'no attempt');
  });
}
