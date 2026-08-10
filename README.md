# OSMOS Marketing API MCP Server

Model Context Protocol server that exposes the OSMOS Marketing API registry as callable tools, so an AI agent can discover endpoints and make real API calls.

## Structure

```
api_mcp/
├── server.mjs                  # MCP server (stdio transport)
├── package.json
├── registry/
│   ├── index.json              # Root registry (lists services)
│   ├── service/
│   │   └── service.json        # Service definition (base URL, auth, hierarchy)
│   └── endpoints/
│       ├── index.json          # Endpoint index (15 endpoints)
│       └── *.json              # One file per endpoint (OpenAPI-derived)
```

## How it works

1. `server.mjs` loads the registry JSON files at startup.
2. It registers a **tool for every endpoint** in `registry/endpoints/index.json` (named by converting `id` to snake_case, e.g. `create-spa-campaign` → `create_spa_campaign`).
3. Each endpoint tool accepts path params, query params, an optional `body`, plus `x_token` and `x_retailer_id` auth headers.
4. Calling a tool performs the real HTTP request against `https://apiv2.onlinesales.ai/marketing/v1/advertiser` and returns status + parsed response.

### Built-in tools
- `list_endpoints` — list all endpoints (method, path, summary)
- `get_service_details` — service definition (base URL, auth, hierarchy)
- `get_endpoint_definition` — full schema for one endpoint by id

### Resources
- `osmos://service` — service definition
- `osmos://endpoints` — endpoint index

### Prompt
- `campaign-hierarchy` — explains the campaign hierarchy before acting

## Run

```bash
npm install
npm start
```

The server speaks MCP over stdio. Connect it from any MCP client (e.g. Claude Desktop, opencode) using:

```json
{
  "mcpServers": {
    "osmos-marketing": {
      "command": "node",
      "args": ["/absolute/path/to/api_mcp/server.mjs"]
    }
  }
}
```

## Auth

Every API call requires both headers — they are passed as `x_token` and `x_retailer_id` tool arguments:

```
x-token:        Authentication token
x-retailer-id:  Retailer identifier
```

Without both, the tool returns a clear error explaining they are required.

## Adding a new endpoint

1. Add `registry/endpoints/<endpoint-id>.json` following the existing schema pattern (fields: `endpoint.id`, `method`, `path`, `operationId`, `summary`, `description`, `parameters`, `requestBody`, `responses`, `deprecated`).
2. Add an entry to `registry/endpoints/index.json`.
3. Restart the server — the new endpoint tool is registered automatically.
