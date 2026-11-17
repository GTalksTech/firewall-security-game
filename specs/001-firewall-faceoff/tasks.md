---

description: "Task list for Firewall Security Faceoff · First Playable"
---

# Tasks: Firewall Security Faceoff · First Playable

**Input**: Design documents from `/specs/001-firewall-faceoff/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Included. The spec requires its 34 hand-worked cases to pass as automated checks
(SC-002, Release evidence), and the constitution requires expected results to be recorded
independently of the implementation. Test tasks come before the code they check and must fail
first.

**Organization**: Tasks are grouped by user story so each story can be implemented and tested
on its own. Phases follow the plan's six slices.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an unfinished task)
- **[Story]**: The user story the task belongs to (US1 to US5)
- Every task names the file it changes

## Path Conventions

Static site at the repository root: `index.html`, `style.css`, `main.js`, `engine/`, `ui/`,
`data/`, `tests/`, `docs/`. There is no `src/` directory and no package install.

Document shorthand used below: **spec** = `specs/001-firewall-faceoff/spec.md`,
**data-model** = `specs/001-firewall-faceoff/data-model.md`, **engine-api**, **level-data**, and
**ui-contract** = the files in `specs/001-firewall-faceoff/contracts/`.

**Rules for every task**

- Expected values in tests are copied from the spec's cases table. Never compute an expected
  value by calling the engine.
- If a test and the engine disagree, re-derive the case from "The technical model" in the spec.
  Do not edit whichever is easier.
- Files under `engine/` must not touch the DOM, the network, the clock, or randomness.
- No vendor or product names in any shipped text. No free-form text input anywhere.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the file layout and the test tooling that everything else uses.

- [X] T001 Create directories `engine/`, `ui/`, `data/`, `tests/`, and `docs/` at the repository root, and create `docs/verification.md` with a table header: Check, Result (pass / fail / not run), Date, Environment, Evidence
- [X] T002 [P] Create `tests/harness.js` exporting `test(name, fn)`, `assertEqual`, `assertDeepEqual`, `assert`, and `run()` that returns `{ total, passed, failed: [{ name, message }] }`, per research.md decision 3
- [X] T003 [P] Create `tests/run-node.mjs` that reads `data/levels.json` from disk, imports every `tests/*.test.js`, passes the content to them, prints totals and failed test names, and exits non-zero on any failure or when zero tests ran
- [X] T004 [P] Create `tests/index.html` that fetches `../data/levels.json`, imports the same `tests/*.test.js` files, and shows totals plus failed test names on the page, reporting zero tests as a failure
- [X] T005 [P] Create `index.html` with the semantic page shell (header, `main` region, one polite live region, module script for `main.js`) and an empty `style.css` and `main.js`, using relative paths only

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The rule engine, the content contract, and content validation. Every user story
depends on these. This is plan slice 1, "Prove the rule".

**⚠️ CRITICAL**: No user story work starts until T017 passes.

### Tests first

- [X] T006 Create `data/levels.json` with `schemaVersion` 1, the `sources` array (every source in the spec's references table and its "Control effects and their sources" table, with URL and section), and `level-1` with its `standard` challenge transcribed from "Level 1 Standard · content" in the spec, following level-data; include rules R1 to R7, flow F1, attacks A1 to A3, probes P1 and P2, rival [R5, R1], and `referenceSolution` [R1]
- [X] T007 Create `tests/cases.js` exporting the eight Level 1 Standard rows of the spec's cases table as literal data: level, tier, rule base with control settings, expected `outcome`, expected deciding rule position per named flow, player and rival `breachStep`, `score`, and `completed`
- [X] T008 Create `tests/rules.test.js` that runs every entry of `tests/cases.js` through `evaluateSubmission` and compares each expected field, checks the rival's computed score against the spec's stated rival score, and submits one rule base ten times asserting identical results (FR-013); run `node tests/run-node.mjs` and confirm these tests fail because the engine does not exist yet
- [X] T009 [P] Create `tests/content.test.js` asserting that `validateContent` rejects each case in the data-model "Validation rules (content)" list (missing field, duplicate ID, unresolved reference, required flow that carries something, required flow identical to an attack step, rival that fails the service check, rival that is never breached, reference solution that does not complete, missing source, no attack steps, wrong `schemaVersion`) and accepts the shipped `data/levels.json`

### Implementation

- [X] T010 Implement `evaluateFlow(ruleBase, rules, flow)` in `engine/rules.js` per engine-api: first-match walk, the matching rules, and the verdict table; honor data-model `Rule.action`, `Rule.services`, `Rule.srcAddress`, `Rule.dstAddress`, `Rule.application`, `Rule.userGroup`, `Rule.controls`, `Flow.carries`, and `Flow.encrypted`; return data-model `Flow verdict.verdict`, `Flow verdict.matchedIndex`, `Flow verdict.control`, `Flow verdict.reasonCode`, and `Flow verdict.laterMatches`
- [X] T011 Implement `evaluateRuleBase(challenge, ruleBase)` in `engine/rules.js` per engine-api: service check, all attack steps and probes evaluated even after a breach, `breachStep`, and the score rule of FR-019
- [X] T012 Implement `evaluateSubmission(challenge, ruleBase)` and `canonicalForm(ruleBase, rules)` in `engine/rules.js` per engine-api, producing data-model `Submission result.outcome`, `Submission result.completed`, and `Submission result.exposures`, with attack and probe sections absent on an outage
- [X] T013 Run `node tests/run-node.mjs` and fix `engine/rules.js` until all eight Level 1 Standard cases and the determinism test in `tests/rules.test.js` pass
- [X] T014 Implement `validateContent(document)` in `engine/content.js` per engine-api, enforcing every rule in the data-model "Validation rules (content)" list and data-model `Level.challenges` tier keys, calling `evaluateRuleBase` and `evaluateSubmission` for the rival and the reference solution, and returning file errors separately from per-challenge status
- [X] T015 Run `node tests/run-node.mjs` and fix `engine/content.js` until every test in `tests/content.test.js` passes
- [X] T016 Open `tests/index.html` through `python3 -m http.server 8000 --bind 127.0.0.1` and confirm the browser runner reports the same totals as the command-line runner
- [X] T017 Record the Phase 2 result (test totals, command used, date, browser) in `docs/verification.md`

**Checkpoint**: The rule is proven. Level 1 Standard evaluates correctly without any interface.

---

## Phase 3: User Story 1 - Build a rule base and face the penetration test (Priority: P1) 🎯 MVP

**Goal**: A player chooses a tier, reads the Level 1 briefing, builds a rule base from cards,
runs the test, and sees each attack decided for both firewalls with the deciding rule named.

**Independent Test**: Play Level 1 Standard from a fresh session using quickstart.md scenarios 1
and 2; the results match the spec's Level 1 cases.

### Tests for User Story 1

- [X] T018 [US1] Create `tests/state.test.js` with tests for the core flow per engine-api and the data-model "State transitions": `chooseTier` leads to a briefing, `startBuild` to the build view, `addRule`, `removeRule`, and `moveRule` edit the working rule base and ignore out-of-range moves, `submit` on an empty rule base returns guidance and leaves attempts unchanged, a new submission returns a result, `retry` keeps the rule base, and `next` after completion moves on; confirm they fail

### Implementation for User Story 1

- [X] T019 [US1] Implement `createSession` in `engine/state.js` with `chooseTier`, `startBuild`, `addRule`, `removeRule`, `moveRule`, `submit`, `revealNextStep`, `revealAll`, `retry`, and `next`, holding data-model `Session state.view`, `Session state.workingRuleBase`, `Session state.lastResult`, and `Session state.revealedSteps`, with one data-model Progress record per tier from the start; make the T018 tests pass
- [X] T020 [P] [US1] Implement `explainVerdict` and `explainResult` in `engine/feedback.js` per engine-api: a sentence for each data-model `Flow verdict.reasonCode`, the outage explanation using `laterMatches`, the five outcome headings from ui-contract, a "why this works" sentence for a completed level (FR-018), and the authored `lesson` appended for an allowed attack step or probe
- [X] T021 [P] [US1] Add the Level 1 Standard briefing (paragraphs, a worked example that differs from the challenge, simplifications, `sourceIds`), the business request, the topology text description, and a `lesson` for each attack step and probe to `data/levels.json`
- [X] T022 [US1] Implement `main.js`: show "Loading levels", fetch `data/levels.json` by relative URL, run `validateContent`, show the content error view with Retry Loading on a file-level failure, otherwise create the session and render tier selection (FR-033)
- [X] T023 [US1] Implement the tier selection, briefing, and content error views in `ui/render.js` per ui-contract
- [X] T024 [US1] Implement the build view in `ui/render.js` per ui-contract: business request, topology with its text description, hosts, the rule table numbered from 1 with empty fields shown as "any", available rule cards with Add, per-rule Move Up, Move Down, and Remove buttons, and Run Penetration Test (FR-003, FR-004, FR-006, FR-007)
- [X] T025 [US1] Implement the result view in `ui/render.js` per ui-contract: outcome heading in words, service check, attack steps revealed one per Next Attack with Show Full Results, each firewall's verdict with the deciding rule position and label or "implicit deny", "matched here" and "not reached" text labels on the rule tables, the rival's rule base, and Retry or Next (FR-010, FR-011, FR-016, FR-017, FR-040)
- [X] T026 [US1] Implement `ui/controls.js`: bind every button to its session method, re-render after each change, and show the guidance message for an empty submission without counting an attempt
- [X] T027 [P] [US1] Write the base layout in `style.css`: page structure, rule table, cards, verdict styles that pair a word with color, and a visible focus indicator on every control
- [X] T028 [US1] Serve the game and play quickstart.md scenarios 1 and 2 plus spec User Story 1 acceptance scenarios 1 to 6; fix defects; record each scenario's result in `docs/verification.md`

**Checkpoint**: Level 1 Standard is playable start to finish. This is the MVP.

---

## Phase 4: User Story 2 - Get help and see honest progress (Priority: P1)

**Goal**: Hints in three stages, truthful attempt and assistance counters, banked best score,
strength beside the rival's, capabilities, a session summary, and a confirmed restart.

**Independent Test**: On Level 1, use each hint stage, fail, resubmit the same rule base,
succeed, harden, and restart, checking the counters after each action (quickstart.md scenarios
3, 6, and 8).

### Tests for User Story 2

- [X] T029 [US2] Add tests to `tests/state.test.js` for: `requestHint` raising data-model `Progress.hintStage` one step at a time to at most 3 without submitting or completing; attempts rising by one per new submission while the level is not completed; an identical resubmission of a failed rule base returning the previous result with attempts unchanged (data-model `Progress.lastFailedSubmission`); a repeat submission after completion changing nothing; Harden Further raising data-model `Progress.bankedScore` to the higher value and never summing; a lower or failing hardening submission changing nothing; strength, rival strength, and capabilities derived in `summary()`; `restart(false)` changing nothing and `restart(true)` clearing all progress; confirm they fail

### Implementation for User Story 2

- [X] T030 [US2] Implement `requestHint`, `hardenFurther`, `restart`, and `summary` in `engine/state.js`, and extend `submit` with the attempt, duplicate, and banking rules listed under "Rules the state module enforces" in data-model; make the T029 tests pass (FR-020, FR-021, FR-022, FR-023, FR-025, FR-026, FR-031)
- [X] T031 [P] [US2] Add the two `hints` (method, one worked step) for Level 1 Standard to `data/levels.json`
- [X] T032 [US2] Add to the build view in `ui/render.js`: a Hint button and hint panel where stage 3 displays the `referenceSolution` as a rule list, the attempts and hints-used counters shown separately, both strength values, and the capability list (FR-025, FR-027)
- [X] T033 [US2] Add to the result view in `ui/render.js`: the score, the list of exposures each with its `lesson`, and Harden Further when a completed level has any exposure (FR-024)
- [X] T034 [US2] Implement the summary view in `ui/render.js` showing, per tier, completed levels, attempts, assistance used, strength versus rival strength, and capabilities (FR-027, FR-030)
- [X] T035 [US2] Add to `ui/controls.js` the Hint, Harden Further, and Restart bindings and the Restart confirmation with Confirm and Cancel (FR-031)
- [X] T036 [US2] Play quickstart.md scenarios 3, 6, and 8 plus spec User Story 2 acceptance scenarios 1 to 8 (scenario 7 using Level 1 as the only level if later levels are not built yet); fix defects; record results in `docs/verification.md`

**Checkpoint**: Progress, help, and scoring are honest and verifiable on Level 1.

---

## Phase 5: User Story 3 - Play with keyboard and readable feedback (Priority: P1)

**Goal**: Every core action works by keyboard, every outcome is stated in text and announced,
and the game holds up with reduced motion and in a narrow window.

**Independent Test**: Complete Level 1 using only the keyboard, then repeat with reduced motion
requested and at about 360 px wide.

### Implementation for User Story 3

- [X] T037 [US3] Give every control in `ui/render.js` an accessible name that includes its target (for example "Move rule 2 up", "Add rule: Allow Internet to WEB-1 on TCP 443"), render Move Up on the first rule and Move Down on the last as disabled and not hidden, and label the rule table region (FR-037)
- [X] T038 [US3] Implement focus handling in `ui/controls.js` per ui-contract: move focus to the new view's heading on a view change, keep focus on the same button of the moved rule after a move, and return focus to the triggering control when a confirmation is cancelled
- [X] T039 [US3] Implement live-region announcements in `ui/controls.js` for empty-submission guidance, the outcome heading, each revealed step's verdicts, hint text, and rule position changes such as "Rule moved to position 2 of 3" (FR-038)
- [X] T040 [P] [US3] Add to `style.css` a `prefers-reduced-motion: reduce` block that removes all transitions and animations, and confirm no result or control depends on an animation finishing (FR-040)
- [X] T041 [US3] Add narrow-window layout to `style.css`: usable from 360 px, the rule table scrolling horizontally inside its own labeled region, and the action buttons staying reachable (FR-041)
- [X] T042 [US3] Confirm in `ui/render.js` that the topology and the attack path each have a text equivalent and that no decision-relevant value appears only on hover (FR-003, FR-039)
- [X] T043 [US3] Perform the keyboard-only, narrow-window, and reduced-motion checks from quickstart.md "Manual checks to record" and spec User Story 3 acceptance scenarios 1 to 5; fix defects; record what was actually checked in `docs/verification.md` without claiming accessibility certification

**Checkpoint**: Stories 1 to 3 together are the complete P1 game on one level.

---

## Phase 6: User Story 4 - Strengthen the firewall with NGFW capabilities (Priority: P2)

**Goal**: Levels 2 and 3 at Standard: application-aware rules, security controls, user identity,
segmentation, and an inherited rule base to repair.

**Independent Test**: Play Levels 2 and 3 Standard using their cases; results, strength totals,
and the capability list match the spec (quickstart.md scenarios 4 and 5).

### Tests for User Story 4

- [X] T044 [US4] Add the four Level 2 Standard rows and the five Level 3 Standard rows of the spec's cases table to `tests/cases.js`, and the "Unsupported content" row as a test in `tests/content.test.js`
- [X] T045 [US4] Add tests to `tests/state.test.js` for `setControl` changing a control on a rule base entry, for a level being available only when it is the first or the previous level is completed in either tier (FR-028), for a challenge starting with its `startingRuleBase`, and for a removed starting rule becoming an available card again

### Implementation for User Story 4

- [X] T046 [US4] Add `level-2` with its `standard` challenge to `data/levels.json`, transcribed from "Level 2 Standard · content" in the spec: rules R1 to R5 with their offered controls defaulting to off, flows F1 and F2, attacks A1 to A3, probes P1 and P2, the rival, a `referenceSolution`, briefing with simplifications, lessons, and hints
- [X] T047 [US4] Add `level-3` with its `standard` challenge to `data/levels.json`, transcribed from "Level 3 Standard · content" in the spec: rules R1 to R5 as the `startingRuleBase` in order, flows F1 and F2, attacks A1 to A4, probes P1 to P3, the rival, a `referenceSolution`, briefing with simplifications, lessons, and hints
- [X] T048 [US4] Implement `setControl` in `engine/state.js` and the level-availability rule; make the T045 tests pass
- [X] T049 [US4] Run `node tests/run-node.mjs` and fix `engine/rules.js` or the data until all 17 Standard cases pass and `validateContent` accepts both new challenges
- [X] T050 [US4] Add control switches to the rule table in `ui/render.js` and their bindings in `ui/controls.js`, one switch per control the rule offers, named with its target such as "TLS decryption for rule 1" (FR-005)
- [X] T051 [US4] Add to `engine/feedback.js` the explanations for `inspection-blind-encrypted`, `no-control`, `inspection-stopped`, and `dns-filter-stopped`, and for an outage caused by a deny rule that an earlier rule used to shadow
- [X] T052 [US4] Make Next in `ui/controls.js` open the following level's briefing and the summary after the last level, and show each level's capability joining the list on completion (FR-023, FR-030)
- [X] T053 [US4] Play quickstart.md scenarios 4 and 5 plus spec User Story 4 acceptance scenarios 1 to 5, then a fresh start to the summary at Standard; fix defects; record results in `docs/verification.md`

**Checkpoint**: The full Standard curriculum is playable. All 18 Standard cases pass (17 in
`tests/cases.js` plus the unsupported-content test).

---

## Phase 7: User Story 5 - Take on the Expert tier (Priority: P3)

**Goal**: Each level at Expert: a larger inherited rule base to repair, more attack steps, and
progress recorded separately from Standard.

**Independent Test**: Play each Expert level using its cases; a level completed only at Standard
is not shown as completed at Expert (quickstart.md scenario 7).

**If the build runs short**, cut in this order and stop: T058, then T057, then T056. Omit the
cut challenge from `data/levels.json`; it then shows as unavailable.

### Tests for User Story 5

- [X] T054 [US5] Add the 16 Expert rows (1E, 2E, 3E) of the spec's cases table to `tests/cases.js`
- [X] T055 [US5] Add tests to `tests/state.test.js` for `switchTier`: it is free between levels, requires `confirmed` when the working rule base is unsubmitted and then discards it, keeps the other tier's progress, leaves a Standard-only completion not completed at Expert, and returns the unavailable status for a tier missing from data-model `Level.challenges`

### Implementation for User Story 5

- [X] T056 [US5] Add the `expert` challenge to `level-1` in `data/levels.json`, transcribed from "Level 1 Expert · content" in the spec: rules E1 to E9 all in the `startingRuleBase` in order, flows F1 to F4, attacks A1 to A5, probes P1 to P3, the rival, `referenceSolution` [E4, E3, E5, E6, E8], a shortened briefing, lessons, and hints
- [X] T057 [US5] Add the `expert` challenge to `level-2` in `data/levels.json`, transcribed from "Level 2 Expert · content" in the spec: rules X1 to X8 in order with their controls "as found" as defaults, flows F1 to F4, attacks A1 to A5, probes P1 and P2, the rival, a `referenceSolution`, a shortened briefing, lessons, and hints
- [X] T058 [US5] Add the `expert` challenge to `level-3` in `data/levels.json`, transcribed from "Level 3 Expert · content" in the spec: rules Y1 to Y8 in order, flows F1 to F3, attacks A1 to A6, probes P1 to P3, the rival, a `referenceSolution`, a shortened briefing, lessons, and hints
- [X] T059 [US5] Implement `switchTier(tier, confirmed)` in `engine/state.js`; make the T055 tests pass (FR-029)
- [X] T060 [US5] Run `node tests/run-node.mjs` and fix the data until every Expert case present passes and `validateContent` accepts every Expert challenge present; do not change `engine/rules.js` for an Expert case without re-deriving the case from the spec's technical model
- [X] T061 [US5] Add to `ui/render.js` and `ui/controls.js` the Switch Tier control on the build and summary views with its mid-level confirmation, the current tier shown on every view, and "Not available in this release" for a missing Expert challenge
- [X] T062 [US5] Play quickstart.md scenario 7 plus spec User Story 5 acceptance scenarios 1 to 5 and one Expert level to completion; fix defects; record results in `docs/verification.md`, including any Expert challenge that was cut

**Checkpoint**: All 34 cases pass, or the cut challenges are recorded.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Evidence and packaging required by constitution principle VII.

- [X] T063 [P] Add a test to `tests/content.test.js` that scans every string in `data/levels.json` against a short list of firewall vendor and product names kept in the test file and fails on any match (SC-006); read `index.html` and `engine/feedback.js` by eye for the same
- [X] T064 [P] Replace the workshop template in `README.md` with the real game: one-line pitch, what a level looks like using Level 1's real values, the learning outcomes table from the spec, the run and test commands from quickstart.md, the model's simplifications, the status, and any cut scope; delete the attendee note block
- [X] T065 Perform the remaining quickstart.md manual checks and record each in `docs/verification.md`: offline play after load (SC-009), the temporary content-error check and its revert, and adding a trial challenge by editing `data/levels.json` only then removing it (SC-008)
- [X] T066 Read every briefing, lesson, and explanation in `data/levels.json` and `engine/feedback.js` against its cited source and the spec's technical model; correct any that disagree; record the read-through in `docs/verification.md`
- [X] T067 Run `node tests/run-node.mjs` and the browser runner one final time, and complete `docs/verification.md` so every spec acceptance scenario and success criterion SC-001 to SC-009 has a line marked pass, fail, or not run with its evidence
- [X] T068 Remove the Sync Impact Report HTML comment from the top of `.specify/memory/constitution.md`, as it is review material and not governance content

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: needs Setup. Blocks every user story.
- **US1 (Phase 3)**: needs Foundational.
- **US2 (Phase 4)**: needs US1, because it extends the same state module and views.
- **US3 (Phase 5)**: needs US1. Independent of US2, except that controls added by US2 also need accessible names; apply T037 to them when both are done.
- **US4 (Phase 6)**: needs US1. Needs US2 for hints and the summary to show the new levels.
- **US5 (Phase 7)**: needs US4, because Expert reuses controls and inherited rule bases.
- **Polish (Phase 8)**: needs every story that is being shipped.

### Within Each Story

- Test tasks first, and they must fail before the implementation task.
- Engine before interface. Data before the cases that use it.
- Tasks that edit `data/levels.json`, `engine/state.js`, `ui/render.js`, `ui/controls.js`, `tests/cases.js`, or `tests/state.test.js` are sequential with other tasks on the same file, even across stories.

### Parallel Opportunities

- T002, T003, T004, T005 (four different new files).
- T009 alongside T006 to T008.
- T020, T021, and T027 alongside T019.
- T040 then T041 (both edit `style.css`, so one after the other) alongside T037 to T039.
- T063 and T064.

---

## Parallel Example: User Story 1

```text
# After T018 is written and failing, these three touch different files:
Task: "T019 Implement createSession in engine/state.js"
Task: "T020 Implement explainVerdict and explainResult in engine/feedback.js"
Task: "T021 Add the Level 1 Standard briefing and lessons to data/levels.json"

# T027 (style.css) can run alongside T023 to T026 (ui/).
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup.
2. Phase 2: Foundational. Stop at T017: the eight Level 1 cases pass with no interface.
3. Phase 3: User Story 1. Stop at T028 and play Level 1 Standard.
4. That is a demonstrable game: one level, correct grading, explained results, retry.

### Incremental Delivery

1. US2 adds hints, counters, score, strength, summary, and restart.
2. US3 completes and verifies keyboard, announcements, reduced motion, and narrow layout. P1 is done here.
3. US4 adds Levels 2 and 3 at Standard. The Standard curriculum is done here.
4. US5 adds the Expert tier, and is the first scope to cut.
5. Polish produces the README and the verification record.

Each step leaves a working game. If time runs out, stop at a checkpoint, record what was not
built in `README.md` and `docs/verification.md`, and do not mark unrun checks as passed.

---

## Notes

- Commit after each task or logical group. The repository is on `main`; create a branch first
  if you want the work isolated.
- 34 cases: 8 Level 1 Standard (T007), 4 Level 2 and 5 Level 3 Standard plus the
  unsupported-content test (T044), and 16 Expert (T054).
- The spec's stated rival scores (30, 15, 40, 45, 50, 50) are checked by T008's rival-score
  assertion as each level's data arrives. They are never stored in `data/levels.json`.
