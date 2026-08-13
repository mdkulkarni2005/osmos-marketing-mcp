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

export interface JsonSchemaObject {
  type?: string;
  required?: string[];
  properties?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface EndpointDefinition {
  id: string;
  name: string;
  method: string;
  path: string;
  operationId: string;
  summary: string;
  parameters: EndpointParam[];
  requestBody?: {
    required: boolean;
    contentType: string;
    schema: JsonSchemaObject;
  };
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
  /** Keyed by a whitespace/case-normalized form of the name — fallback for typos/casing drift in the workbook cell. */
  byNormalizedName: Map<string, EndpointDefinition[]>;
}

/** Collapses internal whitespace and lowercases, so "Create  SPA Campaign " and "create spa campaign" resolve the same. */
function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export type EndpointResolution =
  | { status: "resolved"; endpoint: EndpointDefinition; matchedBy: "exact" | "normalized" }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: EndpointDefinition[] };

/**
 * The single place "API Name" text is turned into a registry endpoint.
 * Never guesses: an exact match on the registry's canonical `name` wins; a
 * normalized (case/whitespace-insensitive) match is used only as a fallback
 * and only when it resolves to exactly one endpoint. Two endpoints
 * colliding under normalization is reported as `ambiguous` rather than
 * silently picking one — that's how a request would otherwise get built
 * against the wrong URL.
 */
export function resolveEndpoint(registry: EndpointRegistry, apiName: string): EndpointResolution {
  const exact = registry.byApiName.get(apiName);
  if (exact) return { status: "resolved", endpoint: exact, matchedBy: "exact" };

  const candidates = registry.byNormalizedName.get(normalizeName(apiName)) ?? [];
  if (candidates.length === 1) return { status: "resolved", endpoint: candidates[0], matchedBy: "normalized" };
  if (candidates.length > 1) return { status: "ambiguous", candidates };
  return { status: "not_found" };
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
  const byNormalizedName = new Map<string, EndpointDefinition[]>();

  for (const entry of index) {
    const ep = readJson<{ endpoint: EndpointDefinition }>(
      path.join(REGISTRY_DIR, "endpoints", entry.file)
    ).endpoint;
    byId.set(ep.id, ep);
    byApiName.set(ep.name, ep);
    const norm = normalizeName(ep.name);
    byNormalizedName.set(norm, [...(byNormalizedName.get(norm) ?? []), ep]);
  }

  return { service, byId, byApiName, byNormalizedName };
}
