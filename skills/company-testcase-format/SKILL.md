---
name: company-testcase-format
description: Formats scenarios produced by api-test-design into the company's QA testcase conventions (spreadsheet rows, Postman naming). Learns conventions from real company reference artifacts when supplied; otherwise falls back to a documented generic default and marks specifics NOT_DOCUMENTED.
---

# Company Testcase Format Skill

## What this skill answers

**"How should I write these test scenarios according to company
conventions?"** It takes the [[output-schema]]-shaped scenarios from
[[api-test-design]] and re-renders them as company-style testcase rows. It
does not decide what to test (that's [[api-test-design]]) and does not judge
quality (that's [[qa-review]]).

## Current status: no real company artifacts on file

As of the last review of this project, no company testcase spreadsheet,
Postman collection, or Postman environment file exists in this repository or
was supplied as reference. Rather than block, this document defines a
**generic, defensible default format**, built from common industry QA
spreadsheet conventions — clearly labeled as a default, not a company fact.

**When real company artifacts (testcase spreadsheet, Postman collection/
environment, from any service — e.g. SDA V2 or any other) are supplied**:

1. Analyze them using the checklist below.
2. Update the "Learned Conventions" section of this file with what was
   actually observed (column names, ID scheme, naming style, etc.), each
   tagged `OBSERVED_FROM: <artifact name>`.
3. Leave the "Generic Default" section intact below it, so the skill
   degrades gracefully for any future service that doesn't have its own
   reference artifacts yet.
4. **Never copy service-specific API behavior from the reference artifacts**
   (e.g. SDA's field names, SDA's valid values) into a testcase for a
   different service (e.g. SPA). Only the *format* — column layout, ID
   pattern, naming style, severity scale — transfers. The *content* of every
   cell must still come from [[api-test-design]]'s output for the service
   actually under test.

## Analysis checklist (run this when real artifacts are supplied)

**Spreadsheet:**
- Column names and order
- Testcase ID scheme (prefix pattern, numbering, per-module vs global)
- Title style (verb-first? feature-prefixed?)
- Scenario/description phrasing conventions
- Precondition format
- Steps format (numbered list vs single cell narrative)
- Request body representation (inline JSON? separate column? link to Postman?)
- Expected result phrasing conventions
- Priority scale used (P0–P3? High/Medium/Low? something else?)
- Severity scale, if distinct from priority
- Test type taxonomy (Functional/Negative/Boundary/... — compare to the 35
  dimensions in [[api-test-design]] and note where the company's taxonomy
  maps 1:1 vs where it's coarser/finer)
- Status field values (Not Run/Pass/Fail/Blocked/...)
- Comments/notes conventions

**Postman (conventions only — do not generate Postman collections yet,
that's a separate future skill):**
- Collection/folder organization (by endpoint? by workflow? by dimension?)
- Request naming pattern
- Environment variable naming (`{{base_url}}`, `{{x_token}}`, etc.)
- Pre-request script conventions (what do they typically set up —
  auth token refresh? variable chaining?)
- Test script/assertion conventions (status code checks? schema checks?
  variable extraction for chaining?)
- Request chaining pattern (how does one request's response feed the next
  request's variables?)

If any of the above can't be determined from the supplied artifacts, mark it
`NOT_DOCUMENTED` in the Learned Conventions section rather than guessing.

## Learned Conventions

*(Empty — populate this section when real company artifacts are supplied.
Until then, use the Generic Default below.)*

## Generic Default (use until real artifacts are supplied)

**Spreadsheet columns**, one row per scenario from the Scenario Matrix:

| Column | Source |
|---|---|
| Testcase ID | `<SERVICE>-<ENDPOINT_SHORT>-<CATEGORY_SHORT>-<seq>`, derived from `scenario_id` |
| Endpoint | `endpoint` |
| Method | `method` |
| Test Type | `category` (one of the 35 dimensions) |
| Title | short imperative phrase derived from `scenario` |
| Precondition | `precondition` |
| Test Data | `test_data`, rendered as compact JSON |
| Steps | 1) Send request with test data above 2) Observe response |
| Expected Result | `expected_result` |
| Priority | `priority` |
| Evidence Type | `evidence_type` (kept visible — this is a QA artifact, not just internal skill bookkeeping, so reviewers can see what's contract-backed vs undocumented) |
| Source | `source` |
| Status | `Not Run` (default for every newly generated row) |

**Naming style**: `<Method> <Endpoint short name> - <scenario summary>`,
e.g. `POST create-spa-campaign - missing required field: name`.

**Priority scale**: reuse [[prioritization]]'s P0–P3 directly; do not
translate into a different scale unless real company conventions require
it.

This default is intentionally plain so it's trivial to diff against real
company conventions once supplied, and trivial to bulk-reformat if the real
scheme differs.
