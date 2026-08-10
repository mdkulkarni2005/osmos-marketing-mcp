# Contract Analysis

Step 1 of [[api-test-design]]. This is the only step that reads the raw
contract from the Documentation MCP; every other document reads the
structured model produced here.

## Extraction checklist

Pull every one of these facts, if present, into a flat internal model. For
each fact, record its `evidence_type`:

- `DOCUMENTED` — asserted as a formal schema element (type, required, enum,
  min/max, pattern, described business rule in prose that reads as a rule,
  not just an example).
- `DOCUMENTED_EXAMPLE` — only appears inside an `example` payload/response,
  never asserted formally. Treat as weaker evidence — see
  [[response-testing]] for how this affects response assertions.
- `NOT_DOCUMENTED` — absent. Still record that you looked and found nothing;
  silence must be explicit, not an accidental omission.

Facts to extract:

- Endpoint id, name, method, path, deprecated flag
- Path parameters: name, type, format, required, description
- Query parameters: name, type, format, required/optional, default, enum
- Headers: name, required, description (including auth headers)
- Authentication/authorization scheme
- Request body: required?, content type, full schema tree (recurse into
  nested objects and arrays)
  - For every field: type, format, required/optional, default, nullable,
    enum, minimum/maximum, minLength/maxLength, pattern, description
  - Conditional/business rules stated in `description` fields — these are
    often prose, e.g. "Required when budget_type=LIFETIME_BUDGET" or
    "Forbidden when X". Extract them as structured
    `IF <condition> THEN <requirement>` facts for [[dependency-testing]].
- Response definitions per status code: description, content type, example,
  and — critically — whether a formal `schema` exists separate from the
  `example`. Do not treat `example` keys as guaranteed response fields.
- Error responses: which status codes are documented, and whether their body
  shape is documented or only exemplified (often `{}` — treat as
  NOT_DOCUMENTED body shape even though the status code itself is
  documented).
- Pagination, filtering, sorting parameters if present on this endpoint.
- Idempotency-relevant hints (idempotency-key header, documented
  "creating twice does X" behavior).
- Endpoint relationships: does the registry/index or contract mention
  sibling endpoints operating on the same resource (create → get → update →
  delete, or list → get-by-id)? These feed [[stateful-testing]] and
  [[workflow-testing]].
- Versioning signals (path version segment, deprecated flag, migration
  notes).

## Conditional-rule extraction pattern

Business rules are frequently embedded in field `description` strings rather
than structured JSON Schema `if/then`. Parse them into this normal form so
[[dependency-testing]] can consume them mechanically:

```
IF <field> <operator> <value>
THEN <target field> IS {required | forbidden | constrained-to <rule>}
SOURCE: <verbatim description text the rule was extracted from>
```

Only extract a rule if the description text actually states a conditional
("required when...", "forbidden when...", "only allowed if...", "defaults
to... if omitted"). Do not infer a conditional rule from field naming or
proximity alone — that would violate the no-guessing policy.

## Output of this step

A structured model (JSON-shaped in your working memory, not necessarily
written to a file) containing: `parameters[]`, `requestBodyFields[]` (flat,
with `path` like `budget_setting.daily_budget_multiplier`),
`conditionalRules[]`, `responses{}`, `relatedEndpoints[]`,
`notDocumented[]`. Every subsequent dimension document operates only on this
model.
