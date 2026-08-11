# Nested Structure Traversal

Not a dimension. This is a **generation technique**, invoked by
[[negative-testing]], [[data-type-testing]], [[boundary-testing]],
[[enum-testing]], [[format-testing]], and [[dependency-testing]] whenever the
field they're about to process has a documented `items` schema (array) or is
itself nested inside one. Same relationship [[property-testing]]'s mutation
operators have to the dimensions they land in: this doc says *how to reach*
a test point buried inside an array; the dimension doc that owns the leaf's
type/boundary/enum/etc. still owns priority, `category`, and
`coverage_dimension` for the resulting scenario.

## Why this exists

[[contract-analysis]] already recurses into nested **objects** and flattens
them to dotted-field paths (`budget_setting.daily_budget_multiplier`) — every
dimension doc already covers that case correctly with no changes needed.
What the flat dotted-path model cannot express is a field living **inside an
array of objects**: `product_set.products[]`, `category_bid_setting.category_bids[]`
(object items with their own `required`/`enum`/`type`), `keywords[]` (a
`oneOf` union of object shapes). Real endpoints in this registry have exactly
this shape today — e.g. `create-update-category-bids-for-campaign`'s
`category_bids[]` items are objects with `required: [category_value,
bid_value, is_active]`, and `create-update-negative-keyword-settings-for-campaign`'s
`keywords[]` items are a `oneOf` of two object shapes. This doc closes that
gap.

## Ownership boundary (read this before generating anything)

**The flat dotted-path pass owns every leaf reachable by a pure dotted
path — do not re-derive those scenarios here.** This doc owns exactly four
things a dotted path cannot express:

1. Fields that live inside `items` when `items.type` is `object` or `items`
   is a `oneOf` of object schemas.
2. The array/object **container itself** as a request-construction target
   (missing/null/wrong-type for the whole container, distinct from a leaf
   inside it being missing).
3. Partial-array-validity (some items valid, some not, in one request).
4. Conditional rules whose `IF`/`THEN` fields both live inside the same item
   schema (rule is per-item, not request-global).

If you find yourself generating a scenario for a field reachable without an
array index (e.g. `budget_setting.daily_budget_multiplier`), stop — that
belongs to the flat pass in whichever dimension doc normally owns it, and
duplicating it here will silently inflate coverage counts once
[[deduplication]] collapses the pair (the dupe won't even be visible in the
matrix — it just makes the denominator wrong).

## Applicability

`APPLICABLE` only where the contract documents an `items` schema for the
array field. A plain `array` field with no `items` schema documented (rare,
but treat it like any other undocumented fact) is `NOT_DOCUMENTED` for
everything in this doc — do not assume item shape from an example payload
alone; an example showing `"products": ["749yhd78"]` does not tell you
whether items must be non-empty strings, IDs of a specific format, etc.
unless `items` states it.

- `items.type` is a scalar (`string`/`number`/`integer`/`boolean`) with **no
  further constraints of its own** (no `items.minLength`, `items.pattern`,
  `items.enum`, ...) → nothing to recurse into. The array-level dimensions
  ([[boundary-testing]]'s minItems/maxItems, [[data-type-testing]]'s
  array-vs-scalar mismatch) already cover it. Skip this doc entirely for
  that field, except item #3 (partial-array-validity) below, which still
  applies to scalar-item arrays (e.g. one malformed ID string among valid
  ones).
- `items.type` is a scalar **with its own constraints** documented (e.g. an
  items-level `pattern` or `maxLength`) → recurse one level: treat `field[*]`
  as a normal field for exactly the dimensions those documented constraints
  trigger (format/boundary), nothing else. No endpoint in the current
  registry has this shape (`product_set.products[]` is a bare
  `{"type": "string"}` with no items-level constraint) — this branch is
  here so the rule is ready the day a service does document one, not
  because one exists today. Don't generate anything under it until a real
  `items`-level constraint shows up.
- `items.type` is `object` → recurse fully (see Traversal algorithm).
- `items` is `oneOf`/`anyOf` of object schemas → treat as a discriminated
  union (see Traversal algorithm, part C).
- `items.items` exists (array of arrays) → recurse one further level only
  (Traversal algorithm, part D).

## Path convention

- `field[*].leaf` — schema-level cases (a leaf's own type/boundary/enum/
  format/required-ness), generated once against a single representative
  item. This is the default for everything except position-sensitivity
  probes.
- `field[0].leaf`, `field[-1].leaf` (first / last index) — used **only** by
  the partial-array-validity probe (part B below), never for ordinary
  per-item dimension coverage. Do not generate `[0]`, `[1]`, `[2]`... copies
  of the same schema-level case; that's fanout with no added risk signal,
  same principle [[data-type-testing]] already states for wrong-type
  fanout.
- Container-level cases use the container's own path with no index:
  `product_set.products` (the array itself), `category_bid_setting.category_bids`.

Use this convention verbatim in `output-schema.md`'s `field` value so
`scenario_id` stays stable across regenerations.

## Traversal algorithm

**A. Object items — full recursion, one representative item, capped depth**

For an array field whose `items.type == object`:

1. Run [[contract-analysis]]'s extraction checklist against `items.properties`
   / `items.required` exactly as if it were a request body schema, producing
   leaf paths of the form `field[*].leaf` (recurse further if a leaf is
   itself an object or array — same rules apply, one level deeper).
2. Feed each extracted leaf into the same dimension docs a top-level field
   would go to: [[data-type-testing]], [[boundary-testing]], [[enum-testing]],
   [[format-testing]], and required-field checks in [[negative-testing]].
   These scenarios carry `field: "category_bid_setting.category_bids[*].bid_value"`
   etc. and are generated, prioritized, and deduplicated by the owning
   dimension doc's normal rules — this doc only supplies the path.
3. **Hard depth cap: 3 nesting levels** (e.g. `a[*].b[*].c` is level 3). If a
   real contract nests deeper, stop recursing at level 3, and record the
   deeper structure in NOT_DOCUMENTED Areas as "nesting depth exceeds
   traversal cap, manual review recommended" rather than silently expanding
   further — this mirrors [[boundary-testing]]'s explicit non-invention rule
   applied to depth instead of value.

**B. Partial-array-validity (new probe, no dotted-path equivalent)**

Only for arrays whose documented `minItems`/`maxItems` (or absence thereof)
permits 2+ items. Generate, using **one** representative invalid item per
case (do not fan out across every leaf-level dimension — pick the invalid
item from whichever single applicable dimension has the strongest documented
constraint, e.g. a missing required item field):

- valid item at index 0, invalid item at index 1 (`field[1].leaf` invalid)
- invalid item at index 0 (first position), valid items after
- invalid item at the last index, valid items before
- every item invalid
- two structurally identical items (duplicate), only if the contract implies
  or states uniqueness (e.g. a list of product IDs, a list of
  keyword+match_type pairs that would collide) — if uniqueness isn't stated
  either way, still emit the probe (cheap, legitimate construction) but set
  `expected_result: NOT_DOCUMENTED — contract does not state whether
  duplicate items are rejected, deduplicated, or accepted`

This probe exists because a common real failure mode is item-level
validation that silently drops the bad item, 500s on the whole array, or
accepts the whole array despite one bad member — none of which the flat
per-item schema check alone would catch.

**C. `oneOf`/`anyOf` item schemas (polymorphic items)**

For an array whose `items` is a union of object shapes — e.g.
`create-update-positive-keyword-settings-for-campaign`'s `keywords[]`,
which documents two branches explicitly: "Create Keyword" (`required:
keyword, match_type, bid_value`, description "Do not include id") and
"Update Keyword" (`required: id`, description "id is required; keyword and
match_type are forbidden", plus its own `anyOf` requiring at least one of
`status`/`bid_value`). The array's own description states the discriminator
in prose: "Each item is either a create entry (no id) or an update entry (id
required)" — so here the discriminator (presence/absence of `id`) is
actually documented, not inferred:

- one valid item matching each branch of the union (positive, one scenario
  per branch) — including each branch's *own* nested rules, e.g. the Update
  branch's `anyOf[status, bid_value]` is itself a dependency rule scoped one
  level deeper, generated per [[dependency-testing]]
- one item matching **none** of the branches (negative — e.g. an item with
  neither `id` nor `keyword`/`match_type`/`bid_value`)
- one item mixing fields from both branches (e.g. `id` present *and*
  `keyword`/`match_type` present) — the "Update Keyword" branch's own
  description states these are forbidden together, so this is a documented
  negative case, not an invented one
- **only when the array's own description or the branch descriptions do not
  state a discriminator** (unlike the example above): do not invent one:
  generate the "matches no branch" case with `expected_result:
  NOT_DOCUMENTED — contract does not state how the API selects/rejects an
  item matching no branch`, and skip the "mixing both branches" case
  entirely unless a branch description explicitly forbids the combination

**D. Array of arrays**

`items.items` documented → recurse exactly one further level (schema-level
case at `field[*][*]`, plus the array-of-arrays' own boundary case if
`items.minItems`/`maxItems` is documented one level down). Do not go beyond
this; deeper nesting is outside the depth cap in part A and is reported the
same way.

## Container-level cases

Independent of what's inside it, the container field itself
(`product_set`, `category_bid_setting.category_bids`) is a request-
construction target:

- if the container is `required` at its own level → container absent
  entirely (distinct request shape from "container present, one required
  leaf absent" — [[deduplication]]'s "different failure mode" rule keeps
  both)
- container sent as `null`
- container sent as the wrong type (a string/number where an object or
  array is expected)

File these under [[negative-testing]] (missing) or [[data-type-testing]]
(null/wrong-type) using the container's own field path, no index.

## Item-scoped conditional rules

Run [[contract-analysis]]'s conditional-rule extraction pattern against each
item schema's field descriptions (not just the top-level request body) —
this rule is genuinely per-item, not request-level, because both sides of
the `IF`/`THEN` live inside the same array item. A real example already in
this registry: `create-update-category-bids-for-campaign`'s
`category_bids[*].bid_value` description states "Must be greater than 0
when is_active=true; must be null when is_active=false" — extract this as
`IF category_bids[*].is_active = true THEN category_bids[*].bid_value > 0`
and `IF category_bids[*].is_active = false THEN category_bids[*].bid_value
IS null`, generate both directions satisfied and violated (e.g.
`is_active: true, bid_value: null` — violates the first rule) exactly as
[[dependency-testing]] does for request-level rules. Do not treat every
array-of-object field as having an item-scoped rule by default — most don't
(e.g. `product_set.products[]`'s items carry no conditional at all); extract
only when a description literally states one, same as the request-level
version of this rule.

## Explicit non-invention rules (this doc's version of the standing policy)

- Never assume array item uniqueness, ordering-sensitivity, or
  partial-acceptance behavior — always trace to a documented statement or
  mark `NOT_DOCUMENTED` on the *expected_result* (the probe itself can still
  be constructed, per [[api-test-design]]'s no-guessing policy: the
  input-construction fact — "this is an array, arrays can hold 2+ items" —
  is grounded even when the behavioral outcome isn't).
- Never recurse past the depth cap; report instead.
- Never generate index-specific (`[0]`, `[1]`, ...) copies of an ordinary
  schema-level case — only the partial-validity probe uses indices.
- Never invent a `oneOf` discriminator.

## Priority

Container missing/null/wrong-type on a required container: same tier as any
other required-field violation in [[prioritization]] (P1, or P0 if the
container is itself the endpoint's core payload). Item-level leaf scenarios
inherit the priority of whichever dimension doc they're filed under, exactly
as top-level fields do. Partial-array-validity: P1 — it's a distinct,
commonly-broken code path (batch validation logic), not a robustness
nice-to-have. Depth-cap-exceeded gap entries: no priority, they're a
NOT_DOCUMENTED/coverage-gap note, not a scenario.
