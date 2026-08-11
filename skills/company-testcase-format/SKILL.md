---
name: company-testcase-format
description: Formats scenarios produced by api-test-design into the company's real QA testcase conventions (spreadsheet columns, TC_ID scheme, Postman naming/scripting), learned from actual SDA V2 reference artifacts and kept service-agnostic — never copies SDA's API fields/values into another service's testcase sheet.
---

# Company Testcase Format Skill

## What this skill answers

**"How should I write these test scenarios according to company
conventions?"** It takes the [[output-schema]]-shaped scenarios from
[[api-test-design]] and re-renders them as company-style testcase rows. It
does not decide what to test (that's [[api-test-design]]) and does not judge
quality (that's [[qa-review]]).

## Current status: learned from real company reference artifacts (SDA V2)

Real reference artifacts have been supplied and analyzed:

- `reference/AdsGroupV 2 (1).xlsx` — SDA V2 testcase spreadsheet (19 sheets,
  ~450 rows)
- `reference/SDAv2_regression_suite.postman_collection.json` — SDA V2
  Postman collection (114 requests)
- `reference/SDA V2 - Regression.postman_environment.json` — SDA V2 Postman
  environment (17 variables)

**These artifacts are NOT API truth for SPA or any other service.** They
were the colleague's example of *how the company writes and organizes
tests*, for a completely different service (SDA — Sponsored Display Ads
V2, not SPA). Every finding below is tagged so it's clear what's a
transferable convention vs. what's tied to SDA specifically:

- `COMPANY_CONVENTION` — a pattern repeated consistently enough across
  sheets/requests (usually near-universally) that it's safe to treat as a
  house rule. Transfers to SPA and any future service.
- `OBSERVED_PATTERN` — seen in the artifacts, plausibly intentional, but
  not consistent enough (or seen too few times) to promote to a hard rule.
  Use it as a reasonable default, but don't be surprised if a human QA
  overrides it.
- `SDA_SPECIFIC_RULE` — tied to SDA's own domain (its endpoints, its field
  names, its module abbreviations). The *shape* of the rule may transfer,
  the *values* never do.
- `NOT_DOCUMENTED` — the artifacts don't answer this question. Don't guess;
  flag it for human QA review when it first matters for a real service.

**Standing rule, from the original generic version of this skill, still in
force**: never copy SDA's API fields, endpoints, valid values, or business
rules into a testcase for a different service. Only the *format* — column
layout, ID pattern, naming style — transfers. The *content* of every cell
must come from [[api-test-design]]'s output for the service actually under
test.

**When artifacts from another service are supplied later**, treat them as
additional samples of the same company conventions: confirm or contradict
what's below, promote `OBSERVED_PATTERN` entries to `COMPANY_CONVENTION`
where a second artifact agrees, and note new `NOT_DOCUMENTED` gaps that get
resolved.

## Analysis checklist (re-run this whenever a new artifact set is supplied)

**Spreadsheet:** column names/order, testcase ID scheme, title style,
scenario/description phrasing, precondition format, steps format, request
body representation, expected-result phrasing, priority/severity scale, test
type taxonomy (compare to [[api-test-design]]'s 35 dimensions), status field
values, comments/notes conventions.

**Postman** (conventions only — generating Postman collections is a separate
future skill, not this one): collection/folder organization, request naming
pattern, environment variable naming, pre-request script conventions, test
script/assertion conventions, request chaining pattern.

**Postman environment:** variable naming/casing, variable typing
(`default`/`secret`/`any`), feature-gating flags. Never reproduce actual
secret values when documenting findings.

If any of the above can't be determined, mark it `NOT_DOCUMENTED` rather
than guessing. See the tagging legend above (`COMPANY_CONVENTION` /
`OBSERVED_PATTERN` / `SDA_SPECIFIC_RULE` / `NOT_DOCUMENTED`) — apply the same
discipline to any future artifact set, generalizing a company-wide rule only
when the artifact clearly demonstrates it, not from a single sample
testcase.

## Learned Conventions

### Spreadsheet structure

**One sheet per API operation**, named in PascalCase as `<Verb><Entity>`
(e.g. `CreateCampaign`, `EditAdGroup`, `GetAdGroup`, `PublishCampaign`,
`UnpublishAdGroup`, `DeleteAdsGroup`). 19 sheets in the sample, one per
endpoint of the service under test. `COMPANY_CONVENTION` — this held
without exception across all 19 sheets.

**Core columns, identical order, in all 19 sheets** (columns 1–15):

| # | Column | Notes |
|---|---|---|
| 1 | TC_ID | see ID scheme below |
| 2 | API Name | human operation name, repeated on every row even though it's implied by the sheet name/tab, e.g. "Create Campaign" |
| 3 | Method | HTTP verb, own column (not folded into scenario text) |
| 4 | TC Type | see taxonomy below |
| 5 | Test Scenario | short phrase/title, not a full sentence (see style below) |
| 6 | Pre-Conditions | short phrase, e.g. "Existing adgroup", "Valid advertiser_id and token" |
| 7 | Request Headers | inline, one header per line in the cell |
| 8 | Request Body | actual concrete JSON pasted in the cell, pretty-printed |
| 9 | Expected Status Code | numeric |
| 10 | Expected Response | short description OR literal expected error string for negative cases; full body only for functional/positive cases |
| 11 | Actual Status Code | filled in at execution time |
| 12 | Actual Response | filled in at execution time (full captured body) |
| 13 | Curl | complete, independently-runnable curl command — headers + body included |
| 14 | Status | run-result vocabulary: `Not executed` / `Pass` / `Fail` / `Blocker` (not "Blocked") |
| 15 | Bug Description | freeform, populated only when a defect was found; narrative referencing the specific observed behavior |

`COMPANY_CONVENTION` — all 15 held identically across all 19 sheets. This is
the strongest signal in the whole artifact set: **the testcase sheet is a
combined design doc + execution log**, not a design-only template. Expected
and Actual columns sit side by side for both status code and response body.

**Columns beyond #15 vary per sheet and are inconsistently present**:
`Severity`, `Dev Remarks` / `Dev remarks` / `Dev Remakrs`, `QA Remarks` /
`QA remarks`, `Assignee` / `Asssignee`, `Valid/Invalid`, `Fix`. Several
sheets instead have generic unused `Column N` headers. `OBSERVED_PATTERN`,
not a rule — these read as ad hoc defect-tracking columns different authors
added per sheet, with typos surviving uncorrected. Don't treat any of them
as required.

**No Priority column and no consistent Severity scale anywhere in the
sample.** `NOT_DOCUMENTED` — the company's priority/severity scale could
not be determined from this artifact (the `Severity` column exists on ~6/19
sheets but every sampled cell was empty). Do not invent a scale. Continue
reusing [[prioritization]]'s P0–P3 from the Generic Default until a real
priority/severity convention is observed.

**No separate "Test Steps" column.** `COMPANY_CONVENTION` (by omission) —
steps are implicit: build the Request Body shown, send it via the Method to
the endpoint, compare Actual vs Expected. This is unlike many generic QA
templates that number steps in their own column; the company's format
doesn't.

**Formatting/color-coding**: could not be reliably extracted (theme-based
Excel colors, not resolvable to fixed RGB via inspection). `NOT_DOCUMENTED`.

### Testcase ID scheme

Pattern: `<3-letter module/action prefix>_<3-digit zero-padded sequence>`,
restarting at `001` **per sheet**, not globally. `COMPANY_CONVENTION` — the
pattern (length-3 prefix, underscore, 3-digit sequence, per-module reset)
held on every sheet.

Observed prefixes — `SDA_SPECIFIC_RULE`, the values themselves are tied to
SDA's action set and do not transfer, only the *pattern* above does:
`CRT`=Create Campaign, `EDT`=Edit Campaign, `GET`=Get Campaign,
`RPT`=Campaign Report, `PUB`/`UNP`=Publish/Unpublish Campaign,
`DEL`=Delete Campaign, `CAG`/`EAG`/`GAG`=Create/Edit/Get AdGroup,
`PAG`/`UAG`=Publish/Unpublish AdGroup, `DAG`=Delete AdGroup,
`AGR`=AdGroup Report, `CRC`=Create Creative, `UCS`=Update Creative Status,
`GCR`=Get Creative, `TGT`=Create/Update Targeting, `GTG`=Get Targeting.
For SPA, prefixes must be derived fresh from SPA's own operations
(e.g. `create-spa-campaign` → `CSC` or similar — pick a 3-letter code and
keep it stable, don't reuse SDA's letters just because they look similar).

### TC Type taxonomy

Observed values across the whole workbook: `Functional`, `Negative`,
`Security`, `Rate Limit`, `E2E` (one stray `Nagative` typo — not a rule).
`COMPANY_CONVENTION` — a flat 5-value taxonomy, deliberately coarser than
[[api-test-design]]'s 35 dimensions. When transforming, map each of the 35
dimensions down to the nearest of these 5 (e.g. boundary/data-type/enum/
null/empty-value/format/required-field all become `Negative`;
authentication/authorization/injection become `Security`; stateful/workflow
chains become `E2E`; the rest of positive-path testing becomes
`Functional`). Keep the finer `category`/`subcategory` from
[[output-schema]] visible somewhere in the row (e.g. folded into the Test
Scenario text) so reviewers don't lose the distinction the company's coarse
taxonomy discards.

### Title / scenario writing style

`Test Scenario` cells are short phrases or fragments, not full sentences,
frequently with a parenthetical stating the specific value or reason:
`"Negative daily_budget (-10)"`, `"Name exceeding 130 characters"`,
`"LIFETIME_BUDGET without campaign_end_date (required)"`,
`"Invalid campaign_type value (FIXED)"`. `COMPANY_CONVENTION`. For GET
requests validating multiple things at once, the cell instead becomes a
short numbered checklist inside the same cell, e.g. `"1. Verify only
mandatory fields... 2. Verify adGroup under CPC campaign... 3. Verify freq
capping is disabled."` — `OBSERVED_PATTERN`, used specifically for
multi-assertion GET/verification scenarios, not for every scenario.

### Postman collection and environment conventions

Extracted in full into `knowledge/company/postman-conventions.md` — folder
structure (`Regression Suite` / `E2E Suite`), request naming
(`[TC_ID] description`), the `pm.test` script skeleton, chain-variable
naming, setup/cleanup pattern, collection-level pre-request script (env
mirroring + date engine), auth, and environment variable typing/casing/
feature-gating. That file is the single source of truth for these
conventions — read it there rather than duplicating it here; this section
exists only so a reader of this skill knows the material exists and where
it moved.

### What was intentionally excluded from this skill (SDA-specific)

The following are real, observed facts about the SDA V2 artifacts but are
**not** included as conventions above because they are API/business
content, not format — per the standing rule, they must never leak into a
different service's testcase sheet:
- SDA field names and structures (`budget_setting.daily_budget_multiplier`,
  `frequency_capping.rules`, `ad_inventories`, `bidding_strategy.type`
  enum values, etc.)
- SDA's actual endpoint paths, base URLs, and sample advertiser/retailer/
  wallet/creative-template IDs
- SDA's documented validation rules and error strings (e.g. "DAYS max 30",
  "budget_setting.max_limit is required")
- SDA's lifecycle/status model (`DRAFT → UNDER_REVIEW → ACTIVE → PAUSED →
  ARCHIVED`) and its specific state-transition rules
- The literal TC_ID prefixes and chain-variable names listed above under
  `SDA_SPECIFIC_RULE`

### Remaining ambiguities (NOT_DOCUMENTED / NEEDS_REVIEW)

- No company-wide Priority or Severity scale could be confirmed (column
  present on some sheets, always empty in the sample).
- No confirmed rule for environment-variable casing (mixed conventions,
  one duplicate).
- No evidence of whether plain Regression Suite requests get any cleanup;
  only E2E chains visibly self-clean.
- No visible color-coding/conditional-formatting convention (not
  extractable from the file as supplied).
- Whether the `[BUG]` request-name tag and the `Severity` column are meant
  to be linked to an external bug tracker (e.g. Jira ID) is not shown —
  `Bug Description` is freeform text only, no ticket-ID field observed.

## Company Testcase Format (apply this now, for SPA and any future service)

Derived from the Learned Conventions above. One sheet per API operation
under test, named `<Verb><Entity>` (e.g. `CreateSpaCampaign`). Columns, in
this order, one row per [[output-schema]] scenario:

| # | Column | Source / rule |
|---|---|---|
| 1 | TC_ID | `<3-letter prefix for this service+operation>_<seq, zero-padded 3 digits>`, sequence restarts at 001 per sheet. Derive the prefix fresh per operation (e.g. `create-spa-campaign` → `CSC`); never reuse SDA's prefixes. |
| 2 | API Name | Human operation name, repeated on every row (e.g. "Create SPA Campaign") |
| 3 | Method | `method` |
| 4 | TC Type | Map `category` (one of api-test-design's 35 dimensions) down to the company's 5-value taxonomy: `Functional` / `Negative` / `Security` / `Rate Limit` / `E2E` |
| 5 | Test Scenario | Short phrase derived from `scenario`, parenthetical for the specific value under test — not a full sentence |
| 6 | Pre-Conditions | `precondition`, rendered as a short phrase |
| 7 | Request Headers | Documented auth/content headers for the endpoint, one per line |
| 8 | Request Body | `test_data`, concrete pretty-printed JSON |
| 9 | Expected Status Code | Numeric status from `expected_result` |
| 10 | Expected Response | Short description or literal error string from `expected_result`; full body only for `Functional` rows |
| 11 | Actual Status Code | *(blank — filled in at execution time, not by this skill)* |
| 12 | Actual Response | *(blank — filled in at execution time)* |
| 13 | Curl | Full reproducible curl command built from Method + endpoint + Request Headers + Request Body |
| 14 | Status | `Not executed` (default for every newly generated row) |
| 15 | Bug Description | *(blank — filled in only if a defect is found during execution)* |

Do **not** add a Priority or Severity column by default — `NOT_DOCUMENTED`
in the reference artifacts (see Remaining Ambiguities). If the consuming
team asks for one, surface [[output-schema]]'s `priority` (P0–P3, from
[[prioritization]]) as an additional column rather than inventing a
different scale.

Keep `evidence_type` and `source` from [[output-schema]] available too —
even though they weren't observed as spreadsheet columns in the SDA sample,
dropping them silently would make it impossible for a reviewer to tell a
contract-backed row from an undocumented-behavior probe. Fold them into
"Bug Description" or an extra trailing column labeled `Source / Evidence`
if the team wants them visible; otherwise keep them as the row's internal
provenance metadata.

## Generic Default (fallback for anything not covered above)

Used only for fields the Learned Conventions section marks
`NOT_DOCUMENTED`, or if this skill is ever run against a service with no
company reference artifacts at all:

**Priority scale**: reuse [[prioritization]]'s P0–P3 directly; do not
translate into a different scale unless real company conventions require
it.

**Naming style fallback** (only if no TC_ID prefix can be derived):
`<Method> <Endpoint short name> - <scenario summary>`, e.g.
`POST create-spa-campaign - missing required field: name`.

This default is intentionally plain so it's trivial to diff against real
company conventions once supplied for a new service, and trivial to
bulk-reformat if that service's scheme differs from SDA's.

## Example: generic scenario → company testcase format

Input — a scenario from [[api-test-design]]'s [[output-schema]] for
`create-spa-campaign` (drawn from
`skills/api-test-design/VALIDATION-create-spa-campaign.md`, section 4.2,
row `RQ10`):

```yaml
scenario_id: SPA-CREATE-RQ-010
endpoint: create-spa-campaign
method: POST
category: Required-field
subcategory: missing
field: budget_setting.max_limit
scenario: "budget_setting.max_limit omitted from an otherwise-valid create request"
precondition: "Valid advertiser_id and token"
test_data: '{"name": "Campaign_Req_010", "campaign_start_date": "2026-08-11", "budget_setting": {"currency": "INR"}}'
expected_result: "400, body shape NOT_DOCUMENTED"
priority: P1
risk: "A required field silently accepted would let campaigns launch with an unbounded/undefined spend cap"
source: "budget_setting.max_limit.required=true (registry/endpoints/create-spa-campaign.json)"
evidence_type: DOCUMENTED (input) / NOT_DOCUMENTED (response body)
coverage_dimension: Required-field
```

Output — the same scenario rendered as one row in `CreateSpaCampaign`
sheet, using the Company Testcase Format above:

| Column | Value |
|---|---|
| TC_ID | `CSC_010` |
| API Name | Create SPA Campaign |
| Method | POST |
| TC Type | Negative *(Required-field maps to Negative in the company's 5-value taxonomy)* |
| Test Scenario | `budget_setting.max_limit missing (required)` |
| Pre-Conditions | Valid advertiser_id and token |
| Request Headers | `accept: application/json`<br>`content-type: application/json`<br>`x-retailer-id: <retailer_id>`<br>`x-token: <token>` |
| Request Body | `{"name": "Campaign_Req_010", "campaign_start_date": "2026-08-11", "budget_setting": {"currency": "INR"}}` |
| Expected Status Code | 400 |
| Expected Response | `budget_setting.max_limit is required (exact error body NOT_DOCUMENTED — contract only documents the 400 status, not the error shape)` |
| Actual Status Code | *(blank — filled in at execution)* |
| Actual Response | *(blank — filled in at execution)* |
| Curl | `curl --location 'https://<host>/{advertiser_id}/sponsored_products/legacy/campaigns' --header 'accept: application/json' --header 'content-type: application/json' --header 'x-retailer-id: <retailer_id>' --header 'x-token: <token>' --data '{"name": "Campaign_Req_010", "campaign_start_date": "2026-08-11", "budget_setting": {"currency": "INR"}}'` |
| Status | Not executed |
| Bug Description | *(blank)* |

Notes on the transformation:
- `category: Required-field` collapsed to the company's `Negative` TC Type
  — the finer distinction survives only in the Test Scenario wording
  ("missing (required)"), matching how SDA's own required-field negatives
  are worded (compare to the real SDA row: `"budget_setting.max_limit is
  required"`).
- The `NOT_DOCUMENTED` evidence_type on the response body was **not**
  dropped — it's carried into the Expected Response cell as an explicit
  caveat, the same way the skill's no-guessing policy requires elsewhere.
  This mirrors how the SDA sheet sometimes fills Expected Response with an
  error string and sometimes with a shorter description — the caveat makes
  clear which case this is.
- No SDA field names, values, or endpoints appear anywhere in the output
  row — every cell traces back to `create-spa-campaign.json`.
