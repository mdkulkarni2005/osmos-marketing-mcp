---
name: qa-review
description: Reviews a generated test scenario suite (from api-test-design, formatted by company-testcase-format) for completeness, traceability, and quality before human approval. Produces PASS/FAIL/NEEDS_REVIEW with reasons.
---

# QA Review Skill

## What this skill answers

**"Is my test suite good enough?"** It runs after [[api-test-design]] and
[[company-testcase-format]], before human approval, as the final automated
gate in this workflow:

```
Documentation MCP → API Contract → api-test-design → company-testcase-format
   → qa-review → HUMAN APPROVAL → (future: Postman generation/execution)
```

This skill does not add new scenarios and does not reformat anything — it
only evaluates what's already been produced.

## Checks performed

For the supplied scenario suite (Scenario Matrix + Coverage Report from
[[api-test-design]], rendered per [[company-testcase-format]]):

1. **Completeness** — cross-check the suite's Test Dimension Applicability
   table against the Scenario Matrix: every dimension marked `APPLICABLE`
   must have at least one scenario; flag any gap.
2. **Traceability** — every scenario must have a non-empty `source` pointing
   to a specific contract fact, and a valid `evidence_type`. Flag any
   scenario with a vague or missing source.
3. **Duplication** — spot-check for scenarios that [[deduplication]] should
   have merged (same endpoint + same effective request diff + same expected
   result). Flag residual duplicates.
4. **Coverage** — confirm the reported coverage percentages in
   [[coverage-model]]'s format actually match `covered/total` arithmetic
   from the supplied matrix; flag any mismatch or unexplained number.
5. **Undocumented assumptions** — scan `test_data` and `expected_result` for
   any value/behavior that reads as asserted fact but has `evidence_type:
   NOT_DOCUMENTED` or no evidence_type at all. Flag these — they're the
   most likely source of a fabricated test.
6. **Incorrect expected results** — flag any `expected_result` that
   contradicts what its own `source` says (e.g. source cites a `minimum: 1`
   constraint but expected_result implies 0 is valid).
7. **Missing required fields** — cross-check every field marked `required`
   in the contract model appears in at least one negative (missing) and one
   positive scenario.
8. **Missing boundaries** — cross-check every field with documented
   min/max/length appears in [[boundary-testing]]'s expected scenario set.
9. **Missing dependencies** — cross-check every conditional rule extracted
   by [[contract-analysis]] has both a satisfied and violated scenario.
10. **Missing security considerations** — confirm the Security Matrix has a
    classification (not a silent omission) for all 10 OWASP API items.
11. **Invalid test data** — flag any scenario whose `test_data` doesn't
    actually match what its `category`/`subcategory` claims to test (e.g.
    labeled "boundary: maximum+1" but the value shown is actually in-range).
12. **Inconsistent naming** — flag `scenario_id` or title patterns that
    don't follow the format defined by [[company-testcase-format]].
13. **Company formatting** — confirm every row has all columns required by
    [[company-testcase-format]]'s active format (Learned Conventions if
    populated, otherwise Generic Default).
14. **Nested structure coverage** — for every field the contract model marks
    `array-of-object`, `array-of-union`, `array-of-array`, or
    `array-of-constrained-scalar` (per [[contract-analysis]]/
    [[nested-traversal]]), confirm at least one `container[*].leaf`-shaped
    scenario exists per item leaf with a documented constraint, and a
    partial-array-validity probe exists (or its absence is explained, e.g.
    `maxItems: 1`). Flag any such array with only array-level (count/type)
    coverage and no item-level scenarios.
15. **Nested path validity** — flag any scenario whose `field` uses `[*]`,
    `[0]`, or `[-1]` indexing but doesn't trace to a documented `items`
    schema (a fabricated nested path is exactly as serious as check 5's
    fabricated top-level fact). Flag any `[0]`/`[-1]`-indexed scenario that
    isn't part of a partial-array-validity probe — per
    [[nested-traversal]], indexed paths are reserved for that probe only.

## Verdict

Each check above gets `PASS`, `FAIL`, or `N/A` (e.g. security check is `N/A`
if the Security Matrix was legitimately empty because the dimension was
`NOT_APPLICABLE`, which is different from a silent omission — check the
applicability table to distinguish these two cases before flagging).

Overall verdict:

- **PASS** — no `FAIL` on any check.
- **NEEDS_REVIEW** — one or more `FAIL` on checks 3, 11, 12, or 13 (quality/
  polish issues that a human can quickly fix or wave through) — or any check
  where the reviewer isn't fully confident the finding is correct.
- **FAIL** — one or more `FAIL` on checks 1, 2, 5, 6, 7, 8, 9, 10, 14, or 15
  (substantive gaps: missing coverage, untraceable/fabricated content, wrong
  expected results, silently skipped required dimensions, or unrecursed/
  fabricated nested structure).

Always report the verdict with the specific failing check numbers and a
one-line reason per failure — never a bare PASS/FAIL/NEEDS_REVIEW with no
explanation, since the point of this gate is to give the human approver
something actionable.

## What this skill must never do

- Never approve a suite on the human's behalf — its output feeds the human
  approval step, it doesn't replace it.
- Never silently fix a finding by editing the scenario suite itself — that
  would blur review from generation. It reports; a re-run of
  [[api-test-design]] (or a manual edit) fixes.
- Never invent a check result without actually comparing against the
  supplied matrix/coverage report — if the input is incomplete (e.g. no
  Coverage Report was supplied at all), the verdict for every dependent
  check is `NEEDS_REVIEW: insufficient input to evaluate`, not a guessed
  PASS.
