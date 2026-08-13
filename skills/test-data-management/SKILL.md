---
name: test-data-management
description: Generates concrete, deterministic, contract-grounded test_data values for scenarios produced by api-test-design — unique IDs, dates, realistic-looking strings for documented formats — without inventing business facts. Also defines seed-data and cleanup conventions for scenarios that need pre-existing resources.
---

# Test Data Management Skill

## What this skill answers

**"What concrete value do I actually put in `test_data`?"** [[output-schema]]
requires `test_data` to be concrete, never a placeholder like `<invalid
value>` — this skill is where that concreteness comes from. It runs
alongside scenario generation in [[api-test-design]], not after it: whenever
a dimension doc (boundary, enum, format, negative, ...) needs a value, it
comes from here rather than being invented ad hoc per scenario, so the same
kind of value is generated the same way every time.

This skill does not decide *what* to test (that's [[api-test-design]]) and
does not decide *whether* a value is business-plausible for a given service
(the no-guessing policy in [[api-test-design]]'s `SKILL.md` still governs —
this skill supplies mechanically-generated values, never invented business
semantics).

## Hard boundary

Never invent a value that reads as business fact (a real-sounding campaign
name implying a specific use case, a product ID that looks like it belongs
to a real catalog, a bid value chosen to look "reasonable" for a market this
skill has no knowledge of). Generated values must be self-evidently
synthetic wherever the dimension doesn't need them to look realistic — this
is a stronger rule than merely "not guessed," so a generated test-data value
can never later be mistaken for a real business record.

## Categories

### Deterministic identifiers

- Use a fixed, seeded generation scheme (e.g. `TESTDATA-{endpoint_id}-{counter}`)
  so re-running scenario generation for the same contract produces the same
  IDs — this is what keeps [[output-schema]]'s `scenario_id` stability
  promise meaningful when `test_data` embeds an ID.
- Never reuse a real ID observed in a contract `example` block as if it were
  guaranteed to exist — an example ID is `DOCUMENTED_EXAMPLE` evidence at
  best (see [[contract-analysis]]), not a live resource this skill can rely
  on existing at execution time.

### Format-conforming values

For a field with a documented `format` (date, date-time, uuid, url, email,
pattern — see [[format-testing]]):

- Generate the **minimal valid instance** of that format by default (e.g.
  shortest valid ISO-8601 date, a UUID v4 generated fresh, `test@example.com`-
  style addresses using the reserved `example.com`/`example.org` domains,
  never a real-looking third-party domain).
- For a documented `pattern` (regex), generate a value that satisfies the
  pattern mechanically — do not eyeball a "close enough" string; if the
  pattern is too complex to satisfy confidently, say so and fall back to a
  value from the contract's own `example` (tagged `DOCUMENTED_EXAMPLE`)
  rather than guessing.

### Boundary/enum/type values

These are already fully specified by [[boundary-testing]], [[enum-testing]],
and [[data-type-testing]] — this skill does not re-derive them, it only
supplies the *filler* values around them (e.g. what a "normal in-range"
number actually is, which those docs call for but don't pin down). Filler
values: smallest value that isn't itself a boundary edge, or the documented
`example`/`default` if present.

### Dates and times

- "Current date" scenarios use the actual date at generation time, recorded
  literally in `test_data` (not a relative expression like "today" — a
  human or CI re-running the suite later needs the concrete value that was
  used).
- "Past"/"future" scenarios use a fixed offset (e.g. -1 day, +1 year) from
  generation time, not a hardcoded calendar date that silently becomes
  wrong-flavored (a "future" date that's now in the past) as time passes —
  state the offset in `scenario`, not just the resolved value.
- Timezone: always use UTC unless the contract documents a different
  expected timezone.

### Seed data (pre-existing resources a scenario depends on)

Some scenarios (GET-by-id, UPDATE, DELETE, workflow steps) need a resource
to already exist. This skill does not create that resource — creation is
either another scenario in the same [[workflow-testing]] chain, or (for
execution) a fixture the execution layer sets up. What this skill defines:

- **Precondition naming convention** — `output-schema.md`'s `precondition`
  field must name the exact prior scenario_id or fixture that creates the
  needed resource, not a vague "a campaign must exist."
- **Cleanup is out of scope for scenario *design*** — whether/how a created
  resource is torn down after execution is an execution-layer concern
  (`src/execution/`), not something this skill or [[api-test-design]]
  decides. Note the dependency; don't solve the cleanup here.

## Explicit non-invention rule

If a field's format is undocumented and no `example` exists, this skill
cannot produce a concrete value that's grounded — say so, and let the
calling dimension doc treat it as `NOT_DOCUMENTED` rather than silently
filling in a plausible-looking value. A plausible-looking invented value is
worse here than elsewhere, because `test_data` is the part of the output a
human is most likely to trust at face value.
