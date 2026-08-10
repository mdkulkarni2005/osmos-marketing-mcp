# Response Testing

Covers dimensions: Response validation, Error validation.

## The core distinction: schema vs. example

This is the most commonly violated rule in API test design, so it gets its
own document. **An `example` block in a contract is not a schema.** It shows
one instance of what a response looked like once — it does not assert that
every field is always present, that its type is fixed, or that no other
fields ever appear.

Classify every response fact as one of:

- `DOCUMENTED_SCHEMA` — the contract has a formal `schema` object for the
  response (types, required fields, etc.), separate from any example.
- `DOCUMENTED_EXAMPLE` — the field/value is only seen inside an `example`
  payload. Treat its presence, type, and value as illustrative, not
  guaranteed.
- `NOT_DOCUMENTED` — status code or field not mentioned at all.

If a contract provides only an `example` for a response (a very common
real-world case — e.g. a `200` response with an `example` block but no
`schema` key), **every field-level assertion derived from it must be tagged
`DOCUMENTED_EXAMPLE`**, and the Scenario Matrix / Response section of the
report must say so explicitly rather than presenting it with the same
confidence as a formal schema.

## Generation rules

**Status codes** — one scenario confirming each documented status code is
returned under the condition that documentedly produces it (success code
for the positive path, each documented error code for its corresponding
negative case — cross-reference [[negative-testing]] scenarios rather than
duplicating).

**Response schema** (`DOCUMENTED_SCHEMA` only) — assert required response
properties are present, and their types match. Do this only for fields
formally documented as schema; for `DOCUMENTED_EXAMPLE`-only fields, note
them separately as "observed in example, not asserted as guaranteed" rather
than writing a hard assertion scenario.

**Content type** — if the contract documents a response `contentType`,
assert it.

**Response headers** — only if documented; if the contract is silent on
response headers, that's `NOT_DOCUMENTED`, not an empty pass.

**Error structure** — if an error response's body shape is documented
(schema, not just `example: {}`), assert its shape. A documented error
status code with an empty/absent example (a very common pattern — status
"400: Bad request" with `example: {}`) means: the *status code* is
`DOCUMENTED`, but the *error body shape* is `NOT_DOCUMENTED`. Report both
facts separately — do not let the documented status code make the whole
error case look fully specified.

## Priority

Success status code + required response fields: P0–P1 (this is often the
main proof the operation actually did what it claims). Error status codes
matching negative scenarios: same priority as the negative scenario that
produces them. DOCUMENTED_EXAMPLE-only field checks: P2, explicitly labeled
lower-confidence.
