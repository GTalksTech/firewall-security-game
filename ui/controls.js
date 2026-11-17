// Input events, focus movement, and live-region announcements.
// Every action goes through a session method; this file holds no game rules.

import { renderApp, renderStatusBar } from './render.js';
import { explainResult, controlLabel } from '../engine/feedback.js';
import { runPlayfields } from './playfield.js';

export function mount({ session, content, app, statusBar, live, onRetryLoad }) {
  const ui = { confirm: null, tierChoice: 'standard', flash: null, sound: true, animate: true };
  let lastView = null;
  let lastLevel = null;
  let lastTier = null;

  // Clearing first makes an identical message announce again.
  function announce(message) {
    if (!message) return;
    live.textContent = '';
    window.setTimeout(() => { live.textContent = message; }, 30);
  }

  function findByKey(key) {
    if (!key) return null;
    for (const el of document.querySelectorAll('[data-key]')) {
      if (el.dataset.key === key && !el.disabled) return el;
    }
    return null;
  }

  // Re-renders, then puts focus somewhere sensible: the new view's heading on
  // a view change, otherwise the same control, otherwise a stated fallback.
  function update(focusKeys = []) {
    const vm = session.getState();
    const activeKey = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
    const scrollY = window.scrollY;

    statusBar.replaceChildren(...renderStatusBar(vm, ui));
    app.replaceChildren(...renderApp(vm, ui, {
      sources: (content && content.sources) || [],
      summary: vm.view === 'summary' ? session.summary() : null,
    }));

    // Only the action that asked for it animates; any other re-render shows the final frame.
    runPlayfields(app, { animate: ui.animate, sound: ui.sound });
    ui.animate = false;

    const viewChanged = vm.view !== lastView || vm.levelIndex !== lastLevel || vm.tier !== lastTier;
    lastView = vm.view; lastLevel = vm.levelIndex; lastTier = vm.tier;

    if (ui.confirm) {
      const cancel = findByKey('confirm-no');
      if (cancel) cancel.focus();
      return vm;
    }
    if (viewChanged) {
      const h1 = app.querySelector('[data-heading]');
      if (h1) h1.focus();
      window.scrollTo(0, 0);
      return vm;
    }
    const target = [...focusKeys, activeKey].map(findByKey).find(Boolean);
    if (target) {
      target.focus({ preventScroll: true });
      window.scrollTo(0, scrollY);
    } else {
      const h1 = app.querySelector('[data-heading]');
      if (h1) h1.focus({ preventScroll: true });
    }
    return vm;
  }

  function ruleLabel(vm, index) {
    const entry = vm.workingRuleBase[index];
    return entry ? vm.challenge.rules[entry.ruleId].label : '';
  }

  const actions = {
    'pick-tier'(el) {
      ui.tierChoice = el.value;
    },
    start() {
      session.chooseTier(ui.tierChoice);
      update();
    },
    'start-build'() {
      session.startBuild();
      update();
    },
    add(el) {
      const id = el.dataset.rule;
      const vm = session.addRule(id);
      const pos = vm.workingRuleBase.findIndex((e) => e.ruleId === id) + 1;
      ui.flash = id;
      update([`add:${vm.availableRuleIds[0] || ''}`, 'submit']);
      ui.flash = null;
      announce(`Added as rule ${pos} of ${vm.workingRuleBase.length}: ${vm.challenge.rules[id].label}.`);
    },
    remove(el) {
      const index = Number(el.dataset.index);
      const before = session.getState();
      const label = ruleLabel(before, index);
      const id = before.workingRuleBase[index] ? before.workingRuleBase[index].ruleId : '';
      const vm = session.removeRule(index);
      update([`add:${id}`]);
      announce(`Removed rule ${index + 1}: ${label}. ${vm.workingRuleBase.length} rule${vm.workingRuleBase.length === 1 ? ' remains' : 's remain'}.`);
    },
    up(el) { move(el, 'up'); },
    down(el) { move(el, 'down'); },
    control(el) {
      const index = Number(el.dataset.index);
      session.setControl(index, el.dataset.control, el.checked);
      update();
      const name = controlLabel(el.dataset.control);
      announce(`${name.charAt(0).toUpperCase()}${name.slice(1)} ${el.checked ? 'on' : 'off'} for rule ${index + 1}.`);
    },
    hint() {
      const hint = session.requestHint();
      update();
      if (hint) announce(hint.stage === 3 ? 'Hint 3 of 3: the worked solution is shown below the hint button.' : `Hint ${hint.stage} of 3: ${hint.text}`);
    },
    submit() {
      const outcome = session.submit();
      ui.animate = true;
      const vm = update();
      if (outcome.kind === 'guidance') {
        announce(outcome.message);
      } else if (outcome.kind === 'result') {
        const ex = explainResult(outcome.result, vm.challenge, vm.workingRuleBase);
        announce(`${outcome.repeated ? 'Same rule base as before; not counted as a new attempt. ' : ''}Result: ${ex.heading}. ${ex.intro}`);
      }
    },
    'next-step'() {
      const vm = session.revealNextStep();
      ui.animate = true;
      update(['next-step', 'next', 'retry']);
      const ex = explainResult(vm.lastResult, vm.challenge, vm.workingRuleBase);
      const s = ex.steps[vm.revealedSteps - 1];
      if (s) announce(`Step ${s.n} of ${ex.steps.length}: ${s.label}. Your firewall: ${s.player.word}. ${s.player.text} Rival firewall: ${s.rival.word}. ${s.rival.text}`);
    },
    'reveal-all'() {
      const vm = session.revealAll();
      update(['next', 'retry']);
      announce(`All ${vm.revealedSteps} attack steps are shown.`);
    },
    retry() { session.retry(); update(); },
    harden() { session.hardenFurther(); update(); },
    next() { session.next(); update(); },
    summary() { session.showSummary(); update(); },
    continue() { session.chooseTier(session.getState().tier); update(); },
    'switch-tier'(el) {
      const tier = el.dataset.tier;
      const r = session.switchTier(tier, false);
      if (r.needsConfirm) ui.confirm = { kind: 'switch', tier, returnKey: el.dataset.key };
      update();
      if (!r.needsConfirm) announce(`Now playing the ${tier === 'expert' ? 'Expert' : 'Standard'} tier.`);
    },
    restart(el) {
      ui.confirm = { kind: 'restart', returnKey: el.dataset.key };
      update();
    },
    'confirm-yes'() {
      const c = ui.confirm;
      ui.confirm = null;
      if (c.kind === 'restart') {
        session.restart(true);
        ui.tierChoice = 'standard';
        update();
        announce('The game was restarted. All progress was cleared.');
      } else {
        session.switchTier(c.tier, true);
        update();
        announce(`Now playing the ${c.tier === 'expert' ? 'Expert' : 'Standard'} tier. The unsubmitted rule base was discarded.`);
      }
    },
    'confirm-no'() {
      const c = ui.confirm;
      ui.confirm = null;
      session.restart(false);
      update([c.returnKey]);
      announce('Cancelled. Nothing was changed.');
    },
    'toggle-sound'() {
      ui.sound = !ui.sound;
      update();
      announce(`Sound ${ui.sound ? 'on' : 'off'}.`);
    },
    'retry-load'() {
      if (onRetryLoad) onRetryLoad();
    },
  };

  function move(el, direction) {
    const index = Number(el.dataset.index);
    const before = session.getState();
    const id = before.workingRuleBase[index] ? before.workingRuleBase[index].ruleId : '';
    const vm = session.moveRule(index, direction);
    const pos = vm.workingRuleBase.findIndex((e) => e.ruleId === id) + 1;
    // If the same button is now disabled (top or bottom), fall to its partner.
    ui.flash = id;
    update([`${direction}:${id}`, `${direction === 'up' ? 'down' : 'up'}:${id}`]);
    ui.flash = null;
    announce(`Rule moved to position ${pos} of ${vm.workingRuleBase.length}.`);
  }

  function dispatch(event) {
    const el = event.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const isInput = el.tagName === 'INPUT';
    if (isInput !== (event.type === 'change')) return;
    const handler = actions[el.dataset.action];
    if (handler) handler(el);
  }

  for (const root of [app, statusBar]) {
    root.addEventListener('click', dispatch);
    root.addEventListener('change', dispatch);
  }

  // Escape cancels an open confirmation.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ui.confirm) actions['confirm-no']();
  });

  update();
  return { update };
}
