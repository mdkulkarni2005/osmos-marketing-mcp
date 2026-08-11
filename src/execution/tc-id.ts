/**
 * Single source of truth for extracting a TC_ID from a Postman item/request
 * name (`[TC_ID] human description` — see
 * knowledge/company/postman-conventions.md "Request naming"). Reused by
 * collection filtering, result parsing, and reconciliation so all three
 * agree on the same identity.
 */
export function extractTcId(itemName: string): string | undefined {
  const m = itemName.match(/^\[([^\]]+)\]/);
  return m?.[1];
}
