# Data Model: Firewall Security Faceoff · First Playable

Phase 1 output. Authored content is described here as entities; its exact JSON shape is in
[contracts/level-data.md](./contracts/level-data.md).

## Authored content

### Source

| Field | Meaning |
| --- | --- |
| `id` | Unique, for example `sp800-41-4` |
| `title`, `url`, `section` | Where the claim is found |
| `claim` | The statement it supports |

### Level

| Field | Meaning |
| --- | --- |
| `id` | `level-1`, `level-2`, `level-3`; array order is play order |
| `title`, `concept`, `capability` | Shown in briefing, summary, and capability list |
| `challenges` | Map from tier (`standard`, `expert`) to a Challenge. A missing tier is shown as unavailable |

### Challenge (a level at one tier)

| Field | Meaning |
| --- | --- |
| `briefing` | Paragraphs, a worked example, simplifications, and `sourceIds` |
| `request` | The business request text |
| `topology` | Zones, hosts (name, zone, address, user group), and a text description |
| `rules` | Every rule available in this challenge, keyed by ID |
| `startingRuleBase` | Ordered rule IDs present at the start; empty in Levels 1 and 2 Standard |
| `requiredFlows`, `attackSteps`, `probes` | Ordered lists of flows |
| `rival` | Name, an ordered rule base with control settings, and a note on the mistake it shows |
| `referenceSolution` | An ordered rule base with control settings that completes the challenge |
| `hints` | Two texts: method, then one worked step. Stage 3 displays `referenceSolution` |
| `sourceIds` | Sources for the rules and attacks |

### Rule

| Field | Meaning |
| --- | --- |
| `id`, `label` | Stable ID and display text |
| `action` | `allow` or `deny` |
| `fromZone`, `toZone` | Required |
| `srcAddress`, `dstAddress`, `application`, `userGroup` | A value, or `null` for any |
| `services` | List of `{protocol, port}`, or `null` for any |
| `controls` | For each of `threatInspection`, `tlsDecryption`, `dnsFiltering`: absent if not offered, otherwise the default on or off state |
| `note` | Optional label such as "temporary, migration" |

### Flow (required flow, attack step, or probe)

| Field | Meaning |
| --- | --- |
| `id`, `label` | Stable ID and display text |
| `fromZone`, `toZone`, `srcAddress`, `dstAddress` | Required |
| `protocol`, `port` | Required |
| `application`, `userGroup` | A value or `null` |
| `encrypted` | Boolean |
| `carries` | `none`, `malware`, `exploit`, or `malicious-domain` |
| `techniqueIds` | Attack steps only: ATT&CK IDs |
| `lesson` | Attack steps and probes: what allowing this teaches |

## Runtime values

### Rule base (a submission)

An ordered list of entries, each `{ruleId, controls}` where `controls` holds the on or off
state of each control that rule offers. Its canonical string form is used to detect an
identical resubmission.

### Flow verdict

| Field | Meaning |
| --- | --- |
| `verdict` | `allowed`, `denied-by-rule`, `denied-implicit`, or `stopped-by-control` |
| `matchedIndex` | Position of the deciding rule, or `null` for implicit deny |
| `control` | Which control stopped it, if any |
| `reasonCode` | Stable code, for example `inspection-blind-encrypted` |
| `laterMatches` | Positions below the deciding rule that would also have matched (rules never reached) |

A flow counts as **let through** only when its verdict is `allowed`.

### Submission result

| Field | Meaning |
| --- | --- |
| `serviceCheck` | Verdict for each required flow |
| `outcome` | `outage`, `breached-first`, `both-breached`, `outlasted-but-breached`, or `survived-won` |
| `player`, `rival` | For each: verdict per attack step, verdict per probe, `breachStep` (first allowed step or `null`), and `score` |
| `completed` | True only for `survived-won` |
| `exposures` | Probes the player's rule base allowed |

On `outage`, the attack and probe sections are absent and the score is 0.

### Session state

| Field | Meaning |
| --- | --- |
| `view` | `tier-select`, `briefing`, `build`, `result`, `summary`, or `content-error` |
| `tier`, `levelId` | Current position |
| `workingRuleBase` | The rule base being edited |
| `lastResult` | Result on screen, if any |
| `revealedSteps` | How many attack steps the result view has shown |
| `progress` | One Progress record per tier |

### Progress (per tier)

For each level: `attempts`, `hintStage` (0 to 3, the highest stage viewed), `completed`,
`bankedScore`, and `lastFailedSubmission`. Derived, never stored: strength (sum of banked
scores), capabilities (those of completed levels), and rival strength (sum of the rival's
scores for the same completed levels).

## Validation rules (content)

A challenge is rejected, and shown as a content error, if any of these holds:

1. A required field is missing, an ID is duplicated, or a rule, zone, or source reference does
   not resolve.
2. A rule or flow has an unknown action, verdict-relevant value, or control name.
3. A required flow has `carries` other than `none`, or is identical in every matching field to
   an attack step that itself carries nothing. (An attack step that matches a required flow
   but carries malware, an exploit, or a malicious domain is valid: a control can tell them
   apart.)
4. The rival's rule base fails the service check, or is not breached at any attack step.
5. The reference solution does not produce `survived-won`.
6. The briefing, the challenge, or an attack step has no source or no technique ID.
7. There is no attack step.

The whole file is validated before the game starts. A file-level failure (unreadable, wrong
`schemaVersion`) shows the content error view with no levels. A challenge-level failure makes
that one challenge unavailable and leaves the others playable.

## State transitions

```text
loading ─ content unreadable ─→ content-error
loading → tier-select → briefing → build
build ── submit, empty ───────────────→ build (guidance; no attempt)
build ── submit, same as last failure ─→ result (previous result; no attempt)
build ── submit, new ─────────────────→ result (attempt +1 if level not yet completed)
result (not completed) ── Retry ──────→ build (rule base kept)
result (completed) ── Harden Further ─→ build (hardening mode; score can only rise)
result (completed) ── Next ───────────→ briefing of next level, or summary after the last
any view ── Switch tier ──────────────→ confirm if a rule base is unsubmitted → briefing
any view ── Restart, confirmed ───────→ tier-select with all progress cleared
any view ── Restart, cancelled ───────→ unchanged
```

Rules the state module enforces regardless of what the interface shows:

- A level is available if it is the first, or the previous level is completed in either tier.
- `attempts` increases only for a new, non-empty submission while the level is not completed.
- `bankedScore` becomes the maximum of its old value and a completing submission's score. A
  failing submission after completion changes nothing.
- Completion is set once and never cleared except by Restart.
- Asking for a hint raises `hintStage` by one, to at most 3, and never submits.
