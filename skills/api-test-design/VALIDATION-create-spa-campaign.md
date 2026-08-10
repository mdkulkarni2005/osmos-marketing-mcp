# Validation Run — create-spa-campaign

Purpose: prove the skill system in this directory works by applying it to a
real endpoint contract. **No API calls were made.** The contract was read
directly from `registry/endpoints/create-spa-campaign.json` and
`registry/service/service.json` in this repo, which stand in for "the
Documentation MCP" for this validation (no separate Documentation MCP exists
in this repository — see the caveat at the end of this file). Nothing below
is hardcoded skill knowledge; every row traces to those two JSON files.

**Revision note:** the first version of this file asserted coverage
percentages (47 generated / 41 post-dedup / 87%) without actually
enumerating the scenarios behind them, which violates this skill's own
`coverage-model.md` ("never fabricate a coverage percentage") and would
fail its own `qa-review` check #4. This version replaces that with a fully
enumerated scenario list; every number below is counted directly from the
tables in section 4.

## 1. Contract Summary

`POST /{advertiser_id}/sponsored_products/legacy/campaigns` — creates a SPA
campaign. Auth: `x-token` + `x-retailer-id` headers (service-level,
DOCUMENTED). Path param `advertiser_id` (integer, required). Body required,
top-level required fields: `name`, `campaign_start_date`, `budget_setting`
(with `budget_setting` itself requiring `max_limit`, `currency`). Two
response codes documented: `200` (DOCUMENTED_EXAMPLE only, no formal schema)
and `400` (status DOCUMENTED, body shape NOT_DOCUMENTED — example is `{}`).
Related endpoints sharing the same resource/hierarchy exist in this
registry: `list-spa-campaigns`, `get-spa-campaign-by-id`,
`update-spa-campaign` (same resource — stateful), and
`create-update-product-set-for-campaign`,
`create-update-positive/negative-keyword-settings-for-campaign`,
`create-update-category-bids-for-campaign`,
`save-campaign-network-settings`, `get-campaign-forecast` (all keyed on
`{campaign_id}` under the campaign created here — workflow).

## 2. Test Dimension Applicability

| Dimension | Status | Why |
|---|---|---|
| Contract/schema | APPLICABLE | full request schema documented |
| Functional/Positive | APPLICABLE | 200 response documented |
| Negative | APPLICABLE | 3 required fields (+2 nested), several constraints |
| Required-field | APPLICABLE | name, campaign_start_date, budget_setting, budget_setting.max_limit, budget_setting.currency |
| Optional-field | APPLICABLE | campaign_type, campaign_end_date, bidding_strategy, status, wallet_id, budget_setting.budget_type/daily_budget/budget_pacing/daily_budget_multiplier |
| Data-type | APPLICABLE | types documented on every field |
| Enum | APPLICABLE | campaign_type, budget_type, budget_pacing, bidding_strategy.type, status |
| Boundary | APPLICABLE (partial) | name.maxLength=130, daily_budget_multiplier min=1/max=2; no bounds on max_limit/daily_budget/value |
| Format | APPLICABLE | name.pattern, campaign_start_date/end_date format=date, "today or future" rule |
| Null | APPLICABLE | generic, all fields |
| Empty-value | APPLICABLE | string/object fields |
| Path-parameter | APPLICABLE | advertiser_id |
| Query-parameter | NOT_APPLICABLE | no query params on this endpoint |
| Header | APPLICABLE | x-token, x-retailer-id required (folded into Security, see [[security-testing]]) |
| Authentication | APPLICABLE | dual-header scheme documented |
| Authorization | NOT_DOCUMENTED | no scoping/ownership rule stated beyond header presence |
| Request validation | APPLICABLE | see Negative/Required-field |
| Response validation | APPLICABLE (weak) | 200 has example only, not schema — DOCUMENTED_EXAMPLE |
| Error validation | APPLICABLE (partial) | 400 status documented, body NOT_DOCUMENTED |
| Conditional/dependency | APPLICABLE | 6 rules extracted (section 3) |
| Stateful | APPLICABLE | CREATE→GET→UPDATE→GET via related endpoints in registry |
| Workflow | APPLICABLE — reclassified | registry documents 5 endpoints keyed on `{campaign_id}` (product_sets, keyword_settings ×2, category_bid_setting, network_settings, forecast); only the happy-path chain is enumerated in this pass, rest explicitly deferred (see section 4.14) |
| Idempotency | NOT_DOCUMENTED (behavior) — APPLICABLE (as exploratory probe) | no repeat-request behavior stated; scenario still generated per [[idempotency-testing]] |
| Duplicate-operation | NOT_DOCUMENTED (behavior) — APPLICABLE (as exploratory probe) | no uniqueness rule on `name` stated |
| Pagination | NOT_APPLICABLE | create endpoint |
| Filtering | NOT_APPLICABLE | create endpoint |
| Sorting | NOT_APPLICABLE | create endpoint |
| Robustness | NOT_APPLICABLE | every field either has a documented bound or is a scalar; no unbounded array/string field exists on this endpoint |
| Resource-consumption | NOT_APPLICABLE | same reason as Robustness |
| Concurrency candidates | APPLICABLE | mutating POST; flagged as a design-time candidate only, not executed |
| Property/invariant | APPLICABLE | campaign_end_date > campaign_start_date; id round-trip (counted under Stateful, not double-counted); max_limit-vs-spend excluded (not testable at create time) |
| Schema mutation | APPLICABLE | generation technique; every mutation-derived case is filed under its concrete dimension below, not counted separately |
| Security (OWASP) | APPLICABLE (mixed) | see Security Matrix, section 5 |
| Regression candidates | APPLICABLE | CREATE→GET chain, workflow chain |

## 3. Conditional Rules Extracted (dependency-testing)

1. `IF budget_setting.budget_type = LIFETIME_BUDGET THEN campaign_end_date required` — source: `campaign_end_date.description`
2. `IF budget_setting.budget_type = AVERAGE_DAILY_BUDGET THEN budget_setting.daily_budget required` — source: `daily_budget.description`
3. `IF budget_setting.budget_type = LIFETIME_BUDGET THEN budget_setting.daily_budget forbidden` — source: `daily_budget.description`
4. `IF budget_setting.budget_type = LIFETIME_BUDGET THEN budget_setting.daily_budget_multiplier forbidden` — source: `daily_budget_multiplier.description`
5. `IF bidding_strategy present THEN bidding_strategy.type required` — source: `bidding_strategy.description`
6. `IF bidding_strategy.type NOT IN (MAX_PERFORMANCE_CPC, MAX_PERFORMANCE_CPM) THEN bidding_strategy.value required` (else defaults to 1, only 1 allowed) — source: `bidding_strategy.value.description`
7. Invariant: `campaign_end_date > campaign_start_date` when both present — source: `campaign_end_date.description`

## 4. Enumerated Scenario Matrix (full — 115 generated, 2 merged in dedup, 113 final)

Each row is a real, concretely-constructed request (not a placeholder). `Pri`
= priority, `Ev` = evidence_type (`D`=DOCUMENTED, `DE`=DOCUMENTED_EXAMPLE,
`ND`=NOT_DOCUMENTED — applies to the *expected result* only, per the
request-side no-guessing rule in [[output-schema]]).

### 4.1 Functional/Positive (4)
| id | field | scenario | pri | ev |
|---|---|---|---|---|
| F1 | N/A | Minimum valid: name, campaign_start_date=today, budget_setting{max_limit:-1, currency:"INR"} | P0 | D |
| F2 | N/A | Full valid: all fields populated, budget_type=AVERAGE_DAILY_BUDGET, bidding_strategy{type:MANUAL_CPC,value:5} | P0 | D |
| F3 | wallet_id | Included with valid string | P2 | D |
| F4 | campaign_end_date | Included (optional) under AVERAGE_DAILY_BUDGET | P2 | D |

### 4.2 Required-field negative (14)
| id | field | scenario | pri | ev |
|---|---|---|---|---|
| RQ1–3 | name | missing / null / empty "" | P1 | D(input)/ND(body) |
| RQ4–6 | campaign_start_date | missing / null / empty "" | P1 | D/ND |
| RQ7–9 | budget_setting | missing / null / empty {} | P1 | D/ND |
| RQ10–11 | budget_setting.max_limit | missing / null (no "empty" — numeric) | P1 | D/ND |
| RQ12–14 | budget_setting.currency | missing / null / empty "" | P1 | D/ND |

### 4.3 Path-param / malformed / forbidden (4)
| id | field | scenario | pri | ev |
|---|---|---|---|---|
| PM1 | advertiser_id | non-numeric value in path | P1 | D/ND |
| PM2 | body | structurally invalid JSON | P2 | D/ND |
| PM3 | header | wrong content-type | P2 | D/ND |
| PM4 | body | extra unknown top-level property | P3 | ND |

### 4.4 Data-type mismatch, one per documented field (16)
| id | field | mismatch | pri | ev |
|---|---|---|---|---|
| DT1 | name | number instead of string | P1 | D/ND |
| DT2 | campaign_start_date | number instead of string | P1 | D/ND |
| DT3 | campaign_end_date | boolean instead of string | P2 | D/ND |
| DT4 | campaign_type | number instead of enum-string | P2 | D/ND |
| DT5 | budget_setting | string instead of object | P1 | D/ND |
| DT6 | budget_setting.budget_type | number instead of enum-string | P2 | D/ND |
| DT7 | budget_setting.daily_budget | string instead of number | P2 | D/ND |
| DT8 | budget_setting.max_limit | string instead of number | P1 | D/ND |
| DT9 | budget_setting.budget_pacing | number instead of enum-string | P2 | D/ND |
| DT10 | budget_setting.currency | number instead of string | P1 | D/ND |
| DT11 | budget_setting.daily_budget_multiplier | string instead of number | P2 | D/ND |
| DT12 | bidding_strategy | string instead of object | P2 | D/ND |
| DT13 | bidding_strategy.type | number instead of enum-string | P2 | D/ND |
| DT14 | bidding_strategy.value | string instead of number | P2 | D/ND |
| DT15 | status | number instead of enum-string | P2 | D/ND |
| DT16 | wallet_id | number instead of string | P2 | D/ND |

### 4.5 Null — optional fields only (required-field nulls already in 4.2) (11)
| id | field |
|---|---|
| NU1 | campaign_end_date |
| NU2 | campaign_type |
| NU3 | budget_setting.budget_type |
| NU4 | budget_setting.daily_budget |
| NU5 | budget_setting.budget_pacing |
| NU6 | budget_setting.daily_budget_multiplier |
| NU7 | bidding_strategy |
| NU8 | bidding_strategy.type |
| NU9 | bidding_strategy.value |
| NU10 | status |
| NU11 | wallet_id |

All P2, ev=ND (nullability undocumented for every field in this contract).

### 4.6 Empty-value — non-boundary, non-enum optional fields (2)
| id | field | pri | ev |
|---|---|---|---|
| EM1 | bidding_strategy = {} | P3 | ND |
| EM2 | wallet_id = "" | P3 | ND |

### 4.7 Enum (28)
| field | valid members | invalid | empty | pri (valid) | pri (invalid/empty) |
|---|---|---|---|---|---|
| campaign_type | SMART_SHOPPING, SEARCH_ONLY (2) | 1 | 1 | P2 (no dependency tied) | P1 |
| budget_type | AVERAGE_DAILY_BUDGET, LIFETIME_BUDGET (2) | 1 | 1 | P1 (drives 3 dependency rules) | P1 |
| budget_pacing | ACCELERATED, STANDARD, EVEN, FRONTLOAD, BACKLOAD (5) | 1 | 1 | P2 | P1 |
| bidding_strategy.type | MANUAL_CPC, MAX_PERFORMANCE_CPC, ROAS, MAX_PERFORMANCE_CPM, MANUAL_CPM (5) | 1 | 1 | P1 (drives value-required rule) | P1 |
| status | ACTIVE, PAUSED, DRAFT (3) | 1 | 1 | P2 | P1 |

Count: (2+1+1)+(2+1+1)+(5+1+1)+(5+1+1)+(3+1+1) = 4+4+7+7+5 = 27, plus one
case-sensitivity exploratory probe (`campaign_type: "smart_shopping"`,
P3, ev=ND — undocumented whether enums are case-sensitive) = **28 total**.

### 4.8 Boundary (6)
| id | field | value | pri | ev |
|---|---|---|---|---|
| BD1 | name | 130 chars (maxLength) | P1 | D |
| BD2 | name | 131 chars (maxLength+1) | P1 | D/ND |
| BD3 | daily_budget_multiplier | 0.99 (min-1 step) | P1 | D/ND |
| BD4 | daily_budget_multiplier | 1 (min) | P1 | D |
| BD5 | daily_budget_multiplier | 2 (max) | P1 | D |
| BD6 | daily_budget_multiplier | 2.01 (max+1 step) | P1 | D/ND |

### 4.9 Format (6)
| id | field | scenario | pri | ev |
|---|---|---|---|---|
| FM1 | name | contains `@` (violates `^[a-zA-Z0-9_\- ]+$`) | P1 | D/ND |
| FM2 | campaign_start_date | malformed separator `2026/08/10` | P1 | D/ND |
| FM3 | campaign_start_date | invalid date `2026-02-30` | P1 | D/ND |
| FM4 | campaign_start_date | yesterday's date (violates "today or future") | P1 | D/ND |
| FM5 | campaign_end_date | malformed separator | P2 | D/ND |
| FM6 | campaign_end_date | invalid date | P2 | D/ND |

### 4.10 Dependency (10 distinct; 2 duplicates merged into F2 — see dedup note)
| id | rule | scenario | pri | ev |
|---|---|---|---|---|
| DP1 | rule 1 | LIFETIME_BUDGET + campaign_end_date present & valid | P1 | D |
| DP2 | rule 1 | LIFETIME_BUDGET + campaign_end_date omitted | P1 | D/ND |
| ~~DP3~~ | rule 2 | AVERAGE_DAILY_BUDGET + daily_budget present *(identical shape to F2 — merged)* | — | — |
| DP4 | rule 3 | LIFETIME_BUDGET + daily_budget present anyway (forbidden) | P1 | D/ND |
| DP5 | rule 2 | AVERAGE_DAILY_BUDGET + daily_budget omitted (violates required) | P1 | D/ND |
| DP6 | rule 4 | LIFETIME_BUDGET + daily_budget_multiplier present (forbidden) | P1 | D/ND |
| DP7 | rule 4 (inverse) | AVERAGE_DAILY_BUDGET + daily_budget_multiplier=1.5 (valid) | P2 | D |
| ~~DP8~~ | rule 5 | bidding_strategy{type:MANUAL_CPC,value:5} *(identical shape to F2 — merged)* | — | — |
| DP9 | rule 6 | bidding_strategy{type:MANUAL_CPC} value omitted (violates required) | P1 | D/ND |
| DP10 | rule 6 | bidding_strategy{type:MAX_PERFORMANCE_CPC} value omitted (defaults to 1) | P1 | D |
| DP11 | rule 6 | bidding_strategy{type:MAX_PERFORMANCE_CPC, value:5} (only 1 allowed) | P1 | D/ND |
| DP12 | rule 5 | bidding_strategy present without `type` | P1 | D/ND |

Kept: DP1, DP2, DP4, DP5, DP6, DP7, DP9, DP10, DP11, DP12 = **10**.

### 4.11 Property/invariant (2)
| id | scenario | pri | ev |
|---|---|---|---|
| PR1 | campaign_end_date = campaign_start_date − 1 day (violates end>start) | P1 | D/ND |
| PR3 | Attempt to change `campaign_id` via update-spa-campaign | P2 | ND — immutability implied (system-assigned) but never explicitly stated |

(The id-round-trip invariant is verified as part of ST1 below, not
double-counted here — one scenario, one `coverage_dimension` tag, per
[[output-schema]].)

### 4.12 Stateful (3)
| id | scenario | pri | ev |
|---|---|---|---|
| ST1 | CREATE → GET by returned campaign_id → assert name/budget_setting round-trip | P0 | D |
| ST2 | CREATE → UPDATE (name) → GET → assert updated | P1 | D |
| ST3 | GET on a campaign_id that was never created | P2 | ND — no not-found behavior documented on get-spa-campaign-by-id |

### 4.13 Security (3 scenarios; OWASP classification in section 5)
| id | scenario | pri | ev |
|---|---|---|---|
| SC1 | Omit x-token | P0 | D(requirement)/ND(status code) |
| SC2 | Omit x-retailer-id | P0 | D/ND |
| SC3 | Create under advertiser A, GET with retailer-scope for advertiser B (BOLA probe) — precondition: requires two test-tenant fixtures | P1 | D(scoping implied)/ND(enforcement) |

### 4.14 Workflow (1 enumerated, rest explicitly deferred)
| id | scenario | pri | ev |
|---|---|---|---|
| WF1 | CREATE campaign → PUT product_set → PUT positive keyword settings → PUT category bids → PUT network settings → POST forecast, using the created campaign_id at each step | P0 | D |

**Deferred, not counted as covered:** missing-prerequisite, wrong-order,
invalid-state, intermediate-failure/recovery, repeat-operation variants
across these 5 downstream endpoints (per [[workflow-testing]]). Full
enumeration would require reading all 5 downstream endpoint contracts,
which is out of scope for this single-endpoint validation pass. Workflow is
therefore reported as **1/1 enumerated**, not extrapolated to a larger
implied total.

### 4.15 Concurrency candidate (1)
| id | scenario | pri | ev |
|---|---|---|---|
| CC1 | Two near-simultaneous CREATE requests with identical `name` — flagged as a candidate for a dedicated concurrency harness, not executed here | P3 | ND |

### 4.16 Idempotency / Duplicate-operation (2)
| id | scenario | pri | ev |
|---|---|---|---|
| ID1 | Send the identical CREATE request twice in a row | P1 | ND — repeat behavior undocumented |
| ID2 | Two CREATE requests with the same `name` under the same `advertiser_id` | P2 | ND — uniqueness undocumented |

### 4.17 Response (embedded, not separately counted — see [[response-testing]])
Response-status and response-field assertions ride on the scenarios above
rather than existing as separate rows (F1/F2 assert `200` + the
DOCUMENTED_EXAMPLE response fields; RQ*/DP*/FM*/BD* assert `400`, body
shape NOT_DOCUMENTED). Counted as 2 applicable items (the two documented
status codes), both covered by existing scenarios: **2/2**.

## Dedup summary

115 generated → **DP3** (AVERAGE_DAILY_BUDGET + daily_budget, valid) and
**DP8** (bidding_strategy MANUAL_CPC + value, valid) are byte-identical in
request shape to **F2**'s full valid request → merged into F2. **113 final
scenarios.**

## 5. Security Matrix (OWASP API Top 10)

| # | Item | Status | Scenario |
|---|---|---|---|
| 1 | BOLA | APPLICABLE | SC3 |
| 2 | Broken Authentication | APPLICABLE | SC1, SC2 |
| 3 | Broken Object Property Auth | NOT_DOCUMENTED | none — no field-level auth stated |
| 4 | Unrestricted Resource Consumption | NOT_APPLICABLE | no unbounded field on this endpoint |
| 5 | Broken Function Level Auth | NOT_DOCUMENTED | none — no role/permission distinction stated |
| 6 | Sensitive Business Flows | APPLICABLE | covered via RQ10/RQ11 (max_limit required — the documented spend safeguard) |
| 7 | SSRF | NOT_APPLICABLE | no outbound-URL field |
| 8 | Security Misconfiguration | NOT_DOCUMENTED | none |
| 9 | Improper Inventory Management | APPLICABLE, no scenario generated | endpoint path contains `/legacy/`; registry also has a newer non-legacy `sponsored_products/campaigns/*` family; contract doesn't state whether `/legacy/` implies deprecation — this is a **finding**, filed as a NOT_DOCUMENTED area (section 6), not fabricated into a pass/fail test |
| 10 | Unsafe Consumption of APIs | NOT_APPLICABLE | no documented outbound API call by this endpoint |

Applicable items: 4 (1, 2, 6, 9). Covered by a generated scenario: 3 (1, 2,
6). Item 9 is applicable but yielded a documentation finding rather than a
testable scenario — **Security coverage: 3/4 (75%)**.

## 6. NOT_DOCUMENTED Areas

- Error response body shape for `400` (only `example: {}`)
- Any status code other than 200/400 (401/403/404/409/429/500 all absent)
- Response headers
- Whether `name` must be unique per advertiser (duplicate-create behavior)
- Idempotency / repeat-request behavior
- Nullability of any field (not stated either way, anywhere in the schema)
- Authorization/ownership enforcement beyond header presence
- `budget_setting.max_limit`: only the `-1` sentinel and the "must exceed
  total spend since inception" rule are documented — the latter isn't
  testable at creation time since no prior spend exists yet; it becomes
  testable via `update-spa-campaign`, not here
- `budget_setting.currency` is listed as `required` **and** has a
  `default: "INR"` — the contract doesn't resolve whether omitting it is
  valid (default applies) or invalid (required means must-be-sent). Surfaced
  as a contract ambiguity, not resolved by guessing (RQ12–14 test the
  "treat as required" reading; if that's wrong, those three rows need
  re-evaluation once a human confirms the intended behavior)
- Response example's `bidding_strategy.type: "MAX_PERFORMANCE"` does not
  match the request enum (`MAX_PERFORMANCE_CPC`/`MAX_PERFORMANCE_CPM`/etc.)
  — flagged as a contract inconsistency, not silently reconciled
- `daily_budget` / `bidding_strategy.value`: no min/max documented, so no
  boundary cases generated for them (only presence/absence via dependency
  rules)
- `/legacy/` path segment coexisting with a non-legacy endpoint family for
  the same resource type, with no documented deprecation relationship
  (Improper Inventory Management finding, section 5)
- Full workflow dimension beyond the single happy-path chain (WF1) — would
  require analyzing all 5 downstream endpoint contracts

## 7. Coverage Report

Per [[coverage-model]]: `coverage = covered_applicable_items / total_applicable_items`,
counted directly from section 4's tables (not asserted).

| Dimension | Covered / Total | % |
|---|---|---|
| Functional | 4/4 | 100% |
| Required-field | 14/14 | 100% |
| Path-param / malformed / forbidden | 4/4 | 100% |
| Data-type | 16/16 | 100% |
| Null (optional fields) | 11/11 | 100% |
| Empty-value | 2/2 | 100% |
| Enum | 28/28 | 100% |
| Boundary | 6/6 | 100% |
| Format | 6/6 | 100% |
| Dependency | 10/10 | 100% (2 additional branches collapsed as duplicates of Functional, not as misses) |
| Property/invariant | 2/2 | 100% |
| Stateful | 3/3 | 100% |
| Security (OWASP-applicable) | 3/4 | 75% |
| Concurrency candidate | 1/1 | 100% |
| Idempotency/Duplicate | 2/2 | 100% |
| Response | 2/2 | 100% |
| Workflow | 1/1 **enumerated** — explicitly partial, not comparable to the others, excluded from pooled overall below | n/a |

**Pooled overall (sum of covered / sum of total, excluding Workflow):**
114 / 115 = **99%**

### Why this number is high, and what it does not mean

This 99% is coverage of **what this run itself classified as APPLICABLE**,
not coverage against an external ground truth. Every dimension the skill
judged applicable got a scenario in this pass, except one OWASP item
(Improper Inventory Management) that was deliberately turned into a
documentation finding instead of a fabricated test. That's why the number
is high — it reflects thoroughness of *this pass* against *this contract's
documented surface*, not defect-detection power, not code coverage, and not
completeness against the 9 NOT_DOCUMENTED areas in section 6, which sit
outside the denominator by design and can only be closed by getting real
answers from the API owner. The Workflow dimension is the honest
counter-example: it's APPLICABLE, and only 1 of what would clearly be a
larger set was enumerated in this pass — that gap is disclosed rather than
folded into the 99%.

## 8. Risk/Priority Summary (tallied from section 4, sums to 113)

| Priority | Count |
|---|---|
| P0 | 6 (F1, F2, ST1, WF1, SC1, SC2) |
| P1 | 61 |
| P2 | 41 |
| P3 | 5 |
| **Total** | **113** |

## Caveat on "Documentation MCP"

This validation used this repository's own registry JSON as the contract
source, since no separate Documentation MCP was available to query in this
session and — per your instruction — no request of any kind was sent to
this repository's MCP server (`server.mjs`) either; its endpoint JSON files
were only read directly from disk. The skill's actual runtime target is
whatever Documentation MCP resource/tool call the calling agent has
available (`get_endpoint_definition`-shaped, or equivalent) — nothing in
`skills/api-test-design/` hardcodes this repository's registry format or
this endpoint's fields; that's the whole point of feeding it a contract
rather than baking in knowledge.
