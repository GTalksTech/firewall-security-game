---
arcade_version: 1

game:
  title: "Firewall Security Faceoff"
  slug: firewall-security-faceoff
  tagline: "Turn-based hex strategy where your firewall rules are the gates of a city."
  summary: "A turn-based 3D strategy game. Your network is a city on a hex map and your firewall is its gatehouse. Wanted traffic and attacks march toward it, each with a banner showing what your rules will do, and each turn you add, reorder and switch gates before ending the turn. Three levels teach first-match rule order, implicit deny, least privilege, application-aware rules, inspection and TLS decryption, DNS filtering, and identity-based segmentation. It has a home menu, a How to Play screen, level briefings, and a guided first level."
  topics: [Firewall policy, NGFW, Least privilege, Rule order, TLS inspection, Segmentation]
  category: security
  skill_level: intermediate
  play_minutes: 15
  levels: 3
  card_image: assets/card.png
  card_image_alt: "A 3D hex map with snow-capped mountains, fields and a stone-block wall with a gatehouse. An ox-drawn wagon approaches along a road under a banner reading GETS IN; a database district and an application-server district stand beyond the wall; a side panel lists firewall rules as gates to add."
  repo: https://github.com/GTalksTech/firewall-security-game
  repo_path: ""
  license: Apache-2.0

creator:
  name: "Garrett Masters"
  github: "GTalksTech"
  location: "Ohio"
  organization: "G Talks Tech"
  links: []
  first_spec_project: true
  workshop: "NAF AC6"
  consent_to_publish: true

build:
  started: "2026-11-17"
  finished: "2026-11-17"
  wall_time: unknown
  spec_driven:
    framework: GitHub Spec Kit
    framework_version: "1.4.2.dev0"
    artifacts: [constitution, spec, clarify, plan, tasks, analyze, checklists]
    task_count: 68
    loops_or_phases: 9   # three Ralph runs of three iterations each
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
  other_tools: [three.js r160 (MIT) for the 3D map, Blender 5.3 run headless to build the 3D models, Node.js 26 for the test runner, Python http.server, Chromium via Playwright, curl, GitHub CLI]
  human_prompts: 29
  usage:
    input_tokens: unknown
    output_tokens: unknown
    cost_note: unknown
  ai_generated_assets: ["3D models: 22 .glb files built by a Blender script the build agent wrote (tools/blender/build_models.py); no asset packs or downloaded models", "textures: 10 PNG surface textures drawn by a script the build agent wrote (tools/build_textures.py); no downloaded images", "pixel art and SVG: drawn in code by the build agent", "music and sound: three 16-bar pieces (one per level) plus win and lose phrases, written by the build agent as note data and synthesized at runtime with Web Audio; no audio files", "images from an image generator: none"]

runtime:
  kind: static-web
  stack: [HTML, CSS, JavaScript ES modules, WebGL via three.js r160 (vendored), Canvas 2D, Web Audio]
  start: "python3 -m http.server 8000 --bind 127.0.0.1"
  url_after_start: "http://127.0.0.1:8000"
  hosted_url: ""
  static_root: "."
  requires_install: false
  requires_network: false
  requires_api_key: false
  uses_ai_at_runtime: false
  browsers: [Chromium 157 via Playwright]
  accessibility: "Every control is a button reachable by keyboard; the start of Level 1 was played by keyboard alone in an automated browser. The map is a picture of state that is also given as text: a list of everything on the road with its forecast, a log, and live-region announcements. States use words and shapes as well as color. With reduced motion requested, moves are instant. A text-only version is included. Not tested with a screen reader or touch. Sound was not listened to."
  save_state: browser local storage (stars and best score per level)

verification:
  tests: "node tests/run-node.mjs"
  tests_passing: 193
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
    - "The strategy game was designed and built in one sitting after play feedback; its specification was written alongside the build, not before it"
    - "3D models and textures are script-built, not artist-made; a phone screen is too small for it"
    - "No human first-time player, screen reader, or second browser engine has tested it"
---

## In one paragraph

Firewall Security Faceoff is a turn-based strategy game about firewall policy. Your network is a city on a 3D hex map and your firewall is its gatehouse. Wagons (wanted traffic), raiders (attacks) and drifters (traffic nobody asked for) march toward it, each under a banner that says what your rules will do with it. Each turn you make up to three changes to your gates, then end the turn. Gates are checked top to bottom, the first match decides, and anything no gate allows is turned away. It is for network engineers and students who know addresses and ports. A real-time arcade version and a text-only version of the same lessons are included.

## How it was built

The constitution came first, adapted from the workshop starter. The specification followed, with the grading model and hand-worked cases for every level written before any code. Clarification settled the sources and banned free-form text entry. The plan resolved thirteen contradictions between the starter plan, the spec, and the constitution. Analysis found that the claim "this control stops that attack" had no source; reading each MITRE ATT&CK technique page fixed three citations. The rule engine was built test-first and all hand-worked cases passed on the first run.

Then the human played it. Four times they said, in different words, that it was not the game they wanted: text on a screen, then not interactive enough, then fun but unexplained and not the kind of game they love. The interface was rebuilt four times: an animated playfield, a full-screen arcade, a real-time arcade, and finally a turn-based 3D hex strategy game with a menu, rules screen, briefings and a guided first level. The rule engine and its tests did not change once. Each rebuild only changed the layer that asks the engine questions, and each new layer got its own screen-free logic module and tests.

## What we'd tell the next builder

- Write the expected results by hand in the spec before the engine exists. When the tests pass first time you know the model and the code agree.
- Keep the part that decides right and wrong separate from the part that draws. We threw away the interface four times and never touched the engine.
- A specification can be complete, consistent and correct and still describe something nobody wants to play. Put a playable slice in front of a person early, and ask what games they love before you pick a genre.
- "It doesn't explain itself" is a defect, not polish. A menu, a rules page and a guided first level should be in the first spec.
