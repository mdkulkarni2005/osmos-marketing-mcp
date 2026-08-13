---
name: api-test-design
description: Generic, service-agnostic API test scenario design skill. Consumes an API contract from a Documentation MCP (or any authoritative contract source) and produces traceable, prioritized, coverage-reported test scenarios. Works for any REST/HTTP endpoint of any service/version — no hardcoded API knowledge.
---

# API Test Design Skill

## What this skill answers

**"What should I test?"** — nothing else. It does not decide how to write the
testcase (see [[company-testcase-format]]), and it does not judge whether the
output is good enough to ship (see [[qa-review]]).

## Hard boundary: this skill has zero built-in API knowledge

Every fact used to generate a scenario must come from the contract handed to
this skill (typically fetched live from a Documentation MCP). This skill must
never be edited to "know" that SPA campaigns have a `budget_setting` object,
that SDA works a certain way, or any other service-specific fact. If that
temptation arises, the fact belongs in the contract source, not here.

## No-guessing policy (mandatory, non-negotiable)

For every fact the skill needs, first check whether the contract documents it.

- If documented → use it, and tag the scenario's `evidence_type` as
  `DOCUMENTED` (formal schema/rule) or `DOCUMENTED_EXAMPLE` (only seen in an
  example payload/response, never asserted as a schema — see
  [[response-testing]]).
- If not documented → the dimension/field/value is `NOT_DOCUMENTED`. Report it
  in the "NOT_DOCUMENTED Areas" output section. **Never invent a value, limit,
  enum member, status code, error shape, or business rule to fill the gap.**
- If a scenario cannot be traced to a specific contract fact after generation,
  delete it before returning output. An untraceable scenario is worse than a
  missing one — it fabricates confidence.

This rule overrides every other instruction in this skill and its
sub-documents whenever they conflict.

## Workflow

1. **Fetch the contract.** Pull the endpoint definition (and, for workflow
   testing, related endpoints) from the Documentation MCP. Do not use cached
   or remembered knowledge of the service — always re-fetch, since contracts
   change.
2. **Contract analysis** — [[contract-analysis]]. Extract every fact listed
   there into a structured internal model. This is the only step allowed to
   read the raw contract; every later step reads the model, not the contract.
3. **Dimension applicability** — for each of the 36 dimensions below, classify
   `APPLICABLE`, `NOT_APPLICABLE`, or `NOT_DOCUMENTED` against the model from
   step 2. Do not run generation logic for a dimension marked
   `NOT_APPLICABLE` or `NOT_DOCUMENTED`.
3.5. **Scope budget** — before generating anything, compute an expected
   scenario band from the step-2 model, not from ambition:
   - 1 functional (happy path) per endpoint.
   - Per field: 1 required-missing (if required), 1 type-mismatch (if a type
     is documented), 1 boundary pair per documented numeric/string/array
     limit (not one per limit *and* one per near-limit — see
     [[boundary-testing]]'s own caps), 1 enum-invalid set (all valid values
     count as *one* enum dimension entry, not one scenario per value — see
     [[enum-testing]]), 1 format-invalid (if a format is documented).
   - Per documented dependency rule: 2 (satisfied + violated).
   - Per related endpoint: workflow scenarios per [[workflow-testing]]'s own
     scope, not one per possible ordering.
   - Robustness/concurrency/versioning: 1 scenario per applicable dimension
     unless the contract documents more than one distinct case.
   - **Security is budgeted separately, by [[contract-analysis]]'s risk
     tier, not by field count.** A low-field-count endpoint is not a
     low-risk endpoint — a 2-field login call is exactly the case that needs
     the *most* security depth despite having almost nothing to say about
     functional/boundary/type coverage. Use:
     - STANDARD tier: 1 scenario per applicable OWASP item, as today.
     - ELEVATED tier: the STANDARD set, plus BOLA/BFLA scoping checks are
       mandatory (not skipped even if the contract doesn't spell out
       scoping — auth-gated mutation implies it), plus one authorization-
       boundary case per distinct role/scope signal found.
     - CRITICAL tier: the ELEVATED set, plus [[security-testing]]'s
       injection/input-validation-depth checklist runs for every
       credential/identity/financial field found by the risk-signal
       extraction — this is where SQLi-shaped, NoSQLi-shaped, and
       parameter-tampering payloads belong, scoped to fields that plausibly
       reach a backend query/interpreter, never applied blanket to every
       string field on every endpoint.
   These two budgets are independent axes, not summed into one number: a
   CRITICAL 2-field login endpoint can legitimately land at ~4-6 functional/
   negative scenarios *and* 15-25 security scenarios — that's not runaway
   generation, that's the security budget doing its job. A STANDARD 2-field
   endpoint landing at 15-25 *security* scenarios, or a CRITICAL endpoint
   generating 15 near-duplicate *boundary* variations on a field with one
   documented limit, are both still overflow — cut those, not the risk-
   appropriate security depth.
   If a simple, STANDARD-tier endpoint's non-security scenario count is
   trending toward 50+, that's drifted into inventing variations the
   contract doesn't ask for — stop and re-check step 2, not step 4.
4. **Generate scenarios per applicable dimension**, using the matching
   sub-document. Every scenario is emitted in the shape defined in
   [[output-schema]]. Whenever a dimension document reaches a field that
   lives inside an array-of-object, array-of-union, or nested array (i.e. a
   field only reachable through an `arrayFields[]` entry from step 2, not
   through a plain dotted path), it hands traversal off to
   [[nested-traversal]] rather than hand-recursing — that doc owns path
   convention, depth capping, and the array-specific probes (partial-array-
   validity, container-level cases, union-item cases) that a flat dotted
   path can't express.
5. **Deduplicate** — [[deduplication]], checked against the running ledger
   during generation (step 4), not only as an end-of-run pass — see
   "Generation discipline" below.
6. **Prioritize** — [[prioritization]].
7. **Compute coverage** — [[coverage-model]].
8. **Assemble final output** in the structure below.

## Generation discipline (no repeats, no runaway/incomplete output)

- **One endpoint at a time, to completion.** Don't interleave partial work
  across multiple endpoints — finish an endpoint's full 8-step pipeline
  before starting the next. This keeps the working set bounded and is what
  makes the ledger in step 5 tractable.
- **Every dimension doc's fanout caps are hard stops, not suggestions.**
  [[data-type-testing]]'s "one mismatch per field," [[nested-traversal]]'s
  "one representative item, depth cap 3," [[enum-testing]]'s "skip case
  variation once case-sensitivity is documented" — when a cap is reached,
  move to the next field/dimension immediately. Do not keep generating
  "one more variation" past a stated cap; that's both the mechanism that
  produces repetitive test cases and a common cause of open-ended,
  never-finishing generation.
- **Each dimension runs once per field, per endpoint.** Do not re-visit a
  dimension already completed for a field "to double check" — if a gap is
  found later (e.g. during [[qa-review]]), fix it as a scoped addition, not
  by re-running the whole dimension again (which reintroduces duplicates the
  ledger already resolved).
- **Large scope gets chunked, not silently held.** If asked to cover many
  endpoints (e.g. a whole registry for [[workflow-testing]]), emit output
  per endpoint as it's completed, with a running count ("N of M endpoints
  done"), rather than accumulating everything before producing any output —
  a large, fully-silent generation pass is indistinguishable from a stalled
  one.
- **The quality gate (below) runs once, at the end, as a checklist.** A
  failed box gets a targeted fix, never a full restart of the pipeline.
- **The step-3.5 scope budget is a running check, not a post-hoc one.** If
  the count for an endpoint is already well past its band mid-generation,
  stop generating for that endpoint and go back to prioritization/dedup
  before continuing — don't finish the full 36-dimension sweep first and
  trim afterward. A small documented endpoint (e.g. a login/lookup call
  with 2-3 fields) producing hundreds of scenarios is not thoroughness, it's
  the discipline failing; cut to the highest-priority representative per
  (field, dimension) and move on.

## The 36 test dimensions

Contract/schema · Functional · Positive · Negative · Required-field ·
Optional-field · Data-type · Enum · Boundary · Format · Null · Empty-value ·
Path-parameter · Query-parameter · Header · Authentication · Authorization ·
Request validation · Response validation · Error validation ·
Conditional/dependency · Stateful · Workflow · Idempotency ·
Duplicate-operation · Pagination · Filtering · Sorting · Robustness ·
Resource-consumption · Concurrency candidates · Property/invariant ·
Schema mutation · Security · Regression candidates · Versioning

Sub-documents, one (or a shared doc) per cluster of dimensions:

| Doc | Dimensions covered |
|---|---|
| [[contract-analysis]] | contract extraction (feeds all dimensions) |
| [[functional-testing]] | Functional, Positive, Request validation |
| [[negative-testing]] | Negative, Required-field, Malformed request, Forbidden field/value |
| [[boundary-testing]] | Boundary (string/number/array limits) |
| [[data-type-testing]] | Data-type, Null, Empty-value |
| [[format-testing]] | Format (date, date-time, uuid, url, email, pattern) |
| [[enum-testing]] | Enum |
| [[dependency-testing]] | Conditional/dependency, invalid combination |
| [[stateful-testing]] | Stateful (single-resource lifecycle) |
| [[workflow-testing]] | Workflow (multi-endpoint), Regression candidates |
| [[response-testing]] | Response validation, Error validation, DOCUMENTED_SCHEMA vs DOCUMENTED_EXAMPLE |
| [[security-testing]] | Authentication, Authorization, Security (OWASP API Top 10) |
| [[robustness-testing]] | Robustness, Pagination, Filtering, Sorting, Idempotency, Duplicate-operation |
| [[concurrency-testing]] | Concurrency candidates |
| [[rate-limit-testing]] | Resource-consumption (rate/burst sub-area; the plain oversized-payload probe stays in [[robustness-testing]]) |
| [[versioning-testing]] | Versioning |
| [[property-testing]] | Property/invariant, Schema mutation |

Path-parameter, Query-parameter, Header testing are handled inline in
[[contract-analysis]] and folded into whichever of the above dimensions
applies to that parameter (e.g. a required path param → required-field logic
in [[negative-testing]]; an enum query param → [[enum-testing]]).

[[nested-traversal]] is not one of the 36 dimensions — it's a generation technique,
the same relationship [[property-testing]]'s mutation operators have to the
dimensions they land in. It supplies the *path* into array-of-object,
array-of-union, and nested-array fields that a flat dotted path can't reach;
the resulting scenarios are still filed under, prioritized by, and counted
toward whichever of the above dimensions actually owns the leaf
(negative-testing for a missing item field, boundary-testing for an
in-item numeric limit, etc.). Invoke it whenever step 2 produced an
`arrayFields[]` entry with `containerType` of `array-of-object`,
`array-of-union`, `array-of-array`, or `array-of-constrained-scalar`.

## Output structure (always, every endpoint)

For a multi-endpoint run, emit all 9 sections below **per endpoint**, in the
chunked, progressive order the "Generation discipline" section above
requires — chunking by endpoint is not an incomplete run, it's this
structure applied once per endpoint instead of held until every endpoint
finishes.

1. **Contract Summary** — endpoint, method, path, params, body shape,
   responses, what's documented vs not, in plain language, plus the
   [[contract-analysis]] risk tier (STANDARD/ELEVATED/CRITICAL) and the
   specific signal(s) that drove it.
2. **Test Dimension Applicability** — table of all 36 dimensions with
   APPLICABLE / NOT_APPLICABLE / NOT_DOCUMENTED and a one-line reason.
3. **Scenario Matrix** — every generated scenario in the [[output-schema]]
   shape.
4. **Workflow Matrix** — multi-endpoint scenarios, if any endpoints relate.
5. **Security Matrix** — OWASP API Top 10 checklist per [[security-testing]].
6. **NOT_DOCUMENTED Areas** — explicit list of every gap found, so a human
   can go get the missing facts (from real API behavior, docs team, etc.).
7. **Coverage Report** — per [[coverage-model]].
8. **Coverage Gaps** — dimensions below 100% and why.
9. **Risk/Priority Summary** — counts by P0–P3, per [[prioritization]].

## Quality gate (run before returning anything)

Every item must be checked and any failure fixed or explained before output
is returned:

- [ ] Every endpoint in scope was analyzed
- [ ] Every parameter (path/query/header) was analyzed
- [ ] Every required field has at least one negative "missing" scenario
- [ ] Optional fields were considered for inclusion/omission scenarios
- [ ] Every documented enum has full-value + invalid-value coverage
- [ ] Every documented constraint (min/max/length/pattern) has boundary coverage
- [ ] Negative cases exist for every dimension marked APPLICABLE
- [ ] Conditional/dependency rules are covered in both directions (satisfied + violated)
- [ ] Response rules (status codes, schema-vs-example) are covered
- [ ] Error cases are covered for every documented error response
- [ ] State transitions considered, if the resource has lifecycle states
- [ ] Workflow scenarios considered, if related endpoints exist
- [ ] Security dimensions classified (not skipped silently)
- [ ] Robustness dimensions classified (not skipped silently)
- [ ] Duplicates removed per [[deduplication]]
- [ ] Every `arrayFields[]` entry with `containerType` of `array-of-object`,
      `array-of-union`, `array-of-array`, or `array-of-constrained-scalar`
      was routed through [[nested-traversal]] (not silently left at
      array-level boundary/type coverage only)
- [ ] For each such array, a partial-array-validity probe exists (or its
      absence is explained — e.g. `maxItems: 1` makes it structurally
      impossible)
- [ ] Every mutating endpoint was classified for [[concurrency-testing]]
      (not silently skipped)
- [ ] Every endpoint was classified for [[rate-limit-testing]] and
      [[versioning-testing]] (not silently skipped)
- [ ] No two scenarios in the final matrix share the same `(endpoint,
      method, normalized_request_diff_from_baseline, expected_result,
      index-vs-[*] distinction)` ledger tuple per [[deduplication]]
- [ ] Every remaining scenario has a valid `evidence_type` and traces to a specific contract fact
- [ ] No invented constraints, enum values, limits, or business rules anywhere in the output
- [ ] Every `NOT_DOCUMENTED` case is listed in section 6, not silently dropped
- [ ] Coverage percentages were computed, not asserted
- [ ] Final scenario count was checked against the step-3.5 scope budget; any
      overflow was cut to the single highest-priority representative per
      (field, dimension) rather than left uncut — "more scenarios" is not a
      quality signal, "one scenario per documented fact" is
- [ ] [[contract-analysis]]'s risk tier was classified from actual risk
      signals (never guessed) and recorded with the signal(s) that drove it
- [ ] If the tier is ELEVATED or CRITICAL, [[security-testing]]'s
      tier-scaled checklist (mandatory BOLA/BFLA, injection/input-
      validation depth on flagged fields) was applied in full — a low
      field-count endpoint did NOT get a shrunk security section just
      because its functional/boundary scope budget was small

If any box can't be checked, fix the gap or state explicitly why it's out of
scope (e.g. "no related endpoints exist, so Workflow Matrix is empty by
design, not by omission").
