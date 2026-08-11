# Local Execution

Implemented in `src/execution/` (runner, result parser, preflight, Newman
integration) and `src/reconciliation/` (TC_ID mapper, workbook updater).
`src/postman/` (see `docs/postman-workflow.md`) is unchanged — this layer
only consumes its output (a validated collection + environment) and adds
execution, reconciliation, and the workbook write-back.

Fixture-only reconciliation tests for all eight required scenarios (PASS,
FAIL, BLOCKED, NOT_EXECUTED, unknown TC_ID, duplicate TC_ID, same-status
assertion failure, negative-testcase success) plus a workbook round-trip
test live in `src/execution/fixture-tests.ts` — run with
`npm run execution:fixture-test`. No Newman process and no network call are
involved; hand-built Newman-summary-shaped objects drive the parser and
reconciler directly.

## Two-machine constraint

- **Home machine**: builds and validates collections/environments only
  (`npm run postman:dry-run` today). No real credentials, no real API
  calls, nothing sent anywhere. This must keep working with zero
  dependency on the office machine.
- **Office machine**: runs the validated collection against the real API
  with real credentials, using a local Postman-compatible CLI runner
  (Newman). Execution results and any secrets stay on that machine.

The two machines never need to talk to each other. The only thing that
moves between them is the project's source (via normal git), never a
credential, environment file with real values, or execution log.

## Running it

Home machine (no credentials, no network):

```bash
npm run execution:fixture-test          # deterministic reconciliation fixtures A-H
node dist/execution/cli.js --mode=DRY_RUN
node dist/execution/cli.js --mode=BUILD_ONLY
node dist/execution/cli.js --mode=VALIDATE_ONLY
```

Office machine (real credentials, local only):

```bash
node dist/execution/cli.js --mode=RUN --confirm-run \
  --real-environment=/local/path/office-env.postman_environment.json
# optional selectors: --tc-ids=CSC_001,CSC_002 | --folder="Create SPA Campaign" | --failed-only | --blocked-only
```

`--real-environment` must point at a local, gitignored file with real
values — never the generated placeholder under `generated/environments/`,
and never committed. RUN refuses to start unless `--confirm-run` is passed,
validation passed, `base_url` and every variable the collection actually
uses are present, and the base URL doesn't look like production (override
with `--allow-production-url` if it's intentionally a prod-like host).
Results land in `generated/execution/` (`execution-results.json`,
`execution-summary.md`, `redacted-newman-report.json` — no secrets in any
of them) and, unless `--skip-workbook-update` is passed, get written back
into the same testcase workbook.

## Flow (office machine only)

```
generated/collections/<service>.postman_collection.json
generated/environments/<service>.postman_environment.json  (placeholder —
    real values supplied separately via --real-environment, never committed)
        │  runner.ts -> newman.run() (library call, in-memory summary —
        │  never the CLI, so nothing unredacted hits disk)
        ▼
Newman run summary (per-request: status, response, timing, assertion pass/fail)
        │  result-parser.ts
        ▼
Normalized ExecutionResult[] keyed by TC_ID (extracted from the [TC_ID]
    prefix in each request name via execution/tc-id.ts — the same regex
    collection-validator.ts uses, which already guarantees every request
    has exactly one TC_ID and every TC_ID appears exactly once)
        │  reconciliation/testcase-mapper.ts
        ▼
Workbook update: Actual Status Code, Actual Response, Status, Bug
    Description only — every other column (TC_ID, API Name, Method, TC
    Type, Test Scenario, Pre-Conditions, Request Headers, Request Body,
    Expected Status Code, Expected Response, Curl) left untouched.
```

## Execution modes

- `VALIDATE_ONLY` — build + validate, no run.
- `BUILD_ONLY` — build without validating (for inspecting output).
- `DRY_RUN` — build + validate, same as today's `npm run postman:dry-run`.
- `RUN` — execute locally via Newman. Refuses to start (see
  `execution/preflight.ts`) if `collection-validator.ts` reported any
  critical finding, `confirmRun` wasn't explicitly `true`, `base_url` or any
  variable the collection actually uses is missing/empty, or the base URL
  doesn't look like a test/staging/sandbox host and `allowProductionUrl`
  wasn't set.

Reconciling a prior result without re-running is the `postman_reconcile_results`
MCP tool / equivalent module call, not a fifth execution mode — it doesn't
touch Newman or the network at all.

## Status mapping

Uses the company vocabulary already modeled in `src/schemas/testcase.ts`
(`STATUS_VALUES`): `Not executed` / `Pass` / `Fail` / `Blocker` — not the
brief's initial PASS/FAIL/BLOCKED/NOT_EXECUTED/SKIPPED, since the company
skill's observed values take precedence per the project's own rule ("do not
invent a new status taxonomy if the company skill already defines one").
`SKIPPED` collapses to `Not executed`.

- A row whose request actually ran and whose assertions all passed → `Pass`.
- A row whose request ran and any assertion failed → `Fail`.
- A row that couldn't run for an environment/access/dependency reason
  (missing variable, auth failure not under test, unavailable dependency)
  → `Blocker`, with the actual reason recorded in Bug Description — never
  invented, and never marked `Fail` unless the API execution itself
  demonstrated a failure.
- A row intentionally left non-executable by the reader (e.g. rate-limit
  gated) and never attempted this run → stays `Not executed`.

## Rerun support

`execution/collection-filter.ts` filters the built collection by TC_ID set
in memory (never Newman's `--folder`, which only selects whole folders) —
whole collection, one folder/API (`--folder`), one or more explicit TC_IDs
(`--tc-ids`), or "failed only" / "blocked only" (`--failed-only` /
`--blocked-only`, resolved from the workbook's current Status column, never
row numbers). The same TC_ID stays stable across reruns; no workbook
regeneration is required. Known limitation: rerunning a single E2E step in
isolation loses its chain state from earlier steps and will fail
spuriously — not solved here, just surfaced.

## MCP tools

`server.mjs` exposes `postman_build_collection`, `postman_build_environment`,
`postman_validate_collection`, `postman_validate_environment`,
`postman_run_collection`, `postman_get_execution_results`,
`postman_reconcile_results`, `postman_update_workbook` — thin wrappers over
`src/execution/mcp-adapters.ts`, which itself only calls into
`runner.ts`/`preflight.ts`/`testcase-mapper.ts`/`workbook-updater.ts`. Only
`postman_run_collection` can execute a real request, and only with
`confirmRun: true`.
