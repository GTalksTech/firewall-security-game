# Feature Specification: Firewall Security Faceoff · First Playable

**Feature Branch**: `001-firewall-faceoff`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Firewall security game. How to configure your ACLs to be as secure as possible, or just how to configure a firewall in general to be configured as secure as possible. This game should be vendor agnostic, and not be vendor reliant, but focus on NGFW technologies that are current up to 2026. The better you do and more points you get and more technologies you learn and configure, the more points and stronger your firewall gets. You're trying to level up your firewall more and make it more secure than your enemies firewall. At the end of a selected turn based round, the firewalls will be attacked by pen testers, and whoever's falls or is broken into first, loses." Structure follows `StarterKit/SPEC.md`; governed by constitution v1.1.1.

## The pitch

**A firewall engineer edits a rule base to meet a business request, then watches a penetration
test hit their firewall and a rival's, step by step, to see which one is breached first.**

The player is the firewall engineer for a small company. Each level shows a network of zones,
a business request, and a rule base to build or repair. The player adds, removes, and orders
rules and switches security controls on or off, then runs the penetration test. A secure
rule base survives every attack while the rival's firewall falls, and the player's firewall
gains strength. An insecure one is breached, and the game names the rule or missing control
that let the attack through. The session ends when all three levels are completed.

## Clarifications

### Session 2026-11-17

- Q: Are NIST SP 800-41, NIST SP 800-207, and MITRE ATT&CK the right sources and frameworks for
  the game's rules and attacks? → A: Yes, approved as the source set. Each citation is still
  confirmed against the live document before its level ships.
- Q: Should players type rules or pick them? → A: Pick. No free-form text entry anywhere in the
  game; every player input is a selectable option.
- Q: Does outlasting the rival count as a win if the player's firewall is still breached? → A:
  No. A level completes only when every attack step is stopped.
- Q: Can a completed level be improved? → A: Yes, through Harden Further, keeping the best score.
- Q: How many Expert challenges ship? → A: All three, cut first if the build runs short.
- Q: What if no vendor-neutral source is found for first-match rule evaluation? → A: The
  briefing presents it as the game's stated model. (Superseded below: a source was found.)
- Q: Who confirms the citations? → A: The spec author, against the live documents. Done on
  2026-11-17 for every row in the references table and every ATT&CK ID in the level content.
- Q: Is a second person required to check cases, content, or playthroughs? → A: No. This is a
  demo game with a single author. The hand-worked cases become automated checks, and the
  author performs the playthrough and access checks.
- Q: What should the Expert tier contain? → A: The same three scenarios made harder: an
  inherited rule base of eight or nine rules to repair, more attack steps, and a tighter
  request. Concrete content and cases are now in this spec.
- Q: What source supports each claim that a control stops an attack (constitution principle I)?
  → A: The MITRE ATT&CK mitigation listed on each technique's page, and NIST SP 800-41 where
  ATT&CK lists no network mitigation. Read from the live pages on 2026-11-17 and recorded in
  "Control effects and their sources". Four technique citations were corrected as a result.

## Who this is for

- **Learner (Standard tier):** network engineers and students who know IP addresses and ports
  but are new to next-generation firewall (NGFW) policy.
- **Learner (Expert tier):** experienced firewall engineers who want a realistic inherited
  rule base to clean up.
- **Assumed knowledge:** IP addresses, TCP and UDP ports, and what a firewall is for.
- **What the briefing teaches:** zones, first-match rule order, implicit deny, stateful
  inspection, and for later levels application identification, user identity, threat
  inspection, TLS decryption, and DNS filtering.
- **Why interaction helps:** four misconceptions become visible when a rule base is tested:
  "deny rules go first", "port 443 means web traffic", "inspection can read encrypted traffic",
  and "removing a bad rule cannot break anything".
- **Session target:** 10 to 15 minutes for a first Standard playthrough, with unlimited
  thinking time.

## Learning outcomes and evidence

| ID | After playing, the learner can… | The game asks them to… | Evidence of success |
| --- | --- | --- | --- |
| LO1 | Order rules so first-match evaluation and implicit deny give least-privilege access | Build a rule base from rule cards for one public service | Required traffic passes; all three attack steps are denied |
| LO2 | Choose application-aware rules and the controls that make inspection effective | Pick rules and switch on inspection, decryption, and DNS filtering for staff browsing | Tunnel, malware download, and malicious DNS query are all stopped |
| LO3 | Find shadowed and over-broad rules in an inherited rule base and predict what removing them does | Repair a five-rule data-center rule base against a four-step intrusion | Required traffic still passes; all four attack steps are stopped |

## The technical model

- **Rule being taught:** a firewall checks each new connection against its rules from top to
  bottom. The first rule whose every field matches decides allow or deny, and no later rule is
  consulted. A connection that matches no rule is denied (implicit deny).
- **Matching:** a rule has a source zone, destination zone, and optionally source address,
  destination address, service (protocol and port), application, and user group. An empty
  field means "any". A rule matches only when all of its fields match.
- **Stateful inspection:** replies to an allowed connection are allowed automatically. Only the
  first packet's direction needs a rule.
- **Security controls** can be switched on for an allow rule and act only on traffic that rule
  allows:
  - *Threat inspection* stops a connection carrying malware or an exploit, but only if the
    content is readable: the connection is unencrypted, or TLS decryption is on for that rule.
  - *TLS decryption* makes encrypted content readable to threat inspection. It stops nothing
    alone.
  - *DNS filtering* stops a DNS query for a known-malicious domain.
- **Context:** one vendor-agnostic NGFW. No vendor product names, command syntax, or brand
  names for features appear anywhere in the game.
- **Assumptions:** the firewall identifies each connection's application and user correctly
  and immediately. Every flow in the game carries explicit, visible values.
- **Excluded behavior:** NAT, routing, VPN, high availability, IPv6, logging, URL filtering,
  DNS over HTTPS, decryption exemptions, threats detectable without decryption, and the few
  packets a real firewall passes before it identifies an application. The briefing states the
  exclusions that affect a level's conclusions.
- **Authoritative references:** NIST SP 800-41, NIST SP 800-207, and MITRE ATT&CK are the
  approved source set. Every row below was confirmed against the live document on 2026-11-17.
  Content added later MUST be confirmed the same way before it ships.

| Claim | Source, confirmed 2026-11-17 |
| --- | --- |
| Deny by default; allow only what is required | NIST SP 800-41 Rev. 1, section 4 (Firewall Policy), opening |
| Stateful inspection tracks connections so replies need no rule | NIST SP 800-41 Rev. 1, section 2.1.2 (Stateful Inspection) |
| Policy can match on application and on user identity | NIST SP 800-41 Rev. 1, sections 4.2 and 4.3 |
| Rules are checked in order until a match is found | NIST SP 800-41 Rev. 1, section 5.2.2 (Policy Configuration). The source says "many firewalls" work this way and that others differ, so the briefing states that the game models a sequential, first-match firewall |
| Network location alone does not imply trust; access is per session with least privilege | NIST SP 800-207, section 2.1 (Tenets of Zero Trust), tenets 2 and 3 |
| Each attack step is a real, named technique | MITRE ATT&CK Enterprise technique pages; every ID in the level content resolves to the technique named |

**Control effects and their sources.** Each way the game lets a firewall stop an attack traces
to a source read on 2026-11-17. "M" numbers are ATT&CK mitigations as listed on the named
technique's page.

| Effect in the game | Source |
| --- | --- |
| Not allowing a service from another zone stops remote-access attacks on it | M1030 Network Segmentation on T1021.001 ("Do not leave RDP accessible from the internet. Enable firewall rules to block RDP traffic between network security zones") and on T1133 ("Deny direct remote access to internal systems through the use of network proxies, gateways, and firewalls"); M1035 Limit Access to Resource Over Network on T1021 |
| Exposing only intended services stops attacks on an unintended one | M1035 on T1190 ("Ensure that all publicly exposed services are actually intended to be so") |
| Restricting outbound connections from a public-facing server stops its callback | M1037 Filter Network Traffic on T1190 |
| Matching on the application, not the port, stops a tunnel on the web port | NIST SP 800-41 Rev. 1, section 2.1.3 (an application firewall can tell when another application is using port 80); M1037 on T1572 |
| Threat inspection stops a malware download or transfer | M1031 Network Intrusion Prevention on T1105 and on T1570 |
| Inspection cannot read encrypted content | NIST SP 800-41 Rev. 1, section 2.3 (Limitations of Firewall Inspection) |
| TLS decryption makes encrypted content readable to inspection | M1020 SSL/TLS Inspection on T1573 |
| DNS filtering stops a lookup of a malicious domain | M1037 on T1071.004 ("Consider filtering DNS requests to unknown, untrusted, or known bad domains") |
| Restricting file-sharing traffic to the intended application stops remote execution on that port | M1037 on T1021.002 |
| Inspection of an allowed application stops an exploit carried inside it | NIST SP 800-41 Rev. 1, section 2.1.3 (application firewalls identify attacks carried out within application protocols). ATT&CK lists no network inspection mitigation for T1210, only M1030 segmentation, so NIST is the source here |
| Limiting who may reach a server limits lateral movement and misplaced trust in a partner | M1030 on T1210 and on T1199 |
| Blocking a known-bad source address | NIST SP 800-41 Rev. 1, section 4.1.1 (permit only appropriate source addresses). That the block must sit above the allow rests on section 5.2.2 |

The sources say these controls "can be used to mitigate" the techniques. The game simplifies
that to "always stops", and each briefing says so.

If two rule bases both satisfy a level, the game accepts both. Acceptance is decided by
evaluating the submitted rule base, never by comparing it to a stored answer.

## The repeatable game loop

1. **Brief:** introduce the level's concept, its terms, and a worked example that differs from
   the challenge.
2. **Inspect:** show the zones, hosts, business request, available rule cards, and the current
   rule base, with every value needed for the decision visible.
3. **Build:** the player adds, removes, and reorders rules and switches controls. This phase is
   untimed and has no limit on changes.
4. **Run the penetration test:** the player submits. The game first checks that required
   business traffic still passes, then plays the attack steps one turn at a time against both
   firewalls.
5. **Explain:** each step shows the attack, its values, each firewall's verdict, and the rule
   or control that decided it.
6. **Retry, harden, or advance:** a failed level stays playable. A completed level enables Next
   and offers Harden Further if exposure remains.
7. **Reflect:** the session summary shows completed levels, attempts, assistance, firewall
   strength, and capabilities learned, per tier.

**Worked interaction (Level 1, Standard).** The request reads: "Customers on the Internet must
reach the web server 203.0.113.10 on HTTPS. Nothing else may enter the DMZ." The player places
"Deny Internet → DMZ, any" first and "Allow Internet → DMZ, 203.0.113.10, TCP 443" second, and
runs the test. Feedback: "Customers cannot reach the web server. Rule 1 denies everything from
the Internet to the DMZ, and the firewall stops at the first match, so rule 2 is never
reached. Move the allow above the deny, or remove the deny: traffic that matches no rule is
denied anyway." The player removes the deny rule and runs again. All three attacks are denied
by implicit deny, the rival is breached at step 1 through its SSH rule, and the player's
firewall gains 40 strength.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Build a rule base and face the penetration test (Priority: P1)

As a learner, I want to build a rule base for a business request and see exactly how it and a
rival's firewall hold up against the same attacks.

**Why this priority**: this is the core mechanic. Level 1 alone, with this story, is a
playable and teachable game.

**Independent Test**: play Level 1 Standard from a fresh session using the cases in "Cases the
implementation must satisfy" and confirm each expected result.

**Acceptance Scenarios**:

1. **Given** a fresh session, **When** I start, **Then** I choose a tier and see the Level 1
   briefing before I can edit a rule base.
2. **Given** Level 1 Standard, **When** I submit the rule base [R1], **Then** required traffic
   passes, all three attacks are denied, the rival is breached at step 1, the level is
   completed, and each verdict names the deciding rule or "implicit deny".
3. **Given** Level 1 Standard, **When** I submit [R3, R1], **Then** the game reports that
   required traffic is blocked by rule 1, explains first-match order, does not run the
   penetration test, leaves the level incomplete, and lets me retry.
4. **Given** Level 1 Standard, **When** I submit [R1, R2], **Then** the test shows my firewall
   breached at step 1 through rule 2, the level stays incomplete, and I can retry.
5. **Given** an empty rule base, **When** I submit, **Then** I see guidance to add at least one
   rule, and attempts and completion are unchanged.
6. **Given** a penetration test in progress, **When** I ask for full results, **Then** every
   step's outcome is available immediately without waiting for any animation.

---

### User Story 2 - Get help and see honest progress (Priority: P1)

As a learner, I want help when I am stuck and a truthful view of my attempts, assistance,
points, and firewall strength.

**Why this priority**: without help a stuck learner leaves, and without honest scoring the
points mean nothing.

**Independent Test**: on Level 1, use each hint stage, fail, succeed, resubmit, harden, and
restart, checking the counters after each action.

**Acceptance Scenarios**:

1. **Given** an unsolved level, **When** I ask for help, **Then** the first hint explains the
   method, the second shows one worked step, and the third shows a worked solution; each use is
   recorded as assistance and none completes the level.
2. **Given** an unsolved level, **When** I make a valid submission, **Then** attempts increase
   by one whether it succeeds or fails.
3. **Given** a failed submission, **When** I resubmit the identical rule base, **Then** the
   previous result is shown again and attempts do not increase.
4. **Given** a completed level, **When** I submit the same rule base again, **Then** points,
   strength, attempts, and completion are unchanged.
5. **Given** a completed level with exposure remaining, **When** I choose Harden Further and
   submit a rule base that scores higher, **Then** the level's score becomes the higher value,
   not the sum; a lower-scoring or failing submission leaves the score and completion as they
   were.
6. **Given** a completed level, **When** I view my firewall, **Then** I see its strength beside
   the rival's and the capability that level taught added to my list.
7. **Given** all three levels completed, **When** I choose Next, **Then** a session summary
   shows, per tier, completed levels, attempts, assistance used, strength, and capabilities.
8. **Given** any point in a session, **When** I choose Restart and confirm, **Then** the session
   clears and I return to tier selection; **When** I cancel, **Then** nothing changes.

---

### User Story 3 - Play with keyboard and readable feedback (Priority: P1)

As a keyboard user, I want to inspect the level, edit and reorder the rule base, run the test,
get help, and advance without a mouse.

**Why this priority**: reordering a rule table is the central action and the one most likely to
exclude a keyboard user.

**Independent Test**: complete Level 1 using only the keyboard, then repeat with reduced motion
requested and in a narrow window.

**Acceptance Scenarios**:

1. **Given** any screen, **When** I move through it by keyboard, **Then** every core control is
   reachable in a sensible order, shows visible focus, and has a readable name.
2. **Given** a rule in the rule base, **When** I use the keyboard move commands, **Then** the
   rule moves up or down and its new position is announced in text.
3. **Given** a test result, **When** it appears, **Then** allow, deny, stopped, and breached are
   stated in words as well as color, stay on screen to read, and are announced to assistive
   technology.
4. **Given** reduced motion is requested, **When** the test runs, **Then** no information is
   lost and results are not delayed.
5. **Given** a narrow window, **When** the rule table is wider than the screen, **Then** it
   scrolls inside its own labeled area and the action buttons remain reachable.

---

### User Story 4 - Strengthen the firewall with NGFW capabilities (Priority: P2)

As a learner, I want later levels to add application-aware rules, security controls, user
identity, and segmentation, so my firewall grows stronger as I learn more.

**Why this priority**: this delivers the "more technologies, stronger firewall" progression,
but Level 1 is a complete game without it.

**Independent Test**: play Levels 2 and 3 Standard using their cases and confirm the expected
results, strength totals, and capability list.

**Acceptance Scenarios**:

1. **Given** Level 1 is completed at either tier, **When** I choose Next, **Then** Level 2 is
   available at both tiers.
2. **Given** Level 2 Standard, **When** I submit the application-based browsing rule with threat
   inspection on and TLS decryption off, **Then** the malware download gets through at step 2
   and the explanation says inspection cannot read content that is still encrypted.
3. **Given** Level 2 Standard, **When** I submit the port-based TCP 443 rule with every control
   on, **Then** the tunnel gets through at step 1 and the explanation contrasts a port with an
   application.
4. **Given** Level 3 Standard, **When** I remove only the "any any" rule, **Then** the game
   reports that database administrators are now blocked by the deny rule that used to be
   shadowed, and does not run the test.
5. **Given** Level 3 Standard, **When** I submit [R3 with inspection, R4 with inspection],
   **Then** all four attack steps are stopped, the rival is breached at step 4, and the level
   is completed.

---

### User Story 5 - Take on the Expert tier (Priority: P3)

As an experienced firewall engineer, I want a harder version of each level with a larger
inherited rule base, so the game is worth my time.

**Why this priority**: it widens the audience but adds no new mechanic, and it is the first
scope to cut if the build runs short.

**Independent Test**: play each Expert level using its recorded cases; confirm progress is
recorded separately from Standard.

**Acceptance Scenarios**:

1. **Given** tier selection or the space between levels, **When** I switch tier, **Then** the
   switch is free, carries no penalty, and keeps my progress in the other tier.
2. **Given** an Expert level, **When** it opens, **Then** I see a shorter briefing, an inherited
   rule base of at least eight rules, and every value needed to reason about it.
3. **Given** an Expert level, **When** I ask for help, **Then** the same three hint stages are
   available as in Standard.
4. **Given** I completed a level only at Standard, **When** I view the summary, **Then** that
   level is not shown as completed at Expert.
5. **Given** an Expert level that was cut from the release, **When** I look for it, **Then** it
   is shown as unavailable with an explanation, not hidden or broken.

---

### Edge Cases

- **Outlasting the rival while still breached:** if the rival falls at an earlier step than the
  player but the player is still breached, the result says so plainly, the level stays
  incomplete, and no points are banked.
- **Both breached at the same step:** reported as "both breached"; the level stays incomplete.
- **Blocking everything:** a rule base that denies required business traffic is an outage. It
  counts as an attempt, the test does not run, and the level stays incomplete.
- **A deny rule placed below the rule that already decides the traffic** has no effect; the
  result notes that the rule was never reached.
- **Two different rule bases both pass:** both complete the level. Their scores may differ if
  one leaves more exposure.
- **Invalid or ambiguous level content** (for example a rival that survives every step, a
  required flow that is also an attack step, or a missing source): the level shows a content
  error, cannot be graded, and awards nothing. This is an authoring error, not a learner
  failure.
- **Page reload:** the session starts again from tier selection.
- **Switching tier mid-level:** the unsubmitted rule base for that level is discarded after a
  confirmation; counters for completed levels are unchanged.

## Requirements *(mandatory)*

### Functional Requirements

**Briefing and inspection**

- **FR-001**: The game MUST show a level's briefing before that level's rule base can be edited.
- **FR-002**: Each briefing MUST introduce the level's concept and terms with a worked example
  that differs from the challenge, and MUST state the simplifications that affect the level.
- **FR-003**: Each level MUST show its zones, hosts, addresses, user groups, business request,
  available rules, and current rule base. No decision-relevant value may be visible only on
  pointer hover.

**Building the rule base**

- **FR-004**: Players MUST be able to add an available rule to the rule base, remove a rule,
  and move a rule up or down.
- **FR-005**: Players MUST be able to switch each security control offered on an allow rule on
  or off.
- **FR-006**: The build phase MUST have no time limit and no limit on the number of changes.
- **FR-007**: Every player input MUST be a selectable option: choosing a tier, adding a
  provided rule, removing or moving a rule, switching a control, asking for a hint, and
  navigating. The game MUST NOT contain any free-form text entry field, so no input can be
  malformed.

**Evaluation**

- **FR-008**: The game MUST evaluate every flow against the submitted rule base by first match
  from the top, with all specified fields required to match and unmatched flows denied.
- **FR-009**: Security controls MUST behave as defined in "The technical model", including that
  threat inspection has no effect on encrypted content unless TLS decryption is on for the
  matching rule.
- **FR-010**: On a valid submission the game MUST first check every required business flow. If
  any is denied, the game MUST report an outage naming the rule responsible, or "implicit deny"
  when no rule matched, and MUST NOT run the penetration test.
- **FR-011**: If required traffic passes, the game MUST run the level's attack steps in their
  fixed order against both the player's firewall and the rival's.
- **FR-012**: A firewall is breached at the first attack step that it allows and that no
  control stops.
- **FR-013**: The same rule base submitted to the same level MUST always produce the same
  result.
- **FR-014**: The rival's firewall MUST be evaluated by the same rules as the player's. Its
  rule base is fixed per level and tier and MUST be viewable after the test.

**Outcome of a level**

- **FR-015**: A level is completed only when required traffic passes and the player's firewall
  stops every attack step. Because every valid rival is breached at some step, a completed
  level is always a win over the rival.
- **FR-016**: The result MUST state one of: outage; breached before the rival; both breached at
  the same step; outlasted the rival but breached; or survived and won. Only the last
  completes the level.
- **FR-017**: For every attack step and each firewall, the result MUST show the attack's name
  and values, the verdict, and the rule position or control that decided it, or "implicit
  deny".
- **FR-018**: A wrong result MUST explain the specific mistake and suggest a next step. A
  correct result MUST explain why the rule base works.

**Points, strength, and capabilities**

- **FR-019**: A submission's score is 10 points for each attack step stopped plus 5 points for
  each exposure probe denied. Exposure probes are authored flows that the business request
  does not need and that a least-privilege rule base denies.
- **FR-020**: A score is banked only when the level is completed. Banked scores MUST NOT be
  reduced by attempts, hints, or elapsed time.
- **FR-021**: Each level and tier holds one banked score: the highest achieved. Resubmission
  MUST NOT add to it.
- **FR-022**: Firewall strength is the total of the player's banked scores. It MUST be shown
  beside the rival's strength, which is the rival's score under the same scoring rule for the
  same levels.
- **FR-023**: Completing a level MUST add that level's capability to the player's capability
  list, once.
- **FR-024**: After completing a level with any exposure probe still allowed, the game MUST
  list each exposure with its reason and offer Harden Further.

**Help, attempts, and progress**

- **FR-025**: Each level MUST offer three hint stages in order: method, one worked step, worked
  solution. Each use is recorded as assistance. Viewing a worked solution MUST NOT complete the
  level.
- **FR-026**: Each valid submission before completion counts as one attempt. An empty rule base
  and an identical resubmission of a failed rule base MUST NOT count.
- **FR-027**: Completed levels, attempts, and assistance MUST be displayed as separate values,
  per tier.
- **FR-028**: Levels unlock in order. Completing a level at either tier unlocks the next level
  at both tiers.
- **FR-029**: Players MUST be able to choose a tier at the start and change it between levels
  without penalty. Progress MUST be kept separately for each tier.
- **FR-030**: After the third level is completed, Next MUST open a session summary.
- **FR-031**: Restart MUST ask for confirmation, then clear the session and return to tier
  selection. Cancel MUST preserve the session.
- **FR-032**: Progress is held for the current page session only. A reload starts again.

**Content integrity**

- **FR-033**: The game MUST validate a level before presenting it and MUST refuse to grade a
  level that fails validation, showing a content error instead.
- **FR-034**: Validation MUST reject at least: a rival that is not breached at any step; a
  rival that blocks required traffic; a level with no rule base that can complete it; a flow
  listed as both required and an attack; and a rule or attack step with no recorded source.
- **FR-035**: No vendor product name, vendor command syntax, or vendor feature brand name may
  appear in any shipped text.
- **FR-036**: Attacks are named techniques evaluated against the model. The game MUST NOT send
  network traffic to any host or include working exploit code.

**Access**

- **FR-037**: Every core action MUST be operable by keyboard, including reordering rules, with
  visible focus and readable names.
- **FR-038**: Every outcome MUST be conveyed in text as well as color, remain readable until
  dismissed, and be announced to assistive technology.
- **FR-039**: The topology and the attack path MUST each have a text equivalent.
- **FR-040**: When reduced motion is requested the game MUST present the same information
  without animation. Animation MUST never delay results or controls.
- **FR-041**: The game MUST remain usable in a narrow window; a wide rule table scrolls within
  its own labeled area without hiding the action buttons.

### Key Entities *(include if feature involves data)*

- **Level**: one scenario with a concept, briefing, business request, topology, and capability.
  Exists at two tiers.
- **Challenge**: a level at one tier: available rules, starting rule base, required flows,
  attack steps, exposure probes, rival rule base, hints, and sources.
- **Zone and host**: named network areas and the addressed systems and user groups in them.
- **Rule**: source and destination zone, optional addresses, service, application, and user
  group, an action (allow or deny), and the controls it may carry.
- **Security control**: threat inspection, TLS decryption, or DNS filtering, on or off per
  allow rule.
- **Flow**: one connection with visible values: zones, addresses, user group, port,
  application, whether it is encrypted, and what it carries.
- **Required flow**: business traffic that must be allowed.
- **Attack step**: a named technique expressed as a flow, with its source and the control or
  rule property that stops it.
- **Exposure probe**: a flow the request does not need; allowing it lowers the score without
  failing the level.
- **Rival firewall**: a fixed rule base per challenge that illustrates a common mistake.
- **Result**: the outcome of one submission: service check, per-step verdicts with deciding
  rule, outcome label, and score.
- **Session progress**: per tier, completed levels, attempts, assistance, banked scores,
  strength, and capabilities.

## Version-one content

**Three levels, one round each, at two tiers: six challenges.** The same mechanic is used
throughout. This replaces the starter kit default of two rounds per level.

| Level | New concept | Prerequisite | Misconception to expose | Capability gained |
| --- | --- | --- | --- | --- |
| 1 · Open the storefront | First-match order, implicit deny, least privilege, stateful replies | Addresses and ports | "Deny rules go first"; "the server needs an outbound rule to reply" | Least-privilege rule base |
| 2 · Let staff browse safely | Application identification, threat inspection, TLS decryption, DNS filtering | Level 1 | "Port 443 is web traffic"; "inspection reads encrypted traffic" | Application-aware inspection |
| 3 · Clean up the data center | User identity, segmentation, shadowed rules, lateral movement | Level 2 | "Removing a bad rule cannot break anything"; "internal traffic is trusted" | Identity-based segmentation |

**Expert tier.** Each Expert challenge uses the same scenario with an inherited rule base of at
least eight rules containing at least one shadowed rule, one redundant rule, and one over-broad
rule, a tighter business request, and at least five attack steps. The player repairs it by
removing rules, restoring removed rules, reordering, and switching controls; there are no
spare rule cards. The briefing is shortened. Values, feedback, and hints are not reduced, and
no timer is added. Expert content follows each level's Standard content below.

**Progression:** sequential on first playthrough; retry without penalty. Points and firewall
strength are in this release. There are no lives, timer, speed bonus, leaderboard, or streak.

### Level 1 Standard · content

Hosts: WEB-1 203.0.113.10 and JUMP-1 203.0.113.20, both in the DMZ. Request: customers on the
Internet must reach WEB-1 on HTTPS (TCP 443); nothing else may enter the DMZ; WEB-1 starts no
connections of its own.

| Rule | Action | From → To | Destination or source | Service |
| --- | --- | --- | --- | --- |
| R1 | Allow | Internet → DMZ | to 203.0.113.10 | TCP 443 |
| R2 | Allow | Internet → DMZ | any | any |
| R3 | Deny | Internet → DMZ | any | any |
| R4 | Allow | Internet → DMZ | to 203.0.113.10 | TCP 80, TCP 443 |
| R5 | Allow | Internet → DMZ | any | TCP 22 |
| R6 | Allow | DMZ → Internet | from 203.0.113.10 | any |
| R7 | Allow | Internet → DMZ | to 203.0.113.10 | TCP 8080 |

- Required flow F1: 198.51.100.7 → 203.0.113.10, TCP 443.
- Attack A1: password guessing over SSH, 198.51.100.66 → 203.0.113.20, TCP 22 (ATT&CK T1110,
  T1133).
- Attack A2: exposed admin console, 198.51.100.66 → 203.0.113.10, TCP 8080 (ATT&CK T1190).
- Attack A3: remote desktop, 198.51.100.66 → 203.0.113.20, TCP 3389 (ATT&CK T1021.001).
- Probe P1: 198.51.100.7 → 203.0.113.10, TCP 80. Probe P2: 203.0.113.10 → 198.51.100.66,
  TCP 4444, a new outbound connection.
- Rival: [R5, R1]. Breached at step 1. Rival score 30.

### Level 2 Standard · content

Hosts: staff workstation 10.10.0.23 in Users; approved DNS resolver 198.51.100.53 on the
Internet. Request: staff must browse the web over HTTPS and resolve names through the approved
resolver; malware and command-and-control traffic must be stopped.

| Rule | Action | From → To | Match | Controls offered |
| --- | --- | --- | --- | --- |
| R1 | Allow | Users → Internet | service TCP 443 | threat inspection, TLS decryption |
| R2 | Allow | Users → Internet | application: HTTPS web browsing | threat inspection, TLS decryption |
| R3 | Allow | Users → Internet | to 198.51.100.53, application: DNS | DNS filtering |
| R4 | Allow | Users → Internet | service UDP 53, any destination | DNS filtering |
| R5 | Allow | Users → Internet | any | none |

- Required F1: 10.10.0.23 → 198.51.100.80, TCP 443, HTTPS web browsing, encrypted, clean.
- Required F2: 10.10.0.23 → 198.51.100.53, UDP 53, DNS, benign name.
- Attack A1: tunnel on the web port, 10.10.0.23 → 198.51.100.66, TCP 443, application:
  remote-access tunnel (ATT&CK T1572).
- Attack A2: malware download, 10.10.0.23 → 198.51.100.66, TCP 443, HTTPS web browsing,
  encrypted, carries malware (ATT&CK T1105, T1573).
- Attack A3: command-and-control lookup, 10.10.0.23 → 198.51.100.53, UDP 53, DNS, malicious
  domain (ATT&CK T1071.004).
- Probe P1: DNS to an unapproved resolver, 10.10.0.23 → 198.51.100.99, UDP 53. Probe P2: direct
  mail, 10.10.0.23 → 198.51.100.25, TCP 25.
- Rival: [R1 with inspection on and decryption off, R4 with DNS filtering on]. Breached at
  step 1. Rival score 15.

### Level 3 Standard · content

Hosts: DB-1 10.20.0.10 and APP-2 10.20.0.20 in Servers; WEB-1 203.0.113.10 in the DMZ; in
Users, 10.10.0.50 (group DB-Admins) and 10.10.0.23 (group Staff). Request: only DB-Admins and
WEB-1 may reach DB-1, and only with the database application; nothing else may enter Servers;
traffic into Servers must be inspected. Database traffic in this level is unencrypted, so TLS
decryption is not offered. The level starts with this inherited rule base, in this order:

| Rule | Action | From → To | Match | Inspection |
| --- | --- | --- | --- | --- |
| R1 | Allow | Users → Servers | any (labeled "temporary, migration") | off |
| R2 | Deny | Users → Servers | to 10.20.0.10, any | n/a |
| R3 | Allow | Users → Servers | group DB-Admins, to 10.20.0.10, application: database | off |
| R4 | Allow | DMZ → Servers | from 203.0.113.10, to 10.20.0.10, application: database | off |
| R5 | Allow | DMZ → Servers | from 203.0.113.10, any destination, TCP 22 (labeled "backup script") | off |

- Required F1: 10.10.0.50 (DB-Admins) → DB-1, database, clean. Required F2: WEB-1 → DB-1,
  database, clean.
- Attack A1: phished staff workstation 10.10.0.23 (Staff) → DB-1, database (ATT&CK T1021).
- Attack A2: 10.10.0.23 → APP-2, TCP 3389, remote desktop (ATT&CK T1021.001).
- Attack A3: compromised WEB-1 → DB-1, TCP 22, SSH (ATT&CK T1021.004, under T1021).
- Attack A4: compromised WEB-1 → DB-1, database, carrying an exploit (ATT&CK T1210).
- Probe P1: WEB-1 → APP-2, TCP 22. Probe P2: 10.10.0.50 → APP-2, TCP 445. Probe P3:
  10.10.0.50 → DB-1, database, carrying an exploit.
- Rival: [R3, R4], inspection off on both. Breached at step 4. Rival score 40.

### Level 1 Expert · content

Hosts in the DMZ: WEB-1 203.0.113.10, JUMP-1 203.0.113.20, MAIL-1 203.0.113.25. On the
Internet: a customer 198.51.100.7, a mail server 198.51.100.30, the support partner
198.51.100.200, a known-bad address 198.51.100.66, and an unlisted attacker 198.51.100.77.
Request: customers reach WEB-1 on TCP 443; Internet mail servers reach MAIL-1 on TCP 25; only
the support partner reaches JUMP-1 on TCP 22; the known-bad address reaches nothing; MAIL-1 may
send mail out on TCP 25 and no other DMZ host starts outbound connections. Inherited rule base,
in this order:

| Rule | Action | From → To | Source or destination | Service |
| --- | --- | --- | --- | --- |
| E1 | Allow | Internet → DMZ | to 203.0.113.10 | TCP 80, TCP 443 |
| E2 | Allow | Internet → DMZ | any | TCP 22 |
| E3 | Allow | Internet → DMZ | from 198.51.100.200, to 203.0.113.20 | TCP 22 |
| E4 | Deny | Internet → DMZ | from 198.51.100.66 (labeled "blocklist") | any |
| E5 | Allow | Internet → DMZ | to 203.0.113.25 | TCP 25 |
| E6 | Allow | Internet → DMZ | to 203.0.113.10 | TCP 443 |
| E7 | Allow | DMZ → Internet | any | any |
| E8 | Allow | DMZ → Internet | from 203.0.113.25 | TCP 25 |
| E9 | Allow | Internet → DMZ | to 203.0.113.10 | TCP 8080 |

- Required F1: 198.51.100.7 → 203.0.113.10, TCP 443. F2: 198.51.100.30 → 203.0.113.25, TCP 25.
  F3: 198.51.100.200 → 203.0.113.20, TCP 22. F4: 203.0.113.25 → 198.51.100.30, TCP 25.
- Attack A1: password guessing over SSH, 198.51.100.77 → 203.0.113.20, TCP 22 (ATT&CK T1110,
  T1133).
- Attack A2: exposed admin console, 198.51.100.77 → 203.0.113.10, TCP 8080 (ATT&CK T1190).
- Attack A3: exploit attempt from the known-bad address, 198.51.100.66 → 203.0.113.10, TCP 443
  (ATT&CK T1190). This level has no inspection, so only the blocklist rule can stop it.
- Attack A4: outbound callback from WEB-1, 203.0.113.10 → 198.51.100.66, TCP 443 (ATT&CK
  T1071.001).
- Attack A5: remote desktop, 198.51.100.77 → 203.0.113.20, TCP 3389 (ATT&CK T1021.001).
- Probe P1: 198.51.100.7 → 203.0.113.10, TCP 80. Probe P2: 203.0.113.20 → 198.51.100.7, TCP 443.
  Probe P3: 198.51.100.66 → 203.0.113.25, TCP 25.
- Rival: [E1, E3, E5, E8, E4]. Breached at step 3. Rival score 45.
- Misconception exposed: a blocklist deny only works above the allows it must override, which
  is the one case where a deny does go first.

### Level 2 Expert · content

Hosts in Users: 10.10.0.23 (group Staff) and 10.10.0.90 (group Contractors). On the Internet:
the approved resolver 198.51.100.53, a website 198.51.100.80, the vendor portal
198.51.100.150, and an attacker 198.51.100.66. Request: Staff browse the web over HTTPS;
Contractors reach only the vendor portal; everyone resolves names only through the approved
resolver; all allowed web traffic is decrypted and inspected and DNS is filtered. Inherited rule
base, in this order, with the controls as found:

| Rule | Action | From → To | Match | Controls as found |
| --- | --- | --- | --- | --- |
| X1 | Allow | Users → Internet | service TCP 443 | inspection on, decryption off |
| X2 | Allow | Users → Internet | group Staff, application: HTTPS web browsing | inspection on, decryption off |
| X3 | Allow | Users → Internet | group Contractors, application: HTTPS web browsing | inspection off, decryption off |
| X4 | Allow | Users → Internet | group Contractors, to 198.51.100.150, application: HTTPS web browsing | inspection off, decryption off |
| X5 | Allow | Users → Internet | service UDP 53, any destination | DNS filtering off |
| X6 | Allow | Users → Internet | to 198.51.100.53, application: DNS | DNS filtering off |
| X7 | Allow | Users → Internet | group Staff, to 198.51.100.80, application: HTTPS web browsing | inspection off, decryption off |
| X8 | Allow | Users → Internet | application: remote-access tunnel (labeled "helpdesk tool") | none offered |

- Required F1: 10.10.0.23 → 198.51.100.80, TCP 443, HTTPS web browsing, encrypted, clean.
  F2: 10.10.0.90 → 198.51.100.150, TCP 443, HTTPS web browsing, encrypted, clean.
  F3: 10.10.0.23 → 198.51.100.53, UDP 53, DNS, benign. F4: 10.10.0.90 → 198.51.100.53, UDP 53,
  DNS, benign.
- Attack A1: tunnel on the web port, 10.10.0.23 → 198.51.100.66, TCP 443, application:
  remote-access tunnel (ATT&CK T1572).
- Attack A2: contractor malware download, 10.10.0.90 → 198.51.100.66, TCP 443, HTTPS web
  browsing, encrypted, carries malware (ATT&CK T1105).
- Attack A3: staff malware download, 10.10.0.23 → 198.51.100.66, TCP 443, HTTPS web browsing,
  encrypted, carries malware (ATT&CK T1105, T1573).
- Attack A4: command-and-control lookup, 10.10.0.23 → 198.51.100.53, UDP 53, DNS, malicious
  domain (ATT&CK T1071.004).
- Attack A5: malware served by the compromised vendor portal, 10.10.0.90 → 198.51.100.150,
  TCP 443, HTTPS web browsing, encrypted, carries malware (ATT&CK T1199, T1105, T1573).
- Probe P1: 10.10.0.23 → 198.51.100.99, UDP 53, DNS. Probe P2: 10.10.0.90 → 198.51.100.80,
  TCP 443, HTTPS web browsing, encrypted, clean.
- Rival: [X2 inspection on and decryption on, X4 both off, X6 DNS filtering on]. Breached at
  step 5. Rival score 50.
- Misconception exposed: a trusted destination still needs inspection.

### Level 3 Expert · content

Hosts in Servers: DB-1 10.20.0.10 and APP-2 10.20.0.20. In the DMZ: WEB-1 203.0.113.10 and
JUMP-1 203.0.113.20. In Users: 10.10.0.50 (group DB-Admins only) and 10.10.0.23 (group Staff
only). Request: DB-Admins and WEB-1 reach DB-1 with the database application; Staff reach APP-2
with the file-sharing application; nothing else enters Servers; all of it is inspected. Traffic
in this level is unencrypted. Inherited rule base, in this order, all inspection off:

| Rule | Action | From → To | Match |
| --- | --- | --- | --- |
| Y1 | Allow | Users → Servers | any (labeled "temporary, migration") |
| Y2 | Deny | Users → Servers | to 10.20.0.10, any |
| Y3 | Allow | Users → Servers | group DB-Admins, to 10.20.0.10, application: database |
| Y4 | Allow | Users → Servers | group Staff, to 10.20.0.20, service TCP 445 |
| Y5 | Allow | Users → Servers | group Staff, to 10.20.0.20, application: file sharing |
| Y6 | Allow | DMZ → Servers | from 203.0.113.10, to 10.20.0.10, application: database |
| Y7 | Allow | DMZ → Servers | any source, to 10.20.0.10, application: database |
| Y8 | Allow | DMZ → Servers | from 203.0.113.10, any destination, TCP 22 (labeled "backup script") |

- Required F1: 10.10.0.50 → DB-1, database, clean. F2: WEB-1 → DB-1, database, clean.
  F3: 10.10.0.23 → APP-2, TCP 445, file sharing, clean.
- Attack A1: phished staff workstation 10.10.0.23 → DB-1, database (ATT&CK T1021).
- Attack A2: 10.10.0.23 → APP-2, TCP 3389, remote desktop (ATT&CK T1021.001).
- Attack A3: 10.10.0.23 → APP-2, TCP 445, application: remote command execution, carrying
  nothing an inspection can flag (ATT&CK T1021.002).
- Attack A4: 10.10.0.23 → APP-2, TCP 445, file sharing, carries malware (ATT&CK T1570).
- Attack A5: compromised JUMP-1 → DB-1, database (ATT&CK T1021).
- Attack A6: compromised WEB-1 → DB-1, database, carrying an exploit (ATT&CK T1210).
- Probe P1: WEB-1 → APP-2, TCP 22. Probe P2: 10.10.0.50 → DB-1, database, carrying an exploit.
  Probe P3: 10.10.0.50 → APP-2, TCP 445, file sharing.
- Rival: [Y3 inspection off, Y4 inspection off, Y6 inspection on]. Breached at step 3. Rival
  score 50.
- Misconception exposed: inspection does not rescue a rule that allows the wrong application.

## Cases the implementation must satisfy

Expected results below were worked by hand from the technical model, independently of any
implementation, by the spec author. They are implemented as automated checks, which is the
independent verification for this demo; a disagreement between a check and the evaluator is
resolved by re-deriving the case from the technical model, not by editing whichever is easier.
Levels marked 1E, 2E, and 3E are the Expert challenges.

| Case | Level | Player rule base | Expected result | Why |
| --- | --- | --- | --- | --- |
| Correct | 1 | [R1] | F1 allowed by rule 1. A1, A2, A3 denied by implicit deny. P1, P2 denied. Score 40. Rival breached at step 1. Completed. | Least privilege plus implicit deny |
| Correct, alternative | 1 | [R1, R3] | Same outcome and score; attacks denied by rule 2. Completed. | Two valid answers are both accepted |
| Plausible mistake | 1 | [R3, R1] | F1 denied by rule 1. Outage. Test not run. One attempt. Not completed. | "Deny rules go first"; first match wins |
| Plausible mistake | 1 | [R1, R2] | A1 allowed by rule 2. Both breached at step 1. Not completed. | A broad allow below a narrow one still opens everything else |
| Outlasted but breached | 1 | [R1, R7] | A1 denied. A2 allowed by rule 2. Rival fell at step 1, player at step 2. Not completed. No points banked. | Beating the rival is not the same as being secure |
| Boundary: exposure | 1 | [R4] | Attacks denied. P1 allowed by rule 1. Score 35. Completed. Harden Further offered. | Port 80 was not requested |
| Boundary: stateful | 1 | [R1, R6] | Attacks denied. P2 allowed by rule 2. Score 35. Completed. Harden Further offered. | Replies need no rule; R6 only adds outbound exposure |
| No input | 1 | [] | Guidance to add a rule. Attempts unchanged. | Not a learner error |
| Correct | 2 | [R2 inspection on, decryption on; R3 DNS filtering on] | F1, F2 allowed. A1 denied by implicit deny. A2 stopped by threat inspection. A3 stopped by DNS filtering. P1, P2 denied. Score 40. Rival breached at step 1. Completed. | Application match plus readable content |
| Plausible mistake | 2 | [R2 inspection on, decryption off; R3 DNS filtering on] | A1 denied. A2 allowed: content unreadable. Rival fell at step 1, player at step 2. Not completed. | Inspection cannot read encrypted content |
| Plausible mistake | 2 | [R1 inspection on, decryption on; R3 DNS filtering on] | A1 allowed by rule 1. Both breached at step 1. Not completed. | A port is not an application |
| Boundary: exposure | 2 | [R2 on, on; R4 DNS filtering on] | Attacks stopped. P1 allowed by rule 2. Score 35. Completed. | Any resolver was reachable, not only the approved one |
| Correct | 3 | [R3 inspection on, R4 inspection on] | F1, F2 allowed. A1, A2, A3 denied by implicit deny. A4 stopped by threat inspection on rule 2. P1, P2 denied, P3 stopped. Score 55. Rival breached at step 4. Completed. | Identity, segmentation, and inspection together |
| Plausible mistake | 3 | [R2, R3, R4, R5] | F1 denied by rule 1. Outage. Test not run. Not completed. | Removing R1 exposes the deny it was shadowing |
| Plausible mistake | 3 | starting rule base unchanged | A1 allowed by rule 1. Player breached at step 1, before the rival. Not completed. | The "temporary" any rule decides everything from Users |
| Same step as rival | 3 | [R3 inspection off, R4 inspection off] | A1 to A3 denied. A4 allowed by rule 2. Both breached at step 4. Not completed. | An allowed application can still carry an exploit |
| Boundary: exposure | 3 | [R3 inspection off, R4 inspection on] | Attacks stopped. P3 allowed. Score 50. Completed. Harden Further offered. | The request said all traffic into Servers is inspected |
| Correct | 1E | [E4, E3, E5, E6, E8] | F1 to F4 allowed. A1, A2, A4, A5 denied by implicit deny. A3 denied by rule 1. P1, P2 denied by implicit deny, P3 denied by rule 1. Score 65. Rival breached at step 3. Completed. | Blocklist first, then only the narrow allows |
| Plausible mistake | 1E | starting rule base unchanged | F1 to F4 allowed. A1 allowed by rule 2. Player breached at step 1, before the rival. Not completed. | SSH is open to any source |
| Plausible mistake | 1E | [E1, E3, E4, E5, E6, E8] | A1, A2 denied. A3 allowed by rule 1. Both breached at step 3. Not completed. | The blocklist sits below the allow it should override |
| Plausible mistake | 1E | [E4, E3, E5, E6] | F4 denied by implicit deny. Outage. Test not run. Not completed. | Removing both outbound rules stops mail leaving |
| Boundary: exposure | 1E | [E4, E3, E5, E1, E8] | Attacks stopped. P1 allowed by rule 4. Score 60. Completed. Harden Further offered. | Port 80 was not requested |
| Correct | 2E | [X2 inspection on, decryption on; X4 inspection on, decryption on; X6 DNS filtering on] | F1 to F4 allowed. A1, A2 denied by implicit deny. A3 stopped by inspection on rule 1. A4 stopped by DNS filtering on rule 3. A5 stopped by inspection on rule 2. P1, P2 denied. Score 60. Rival breached at step 5. Completed. | Narrow rules, every allowed web flow readable and inspected |
| Plausible mistake | 2E | starting rule base unchanged | F1 to F4 allowed. A1 allowed by rule 1. Player breached at step 1, before the rival. Not completed. | The port rule decides all TCP 443 traffic |
| Plausible mistake | 2E | [X2, X4, X5, X6, X7, X8], controls as found | A1 allowed by rule 6. Player breached at step 1, before the rival. Not completed. | An application rule can be over-broad too |
| Same step as rival | 2E | [X2 inspection on, decryption on; X4 both off; X6 DNS filtering on] | A1, A2 denied. A3, A4 stopped. A5 allowed by rule 2. Both breached at step 5. Not completed. | A trusted destination still needs inspection |
| Boundary: exposure | 2E | [X2 on, on; X3 on, on; X4 on, on; X6 DNS filtering on] | A2 and A5 stopped by inspection on rule 2. All attacks stopped. P2 allowed by rule 2. Score 55. Completed. Harden Further offered. | Contractors can browse anywhere, which was not requested |
| Correct | 3E | [Y3 inspection on, Y5 inspection on, Y6 inspection on] | F1 to F3 allowed. A1, A2, A3, A5 denied by implicit deny. A4 stopped by inspection on rule 2. A6 stopped by inspection on rule 3. P1, P3 denied, P2 stopped. Score 75. Rival breached at step 3. Completed. | Identity, application match, and inspection together |
| Plausible mistake | 3E | starting rule base unchanged | F1 to F3 allowed. A1 allowed by rule 1. Player breached at step 1, before the rival. Not completed. | The "temporary" any rule decides everything from Users |
| Plausible mistake | 3E | [Y2, Y3, Y4, Y5, Y6, Y7, Y8] | F1 denied by rule 1. Outage. Test not run. Not completed. | Removing Y1 exposes the deny it was shadowing |
| Same step as rival | 3E | [Y3 inspection on, Y4 inspection on, Y6 inspection on] | A1, A2 denied. A3 allowed by rule 2. Both breached at step 3. Not completed. | Inspection does not rescue a rule that allows the wrong application |
| Outlasted but breached | 3E | [Y3 inspection on, Y5 inspection off, Y6 inspection on] | A1 to A3 denied. A4 allowed by rule 2. Rival fell at step 3, player at step 4. Not completed. | The right application can still carry malware |
| Boundary: exposure | 3E | [Y3 inspection off, Y5 inspection on, Y6 inspection on] | Attacks stopped. P2 allowed. Score 70. Completed. Harden Further offered. | The request said all traffic into Servers is inspected |
| Unsupported content | any | level whose rival survives every step | Content error shown. No grading, points, or progress. | Authoring error, not learner failure |

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time player completes all three Standard levels in 15 minutes or less,
  using only in-game help.
- **SC-002**: 100% of the cases in "Cases the implementation must satisfy" produce their
  expected result.
- **SC-003**: Submitting the same rule base to the same level ten times produces ten identical
  results.
- **SC-004**: For one deliberately wrong submission in each level, the on-screen explanation
  alone states which rule or missing control caused the outcome.
- **SC-005**: The core flow of every shipped level can be completed using only the keyboard,
  demonstrated by a recorded playthrough.
- **SC-006**: Shipped text contains zero vendor product names, command syntax, or feature brand
  names.
- **SC-007**: 100% of rules, attack steps, and control effects in shipped levels have a recorded
  and checked source.
- **SC-008**: A new challenge using existing rule fields and controls can be added by editing
  content only, and plays correctly.
- **SC-009**: The game plays start to finish with no network connection after it has loaded.

## Experience direction

- **Visual metaphor:** tower defense. Each firewall is a wall and each rule is a gate on it, in
  rule order from the top. An attack packet flies to the wall and is checked gate by gate: a
  gate that does not match is passed, the first that matches opens (allow) or slams shut
  (deny), and a packet that passes every gate falls to the implicit deny. A security control
  is a scanner behind the wall. The player's wall and the rival's are shown side by side.
  (Added 2026-11-17 after play feedback that the first version read as text, not a game. It is
  presentation only: it changes no rule, grade, or score.)
- **One memorable moment:** when a step is decided, the deciding rule is marked in the rule
  table with the words "matched here", and every rule beneath it is labeled "not reached".
- **Always visible:** the business request, the rule base in order, each rule's fields and
  controls, and both strength values.
- **Feedback voice:** patient and specific; describe the submitted rule base's behavior before
  offering the next step. Never mock a breach.
- **Layout:** request and topology first, rule base and actions next, results beside or below.

## Non-goals

No user accounts, multiplayer, backend, live device or network access, runtime AI, leaderboard,
or level editor. No live turn-by-turn battle mode with defenses of differing effectiveness;
that is deferred scope under the constitution and needs its own specification. No free-form
rule authoring. No simulation of NAT, routing, VPN, high availability, IPv6, logging, URL
filtering, or cloud-delivered firewall services. No saving across reloads. Visual polish must
fit the existing mechanic.

## Assumptions

- "Turn-based round" is read as: an untimed build phase, then a penetration test that plays out
  one attack step per turn. The player does not act during the test.
- The opponent is an authored rival, not another person or a runtime AI.
- "Points" and "firewall strength" are one measure: strength is the total of banked points.
  "Technologies learned" is shown as the capability list.
- One round per level, so the Expert tier fits the same build as six challenges rather than
  twelve.
- Addresses come from documentation and private ranges and do not refer to real hosts.
- Players use a current desktop or laptop browser. Phone layouts are not a target beyond the
  narrow-window requirement.
- If the build runs short, Expert challenges are cut first and shown as unavailable.

## Release evidence

Every acceptance scenario has a recorded result. Every case in the cases table passes as an
automated check. Every shipped briefing and explanation is read against the references by the
author. The author completes the core flow using only the keyboard, and the narrow-window and
reduced-motion checks are recorded. No second reviewer is required for this demo. The README describes implemented behavior, exact run and test commands,
the model's simplifications, and any remaining limits, including any Expert challenge that was
cut.
