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

## Arcade edition, second redesign: real time

Built on 2026-11-17 after the owner said the first arcade slice was better but still not fun or
interactive enough, and too wordy. `game/arcade.js` replaces `game/game.js`.

What changed: there is no build-then-watch split. Traffic flows continuously and the wall can
be edited at any moment. The level is the richer Level 1 challenge played from a bare wall,
with business orders arriving mid-run (partner SSH, then mail in and out) and five attack
waves, one of which only a blocklist gate placed above the web gate can stop. Five server
hearts, a customer-patience meter, a combo multiplier, and one to three stars. Tiles read
"✓ 443 → WEB-1". The briefing dialog is gone; one-line prompts appear when something goes
wrong. Pause is always available and the wall can still be edited while paused.

This edition does not follow the current specification's scoring or its submit-then-test flow.
The verdict for every packet still comes from the rule engine, and the three-star check uses
the engine's result for the final wall. The specification and constitution have not been
rewritten for it yet; that is pending the owner's decision on whether this direction is right.

| Check | Result | Evidence |
| --- | --- | --- |
| `node tests/run-node.mjs` | pass | 94 of 94 (engine and text edition; the arcade layer has no automated tests) |
| Perfect run, keyboard only | pass | Gates placed as each order arrived, blocklist moved to the top in wave 3: 3 of 3 stars, 5 hearts, rival down at 1:03 |
| Breach | pass | Only the "22 to any" style wide gate on the wall: five hits, "BREACHED" after 0:24 |
| Outage | pass | Deny-all above the web gate: customers turned away, "OUTAGE" after 0:16 |
| Live editing during traffic | pass | Wide gate swapped for the narrow one by mouse drag mid-wave; leaks stopped and the leak badge cleared |
| Pause, then edit | pass | P paused the game; a gate was removed while paused |
| Mid-run orders | pass | Orders strip grew from one to three orders at waves 1 and 2 |
| Console errors | pass | None |
| Reduced motion | not run for this version | The game is real time; the title screen says so and points to the text edition |
| 360 px wide, touch drag, sound, screen reader, other browsers, a human player | not run for this version | |

## Arcade edition: all three levels (2026-11-17)

Levels 2 and 3 now play in the arcade edition, each built on its expert challenge.
New: a level select with saved stars, scanner switches on gates (SCAN, DECRYPT,
DNS FILTER), who and application labels on packets and gates, and `game/logic.js`,
a screen-free module holding the timetable, labels, hints and star rules.

| Check | Result |
|---|---|
| `node tests/run-node.mjs` | Pass: 133 tests (94 engine and content, 39 new arcade tests) |
| Scripted perfect run of each level in an automated browser, by mouse click | Pass: three stars on all three (scores 7035, 7265, 9275), no console errors |
| Stars saved and shown on the level select | Pass |
| The new arcade tests found one real fault | Fixed: in Level 1 an outbound attack and a customer both read "443"; outbound packets now say who sent them and "OUT" |

Not run: sound, touch, a screen reader, browsers other than the automated Chromium, a human playtest.

## Arcade polish loops (2026-11-17)

### Loop 1

Problems seen in screenshots at 1280x800 and 390 wide, and what changed:

- A first-time player could not tell which gate to start with. Spare gates that would let blocked wanted traffic in are now marked "TRY" (outlined, with a text badge). The marks come from the rule engine and are tested: every wanted flow has one, and the reference gate is always among them.
- The HUD wrapped to two rows at 1280. It is now one row; RESTART is RETRY.
- Packet labels ran off the left edge and stacked on each other. They are kept on screen, alternate above and below the packet, and sit on a dark backing.
- Hints were long. "GATE 1 IS TOO WIDE: IT LETS STAFF 5432 DB IN. SWAP IT." replaces a two-sentence version; the breach screen no longer says the same thing twice.
- The wall no longer sits under a wrapped order strip; its position follows the strip's height.

| Check | Result |
|---|---|
| `node tests/run-node.mjs` | Pass: 136 tests |
| All three levels won with three stars at 6x speed, automated browser | Pass, no console errors |
| 390 wide: no sideways page scroll | Pass |
| 390 wide: playable layout | **Fail**: the wall covers the playfield and part of the HUD is cut off. Carried into loop 2. |

### Loop 2

- After a leak that a switch would have stopped, that switch now flashes on the gate with a "!" in front of it, as well as the hint line. Which switches to flag is worked out in `game/logic.js` and tested against the rule engine: the flagged switches stop the leak, and dropping any one of them does not.
- Switches now say their state in words ("SCAN ON", "DECRYPT OFF") and carry a one-line explanation on hover. Gates carry their full rule sentence on hover.
- A new order flashes in the order strip for a few seconds so it is not missed.
- A three-item key under the tray says what the packet shapes mean: wanted, attack, not needed.
- Phone width (390): the page was wider than the screen because the layout grid grew to fit the tray, which pushed the HUD and playfield off to the side. Fixed. The wall is narrower there, with smaller gates, hosts, packets and labels, and the tray scrolls sideways.

| Check | Result |
|---|---|
| `node tests/run-node.mjs` | Pass: 139 tests |
| All three levels won with three stars at 6x speed, 1280x800, automated browser | Pass, no console errors |
| Level 2 with DECRYPT left off: the DECRYPT switch is flagged after the first malware hit | Pass |
| 390 wide: HUD, wall, hosts, rival and tray all on screen; no sideways page scroll | Pass by screenshot. It is tight: packet labels still crowd each other at the top of the wall. |

### Loop 3

- Packets all queue at the top gate, and their labels piled up there. Labels now fade as a packet reaches the wall (they are readable on the way in), the queue is spread wider, and the lock mark stays on.
- A trusted session carrying an exploit that got through an unscanned gate badged the gate "TOO WIDE", which pointed at the wrong fix. It now reads "SWITCH ON SCAN", flags the switch, and the prompt says the same.

| Check | Result |
|---|---|
| `node tests/run-node.mjs` | Pass: 139 tests |
| All three levels won with three stars, by mouse, 6x speed, 1280x800 | Pass, no console errors |
| Level 1 won with three stars by keyboard only (Enter, arrow keys), 3x speed | Pass |
| Level 3 without SCAN: badge reads "SWITCH ON SCAN" and the SCAN switch is flagged | Pass |
| One combined test script timed out at 6x speed | Cause: the script fell behind the game clock and missed an order, so the run ended in an outage. Rerun in parts at 3x: pass. Not a game fault. |

### Still not verified after the three loops

- No person has played the finished game. Whether Levels 2 and 3 are fun, fair, or too fast is unknown.
- Sound, touch dragging, a screen reader, and any browser other than automated Chromium.
- Reduced motion in the arcade edition: decorative CSS animation is switched off, but the game itself is motion.
- `/speckit-analyze` was not rerun after the constitution moved to 3.0.0 and `specs/002-arcade-edition/spec.md` was added.

## Strategy edition: turn-based 3D hex game (2026-11-17)

Built after play feedback that the arcade version did not explain itself and was not the kind of game wanted. It is now `index.html`; the arcade version moved to `arcade.html`. Requirements are in `specs/003-strategy-edition/spec.md`. The constitution is at 3.1.0: it names the strategy edition as the main game and permits one rendering library copied into the repository.

| Check | Result |
|---|---|
| `node tests/run-node.mjs` | Pass: 164 tests, 25 of them new for the turn rules |
| Home menu, briefing, guide steps, How to play (SR-001 to SR-004) | Pass: opened and read in an automated browser at 1440x900 and 1280x720 |
| Guide: Play, Begin, Next, Next, add the gate marked TRY, End turn, by keyboard only (Enter) | Pass: focus lands on the next thing to press each time. Two focus faults found and fixed (focus was lost after adding the first gate; after "Next" it went to End turn instead of the highlighted gate list). |
| All three levels played start to finish through the real interface, adding the reference gates as requests arrive (reduced motion on, to run fast) | Pass: three stars on each (scores 187, 193, 202), no console errors |
| Level 2 played carelessly (port gate, no DECRYPT) | Pass: advisor named the attack, the gate and the fix three turns ahead; after the hits the gate was badged and DECRYPT flagged; the level ended as Breached with a retry |
| 3D map renders in headless Chromium (WebGL) | Pass by screenshot |
| No requests leave the machine | Pass by reading the code: the page loads only its own files; three.js is in `vendor/` |

Faults found by looking at screenshots and fixed: gate labels showed "[object HTMLSpanElement]"; the requests panel hid the left of the map (now a strip along the top); unit banners piled on top of each other (now pushed apart on screen).

Not verified, or known to be weak:

- No person has played it. Fun, pacing and difficulty are untested.
- At 390 wide the page fits without sideways scroll, but the map is too small to be useful. This version is for desktop and laptop screens.
- Banners can still crowd when many units share one corner of the map.
- Normal-speed animation was only spot-checked by screenshot; the full playthroughs ran with reduced motion.
- Sound, touch, a screen reader, other browsers, and a machine without WebGL (the fallback screen was written but not triggered).
- `/speckit-analyze` was not rerun.

## Strategy edition visual loops (2026-11-17)

`tests/browser/strategy-playthrough.js` is the browser script used for the "all three levels" check below. It is run by hand in a Playwright session against the local server; it is not part of `node tests/run-node.mjs`.

### Loop 1: the land, the wall, the light

Judged against a polished hex strategy game, the first build looked like a flat tabletop: identical flat tiles, a thin grey wall, harsh even light. Changed:

- Tiles are now two-layer (an earth or sand side with a narrower coloured top), vary slightly in height and shade, and have a sandy edge where they meet water. Water is glossy and bobs gently.
- Added mountains with snow caps at the map edges, two kinds of tree in varied sizes, rounded hills, striped fields with small barns, and scattered rocks and scrub.
- The wall has battlements and round towers; the gatehouse has two roofed towers, a keep, doors, banners and flickering torches.
- A road runs from the map edge to the gatehouse and on to each district.
- Warm low sun with soft shadows, a cool sky fill, filmic tone mapping, and a vignette over the map.

| Check | Result |
|---|---|
| `node tests/run-node.mjs` | Pass: 164 tests |
| All three levels won with three stars through the real interface | Pass: scores 187, 193, 202; no console errors; no requests to other hosts |
| Screenshot at 1440x900, Level 1 turn 5 | Looks clearly better than before. First try was over-exposed and washed out; exposure lowered from 1.18 to 1.02. |

Not done in this loop: districts and units are still the first-build models, and there are no effects when a unit is judged.

### Loop 2: buildings, units, and what happens at the gate

After loop 1 the land looked good but everything standing on it was still a cluster of identical boxes, units were hard to tell apart at a glance, and a unit being judged just slid and vanished. Changed:

- Each district is now a distinct building chosen from the server's name: a domed hall (web), a post tower (mail), a keep (jump host), stacked drums (database), a workshop with a chimney (application server), a signpost obelisk (DNS), market stalls (web sites), and a dark spiked fort for hostile destinations. All have lit windows and a ring of small houses.
- Units have clear outlines: a covered wagon pulled by an ox, a horned raider with spear and shield, a hooded drifter carrying a lantern. Each has its own idle motion (rolling, looking about, hovering). Idle motion is off with reduced motion.
- When the gatehouse judges a unit there is now a ground ring and a burst of pieces: grey or red for blocked, cyan for scanned, orange with fire for a breach, gold when wanted traffic is served.
- A pulsing ring on the ground marks the tile where units are judged.
- The camera glides in from above when a level begins (skipped with reduced motion, cancelled by dragging) and sits a little further back so the left edge of the map is in view.

| Check | Result |
|---|---|
| `node tests/run-node.mjs` | Pass: 164 tests |
| All three levels won with three stars through the real interface | Pass: scores 187, 193, 202; no console errors; no requests to other hosts |
| Screenshots at 1440x900: Level 2 at rest, Level 3 mid-animation | Districts and units now read as different things. In the first screenshot a unit on the left edge was cut off; camera moved back and left. |

Not checked: frame rate on a real graphics card (the automated browser renders in software), and the burst effects were seen in one still frame only.

### Loop 3: seeing why, and fixing mistakes

After loop 2 the game looked right but still left three questions unanswered for a player: why did this unit get that answer, what did my last change do, and how do I take back a misclick. Changed:

- **Trace.** Click any banner (or its row in the list) to trace that unit. Its route is drawn on the map in dots, with a cross at the gatehouse if it will be stopped, and every gate in the side panel is labelled "no match, keep going", "MATCH: this gate decides", or "never reached". The labels come from `traceFlow` in `strategy/turns.js`, which is tested against the rule engine on four different gatehouses per level.
- **Change feedback.** After each change a short message says what it did to the units on the road ("443 → WEB-1: now GETS IN"), or that it changed nothing.
- **Undo.** "Undo last change" takes back a change made this turn and returns the action.
- **Quieter banners.** A unit that is being handled correctly shows a one-line banner; only units with a problem, or the one being traced, show the full banner. This also fixed most of the crowding.
- **Better advice for one case.** When an attack shares a port with wanted traffic, the advisor used to say "swap the gate for a narrower one", which is wrong: the fix is a blocking gate above it. It now names that gate, in the same words the side panel uses, and says where to put it.

| Check | Result |
|---|---|
| `node tests/run-node.mjs` | Pass: 167 tests (3 new, for the trace) |
| All three levels won with three stars through the real interface | Pass: scores 187, 193, 202; no console errors; no requests to other hosts |
| Level 1: add a gate, add another, undo | Pass: the second gate is gone and the action is back |
| Level 1 turn 8: click a red banner | Pass: route and cross drawn, gates labelled, note reads "no gate matches, so it is turned away" |
| Level 1 with the known-bad address approaching | Pass: advisor names the blocking gate and says to move it above gate 1 |

Found while checking: after an update the browser can keep an old copy of a script and fail to start ("does not provide an export named…"). The local Python server sends no cache headers. A hard refresh fixes it; anyone pulling a new version should do one.

### Still not verified after these three loops

- No person has played it. The look was judged from screenshots by the builder, not by a player or a designer.
- Frame rate on real hardware. The automated browser draws in software.
- Sound, touch, a screen reader, other browsers, a machine without WebGL.
- Phone-size screens remain unsuitable for this version.

## Blender-built models (2026-11-17)

The owner asked for better 3D assets and for Blender to be installed and used. Blender 5.3 was installed with Homebrew and is run without its window, so no add-on or MCP server was needed. `tools/blender/build_models.py` builds 22 original models (three units, nine districts, wall tower, wall segment, gatehouse, a hex tile, two trees, mountain, hills, barn, boulder) with bevels and smooth shading and writes them to `assets/models/` as `.glb` (2.4 MB in all). The game loads them through three.js's glTF loader, now also in `vendor/`. If a model fails to load, the board falls back to the earlier code-built shape for that piece.

| Check | Result |
|---|---|
| `blender --background --python tools/blender/build_models.py` | Pass: 22 models written, 40 to 6,962 triangles each |
| `node tests/run-node.mjs` | Pass: 167 tests |
| Game loads every model, 1440x900 | Pass: no console errors or warnings; screenshots at map distance and zoomed in on the gatehouse |
| All three levels won with three stars through the real interface | Pass: scores 187, 193, 202; no requests to other hosts |

Honest assessment from the screenshots: the wagon and ox, the wall towers and the districts are clearly better than the box-and-cone versions, mostly from rounded edges and smooth shading. They are still untextured and script-built, not artist-made. The gatehouse archway is hard to see from the default camera angle.

Not checked: the fallback path when a model is missing, frame rate on real hardware (the wagon is 5,500 triangles and several can be on the map), and loading time on a slow connection if the game is ever hosted.

## Music (2026-11-17)

The owner asked for music. It is synthesized in the browser, with no audio files: `strategy/score.js` holds a 16-bar piece in D minor as note data, and `strategy/music.js` plays it on voices built from oscillators and noise (plucked accompaniment with echo, a flute-like tune, strings, bass, shaker, and a drum-and-pulse layer). The arrangement changes each time round: tune, no tune with a higher accompaniment, tune an octave lower. It is quieter on menus and fades the drum layer in while any unit on the road is forecast to breach or be turned away. Music has its own on/off switch on the home menu and the pause menu, remembered in the browser. It starts on the first click or key press, as browsers require.

| Check | Result |
|---|---|
| `node tests/run-node.mjs` | Pass: 174 tests, 7 new for the score. One caught a real fault: an accompaniment note at 1175 Hz, above the tune. Fixed. |
| Score: every bar adds to four beats, every note is in key, every bar of the tune lands on a note of its chord | Pass |
| 16 bars rendered offline in the browser, calm | Peak 0.28, no clipping, no silent two-second stretch, no invalid samples |
| Same with the tension layer up | Peak 0.55, overall level up by a third, energy below 150 Hz roughly doubled, so the layer is audibly different in principle |
| Music switch on the pause menu | Pass: label flips and the choice is saved |
| Console errors with music running during play | None |

**Not verified: how it sounds.** The builder cannot hear. The checks show it is in key, in time, continuous and not distorted. Whether it is pleasant, too loud, too repetitive, or fits the game needs a person with speakers.

## Textures, a piece of music per level, and Arcade details (2026-11-17)

**Textures.** `tools/build_textures.py` draws ten seamless grey detail textures (stone blocks, brick, wood planks, roof tiles, plaster, cloth, rock, foliage, grass, soil) with no libraries and writes them to `assets/textures/` (212 KB). The Blender script now gives every model box-projected texture coordinates, so a texture appears at the same size on every part. The game picks a texture for each material from its name and multiplies it with the material's colour. Hex tiles get grass, soil or stone on top and rock on the sides.

**Music.** There are now three 16-bar pieces, one per level (D minor at 92, F major at 104, E minor at 98), and a rising phrase on a win and a falling one on a loss, in the key of the level's piece. The piece changes at the next bar line when the level changes.

**Loading.** One playthrough logged a dropped connection on a model file: the local Python server was being asked for 32 files at once. Models and textures now load a few at a time and retry once. A piece that still fails falls back to a code-built shape.

**ARCADE.md.** Location (Ohio) added. Organization and links are left empty at the owner's request.

| Check | Result |
|---|---|
| `python3 tools/build_textures.py` | Pass: 10 textures written; stone and roof-tile textures inspected by eye |
| `blender --background --python tools/blender/build_models.py` | Pass: 22 models, now with texture coordinates |
| `node tests/run-node.mjs` | Pass: 193 tests. The score tests now run on all three pieces and the two phrases. One caught a real fault: the win phrase did not rise in F major (the fifth was written below the root). Fixed. |
| Each piece rendered offline in the browser, 16 bars | No clipping (peaks 0.34 to 0.38), no silent two-second stretch, no invalid samples; the three are within 2% of each other in loudness |
| All three levels won with three stars through the real interface, with music playing | Pass |
| Five fresh page loads after the loading fix | No failed requests |
| Level 3 lost on purpose, then retried | Pass: the lose phrase path runs and the music mood resets for the retry; no console errors |
| Screenshots at 1440x900, map distance and close on the gatehouse | Stone blocks, roof tiles and ground texture are visible and at a consistent size |

Not verified: how any of the music sounds; how the textures look on a real graphics card at other zoom levels; the fallback when a model fails twice.
