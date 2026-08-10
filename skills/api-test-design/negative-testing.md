# Negative Testing

Covers dimensions: Negative, Required-field, Malformed request, Forbidden
field/value (base cases; boundary/type/format/enum-specific negatives are
owned by their respective docs and cross-referenced here to avoid
duplication — see [[deduplication]]).

## Applicability

`APPLICABLE` whenever the endpoint has at least one required field, one
documented constraint, or a documented error response. `NOT_DOCUMENTED` for
the *expected error body shape* if the contract documents only the status
code (very common — see [[response-testing]]).

## Generation rules

For every field marked `required: true` in the contract model:

- **Missing required field** — omit it entirely from the request.
- **Null required field** — send `null` explicitly, only if the contract
  doesn't already forbid this via `nullable: false`/absence of null
  semantics being undocumented (if nullability isn't documented either way,
  still generate the case — sending null on a required field is a
  reasonable negative probe regardless — but mark the *expected result*
  `NOT_DOCUMENTED` if the contract doesn't say how nulls are handled).
- **Empty required field** — send `""` (string), `[]` (array), or `{}`
  (object) as applicable to the field's type.

For every field with a documented type/enum/pattern/range: delegate to
[[data-type-testing]], [[enum-testing]], [[format-testing]], and
[[boundary-testing]] respectively — do not duplicate here.

For path/query parameters:

- **Invalid path parameter** — wrong type (e.g. non-numeric where
  `type: integer` documented), or a value pointing at a resource that
  plausibly doesn't exist (only if the contract documents a
  not-found error response; otherwise the expected result is
  `NOT_DOCUMENTED`).
- **Invalid query parameter** — wrong type, or an undocumented value for a
  documented enum query param.

For headers:

- **Missing required header** (including auth headers if documented as
  required) — one scenario per required header.
- **Malformed header value** — only if the contract documents a format for
  that header.

**Malformed request** (body-level, not field-level):

- Structurally invalid JSON is a transport-level negative case, always
  `APPLICABLE` if the endpoint accepts a body — but treat it as `P2`/`P3`
  since it usually tests the framework, not the endpoint's business logic.
- Wrong content-type header, if `contentType` is documented.

**Forbidden field/value** — only when the contract explicitly documents a
field as forbidden under some condition (see [[dependency-testing]] for the
conditional form) or documents that unknown/extra properties are rejected.
If the contract is silent on whether extra/unknown properties are accepted
or rejected, that itself is a `NOT_DOCUMENTED` item — record it, and
optionally generate a P3 exploratory "extra unknown property" scenario with
`expected_result: NOT_DOCUMENTED`.

## Priority

Missing/null/empty on required fields: P1. Malformed transport-level cases
and unknown-property exploration: P2–P3.
