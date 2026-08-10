# Stateful Testing

Covers dimension: Stateful (single-resource lifecycle, as distinct from
[[workflow-testing]]'s multi-endpoint business-process focus).

## Applicability

`APPLICABLE` only if `contract-analysis` found related endpoints operating
on the same resource (e.g. a `create`, `get-by-id`, `update` triad
identified from the endpoint registry/index, not guessed from URL
similarity alone — the relationship should be evident from matching
resource paths, e.g. `POST /{advertiser_id}/.../campaigns` and
`GET /{advertiser_id}/.../campaigns/{campaign_id}` sharing the same resource
segment). If only a single, unrelated endpoint is documented, this dimension
is `NOT_APPLICABLE`.

## Generation rules

Only generate transitions actually supported by the discovered related
endpoints — never invent a state or transition endpoint that isn't
registered:

- `CREATE → GET` — create, then fetch by the returned id, assert the
  created fields round-trip (feeds [[property-testing]]'s invariant checks
  too).
- `CREATE → UPDATE → GET` — if an update endpoint exists for the resource.
- `CREATE → GET (not found on wrong id)` — only if a not-found error
  response is documented on the GET endpoint.
- Status/lifecycle transitions — only if the resource has a documented
  `status` enum (e.g. `ACTIVE`/`PAUSED`/`DRAFT`) and an update mechanism
  that can change it. Generate one scenario per documented valid transition
  destination; do not invent a state machine diagram beyond what's
  documented (e.g. don't assume `DRAFT → ACTIVE` is valid unless something
  in the contract says so — if transition rules aren't documented, list
  under NOT_DOCUMENTED rather than assuming all transitions are legal).

## Explicit non-invention rule

If no delete/deactivate endpoint is documented, do not generate a delete
scenario — note in NOT_DOCUMENTED Areas that lifecycle termination isn't
covered because no such endpoint exists in the registry.

## Priority

CREATE→GET round-trip: P0 (this is usually the core proof the create
actually worked). CREATE→UPDATE→GET: P1. Documented status transitions: P1.
