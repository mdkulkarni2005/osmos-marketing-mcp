# Robustness / Resource / Concurrency / Pagination Testing

Covers dimensions: Robustness, Resource-consumption, Concurrency candidates,
Pagination, Filtering, Sorting, Idempotency, Duplicate-operation.

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

### Concurrency candidates

`APPLICABLE` for any endpoint that mutates shared state (POST/PUT/PATCH/
DELETE) where a race condition would matter (e.g. two near-simultaneous
updates to the same resource, two simultaneous creates that might violate an
implied uniqueness rule). This skill only *flags* these as candidates for a
dedicated concurrency test harness — it does not generate literal concurrent
execution instructions (that's an execution-layer concern, out of scope for
test *design*).

### Idempotency / Duplicate-operation

See [[idempotency-testing]] for the full generation rules for both
dimensions — kept as a separate document because idempotency reasoning
recurs across create, update, and workflow-retry scenarios.

## Priority

Documented pagination/filter/sort boundaries: P1. Undocumented-limit probes
and concurrency candidates: P2–P3 (they surface real gaps but aren't
asserting a known contract violation).
