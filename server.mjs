import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

// ---- Start ----
const transport = new StdioServerTransport();
await server.connect(transport);
