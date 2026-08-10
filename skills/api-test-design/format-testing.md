# Format Testing

Covers dimension: Format.

## Applicability

`APPLICABLE` only for fields where the contract documents a `format` (e.g.
`date`, `date-time`, `uuid`, `url`, `email`) or a `pattern` (regex). A string
field with no format and no pattern gets no format testing —
`NOT_DOCUMENTED`, not "assume it's free text so skip it silently"; record
that the absence was checked.

## Generation rules

For a documented `format: date` or `date-time`:

- valid format (correct case, already covered as positive in
  [[functional-testing]] — reference, don't duplicate)
- malformed format (wrong separators, e.g. `2026/04/01` instead of
  `2026-04-01`)
- invalid date (e.g. `2026-02-30`)
- invalid datetime (e.g. missing time component where date-time is
  required, or malformed offset)
- timezone variation, only if the field is `date-time` and the contract's
  example shows a specific offset convention (e.g. `+05:30`) — test an
  alternate valid-ISO offset (e.g. `Z`) to confirm whether the API's
  timezone handling is actually documented; if the contract doesn't state
  how timezones are normalized, mark `expected_result: NOT_DOCUMENTED`
- boundary format: for a `date` field documented as "must be today or
  future" (a business rule, not a pure format rule), also emit a
  yesterday-date case — cross-reference with [[dependency-testing]] since
  this is really a documented business constraint, not just a format
  constraint; keep in this doc only if the description ties it directly to
  format validity, otherwise move it there to avoid duplication

For `uuid`: malformed UUID (wrong length/dashes), valid UUID.

For `url`: malformed URL (missing scheme, invalid characters), valid URL.

For `email`: malformed email (missing `@`, invalid domain), valid email.

For a documented `pattern` (regex): a string that violates the pattern —
construct the violation directly from the documented regex (e.g. pattern
`^[a-zA-Z0-9_\- ]+$` → a string containing a character outside that class,
such as `@` or `#`). Never guess a pattern that isn't documented.

## Explicit non-invention rule

Do not apply generic "format testing" folklore (e.g. testing SQL-injection
style strings) to a field just because it's a string — that's
[[security-testing]]'s job under injection-adjacent OWASP items, and only
when applicable there. Format testing here is strictly about the documented
format/pattern being violated.

## Priority

Malformed/invalid format on required fields: P1. On optional fields: P2.
