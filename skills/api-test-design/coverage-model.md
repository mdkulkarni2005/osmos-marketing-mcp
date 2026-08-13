# Coverage Model

## What "coverage" means here

**Coverage is never code coverage and must never be described as such.**

```
coverage(dimension) = covered_applicable_items(dimension) / total_applicable_items(dimension)
```

Where:

- `total_applicable_items(dimension)` = the count of concrete, contract-grounded
  test points that dimension classified as `APPLICABLE` in step 3 of
  [[api-test-design]]. Example: for Enum testing on `campaign_type`, the
  applicable items are: 2 valid enum values + 1 invalid-enum case + 1
  missing-required-if-applicable case = 4 (only if the field is required —
  otherwise 3).
- `covered_applicable_items(dimension)` = how many of those actually got a
  scenario emitted with `evidence_type` of `DOCUMENTED` or
  `DOCUMENTED_EXAMPLE` and survived deduplication.
- Items that are `NOT_APPLICABLE` (e.g. Pagination testing on an endpoint
  with no pagination params) are excluded entirely from both numerator and
  denominator — they don't drag coverage down, and they must not be silently
  claimed as "covered" either.
- Items that are `NOT_DOCUMENTED` are excluded from the denominator of the
  per-dimension percentage but must be listed in the "NOT_DOCUMENTED Areas"
  and "Coverage Gaps" sections. They represent contract gaps, not skill
  failures — do not let them silently deflate or inflate the number.

## Nested fields don't get a separate coverage metric

A leaf reached via [[nested-traversal]] (e.g.
`category_bid_setting.category_bids[*].bid_value`) counts toward the
`total_applicable_items`/`covered_applicable_items` of whichever dimension
owns it (Boundary, Enum, etc.) exactly like a top-level leaf — do not
compute a separate "nested coverage %". A separate metric would double-count
against the per-dimension numbers above the moment a nested leaf is also
counted there. The one addition: if [[nested-traversal]]'s depth cap (3
levels) cut off a real nested structure, record it as a `NOT_DOCUMENTED`-
style gap — "nesting depth exceeds traversal cap at `<path>`, manual review
recommended" — in Coverage Gaps, the same way an undocumented field would
be, since from a coverage-reporting standpoint it's the same thing: a known
area the automated pass could not ground a scenario in.

## Per-dimension reporting

Report every dimension that was `APPLICABLE` at all, even at 100%:

```
Contract:    95%   (19/20 applicable facts extracted and scenario-mapped)
Functional:  100%  (3/3 positive paths covered)
Negative:    88%   (22/25 applicable negative cases covered)
Boundary:    90%   (9/10 — daily_budget_multiplier max+1 case pending dedup review)
Response:    85%   (17/20 — 3 fields only in DOCUMENTED_EXAMPLE, downweighted)
Workflow:    80%   (4/5 — DELETE endpoint not present in registry, so lifecycle test incomplete)
Security:    70%   (7/10 OWASP checklist items applicable & covered; 3 NOT_DOCUMENTED)
```

## Overall coverage

```
overall = sum(covered_applicable_items across all dimensions) / sum(total_applicable_items across all dimensions)
```

A single pooled ratio, not an average of the per-dimension percentages (which
would over-weight low-item dimensions like Pagination against high-item ones
like Negative testing).

## Mandatory disclosure alongside any number

Every time a coverage percentage is reported, it must be accompanied by:

1. The raw fraction (`22/25`), not just the percentage.
2. What "applicable" excluded (NOT_APPLICABLE dimensions, and why).
3. What NOT_DOCUMENTED excluded (the actual list, or a pointer to section 6
   of the output).
4. A one-line reminder of the scope: *"This is coverage of the documented
   API contract's testable dimensions, not code coverage, not production
   traffic coverage, and not a guarantee of defect-free behavior."*

Never emit a bare sentence like "API is 90% tested." Always attach the
fraction and the scope reminder in the same breath.
