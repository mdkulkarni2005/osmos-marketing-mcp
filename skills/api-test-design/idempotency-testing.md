# Idempotency Testing

Covers dimensions: Idempotency, Duplicate-operation.

## Applicability

`APPLICABLE` for any mutating endpoint (POST/PUT/PATCH/DELETE).
`DOCUMENTED` evidence if the contract states an idempotency-key mechanism or
explicit repeat-request behavior; otherwise still generate the base
exploratory scenario but tag `expected_result: NOT_DOCUMENTED`.

## Generation rules

- **Repeated request, identical payload** — send the exact same request
  twice. Record whether the contract states the second call: creates a
  duplicate resource, returns the existing resource, or errors. If
  undocumented, this is a real coverage gap worth surfacing, not something
  to silently skip.
- **Repeated successful request** — same as above, explicitly for the
  success path (two successful creates back to back).
- **Repeated failed request** — send an already-known-invalid request twice;
  confirm the same documented error occurs both times (a low-risk sanity
  case, P3).
- **Duplicate create by business key** — if the contract implies a natural
  key (e.g. `name` scoped to `advertiser_id`), create once, then attempt to
  create again with the same key. Only assert documented dedup behavior; if
  the contract is silent on uniqueness, mark `NOT_DOCUMENTED` rather than
  assuming names must be unique.
- **Idempotency-key behavior** — only if a request header for an idempotency
  key is documented. Generate: same key + same payload (expect same result
  returned, not reprocessed), same key + different payload (documented
  behavior, often a conflict error — only assert if documented).

## Priority

Repeated-request exploration on create endpoints: P1 (duplicate resource
creation is a common real-world defect class). Idempotency-key mechanics
where documented: P1. Repeated-failed-request sanity check: P3.
