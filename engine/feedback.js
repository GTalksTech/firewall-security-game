// Turns structured engine results into explanation text. Every sentence about
// a decision is generated from the result, so feedback always agrees with the
// evaluator (constitution principle VI). Level-specific lessons are authored
// in data/levels.json and appended here.
// Pure: no DOM, network, clock, or randomness.

const CONTROL_LABELS = {
  threatInspection: 'threat inspection',
  tlsDecryption: 'TLS decryption',
  dnsFiltering: 'DNS filtering',
};

const CARRIES_TEXT = {
  none: null,
  malware: 'carries malware',
  exploit: 'carries an exploit',
  'malicious-domain': 'asks for a known-malicious domain',
};

export const OUTCOME_HEADINGS = {
  outage: 'Outage: required traffic is blocked',
  'breached-first': 'Breached before the rival',
  'both-breached': 'Both firewalls breached at step {n}',
  'outlasted-but-breached': 'You outlasted the rival but were still breached',
  'survived-won': 'Your firewall survived and the rival fell',
};

export function controlLabel(name) {
  return CONTROL_LABELS[name] || name;
}

export function verdictWord(verdict) {
  if (verdict === 'allowed') return 'Allowed';
  if (verdict === 'stopped-by-control') return 'Stopped';
  return 'Denied';
}

export function ruleRef(index, ruleBase, rules) {
  const entry = ruleBase[index];
  const rule = entry ? rules[entry.ruleId] : null;
  return rule ? `rule ${index + 1} (${rule.label})` : `rule ${index + 1}`;
}

const capital = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// The values a player needs to reason about one flow, in words.
export function describeFlow(flow) {
  const parts = [
    `${flow.srcAddress} (${flow.fromZone}) to ${flow.dstAddress} (${flow.toZone})`,
    `${String(flow.protocol).toUpperCase()} ${flow.port}`,
  ];
  if (flow.application) parts.push(`application: ${flow.application}`);
  if (flow.userGroup) parts.push(`user group: ${flow.userGroup}`);
  parts.push(flow.encrypted ? 'encrypted' : 'not encrypted');
  if (CARRIES_TEXT[flow.carries]) parts.push(CARRIES_TEXT[flow.carries]);
  return parts.join(', ');
}

// One or two sentences saying what decided a flow and why.
export function explainVerdict(verdict, context) {
  const { ruleBase, rules, flow } = context;
  const who = context.owner === 'rival' ? "the rival's " : '';
  const at = verdict.matchedIndex === null ? null : ruleRef(verdict.matchedIndex, ruleBase, rules);
  const Rule = at ? capital(`${who}${at}`) : null;
  let text;

  switch (verdict.reasonCode) {
    case 'implicit-deny':
      text = `No ${context.owner === 'rival' ? 'rule in the rival\'s rule base' : 'rule'} matches this traffic, so the implicit deny stops it.`;
      break;
    case 'rule-deny':
      text = `${Rule} is the first match and denies it.`;
      break;
    case 'rule-allow':
      text = `${Rule} is the first match and allows it.`;
      break;
    case 'inspection-stopped':
      text = `${Rule} allows the connection, and threat inspection on that rule stops it because the content is readable${flow && flow.encrypted ? ' once TLS decryption has decrypted it' : ''}.`;
      break;
    case 'dns-filter-stopped':
      text = `${Rule} allows the lookup, and DNS filtering on that rule stops it because the domain is known to be malicious.`;
      break;
    case 'inspection-blind-encrypted':
      text = `${Rule} allows it. Threat inspection is on, but the content is still encrypted and TLS decryption is off for this rule, so inspection cannot read it.`;
      break;
    case 'no-control':
      text = `${Rule} allows it, and no control on that rule is looking for what it carries.`;
      break;
    default:
      text = `${Rule || 'The firewall'} decided this traffic.`;
  }

  // Lower rules that also match are never reached. Say so when it changes the story.
  const later = (verdict.laterMatches || []).map((i) => ({ i, rule: rules[ruleBase[i].ruleId] }));
  if (verdict.verdict === 'denied-by-rule') {
    const allow = later.find((x) => x.rule.action === 'allow');
    if (allow) {
      text += ` ${capital(ruleRef(allow.i, ruleBase, rules))} would have allowed it, but the firewall stops at the first match, so that rule is never reached.`;
    }
  } else if (verdict.verdict === 'allowed') {
    const deny = later.find((x) => x.rule.action === 'deny');
    if (deny) {
      text += ` ${capital(ruleRef(deny.i, ruleBase, rules))} would have denied it, but it sits below the first match and is never reached.`;
    }
  }
  return text;
}

function nextStepForOutage(verdict, ruleBase, rules) {
  if (verdict.verdict === 'denied-implicit') {
    return 'Next step: add or restore the narrowest rule that allows this traffic.';
  }
  const n = verdict.matchedIndex + 1;
  const allow = (verdict.laterMatches || []).find((i) => rules[ruleBase[i].ruleId].action === 'allow');
  if (allow !== undefined) {
    return `Next step: move rule ${allow + 1} above rule ${n}, or remove rule ${n}. Traffic that matches no rule is denied anyway.`;
  }
  return `Next step: remove or narrow rule ${n} so it no longer matches this traffic, and make sure a rule allows it.`;
}

function nextStepForBreach(verdict) {
  const n = verdict.matchedIndex + 1;
  if (verdict.reasonCode === 'inspection-blind-encrypted') {
    return `Next step: switch on TLS decryption for rule ${n}, so threat inspection can read the content.`;
  }
  if (verdict.reasonCode === 'no-control') {
    return `Next step: ask whether rule ${n} needs to allow this traffic at all. If it does, switch on the control that looks for what it carries.`;
  }
  return `Next step: ask whether the request needs rule ${n}. If it does not, remove it. If it does, replace it with a narrower rule, or place a deny for this traffic above it.`;
}

// Builds every piece of text the result view shows.
export function explainResult(result, challenge, ruleBase) {
  const rules = challenge.rules;
  const byId = (list) => Object.fromEntries((list || []).map((f) => [f.id, f]));
  const required = byId(challenge.requiredFlows);
  const attacks = byId(challenge.attackSteps);
  const probes = byId(challenge.probes);

  const service = result.serviceCheck.map((v) => {
    const flow = required[v.flowId];
    return {
      id: v.flowId,
      label: flow.label,
      values: describeFlow(flow),
      ok: v.verdict === 'allowed',
      word: verdictWord(v.verdict),
      text: explainVerdict(v, { ruleBase, rules, flow }),
      matchedIndex: v.matchedIndex,
    };
  });

  if (result.outcome === 'outage') {
    const failing = result.serviceCheck.find((v) => v.verdict !== 'allowed');
    const flow = required[failing.flowId];
    return {
      outcome: 'outage',
      heading: OUTCOME_HEADINGS.outage,
      tone: 'bad',
      intro: `"${flow.label}" does not get through, so the business is down. The penetration test did not run. ${explainVerdict(failing, { ruleBase, rules, flow })}`,
      nextStep: nextStepForOutage(failing, ruleBase, rules),
      service,
      steps: [],
      exposures: [],
      why: null,
      score: 0,
      rivalScore: null,
      rivalNote: null,
    };
  }

  const rivalBase = challenge.rival.ruleBase;
  const steps = result.player.attacks.map((v, i) => {
    const flow = attacks[v.flowId];
    const rv = result.rival.attacks[i];
    return {
      n: i + 1,
      id: v.flowId,
      label: flow.label,
      techniqueIds: flow.techniqueIds || [],
      values: describeFlow(flow),
      player: {
        word: verdictWord(v.verdict),
        verdict: v.verdict,
        text: explainVerdict(v, { ruleBase, rules, flow }),
        matchedIndex: v.matchedIndex,
      },
      rival: {
        word: verdictWord(rv.verdict),
        verdict: rv.verdict,
        text: explainVerdict(rv, { ruleBase: rivalBase, rules, flow, owner: 'rival' }),
        matchedIndex: rv.matchedIndex,
      },
      lesson: v.verdict === 'allowed' ? flow.lesson || null : null,
      rivalLesson: rv.verdict === 'allowed' ? flow.lesson || null : null,
    };
  });

  const exposures = result.player.probes
    .filter((v) => v.verdict === 'allowed')
    .map((v) => {
      const flow = probes[v.flowId];
      return {
        id: v.flowId,
        label: flow.label,
        values: describeFlow(flow),
        text: explainVerdict(v, { ruleBase, rules, flow }),
        lesson: flow.lesson || null,
      };
    });

  const pb = result.player.breachStep;
  const rb = result.rival.breachStep;
  const rivalFell = `The rival was breached at step ${rb}. ${challenge.rival.note || ''}`.trim();
  let heading = OUTCOME_HEADINGS[result.outcome].replace('{n}', pb);
  let intro;
  let tone = 'bad';
  let nextStep = null;
  let why = null;

  if (result.outcome === 'survived-won') {
    tone = 'good';
    const byRule = result.player.attacks.filter((v) => v.verdict !== 'allowed' && v.verdict !== 'stopped-by-control').length;
    const byControl = result.player.attacks.filter((v) => v.verdict === 'stopped-by-control').length;
    intro = `Required traffic gets through and all ${result.player.attacks.length} attack steps fail. ${rivalFell}`;
    why = `Why this works: ${exposures.length === 0 ? 'your rules allow only what the request needs' : 'no rule lets an attack step through'}. ${byRule} attack step${byRule === 1 ? ' was' : 's were'} denied by a rule or the implicit deny` +
      (byControl > 0 ? `, and ${byControl} that had to be allowed ${byControl === 1 ? 'was' : 'were'} stopped by a security control.` : '.');
    if (exposures.length > 0) {
      why += ` ${exposures.length} piece${exposures.length === 1 ? '' : 's'} of traffic the request did not ask for still gets through; see "Exposure" below.`;
    }
  } else {
    const breached = result.player.attacks[pb - 1];
    const flow = attacks[breached.flowId];
    const head =
      result.outcome === 'breached-first'
        ? `Your firewall was breached at step ${pb}, before the rival's (step ${rb}).`
        : result.outcome === 'both-breached'
          ? `Both firewalls let step ${pb} through.`
          : `The rival fell at step ${rb} and yours held until step ${pb}, but a breached firewall is still breached. The level is not complete and no points are banked.`;
    intro = `${head} "${flow.label}" got through: ${explainVerdict(breached, { ruleBase, rules, flow })}${flow.lesson ? ' ' + flow.lesson : ''}`;
    nextStep = nextStepForBreach(breached);
  }

  return {
    outcome: result.outcome,
    heading,
    tone,
    intro,
    nextStep,
    service,
    steps,
    exposures,
    why,
    score: result.player.score,
    rivalScore: result.rival.score,
    rivalNote: challenge.rival.note || null,
  };
}
