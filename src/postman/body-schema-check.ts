import type { EndpointDefinition } from "./endpoint-registry.js";

/**
 * Checks a testcase's authored request body against the endpoint's actual
 * documented schema (from the registry, not from the workbook cell) so a
 * copy-pasted or hand-typed body that drifted from the real contract is
 * caught instead of silently sent as-is. Deliberately shallow (top-level
 * keys only, unknown-field detection): the api-test-design skill's
 * nested-traversal is what owns full nested-shape correctness at generation
 * time; this is a last-line build-time guard against drift, not a re-run of
 * that generation logic.
 */
export function findUnknownBodyFields(body: unknown, endpoint: EndpointDefinition): string[] {
  const schema = endpoint.requestBody?.schema;
  if (!schema || schema.type !== "object" || !schema.properties) return [];
  if (typeof body !== "object" || body === null || Array.isArray(body)) return [];

  const known = new Set(Object.keys(schema.properties));
  return Object.keys(body as Record<string, unknown>).filter((k) => !known.has(k));
}
