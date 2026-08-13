# Dependency / Conditional Testing

Covers dimension: Conditional/dependency (and the "invalid combination" part
of Negative testing).

## Applicability

`APPLICABLE` only for rules extracted in [[contract-analysis]]'s conditional-
rule extraction pattern — i.e. a description that literally states a
conditional ("required when...", "forbidden when...", "only allowed if...").
Do not infer a dependency from field grouping, naming similarity, or domain
assumptions.

## Rule shapes and required scenarios

For each extracted rule `IF <field> <op> <value> THEN <target> IS <requirement>`:

**IF A = X THEN B required**

- valid: A=X and B present with a valid value
- missing dependency: A=X and B absent
- (optionally) A≠X and B absent — should be valid if B is otherwise
  optional; only generate if it adds signal beyond [[functional-testing]]'s
  already-covered omission case

**IF A = X THEN B forbidden**

- valid: A=X and B absent
- forbidden dependency: A=X and B present anyway (expect rejection if the
  contract states rejection; if the contract only says "forbidden" without
  stating what happens if sent, `expected_result: NOT_DOCUMENTED — contract
  states forbidden but not enforcement behavior`)

**IF A exists THEN B required**

- valid: A present, B present
- missing dependency: A present, B absent

**IF A = X THEN C must satisfy Y** (value-shape dependency, e.g. "for
MAX_PERFORMANCE_CPC, value defaults to 1 and only 1 is allowed")

- valid: A=X, C=Y
- invalid: A=X, C≠Y (a value contradicting the documented constraint)

## Item-scoped rules

A conditional rule whose `IF` and `THEN` fields both live inside the same
array item schema (not the request body) is extracted and generated the
same way, but scoped with [[nested-traversal]]'s `[*]` path convention —
e.g. `create-update-category-bids-for-campaign`'s `category_bids[*].bid_value`
description states "Must be greater than 0 when is_active=true; must be null
when is_active=false", a genuine per-item rule. Extract only when the item
description literally states a conditional, never from field proximity. See
[[nested-traversal]]'s "Item-scoped conditional rules" section for
extraction mechanics.

## Cross-field default interaction

When a target field has both a `default` and a conditional forbidding it
under some condition, check whether the default itself would violate the
condition (e.g. a field defaults to a value that's only valid under
condition A, but the request sets condition B) — if the contract doesn't
explicitly resolve this, it's `NOT_DOCUMENTED` and should be listed rather
than assumed either way.

## Priority

All missing/forbidden/invalid-combination cases: P1 (dependency rules
usually reflect real business logic, so violations are meaningful).
Valid-dependency positive cases: P1 if a P0 happy path doesn't already cover
that branch, else P2.
