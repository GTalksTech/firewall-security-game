# Quickstart: running and validating Firewall Security Faceoff

These commands apply once the implementation exists. None of the files they refer to exists
yet; this is the validation guide the implementation must satisfy.

## Prerequisites

- A current desktop browser.
- Python 3 (to serve static files). On Windows use `py` in place of `python3`.
- Optional: Node 20 or later, for the command-line test run.

No install step. There are no packages.

## Run the game

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000>. Opening `index.html` with `file://` is not supported, because
modules and the level data are loaded over HTTP. If port 8000 is busy, use 8001 in both places.

## Run the automated checks

Command line:

```sh
node tests/run-node.mjs
```

Expected: a count of tests run, zero failures, exit code 0. A run that finds zero tests fails.

Browser, with the server above running: open <http://127.0.0.1:8000/tests/>. Expected: totals
and "all passed", or the IDs of failed cases.

## Validation scenarios

Each maps to the cases table in [spec.md](./spec.md); expected values are there and in
`tests/cases.js`.

1. **First evidence.** Level 1 Standard, add R3 then R1, run the test. Expect an outage naming
   rule 1 and no penetration test. Remove R3, run again. Expect all three attacks denied, the
   rival breached at step 1, and strength 40.
2. **Outlasted but breached.** Level 1 Standard, [R1, R7]. Expect "outlasted the rival but were
   still breached", level not completed, strength unchanged.
3. **Harden Further.** Level 1 Standard, [R4]. Expect completion with score 35 and one
   exposure. Choose Harden Further, submit [R1]. Expect the score to become 40, not 75.
4. **Encrypted inspection.** Level 2 Standard, R2 with threat inspection on and TLS decryption
   off, plus R3 with DNS filtering on. Expect the malware download to get through at step 2.
5. **Shadowed deny.** Level 3 Standard, remove only R1. Expect an outage naming the deny rule
   now in position 1.
6. **Honest counters.** Submit an empty rule base (guidance, attempts unchanged). Submit a
   failing rule base twice (attempts rise by one, not two). View all three hints (assistance
   recorded, level not completed).
7. **Tiers.** Complete Level 1 at Standard, switch to Expert. Expect Level 2 available at both
   tiers and Level 1 Expert not shown as completed.
8. **Restart.** Choose Restart and cancel (nothing changes), then Restart and confirm (back to
   tier selection, progress cleared).
9. **Determinism.** Covered by the automated checks: ten identical submissions, ten identical
   results.

## Manual checks to record

Record each in `docs/verification.md` as pass, fail, or not run, with the date and browser.

- Keyboard only: complete Level 1 Standard without a pointer, including reordering a rule.
- Narrow window: at about 360 px wide the rule table scrolls in its own region and Run
  Penetration Test stays reachable.
- Reduced motion: with the system setting on, results appear with no animation and nothing
  missing.
- Offline: load the game, disable the network, play to the summary.
- Content error: temporarily give a rival a rule base that survives every step; the challenge
  shows a content error and cannot be graded. Revert the change.
- Add a trial challenge by editing `data/levels.json` only, and play it.
- Read each briefing and explanation against its cited source.

## References

- Data shape: [contracts/level-data.md](./contracts/level-data.md)
- Engine functions and results: [contracts/engine-api.md](./contracts/engine-api.md)
- Views and controls: [contracts/ui-contract.md](./contracts/ui-contract.md)
- Entities and state: [data-model.md](./data-model.md)
