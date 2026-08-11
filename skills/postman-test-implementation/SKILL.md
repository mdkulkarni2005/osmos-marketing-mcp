---
name: postman-test-implementation
description: Converts an approved company-format testcase workbook (from api-test-design + company-testcase-format) into one Postman collection and one Postman environment, using conventions learned from real company artifacts and this project's src/postman builders. Does not execute anything and does not decide what to test.
---

# Postman Test Implementation Skill

## What this skill answers

**"How do I convert an approved testcase into a Postman request?"** It runs
after [[company-testcase-format]] and [[qa-review]], and before local
execution (Newman) and result reconciliation — not yet built as separate
skills, see "Current status" below — in this workflow:

```
Documentation MCP → API Contract → api-test-design → company-testcase-format
   → qa-review → HUMAN APPROVAL → postman-test-implementation
   → (execution, not yet built) → (result reconciliation, not yet built)
```

This skill does not add or remove scenarios, does not judge quality, and
does not execute requests. It is a pure transform: workbook row → Postman
request.

## Conventions

All structural conventions (folder layout, request naming, `pm.test`
skeleton, chain-variable naming, environment variable typing) are learned
from real company Postman artifacts and live in
`knowledge/company/postman-conventions.md` — read that file, don't
re-derive it. As with [[company-testcase-format]], only the *shape*
transfers from the SDA reference artifacts; endpoint/field/business content
always comes from the Documentation MCP registry for the service actually
under test.

## Implementation

The conversion is implemented in `src/postman/`, not re-derived by hand
each time:

- `endpoint-registry.ts` — loads `registry/service/service.json` and
  `registry/endpoints/*.json`, indexed by both endpoint id and by the
  human `name` (matches the workbook's "API Name" column).
- `workbook-reader.ts` — reads every per-operation sheet in a
  company-format `.xlsx` (skipping `Summary`/`Endpoint Inventory`/
  `Coverage`) into typed `TestcaseRow`s, and determines per-row whether it
  can become a single executable request (a row can be legitimately
  non-executable — e.g. `TC Type = Rate Limit` behind the `runRateLimits`
  gate — without that being an error; the reader records why rather than
  dropping the row).
- `variable-manager.ts` — the one place `<placeholder>` (workbook) and
  `{path_param}` (OpenAPI) syntax become Postman `{{variable}}` syntax, and
  tracks which variables actually got used.
- `request-builder.ts` — one `TestcaseRow` + its matched `EndpointDefinition`
  → one Postman request item, named `[TC_ID] Test Scenario`.
- `script-builder.ts` — builds the `pm.test` script per the learned
  skeleton (status assertion always; response-time assertion **off by
  default**, config-gated — see the note in
  `knowledge/company/postman-conventions.md` about it being one service's
  observed pattern, not a confirmed company rule; body assertions only for
  a documented `Expected Response`, never invented for `NOT_DOCUMENTED`
  cells).
- `folder-manager.ts` — `Regression Suite` (subfoldered by API Name) /
  `E2E Suite` (subfoldered by sheet name) — see the file's own comment for
  why this project doesn't yet reproduce the reference artifact's
  numbered-domain-theme subfoldering (no domain-grouping input exists yet).
- `collection-builder.ts` / `environment-builder.ts` — assemble the full
  collection/environment, emitting only variables the collection actually
  references. No secret value is ever written — `token` is `secret`-typed
  with an empty placeholder.
- `collection-validator.ts` — the Phase 5 gate: every executable testcase
  must map to exactly one request; no unresolved path params; request
  bodies must be valid JSON; no header holds a literal instead of a
  `{{variable}}`. Critical findings must block execution
  (see [[postman-execution]]); a rate-limit-gated or E2E-chain-pending row
  is a warning, not a critical failure — it was never supposed to produce a
  request yet.

## What this skill must never do

- Never invent a chain-variable source field. If the endpoint's documented
  response schema doesn't name the property to extract for an E2E step,
  the generated script says so (`NOT_DOCUMENTED` / `NEEDS_REVIEW`) instead
  of guessing a property name.
- Never promote the `< 8000ms` response-time assertion to "on by default"
  for a new service without a second company artifact confirming it's a
  general rule, not an SDA-specific threshold.
- Never embed a real secret value in generated collection/environment JSON.
  `collection-validator.ts` treats a literal value in an auth-sensitive
  header as a critical finding.
- Never hand-edit a generated collection/environment file as the source of
  truth — regenerate from the workbook. See `docs/postman-workflow.md`.
- Never declare a Postman `auth` block on a service that doesn't use bearer
  auth just because the reference SDA collection does — see the note on
  auth in `knowledge/company/postman-conventions.md`.

## Current status

Phases 1–5 (conventions extraction, workbook reader, collection builder,
environment builder, validator) are implemented and proven end-to-end
against a small fixture workbook (`npm run postman:dry-run` — builds
`generated/fixtures/SPA-API-Test-Suite.fixture.xlsx`, then reads → builds →
validates it, with no credentials required). No real
`SPA-API-Test-Suite.xlsx` exists yet in this project — when
[[api-test-design]] + [[company-testcase-format]] produce one, point
`WORKBOOK_PATH` at it instead of the fixture.

Execution (local Newman runner) and result reconciliation (mapping run
results back to the workbook by TC_ID and updating Actual Status
Code/Actual Response/Status/Bug Description) are not yet implemented —
that's the next phase. Neither of those skills/modules exists in this repo
yet; don't reference them as if they do.
