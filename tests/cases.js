// The hand-worked cases from specs/001-firewall-faceoff/spec.md,
// "Cases the implementation must satisfy", as literal expected values.
//
// These values are copied from the spec. They are never computed by calling
// the engine. If a case and the engine disagree, re-derive the case from the
// spec's technical model.
//
// ruleBase entries: 'R1' or ['R2', { controlName: true|false }].
// decided: flow id -> 1-based rule position that decides it, or 'implicit'.
// allowed / stopped: flow ids the player's firewall lets through / stops by a control.

const T = 'threatInspection';
const D = 'tlsDecryption';
const N = 'dnsFiltering';

// Rival results stated in the spec for each challenge.
export const RIVALS = {
  'level-1/standard': { breachStep: 1, score: 30 },
  'level-2/standard': { breachStep: 1, score: 15 },
  'level-3/standard': { breachStep: 4, score: 40 },
  'level-1/expert': { breachStep: 3, score: 45 },
  'level-2/expert': { breachStep: 5, score: 50 },
  'level-3/expert': { breachStep: 3, score: 50 },
};

export const CASES = [
  // ---- Level 1 Standard ----
  { id: '1-correct', level: 'level-1', tier: 'standard', ruleBase: ['R1'],
    expect: { outcome: 'survived-won', completed: true, score: 40, playerBreach: null,
      decided: { F1: 1, A1: 'implicit', A2: 'implicit', A3: 'implicit', P1: 'implicit', P2: 'implicit' }, allowed: ['F1'] } },
  { id: '1-correct-alternative', level: 'level-1', tier: 'standard', ruleBase: ['R1', 'R3'],
    expect: { outcome: 'survived-won', completed: true, score: 40, playerBreach: null,
      decided: { F1: 1, A1: 2, A2: 2, A3: 2 }, allowed: ['F1'] } },
  { id: '1-mistake-deny-first', level: 'level-1', tier: 'standard', ruleBase: ['R3', 'R1'],
    expect: { outcome: 'outage', completed: false, decided: { F1: 1 }, laterMatches: { F1: [2] } } },
  { id: '1-mistake-broad-allow', level: 'level-1', tier: 'standard', ruleBase: ['R1', 'R2'],
    expect: { outcome: 'both-breached', completed: false, playerBreach: 1, decided: { A1: 2 }, allowed: ['F1', 'A1'] } },
  { id: '1-outlasted-but-breached', level: 'level-1', tier: 'standard', ruleBase: ['R1', 'R7'],
    expect: { outcome: 'outlasted-but-breached', completed: false, playerBreach: 2,
      decided: { A1: 'implicit', A2: 2 }, allowed: ['F1', 'A2'] } },
  { id: '1-boundary-exposure', level: 'level-1', tier: 'standard', ruleBase: ['R4'],
    expect: { outcome: 'survived-won', completed: true, score: 35, playerBreach: null,
      decided: { P1: 1 }, exposures: ['P1'] } },
  { id: '1-boundary-stateful', level: 'level-1', tier: 'standard', ruleBase: ['R1', 'R6'],
    expect: { outcome: 'survived-won', completed: true, score: 35, playerBreach: null,
      decided: { P2: 2 }, exposures: ['P2'] } },
  { id: '1-no-input', level: 'level-1', tier: 'standard', ruleBase: [], kind: 'empty' },

  // ---- Level 2 Standard ----
  { id: '2-correct', level: 'level-2', tier: 'standard',
    ruleBase: [['R2', { [T]: true, [D]: true }], ['R3', { [N]: true }]],
    expect: { outcome: 'survived-won', completed: true, score: 40, playerBreach: null,
      decided: { F1: 1, F2: 2, A1: 'implicit', A2: 1, A3: 2, P1: 'implicit', P2: 'implicit' },
      stopped: { A2: T, A3: N } } },
  { id: '2-mistake-no-decryption', level: 'level-2', tier: 'standard',
    ruleBase: [['R2', { [T]: true, [D]: false }], ['R3', { [N]: true }]],
    expect: { outcome: 'outlasted-but-breached', completed: false, playerBreach: 2,
      decided: { A1: 'implicit', A2: 1 }, allowed: ['A2'], reasons: { A2: 'inspection-blind-encrypted' } } },
  { id: '2-mistake-port-rule', level: 'level-2', tier: 'standard',
    ruleBase: [['R1', { [T]: true, [D]: true }], ['R3', { [N]: true }]],
    expect: { outcome: 'both-breached', completed: false, playerBreach: 1, decided: { A1: 1 }, allowed: ['A1'] } },
  { id: '2-boundary-exposure', level: 'level-2', tier: 'standard',
    ruleBase: [['R2', { [T]: true, [D]: true }], ['R4', { [N]: true }]],
    expect: { outcome: 'survived-won', completed: true, score: 35, playerBreach: null,
      decided: { P1: 2 }, exposures: ['P1'] } },

  // ---- Level 3 Standard ----
  { id: '3-correct', level: 'level-3', tier: 'standard',
    ruleBase: [['R3', { [T]: true }], ['R4', { [T]: true }]],
    expect: { outcome: 'survived-won', completed: true, score: 55, playerBreach: null,
      decided: { F1: 1, F2: 2, A1: 'implicit', A2: 'implicit', A3: 'implicit', A4: 2, P1: 'implicit', P2: 'implicit', P3: 1 },
      stopped: { A4: T, P3: T } } },
  { id: '3-mistake-shadowed-deny', level: 'level-3', tier: 'standard', ruleBase: ['R2', 'R3', 'R4', 'R5'],
    expect: { outcome: 'outage', completed: false, decided: { F1: 1 }, laterMatches: { F1: [2] } } },
  { id: '3-mistake-unchanged', level: 'level-3', tier: 'standard', ruleBase: ['R1', 'R2', 'R3', 'R4', 'R5'],
    expect: { outcome: 'breached-first', completed: false, playerBreach: 1, decided: { A1: 1 }, allowed: ['A1'] } },
  { id: '3-same-step-as-rival', level: 'level-3', tier: 'standard',
    ruleBase: [['R3', { [T]: false }], ['R4', { [T]: false }]],
    expect: { outcome: 'both-breached', completed: false, playerBreach: 4,
      decided: { A1: 'implicit', A2: 'implicit', A3: 'implicit', A4: 2 }, allowed: ['A4'] } },
  { id: '3-boundary-exposure', level: 'level-3', tier: 'standard',
    ruleBase: [['R3', { [T]: false }], ['R4', { [T]: true }]],
    expect: { outcome: 'survived-won', completed: true, score: 50, playerBreach: null, exposures: ['P3'] } },

  // ---- Level 1 Expert ----
  { id: '1E-correct', level: 'level-1', tier: 'expert', ruleBase: ['E4', 'E3', 'E5', 'E6', 'E8'],
    expect: { outcome: 'survived-won', completed: true, score: 65, playerBreach: null,
      decided: { F1: 4, F2: 3, F3: 2, F4: 5, A1: 'implicit', A2: 'implicit', A3: 1, A4: 'implicit', A5: 'implicit', P1: 'implicit', P2: 'implicit', P3: 1 } } },
  { id: '1E-mistake-unchanged', level: 'level-1', tier: 'expert',
    ruleBase: ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9'],
    expect: { outcome: 'breached-first', completed: false, playerBreach: 1, decided: { A1: 2 }, allowed: ['F1', 'F2', 'F3', 'F4', 'A1'] } },
  { id: '1E-mistake-blocklist-below', level: 'level-1', tier: 'expert', ruleBase: ['E1', 'E3', 'E4', 'E5', 'E6', 'E8'],
    expect: { outcome: 'both-breached', completed: false, playerBreach: 3,
      decided: { A1: 'implicit', A2: 'implicit', A3: 1 }, allowed: ['A3'] } },
  { id: '1E-mistake-mail-outage', level: 'level-1', tier: 'expert', ruleBase: ['E4', 'E3', 'E5', 'E6'],
    expect: { outcome: 'outage', completed: false, decided: { F4: 'implicit' } } },
  { id: '1E-boundary-exposure', level: 'level-1', tier: 'expert', ruleBase: ['E4', 'E3', 'E5', 'E1', 'E8'],
    expect: { outcome: 'survived-won', completed: true, score: 60, playerBreach: null,
      decided: { P1: 4 }, exposures: ['P1'] } },

  // ---- Level 2 Expert ----
  { id: '2E-correct', level: 'level-2', tier: 'expert',
    ruleBase: [['X2', { [T]: true, [D]: true }], ['X4', { [T]: true, [D]: true }], ['X6', { [N]: true }]],
    expect: { outcome: 'survived-won', completed: true, score: 60, playerBreach: null,
      decided: { A1: 'implicit', A2: 'implicit', A3: 1, A4: 3, A5: 2, P1: 'implicit', P2: 'implicit' },
      stopped: { A3: T, A4: N, A5: T } } },
  { id: '2E-mistake-unchanged', level: 'level-2', tier: 'expert',
    ruleBase: ['X1', 'X2', 'X3', 'X4', 'X5', 'X6', 'X7', 'X8'],
    expect: { outcome: 'breached-first', completed: false, playerBreach: 1, decided: { A1: 1 }, allowed: ['F1', 'F2', 'F3', 'F4', 'A1'] } },
  { id: '2E-mistake-app-rule-too-broad', level: 'level-2', tier: 'expert',
    ruleBase: ['X2', 'X4', 'X5', 'X6', 'X7', 'X8'],
    expect: { outcome: 'breached-first', completed: false, playerBreach: 1, decided: { A1: 6 }, allowed: ['A1'] } },
  { id: '2E-same-step-as-rival', level: 'level-2', tier: 'expert',
    ruleBase: [['X2', { [T]: true, [D]: true }], ['X4', { [T]: false, [D]: false }], ['X6', { [N]: true }]],
    expect: { outcome: 'both-breached', completed: false, playerBreach: 5,
      decided: { A1: 'implicit', A2: 'implicit', A5: 2 }, stopped: { A3: T, A4: N }, allowed: ['A5'] } },
  { id: '2E-boundary-exposure', level: 'level-2', tier: 'expert',
    ruleBase: [['X2', { [T]: true, [D]: true }], ['X3', { [T]: true, [D]: true }], ['X4', { [T]: true, [D]: true }], ['X6', { [N]: true }]],
    expect: { outcome: 'survived-won', completed: true, score: 55, playerBreach: null,
      decided: { A2: 2, A5: 2, P2: 2 }, stopped: { A2: T, A5: T }, exposures: ['P2'] } },

  // ---- Level 3 Expert ----
  { id: '3E-correct', level: 'level-3', tier: 'expert',
    ruleBase: [['Y3', { [T]: true }], ['Y5', { [T]: true }], ['Y6', { [T]: true }]],
    expect: { outcome: 'survived-won', completed: true, score: 75, playerBreach: null,
      decided: { F1: 1, F2: 3, F3: 2, A1: 'implicit', A2: 'implicit', A3: 'implicit', A4: 2, A5: 'implicit', A6: 3, P1: 'implicit', P2: 1, P3: 'implicit' },
      stopped: { A4: T, A6: T, P2: T } } },
  { id: '3E-mistake-unchanged', level: 'level-3', tier: 'expert',
    ruleBase: ['Y1', 'Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8'],
    expect: { outcome: 'breached-first', completed: false, playerBreach: 1, decided: { A1: 1 }, allowed: ['F1', 'F2', 'F3', 'A1'] } },
  { id: '3E-mistake-shadowed-deny', level: 'level-3', tier: 'expert',
    ruleBase: ['Y2', 'Y3', 'Y4', 'Y5', 'Y6', 'Y7', 'Y8'],
    expect: { outcome: 'outage', completed: false, decided: { F1: 1 } } },
  { id: '3E-same-step-as-rival', level: 'level-3', tier: 'expert',
    ruleBase: [['Y3', { [T]: true }], ['Y4', { [T]: true }], ['Y6', { [T]: true }]],
    expect: { outcome: 'both-breached', completed: false, playerBreach: 3,
      decided: { A1: 'implicit', A2: 'implicit', A3: 2 }, allowed: ['A3'] } },
  { id: '3E-outlasted-but-breached', level: 'level-3', tier: 'expert',
    ruleBase: [['Y3', { [T]: true }], ['Y5', { [T]: false }], ['Y6', { [T]: true }]],
    expect: { outcome: 'outlasted-but-breached', completed: false, playerBreach: 4,
      decided: { A1: 'implicit', A2: 'implicit', A3: 'implicit', A4: 2 }, allowed: ['A4'] } },
  { id: '3E-boundary-exposure', level: 'level-3', tier: 'expert',
    ruleBase: [['Y3', { [T]: false }], ['Y5', { [T]: true }], ['Y6', { [T]: true }]],
    expect: { outcome: 'survived-won', completed: true, score: 70, playerBreach: null, exposures: ['P2'] } },
];

// Turns the shorthand into the engine's rule base shape.
export function toRuleBase(shorthand) {
  return shorthand.map((item) =>
    Array.isArray(item) ? { ruleId: item[0], controls: { ...item[1] } } : { ruleId: item, controls: {} }
  );
}

export function findChallenge(content, levelId, tier) {
  const level = content && content.levels ? content.levels.find((l) => l.id === levelId) : null;
  return level && level.challenges ? level.challenges[tier] : null;
}
