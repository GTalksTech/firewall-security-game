# Firewall Security Faceoff Constitution

**Purpose:** help network engineers and students, and at a harder tier experienced firewall
engineers, practice configuring a next-generation firewall (NGFW) policy as securely as
possible, by building and ordering policy rules that are then tested by a simulated
penetration test against a rival firewall.

**First release budget:** one core mechanic, three short levels playable at two difficulty
tiers (Standard and Expert), a browser, and a 60-minute workshop build. This budget changes
only through an amendment to the agreed scope.

## Core Principles

### I. Technical Truth Is a Release Requirement

- The game MUST NOT reward a technically incorrect or less secure configuration over a more
  secure one that meets the same stated intent.
- Grading MUST be reproducible from a documented rule and the challenge inputs.
- Every attack-versus-defense effectiveness value MUST trace to a documented reason why that
  control does or does not stop that technique. "Feels balanced" is not a reason.
- Content MUST be vendor agnostic: no vendor product names, CLI syntax, or proprietary feature
  names appear in challenges, feedback, or scoring. Generic terms are used instead
  (application identification, not a vendor's brand name for it).
- Unsupported or ambiguous content is an authoring error: the game MUST show that the challenge
  is unavailable and MUST NOT grade it.
- Simplifications MUST appear in the briefing and the README wherever they affect what the
  player can conclude. Fiction and animation may illustrate a rule; they MUST NOT change it.

**Rationale:** a learner who is rewarded for a wrong rule base will carry it to a real firewall.

**Evidence:** hand-checked correct, incorrect, and boundary cases for each level; a source link
and section for each networking rule and each effectiveness value; a review of all shipped
briefings and explanations. Expected results are recorded independently of the implementation
under test.

### II. Every Round Teaches Through a Decision

- The player's main action MUST exercise the target skill: choosing, writing, and ordering
  firewall policy rules.
- A concept MUST be introduced before it is tested, and the values needed to reason about the
  answer (zones, addresses, applications, users, existing rules) MUST be visible.
- A wrong answer MUST explain the specific mistake and give a useful next step. A correct answer
  MUST explain why it works.
- The penetration test result MUST name which rule or missing control let each attack through,
  or which one stopped it.
- Learning sequence: **Foundation** (first-match rule order, implicit deny, least privilege by
  zone, address, and port) → **Application** (application-, user-, and content-aware policy)
  → **Transfer** (predict and defend against an attack sequence, including shadowed rules).
- Hints reveal a method first, then a worked step. Viewing a worked solution is recorded as
  assistance, never as independent mastery.
- The **Expert** tier raises difficulty only through the problem itself: larger inherited rule
  bases, shadowed and redundant rules to find, tighter business intent, and multi-step attack
  sequences. It MAY shorten the concept introduction. It MUST NOT hide the values needed to
  reason, remove feedback or hints, or add a timer.

**Rationale:** points and firewall strength are only worth earning if they follow understanding.
An experienced engineer is challenged by a realistic rule base, not by missing information.

**Evidence:** the author, or a teammate when one is available, can connect each player action
to a learning outcome and describe what a deliberately wrong choice teaches. The check and its
result are recorded.

### III. Progress Is Honest and Retry Is Safe

- A round completes only on a valid, correct submission. Incorrect answers keep the challenge
  available.
- Empty or malformed submissions give input guidance and MUST NOT count as a wrong attempt.
- Repeated Submit actions MUST NOT award points, strength, or progress twice.
- Points and firewall strength MUST be awarded only for correct, secure configuration. Strength
  MUST NOT be purchasable, random, or granted for time played.
- A breached firewall ends the wave, not the session: the player retries the same wave with no
  penalty. Building has no countdown, and there is no speed bonus.
- The arcade edition is played in real time, by the project owner's decision after three
  playtests found the turn-based form was not a game. Within one run it has hearts, a patience
  meter, and a combo multiplier, and traffic does not wait for the player. Nothing carries
  from one run to the next except the best star count, a failed run restarts the same level
  at once, and the player can pause at any moment and keep editing. The no-countdown and
  no-speed-bonus rules above apply to the text edition, which MUST remain available.
- Hints and retries carry no penalty. Completed rounds, attempts, and assistance are shown
  separately; completion is not proof of independent mastery.
- The player chooses a difficulty tier freely and may switch between rounds. No tier is locked
  behind another, and switching carries no penalty. Progress is recorded and shown per tier;
  a Standard completion is never displayed as an Expert one.
- The specification MUST state exactly what advances a round, finishes a level, decides a
  win or loss against the rival, and resets a session.

**Rationale:** a loss has to be a lesson the player can act on immediately, or the competitive
framing works against the teaching.

**Evidence:** wrong-answer, repeated-submit, hint, breach-and-retry, completion, and reset checks
match the specification.

### IV. Access Is Part of the Core Game

- All core actions, including rule reordering, MUST be usable by keyboard with visible focus,
  readable labels, and an understandable order. Drag-and-drop MUST have a keyboard equivalent.
- Success, failure, allow, deny, and breach MUST be conveyed with text as well as color.
- Essential diagrams (topology, attack path) MUST have a text equivalent.
- Reduced-motion preferences MUST be respected. Animation MUST NOT delay the availability of
  feedback or controls.
- A live wave MUST be skippable to its result at any moment, and MUST resolve at once when
  reduced motion is requested.
- A text edition with every level MUST remain available from the arcade edition.
- The game MUST remain usable on a typical laptop and in a narrow browser window. Dense data
  such as a rule table may scroll inside its own labeled container without hiding the action
  buttons.

**Rationale:** a rule table and a battle animation are the two places this game is most likely
to shut a player out.

**Evidence:** a keyboard-only playthrough, a narrow-window check, and a reduced-motion check.
Record what was actually checked; do not claim full accessibility certification.

### V. Deterministic and Self-Contained

- The game ships authored content and deterministic domain logic. The same rule base against
  the same level MUST always produce the same penetration test result.
- The rival firewall is authored data with a fixed configuration per level. Any variation MUST
  come from a recorded seed, never from unseeded randomness.
- The game MUST NOT require an account, backend, live device connection, model, or API key.
- Attacks are simulated as named techniques evaluated against the policy model. The game MUST
  NOT generate real network traffic, contain working exploit code, or scan any host.
- AI may help write code and assets during development; its output receives the same review as
  any other contribution.
- Runtime AI tutoring, generated questions, and free-text AI grading are stretch work that
  requires an amendment before implementation.

**Rationale:** a result that cannot be reproduced cannot be checked against principle I.

**Evidence:** a clean browser session can play using only the project's static files; replaying
a recorded submission yields the identical result; no external service decides an answer.

### VI. Content and Logic Are Reviewed Separately

- Level content, rival configurations, attack definitions, effectiveness values, hints, sources,
  and difficulty MUST be stored as editable data.
- Domain rules (policy evaluation, attack resolution, scoring) MUST be separate from rendering
  and from progress tracking.
- Data MUST be validated before a challenge is presented.
- Feedback MUST agree with the evaluator's reasoning. A hand-authored answer key MUST NOT
  silently override the rule engine.
- Adding a challenge, an attack, or a defense that uses the existing mechanic MUST require only
  a data change and its checks, not a new scoring path or a new screen implementation.
- A difficulty tier is a property of challenge data. Both tiers MUST use the same policy
  evaluator, attack resolver, and scoring rules; there is no Expert-only code path.

**Rationale:** NGFW capabilities change yearly; content has to be updatable by someone who
knows firewalls without touching the engine.

**Evidence:** inspect one level's data, trace one answer through the evaluator, and add a trial
challenge and a trial attack without modifying the rule engine.

### VII. Done Is Demonstrated

- Only the agreed scope ships. Requirements, plan, tasks, and README MUST describe the same game.
- A feature is complete when its acceptance criteria pass and its actual status is recorded.
  A screenshot, a checked task box, or an agent saying "done" is insufficient alone.
- When time is short, scope is reduced explicitly. Incorrect teaching and broken core
  interactions are fixed before visual effects are added.
- Failed and untested checks MUST stay visible.

**Rationale:** the workshop build is 60 minutes; unrecorded shortcuts become false claims.

**Evidence:** reproducible run and test commands, recorded verification results, a fresh-start
playthrough, and a README another attendee can follow.

## Scope and Technical Model

**Model being taught.** A single vendor-agnostic NGFW enforcing a zone-based security policy,
with capabilities current as of 2026:

- Ordered rule base with first-match, top-down evaluation and an implicit deny at the end.
- Stateful inspection, so return traffic for an allowed session needs no separate rule.
- Match criteria: source and destination zone, address, service or port, application, and user
  or group identity.
- Security controls attached to allow rules: intrusion prevention, malware and file inspection,
  URL and DNS filtering, and TLS decryption as the precondition for inspecting encrypted traffic.
- Least privilege and segmentation as the measure of "more secure": the narrowest rule that
  still meets the stated business intent scores highest.

**Sources of truth.** Networking rules cite a public, vendor-neutral reference such as NIST
SP 800-41 (firewall policy guidance) and NIST SP 800-207 (zero trust architecture). Attack
techniques and the controls that mitigate them cite MITRE ATT&CK. Vendor documentation MUST NOT
be the only source for any rule.

**Exclusions for the first release.** NAT, routing, VPN, high availability, IPv6 specifics,
logging and SIEM integration, cloud-delivered and SASE variants, and performance tuning are out
of the model. The briefing MUST say so wherever an exclusion affects what the player can
conclude.

**First-release scope.** One core mechanic: the player builds and orders a rule base for a
stated intent; at the end of the round a scripted penetration test runs the same attack
sequence against the player's firewall and the rival's, and the firewall breached first loses.
Three short levels follow the learning sequence in principle II.

**Difficulty tiers.** Each of the three levels is authored at two tiers. Standard is for
learners new to NGFW policy. Expert is for experienced firewall engineers and presents the
same scenario with harder authored data, as bounded by principle II. Every Expert challenge
carries its own source citations and hand-checked cases under principle I. If the build runs
short, the Expert tier is the first scope reduced, and the reduction is recorded under
principle VII.

**Deferred scope.** A separate live battle mode, in which the player answers attacks turn by
turn with defenses of differing effectiveness, is not in the first release. Adding it requires
an amendment, a specification, and a verification approach before implementation. When added,
its effectiveness values are bound by principles I and VI.

## Development Workflow and Quality Gates

- Work follows the Spec Kit sequence: constitution → specify → clarify → plan → tasks →
  analyze → implement. A step is not skipped to save time; scope is reduced instead.
- The plan's Constitution Check MUST list each principle with the evidence that will satisfy it.
- Expected results for the policy evaluator and the attack resolver are written before the
  implementation they check, and are recorded independently of it.
- No level ships without its source citations and its hand-checked correct, incorrect, and
  boundary cases.
- Before a build is called complete: the test command passes, the three access checks in
  principle IV are recorded, and a fresh-start playthrough is recorded.
- A violation of a principle is either fixed or recorded with its reason in the plan's
  complexity tracking; it is never left silent.

## Governance

- This constitution supersedes other project practices where they conflict.
- **Amendment procedure:** for any material change, record the reason, update this file, update
  the affected specification and plan, and rerun analysis. Changes are agreed with the group
  before they take effect.
- A conflict between an implementation and this constitution is resolved openly. The build
  agent MUST NOT weaken a principle merely to make its implementation pass.
- **Versioning policy:** semantic versioning. MAJOR for removing or redefining a principle,
  MINOR for adding a principle or section or materially expanding guidance (including adding
  the deferred battle mode to scope), PATCH for clarifications and wording.
- **Compliance review:** every plan passes the Constitution Check before implementation, and
  `/speckit-analyze` is rerun after any change to the specification, plan, or tasks.

**Version**: 3.0.0 | **Ratified**: 2026-11-17 | **Last Amended**: 2026-11-17
