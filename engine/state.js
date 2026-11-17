// Session state. The methods here are the only way state changes, and they
// enforce the rules for attempts, assistance, banking, and unlocking whatever
// the interface shows (data-model.md, "State transitions").
// Pure: no DOM, network, clock, or randomness. Nothing is persisted (FR-032).

import { evaluateSubmission, evaluateRuleBase, canonicalForm } from './rules.js';
import { TIERS } from './content.js';

const clone = (x) => JSON.parse(JSON.stringify(x));

function emptyProgress() {
  return { attempts: 0, hintStage: 0, completed: false, bankedScore: 0, lastFailedSubmission: null, lastFailedResult: null };
}

export function createSession(content, validation) {
  const levels = (content && content.levels) || [];

  let state;
  const reset = () => {
    const progress = {};
    for (const tier of TIERS) {
      progress[tier] = {};
      for (const level of levels) progress[tier][level.id] = emptyProgress();
    }
    state = {
      view: validation && validation.ok ? 'tier-select' : 'content-error',
      tier: null,
      levelIndex: 0,
      workingRuleBase: null, // null until the build view opens for this level
      lastSubmitted: null,
      lastResult: null,
      revealedSteps: 0,
      guidance: null,
      hint: null,
      progress,
    };
  };
  reset();

  // ---- lookups ----
  const level = () => levels[state.levelIndex] || null;
  const challengeOf = (index, tier) => {
    const l = levels[index];
    return l && l.challenges ? l.challenges[tier] || null : null;
  };
  const challenge = () => (state.tier ? challengeOf(state.levelIndex, state.tier) : null);
  const statusOf = (index, tier) => {
    const l = levels[index];
    const s = l && validation && validation.challenges[l.id] ? validation.challenges[l.id][tier] : null;
    return s || { status: 'unavailable', errors: [] };
  };
  const status = () => (state.tier ? statusOf(state.levelIndex, state.tier) : { status: 'unavailable', errors: [] });
  const progressOf = (index, tier) => state.progress[tier][levels[index].id];
  const progress = () => (state.tier && level() ? progressOf(state.levelIndex, state.tier) : emptyProgress());
  const playable = () => status().status === 'ok';

  // A level is available if it is the first, or the previous level is
  // completed in either tier (FR-028).
  const levelAvailable = (index) =>
    index === 0 || TIERS.some((tier) => progressOf(index - 1, tier).completed);

  const defaultEntry = (c, ruleId) => ({ ruleId, controls: clone(c.rules[ruleId].controls || {}) });
  const startingRuleBase = (c) => c.startingRuleBase.map((ruleId) => defaultEntry(c, ruleId));

  const openLevel = (index) => {
    state.levelIndex = index;
    state.workingRuleBase = null;
    state.lastSubmitted = null;
    state.lastResult = null;
    state.revealedSteps = 0;
    state.guidance = null;
    state.hint = null;
    state.view = playable() ? 'briefing' : 'content-error';
  };

  // The earliest available level not yet completed in this tier; the first
  // level if every one is completed.
  const earliestOpenLevel = (tier) => {
    for (let i = 0; i < levels.length; i += 1) {
      if (levelAvailable(i) && !progressOf(i, tier).completed) return i;
    }
    return 0;
  };

  const tierTotals = (tier) => {
    let strength = 0;
    let rivalStrength = 0;
    const capabilities = [];
    levels.forEach((l, i) => {
      const p = progressOf(i, tier);
      if (!p.completed) return;
      strength += p.bankedScore;
      capabilities.push(l.capability);
      const c = challengeOf(i, tier);
      if (c && statusOf(i, tier).status === 'ok') rivalStrength += evaluateRuleBase(c, c.rival.ruleBase).score;
    });
    return { strength, rivalStrength, capabilities };
  };

  const inBuild = () => state.view === 'build' && playable() && state.workingRuleBase !== null;

  // ---- public API ----
  const api = {
    getState() {
      const c = challenge();
      const totals = state.tier ? tierTotals(state.tier) : { strength: 0, rivalStrength: 0, capabilities: [] };
      const working = state.workingRuleBase || [];
      const inBase = new Set(working.map((entry) => entry.ruleId));
      const p = progress();
      return clone({
        view: state.view,
        tier: state.tier,
        levelIndex: state.levelIndex,
        levelCount: levels.length,
        isLastLevel: state.levelIndex === levels.length - 1,
        level: level() ? { id: level().id, title: level().title, concept: level().concept, capability: level().capability } : null,
        levels: levels.map((l, i) => ({
          id: l.id,
          title: l.title,
          available: levelAvailable(i),
          completed: state.tier ? progressOf(i, state.tier).completed : false,
          status: state.tier ? statusOf(i, state.tier).status : 'unavailable',
        })),
        challenge: c,
        challengeStatus: status(),
        fileErrors: (validation && validation.fileErrors) || [],
        workingRuleBase: working,
        availableRuleIds: c ? Object.keys(c.rules).filter((id) => !inBase.has(id)) : [],
        progress: { attempts: p.attempts, hintStage: p.hintStage, completed: p.completed, bankedScore: p.bankedScore },
        hardening: state.view === 'build' && p.completed,
        lastResult: state.lastResult,
        lastSubmitted: state.lastSubmitted,
        revealedSteps: state.revealedSteps,
        guidance: state.guidance,
        hint: state.hint,
        strength: totals.strength,
        rivalStrength: totals.rivalStrength,
        capabilities: totals.capabilities,
      });
    },

    chooseTier(tier) {
      if (!TIERS.includes(tier) || !validation || !validation.ok) return api.getState();
      state.tier = tier;
      openLevel(earliestOpenLevel(tier));
      return api.getState();
    },

    startBuild() {
      if (state.view !== 'briefing' || !playable()) return api.getState();
      if (state.workingRuleBase === null) state.workingRuleBase = startingRuleBase(challenge());
      state.view = 'build';
      state.guidance = null;
      return api.getState();
    },

    addRule(ruleId) {
      if (!inBuild()) return api.getState();
      const c = challenge();
      if (!c.rules[ruleId] || state.workingRuleBase.some((entry) => entry.ruleId === ruleId)) return api.getState();
      state.workingRuleBase.push(defaultEntry(c, ruleId));
      state.guidance = null;
      return api.getState();
    },

    removeRule(index) {
      if (!inBuild() || !Number.isInteger(index) || index < 0 || index >= state.workingRuleBase.length) return api.getState();
      state.workingRuleBase.splice(index, 1);
      return api.getState();
    },

    moveRule(index, direction) {
      if (!inBuild() || !Number.isInteger(index)) return api.getState();
      const target = index + (direction === 'up' ? -1 : direction === 'down' ? 1 : 0);
      const n = state.workingRuleBase.length;
      if (target === index || index < 0 || index >= n || target < 0 || target >= n) return api.getState();
      const [entry] = state.workingRuleBase.splice(index, 1);
      state.workingRuleBase.splice(target, 0, entry);
      return api.getState();
    },

    setControl(index, control, on) {
      if (!inBuild() || !Number.isInteger(index) || index < 0 || index >= state.workingRuleBase.length) return api.getState();
      const entry = state.workingRuleBase[index];
      const rule = challenge().rules[entry.ruleId];
      if (!rule.controls || !(control in rule.controls)) return api.getState();
      entry.controls[control] = Boolean(on);
      return api.getState();
    },

    // Raises the hint stage by one, to at most 3. Never submits or completes.
    requestHint() {
      if (!playable() || (state.view !== 'build' && state.view !== 'result')) return null;
      const c = challenge();
      const p = progress();
      p.hintStage = Math.min(3, p.hintStage + 1);
      state.hint =
        p.hintStage === 3
          ? { stage: 3, solution: clone(c.referenceSolution) }
          : { stage: p.hintStage, text: c.hints[p.hintStage - 1] };
      return clone(state.hint);
    },

    submit() {
      if (!playable()) return { kind: 'content-error' };
      if (!inBuild()) return { kind: 'ignored' };
      const c = challenge();
      const p = progress();

      if (state.workingRuleBase.length === 0) {
        state.guidance = 'Your rule base is empty. Add at least one rule, then run the penetration test.';
        return { kind: 'guidance', message: state.guidance };
      }
      state.guidance = null;

      const canonical = canonicalForm(state.workingRuleBase, c.rules);
      state.lastSubmitted = canonical;
      state.revealedSteps = 0;
      state.view = 'result';

      // An identical resubmission of a failed rule base shows the previous
      // result again and is not a new attempt (FR-026).
      if (!p.completed && p.lastFailedSubmission === canonical) {
        state.lastResult = clone(p.lastFailedResult);
        return { kind: 'result', repeated: true, result: clone(state.lastResult) };
      }

      const result = evaluateSubmission(c, state.workingRuleBase);
      state.lastResult = result;

      if (!p.completed) {
        p.attempts += 1;
        if (result.completed) {
          p.completed = true;
          p.bankedScore = result.player.score;
          p.lastFailedSubmission = null;
          p.lastFailedResult = null;
        } else {
          p.lastFailedSubmission = canonical;
          p.lastFailedResult = clone(result);
        }
      } else if (result.completed && result.player.score > p.bankedScore) {
        // Hardening: keep the best score, never the sum (FR-021).
        p.bankedScore = result.player.score;
      }

      return { kind: 'result', repeated: false, result: clone(result) };
    },

    revealNextStep() {
      if (state.view !== 'result' || !state.lastResult || !state.lastResult.player) return api.getState();
      state.revealedSteps = Math.min(state.lastResult.player.attacks.length, state.revealedSteps + 1);
      return api.getState();
    },

    revealAll() {
      if (state.view !== 'result' || !state.lastResult || !state.lastResult.player) return api.getState();
      state.revealedSteps = state.lastResult.player.attacks.length;
      return api.getState();
    },

    retry() {
      if (state.view !== 'result') return api.getState();
      state.view = 'build';
      state.hint = null;
      return api.getState();
    },

    hardenFurther() {
      if (state.view !== 'result' || !progress().completed) return api.getState();
      state.view = 'build';
      state.hint = null;
      return api.getState();
    },

    next() {
      if (state.view !== 'result' || !progress().completed) return api.getState();
      if (state.levelIndex >= levels.length - 1) {
        state.view = 'summary';
        return api.getState();
      }
      openLevel(state.levelIndex + 1);
      return api.getState();
    },

    showSummary() {
      if (state.tier) state.view = 'summary';
      return api.getState();
    },

    // Keeps the current level. From the summary it opens the earliest level
    // not yet completed in the new tier. A rule base that differs from both
    // the starting one and the last submitted one needs confirmation first.
    switchTier(tier, confirmed) {
      if (!TIERS.includes(tier) || !state.tier || tier === state.tier) return { needsConfirm: false };
      if (state.view === 'build' && state.workingRuleBase !== null && playable()) {
        const c = challenge();
        const current = canonicalForm(state.workingRuleBase, c.rules);
        const dirty = current !== canonicalForm(startingRuleBase(c), c.rules) && current !== state.lastSubmitted;
        if (dirty && !confirmed) return { needsConfirm: true };
      }
      const fromSummary = state.view === 'summary';
      state.tier = tier;
      openLevel(fromSummary ? earliestOpenLevel(tier) : state.levelIndex);
      return { needsConfirm: false };
    },

    restart(confirmed) {
      if (confirmed === true) reset();
      return api.getState();
    },

    summary() {
      const out = {};
      for (const tier of TIERS) {
        const totals = tierTotals(tier);
        out[tier] = {
          levels: levels.map((l, i) => {
            const p = progressOf(i, tier);
            return {
              id: l.id,
              title: l.title,
              status: statusOf(i, tier).status,
              completed: p.completed,
              attempts: p.attempts,
              hintStage: p.hintStage,
              bankedScore: p.bankedScore,
            };
          }),
          ...totals,
        };
      }
      return out;
    },
  };

  return api;
}
