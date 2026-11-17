---
arcade_version: 1

game:
  title: "Firewall Security Faceoff"
  slug: firewall-security-faceoff
  tagline: "Drag firewall rules onto your wall while the packets are already flying at it."
  summary: "A real-time tower-defense game where each firewall rule is a gate on your wall. Wanted traffic and attacks never stop coming, new business orders arrive mid-run, and you add, reorder and switch on scanners while a rival firewall faces the same traffic. Three levels teach first-match rule order, implicit deny, least privilege, application-aware rules, inspection and TLS decryption, DNS filtering, and identity-based segmentation."
  topics: [Firewall policy, NGFW, Least privilege, Rule order, TLS inspection, Segmentation]
  category: security
  skill_level: intermediate
  play_minutes: 10
  levels: 3
  card_image: assets/card.png
  card_image_alt: "A pixel-style playfield: packets fly from the left at a brick wall holding three green rule gates, servers stand on the right, and a flashing DECRYPT OFF switch marks the gate that just let malware through."
  repo: https://github.com/GTalksTech/firewall-security-game
  repo_path: ""
  license: Apache-2.0

creator:
  name: ""                   # (HUMAN) not yet provided
  github: "GTalksTech"
  location: ""
  organization: ""
  links: []
  first_spec_project: true   # (HUMAN) template default; not yet confirmed
  workshop: "NAF AC6"
  consent_to_publish: false  # (HUMAN) not yet given; nothing is listed until this is true

build:
  started: "2026-11-17"
  finished: "2026-11-17"
  wall_time: unknown
  spec_driven:
    framework: GitHub Spec Kit
    framework_version: "1.4.2.dev0"
    artifacts: [constitution, spec, clarify, plan, tasks, analyze, checklists]
    task_count: 68
    loops_or_phases: 6   # two Ralph runs of three iterations each
  model: "claude-fable-5-2"
  helper_models: []
  harness: Claude Code
  harness_version: "2.1.326"
  mcp_servers: [Playwright MCP]   # the only MCP server used for the build; others connected to the session were not used and are not listed
  rag_and_sources:
    - "NIST SP 800-41 Rev. 1, Guidelines on Firewalls and Firewall Policy"
    - "NIST SP 800-207, Zero Trust Architecture"
    - "MITRE ATT&CK Enterprise technique and mitigation pages"
    - "NAF AC6 workshop StarterKit (CONSTITUTION.md, SPEC.md, PLAN.md) and LAB README"
  skills_and_plugins: [speckit-constitution, speckit-specify, speckit-clarify, speckit-plan, speckit-tasks, speckit-analyze, speckit-implement, ralph-loop plugin]
  other_tools: [Node.js 26 for the test runner, Python http.server, Chromium via Playwright, curl, GitHub CLI]
  human_prompts: 20
  usage:
    input_tokens: unknown
    output_tokens: unknown
    cost_note: unknown
  ai_generated_assets: ["pixel art and SVG: drawn in code by the build agent", "audio: synthesized at runtime with Web Audio, no files", "images from an image generator: none"]

runtime:
  kind: static-web
  stack: [HTML, CSS, JavaScript ES modules, Canvas 2D, Web Audio]
  start: "python3 -m http.server 8000 --bind 127.0.0.1"
  url_after_start: "http://127.0.0.1:8000"
  hosted_url: ""
  static_root: "."
  requires_install: false
  requires_network: false
  requires_api_key: false
  uses_ai_at_runtime: false
  browsers: [Chromium 157 via Playwright]
  accessibility: "Every control is a button reachable by keyboard; Level 1 of the arcade edition was won by keyboard alone in an automated browser. States are shown in words and shapes as well as color, and events are announced through a live region. The arcade edition is real time and can be paused while still editing; a text edition with no motion or clock is included. Not tested with a screen reader or touch. Sound was not listened to."
  save_state: browser local storage (stars and best score per level)

verification:
  tests: "node tests/run-node.mjs"
  tests_passing: 139
  facts_sourced_from:
    - "NIST SP 800-41 Rev. 1, sections 2.1.2, 2.1.3, 2.3, 4, 4.1.1, 4.2, 4.3, 5.2.2"
    - "NIST SP 800-207, section 2.1"
    - "MITRE ATT&CK techniques T1021, T1021.001, T1021.002, T1021.004, T1071.001, T1071.004, T1105, T1110, T1133, T1190, T1199, T1210, T1570, T1572, T1573 and mitigations M1020, M1030, M1031, M1035, M1037"
  known_limits:
    - "Models a firewall that checks rules in order and stops at the first match; some real firewalls work differently"
    - "A control the sources say can mitigate an attack always stops it in the game"
    - "The firewall identifies every application and user correctly and immediately"
    - "Addresses match exactly; no subnet matching"
    - "NAT, routing, VPN, high availability, IPv6, logging, URL filtering, DNS over HTTPS and decryption exemptions are not modeled"
    - "The arcade edition departs from the first specification's submit-then-test flow and scoring; a short second specification records what was built"
    - "No human first-time player, screen reader, or second browser engine has tested it"
---

## In one paragraph

Firewall Security Faceoff is a real-time tower-defense game about firewall policy. Each rule is a gate on your wall. Packets never stop coming, and each is checked gate by gate from the top: the first gate that matches decides, and anything that matches nothing falls to the implicit deny. You drag gates on, off and into order while traffic flows, switch on scanners, and answer new business orders mid-run while a rival firewall faces the same traffic. It is for network engineers and students who know addresses and ports and want to feel why rule order, least privilege, application-aware rules, and inspection matter. A text edition with no clock is included.

## How it was built

The constitution came first, adapted from the workshop starter. The specification followed, with the grading model and hand-worked cases for every level written before any code. Clarification settled the sources and banned free-form text entry. The plan listed thirteen contradictions between the starter plan, the spec, and the constitution and resolved each one. Analysis found that the claim "this control stops that attack" had no source; reading each MITRE ATT&CK technique page fixed three citations and moved one claim to NIST. The engine was built test-first and all hand-worked cases passed on the first run.

Then the human played it and said, three times and with rising force, that it was text on a screen and not a game. The interface was rebuilt three times: an animated playfield, then a full-screen arcade, then a real-time game where the wall is edited while traffic flows. The rule engine and its tests did not change once through all of that; only the layer that asks it questions did. The constitution was amended twice to allow what the human actually wanted.

## What we'd tell the next builder

- Write the expected results by hand in the spec before the engine exists. When the tests pass first time you know the model and the code agree.
- Keep the part that decides right and wrong separate from the part that draws. We threw away the interface three times and never touched the engine.
- A specification can be complete, consistent and correct and still describe something nobody wants to play. Put a playable slice in front of a person early, and treat "this is not fun" as a requirement the spec missed.
- Test the screen-free parts of the game layer too. One of those tests caught an attack and a customer that looked identical on screen.
