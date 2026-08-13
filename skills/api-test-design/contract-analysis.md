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
  - For every field of `type: array`, additionally record: `containerType`
    (`array-of-scalar` if `items.type` is a primitive with no further
    constraints, `array-of-constrained-scalar` if the scalar item carries
    its own `pattern`/`minLength`/etc., `array-of-object` if `items.type ==
    object`, `array-of-union` if `items` is `oneOf`/`anyOf`, `array-of-array`
    if `items.items` exists), the `itemSchema` itself (verbatim, unrecursed —
    let [[nested-traversal]] do the recursion), and `depth` (1 for a
    top-level array, incrementing for arrays nested inside arrays/objects).
    Do not flatten array-of-object or array-of-union items into the flat
    dotted-path model — [[nested-traversal]] is the only step allowed to
    recurse into them.
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
  notes, sibling endpoints at a different version) — feeds
  [[versioning-testing]].
- **Risk signals**, for the risk classification below: field names/types
  that indicate credentials (`password`, `token`, `secret`, `otp`, `pin`),
  identity/PII (`ssn`, `email`, `dob`, `national_id`, `passport`), financial
  data (`amount`, `currency`, `card`, `account_number`, `iban`), or
  irreversible/high-value business effects (spend limits, budget commit,
  delete/cancel/refund operations); operationId/path/summary/description
  wording that names auth flows (`login`, `signin`, `signup`, `reset-
  password`, `verify`, `authorize`) or destructive/financial actions
  (`delete`, `charge`, `refund`, `transfer`, `payout`); and any field the
  contract itself marks sensitive (`format: password`, `x-sensitive: true`,
  or prose saying so). Record every signal found, verbatim, with its source
  field/text — this list is the *only* input to risk classification below,
  never a guess about what the endpoint "probably" does.

## Risk classification (feeds the security-dimension scope budget)

Using only the risk signals extracted above, assign one tier:

- **CRITICAL** — the endpoint handles credentials directly (login/password/
  token/OTP flows), or PII/financial data, or triggers an irreversible/
  high-value effect (payment, refund, transfer, account deletion).
- **ELEVATED** — the endpoint is auth-gated and mutates state or returns
  data scoped to a specific tenant/user (most create/update/delete
  endpoints on business resources), but doesn't itself touch credentials/
  PII/money.
- **STANDARD** — read-only or low-sensitivity endpoints with no risk
  signals found (e.g. a public lookup/reference-data GET).

Record which specific signal(s) drove the tier — "CRITICAL: operationId
contains 'login', field `password` present" — so the classification is
traceable, not asserted. If no signals are found at all, default to
STANDARD and say so explicitly; do not upgrade a tier on a hunch.

This tier is an *input to [[security-testing]] and the scope budget*, not a
new dimension itself — the 36 dimensions are unchanged.

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
with `path` like `budget_setting.daily_budget_multiplier`, for every field
reachable **without** an array index), `arrayFields[]` (one entry per
`type: array` field, carrying `containerType`, `itemSchema`, `depth` as
described above — these are deliberately left unflattened, for
[[nested-traversal]] to consume), `conditionalRules[]` (request-level only;
item-scoped rules are extracted separately, inside [[nested-traversal]], from
each `itemSchema`), `responses{}`, `relatedEndpoints[]`, `notDocumented[]`.
Every subsequent dimension document operates only on this model — dimension
docs read `requestBodyFields[]` directly; they read `arrayFields[]` only
through [[nested-traversal]], never by hand-recursing an `itemSchema`
themselves.
