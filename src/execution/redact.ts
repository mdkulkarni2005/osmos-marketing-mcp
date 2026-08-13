/**
 * Redaction used everywhere the execution layer touches disk or an Excel
 * cell. Never persist a real token/secret/cookie/password value.
 */

const REDACT_HEADER_KEYS = new Set([
  "x-token",
  "authorization",
  "token",
  "cookie",
  "set-cookie",
  "api-key",
  "x-api-key",
  "client-secret",
]);

/** Header field names that must never appear with a real value in a JSON body either. */
const REDACT_BODY_FIELD_NAMES = [
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "password",
  "secret",
  "client_secret",
  "authorization",
  "cookie",
  "api_key",
  "apikey",
  "x-token",
];

export function redactHeaderValue(key: string, value: string): string {
  return REDACT_HEADER_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : value;
}

export function redactHeaders<T extends { key: string; value: string }>(headers: T[]): T[] {
  return headers.map((h) => ({ ...h, value: redactHeaderValue(h.key, h.value) }));
}

/**
 * Best-effort redaction of a response/request JSON body: walks the parsed
 * structure and blanks any field whose name matches a known secret field.
 * Falls back to returning the text unchanged if it isn't valid JSON — plain
 * text bodies aren't scanned field-by-field, since there's no reliable
 * structure to redact from; callers relying on secret-bearing plain-text
 * bodies must redact before calling this.
 */
export function redactJsonBodyText(text: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return text;
  }
  const redacted = redactJsonValue(parsed);
  return JSON.stringify(redacted);
}

function redactJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactJsonValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_BODY_FIELD_NAMES.includes(k.toLowerCase()) ? "[REDACTED]" : redactJsonValue(v);
    }
    return out;
  }
  return value;
}

const MAX_RESPONSE_CHARS = 10_000;

/** Redacts, then truncates for safe storage (Excel cell / JSON report). */
export function safeCaptureResponseBody(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const redacted = redactJsonBodyText(raw);
  if (redacted.length <= MAX_RESPONSE_CHARS) return redacted;
  return `${redacted.slice(0, MAX_RESPONSE_CHARS)}\n...[truncated, ${redacted.length - MAX_RESPONSE_CHARS} more chars]`;
}

/**
 * Strips real values out of a Newman run summary before it's written to
 * disk as `redacted-newman-report.json`. Newman embeds the *resolved*
 * environment and collection variables (including secrets) plus response
 * headers/cookies — all of that must be scrubbed, not just per-request
 * Authorization headers.
 */
export function redactNewmanSummaryForReport(summary: unknown): unknown {
  if (!summary || typeof summary !== "object") return summary;
  const clone = JSON.parse(JSON.stringify(summary));

  const redactVarList = (values: unknown) => {
    if (!Array.isArray(values)) return;
    for (const v of values) {
      if (v && typeof v === "object" && "key" in v) {
        (v as Record<string, unknown>).value = "[REDACTED]";
      }
    }
  };
  redactVarList(clone?.environment?.values);
  redactVarList(clone?.collection?.variable);
  redactVarList(clone?.globals?.values);

  const executions = clone?.run?.executions;
  if (Array.isArray(executions)) {
    for (const exec of executions) {
      if (exec?.request?.header) exec.request.header = redactHeaders(exec.request.header);
      if (exec?.request?.body?.raw) exec.request.body.raw = redactJsonBodyText(String(exec.request.body.raw));
      if (exec?.response?.header) exec.response.header = redactHeaders(exec.response.header);
      if (exec?.response?.cookie) exec.response.cookie = "[REDACTED]";
      if (exec?.response?.stream) delete exec.response.stream;
    }
  }
  return clone;
}
