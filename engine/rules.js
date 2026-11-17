// Pure rule engine. No DOM, network, clock, or randomness: the same inputs
// always produce the same result (FR-013).
// Contract: specs/001-firewall-faceoff/contracts/engine-api.md

export const CONTROL_NAMES = ['threatInspection', 'tlsDecryption', 'dnsFiltering'];

const POINTS_PER_ATTACK_STOPPED = 10;
const POINTS_PER_PROBE_DENIED = 5;

// The on/off state of every control a rule offers, for one rule base entry.
// A control missing from the entry takes the rule's default.
export function resolveControls(rule, entry) {
  const resolved = {};
  const chosen = (entry && entry.controls) || {};
  for (const name of Object.keys(rule.controls || {})) {
    resolved[name] = name in chosen ? Boolean(chosen[name]) : Boolean(rule.controls[name]);
  }
  return resolved;
}

// A rule matches when every field it specifies equals the flow's value.
// A null field means "any". Addresses are exact host strings.
function ruleMatches(rule, flow) {
  if (rule.fromZone !== flow.fromZone || rule.toZone !== flow.toZone) return false;
  for (const field of ['srcAddress', 'dstAddress', 'application', 'userGroup']) {
    if (rule[field] != null && rule[field] !== flow[field]) return false;
  }
  if (rule.services != null) {
    const hit = rule.services.some((s) => s.protocol === flow.protocol && s.port === flow.port);
    if (!hit) return false;
  }
  return true;
}

// First match decides. Returns the verdict, the deciding rule position
// (0-based, or null for implicit deny), and the lower rules that also match
// but are never reached.
export function evaluateFlow(ruleBase, rules, flow) {
  const matches = [];
  ruleBase.forEach((entry, index) => {
    const rule = rules[entry.ruleId];
    if (rule && ruleMatches(rule, flow)) matches.push(index);
  });

  if (matches.length === 0) {
    return { verdict: 'denied-implicit', matchedIndex: null, control: null, reasonCode: 'implicit-deny', laterMatches: [] };
  }

  const matchedIndex = matches[0];
  const laterMatches = matches.slice(1);
  const entry = ruleBase[matchedIndex];
  const rule = rules[entry.ruleId];
  const base = { matchedIndex, laterMatches };

  if (rule.action === 'deny') {
    return { verdict: 'denied-by-rule', control: null, reasonCode: 'rule-deny', ...base };
  }

  const controls = resolveControls(rule, entry);

  if (flow.carries === 'malware' || flow.carries === 'exploit') {
    if (controls.threatInspection) {
      const readable = !flow.encrypted || controls.tlsDecryption;
      if (readable) {
        return { verdict: 'stopped-by-control', control: 'threatInspection', reasonCode: 'inspection-stopped', ...base };
      }
      return { verdict: 'allowed', control: null, reasonCode: 'inspection-blind-encrypted', ...base };
    }
    return { verdict: 'allowed', control: null, reasonCode: 'no-control', ...base };
  }

  if (flow.carries === 'malicious-domain') {
    if (controls.dnsFiltering) {
      return { verdict: 'stopped-by-control', control: 'dnsFiltering', reasonCode: 'dns-filter-stopped', ...base };
    }
    return { verdict: 'allowed', control: null, reasonCode: 'no-control', ...base };
  }

  return { verdict: 'allowed', control: null, reasonCode: 'rule-allow', ...base };
}

function evaluateList(ruleBase, rules, flows) {
  return (flows || []).map((flow) => ({ flowId: flow.id, ...evaluateFlow(ruleBase, rules, flow) }));
}

// Evaluates every required flow, attack step, and probe against one rule base.
// All steps and probes are evaluated even after a breach, because the score
// needs all of them.
export function evaluateRuleBase(challenge, ruleBase) {
  const serviceCheck = evaluateList(ruleBase, challenge.rules, challenge.requiredFlows);
  const attacks = evaluateList(ruleBase, challenge.rules, challenge.attackSteps);
  const probes = evaluateList(ruleBase, challenge.rules, challenge.probes);

  const firstBreach = attacks.findIndex((v) => v.verdict === 'allowed');
  const attacksStopped = attacks.filter((v) => v.verdict !== 'allowed').length;
  const probesDenied = probes.filter((v) => v.verdict !== 'allowed').length;

  return {
    serviceCheck,
    serviceOk: serviceCheck.every((v) => v.verdict === 'allowed'),
    attacks,
    probes,
    breachStep: firstBreach === -1 ? null : firstBreach + 1,
    score: attacksStopped * POINTS_PER_ATTACK_STOPPED + probesDenied * POINTS_PER_PROBE_DENIED,
  };
}

// Evaluates the player's rule base and the rival's by the same rules, then
// classifies the submission into exactly one outcome.
export function evaluateSubmission(challenge, ruleBase) {
  const player = evaluateRuleBase(challenge, ruleBase);

  if (!player.serviceOk) {
    // Required traffic is blocked: the penetration test does not run.
    return { outcome: 'outage', completed: false, serviceCheck: player.serviceCheck, exposures: [] };
  }

  const rival = evaluateRuleBase(challenge, challenge.rival.ruleBase);

  let outcome;
  if (player.breachStep === null) outcome = 'survived-won';
  else if (rival.breachStep === null || player.breachStep < rival.breachStep) outcome = 'breached-first';
  else if (player.breachStep === rival.breachStep) outcome = 'both-breached';
  else outcome = 'outlasted-but-breached';

  const side = (r) => ({ attacks: r.attacks, probes: r.probes, breachStep: r.breachStep, score: r.score });

  return {
    outcome,
    completed: outcome === 'survived-won',
    serviceCheck: player.serviceCheck,
    player: side(player),
    rival: side(rival),
    exposures: player.probes.filter((v) => v.verdict === 'allowed').map((v) => v.flowId),
  };
}

// A stable string for a rule base: ordered rule IDs with the resolved state of
// each offered control. Two rule bases are identical exactly when these match.
export function canonicalForm(ruleBase, rules) {
  return ruleBase
    .map((entry) => {
      const rule = rules[entry.ruleId];
      const controls = rule ? resolveControls(rule, entry) : {};
      const parts = Object.keys(controls).sort().map((name) => `${name}=${controls[name] ? 1 : 0}`);
      return `${entry.ruleId}{${parts.join(',')}}`;
    })
    .join('>');
}
