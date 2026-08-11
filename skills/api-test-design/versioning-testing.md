# Versioning Testing

Covers dimension: Versioning (new — not previously a named dimension;
[[contract-analysis]] already extracted "Versioning signals" but no doc
consumed them).

## Applicability

`APPLICABLE` if [[contract-analysis]] extracted any of: a version segment in
the path (`/v1/...`, `/v2/...`), a `deprecated: true` flag on the endpoint,
migration notes in the description, or a sibling endpoint at a different
version for the same resource (visible via `relatedEndpoints[]`).

`NOT_APPLICABLE` if none of those signals exist — do not assume an
unversioned path (`/campaigns`) implies an unstated v1, and do not invent a
v2 that isn't in the registry/contract.

## Generation rules

- **Deprecated-endpoint call still works** — if `deprecated: true` is
  documented, one scenario confirming the endpoint still responds
  per its documented contract (deprecation alone doesn't imply removal
  unless a sunset date/behavior is documented).
- **Deprecation signal is surfaced** — if the contract documents *how*
  deprecation is signaled to callers (a response header, a warning field),
  one scenario asserting that signal is present. If deprecated but the
  contract doesn't say how callers are told, that's `NOT_DOCUMENTED`.
- **Old version still reachable after new version ships** — only if the
  registry documents both `vN` and `vN+1` of the same resource; one
  scenario per still-live old version confirming it responds (backward
  compatibility), not that it's necessarily identical to the new version.
- **Field additions are additive, not breaking** — if a newer version's
  contract adds a field the older version doesn't have, generate a
  scenario confirming the older version's request (without the new field)
  is still accepted by the older endpoint. Do not test the old client
  against the new endpoint unless the contract explicitly states
  cross-version compatibility — that would be inventing a compatibility
  guarantee no one made.
- **Field removal / breaking change flagged, not assumed safe** — if a
  newer version's contract is missing a field the older version required,
  record it as a breaking-change note in NOT_DOCUMENTED Areas (or Coverage
  Gaps) rather than a pass/fail scenario, since whether that's intentional
  isn't something this skill can determine from the contract alone.

## Explicit non-invention rule

Never assume semantic-versioning guarantees (that `v2` is backward
compatible with `v1`, that deprecated means "will be removed," or a sunset
date) unless the contract states them. A version number in a path is a
fact; everything about what that number *means* for compatibility must come
from documented text, not convention.

## Priority

Deprecated-endpoint-still-works and old-version-still-reachable: P1 (real
consumers depend on this not silently breaking). Deprecation-signal-present
and additive-field compatibility: P2. Breaking-change gap records: not
scenarios, filed under NOT_DOCUMENTED Areas / Coverage Gaps.
