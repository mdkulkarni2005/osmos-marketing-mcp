import type { PostmanHeader, PostmanItem, PostmanRequest, PostmanUrl } from "../schemas/collection.js";
import type { EndpointDefinition } from "./endpoint-registry.js";
import type { TestcaseRow } from "../schemas/testcase.js";
import type { VariableTracker } from "./variable-manager.js";
import { buildTestScript } from "./script-builder.js";

export interface RequestBuilderConfig {
  assertResponseTime: { enabled: boolean; maxMs: number };
}

function parseHeaderLines(headerText: string, vars: VariableTracker): PostmanHeader[] {
  return headerText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      const key = idx === -1 ? line : line.slice(0, idx).trim();
      const rawValue = idx === -1 ? "" : line.slice(idx + 1).trim();
      return { key, value: vars.substitutePlaceholders(rawValue), type: "text" as const };
    });
}

function buildUrl(endpoint: EndpointDefinition, vars: VariableTracker): PostmanUrl {
  const substitutedPath = vars.substitutePathParams(endpoint.path);
  const baseVar = vars.toPostmanVar("base_url");
  const raw = `${baseVar}${substitutedPath}`;
  // `raw` only: {{base_url}} already resolves to a full origin + path
  // prefix (e.g. https://.../marketing/v1/advertiser), so it cannot be
  // decomposed into a Postman `host` array (that expects hostname
  // segments) without Newman reconstructing a mangled URL. Let Postman
  // parse `raw` itself rather than asserting a wrong host/path split.
  return { raw };
}

/**
 * Converts one approved, executable testcase row into a single Postman
 * request item. Never invents request content — every field traces back to
 * the workbook row or the endpoint definition it was validated against.
 */
export function buildRequestItem(
  row: TestcaseRow,
  endpoint: EndpointDefinition,
  vars: VariableTracker,
  config: RequestBuilderConfig
): PostmanItem {
  const header = parseHeaderLines(row.requestHeaders, vars);
  const hasBody = row.requestBody.trim().length > 0;

  let bodyRaw: string | undefined;
  if (hasBody) {
    try {
      const parsed = JSON.parse(row.requestBody);
      bodyRaw = JSON.stringify(parsed, null, 2);
    } catch {
      bodyRaw = row.requestBody; // preserved as-authored; validator will flag invalid JSON
    }
    bodyRaw = vars.substitutePlaceholders(bodyRaw);
  }

  const request: PostmanRequest = {
    method: row.method,
    header,
    url: buildUrl(endpoint, vars),
    ...(bodyRaw !== undefined
      ? { body: { mode: "raw", raw: bodyRaw, options: { raw: { language: "json" } } } }
      : {}),
  };

  return {
    name: `[${row.tcId}] ${row.testScenario}`,
    description: `TC_ID: ${row.tcId} | API Name: ${row.apiName} | Sheet: ${row.sheetName} | Row: ${row.rowNumber}`,
    request,
    event: [
      {
        listen: "test",
        script: { type: "text/javascript", exec: buildTestScript(row, config) },
      },
    ],
  };
}
