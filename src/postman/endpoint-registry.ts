import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_DIR = path.resolve(__dirname, "..", "..", "registry");

export interface EndpointParam {
  name: string;
  in: "path" | "query";
  required: boolean;
  type: string;
  description?: string;
}

export interface EndpointDefinition {
  id: string;
  name: string;
  method: string;
  path: string;
  operationId: string;
  summary: string;
  parameters: EndpointParam[];
}

export interface ServiceDefinition {
  id: string;
  name: string;
  baseUrl: string;
  authentication: { headers: { name: string; description: string }[] };
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

export interface EndpointRegistry {
  service: ServiceDefinition;
  byId: Map<string, EndpointDefinition>;
  /** Keyed by the endpoint's human "name" — matches company-format "API Name" column. */
  byApiName: Map<string, EndpointDefinition>;
}

export function loadEndpointRegistry(): EndpointRegistry {
  const service = readJson<{ service: ServiceDefinition }>(
    path.join(REGISTRY_DIR, "service", "service.json")
  ).service;
  const index = readJson<{ serviceIndex: { endpoints: { id: string; file: string }[] } }>(
    path.join(REGISTRY_DIR, "endpoints", "index.json")
  ).serviceIndex.endpoints;

  const byId = new Map<string, EndpointDefinition>();
  const byApiName = new Map<string, EndpointDefinition>();

  for (const entry of index) {
    const ep = readJson<{ endpoint: EndpointDefinition }>(
      path.join(REGISTRY_DIR, "endpoints", entry.file)
    ).endpoint;
    byId.set(ep.id, ep);
    byApiName.set(ep.name, ep);
  }

  return { service, byId, byApiName };
}
