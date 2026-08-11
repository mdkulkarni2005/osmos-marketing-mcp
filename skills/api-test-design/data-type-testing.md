# Data Type Testing

Covers dimensions: Data-type, Null, Empty-value.

## Applicability

`APPLICABLE` for every field with a documented `type`. Types considered:
string, integer, number, boolean, object, array, date, date-time, uuid, url,
email, enum (enum handled primarily in [[enum-testing]]; here only for
type-mismatch, e.g. sending a number where an enum-string is expected).

## Generation rules

For each documented-type field, send a value of a **different, clearly
mismatched** type:

- `string` field → send an integer, a boolean, or an object
- `integer`/`number` field → send a string (`"abc"`), a boolean, an array
- `boolean` field → send a string (`"true"`), a number (`1`)
- `object` field → send a string, an array, a plain scalar
- `array` field → send an object, a scalar

Pick **one** mismatch per field for the primary type-testing scenario
(P2) — don't fan out into every possible wrong type per field, that's
combinatorial bloat without added risk signal. If a specific wrong-type
value is separately relevant to a documented format or business rule,
generate it under that dimension instead ([[format-testing]],
[[dependency-testing]]) and skip it here to avoid duplication.

## Null testing

- `APPLICABLE` for any field, regardless of required/optional, since null
  handling is rarely fully specified.
- If the contract explicitly documents nullability (`nullable: true/false`),
  the scenario's `evidence_type` is `DOCUMENTED` and `expected_result` states
  the documented behavior.
- If nullability isn't documented, still generate the case (sending null is
  a legitimate, cheap probe) but set `expected_result: NOT_DOCUMENTED — behavior
  not specified by contract` and list the field in NOT_DOCUMENTED Areas.

## Empty-value testing

- Empty string (`""`) for string fields, empty object (`{}`) for object
  fields, empty array (`[]`) for array fields — only where not already
  covered as a boundary case in [[boundary-testing]] (e.g. if `minLength: 0`
  is documented, empty string is a *boundary* case, owned there; if no
  length constraint is documented at all, it's owned here as a plain
  empty-value probe).

## Nested fields

Applies unchanged to leaves inside an array-of-object/array-of-union field —
reach them via [[nested-traversal]]'s `container[*].leaf` path, generated
once against a representative item, not once per index. A wrong-type/null/
empty case on the *container itself* (the array or object field, not a leaf
inside it) is a separate scenario, defined in [[nested-traversal]]'s
container-level section.

## Priority

Type-mismatch on required fields: P1. Type-mismatch on optional fields: P2.
Null/empty on required fields: P1. Null/empty on optional fields: P2–P3.
