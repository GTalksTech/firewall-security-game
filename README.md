# Firewall Security Faceoff

**Build a firewall rule base, then watch a penetration test hit your firewall and a rival's, one attack at a time.**

Firewall Security Faceoff is a tower-defense game for network engineers and students. Your rule base is a wall of gates. You build it to meet a business request, then attack packets fly at your wall and at a rival's, and you watch each one get checked gate by gate from the top: the first gate that matches opens or slams shut, and a packet that matches nothing falls to the implicit deny. Every result also names the rule or missing control behind it in plain text. The firewall is vendor-neutral.

![The playfield: an attack stopped by threat inspection on your firewall while the rival's is breached](assets/card.png)

A project from **NAF AC6 — Loop Engineering, Spec-Driven Development & the Future of VibeOps**.

| Project | Details |
| --- | --- |
| Status | Playable, with an animated tower-defense playfield. 94 automated checks pass; manual checks are recorded in [docs/verification.md](docs/verification.md), including what was not verified |
| Networking topic | Next-generation firewall policy: rule order, least privilege, application and user identity, inspection, TLS decryption, DNS filtering, segmentation |
| Typical session | 10 to 15 minutes for the three Standard levels (not yet timed with a first-time player) |
| Live demo | Not published |
| Built by | GTalksTech |

## The challenge

Level 1 asks: "Customers on the Internet must reach the web server WEB-1 (203.0.113.10) on HTTPS, TCP 443. Nothing else may enter the DMZ." You pick rules from a list and put them in order. If you place "Deny Internet to the DMZ, anything" above "Allow Internet to WEB-1 on TCP 443", the game reports an outage: rule 1 is the first match, so rule 2 is never reached. Remove the deny, run the test again, and all three attacks are stopped by the implicit deny while the rival falls at step 1 through its open SSH rule.

A level is completed only when required traffic still works **and** every attack step is stopped. Outlasting the rival while still being breached does not count, and blocking everything is an outage, not a defense.

## What you'll learn

| By the end, you can… | You'll practice by… |
| --- | --- |
| Order rules so first-match evaluation and implicit deny give least-privilege access | Building a rule base for one public service |
| Choose application-aware rules and the controls that make inspection effective | Allowing staff web browsing and stopping a tunnel, a malware download, and a malicious DNS lookup |
| Find shadowed and over-broad rules in an inherited rule base and predict what removing them does | Repairing a data-center rule base against a four-step intrusion |

Each level exists at two tiers. **Standard** builds a rule base from rule cards. **Expert** hands you a larger inherited rule base to repair. You can switch tier at any time; progress is kept separately for each.

**Before playing:** you should know what IP addresses and TCP/UDP ports are. Each briefing teaches the rest.

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

- **The playfield:** a pixel-style animation of each attack reaching both walls. It only illustrates results that are already computed and written as text below it; Show Full Results skips it, and with reduced motion requested it shows the final frame at once. Sound effects are synthesized in the browser and can be switched off with the Sound button.
- **Scoring:** 10 points for each attack step stopped, 5 for each piece of traffic the request did not ask for that your rule base denies. Points are banked only when the level is completed. Your firewall strength is the total of your banked scores, shown beside the rival's.
- **Harden Further:** after completing a level with exposure left, you can improve it. Only your best result counts; scores are never added together.
- **No penalties:** there is no timer, no lives, and no cost for retries or hints. Hints go method, one worked step, then a worked solution, and their use is shown separately from completion.
- **Every input is a button, checkbox, or radio.** There is no text entry and no drag and drop; rules are reordered with Move Up and Move Down.
- **Progress lasts for the page session.** Reloading starts again.

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

Both run the same 94 checks: the 33 hand-worked rule-base cases from the specification, content validation, and session behavior. Expected results in `tests/cases.js` are copied from the specification and are never computed by the engine under test.

## Project layout

```text
index.html, style.css, main.js   Page shell, styles, load and start
engine/rules.js                  Pure rule evaluation, outcome, and score
engine/content.js                Validates the level data before play
engine/state.js                  Session state: attempts, hints, banking, tiers
engine/feedback.js               Turns results into explanations
ui/render.js, ui/controls.js     Views, events, focus, announcements
ui/playfield.js                  The tower-defense canvas animation and sound
data/levels.json                 All level content, rivals, hints, and sources
tests/                           Test harness, cases, and both runners
docs/verification.md             What was checked, and what was not
specs/001-firewall-faceoff/      Specification, plan, and tasks
```

To add or change a level, edit `data/levels.json` and add its hand-worked cases to `tests/cases.js`. No engine or interface code changes.

## Known limits

- Tested in one browser engine (Chromium). Not tested with a screen reader.
- Sound effects were not listened to during testing; only the toggle was checked.
- The player does not act during the penetration test. It is a tower defense in which all the play is in building the wall.
- The live turn-by-turn battle mode from the original idea is deferred and not built.
- See [docs/verification.md](docs/verification.md) for the full list of checks that were not run.

## License

See [LICENSE](LICENSE).
