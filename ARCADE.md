---
arcade_version: 1

game:
  title: "Firewall Security Faceoff"
  slug: firewall-security-faceoff
  tagline: "Build a wall of firewall rules, then watch attack packets test it gate by gate."
  summary: "A tower-defense game where each firewall rule is a gate on your wall. You build a rule base for a business request, then the same attacks hit your firewall and a rival's while you watch each packet checked from the top rule down. You learn first-match rule order, implicit deny, least privilege, application-aware rules, inspection and TLS decryption, and segmentation."
  topics: [Firewall policy, NGFW, Least privilege, Rule order, TLS inspection, Segmentation]
  category: security
  skill_level: intermediate
  play_minutes: 15
  levels: 3
  card_image: assets/card.png
  card_image_alt: "A pixel-style playfield with two brick walls side by side: on the left an attack is stopped by threat inspection, on the right the rival's server is on fire after a breach through rule 1."
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
    artifacts: [constitution, spec, clarify, plan, tasks, checklists]
    task_count: 68
    loops_or_phases: 3
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
  human_prompts: 16
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
  accessibility: "Keyboard-only play of all six challenges was run in an automated browser. Reduced motion shows the final frame with no animation. Results are written as text as well as animated, and announced through a live region. Not tested with a screen reader. Sound was not listened to."
  save_state: none

verification:
  tests: "node tests/run-node.mjs"
  tests_passing: 94
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
    - "The player does not act during the penetration test; all play is in building the rule base"
    - "No human first-time player, screen reader, or second browser engine has tested it"
---

## In one paragraph

Firewall Security Faceoff is a tower-defense game about firewall policy. Each rule is a gate on your wall. You read a business request, build and order your rules, then watch attack packets fly at your wall and a rival's and get checked gate by gate from the top. The first gate that matches decides, and anything that matches nothing falls to the implicit deny. It is for network engineers and students who know addresses and ports and want to see why rule order, least privilege, application-aware rules, and inspection matter. An Expert tier hands experienced engineers a larger inherited rule base to repair.

## How it was built

The constitution came first, adapted from the workshop starter, with the idea's competitive framing reconciled against its "no lives, no timer" rule. The specification followed, with the grading model and hand-worked cases for every level written before any code. Clarification settled the sources, banned free-form text entry, and added concrete Expert content. The plan listed thirteen contradictions between the starter plan, the spec, and the constitution and resolved each one. Analysis found that the claim "this control stops that attack" had no source; reading each MITRE ATT&CK technique page fixed three citations and moved one claim to NIST. Implementation was test-first for the engine: all hand-worked cases passed on the first run. Validation then rejected a valid level, which exposed a flaw in the data model's own rule, and the rule was narrowed.

The human changed direction twice. They asked for an Expert tier early. After three polish loops they said it still looked like text on a screen, not a game, so the penetration test was rebuilt as an animated tower-defense playfield. That last change was presentation only and touched no grading.

## What we'd tell the next builder

- Write the expected results by hand in the spec before the engine exists. When the tests pass first time you know the model and the code agree, and when they fail you know which one to distrust.
- Check every "this defense stops that attack" claim against the source page for that specific attack. Three of ours were cited to the wrong place.
- Decide what the player watches before deciding what the screen says. We built correct text first and only later found that seeing a packet walk down the rule list was the game.
