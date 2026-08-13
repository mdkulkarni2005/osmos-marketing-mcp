/**
 * Minimal Postman Collection v2.1 schema subset — only the shapes this
 * project's builders actually emit. Not a full port of the official
 * collection JSON schema.
 */

export interface PostmanHeader {
  key: string;
  value: string;
  type?: "text" | "default";
}

export interface PostmanScript {
  type: "text/javascript";
  exec: string[];
}

export interface PostmanEventListener {
  listen: "prerequest" | "test";
  script: PostmanScript;
}

export interface PostmanUrl {
  raw: string;
  host?: string[];
  path?: string[];
  query?: { key: string; value: string }[];
}

export interface PostmanBody {
  mode: "raw";
  raw: string;
  options?: { raw: { language: "json" } };
}

export interface PostmanRequest {
  method: string;
  header: PostmanHeader[];
  body?: PostmanBody;
  url: PostmanUrl;
}

export interface PostmanItem {
  name: string;
  event?: PostmanEventListener[];
  request: PostmanRequest;
  /** TC_ID + provenance carried in item-level metadata for traceability. */
  description?: string;
}

export interface PostmanFolder {
  name: string;
  item: (PostmanItem | PostmanFolder)[];
}

export interface PostmanCollection {
  info: {
    name: string;
    schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
    _postman_id?: string;
    description?: string;
  };
  auth?: {
    type: "bearer";
    bearer: { key: "token"; value: string; type: "string" }[];
  };
  event?: PostmanEventListener[];
  variable?: { key: string; value: string; type?: "string" }[];
  item: (PostmanItem | PostmanFolder)[];
}

export function isFolder(node: PostmanItem | PostmanFolder): node is PostmanFolder {
  return Array.isArray((node as PostmanFolder).item);
}
