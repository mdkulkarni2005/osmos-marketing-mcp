# Enum Testing

Covers dimension: Enum.

## Applicability

`APPLICABLE` only for fields with a documented `enum` array. Never infer an
enum's members from an example value alone — an example showing
`"status": "ACTIVE"` does not tell you `PAUSED` or `DRAFT` exist unless the
contract's `enum` list says so.

## Generation rules

For a documented enum with members `[V1, V2, ..., Vn]`:

- **Every valid enum value** — one positive scenario per member (unless the
  field also has a documented default and omission is already covered in
  [[functional-testing]] as the default-path case — don't duplicate the
  default value's explicit-inclusion case unless there's reason to believe
  explicit vs. default differs, e.g. the contract doesn't say they're
  equivalent).
- **Invalid enum** — a value not in the list (obviously wrong, e.g.
  lowercase of a valid value if the contract doesn't document
  case-insensitivity, or a plausible-sounding but undocumented member).
- **Empty value** — `""` sent for the enum field.
- **Missing value if required** — only if the field is `required`; if it has
  a documented `default`, omission is a *positive* default-path case, not a
  negative one — do not double-count it here (cross-reference
  [[functional-testing]]).
- **Case variation** — only meaningful, and only generated, if the contract
  says nothing about case-sensitivity (making it worth probing) — mark
  `expected_result: NOT_DOCUMENTED` since the contract doesn't state whether
  case matters. If the contract explicitly documents values as
  case-sensitive or case-insensitive, skip this — it's already answered, not
  a test gap.

## Nested fields

Applies unchanged to a documented enum on a leaf inside an array-of-object's
items — reach it via [[nested-traversal]]'s `container[*].leaf` path against
one representative item. If items are a `oneOf` union and the enum only
exists on one branch, generate the enum coverage only for item instances of
that branch (per [[nested-traversal]]'s union-item handling), not for items
shaped like the other branch.

## Cross-field enum interactions

If a conditional rule ties one enum's value to another field's
requiredness/forbiddenness (e.g. `budget_type=LIFETIME_BUDGET` forbidding
`daily_budget`), do not generate that combination here — it belongs to
[[dependency-testing]]. This doc only owns single-field enum mechanics.

## Priority

Every valid enum value: P1 if the field drives a documented conditional rule
elsewhere (its value changes what's required/forbidden), else P2. Invalid
enum / empty / missing-if-required: P1.
