import type { PostmanCollection } from "../schemas/collection.js";
import type { ExecutableTestcase } from "../schemas/testcase.js";
import { resolveEndpoint, type EndpointRegistry } from "./endpoint-registry.js";
import { VariableTracker } from "./variable-manager.js";
import { buildRequestItem, type RequestBuilderConfig } from "./request-builder.js";
import { buildFolders, type BuiltRequest } from "./folder-manager.js";
import { findUnknownBodyFields } from "./body-schema-check.js";

export interface CollectionBuildOptions {
  collectionName: string;
  requestBuilder?: Partial<RequestBuilderConfig>;
}

export interface CollectionBuildResult {
  collection: PostmanCollection;
  usedVariables: string[];
  /** Rows that never had a request generated because of a build error (unresolved endpoint) — a validator-critical condition. */
  unresolved: { tcId: string; reason: string }[];
  /** Rows intentionally left out because the reader already determined they're not executable (e.g. rate-limit gated) — expected, not an error. */
  nonExecutable: { tcId: string; reason: string }[];
  /** Rows whose request body has a top-level field the resolved endpoint's documented schema doesn't recognize — likely drift/copy-paste, not blocking (may be a deliberate forbidden-field negative test) but always worth a human look. */
  bodyFieldWarnings: { tcId: string; endpointId: string; fields: string[] }[];
}

const DEFAULT_REQUEST_CONFIG: RequestBuilderConfig = {
  // OBSERVED_PATTERN in the SDA reference, not a confirmed company-wide
  // rule — default off for a new service until confirmed. See
  // knowledge/company/postman-conventions.md.
  assertResponseTime: { enabled: false, maxMs: 8000 },
};

/**
 * Builds one Postman collection from the executable testcases produced by
 * the workbook reader. Requests whose API Name doesn't resolve to a known
 * endpoint in the registry are skipped and reported, never silently
 * fabricated.
 */
export function buildCollection(
  testcases: ExecutableTestcase[],
  registry: EndpointRegistry,
  options: CollectionBuildOptions
): CollectionBuildResult {
  const vars = new VariableTracker();
  const config: RequestBuilderConfig = {
    ...DEFAULT_REQUEST_CONFIG,
    ...options.requestBuilder,
    assertResponseTime: {
      ...DEFAULT_REQUEST_CONFIG.assertResponseTime,
      ...options.requestBuilder?.assertResponseTime,
    },
  };

  const built: BuiltRequest[] = [];
  const unresolved: { tcId: string; reason: string }[] = [];
  const nonExecutable: { tcId: string; reason: string }[] = [];
  const bodyFieldWarnings: { tcId: string; endpointId: string; fields: string[] }[] = [];

  for (const tc of testcases) {
    if (!tc.executability.executable) {
      nonExecutable.push({ tcId: tc.row.tcId, reason: tc.executability.reason });
      continue;
    }

    // Resolution is the single source of truth for which endpoint (and
    // therefore which URL) a row builds against — always the registry's
    // canonical definition, never re-derived or guessed from row text. An
    // exact "API Name" match wins; a normalized fallback is used only when
    // it's unambiguous. Anything else is a build error, reported per row,
    // never silently mapped to the wrong endpoint.
    const resolution = resolveEndpoint(registry, tc.row.apiName);
    if (resolution.status === "not_found") {
      unresolved.push({
        tcId: tc.row.tcId,
        reason: `no registry endpoint matches API Name "${tc.row.apiName}"`,
      });
      continue;
    }
    if (resolution.status === "ambiguous") {
      unresolved.push({
        tcId: tc.row.tcId,
        reason: `API Name "${tc.row.apiName}" matches multiple registry endpoints (${resolution.candidates
          .map((c) => c.id)
          .join(", ")}) after normalization — cannot pick one without ambiguity`,
      });
      continue;
    }
    const endpoint = resolution.endpoint;

    if (tc.row.requestBody.trim().length > 0) {
      try {
        const parsedBody = JSON.parse(tc.row.requestBody);
        const unknownFields = findUnknownBodyFields(parsedBody, endpoint);
        if (unknownFields.length > 0) {
          bodyFieldWarnings.push({ tcId: tc.row.tcId, endpointId: endpoint.id, fields: unknownFields });
        }
      } catch {
        // Invalid JSON is already caught as a critical finding by
        // collection-validator's syntactic check on the built item.
      }
    }

    built.push({ row: tc.row, item: buildRequestItem(tc.row, endpoint, vars, config) });
  }

  // Registered even if no row happens to reference them, so the environment
  // template always includes the service's two auth variables.
  vars.toPostmanVar("token");
  vars.toPostmanVar("retailer_id");

  const collection: PostmanCollection = {
    info: {
      name: options.collectionName,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      description:
        "Generated from the approved company-format testcase workbook. Do not hand-edit — regenerate from the workbook (see docs/postman-workflow.md).",
    },
    // No collection-level auth block: this service's dual-header auth
    // (x-token + x-retailer-id, registry/service/service.json) is not a
    // Postman `auth` type, and a bearer block would inject an unused
    // Authorization header into every request — including the ones testing
    // for a *missing* x-token. Each request's own headers (parsed from the
    // workbook's Request Headers cell) already carry the real auth.
    event: [
      {
        listen: "prerequest",
        script: {
          type: "text/javascript",
          exec: [
            "// [SETUP] Source of truth = ENVIRONMENT. Mirror environment variables",
            "// into collection variables so item-level scripts have a stable read.",
            ...vars
              .usedVariables()
              .map((v) => `pm.collectionVariables.set("${v}", pm.environment.get("${v}"));`),
          ],
        },
      },
    ],
    item: buildFolders(built),
  };

  return { collection, usedVariables: vars.usedVariables(), unresolved, nonExecutable, bodyFieldWarnings };
}
