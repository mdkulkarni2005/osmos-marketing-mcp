# Risk Prioritization

Every scenario in the Scenario Matrix gets exactly one priority: `P0`, `P1`,
`P2`, or `P3`.

## Rules of assignment

- **P0** — critical happy path (the single primary positive scenario for the
  endpoint); destructive operations (delete, cancel, irreversible state
  change); critical state transitions (e.g. campaign creation itself, since
  everything downstream depends on it); critical authorization checks (can a
  caller act on a resource they don't own, where documented); core business
  operation the endpoint exists to perform.
- **P1** — required-field validation; documented dependency/conditional rule
  checks (both satisfied and violated directions); boundary cases on
  documented limits; authorization edge cases beyond the P0 core check;
  negative cases judged materially likely (malformed auth, missing required
  nested object); important documented workflow steps.
- **P2** — normal field/type/format coverage not already elevated by a rule
  above; response detail assertions (field presence/type on
  `DOCUMENTED_SCHEMA` fields); additional negative cases beyond the primary
  ones (secondary invalid enum values, etc.).
- **P3** — robustness/exploratory cases (large payload, pagination edges,
  concurrency candidates) where the contract doesn't assert a hard limit;
  low-risk format variations; anything whose failure would be surprising but
  not damaging.

## Business criticality

This skill has **no access to business criticality** (revenue impact, SLA
commitments, customer tiers) unless the contract itself documents it (rare,
but e.g. "this endpoint powers the billing cycle" in a description would
count). Do not invent criticality from field names or gut feel.

When a scenario's priority would benefit from business context the skill
doesn't have, assign the priority from the *technical* risk rules above and
add a note in `risk`:

```
risk: "Technical risk: violates documented immutability of campaign_id. Business criticality NOT_DOCUMENTED — recommend human QA lead confirm P0 vs P1."
```

Never silently upgrade or downgrade a scenario based on assumed business
importance.
