---
name: cicd-integration
description: Wires this project's build/typecheck/fixture-test/dry-run/qa-review pipeline into CI (GitHub Actions, since this repo is hosted on GitHub) — safely, respecting the two-machine constraint from docs/local-execution.md. CI never runs real requests against a live API and never touches credentials.
---

# CI/CD Integration Skill

## What this skill answers

**"How do I get this pipeline running automatically on every push/PR?"**
It generates/maintains the CI workflow definition and decides what's safe to
run in CI versus what must stay a manual, credentialed, office-machine-only
step. It does not change what [[api-test-design]], [[company-testcase-format]],
[[qa-review]], or [[postman-test-implementation]] do — it only decides when
and where their outputs (and this repo's `npm` scripts) run automatically.

## Hard boundary: CI is the "home machine," always

`docs/local-execution.md` defines a two-machine constraint: a **home
machine** that builds/validates only, no credentials, no network calls to
the real API, and an **office machine** that runs real requests with real
credentials, kept local and never wired into git. CI is categorically a
home machine — it must never gain the ability to run `execution:run` (real
`RUN` mode) or see real credentials. If a task ever asks to "run the tests
in CI" meaning fire real HTTP requests at the live API, that request is
out of scope for this skill; redirect to the office-machine manual flow in
`docs/local-execution.md` instead of building it into CI.

## What CI should run, every push/PR

Only steps already proven safe by `docs/local-execution.md` and this
project's own `npm` scripts — nothing this skill invents:

1. `npm ci` (deterministic install from `package-lock.json`)
2. `npm run typecheck` — `tsc --noEmit`, catches source errors before build
3. `npm run build` — compiles `src/` → `dist/`; fails the job if `dist/`
   wouldn't be reproducible from source (this is also the mechanical fix
   for the "dist with no source" confusion this repo hit before both
   branches were reconciled — CI now guarantees `dist/` always traces to a
   committed `src/`)
4. `npm run execution:fixture-test` — deterministic reconciliation fixtures,
   no Newman process, no network (per `docs/local-execution.md`)
5. `npm run postman:dry-run` — builds and validates the collection/
   environment structurally, still no real API call
6. **[[qa-review]] gate** — if a testcase workbook changed in this PR, run
   the qa-review checklist against it (completeness, traceability,
   duplication, coverage arithmetic, nested-structure checks 14/15) and
   fail the job on any check this skill's verdict table calls `FAIL`

Never add a step that runs `execution:run` or passes `--confirm-run` in CI.
Never add a step that reads a `--real-environment` file in CI — that file
is explicitly gitignored and machine-local per `docs/local-execution.md`;
its absence in CI is correct, not a bug to work around.

## Workflow file conventions

- One workflow file per concern: a `ci.yml` for the steps above, triggered
  on `push` and `pull_request` against `main`.
- Pin the Node version to what `package.json`/`tsconfig.json` targets
  (`ES2022`/`NodeNext` — use a current LTS Node major that supports it, and
  state the exact version pinned rather than `latest`, so a Node release
  can't silently change build behavior).
- Cache `node_modules` keyed on `package-lock.json`'s hash, not on
  `package.json` alone (lockfile is the actual determinism guarantee).
- Job should fail fast on `typecheck`/`build` before spending time on the
  later steps — order steps 1–6 above in that sequence, don't parallelize
  `typecheck`/`build` with the steps that depend on `dist/` existing.
- Never echo or artifact-upload anything from `generated/` that could
  contain env-specific values beyond what `postman:dry-run` itself already
  writes (it writes placeholders only, per `docs/local-execution.md` — this
  skill does not need to re-derive that, just not defeat it by uploading
  something broader, e.g. a full workspace archive).

## What this skill must never do

- Never provision or reference real API credentials/secrets in a CI
  workflow — there is nothing in this pipeline's CI-safe scope that needs
  one.
- Never widen CI to run against a real environment "just this once" without
  the same `--confirm-run`, `base_url` production-check, and validation
  gates the office-machine CLI already enforces — CI does not get a
  shortcut around `docs/local-execution.md`'s safety preflight.
- Never invent a deployment/release step (this repo has no shipped
  artifact defined yet) — this skill's scope is test/build verification,
  not deployment; if deployment is asked for later, that's a distinct skill
  once there's a real target to deploy to.
