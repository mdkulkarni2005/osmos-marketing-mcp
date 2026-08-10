# Workflow Testing

Covers dimensions: Workflow, Regression candidates.

## Applicability

`APPLICABLE` only when multiple endpoints are documented as forming a
business process wider than single-resource CRUD (e.g. campaign creation →
product-set assignment → keyword settings → forecast, as distinguishable
from [[stateful-testing]]'s narrower single-resource lifecycle). Evidence:
the service's documented hierarchy/relationship notes (e.g. a
`hierarchy`/prompt doc in the Documentation MCP), or explicit
cross-references between endpoint descriptions. Do not invent a workflow
ordering from path similarity alone.

## Generation rules

- **Happy path** — the full documented sequence executed in order, each
  step's output feeding the next step's required input (e.g. created
  `campaign_id` used as the path param for subsequent calls).
- **Missing prerequisite** — attempt a downstream step without its
  documented prerequisite existing (e.g. set keyword settings for a
  `campaign_id` that was never created) — only if the downstream endpoint's
  contract documents a not-found/prerequisite-missing error; otherwise
  `expected_result: NOT_DOCUMENTED`.
- **Wrong order** — perform steps out of the documented sequence, only when
  the contract implies an order dependency (e.g. "product set must exist
  before category bids can reference it" style language). If no ordering
  constraint is documented, don't fabricate one — the steps may be
  independent, which is itself worth noting as `NOT_DOCUMENTED: ordering
  constraint (if any) not specified`.
- **Invalid state** — perform a downstream step while the resource is in a
  documented state that should block it (requires [[stateful-testing]]'s
  status enum to be documented).
- **Intermediate failure** — one step in the chain fails (e.g. invalid
  payload on step 2); assert step 1's result is unaffected, only if the
  contract implies steps are independent transactions (most REST hierarchies
  are); if transactionality/rollback isn't documented, mark
  `NOT_DOCUMENTED`.
- **Recovery** — retry the failed step with a corrected payload, confirm the
  chain can proceed.
- **Repeat operation** — re-run a non-idempotent step to see documented
  behavior (cross-reference [[robustness-testing]]'s idempotency section to
  avoid duplication).
- **Cleanup** — only if a delete/deactivate endpoint is documented for the
  resource.

## Regression candidates

Any workflow scenario that touches multiple endpoints is a natural
regression-suite candidate — tag these explicitly in `risk` (e.g. "chains 3
endpoints; regression suite candidate") so [[company-testcase-format]] and
downstream Postman generation can group them into a collection folder.

## Priority

Happy path chain: P0. Missing prerequisite / wrong order / invalid state: P1.
Intermediate failure / recovery: P1–P2. Repeat operation / cleanup: P2.
