# Firewall Security Faceoff

**Drag firewall rules onto your wall while the traffic is already flying at it. Let the right packets in, keep the rest out, and outlast the rival firewall.**

Firewall Security Faceoff is a real-time tower-defense game for network engineers and students. Your firewall is a wall and every rule is a gate on it. Wanted traffic, attacks, and traffic nobody asked for fly at the wall without stopping. Each packet is checked from the top gate down: the first gate that matches lets it through or bounces it, and anything that matches no gate drops into the implicit deny. You add, remove and reorder gates while the traffic is flowing. New business orders arrive mid-run, each new attack wave punishes a lazy answer to the last order, and a rival firewall faces the same traffic in the corner. The firewall is vendor-neutral.

![Level 2 of the arcade edition: a malware download has just got through a gate whose DECRYPT switch is off](assets/card.png)

| Level | What you defend | What it teaches |
| --- | --- | --- |
| 1. Open the storefront | A web, mail and jump server facing the Internet | First match wins, implicit deny, least privilege, why a blocklist gate must sit above the gate it guards |
| 2. Let staff browse safely | An office browsing the Internet | Application gates instead of port gates, SCAN, why SCAN needs DECRYPT for locked traffic, DNS FILTER |
| 3. Clean up the data center | A database and an application server | Gates that name who is allowed, stopping a break-in from spreading, scanning traffic you trust |

**How to play.** Drag a gate from the tray onto the wall, or click it. Drag it up or down to reorder, and off the wall to remove it. Gates marked **TRY** would let in wanted traffic that is being turned away. On Levels 2 and 3 a gate has switches under it; click one to turn it on. When something gets through, the gate that let it in is badged and, if a switch would have stopped it, that switch flashes. P pauses, and you can still change the wall while paused. Keyboard: Tab to a gate, Enter adds or removes it, the arrow keys move it, and S, D and F flip its switches.

You have five hearts, a patience meter for the people you are meant to be serving, a combo multiplier, and one to three stars per level. Three stars needs a run with nothing wrongly let in or turned away, and a final wall the rule engine agrees is correct.

**Two editions.** `index.html` is the arcade edition described above. `classic.html` is the earlier text edition: no motion, no clock, both difficulty tiers, hints, and full written explanations. Both use the same rule engine and level data.

A project from **NAF AC6 — Loop Engineering, Spec-Driven Development & the Future of VibeOps**.

| Project | Details |
| --- | --- |
| Status | All three levels playable in both editions. 139 automated checks pass; browser checks are recorded in [docs/verification.md](docs/verification.md), including what was not verified |
| Networking topic | Next-generation firewall policy: rule order, least privilege, application and user identity, inspection, TLS decryption, DNS filtering, segmentation |
| Typical session | About 2 minutes per level per attempt (not yet timed with a first-time player) |
| Live demo | Not published |
| Built by | GTalksTech |

## Play locally

There is nothing to install. From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

On Windows with the Python launcher:

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000** in a current desktop browser. Keep the terminal running; **Ctrl+C** stops the server. If port 8000 is busy, use 8001 in both the command and the URL. Opening `index.html` directly with `file://` is not supported, because the game loads its modules and level data over HTTP.

## How it works

- **Every verdict comes from one rule engine** (`engine/rules.js`). The arcade edition asks it about each packet at the moment the packet reaches the wall, against the wall as it stands right then. The animation decides nothing.
- **The traffic is a fixed timetable**, built from the level data: a short warm-up of wanted traffic only, then one wave per attack step. The same play always meets the same traffic.
- **Orders:** each level starts with one business order and adds more mid-run. Traffic for a new order gets a few seconds' grace before turning it away costs patience.
- **Score:** points for each wanted packet served and each attack stopped, multiplied by a combo that resets when something goes wrong. Stars are saved in the browser.
- **The arcade levels use each level's harder challenge.** The text edition offers both tiers.
- **No text entry anywhere.** Sound effects are synthesized in the browser and can be switched off.

## What the game simplifies

Each briefing states the simplifications that matter for that level. The main ones:

- The game models a firewall that checks rules in order and stops at the first match. NIST SP 800-41 notes that many firewalls work this way and others do not.
- A control that the sources say "can mitigate" an attack always stops it here.
- The firewall identifies every application and user correctly and immediately.
- Addresses match exactly; there is no subnet matching.
- Not modeled: address translation, routing, VPN, high availability, IPv6, logging, URL filtering, DNS over HTTPS, and decryption exemptions.
- Attacks are named techniques evaluated against the model. The game sends no network traffic and contains no exploit code.

Sources are listed in each briefing and in `data/levels.json`: NIST SP 800-41 Rev. 1, NIST SP 800-207, and MITRE ATT&CK technique and mitigation pages.

## Run the checks

Command line (needs Node 20 or later; used for tests only, not to play):

```sh
node tests/run-node.mjs
```

In the browser, with the server above running, open **http://127.0.0.1:8000/tests/**.

Both run the same 139 checks: the 33 hand-worked rule-base cases from the specification, content validation, session behavior, and the arcade timetable, labels, hints and star rules. Expected results in `tests/cases.js` are copied from the specification and are never computed by the engine under test.

## Project layout

```text
index.html                       Arcade edition shell
game/arcade.js, game/game.css    Arcade edition: drawing, input, the real-time loop
game/logic.js                    Arcade timetable, labels, hints, stars (no screen; tested)
classic.html, style.css, main.js Text edition shell, styles, start
ui/                              Text edition views, controls, and its playfield
engine/rules.js                  Pure rule evaluation, outcome, and score
engine/content.js                Validates the level data before play
engine/state.js                  Text edition session state
engine/feedback.js               Turns results into explanations
data/levels.json                 All level content, rivals, hints, sources, arcade settings
tests/                           Test harness, cases, and both runners
docs/verification.md             What was checked, and what was not
specs/                           Specifications, plan, and tasks
```

To add or change a level, edit `data/levels.json` and add its hand-worked cases to `tests/cases.js`. No engine or interface code changes. Adding `?speed=4` to the address runs the arcade clock faster; it is a testing aid.

## Known limits

- Tested in one browser engine (Chromium), driven by an automated browser. No person has play-tested the finished three levels, so difficulty and pacing are untuned.
- Not tested with a screen reader. The arcade edition is real time; a player who cannot use it has the text edition, which has no clock.
- Sound effects were not listened to during testing; only the toggle was checked.
- Touch dragging was not tested. Phone width (390) fits on screen but is tight.
- The arcade edition has no hint ladder; its help is the TRY marks, gate badges, and one-line prompts.
- The turn-by-turn battle mode from the original idea is not built.
- See [docs/verification.md](docs/verification.md) for the full list of checks that were not run.

## License

See [LICENSE](LICENSE).
