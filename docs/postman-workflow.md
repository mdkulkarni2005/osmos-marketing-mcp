# Postman Workflow

How a company-format testcase workbook becomes a Postman collection +
environment. Implemented in `src/postman/`; conventions it follows live in
`knowledge/company/postman-conventions.md`.

## Pipeline

```
<Service>-API-Test-Suite.xlsx
        │  workbook-reader.ts
        ▼
TestcaseRow[] + read report (sheets skipped, non-executable rows w/ reasons)
        │  collection-builder.ts (+ request-builder, script-builder,
        │  folder-manager, variable-manager, endpoint-registry)
        ▼
PostmanCollection + list of variables actually used
        │  environment-builder.ts
        ▼
PostmanEnvironment (values empty, secret-typed where required)
        │  collection-validator.ts
        ▼
ValidationReport { passed, findings[] } — passed=false blocks execution
```

Nothing here calls a real API. This is the build/validate stage — see
`docs/local-execution.md` for what happens after `passed: true`.

## Running it

No real `SPA-API-Test-Suite.xlsx` exists in this project yet. Until
`api-test-design` + `company-testcase-format` produce one:

```bash
npm run postman:fixture   # writes generated/fixtures/SPA-API-Test-Suite.fixture.xlsx
npm run postman:dry-run   # reads it, builds, validates, writes generated/collections + generated/environments
```

Both commands run `tsc` first (`npm run build`) and require no credentials
— this is the BUILD_ONLY / VALIDATE_ONLY / DRY_RUN mode the home machine
uses. Once a real workbook exists, change `WORKBOOK_PATH` in
`src/postman/dry-run.ts` (or make it a CLI argument — not yet wired up) to
point at it instead of the fixture.

## What's generated vs. what's source

- **Source of truth**: the testcase workbook. Never hand-edit a generated
  collection/environment file — regenerate from the workbook instead.
- **Generated, gitignored**: everything under `generated/` (fixture
  workbooks, built collections, built environments, execution results).
  Regenerable on demand; not meant to be diffed in git.

## Rules the builders enforce (see `knowledge/company/postman-conventions.md` for the full rationale)

- One request per executable testcase row, named `[TC_ID] Test Scenario`.
- `Regression Suite` / `E2E Suite` root folders; Regression subfoldered by
  API Name (this project has no domain-theme grouping input yet — see
  `folder-manager.ts`), E2E subfoldered by sheet.
- No collection-level Postman `auth` block for this service — OSMOS uses
  dual `x-token`/`x-retailer-id` headers, not bearer auth; each request's
  headers come straight from the workbook's Request Headers cell.
- Every request must have at least one `pm.test` assertion — a request
  whose Expected Status Code and Expected Response are both undocumented
  fails collection validation rather than silently running unverified.
- No secret value is ever embedded — `token` is `secret`-typed with an
  empty placeholder in the generated environment; a literal value in an
  auth-sensitive header is a validator-critical finding.
- The `< 8000ms` response-time assertion from the SDA reference is
  config-gated, default **off** — see `RequestBuilderConfig` in
  `collection-builder.ts`.

## Not yet built

Local execution (Newman runner), execution result parsing, TC_ID-based
result reconciliation, and the Excel workbook updater. See
`docs/local-execution.md` for the intended design once that phase starts.
