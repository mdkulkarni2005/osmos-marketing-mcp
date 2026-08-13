# Company Postman Conventions

Source: `reference/SDAv2_regression_suite.postman_collection.json` (114
requests) and `reference/SDA V2 - Regression.postman_environment.json` (17
variables), analyzed alongside `reference/AdsGroupV 2 (1).xlsx` as part of
[[company-testcase-format]]. These are conventions extracted from a
colleague's **SDA (Sponsored Display Ads V2)** artifacts — a different
service. This file is the canonical, reusable extraction; do not re-derive
it from the raw reference JSON again, and do not maintain a second copy —
`skills/company-testcase-format/SKILL.md`'s "Postman collection conventions"
/ "Postman environment conventions" sections point here.

Tagging legend (same discipline as [[company-testcase-format]]):
- `COMPANY_CONVENTION` — consistent enough across the artifact to treat as a
  house rule. Transfers to SPA and any future service.
- `OBSERVED_PATTERN` — plausible, not consistent enough to be a hard rule.
  Reasonable default; a human QA may override it.
- `SDA_SPECIFIC_RULE` — the *shape* may transfer, the *values* never do
  (SDA endpoints, fields, IDs, variable names).
- `NOT_DOCUMENTED` — the artifact doesn't answer this. Don't guess.

**Standing rule**: never copy SDA's endpoints, fields, request bodies,
business rules, IDs, or SDA-specific variable names into another service's
collection. Only the *structural pattern* transfers. The actual SPA request
content must come from the Documentation MCP + the approved SPA testcase
workbook.

## Collection structure

Two root folders: `Regression Suite` and `E2E Suite`. `COMPANY_CONVENTION` —
state-independent checks are kept structurally separate from stateful
lifecycle chains.

**Regression Suite subfolders** are numbered by domain/workflow area, not
one-per-endpoint: `00_Setup_Lookups`, `01_Campaign_Budget_Bidding`,
`02_AdGroup_CRUD`, `03_Targeting`, `04_Reporting`,
`05_Critical_Negatives_Security`. `COMPANY_CONVENTION`: `NN_ThemeName`
numeric-prefixed folders grouped by feature area; a dedicated `00_` folder
holds shared read-only setup/lookup requests (not test cases themselves);
negative and security cases are pooled into one tail folder rather than
split per TC Type. The specific folder names (`Campaign_Budget_Bidding`,
etc.) are `SDA_SPECIFIC_RULE` — derive fresh theme names per service from
its actual domain areas.

**E2E Suite folders** spell out the literal state path being exercised,
e.g. `"Create Campaign - Create Adgroup - publish Adgroup [UR] - Creatives
Uploaded - Active Adgroup - Unpublish [paused] - DELETE"`, with nested
sub-folders for branching transitions (`UNDER_REVIEW → APPROVED`,
`UNDER_REVIEW → REJECTED`, `UNDER_REVIEW → DELETED`). `COMPANY_CONVENTION`
(the "spell out the path" pattern); the literal states are `SDA_SPECIFIC_RULE`.

## Request naming

`[<TC_ID>] <human description>` — the bracketed TC_ID must match the TC_ID
of the corresponding spreadsheet row exactly, so spreadsheet and collection
cross-reference by ID. `COMPANY_CONVENTION`.

Suffix/tag conventions:
- `_SETUP` suffix on requests that exist only to provision state for a later
  chained request, e.g. `[AG_E2E_SETUP] Create Campaign` —
  `COMPANY_CONVENTION`.
- `[BUG]` tag appended to a request tied to a known open defect, e.g.
  `[CRT_079][BUG] Missing x-token header` — `OBSERVED_PATTERN` (seen once,
  low-cost to carry forward).

## Test scripts (`pm.test`)

Every assertion title repeats the TC_ID: `pm.test("[<TC_ID>] <assertion
label>", ...)`. `COMPANY_CONVENTION`.

**Test script skeleton, repeated in effectively every request**
(`COMPANY_CONVENTION`), in this order:
1. Optional chain-variable save, prefixed with a `// [CHAIN]` comment tag,
   e.g. `pm.collectionVariables.set("cpc_cId", jsonData.result.id)`.
2. Status-code assertion:
   `pm.expect(pm.response.code).to.eql(<expected>)`.
3. Response-time assertion — `< 8000` ms, on every request including
   negative/error-path ones. **This is `OBSERVED_PATTERN`, not confirmed
   company-wide — it is one service's (SDA's) threshold. Do not hardcode it
   as a universal SPA requirement.** Treat it as a config toggle
   (`assertResponseTime: { enabled: boolean, maxMs: number }`), default
   **off** for a new service, until a second artifact confirms the value or
   the practice generally.
4. One or more property/type assertions on the parsed JSON body.
5. Trailing "retry tracking" boilerplate:
   `pm.collectionVariables.set("_lastStatus", pm.response.code.toString())`,
   then reset `_retryCount` to `"0"` unless status was `429`.

## Variable chaining

Response IDs are saved with short, scenario-specific names, not one reused
global — pattern `<shortScenarioTag>_<c|ag|...>Id`, e.g. `cpc_cId`,
`ag_bc_cId`, `ag_fc3_Id`, alongside generic ones (`campaignId`, `adGroupId`)
where only one instance is in flight. `COMPANY_CONVENTION`: name chain
variables for the producing scenario when multiple parallel Create-scenarios
need independently addressable IDs later in the same run; fall back to a
plain `<entity>Id` when only one instance is live. The exact names
(`cpc_cId`, etc.) are `SDA_SPECIFIC_RULE`.

**Never invent the response field a chained ID comes from.** If the
Documentation MCP / API contract doesn't identify the ID property in the
response schema, mark the chain step `NOT_DOCUMENTED / NEEDS_REVIEW` and do
not guess a property name.

## Setup / cleanup

No dedicated teardown folder or script. E2E chains self-clean by ending in a
`DELETE`/`Unpublish` request as their final step; `00_Setup_Lookups` is
read-only lookups (inventory IDs, template IDs), not create+delete
scaffolding. `OBSERVED_PATTERN`. `NOT_DOCUMENTED` whether plain Regression
Suite (non-E2E) requests get cleaned up at all.

Do not auto-generate destructive cleanup requests beyond what an E2E
workflow's own documented lifecycle already calls for.

## Collection-level pre-request script

`COMPANY_CONVENTION`, runs before every request:
1. Mirrors a fixed list of environment variables into collection variables
   — comment states "Source of truth = ENVIRONMENT"; collection variables
   are a resolved cache, not the source.
2. A shared "date engine" computes ISO-8601-no-milliseconds dates
   (`2026-06-11T15:32:00Z` style) from environment-configured offsets
   (`start_offset_days`, `campaign_duration_days`, `adgroup_offset_days`)
   rather than any request hardcoding a literal date.

## Item-level pre-request scripts

Exist on ~27% of requests, almost always either (a) a comment noting the
request relies on run-order chaining (no active code), or (b) a one-line
local variable override for a scenario needing exactly one different value
than the collection default, e.g.
`pm.variables.set("advertiserid", "10065130")` for a cross-advertiser
security test. `OBSERVED_PATTERN`: local override at item level is the
escape hatch for a single-scenario deviation.

## Auth

Auth declared once at collection level, inherited by every request rather
than repeated per-request. `COMPANY_CONVENTION` — but only that *pattern*
(declare once, let requests inherit). SDA's specific mechanism (Postman
`auth: bearer` with `{{token}}`) is `SDA_SPECIFIC_RULE`: it fits SDA because
SDA is bearer-token auth. A service with a different auth mechanism (e.g.
OSMOS's dual `x-token` + `x-retailer-id` headers, which aren't a Postman
`auth` type) cannot reuse the bearer block — and must not, since Postman's
`auth: bearer` unconditionally injects an `Authorization: Bearer` header
into every request, which would corrupt a test that specifically asserts
behavior when `x-token` is missing. For dual-header (or any non-bearer)
auth, carry the "declare once" spirit via a collection-level pre-request
script that sets the headers, or simply let each request's own headers
(sourced from the workbook) carry them — do not force a Postman `auth`
block onto an API that doesn't use bearer auth.

## Script comments

Bracketed, all-caps tag at the start of a comment line marks purpose —
`// [CHAIN] ...`, `// [SETUP] ...`. `COMPANY_CONVENTION`.

## Environment

**File naming**: `<Service> <Version> - <Suite name>.postman_environment.json`,
e.g. `SDA V2 - Regression`. `COMPANY_CONVENTION` (pattern transfers as
`<SERVICE> <VERSION> - <SUITE>`, e.g. `SPA V1 - Regression`).

**Variable typing**: plain config uses Postman's `default` type; the auth
token is `secret` type (masked in Postman UI). `COMPANY_CONVENTION` — carry
`secret` forward for any credential variable. Computed-at-runtime values
(dates) are typed `any` with an empty starting value, filled by the
pre-request date engine. **No token value, real or sample, is reproduced
anywhere in this file.**

**Naming casing**: mixed — mostly lowercase/snake_case (`retailer_id`,
`start_offset_days`) with camelCase exceptions (`walletId`,
`creativeTemplateId`) and one outright duplicate (`advertiserid` and
`advertiserId` both present). `NOT_DOCUMENTED` / `NEEDS_REVIEW` — no single
enforced casing rule. Pick one casing convention per new service's
environment and stay consistent within that file; snake_case is recommended
as the more common of the two observed styles.

**Feature gating**: expensive/optional test classes (e.g. rate-limit
probes) are gated behind a boolean environment variable (`runRateLimits`)
rather than always executing. `COMPANY_CONVENTION`.

## Excluded (SDA-specific, must never leak into another service's collection)

SDA field names/structures, SDA's actual endpoint paths/base URLs/sample
advertiser-retailer-wallet-template IDs, SDA's documented validation rules
and error strings, SDA's lifecycle/status model, the literal TC_ID prefixes
and chain-variable names above tagged `SDA_SPECIFIC_RULE`.

## Remaining ambiguities

- Whether plain Regression Suite (non-E2E) requests get any cleanup —
  no evidence either way.
- Whether the response-time assertion (`< 8000ms`) is a company-wide rule
  or SDA-specific — treat as configurable, default off, until a second
  artifact confirms it.
- Environment variable casing — no enforced rule.
- Whether the `[BUG]` tag links to an external tracker (Jira ID) — not
  shown; `Bug Description` in the spreadsheet is freeform text only.
