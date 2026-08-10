# Functional / Positive Testing

Covers dimensions: Functional, Positive, Request validation (happy-path
side).

## Applicability

Always `APPLICABLE` if the endpoint has a documented success response for at
least one request shape. `NOT_APPLICABLE` only if the endpoint is fully
deprecated with no documented success path.

## Generation rules

Generate, only where the contract supports each:

- **Minimum valid request** — every required field at its simplest valid
  value, every optional field omitted. This is the P0 core scenario.
- **Normal valid request** — a realistic full request using typical valid
  values across required and commonly-used optional fields.
- **Valid optional fields** — one scenario per optional field (or per
  logical group of related optional fields) showing it included with a
  valid value, to confirm it's accepted and, where response schema is
  documented, echoed back correctly.
- **Valid enum combinations** — for fields with a documented default vs an
  explicit enum choice, one scenario per meaningfully distinct enum value
  (coordinate with [[enum-testing]] to avoid duplication — this doc owns
  the *positive* framing, enum-testing owns exhaustive value+invalid
  coverage).
- **Valid nested objects** — for each documented nested object, at least one
  scenario with the nested object fully valid, and (if the nested object is
  itself optional) one scenario with it omitted entirely.
- **Valid workflow** — if the resource has documented lifecycle endpoints,
  one scenario chaining them in the documented order (owned jointly with
  [[stateful-testing]]/[[workflow-testing]]; this doc only emits the single
  create-time positive case, the chain lives in those docs).
- **Valid state transition** — if `status`/lifecycle values are documented
  on create or update, one scenario per documented initial state.

## What NOT to generate

- Do not invent a "typical" value for a field with no documented example,
  default, or constraint tight enough to derive one safely. If a required
  field has only `type: string` with no format/pattern/enum/example, use an
  obviously-valid arbitrary string and note in `scenario` that the value is
  arbitrary (not derived from a documented constraint) — still fine for
  positive testing, since correctness of *this* value isn't under test.
- Do not add optional fields "because they seem important" — only from the
  documented schema.

## Priority

Minimum valid request and normal valid request are P0. Individual optional
field / nested object positive checks are P2 unless a documented conditional
rule elevates them (see [[dependency-testing]]).
