# Specification: Strategy Edition

**Status**: Built. Written alongside the build on 2026-11-17, not before it.
**Supersedes as the main game**: `specs/002-arcade-edition/spec.md` (the arcade version stays available).

## Why this exists

The project owner played the real-time arcade version and reported three things: it did not say what to do, it had no rules, explanation or home menu, and they wanted a 3D game with the look and feel of the turn-based hex strategy games they enjoy. They chose a guided first level, a How to Play screen, and a briefing before each level, and left the rest of the redesign open.

This is an original game in that genre. It does not reproduce any existing game's art, interface, names or content.

## What stays the same

- Every verdict comes from `engine/rules.js`. Level content, rivals, sources and reference solutions are those of `specs/001-firewall-faceoff/spec.md`; each level uses its Expert challenge.
- No free-form text entry, no vendor names, no network requests at runtime.
- The text version stays available.

## Requirements

**Explaining itself**

- **SR-001** The game opens on a home menu with Play, Choose a level, How to play, and a sound setting, and links to the other two versions.
- **SR-002** How to play states the goal, the three kinds of traffic, how gates are checked, what a turn is, and how a level is won, lost and starred. It is reachable from the home menu and during play.
- **SR-003** Each level opens with a briefing: the situation, the job, what is new, and the first request.
- **SR-004** The first level, until it has been completed once, runs a guide that points at each thing in turn and waits for the player to do it. The level cannot be lost while the guide is on. The guide can be skipped.
- **SR-005** During play an advisor line always states the most urgent problem and how to fix it, or says that everything is handled.

**The game**

- **SR-010** Play is in turns with no clock. In a turn the player may make three changes to the gatehouse (add, remove, move, or flip a switch), then ends the turn.
- **SR-011** Ending a turn moves every unit one step. A unit reaches the gatehouse three turns after it appears and is judged against the gates as they stand then.
- **SR-012** Every unit shows what it is and what the current gates will do with it. That forecast is the engine's verdict and updates as soon as a gate changes.
- **SR-013** Traffic follows a fixed timetable from the level data. Each attack step appears twice, three turns apart. A request's traffic never appears before the request.
- **SR-014** An attack that gets in costs a heart; wanted traffic turned away costs trust; five of either lost ends the level. Reaching the last turn wins. Stars follow the rule in `game/logic.js` `starsFor`.
- **SR-015** The rival faces the same traffic with its fixed gates and falls on its second breach.
- **SR-016** Spare gates that would admit wanted traffic that is being turned away are marked. After a breach, the gate at fault is badged and any switch that would have stopped it is flagged.

**Presentation and access**

- **SR-020** The map is a 3D hex board the player can turn and zoom. It draws state and decides nothing.
- **SR-021** Everything the map shows is also available as text: a list of units with forecasts, a log of each turn, and live-region announcements. Every action is a button reachable by keyboard.
- **SR-022** With reduced motion requested, moves happen at once.
- **SR-023** If 3D cannot start, the game says so and offers the other two versions.

## Checks

`tests/strategy.test.js` covers SR-011, SR-012 (forecast equals outcome), SR-013, SR-014 and SR-015, and that each level's reference gates, added as requests arrive, win with three stars. The rest are checked in a browser; see `docs/verification.md`.

## Not done

- `/speckit-plan`, `/speckit-tasks` and `/speckit-analyze` were not run for this specification.
- No person has play-tested it.
- No sculpted 3D art; models are simple shapes built in code.
