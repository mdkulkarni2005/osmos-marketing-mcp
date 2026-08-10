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
3. **Dimension applicability** — for each of the 35 dimensions below, classify
   `APPLICABLE`, `NOT_APPLICABLE`, or `NOT_DOCUMENTED` against the model from
   step 2. Do not run generation logic for a dimension marked
   `NOT_APPLICABLE` or `NOT_DOCUMENTED`.
4. **Generate scenarios per applicable dimension**, using the matching
   sub-document. Every scenario is emitted in the shape defined in
   [[output-schema]].
5. **Deduplicate** — [[deduplication]].
6. **Prioritize** — [[prioritization]].
7. **Compute coverage** — [[coverage-model]].
8. **Assemble final output** in the structure below.

## The 35 test dimensions

Contract/schema · Functional · Positive · Negative · Required-field ·
Optional-field · Data-type · Enum · Boundary · Format · Null · Empty-value ·
Path-parameter · Query-parameter · Header · Authentication · Authorization ·
Request validation · Response validation · Error validation ·
Conditional/dependency · Stateful · Workflow · Idempotency ·
Duplicate-operation · Pagination · Filtering · Sorting · Robustness ·
Resource-consumption · Concurrency candidates · Property/invariant ·
Schema mutation · Security · Regression candidates

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
| [[robustness-testing]] | Robustness, Resource-consumption, Concurrency candidates, Pagination, Filtering, Sorting, Idempotency, Duplicate-operation |
| [[property-testing]] | Property/invariant, Schema mutation |

Path-parameter, Query-parameter, Header testing are handled inline in
[[contract-analysis]] and folded into whichever of the above dimensions
applies to that parameter (e.g. a required path param → required-field logic
in [[negative-testing]]; an enum query param → [[enum-testing]]).

## Output structure (always, every run)

1. **Contract Summary** — endpoint, method, path, params, body shape,
   responses, what's documented vs not, in plain language.
2. **Test Dimension Applicability** — table of all 35 dimensions with
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
- [ ] Every remaining scenario has a valid `evidence_type` and traces to a specific contract fact
- [ ] No invented constraints, enum values, limits, or business rules anywhere in the output
- [ ] Every `NOT_DOCUMENTED` case is listed in section 6, not silently dropped
- [ ] Coverage percentages were computed, not asserted

If any box can't be checked, fix the gap or state explicitly why it's out of
scope (e.g. "no related endpoints exist, so Workflow Matrix is empty by
design, not by omission").
