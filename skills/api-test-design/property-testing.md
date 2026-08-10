# Property / Invariant / Mutation Testing

Covers dimensions: Property/invariant, Schema mutation.

## Property/invariant testing

### Applicability

`APPLICABLE` only where the contract documents (or the request/response
relationship structurally implies, e.g. an id sent isn't applicable here
since ids are usually server-generated) an invariant that must hold across
request and response, or across a field pair. Do not invent business
invariants (e.g. "budget should never exceed some computed value") unless
the contract states the rule.

### Generation rules — examples of extractable invariants

- **Returned id matches created id** — if a resource is created and later
  fetched, the id in the GET response must equal the id returned by CREATE
  (feeds off [[stateful-testing]]'s CREATE→GET chain).
- **Immutable field does not change** — if the contract states a field is
  immutable/system-assigned (e.g. `campaign_id`), attempt to change it via
  UPDATE (if an update endpoint exists) and confirm it's rejected or
  ignored per documented behavior; if undocumented, `NOT_DOCUMENTED`.
- **Total equals component sum** — only if the contract documents such a
  relationship explicitly (e.g. a documented "max_limit must be greater
  than total spend since inception" rule — this is actually a
  [[dependency-testing]] conditional rule in disguise; classify by which
  doc owns the mechanic, not by dimension label, to avoid duplication).
- **start <= end** — for any documented paired date/number range fields
  (e.g. `campaign_start_date` / `campaign_end_date`, when the contract
  states `campaign_end_date` "must be greater than campaign_start_date").
  Generate: valid ordering, and the violating case (`end <= start`).
- **Response echoes request field values** — for fields the contract's
  response schema documents as echoed back, confirm the create response
  reflects what was actually sent (not just what's typical from an
  example) — respect the `DOCUMENTED_SCHEMA` vs `DOCUMENTED_EXAMPLE`
  distinction from [[response-testing]] when asserting this.

## Mutation testing (safe, design-time candidates only)

### Applicability

`APPLICABLE` for any endpoint with a documented request schema. This
dimension exists to systematically generate negative candidates by applying
a fixed set of mutation operators to a known-valid baseline request — it is
a *generation technique*, not a new category of business meaning, so
mutation-generated scenarios should be filed under whichever concrete
dimension they land in (missing field → [[negative-testing]], wrong type →
[[data-type-testing]], etc.) after generation, then deduplicated per
[[deduplication]].

### Mutation operators (apply to a valid baseline request)

- remove field (→ required-field testing if the field is required)
- null field (→ null testing)
- wrong type (→ data-type testing)
- invalid enum (→ enum testing)
- boundary mutation (→ boundary testing)
- malformed format (→ format testing)
- extra/unknown property (→ negative-testing's forbidden/unknown-property
  case)
- invalid nested property (recurse the same operators into nested objects)

### Hard limit

This is a **test-design** technique, not live fuzzing. Never execute these
mutations against a real API from within this skill — it only emits
scenario definitions for later human-approved execution.

## Priority

Invariant violations (immutability, start/end ordering, id mismatch): P0–P1
depending on whether the invariant is core to correctness. Mutation-derived
scenarios inherit the priority of whichever concrete dimension they're filed
under.
