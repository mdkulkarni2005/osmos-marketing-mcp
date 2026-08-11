# Robustness / Pagination Testing

Covers dimensions: Robustness, Pagination, Filtering, Sorting, Idempotency,
Duplicate-operation. Concurrency candidates moved to
[[concurrency-testing]]; the rate/burst sub-area of Resource-consumption
moved to [[rate-limit-testing]] — both were single-paragraph flags here
before and needed real generation methodology, so they're now dedicated
docs. This doc keeps the plain oversized-payload probe.

## Applicability

Each sub-area is independently classified — don't blanket-apply all of them
to every endpoint.

### Pagination / Filtering / Sorting

`APPLICABLE` only if the contract documents pagination/filter/sort query
parameters on this endpoint (e.g. `page`, `limit`, `status` filter,
`sort_by`). Generate:

- valid page/limit values
- documented boundary on `limit` if a max is stated (owned jointly with
  [[boundary-testing]] — put the concrete boundary case there, reference it
  here)
- invalid page/limit (negative, zero if not documented as valid, non-numeric)
- filter by each documented filterable field/value
- invalid filter value
- documented sort fields, both directions if documented
- invalid sort field

If no pagination/filter/sort params are documented on this endpoint, mark
`NOT_APPLICABLE` — don't invent a `page` param the contract never mentions.

### Robustness / Resource-consumption

`APPLICABLE` for any field accepting variable-size input without a
documented hard maximum (e.g. an array with no `maxItems`, a string with no
`maxLength`). Generate one bounded "large but plausible test-safe" input
case (e.g. a few hundred array items, not millions) to probe for undocumented
limits — clearly mark `expected_result: NOT_DOCUMENTED — no maximum stated,
probing for undocumented server-side limit`. Never send payloads sized to
actually degrade a shared environment; this is a design-time scenario for
execution in an isolated test environment only.

### Idempotency / Duplicate-operation

See [[idempotency-testing]] for the full generation rules for both
dimensions — kept as a separate document because idempotency reasoning
recurs across create, update, and workflow-retry scenarios.

## Priority

Documented pagination/filter/sort boundaries: P1. Undocumented-limit probes:
P2–P3 (they surface real gaps but aren't asserting a known contract
violation).
