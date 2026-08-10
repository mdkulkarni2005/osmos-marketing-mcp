# Boundary Testing

Covers dimension: Boundary.

## Applicability

`APPLICABLE` only for fields where the contract documents at least one of:
`minimum`, `maximum`, `minLength`, `maxLength`, an array `minItems`/
`maxItems`. If none of these are documented for a field, boundary testing on
that field is `NOT_DOCUMENTED` — **do not invent a plausible limit.** A field
merely being numeric is not sufficient to generate boundary cases.

## Generation rules

**Numbers** (`minimum`/`maximum` documented):

- `minimum` (valid)
- `minimum - 1` (invalid, below range)
- a normal in-range value
- `maximum` (valid)
- `maximum + 1` (invalid, above range)
- `0`, if 0 is within or adjacent to the documented range and not already
  covered above
- negative value, only if the field's domain makes negative numbers a
  meaningful probe (e.g. a value that's documented to represent a count,
  spend limit, or multiplier) and the contract doesn't already document
  negative values as valid (e.g. a documented `-1` "no limit" sentinel is a
  *positive* case, not this one — check for that explicitly before assuming
  negative numbers are invalid)

**Strings** (`minLength`/`maxLength` documented):

- `minLength` (valid)
- `minLength - 1` (invalid; if `minLength` is 0 or absent, use empty string
  instead, coordinated with [[data-type-testing]] to avoid duplication)
- `maxLength` (valid)
- `maxLength + 1` (invalid)

**Arrays** (`minItems`/`maxItems` documented):

- empty array (`[]`) — only flag as boundary case if `minItems` is
  documented > 0; otherwise this belongs to [[data-type-testing]]'s
  empty-value handling
- `minItems`
- `minItems - 1`
- `maxItems`
- `maxItems + 1`

## Explicit non-invention rule

If only one bound is documented (e.g. `minimum` but no `maximum`), generate
only the cases for the documented bound. Do not assume a symmetric or
"reasonable" upper bound exists.

## Priority

At-bound (`minimum`, `maximum`) valid cases: P1 (they confirm the contract's
stated limit is actually accepted). Over/under-bound invalid cases: P1.
Interior normal values: P2.
