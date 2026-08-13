# Rate Limit Testing

Covers dimension: Resource-consumption (rate/burst sub-area).

Split out of [[robustness-testing]], which kept only the plain
oversized-payload probe (still owned there). This doc generates scenario
*definitions* for burst/rate behavior — it does not fire real traffic; that
belongs to the execution layer (`src/execution/runner.ts`, office machine
only, per `docs/local-execution.md`). Never generate a scenario here sized
to actually degrade a shared environment — this is a design-time
definition for later execution in an isolated test environment.

## Applicability

Two tiers — don't collapse them:

- **Threshold-grounded** — `APPLICABLE` when the contract documents rate-
  limiting behavior for this endpoint or service (a documented `429`
  response, `Retry-After`/`X-RateLimit-*` headers, or prose stating a
  request-per-window limit). Generates the full threshold scenarios below,
  with concrete `expected_result`s.
- **Exploratory-gated** — `APPLICABLE` for any endpoint at all (the company
  convention observed in `knowledge/company/postman-conventions.md`, from
  real reference artifacts, is that a `TC Type: Rate Limit` row exists per
  service regardless of whether a threshold is documented, gated behind a
  runtime flag rather than behind contract documentation — see
  `src/postman/workbook-reader.ts`'s `runRateLimits` gate). When no
  threshold is documented, still generate **one** exploratory burst
  scenario per endpoint: a bounded, test-safe repeated-request sequence
  (same order of magnitude as [[robustness-testing]]'s undocumented-limit
  probe — a few hundred, not millions), `expected_result: NOT_DOCUMENTED —
  no rate limit documented; probing whether one exists`, and
  `category`/output tagged so [[company-testcase-format]] maps it to
  `TC Type: Rate Limit` behind the same `runRateLimits` gate as any
  threshold-grounded case. This is the one dimension where "no documented
  number" does not mean "no scenario" — the probe's existence is itself
  the company convention, only the asserted *outcome* stays ungrounded.

## Generation rules

For a documented limit (e.g. "100 requests per minute per token"):

- **Single request, under limit** — positive baseline (usually already
  covered by [[functional-testing]]'s happy path; don't duplicate, just
  reference it).
- **Burst at the documented threshold** — a defined sequence of N requests
  within the documented window, where N equals the documented limit.
  Expected: all N succeed.
- **Burst exceeding the documented threshold** — N+1 requests in the same
  window. Expected: the request(s) beyond the limit receive the documented
  `429` (or whatever status the contract states), and — if documented — a
  `Retry-After` header with a value consistent with the stated window.
- **Retry-after compliance** — after receiving a `429` with a documented
  `Retry-After`, a follow-up request sent exactly at (or just after) that
  time should succeed; one sent before it should still be rejected. Only
  generate if `Retry-After` is documented as present.
- **Per-scope isolation, only if documented** — if the contract states
  limits are per-token/per-user/per-IP (not global), generate a scenario
  where two different tokens each burst independently and neither is
  throttled by the other's traffic. If the contract doesn't state the
  scope, this is `NOT_DOCUMENTED` — do not assume per-token vs. global.

## Explicit non-invention rule

Never invent a request-per-window number, a `429` threshold, or a
`Retry-After` value the contract doesn't state — this governs the
*threshold-grounded* tier's scenarios completely. The exploratory-gated
tier's single probe is the one exception, and only because its own
`expected_result` is honestly `NOT_DOCUMENTED`, never a guessed number
(cross-reference [[boundary-testing]]'s explicit non-invention rule — same
principle, applied to request rate instead of a field value, except this
dimension still emits the probe rather than only recording a gap).

## Priority

Burst-at-threshold and burst-exceeding-threshold, when the limit is
documented: P1 (verifies a stated contract guarantee). Retry-After
compliance and per-scope isolation: P2. The exploratory-gated probe
(no documented threshold): P3 — it's a company-convention placeholder, not
a confirmed contract assertion.
