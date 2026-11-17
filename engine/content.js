// Validates data/levels.json before the game starts (FR-033, FR-034).
// Rules: specs/001-firewall-faceoff/data-model.md, "Validation rules (content)".
// Pure: no DOM, network, clock, or randomness.

import { CONTROL_NAMES, evaluateRuleBase, evaluateSubmission } from './rules.js';

export const TIERS = ['standard', 'expert'];
const ACTIONS = ['allow', 'deny'];
const CARRIES = ['none', 'malware', 'exploit', 'malicious-domain'];
const CHALLENGE_FIELDS = [
  'briefing', 'request', 'topology', 'rules', 'startingRuleBase', 'requiredFlows',
  'attackSteps', 'probes', 'rival', 'referenceSolution', 'hints', 'sourceIds',
];
const FLOW_FIELDS = ['id', 'label', 'fromZone', 'toZone', 'srcAddress', 'dstAddress', 'protocol', 'port'];
const MATCH_FIELDS = ['fromZone', 'toZone', 'srcAddress', 'dstAddress', 'protocol', 'port', 'application', 'userGroup'];

const isObject = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const nonEmptyString = (x) => typeof x === 'string' && x.trim().length > 0;

function checkSourceIds(ids, sourceIds, where, errors) {
  if (!Array.isArray(ids) || ids.length === 0) {
    errors.push(`${where} has no source.`);
    return;
  }
  for (const id of ids) {
    if (!sourceIds.has(id)) errors.push(`${where} cites a source that does not exist: "${id}".`);
  }
}

function checkRuleBase(entries, rules, where, errors) {
  if (!Array.isArray(entries)) {
    errors.push(`${where} is not a list.`);
    return false;
  }
  let ok = true;
  const seen = new Set();
  for (const entry of entries) {
    const rule = isObject(entry) ? rules[entry.ruleId] : null;
    if (!rule) {
      errors.push(`${where} uses a rule that does not exist: "${isObject(entry) ? entry.ruleId : entry}".`);
      ok = false;
      continue;
    }
    if (seen.has(entry.ruleId)) {
      errors.push(`${where} lists rule "${entry.ruleId}" twice.`);
      ok = false;
    }
    seen.add(entry.ruleId);
    for (const name of Object.keys(entry.controls || {})) {
      if (!(name in (rule.controls || {}))) {
        errors.push(`${where} sets control "${name}" on rule "${entry.ruleId}", which does not offer it.`);
        ok = false;
      }
    }
  }
  return ok;
}

function validateChallenge(challenge, sourceIds) {
  const errors = [];
  if (!isObject(challenge)) return ['The challenge is not an object.'];

  for (const field of CHALLENGE_FIELDS) {
    if (challenge[field] === undefined || challenge[field] === null) errors.push(`Missing required field "${field}".`);
  }
  if (errors.length > 0) return errors;

  if (!nonEmptyString(challenge.request)) errors.push('The business request is empty.');

  // Topology
  const zones = new Set(Array.isArray(challenge.topology.zones) ? challenge.topology.zones : []);
  if (zones.size === 0) errors.push('The topology lists no zones.');
  if (!nonEmptyString(challenge.topology.description)) errors.push('The topology has no text description.');

  // Briefing
  const b = challenge.briefing;
  if (!isObject(b) || !Array.isArray(b.paragraphs) || b.paragraphs.length === 0) errors.push('The briefing has no paragraphs.');
  if (!isObject(b) || !nonEmptyString(b.workedExample)) errors.push('The briefing has no worked example.');
  if (!isObject(b) || !Array.isArray(b.simplifications)) errors.push('The briefing does not list its simplifications.');
  checkSourceIds(isObject(b) ? b.sourceIds : null, sourceIds, 'The briefing', errors);
  checkSourceIds(challenge.sourceIds, sourceIds, 'The challenge', errors);

  // Rules
  const rules = challenge.rules;
  if (!isObject(rules) || Object.keys(rules).length === 0) {
    errors.push('The challenge has no rules.');
    return errors;
  }
  for (const [id, rule] of Object.entries(rules)) {
    const where = `Rule "${id}"`;
    if (!isObject(rule)) { errors.push(`${where} is not an object.`); continue; }
    if (!nonEmptyString(rule.label)) errors.push(`${where} has no label.`);
    if (!ACTIONS.includes(rule.action)) errors.push(`${where} has an unknown action: "${rule.action}".`);
    for (const z of ['fromZone', 'toZone']) {
      if (!zones.has(rule[z])) errors.push(`${where} uses an unknown zone in ${z}: "${rule[z]}".`);
    }
    if (rule.services != null) {
      const good = Array.isArray(rule.services) && rule.services.length > 0 &&
        rule.services.every((s) => isObject(s) && nonEmptyString(s.protocol) && Number.isInteger(s.port));
      if (!good) errors.push(`${where} has a malformed services list.`);
    }
    if (!isObject(rule.controls || {})) errors.push(`${where} has malformed controls.`);
    for (const name of Object.keys(rule.controls || {})) {
      if (!CONTROL_NAMES.includes(name)) errors.push(`${where} offers an unknown control: "${name}".`);
      else if (rule.action === 'deny') errors.push(`${where} is a deny rule and cannot carry controls.`);
    }
  }

  // Starting rule base
  if (!Array.isArray(challenge.startingRuleBase)) {
    errors.push('The starting rule base is not a list.');
  } else {
    checkRuleBase(challenge.startingRuleBase.map((ruleId) => ({ ruleId, controls: {} })), rules, 'The starting rule base', errors);
  }

  // Flows
  const flowIds = new Set();
  const checkFlows = (flows, kind) => {
    if (!Array.isArray(flows)) { errors.push(`The ${kind} list is not a list.`); return; }
    for (const flow of flows) {
      if (!isObject(flow)) { errors.push(`A ${kind} entry is not an object.`); continue; }
      const where = `${kind} "${flow.id}"`;
      for (const field of FLOW_FIELDS) {
        if (flow[field] === undefined || flow[field] === null || flow[field] === '') errors.push(`${where} is missing "${field}".`);
      }
      if (flowIds.has(flow.id)) errors.push(`Flow id "${flow.id}" is used more than once.`);
      flowIds.add(flow.id);
      for (const z of ['fromZone', 'toZone']) {
        if (!zones.has(flow[z])) errors.push(`${where} uses an unknown zone in ${z}: "${flow[z]}".`);
      }
      if (!Number.isInteger(flow.port)) errors.push(`${where} has a port that is not a whole number.`);
      if (typeof flow.encrypted !== 'boolean') errors.push(`${where} must say whether it is encrypted.`);
      if (!CARRIES.includes(flow.carries)) errors.push(`${where} has an unknown "carries" value: "${flow.carries}".`);
    }
  };
  checkFlows(challenge.requiredFlows, 'Required flow');
  checkFlows(challenge.attackSteps, 'Attack step');
  checkFlows(challenge.probes, 'Probe');

  const required = Array.isArray(challenge.requiredFlows) ? challenge.requiredFlows : [];
  const attacks = Array.isArray(challenge.attackSteps) ? challenge.attackSteps : [];

  if (required.length === 0) errors.push('The challenge has no required flow.');
  if (attacks.length === 0) errors.push('The challenge has no attack step.');

  for (const flow of required) {
    if (isObject(flow) && flow.carries !== 'none') errors.push(`Required flow "${flow.id}" must carry nothing harmful.`);
  }
  for (const step of attacks) {
    if (!isObject(step)) continue;
    if (!Array.isArray(step.techniqueIds) || step.techniqueIds.length === 0) {
      errors.push(`Attack step "${step.id}" has no technique ID.`);
    }
    // A required flow and an attack step that the firewall cannot tell apart
    // can never both be satisfied: same matching fields and nothing to inspect.
    for (const flow of required) {
      if (!isObject(flow)) continue;
      const same = MATCH_FIELDS.every((f) => (flow[f] ?? null) === (step[f] ?? null));
      if (same && step.carries === 'none') {
        errors.push(`Required flow "${flow.id}" and attack step "${step.id}" are the same traffic.`);
      }
    }
  }

  // Hints: method, then one worked step. Stage 3 shows the reference solution.
  if (!Array.isArray(challenge.hints) || challenge.hints.length !== 2 || !challenge.hints.every(nonEmptyString)) {
    errors.push('The challenge needs exactly two hints: a method and one worked step.');
  }

  // Rival and reference solution, checked through the engine.
  const rivalOk = isObject(challenge.rival) && checkRuleBase(challenge.rival.ruleBase, rules, 'The rival rule base', errors);
  if (!isObject(challenge.rival)) errors.push('The rival is not an object.');
  const referenceOk = checkRuleBase(challenge.referenceSolution, rules, 'The reference solution', errors);

  if (errors.length > 0) return errors;

  if (rivalOk) {
    const rival = evaluateRuleBase(challenge, challenge.rival.ruleBase);
    if (!rival.serviceOk) errors.push('The rival blocks required traffic.');
    if (rival.breachStep === null) errors.push('The rival is never breached, so the level cannot be won.');
  }
  if (referenceOk && errors.length === 0) {
    const result = evaluateSubmission(challenge, challenge.referenceSolution);
    if (!result.completed) errors.push(`The reference solution does not complete the level (outcome: ${result.outcome}).`);
  }

  return errors;
}

// Returns file-level errors (which stop the whole game) separately from the
// status of each challenge (which only makes that challenge unavailable).
export function validateContent(document) {
  const fileErrors = [];
  const challenges = {};

  if (!isObject(document)) {
    return { ok: false, fileErrors: ['The level content could not be read.'], challenges };
  }
  if (document.schemaVersion !== 1) fileErrors.push(`Unsupported schemaVersion: ${JSON.stringify(document.schemaVersion)}.`);
  if (!Array.isArray(document.levels) || document.levels.length === 0) fileErrors.push('The content has no levels.');
  if (!Array.isArray(document.sources)) fileErrors.push('The content has no sources list.');

  const levelIds = new Set();
  for (const level of Array.isArray(document.levels) ? document.levels : []) {
    if (!isObject(level) || !nonEmptyString(level.id)) { fileErrors.push('A level has no id.'); continue; }
    if (levelIds.has(level.id)) fileErrors.push(`Level id "${level.id}" is used more than once.`);
    levelIds.add(level.id);
    for (const field of ['title', 'concept', 'capability']) {
      if (!nonEmptyString(level[field])) fileErrors.push(`Level "${level.id}" is missing "${field}".`);
    }
  }

  const sourceIds = new Set();
  for (const source of Array.isArray(document.sources) ? document.sources : []) {
    if (!isObject(source) || !nonEmptyString(source.id)) { fileErrors.push('A source has no id.'); continue; }
    if (sourceIds.has(source.id)) fileErrors.push(`Source id "${source.id}" is used more than once.`);
    sourceIds.add(source.id);
    for (const field of ['title', 'url', 'section', 'claim']) {
      if (!nonEmptyString(source[field])) fileErrors.push(`Source "${source.id}" is missing "${field}".`);
    }
  }

  if (fileErrors.length > 0) return { ok: false, fileErrors, challenges };

  for (const level of document.levels) {
    challenges[level.id] = {};
    const byTier = isObject(level.challenges) ? level.challenges : {};
    for (const tier of TIERS) {
      const challenge = byTier[tier];
      if (challenge === undefined || challenge === null) {
        challenges[level.id][tier] = { status: 'unavailable', errors: [] };
        continue;
      }
      const errors = validateChallenge(challenge, sourceIds);
      challenges[level.id][tier] = { status: errors.length === 0 ? 'ok' : 'error', errors };
    }
  }

  return { ok: true, fileErrors, challenges };
}
