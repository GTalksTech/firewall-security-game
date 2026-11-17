# Verification record

Date: 2026-11-17. Environment: macOS, Node 26.8.1, Chromium driven by Playwright, served with
`python3 -m http.server 8000 --bind 127.0.0.1`. Checks were performed by the build agent, not by
a human player, unless stated.

Result values: **pass**, **fail**, **not run**. An unrun check is not a pass.

## Automated checks

| Check | Result | Evidence |
| --- | --- | --- |
| Command-line runner, `node tests/run-node.mjs` | pass | 94 run, 94 passed, exit code 0 |
| Browser runner, `/tests/` | pass | "Tests run: 94. Passed: 94. Failed: 0. All passed." |
| The 33 rule-base cases from the spec (17 Standard, 16 Expert) | pass | `tests/rules.test.js`; passed on the first engine run with no case edited |
| Rival breach step and score for all six challenges | pass | Computed by the engine, compared with the spec's stated values (30, 15, 40, 45, 50, 50) |
| Same submission ten times gives identical results (SC-003) | pass | `tests/rules.test.js` |
| Invalid content is rejected: 18 mutations plus file-level cases (FR-034) | pass | `tests/content.test.js` |
| No vendor or product name in `data/levels.json` (SC-006) | pass | `tests/content.test.js`, 24 terms |
| No computed answers stored in `data/levels.json` | pass | `tests/content.test.js` |
| Session rules: attempts, hints, duplicates, hardening, unlocks, tiers, restart | pass | `tests/state.test.js`, 29 tests |

Test-first status: the engine and content tests were run and seen to fail before `engine/rules.js`
and `engine/content.js` existed. The session tests were written before `engine/state.js` but
were **not** run in a failing state first.

## Browser playthroughs (keyboard only: Tab, Enter, Space)

| Scenario | Result | Evidence |
| --- | --- | --- |
| US1-1 Fresh session shows tier selection, then the Level 1 briefing before editing | pass | Heading "Level 1 of 3: Open the storefront. Briefing" received focus |
| US1-2 Level 1 [R1] completes; rival breached at step 1 | pass | Heading "Your firewall survived and the rival fell"; strength 40, rival 30 |
| US1-3 Level 1 [R3, R1] is an outage naming rule 1; test not run | pass | "Rule 1 (Deny Internet to the DMZ, anything) is the first match and denies it. Rule 2 … is never reached." |
| US1-4 Level 1 [R1, R2] is breached at step 1 | pass | Heading "Both firewalls breached at step 1"; rule 2 marked "matched here" |
| US1-5 Empty rule base gives guidance, attempts unchanged | pass | Guidance shown and announced; "Attempts on this level: 0" |
| US1-6 Full results available without stepping through | pass | Show Full Results revealed all steps at once; Retry present from the start |
| US2-1 Three hint stages; none completes the level | pass | Method, worked step, worked solution shown in order on Level 3 |
| US2-2 Each new failing submission is one attempt | pass | Counter went 0 to 1 after the first failure |
| US2-3 Identical failed resubmission is not a new attempt | pass | Counter stayed at 1 |
| US2-4 Resubmitting after completion changes nothing | pass | Automated (`state.test.js`); not repeated in the browser |
| US2-5 Harden Further keeps the higher score, not the sum | pass | Level 3 banked 50, then 55 after hardening; strength 130 to 135 |
| US2-6 Strength beside the rival's; capability added | pass | Status bar "Your firewall strength: 135. Rival: 85."; three capabilities in summary |
| US2-7 Summary after the third level, per tier | pass | Completed, attempts, assistance, and score shown per level for both tiers |
| US2-8 Restart confirm and cancel | pass | Cancel returned focus to Restart with nothing changed; confirm returned to tier selection |
| US3-1 Every core control reachable by Tab with a name | pass | All actions in the three Standard levels and Expert Level 1 reached by Tab alone |
| US3-2 Move by keyboard; new position announced | pass | "Rule moved to position 2 of 2."; focus moved to the rule's Up button when Down became disabled |
| US3-3 Outcomes in words, kept on screen, sent to the live region | pass | Live region text read from the page after each action. **Not tested with a screen reader** |
| US3-4 Reduced motion loses nothing and delays nothing | pass | With reduced motion emulated: 0 animated or transitioning elements; results and Retry present immediately |
| US3-5 Narrow window | pass | At 360 px wide: page does not scroll sideways, rule table scrolls inside its region, Run Penetration Test fully visible |
| US4-1 Level 2 available at both tiers after Level 1 at either | pass | Automated; also seen after switching to Expert |
| US4-2 Level 2 inspection on, decryption off | pass | Heading "You outlasted the rival but were still breached"; next step "switch on TLS decryption for rule 1" |
| US4-3 Level 2 port-based rule lets the tunnel through | pass | Automated case `2-mistake-port-rule`; not played in the browser at Standard |
| US4-4 Level 3 removing only R1 is an outage | pass | Heading "Outage: required traffic is blocked" naming the deny rule in position 1 |
| US4-5 Level 3 [R3, R4] with inspection completes | pass | Score 55; rival breached at step 4 |
| US5-1 Tier switch is free and keeps the other tier's progress | pass | Standard progress intact in the summary after switching |
| US5-1 Mid-level switch asks first and discards the unsubmitted rule base | pass | Confirmation shown; cancel left the tier unchanged |
| US5-2 Expert level shows an inherited rule base of at least eight rules | pass | Level 1 Expert opened with 9 rules |
| US5-3 Same three hint stages at Expert | not run | Same code path as Standard; not exercised in the browser |
| US5-4 Standard-only completion not shown as Expert | pass | Expert summary rows all "Not completed" after completing Level 1 at Standard |
| US5-5 A missing Expert challenge is shown as unavailable | pass | Automated (`state.test.js`). The view was **not** looked at in the browser |
| Expert Level 1 played to completion by keyboard | pass | [E4, E3, E5, E6, E8]; score 65, rival 45 |
| Expert Levels 2 and 3 played in the browser | not run | Covered by the automated cases only |

## Success criteria

| Criterion | Result | Evidence |
| --- | --- | --- |
| SC-001 First-time player finishes Standard in 15 minutes | not run | No human first-time player has played it |
| SC-002 All cases produce expected results | pass | 33 of 33, plus the unsupported-content test |
| SC-003 Ten identical submissions, ten identical results | pass | Automated |
| SC-004 Explanation alone names the cause of a wrong result | pass | Checked for one wrong submission in each Standard level (rows US1-3, US4-2, US4-4) |
| SC-005 Every shipped level keyboard-completable | pass for Standard 1 to 3 and Expert 1; not run for Expert 2 and 3 | Same controls, but those two were not played |
| SC-006 No vendor names in shipped text | pass | Automated scan of `levels.json`; `index.html`, `ui/render.js`, and `engine/feedback.js` read by the author |
| SC-007 Every rule, attack step, and control effect has a checked source | pass | Sources read on the live pages on 2026-11-17 (see spec, "Control effects and their sources"); validation rejects a challenge or briefing with no source |
| SC-008 New challenge by editing content only | pass | A trial level with an extra attack step was added to a copy of the data: validated "ok" and evaluated with 4 steps, no code change. Done from the command line, not played in the browser |
| SC-009 Plays with no network after load | pass, by request log | Across a full playthrough the only requests were the game's own 10 files, all at load. The network was **not** physically disabled |

## Other checks

| Check | Result | Notes |
| --- | --- | --- |
| No free-form input anywhere (FR-007) | pass | 0 text inputs, textareas, selects, or editable elements on the page |
| No console errors | pass | None during play |
| Briefings, lessons, and explanations agree with their sources | pass, with a limit | They were written from the sourced tables in the spec. No separate later read-through was done |
| Content error view when a rival survives every step | pass (automated) | `state.test.js` and `content.test.js`; not viewed in the browser |
| Reload starts a fresh session (FR-032) | pass | Reload returned to tier selection with no progress |
| Browsers other than Chromium | not run | |
| Screen reader | not run | |
| Dark color scheme | not run | Styles exist; not looked at |

## Decisions made during implementation

These were open in the analysis report and were settled while building:

- **Switching tier keeps the current level.** From the summary, it opens the earliest level not yet completed in the new tier.
- **Database flows use TCP 5432**, stated in the briefing as illustrative.
- **Validation rule 3 was narrowed.** A required flow may share its matching fields with an attack step when that step carries something a control can detect (for example the web server's legitimate database query and the same query carrying an exploit). Only an attack step that carries nothing and matches a required flow is rejected. `data-model.md` was updated to say so.
- **A `package.json` with `"type": "module"` was added** so the tests run on Node 20 and later. It has no dependencies and nothing to install.
- **No topology diagram was drawn.** The network is described in text and a host table, which is the text equivalent the spec requires.
- **`data/levels.json` was generated once from a helper script** that is not in the repository. The JSON file is the source of truth from here on.

## Scope not built

- The live turn-by-turn battle mode (deferred by the constitution).
- Generated artwork (discussed; optional, not started).

## Visual and experience improvements

Made in three Ralph-loop iterations on 2026-11-17. Only `style.css`, `ui/render.js`,
`ui/controls.js`, and `index.html` were changed. The engine, level data, cases, grading, and
scoring were not touched. All art is inline SVG drawn in code; nothing is fetched.

### Iteration 1: identity, art, and the faceoff arena

Changed:

- Visual identity: dark header with a shield logo, a teal color for your firewall and a magenta
  color for the rival, card shadows, monospace for addresses. Light and dark schemes.
- Shield art for both firewalls (intact, breached with a crack, or won with a check mark), used
  on the title screen and in the result view. Decorative; the state is always in text beside it.
- A network diagram drawn from each level's data: one firewall bar joined to each zone, hosts
  inside their zone. It carries the level's text description as its label, and the description
  and host table still follow it.
- A faceoff arena in the result view: both firewalls side by side with a status line
  ("Holding after step 2", "Breached at step 1"), a count of attacks stopped, and one pip per
  attack step. It reflects only the steps revealed so far.
- Attack step cards slide in as they are revealed and carry a colored edge; a breached shield
  shakes once. A strength meter sits beside the strength numbers in the header.

Checked:

| Check | Result | Evidence |
| --- | --- | --- |
| `node tests/run-node.mjs` | pass | 94 of 94 |
| Desktop width (1280 px), title, build, and result views | pass | Screenshots reviewed; no console errors |
| 360 px wide | pass | Page does not scroll sideways; arena stacks to one column |
| Outcomes still stated in text | pass | Arena status and counts are text; verdict words unchanged |
| Reduced motion | not re-run this iteration | The reduced-motion rule is restated last in `style.css`; re-checked in iteration 3 |

Noted for later iterations: the build view is one long column; the rule table's Change column
is clipped at desktop width on Level 1; the host table repeats the diagram.

### Iteration 2: build view, rule identity, progress track, badges, celebration

Changed:

- Build view is two columns on wide screens: the request and network stay in view on the left
  while you work on the rule base on the right. One column below 72rem.
- Rule tables show only the match fields a level uses. Fields that are "any" for every rule in
  the level are left out, and the table caption names them. The host table moved into a
  disclosure labeled "Host table (the diagram as text)".
- Every rule now shows its ID (R1, E4, …) in the rule base, the available-rule cards, and the
  result tables. Hints and feedback referred to these IDs but the interface never showed them.
- Move and remove buttons are compact (▲ ▼ ✕) with full accessible names such as
  "Move rule 1 up". A rule that was just added or moved is highlighted briefly.
- A level progress track under each heading shows every level as Completed, Current, Open,
  Locked, or Not available, in words.
- Completing a level shows the capability it adds as a badge; the summary lists badges per
  tier. A win shows a check on your shield and a short confetti burst.
- The bottom bar shows the rule count and "No time limit" beside Run Penetration Test.

Checked:

| Check | Result | Evidence |
| --- | --- | --- |
| `node tests/run-node.mjs` | pass | 94 of 94 |
| Keyboard only: add, move, remove, switch controls, submit, reveal, next (Levels 1 and 2) | pass | Focus stayed on the moved rule's button; no console errors |
| Level 1 rule table at 1366 px | pass | No longer clipped (it was before this iteration) |
| Expert Level 1 rule table at 1366 px | fail | Still scrolls inside its region: nine rules with a Source column do not fit beside the side column. Carried to iteration 3 |
| 360 px wide | pass after a fix | The new grid first made the page scroll sideways; fixed with a zero minimum column width |
| Reduced motion | pass | Confetti not displayed; 0 animating or transitioning elements |
| Confetti never blocks a control | pass | `pointer-events: none`; Next was clickable immediately |
| Level state still in words at narrow width | pass after a fix | A first version hid the state text below 40rem; that rule was removed |

### Iteration 3: briefing, title, the incoming-attack moment, summary, and re-checks

Changed:

- Rule tables now fit at laptop width in every level. Between 60rem and 96rem the request and
  the network sit side by side above the rule base, so the table gets the full width; the side
  column appears only on very wide screens.
- Title screen has a three-step "how a level works" strip. Briefings show the key ideas as
  numbered cards, the worked example as a callout, and a "Your mission" box with the request
  and the capability at stake.
- The arena names the attack in play between the two firewalls ("Attack 2 of 5: …") and each
  firewall pulses green or red as a step is decided.
- The summary shows your strength and the rival's as labeled bars with the numbers on them.

Checked:

| Check | Result | Evidence |
| --- | --- | --- |
| `node tests/run-node.mjs` | pass | 94 of 94 |
| Expert Levels 1, 2, and 3 played to completion by keyboard only | pass | All three ended "Your firewall survived and the rival fell"; Expert strength 200, rival 145. This closes the earlier "not run" for Expert Levels 2 and 3 |
| Tier chosen by keyboard | pass | Tab to the radio group, Arrow Down to Expert |
| Rule table fits at 1366 px, Expert Levels 1, 2, 3 | pass | No horizontal scroll inside the table region |
| 360 px wide, result and build views | pass | Page does not scroll sideways; the rule table scrolls inside its own region |
| Reduced motion | pass | 0 animating or transitioning elements on a result view |
| Dark color scheme | pass | Result view reviewed in a screenshot; text and verdicts legible |
| No console errors | pass | None across the run |

Still not done after three iterations:

- The game is still a rule table and text results with art around them. There is no moving
  playfield: packets are not shown travelling to the firewall and being checked rule by rule.
- No sound.
- Not tested with a screen reader, in other browser engines, or by a human first-time player.

## Tower-defense playfield

Added on 2026-11-17 after feedback that the game still read as text on a screen. New file
`ui/playfield.js`; `ui/render.js`, `ui/controls.js`, `style.css`, and `README.md` changed. The
engine, level data, cases, grading, and scoring were not touched.

What it is: a pixel-style canvas in which each rule is a gate on a wall. An attack packet flies
to your wall and the rival's at the same time and is checked from the top gate down. Gates that
do not match are marked "no match"; the first that matches opens or slams shut; a packet that
passes every gate falls to the implicit deny; a control that stops a packet appears as a
scanner behind the wall. A breached base burns and stays burning. The same canvas previews
your wall while you build, shows a blocked customer packet on an outage, and runs a short demo
on the title screen. Sound effects are synthesized in the browser (no audio files) with a
Sound on/off button.

| Check | Result | Evidence |
| --- | --- | --- |
| `node tests/run-node.mjs` | pass | 94 of 94 |
| Animation matches the engine result | pass | Screenshots of deny, implicit deny, breach, control stop, and outage each showed the same deciding rule as the text below |
| Results are not delayed by the animation | pass | Step text, verdicts, and buttons are present as soon as the step is launched; Show Full Results skips the animation |
| Keyboard only, Levels 1 and 2 with the playfield | pass | Focus stayed on the launch button between attacks; live region announced each step |
| Canvas has a text label | pass | Label names the attack and both verdicts, e.g. "Animation of attack 1 of 3 … Your firewall: Denied …" |
| Reduced motion | pass | With reduced motion emulated the final frame is drawn at once and no animation loop starts |
| 360 px wide | pass | Canvas scales to the width; page does not scroll sideways. At that width the canvas text is small; the text results below carry the content |
| Sound toggle | pass | Button switches between "Sound: on" and "Sound: off" with `aria-pressed`; keyboard reachable |
| Sound itself | not run | The automated browser cannot hear; the effects were not listened to |
| Network | pass | Only the game's own 11 files are requested, all at load |
| No console errors | pass | None across the run |
| Other browsers, screen reader, human player | not run | |

## Arcade edition redesign (Level 1 slice)

Built on 2026-11-17 after the owner said the game still read as text on a screen. New files:
`index.html` (replaced), `game/game.js`, `game/game.css`. The earlier interface is kept as
`classic.html`. The rule engine, level data, and tests were not changed. Constitution amended
to v2.0.0 to allow per-wave server and uptime bars and to require that a live wave can always
be skipped.

What it is: the whole screen is the playfield. Rule tiles are dragged from a tray onto a wall.
Launching a wave sends customers, attackers, and unrequested traffic in live; each is checked
gate by gate. Three blocked customers is an outage; one attacker reaching a server is a
breach; either ends the wave and explains which gate decided. A rival's wall faces the same
wave in an inset. Level 1 has three waves, one per attack step.

| Check | Result | Evidence |
| --- | --- | --- |
| `node tests/run-node.mjs` | pass | 94 of 94 (engine and text edition; the arcade layer has no automated tests yet) |
| Mouse drag from tray to wall | pass | R1 and R7 dragged onto the wall in an automated browser |
| Keyboard-only full level | pass | Placed, reordered, and removed tiles, launched waves, and dismissed every dialog with Enter and arrow keys |
| Outage path | pass | Wall [R3, R1]: three customers bounced off gate 1; dialog named rule 1 and the unreached rule 2 |
| Breach path | pass | Wall [R1, R7]: wave 1 cleared, wave 2 breached through gate 2 (TCP 8080) |
| Victory matches the engine | pass | Wall [R1]: score 40, rival 30. Wall [R4]: score 35 with the port 80 exposure listed and Harden offered |
| Rival | pass | Rival breached in wave 1 and shown as breached for the rest of the level |
| Dialogs block the game behind them | pass after a fix | Tiles could first be operated behind an open dialog; the background is now inert |
| Reduced motion | pass | All three waves resolved and reported in under a second with no animation |
| Skip to result | not run | Same code path as reduced motion; the button itself was not pressed in a test |
| 360 px wide | pass | No horizontal or vertical page scroll; Launch stays visible. Tiles are small at this size |
| Text edition still works | pass | `classic.html` loads and links back |
| Network | pass | Only the game's own files are requested |
| Console errors | pass | None |
| Sound, screen reader, other browsers, touch drag, a human player | not run | |

Not in the arcade edition yet: Levels 2 and 3, the Expert tier, security-control switches on
tiles, hints, and a per-tier summary. They remain in the text edition.
