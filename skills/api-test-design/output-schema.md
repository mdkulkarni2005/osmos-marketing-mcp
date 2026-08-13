# Scenario Output Schema

Every scenario produced by any dimension document must be emitted in exactly
this shape. This is the contract between [[api-test-design]] and its
consumers ([[company-testcase-format]], [[qa-review]]).

```yaml
scenario_id: <stable id, e.g. "SPA-CREATE-BS-001">
endpoint: <endpoint id from the contract, e.g. "create-spa-campaign">
method: <HTTP method>
category: <one of the 36 dimension names>
subcategory: <finer label, e.g. "boundary.number.max+1">
field: <dotted field path this scenario targets, or "N/A" for endpoint-level.
  For a leaf inside an array-of-object/array-of-union field, use
  "container[*].leaf" for ordinary schema-level cases (type/boundary/enum/
  format/required, generated once against a representative item) and
  "container[0].leaf" / "container[-1].leaf" only for the
  partial-array-validity probe from [[nested-traversal]] — never emit
  per-index copies of an ordinary schema-level case.>
scenario: <one-line human description of what's being tested>
precondition: <state required before this request, or "none">
test_data: <the actual request shape/value used — concrete, not abstract>
expected_result: <documented status code + documented behavior; NOT_DOCUMENTED if the outcome itself isn't documented>
priority: P0 | P1 | P2 | P3
risk: <one-line why this matters if it fails>
source: <exact contract location the scenario traces to, e.g. "budget_setting.daily_budget_multiplier.maximum=2">
evidence_type: DOCUMENTED | DOCUMENTED_EXAMPLE | NOT_DOCUMENTED
coverage_dimension: <which of the 35 dimensions this counts toward>
```

## Rules

- `scenario_id` must be stable across regenerations for the same contract
  fact, so re-running the skill after a docs update produces a diffable
  scenario set, not a random one.
- `test_data` must be concrete (an actual value/payload), never a
  placeholder like `<invalid value>`. If a concrete value can't be produced
  without guessing (e.g. "invalid enum" but no sense of what a plausible
  invalid string looks like), use a self-evidently-wrong value like an empty
  string or a value with special characters, and say so in `scenario`.
  [[test-data-management]] owns *how* concrete filler/format/ID/date values
  are generated so the same kind of value is produced the same way across
  scenarios — dimension docs supply the shape (boundary/enum/type), that
  skill supplies the literal value.
- `expected_result` must cite the documented status/behavior. If the contract
  documents the status code but not the response body, say so
  (`400, body shape NOT_DOCUMENTED`) rather than guessing the shape.
- A scenario whose `evidence_type` would have to be `NOT_DOCUMENTED` for a
  **request-construction fact** (not just the expected result) must not be
  emitted at all — see the no-guessing policy in [[api-test-design]].
  `NOT_DOCUMENTED` evidence_type is only valid when the input side is
  grounded in the contract but the *expected outcome* is the undocumented
  part (e.g. we know sending an invalid enum is a valid negative test, but
  the exact error body isn't documented).
