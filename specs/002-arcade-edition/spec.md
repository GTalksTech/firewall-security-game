# Specification: Arcade Edition

**Status**: Built. Written after the fact to record what the arcade edition is, because it departs from `specs/001-firewall-faceoff/spec.md`.
**Date**: 2026-11-17

## Why this exists

The first specification described a turn-based game: build a rule base, submit it, read the result. It was built to that specification and passed its checks. The project owner played it three times and each time said it was not a video game. They chose live waves, drag and drop, and a pixel tower-defense look, approved a real-time Level 1, and asked for the rest. This document states what that game must do. The first specification still governs the rule engine, the level content, and the text edition.

## What stays the same

- Every verdict comes from `engine/rules.js`. The arcade layer never decides whether a packet is allowed.
- Level content, rivals, sources and reference solutions are those of the first specification. Each arcade level uses the level's Expert challenge.
- No free-form text entry. No vendor names. No network requests or dependencies.
- The text edition stays available from the arcade edition.

## Requirements

- **AR-001** The player edits the wall while traffic is moving: add a gate, remove it, reorder it, and turn each of its offered switches on or off, by pointer and by keyboard.
- **AR-002** A packet is judged against the wall as it stands when the packet reaches it.
- **AR-003** Traffic follows a fixed timetable built from the level data: a warm-up of wanted traffic only, then one wave per attack step, each attack continuing once introduced. The same play meets the same traffic.
- **AR-004** A level starts from an empty wall with one order. Further orders arrive on set waves. Traffic for an order never arrives before the order, and turning it away costs nothing for a grace period after the order appears.
- **AR-005** An attack that is allowed costs one heart; at zero the run ends as a breach. Wanted traffic turned away after the warm-up and grace period costs patience; at zero the run ends as an outage. A failed run restarts the same level at once.
- **AR-006** The rival faces the same timetable with its fixed wall and goes down after three hits.
- **AR-007** A finished run earns three stars when nothing was wrongly let through or turned away and the engine judges the final wall complete with no exposure; two when the final wall is complete and at least three hearts remain; otherwise one. The best star count per level is kept in the browser.
- **AR-008** When wanted traffic matches no gate, the spare gates that would allow it are marked. When an attack gets through, the gate is badged, and if switches on that gate would have stopped it, exactly those switches are flagged.
- **AR-009** Every packet shows its port, and where the level uses them its application, sender, payload and whether it is encrypted. An attack and wanted traffic never read the same unless the engine treats them the same.
- **AR-010** States are shown in words or shapes as well as color. Events are announced through a live region and written to a text log. The player can pause at any time and keep editing.

## Checks

`tests/arcade.test.js` covers AR-003, AR-004, AR-006, AR-007 (star rule), AR-008 and AR-009, and that each level's reference wall wins with three stars against the full timetable. AR-001, AR-002, AR-005 and AR-010 are checked in a browser; results are in `docs/verification.md`.

## Not done

- `/speckit-plan`, `/speckit-tasks` and `/speckit-analyze` were not run for this specification; it was written after the build.
- No hint ladder, no Standard tier, and no reduced-motion alternative inside the arcade edition; the text edition serves those needs.
- No person has play-tested Levels 2 and 3.
