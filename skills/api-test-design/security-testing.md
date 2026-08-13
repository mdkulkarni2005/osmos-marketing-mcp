# Security Testing

Covers dimensions: Authentication, Authorization, Security (OWASP API
Security Top 10).

## Three-way evidence classification (mandatory for every item below)

- `DOCUMENTED_SECURITY_REQUIREMENT` — the contract explicitly states a
  security behavior (e.g. "requires x-token and x-retailer-id on every
  request", "returns 401 if token invalid", "object ownership enforced by
  retailer_id scoping").
- `OBSERVED_COMPANY_SECURITY_PATTERN` — not asserted by this specific
  contract, but a pattern this skill has learned is standard practice in
  this company's other services/QA conventions (fed in via
  [[company-testcase-format]] reference material, never via assumption about
  this specific API). Use this classification sparingly and always label it
  as a pattern-based suggestion, not a confirmed requirement of the endpoint
  under test.
- `NOT_DOCUMENTED` — no contract statement and no known company pattern.
  Still list the checklist item; state plainly that applicability could not
  be determined from available sources.

## OWASP API Security Top 10 checklist (run for every endpoint)

For each item, classify `APPLICABLE` / `NOT_APPLICABLE` / `NOT_DOCUMENTED`,
using the evidence classification above to justify it:

1. **Broken Object Level Authorization (BOLA)** — applicable if the endpoint
   takes a resource id path param and the contract implies scoping (e.g. via
   `advertiser_id`/`retailer_id` headers). Safe test: call with a
   syntactically valid id that plausibly belongs to a different
   advertiser/retailer scope than the auth context — only generate this if
   it can be executed safely in an authorized test environment with test
   data, and only assert the documented behavior (e.g. 403/404), never
   assume a specific status code isn't documented.
2. **Broken Authentication** — applicable whenever auth headers are
   documented (here: `x-token`, `x-retailer-id`). Cases: missing token,
   missing retailer id, malformed token, both missing (already partially
   covered by [[negative-testing]]'s required-header cases — reference, not
   duplicate).
3. **Broken Object Property Level Authorization** — applicable if certain
   response/request fields are documented as restricted or role-gated. If
   the contract makes no field-level authorization distinctions,
   `NOT_DOCUMENTED`.
4. **Unrestricted Resource Consumption** — see [[robustness-testing]] for
   concrete scenarios (large payload, high pagination). Classify applicable
   only if the contract accepts variable-size input (arrays, pagination,
   free-text fields with no maxLength).
5. **Broken Function Level Authorization** — applicable if different HTTP
   methods/endpoints on the same resource imply different permission levels
   (e.g. GET vs PUT). Test: attempt a write operation with credentials that
   the contract implies are read-only, only if such a distinction is
   documented.
6. **Unrestricted Access to Sensitive Business Flows** — applicable for
   endpoints that create/spend budget or trigger irreversible business
   effects (e.g. campaign creation with real spend limits). Safe test:
   confirm the endpoint's documented safeguards (e.g. required max spend
   limit field) are actually enforced, not that they can be bypassed
   destructively.
7. **SSRF** — applicable only if the endpoint accepts a URL that the server
   will fetch/call back to (rare in this domain). `NOT_APPLICABLE` unless a
   field's description indicates the API will make an outbound call to a
   user-supplied URL.
8. **Security Misconfiguration** — applicable generically: verify documented
   content-type/CORS/error-verbosity behavior if documented; otherwise
   `NOT_DOCUMENTED`.
9. **Improper Inventory Management** — applicable at the service level, not
   per-endpoint: confirm the endpoint being tested is not a deprecated
   version served alongside a newer one without being flagged (`deprecated`
   field in contract).
10. **Unsafe Consumption of APIs** — applicable if this endpoint's contract
    documents that it calls out to another internal/external API on the
    caller's behalf; otherwise `NOT_APPLICABLE`.

## Injection & input-validation depth (CRITICAL-tier endpoints only)

Runs only when [[contract-analysis]]'s risk classification assigned
CRITICAL — never blanket-applied to every string field on every endpoint
(that's exactly the drift [[format-testing]] explicitly refuses to own).
For each field the risk-signal extraction flagged as credential/identity/
financial (e.g. `username`, `password`, `email`, `card_number`, any field a
login/lookup/search endpoint uses to build a backend query or match a
record), generate:

- One SQLi-shaped payload (e.g. `' OR '1'='1`, `'; DROP TABLE users;--`) —
  assert the *documented* safe behavior only (400/401/422 or a generic
  auth-failure response), never assert that an injection "was blocked" as a
  security claim; that's exploit confirmation, out of scope per Hard limits
  below.
- One NoSQLi/operator-injection-shaped payload if the field is a JSON body
  value that could plausibly reach a document-store query (e.g. `{"$ne":
  null}` in place of a string value) — only when the service's storage
  layer is unknown, still include it, since the *request* is what's being
  tested, not the backend implementation.
- One parameter-tampering case per identifier field the endpoint trusts to
  select a record (e.g. swapping a `user_id`/`account_id` path or body value
  for a syntactically valid but different value) — this overlaps BOLA
  above; file it under BOLA if a resource-id param already covers it, add
  here only for identifier fields BOLA doesn't reach (e.g. an identifier
  inside the request body rather than the path).
- Full input-validation sweep on every credential/identity field already
  covered generically by [[data-type-testing]]/[[boundary-testing]]/
  [[format-testing]] — reference those scenarios rather than duplicating,
  but confirm none were skipped for this field just because the field
  wasn't otherwise interesting (a `password` field with no documented
  minLength/maxLength/pattern still gets empty-string, oversized-string, and
  null-byte/control-character cases, since credential fields carry security
  weight independent of whether the contract documents a format rule).

Never invent a payload style beyond standard SQLi/NoSQLi/parameter-tampering
shapes; never target a field with no risk signal just because it's
CRITICAL-tier — the tier gates *which fields* get this depth, not *every*
field on that endpoint.

## Hard limits

- Never claim a vulnerability exists — this skill designs *test scenarios*,
  it does not perform or report exploit confirmation. A scenario's
  `expected_result` states the *documented* secure behavior; a QA engineer
  or automated run determines pass/fail later.
- Never generate destructive scenarios (real data deletion at scale, actual
  DoS payloads, credential brute-forcing). Payload-size/volume tests use
  bounded, clearly-test-environment-safe sizes.
- Every generated security scenario must be executable safely in an
  authorized test environment — if it can't be (e.g. it requires a second
  real tenant's live credentials that don't exist in test data), mark it
  `precondition: requires test fixture — <what's needed>` rather than
  fabricating credentials.

## Priority

Missing/invalid auth headers: P0. BOLA/BFLA scoping checks: P0–P1 (core
security risk for multi-tenant APIs). Remaining OWASP items: P1–P2 depending
on documented applicability.
