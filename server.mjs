import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildCollectionTool,
  buildEnvironmentTool,
  validateCollectionTool,
  validateEnvironmentTool,
  runCollectionTool,
  getExecutionResultsTool,
  reconcileResultsTool,
  updateWorkbookTool,
} from "./dist/execution/mcp-adapters.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = path.resolve(__dirname, "registry");
const SERVICE_FILE = path.join(REGISTRY_DIR, "service", "service.json");
const ENDPOINTS_INDEX = path.join(REGISTRY_DIR, "endpoints", "index.json");
const ENDPOINTS_DIR = path.join(REGISTRY_DIR, "endpoints");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

const service = readJson(SERVICE_FILE).service;
const endpointsIndex = readJson(ENDPOINTS_INDEX).serviceIndex.endpoints;

const server = new McpServer({
  name: "osmos-marketing-api",
  version: "1.0.0",
});

// ---- Resource: service definition ----
server.resource(
  "service-definition",
  "osmos://service",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(service, null, 2),
      },
    ],
  })
);

// ---- Resource: endpoint index ----
server.resource(
  "endpoints-index",
  "osmos://endpoints",
  async (uri) => ({
    contents: [
      {
        uri: uri.href,
        mimeType: "application/json",
        text: JSON.stringify(endpointsIndex, null, 2),
      },
    ],
  })
);

// ---- Prompt: how to use the API ----
server.prompt("campaign-hierarchy", async () => ({
  messages: [
    {
      role: "user",
      content: {
        type: "text",
        text: `Understand the OSMOS Marketing API campaign hierarchy before acting:\n${JSON.stringify(service.hierarchy, null, 2)}\n\nEndpoints available:\n${endpointsIndex
          .map(
            (e) =>
              `- ${e.method} ${e.path} (${e.id}): ${e.summary}`
          )
          .join("\n")}`,
      },
    },
  ],
}));

// ---- Tool: list all endpoints ----
server.tool(
  "list_endpoints",
  "List all available API endpoints in the OSMOS Marketing API registry with their methods and paths.",
  {},
  async () => {
    const list = endpointsIndex.map((e) => ({
      id: e.id,
      method: e.method,
      path: e.path,
      summary: e.summary,
      file: e.file,
    }));
    return {
      content: [{ type: "text", text: JSON.stringify(list, null, 2) }],
    };
  }
);

// ---- Tool: get service details ----
server.tool(
  "get_service_details",
  "Get the OSMOS Marketing API service definition including base URL, authentication requirements, and campaign hierarchy.",
  {},
  async () => {
    return {
      content: [{ type: "text", text: JSON.stringify(service, null, 2) }],
    };
  }
);

// ---- Tool: get endpoint definition ----
server.tool(
  "get_endpoint_definition",
  "Get the full OpenAPI-derived definition for a specific endpoint by id (request/response schemas, params, examples).",
  {
    endpointId: z.string().describe("Endpoint id, e.g. create-spa-campaign"),
  },
  async ({ endpointId }) => {
    const found = endpointsIndex.find((e) => e.id === endpointId);
    if (!found) {
      return {
        content: [
          {
            type: "text",
            text: `Endpoint "${endpointId}" not found. Available: ${endpointsIndex
              .map((e) => e.id)
              .join(", ")}`,
          },
        ],
        isError: true,
      };
    }
    const ep = readJson(path.join(ENDPOINTS_DIR, found.file));
    return {
      content: [{ type: "text", text: JSON.stringify(ep.endpoint, null, 2) }],
    };
  }
);

// ---- Generic API caller ----
async function callApi(operationId, method, path, pathParams, queryParams, body, auth) {
  const { x_token: xToken, x_retailer_id: xRetailerId } = auth || {};
  if (!xToken || !xRetailerId) {
    return {
      content: [
        {
          type: "text",
          text: "Missing authentication headers. Provide both `x_token` and `x_retailer_id` arguments.",
        },
      ],
      isError: true,
    };
  }

  // Resolve path params
  let resolvedPath = path;
  for (const [k, v] of Object.entries(pathParams || {})) {
    resolvedPath = resolvedPath.replace(`{${k}}`, String(v));
  }
  // Replace any unresolved placeholders
  resolvedPath = resolvedPath.replace(/\{[a-zA-Z0-9_]+\}/g, "");

  const url = new URL(service.baseUrl + resolvedPath);
  for (const [k, v] of Object.entries(queryParams || {})) {
    if (v !== undefined && v !== null) {
      url.searchParams.set(k, String(v));
    }
  }

  const headers = {
    "x-token": xToken,
    "x-retailer-id": xRetailerId,
    accept: "application/json",
  };
  if (body !== undefined && body !== null) {
    headers["content-type"] = "application/json";
  }

  let resp;
  try {
    resp = await fetch(url.toString(), {
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    return {
      content: [{ type: "text", text: `Network error: ${err.message}` }],
      isError: true,
    };
  }

  const text = await resp.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = text;
  }

  const ok = resp.ok;
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            status: resp.status,
            ok,
            operationId,
            url: url.toString(),
            body: parsed,
          },
          null,
          2
        ),
      },
    ],
    isError: !ok,
  };
}

// ---- Register a dynamic tool for every endpoint ----
for (const epMeta of endpointsIndex) {
  const ep = readJson(path.join(ENDPOINTS_DIR, epMeta.file)).endpoint;

  // Build zod schema for path params
  const pathParamSchema = {};
  for (const p of ep.parameters || []) {
    if (p.in === "path") {
      let t = z.string();
      if (p.type === "integer") t = z.number().int();
      if (p.type === "number") t = z.number();
      pathParamSchema[p.name] = t.describe(p.description || p.name);
    }
  }

  // Build zod schema for query params
  const queryParamSchema = {};
  for (const p of ep.parameters || []) {
    if (p.in === "query") {
      let t = z.string();
      if (p.type === "integer") t = z.number().int();
      if (p.type === "number") t = z.number();
      if (p.required) {
        t = t.describe(p.description || p.name);
      } else {
        t = t.optional().describe(p.description || p.name);
      }
      queryParamSchema[p.name] = t;
    }
  }

  const bodySchema = z
    .any()
    .optional()
    .describe("JSON request body matching the endpoint schema. See get_endpoint_definition for details.");

  const authSchema = {
    x_token: z
      .string()
      .optional()
      .describe("Authentication token for the x-token header (required to make the call)."),
    x_retailer_id: z
      .string()
      .optional()
      .describe("Retailer identifier for the x-retailer-id header (required to make the call)."),
  };

  const toolArgs = {
    ...pathParamSchema,
    ...queryParamSchema,
    body: bodySchema,
    ...authSchema,
  };

  const safeName = ep.id.replace(/-/g, "_");
  server.tool(
    safeName,
    `${ep.summary}. ${ep.description}`.slice(0, 300),
    toolArgs,
    async (args) => {
      const auth = { x_token: args.x_token, x_retailer_id: args.x_retailer_id };
      const body = args.body;
      // Only pass path/query params, never auth or body
      const pathParams = {};
      for (const p of ep.parameters || []) {
        if (p.in === "path" && args[p.name] !== undefined) {
          pathParams[p.name] = args[p.name];
        }
      }
      const queryParams = {};
      for (const p of ep.parameters || []) {
        if (p.in === "query" && args[p.name] !== undefined) {
          queryParams[p.name] = args[p.name];
        }
      }
      return callApi(
        ep.operationId,
        ep.method,
        ep.path,
        pathParams,
        queryParams,
        body,
        auth
      );
    }
  );
}

// ---- Postman build/validate/execute/reconcile tools ----
// Thin wrappers only: all decisions live in src/execution + src/postman
// (compiled to dist/). See docs/local-execution.md for the mode contract —
// BUILD_ONLY/VALIDATE_ONLY/DRY_RUN never touch a network or require
// credentials; only postman_run_collection can execute a real request, and
// only with confirmRun explicitly true.

const buildPathArgs = {
  workbookPath: z.string().optional().describe("Path to the testcase workbook. Defaults to the fixture workbook."),
  collectionPath: z.string().optional().describe("Where to write the built collection JSON."),
  environmentPath: z.string().optional().describe("Where to write the built (placeholder) environment JSON."),
};

server.tool(
  "postman_build_collection",
  "BUILD_ONLY: read the testcase workbook and build a Postman collection JSON. No credentials, no execution.",
  buildPathArgs,
  async (args) => ({ content: [{ type: "text", text: JSON.stringify(await buildCollectionTool(args), null, 2) }] })
);

server.tool(
  "postman_build_environment",
  "BUILD_ONLY: build the placeholder Postman environment template (empty/safe values) for the collection's required variables.",
  buildPathArgs,
  async (args) => ({ content: [{ type: "text", text: JSON.stringify(await buildEnvironmentTool(args), null, 2) }] })
);

server.tool(
  "postman_validate_collection",
  "VALIDATE_ONLY: rebuild from the workbook and run collection-validator.ts. Returns pass/fail and every finding. Does not execute.",
  buildPathArgs,
  async (args) => ({ content: [{ type: "text", text: JSON.stringify(await validateCollectionTool(args), null, 2) }] })
);

server.tool(
  "postman_validate_environment",
  "Audits an environment file (real or placeholder) against the collection's actual required variables: missing/empty values, missing secrets, missing base_url, and a heuristic production-URL check. Does not execute anything.",
  {
    ...buildPathArgs,
    environmentToCheckPath: z.string().optional().describe("Environment file to audit. Defaults to the generated placeholder."),
    allowProductionUrl: z.boolean().optional().describe("Acknowledge a base_url that doesn't look like a test/staging host."),
  },
  async (args) => ({ content: [{ type: "text", text: JSON.stringify(await validateEnvironmentTool(args), null, 2) }] })
);

server.tool(
  "postman_run_collection",
  "RUN: executes the collection locally via Newman against a REAL environment with real credentials. Requires confirmRun=true and realEnvironmentPath. Blocked automatically if validation fails, required variables are missing, or the base URL looks like production without allowProductionUrl. Never runs as a side effect of any other tool.",
  {
    ...buildPathArgs,
    realEnvironmentPath: z.string().describe("Local, gitignored environment file with real values. Never committed."),
    confirmRun: z.boolean().describe("Must be explicitly true — this is the only gate that allows a real API call."),
    allowProductionUrl: z.boolean().optional().describe("Acknowledge a base_url that doesn't look like a test/staging host."),
    tcIds: z.array(z.string()).optional().describe("Run only these TC_IDs."),
    folder: z.string().optional().describe("Run only this API/folder's testcases."),
    failedOnly: z.boolean().optional().describe("Run only testcases whose workbook Status is currently Fail."),
    blockedOnly: z.boolean().optional().describe("Run only testcases whose workbook Status is currently Blocker."),
    skipWorkbookUpdate: z.boolean().optional().describe("Report-only: don't write results back into the workbook."),
  },
  async (args) => {
    const { tcIds, folder, failedOnly, blockedOnly, ...rest } = args;
    const selector =
      tcIds?.length ? { tcIds } : folder ? { folder } : failedOnly ? { failedOnly } : blockedOnly ? { blockedOnly } : undefined;
    const result = await runCollectionTool({ ...rest, selector });
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], isError: result.blocked === true };
  }
);

server.tool(
  "postman_get_execution_results",
  "Reads back the last run's normalized, already-redacted execution-results.json.",
  { outDir: z.string().optional().describe("Execution output directory. Defaults to generated/execution.") },
  async (args) => ({ content: [{ type: "text", text: JSON.stringify(await getExecutionResultsTool(args), null, 2) }] })
);

server.tool(
  "postman_reconcile_results",
  "Re-runs TC_ID reconciliation against a prior execution-results.json without executing anything — for re-applying results after a manual workbook fix.",
  { ...buildPathArgs, outDir: z.string().optional() },
  async (args) => ({ content: [{ type: "text", text: JSON.stringify(await reconcileResultsTool(args), null, 2) }] })
);

server.tool(
  "postman_update_workbook",
  "Writes the last run's reconciled results into the SAME testcase workbook (Actual Status Code / Actual Response / Status / Bug Description only). Explicit, separate step from RUN.",
  { ...buildPathArgs, outDir: z.string().optional() },
  async (args) => ({ content: [{ type: "text", text: JSON.stringify(await updateWorkbookTool(args), null, 2) }] })
);

// ---- Start ----
const transport = new StdioServerTransport();
await server.connect(transport);
