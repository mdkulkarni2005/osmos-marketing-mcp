# Concurrency Testing

Covers dimension: Concurrency candidates.

Split out of [[robustness-testing]], which previously only *flagged*
mutating endpoints as concurrency candidates without a generation
methodology. This doc still does not execute anything — same boundary as
every other doc in [[api-test-design]] — it generates scenario *definitions*
that describe a race condition to probe for. Actually firing two requests
at the same time is an execution-layer concern; on this project that's
`src/execution/runner.ts` on the office machine (see `docs/local-execution.md`),
not this skill.

## Applicability

`APPLICABLE` for any endpoint that mutates shared state (`POST`/`PUT`/
`PATCH`/`DELETE`) where the contract implies a race would matter:

- two near-simultaneous updates to the **same resource** (last-write-wins?
  lost update? conflict response?)
- two near-simultaneous creates that might violate an **implied uniqueness
  rule** stated or reasonably inferable only from a documented uniqueness
  constraint (e.g. a documented unique field, not a guessed one)
- a create racing a delete of the same resource
- two near-simultaneous requests to an endpoint whose documented behavior
  depends on current state (e.g. a state-transition endpoint from
  [[stateful-testing]]) racing each other into conflicting transitions

`NOT_APPLICABLE` for read-only (`GET`) endpoints and for mutating endpoints
whose contract gives no reason to believe two calls interact (no shared
resource, no documented uniqueness rule, no state dependency).

## Generation rules

For each applicable race, generate **one scenario definition per race
shape** (do not fan out across every field combination — the race is about
timing and shared state, not about the field-level content, which
[[negative-testing]]/[[boundary-testing]]/etc. already cover):

- **Concurrent-update race**: two valid, differently-valued update requests
  to the same resource, both dispatched "at the same time" (defined for the
  execution layer as: fired without waiting for either response). Expected
  result: state the *documented* outcome if the contract specifies one
  (e.g. optimistic-locking header, `409 Conflict` on version mismatch); if
  undocumented, `expected_result: NOT_DOCUMENTED — contract does not state
  concurrent-update behavior (last-write-wins vs conflict vs lock)`.
- **Concurrent-create race** (only if a uniqueness constraint is
  documented): two create requests with the same uniqueness-driving value,
  fired concurrently. Expected: one succeeds and one gets the documented
  conflict response, or `NOT_DOCUMENTED` if the contract doesn't say what
  happens when both arrive within the same window.
- **Create/delete race**: a create and a delete of the same resource fired
  concurrently, only if both operations are documented for that resource.
  `expected_result` is almost always `NOT_DOCUMENTED` unless the contract
  explicitly addresses ordering.
- **State-transition race**: two different valid transitions from the same
  current state (per [[stateful-testing]]'s transition table) fired
  concurrently. Expected: only one transition should stick, or the contract
  documents both being applied in some order — flag `NOT_DOCUMENTED` if
  it's silent.

## Explicit non-invention rule

Never assume a locking strategy (optimistic/pessimistic), a conflict status
code, or "last write wins" — these are exactly the facts most contracts
leave undocumented, and this dimension exists to surface that gap, not
paper over it with a guessed default. The scenario itself (two concurrent
requests exist and are constructible from the contract) is always groundable;
the *outcome* is the part that's frequently `NOT_DOCUMENTED`.

## Priority

Concurrent-update/create races on a resource with a documented uniqueness
or locking rule: P1 (the rule itself has a stated behavior to verify).
Everything else (undocumented outcome, exploratory race shapes): P2–P3 —
real gaps worth surfacing, not confirmed contract violations.
