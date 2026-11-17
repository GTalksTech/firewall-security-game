// Content validation: broken authored content must be rejected, shipped content accepted.

import { test, assert, assertEqual } from './harness.js';
import { validateContent } from '../engine/content.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

// Firewall vendor and product names that must never appear in shipped text (SC-006).
// This list lives in the tests only; it is not game content.
const VENDOR_TERMS = [
  'palo alto', 'pan-os', 'fortinet', 'fortigate', 'fortios', 'cisco', 'firepower', 'check point',
  'checkpoint', 'juniper', 'junos', 'sonicwall', 'sophos', 'zscaler', 'pfsense', 'opnsense',
  'watchguard', 'barracuda', 'forcepoint', 'app-id', 'user-id', 'content-id', 'meraki', 'netskope',
];

function collectStrings(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.push(k);
      collectStrings(v, out);
    }
  }
  return out;
}

export function register(content) {
  const statusOf = (doc) => validateContent(doc).challenges['level-1'].standard;

  // Each mutation breaks Level 1 Standard in exactly one way.
  const mutations = {
    'a missing required field': (c) => { delete c.request; },
    'an unknown rule action': (c) => { c.rules.R1.action = 'permit'; },
    'an unknown control name': (c) => { c.rules.R1.controls = { magicShield: true }; },
    'a starting rule that does not exist': (c) => { c.startingRuleBase = ['R99']; },
    'a rival rule that does not exist': (c) => { c.rival.ruleBase = [{ ruleId: 'R99', controls: {} }]; },
    'a duplicate flow id': (c) => { c.probes[0].id = 'A1'; },
    'an unknown zone on a flow': (c) => { c.attackSteps[0].toZone = 'Moon'; },
    'an unknown carries value': (c) => { c.attackSteps[0].carries = 'gremlins'; },
    'a required flow that carries something': (c) => { c.requiredFlows[0].carries = 'malware'; },
    'a required flow that is also an attack step': (c) => {
      const copy = clone(c.requiredFlows[0]);
      copy.id = 'A9'; copy.techniqueIds = ['T1190']; copy.lesson = 'x';
      c.attackSteps.push(copy);
    },
    'a rival that fails the service check': (c) => { c.rival.ruleBase = [{ ruleId: 'R3', controls: {} }]; },
    'a rival that is never breached': (c) => { c.rival.ruleBase = [{ ruleId: 'R1', controls: {} }]; },
    'a reference solution that does not complete the level': (c) => { c.referenceSolution = [{ ruleId: 'R2', controls: {} }]; },
    'a briefing with no source': (c) => { c.briefing.sourceIds = []; },
    'a source reference that does not resolve': (c) => { c.sourceIds = ['no-such-source']; },
    'an attack step with no technique': (c) => { c.attackSteps[0].techniqueIds = []; },
    'no attack steps': (c) => { c.attackSteps = []; },
    'the wrong number of hints': (c) => { c.hints = ['only one']; },
  };

  test('shipped content is valid', () => {
    const v = validateContent(content);
    assertEqual(v.fileErrors.length, 0, `file errors: ${v.fileErrors.join('; ')}`);
    assert(v.ok, 'content should be ok');
    for (const [levelId, tiers] of Object.entries(v.challenges)) {
      for (const [tier, s] of Object.entries(tiers)) {
        assert(s.status === 'ok' || s.status === 'unavailable', `${levelId}/${tier}: ${s.errors.join('; ')}`);
      }
    }
    for (const id of ['level-1', 'level-2', 'level-3']) {
      assertEqual(v.challenges[id].standard.status, 'ok', `${id}/standard`);
    }
  });

  for (const [name, mutate] of Object.entries(mutations)) {
    test(`rejects ${name}`, () => {
      const doc = clone(content);
      mutate(doc.levels[0].challenges.standard);
      const s = statusOf(doc);
      assertEqual(s.status, 'error', 'status');
      assert(s.errors.length > 0, 'an error message is required');
    });
  }

  test('a broken challenge leaves the others playable', () => {
    const doc = clone(content);
    doc.levels[0].challenges.standard.attackSteps = [];
    const v = validateContent(doc);
    assertEqual(v.fileErrors.length, 0, 'file errors');
    assertEqual(v.challenges['level-1'].standard.status, 'error', 'broken challenge');
    assertEqual(v.challenges['level-2'].standard.status, 'ok', 'other challenge');
  });

  test('a missing Expert tier is unavailable, not an error', () => {
    const doc = clone(content);
    delete doc.levels[0].challenges.expert;
    assertEqual(validateContent(doc).challenges['level-1'].expert.status, 'unavailable', 'status');
  });

  test('rejects the wrong schemaVersion as a file error', () => {
    const doc = clone(content);
    doc.schemaVersion = 2;
    const v = validateContent(doc);
    assert(!v.ok && v.fileErrors.length > 0, 'expected a file error');
  });

  test('rejects a document with no levels, duplicate level ids, or a non-object', () => {
    const none = clone(content); none.levels = [];
    assert(validateContent(none).fileErrors.length > 0, 'no levels');
    const dup = clone(content); dup.levels[1].id = dup.levels[0].id;
    assert(validateContent(dup).fileErrors.length > 0, 'duplicate ids');
    assert(validateContent(null).fileErrors.length > 0, 'null document');
  });

  test('shipped content holds no computed answers', () => {
    const keys = collectStrings(content);
    for (const banned of ['breachStep', 'rivalScore', 'expectedOutcome', 'score']) {
      assert(!keys.includes(banned), `levels.json must not contain "${banned}"`);
    }
  });

  test('shipped content names no firewall vendor or product (SC-006)', () => {
    const text = collectStrings(content).join('\n').toLowerCase();
    for (const term of VENDOR_TERMS) {
      assert(!text.includes(term), `vendor term found in levels.json: "${term}"`);
    }
  });
}
