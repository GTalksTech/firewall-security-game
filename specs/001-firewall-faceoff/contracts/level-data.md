# Contract: `data/levels.json`

One JSON document, loaded over HTTP by relative URL and validated in full before the game
starts. Field meanings are in [data-model.md](../data-model.md). Content values come from the
"Version-one content" section of [spec.md](../spec.md).

## Shape

```json
{
  "schemaVersion": 1,
  "sources": [
    {
      "id": "sp800-41-4",
      "title": "NIST SP 800-41 Rev. 1",
      "url": "https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-41r1.pdf",
      "section": "4 Firewall Policy",
      "claim": "Block all traffic that has not been expressly permitted (deny by default)."
    }
  ],
  "levels": [
    {
      "id": "level-1",
      "title": "Open the storefront",
      "concept": "First-match order, implicit deny, least privilege, stateful replies",
      "capability": "Least-privilege rule base",
      "challenges": {
        "standard": {
          "briefing": {
            "paragraphs": ["..."],
            "workedExample": "...",
            "simplifications": ["..."],
            "sourceIds": ["sp800-41-4", "sp800-41-522"]
          },
          "request": "Customers on the Internet must reach WEB-1 on HTTPS (TCP 443). ...",
          "topology": {
            "zones": ["Internet", "DMZ"],
            "hosts": [
              { "name": "WEB-1", "zone": "DMZ", "address": "203.0.113.10", "userGroup": null }
            ],
            "description": "Text equivalent of the diagram."
          },
          "rules": {
            "R1": {
              "label": "Allow Internet to WEB-1 on TCP 443",
              "action": "allow",
              "fromZone": "Internet",
              "toZone": "DMZ",
              "srcAddress": null,
              "dstAddress": "203.0.113.10",
              "services": [{ "protocol": "tcp", "port": 443 }],
              "application": null,
              "userGroup": null,
              "controls": {},
              "note": null
            }
          },
          "startingRuleBase": [],
          "requiredFlows": [
            {
              "id": "F1",
              "label": "Customer reaches the web site",
              "fromZone": "Internet",
              "toZone": "DMZ",
              "srcAddress": "198.51.100.7",
              "dstAddress": "203.0.113.10",
              "protocol": "tcp",
              "port": 443,
              "application": null,
              "userGroup": null,
              "encrypted": false,
              "carries": "none"
            }
          ],
          "attackSteps": [
            {
              "id": "A1",
              "label": "Password guessing over SSH",
              "techniqueIds": ["T1110", "T1021.004"],
              "lesson": "...",
              "fromZone": "Internet",
              "toZone": "DMZ",
              "srcAddress": "198.51.100.66",
              "dstAddress": "203.0.113.20",
              "protocol": "tcp",
              "port": 22,
              "application": null,
              "userGroup": null,
              "encrypted": false,
              "carries": "none"
            }
          ],
          "probes": [],
          "rival": {
            "name": "Rival firewall",
            "ruleBase": [
              { "ruleId": "R5", "controls": {} },
              { "ruleId": "R1", "controls": {} }
            ],
            "note": "Left SSH open to the whole Internet."
          },
          "referenceSolution": [{ "ruleId": "R1", "controls": {} }],
          "hints": ["Method hint.", "One worked step."],
          "sourceIds": ["sp800-41-4"]
        }
      }
    }
  ]
}
```

## Rules of the contract

- `schemaVersion` must be `1`.
- A rule field set to `null` means any. `services: null` means any protocol and port.
- `controls` on a rule lists only the controls that rule offers, each with its default state,
  for example `{ "threatInspection": true, "tlsDecryption": false }`. Control names are
  `threatInspection`, `tlsDecryption`, and `dnsFiltering`.
- `controls` on a rule base entry (rival, reference solution, or a player submission) gives the
  chosen state for each offered control. A control missing from the entry takes the rule's
  default.
- `startingRuleBase` lists rule IDs in order. Every rule in `rules` that is not in the starting
  rule base is an available card the player may add. In Expert challenges every rule starts in
  the rule base.
- `challenges.expert` may be omitted. The game then shows that Expert challenge as unavailable.
- The document holds no computed results: no rival score, no breach step, no expected outcome.
- No string in the document may contain a firewall vendor or product name.
- Level-specific text (briefings, request, labels, lessons, hints, notes) lives here. Sentences
  that name a deciding rule are generated from the engine result and do not appear here.

## Adding a challenge (SC-008)

Adding a level or a tier that uses existing rule fields and controls means adding an object to
this file and, in `tests/cases.js`, its hand-worked cases. No file under `engine/` or `ui/`
changes.
