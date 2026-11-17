# Implementation Plan: Firewall Security Faceoff · First Playable

**Branch**: `001-firewall-faceoff` (feature directory name; no git branch exists yet, work is on `main`) | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-firewall-faceoff/spec.md`, the starter plan at `StarterKit/PLAN.md`, and constitution v1.1.1.

## Summary

Build a static browser game in which the player edits a firewall rule base from selectable
options, submits it, and sees a penetration test run against their firewall and an authored
rival's. A pure rule engine evaluates every flow by first match, applies security controls,
classifies the outcome, and scores it. Level content lives in one JSON file. Session state is
in memory. The 34 hand-worked cases in the spec are transcribed into automated checks that run
in the browser and from the command line.

**Hardest behavior to get right:** first-match evaluation combined with controls (inspection
only works on readable content), then classifying a submission into exactly one of five
outcomes and banking the best score once.

**First evidence we'll check:** Level 1 Standard, rule base [R3, R1] reports an outage caused by
rule 1 and does not run the test; rule base [R1] completes the level with score 40 while the
rival is breached at step 1.

## Technical Context

**Language/Version**: HTML5, CSS, and JavaScript (ES2022 native modules). No transpiler.

**Primary Dependencies**: none at runtime and none at build time. No framework, bundler, or package install.

**Storage**: in-memory session state only. Authored content in `data/levels.json`. No persistence; reload starts again (FR-032).

**Testing**: a dependency-free test harness in `tests/`, run two ways from the same test files: in the browser at `/tests/` and from the command line with `node tests/run-node.mjs` (Node 26 is installed; any Node 20+ works). Node is a development convenience, not a requirement to play.

**Target Platform**: current desktop browsers (Chrome, Edge, Firefox, Safari), served as static files, including from a repository subpath.

**Project Type**: static single-page web application.

**Performance Goals**: a submission's full result is computed and available in under 100 ms. The largest challenge has 9 rules and 13 flows, so this needs no optimization.

**Constraints**: no network access after load (SC-009); relative asset paths; no free-form text input anywhere (FR-007); deterministic results (FR-013); all results available without waiting for animation (FR-040).

**Scale/Scope**: 3 levels at 2 tiers (6 challenges), 41 functional requirements, 34 hand-worked cases, 6 views (tier selection, briefing, build, result, summary, content error).

## Contradictions resolved

The starter plan, the clarified spec, and the constitution disagree in the places below. Each
row states which wins and why. The spec wins over the starter plan wherever the two differ,
because the spec was clarified after the starter was written.

| # | Conflict | Resolution |
| --- | --- | --- |
| 1 | Starter evaluator returns one status: `correct`, `incorrect`, `invalid-input`, or `content-error`. Spec needs five outcomes, per-step verdicts for two firewalls, and a score (FR-016, FR-017, FR-019). | Replace the starter's result shape with the one in [contracts/engine-api.md](./contracts/engine-api.md). The principle is kept: a pure function, no DOM, no state. |
| 2 | Starter has an `invalid-input` path. Spec forbids free-form entry, so input cannot be malformed (FR-007). | Drop `invalid-input`. The only non-attempt submissions are an empty rule base and an identical resubmission of a failed one (FR-026), both handled in the state module. |
| 3 | Starter says "disable Submit after success". Spec allows Harden Further after completion (FR-021, FR-024). | After completion the build view enters hardening mode. Submission is allowed, never counts as an attempt, and can only raise the banked score. The guard lives in the state module, not just the button. |
| 4 | Starter data has levels containing ordered rounds. Spec has one round per level at two tiers. | A level contains `challenges` keyed by tier (`standard`, `expert`). "Round" is not a data entity. |
| 5 | Starter restart returns to the first briefing. Spec returns to tier selection (FR-031). | Tier selection. |
| 6 | Starter session state tracks attempts, assistance, and completed rounds. Spec adds points, strength, capabilities, and per-tier progress (FR-019 to FR-029). | State holds one progress record per tier; see [data-model.md](./data-model.md). |
| 7 | Starter asks for independently reviewed expected results. The clarified spec has a single author and no second reviewer. | Expected results are copied as literal values from the spec's cases table into `tests/cases.js`. No test computes an expected value by calling the engine. |
| 8 | Spec content states each rival's breach step and score. Constitution VI forbids an answer key that overrides the rule engine. | `levels.json` holds only the rival's rule base. Its breach step and score are computed by the same engine (FR-014). The spec's numbers appear only in tests. |
| 9 | Spec FR-034 requires rejecting a level that no rule base can complete. Proving that by search is too large for 9 rules with controls. | Each challenge carries a `referenceSolution`. Validation runs it through the engine and rejects the challenge unless it completes. It is also the worked solution for hint stage 3. It is never consulted when grading a player. |
| 10 | Spec lets the player switch tier "between levels" (FR-029) and also describes switching mid-level (edge case). | The tier switch is available from the build view as well. Mid-level it asks for confirmation and discards the unsubmitted rule base. |
| 11 | Starter offers only a browser test runner. Constitution VII requires reproducible test commands, and a build agent cannot read a browser page reliably. | Keep the starter's browser runner and add a command-line entry that imports the same test files and exits non-zero on failure or on zero tests. |
| 12 | Constitution principle II's evidence line names "a teammate". The clarified spec has a single author. | Resolved by constitution v1.1.1, which changes the line to "the author, or a teammate when one is available". The author performs and records the check. |
| 13 | Constitution budgets a 60-minute build. The spec has six challenges and 34 cases. | The slices below are ordered so each one leaves a working game. Cut order if time runs short: Expert Level 3, Expert Level 2, Expert Level 1, then Standard Level 3. A cut challenge is omitted from the data and shown as unavailable (US5 scenario 5). |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | How this plan satisfies it | Evidence produced | Gate |
| --- | --- | --- | --- |
| I. Technical truth | One pure engine decides everything. Sources are stored in `levels.json` and required on every rule set, attack step, and briefing. The model's simplifications are in each briefing. | 34 cases as automated checks; content validation rejects items without a source; a vendor-name scan of shipped text. | Pass |
| II. Teaches through a decision | The build view is the rule-editing action. Briefing precedes editing. Every verdict names the deciding rule. Hints go method, worked step, worked solution. | Manual playthrough recording one deliberately wrong submission per level and the explanation shown. | Pass |
| III. Honest progress, safe retry | State module owns attempts, assistance, and banked best score. Duplicate and empty submissions are guarded in state. No timer, lives, or penalty exists in the design. | `state.test.js` covers wrong answer, repeat submit, hint, harden, completion, and restart. | Pass |
| IV. Access | Native buttons and switches only. Rule reordering uses Move Up and Move Down buttons, not drag and drop. A live region announces results. Reduced motion removes transitions. | Recorded keyboard-only, narrow-window, and reduced-motion checks. | Pass |
| V. Deterministic, self-contained | No randomness, clock, or network in the engine. Static files only. Attacks are data records evaluated against the model. | Repeat-submission test; play with the network disabled after load. | Pass |
| VI. Content and logic separate | `engine/` has no DOM access and no level-specific code. All content, hints, sources, and rivals are in `levels.json`. | Add a trial challenge by editing data only (SC-008); trace one case through the engine. | Pass |
| VII. Done is demonstrated | Each slice ends with a stated check. Results are recorded as pass, fail, or not run in a verification note. | `docs/verification.md` and the README. | Pass |

**Post-design re-check (after Phase 1):** all seven still pass. The reference solution added in
resolution 9 was checked against principle VI: it is validated by the engine and never used
for grading, so it does not override the engine.

## Project Structure

### Documentation (this feature)

```text
specs/001-firewall-faceoff/
├── plan.md              # This file
├── research.md          # Phase 0: decisions and alternatives
├── data-model.md        # Phase 1: entities, state, validation rules
├── quickstart.md        # Phase 1: how to run and validate
├── contracts/
│   ├── level-data.md    # The levels.json contract
│   ├── engine-api.md    # Pure engine functions and result shapes
│   └── ui-contract.md   # Views, controls, keyboard, announcements
├── checklists/
│   └── requirements.md
└── tasks.md             # Created later by /speckit-tasks
```

### Source Code (repository root)

```text
index.html               Semantic page shell and module entry point
style.css                Layout, focus, verdict states, reduced motion, narrow layout
main.js                  Load → validate → start; render loading and content errors
engine/
  rules.js               Pure evaluation: flow vs rule base, submission, outcome, score
  content.js             Validate levels.json, including rival and reference solution
  state.js               Session transitions, per-tier progress, attempts, banked scores
  feedback.js            Turn structured results into explanation text
ui/
  render.js              Tier selection, briefing, build, result, summary, error views
  controls.js            Events, focus movement, live-region announcements
data/
  levels.json            Sources, levels, challenges, rivals, hints, briefings
tests/
  index.html             Browser runner with visible totals and failed case IDs
  run-node.mjs           Command-line runner; non-zero exit on failure or zero tests
  harness.js             Minimal test and assertion helpers shared by both runners
  cases.js               The spec's 34 cases as literal expected values
  rules.test.js          Runs every case in cases.js through the engine
  state.test.js          Attempts, assistance, duplicates, hardening, unlocks, restart
  content.test.js        Invalid content is rejected; shipped content is valid and vendor-neutral
docs/
  verification.md        Recorded results for acceptance scenarios and manual checks
README.md                Replaces the workshop template: behavior, commands, limits
```

**Structure Decision**: the starter plan's flat static layout, with `engine/`, `ui/`, `data/`,
and `tests/` at the repository root. Two files are added to the starter's list:
`tests/run-node.mjs` with `tests/harness.js` (resolution 11) and `tests/cases.js` (resolution
7). `docs/verification.md` holds the evidence the constitution requires.

## Design summary

Details are in the Phase 1 documents. The points an implementer must not get wrong:

- **Matching.** A rule matches a flow when every field the rule specifies equals the flow's
  value. Addresses are exact host strings; there is no subnet arithmetic, because no shipped
  rule uses a subnet. A rule's `services` is a list and matches if the flow's protocol and
  port is in it.
- **Verdict.** First matching rule decides. Deny rule: denied by that rule. No match: implicit
  deny. Allow rule: then controls run. Threat inspection stops a flow carrying malware or an
  exploit only if the flow is unencrypted or TLS decryption is on for that rule. DNS filtering
  stops a flow carrying a malicious domain. Otherwise allowed.
- **Submission.** Check required flows first. Any not allowed means outage, and the test does
  not run. Otherwise evaluate every attack step and every probe against both firewalls, even
  after a breach, because the score needs all of them.
- **Outcome.** Player's first breached step versus the rival's gives one of: survived and won,
  breached before the rival, both breached at the same step, outlasted but breached.
- **Score.** 10 per attack step not allowed, 5 per probe not allowed. Banked only on
  completion, as the highest value seen for that level and tier.
- **Turn-by-turn display is presentation only.** The whole result exists before the first step
  is shown, and Show Full Results reveals it at once.

## Implementation order

| Slice | Deliverable | Covers | Evidence before the next slice |
| --- | --- | --- | --- |
| 1 · Prove the rule | `engine/rules.js`, the test harness and both runners, Level 1 Standard data, its 8 cases | FR-008 to FR-019 | The 8 Level 1 Standard cases pass from the command line |
| 2 · One complete level | Content loading and validation, state module, tier selection, briefing, build view, result view, retry and Next for Level 1 Standard | US1, most of US2 | One correct and one wrong submission behave as specified in the browser; state tests pass |
| 3 · The Standard curriculum | Levels 2 and 3 Standard with controls and an inherited rule base, hints, Harden Further, strength and capabilities, summary, restart | US2, US4 | All 18 Standard cases pass; fresh start to summary works |
| 4 · Access | Focus movement, live region, text for every verdict, reduced motion, narrow layout, text equivalents for topology and attack path | US3 | Keyboard-only, narrow-window, and reduced-motion checks recorded |
| 5 · Expert tier | Three Expert challenges as data, tier switching, per-tier progress, unavailable state | US5 | All 34 cases pass; a Standard completion does not show as Expert |
| 6 · Package | README replacing the template, `docs/verification.md`, vendor-name scan, offline check | SC-006, SC-009, principle VII | A fresh clone runs from the README alone |

Native controls and text verdicts are built from slice 2 onward; slice 4 completes and verifies
access, it does not retrofit it. `tasks.md` is generated from these slices and the spec's
acceptance scenarios.

## Verification and reporting

| Check | What must be established | How |
| --- | --- | --- |
| Domain cases | All 34 cases produce their expected outcome, deciding rules, and score | `node tests/run-node.mjs` and `/tests/` in the browser |
| Content failures | A rival that survives, a rival causing an outage, a failing reference solution, an overlapping required and attack flow, and a missing source are each rejected | `content.test.js` |
| State transitions | Attempts, hints, duplicate and empty submissions, hardening, unlocks, tier switch, summary, restart and cancel | `state.test.js` |
| Determinism | Ten identical submissions give ten identical results | `rules.test.js` |
| Vendor neutrality | No vendor product, command, or feature brand in shipped text | `content.test.js` plus a read of `index.html` |
| Source review | Each briefing and explanation agrees with its cited source | Author read-through, recorded |
| Browser playthrough | Fresh start to summary at Standard; one Expert level | Manual, recorded |
| Access | Keyboard only; narrow window; reduced motion | Manual, recorded |
| Offline | Plays with the network disabled after load | Manual, recorded |

Each acceptance scenario gets a line in `docs/verification.md` with pass, fail, or not run, the
date, the environment, and the evidence. A zero-test run counts as a failure in both runners.

## Scope controls

No persistence, multiplayer, runtime AI, scenario generator, level editor, audio, live battle
mode, or free-form rule entry. If time runs short, cut in the order given in resolution 13,
update `tasks.md`, and record the cut in the README. Do not hide skipped checks or weaken a
case to make it pass.

## Complexity Tracking

No constitution violations. The two earlier entries are closed: the "teammate" wording was
fixed in constitution v1.1.1, and the second test runner is a departure from the starter plan,
not from the constitution; it is recorded as resolution 11.
