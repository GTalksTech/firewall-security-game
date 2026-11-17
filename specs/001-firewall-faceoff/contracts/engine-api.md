# Contract: engine modules

Everything under `engine/` is plain JavaScript with no DOM access, no network, no clock, and no
randomness. The same inputs always give the same outputs (FR-013). Shapes are described in
[data-model.md](../data-model.md).

## `engine/rules.js`

### `evaluateFlow(ruleBase, rules, flow) → FlowVerdict`

- `ruleBase`: ordered `[{ ruleId, controls }]`. `rules`: the challenge's rule map.
- Walk the rule base from the top. A rule matches when all of these hold:
  - `fromZone` and `toZone` equal the flow's.
  - `srcAddress`, `dstAddress`, `application`, `userGroup` are each `null` or equal the flow's.
  - `services` is `null`, or contains the flow's `protocol` and `port`.
- The first matching rule decides. No later rule is consulted for the verdict.

| Situation | `verdict` | `reasonCode` |
| --- | --- | --- |
| No rule matches | `denied-implicit` | `implicit-deny` |
| First match is a deny rule | `denied-by-rule` | `rule-deny` |
| Allow rule; flow carries malware or exploit; threat inspection on; flow unencrypted or TLS decryption on | `stopped-by-control` | `inspection-stopped` |
| Allow rule; flow carries a malicious domain; DNS filtering on | `stopped-by-control` | `dns-filter-stopped` |
| Allow rule; flow carries malware or exploit; threat inspection on; flow encrypted; TLS decryption off | `allowed` | `inspection-blind-encrypted` |
| Allow rule; flow carries something harmful; the relevant control is off or not offered | `allowed` | `no-control` |
| Allow rule; flow carries nothing | `allowed` | `rule-allow` |

Also returned: `matchedIndex` (0-based position, or `null`), `control` (the control that
stopped it, or `null`), and `laterMatches` (positions below `matchedIndex` whose rules also
match the flow).

### `evaluateRuleBase(challenge, ruleBase) → FirewallResult`

Evaluates every required flow, attack step, and probe.

- `serviceCheck`: verdict per required flow. `serviceOk` is true when all are `allowed`.
- `attacks`: verdict per attack step. `breachStep` is the 1-based number of the first step
  whose verdict is `allowed`, or `null`.
- `probes`: verdict per probe.
- `score`: 10 for each attack step not `allowed` plus 5 for each probe not `allowed`.

All steps and probes are evaluated even after a breach.

### `evaluateSubmission(challenge, ruleBase) → SubmissionResult`

Runs `evaluateRuleBase` for the player's rule base and for `challenge.rival.ruleBase`.

| Condition | `outcome` | `completed` |
| --- | --- | --- |
| Player `serviceOk` is false | `outage` | false |
| Player `breachStep` is `null` | `survived-won` | true |
| Player `breachStep` < rival `breachStep` | `breached-first` | false |
| Player `breachStep` = rival `breachStep` | `both-breached` | false |
| Player `breachStep` > rival `breachStep` | `outlasted-but-breached` | false |

A valid challenge always has a rival that passes the service check and has a non-null
`breachStep`, so these cases are exhaustive. On `outage` the result carries the service check
only. `exposures` lists the player's probes with verdict `allowed`.

### `canonicalForm(ruleBase, rules) → string`

A stable string of ordered rule IDs with the resolved state of each offered control. Two rule
bases are identical exactly when their canonical forms are equal.

## `engine/content.js`

### `validateContent(document) → { ok, fileErrors, challenges }`

- `fileErrors`: problems that stop the whole game (not an object, wrong `schemaVersion`, no
  levels, duplicate level IDs).
- `challenges`: for each level and tier, `{ status: "ok" | "unavailable" | "error", errors }`.
  `unavailable` means the tier is absent. `error` lists every rule from the "Validation rules"
  section of the data model that the challenge breaks.
- Rules 4 and 5 are checked by calling `evaluateRuleBase` and `evaluateSubmission` on the rival
  and the reference solution.

## `engine/state.js`

### `createSession(content, validation) → session`

Returns an object whose methods are the only way state changes. Each returns the new view
state for rendering.

| Method | Effect |
| --- | --- |
| `chooseTier(tier)` | Sets tier; goes to the first available level's briefing |
| `startBuild()` | Briefing to build; loads the starting or last working rule base |
| `addRule(ruleId)`, `removeRule(index)`, `moveRule(index, direction)`, `setControl(index, control, on)` | Edit the working rule base. Out-of-range moves are ignored |
| `requestHint()` | Raises `hintStage` to at most 3; returns the hint to show |
| `submit()` | Applies the attempt and banking rules in the data model; returns `{ kind: "guidance" }` for an empty rule base, otherwise the result |
| `revealNextStep()`, `revealAll()` | Result view only; presentation state |
| `retry()`, `hardenFurther()`, `next()` | Transitions from the result view |
| `switchTier(tier, confirmed)` | Requires `confirmed` when the working rule base differs from the level's starting or last submitted one |
| `restart(confirmed)` | Clears all progress only when `confirmed` is true |
| `summary()` | Per tier: completed levels, attempts, hint stages, strength, rival strength, capabilities |

`submit()` on an unavailable or invalid challenge returns `{ kind: "content-error" }` and
changes nothing.

## `engine/feedback.js`

### `explainVerdict(verdict, context) → string`, `explainResult(result, challenge) → sections`

Build sentences from `reasonCode`, `matchedIndex`, `laterMatches`, and the rule and flow
labels, then append the authored `lesson` for an allowed attack step or probe. Requirements:

- Every sentence about a decision names the rule position and label, or says "implicit deny".
- An outage explanation states which required flow failed, which rule or implicit deny stopped
  it, and which lower rule would have allowed it if `laterMatches` is not empty.
- `inspection-blind-encrypted` is explained as inspection being unable to read content that is
  still encrypted.
- Each of the five outcomes has a distinct heading sentence in words.
