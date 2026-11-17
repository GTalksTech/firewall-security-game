# Contract: player interface

What each view shows and which controls it offers. Every input is a native button, switch
(checkbox), or radio group. There is no text field, no drag and drop, and no information
available only on hover (FR-003, FR-007, FR-037).

## Views

| View | Shows | Controls |
| --- | --- | --- |
| Tier selection | Game title, one-paragraph premise, what each tier is for | Standard, Expert (radio group), Start |
| Briefing | Level title, concept paragraphs, worked example, simplifications, sources | Start Building |
| Build | Business request; topology diagram with its text description; hosts and groups; the rule base as an ordered table; available rule cards; both strength values; attempts and hints used | Per rule: Move Up, Move Down, Remove, one switch per offered control. Per card: Add. Hint, Run Penetration Test, Switch Tier, Restart |
| Result | Outcome heading in words; service check; attack steps for both firewalls; the rival's rule base; score; exposures | Next Attack, Show Full Results, then Retry, or Harden Further and Next |
| Summary | Per tier: completed levels, attempts, assistance, strength versus rival, capabilities | Switch Tier, Restart |
| Content error | Which level and tier is unavailable and why, in plain words | Back, Restart |

Persistent on every view after tier selection: the current tier and level, and Restart.

## Rule table

- One row per rule, in evaluation order, numbered from 1.
- Columns: position, action, from and to zone, source, destination, service or application,
  user group, controls, note.
- Empty rule fields display the word "any".
- The table sits in its own labeled, horizontally scrollable region. The action buttons below
  it stay reachable at narrow widths (FR-041).
- After a move, focus stays on the moved rule's same button and the new position is announced,
  for example "Rule moved to position 2 of 3".

## Result view

- Attack steps are revealed one per press of Next Attack. Show Full Results reveals the rest.
  The result is complete in memory before the first step is shown.
- Each step shows: the technique name and IDs, the flow's values, then for each firewall the
  verdict in words (Allowed, Denied, Stopped) and the deciding rule position and label, or
  "implicit deny", or the control.
- When a step is revealed, the deciding rule in each rule table is marked "matched here" and
  rows below it "not reached". These are text labels, not color alone.
- The outcome heading is one of: "Outage: required traffic is blocked", "Breached before the
  rival", "Both firewalls breached at step N", "You outlasted the rival but were still
  breached", "Your firewall survived and the rival fell".
- On an outage the attack section is replaced by the statement that the test did not run.

## Keyboard and assistive technology

- Tab order follows reading order: request, topology, rule table, available cards, actions,
  result.
- Every control has a visible focus indicator and an accessible name that includes its target,
  for example "Move rule 2 up" and "Threat inspection for rule 1".
- Move Up on the first rule and Move Down on the last are disabled, not hidden.
- One polite live region announces: guidance for an empty submission, the outcome heading, each
  revealed step's verdicts, hint text, and position changes.
- When the view changes, focus moves to the new view's heading.
- Restart and a mid-level tier switch open a confirmation with Confirm and Cancel; focus
  returns to the triggering control on Cancel.

## Visual states

- Verdicts and outcomes use text plus a color and an icon or prefix word; color is never the
  only signal (FR-038).
- With `prefers-reduced-motion: reduce`, no transitions or animations run, and nothing is
  hidden or delayed (FR-040).
- Layout is usable from 360 px wide. Dense tables scroll inside their own region.

## Loading and failure

- While content loads, the page shows "Loading levels".
- If `levels.json` cannot be loaded or fails file-level validation, the content error view
  explains that the game's content could not be read and offers Retry Loading.
- An unavailable Expert challenge is listed with the words "Not available in this release".
