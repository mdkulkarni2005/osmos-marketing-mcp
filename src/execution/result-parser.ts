import { extractTcId } from "./tc-id.js";
import { safeCaptureResponseBody } from "./redact.js";
import type { AssertionResult, ExecutionResult } from "./types.js";

/**
 * Minimal shape this parser depends on from a Newman run summary
 * (`summary.run.executions[]`). Deliberately not `import("newman").NewmanRunSummary`
 * — only the fields actually used are modeled, so hand-built fixture
 * objects (see fixtures/execution-fixtures.ts) satisfy this type without
 * needing to fabricate an entire Newman summary.
 */
export interface NewmanExecutionLike {
  item?: { name?: string };
  request?: {
    method?: string;
    url?: { toString?: () => string } | string;
    body?: { raw?: string };
  };
  response?: {
    code?: number;
    responseTime?: number;
    stream?: Buffer | string;
  };
  assertions?: { assertion?: string; error?: { message?: string } | null }[];
  requestError?: { message?: string } | null;
}

export interface NewmanSummaryLike {
  run?: { executions?: NewmanExecutionLike[] };
}

function requestUrlText(request: NewmanExecutionLike["request"]): string {
  if (!request?.url) return "";
  if (typeof request.url === "string") return request.url;
  return request.url.toString?.() ?? "";
}

function responseBodyText(response: NewmanExecutionLike["response"]): string | undefined {
  const stream = response?.stream;
  if (stream === undefined) return undefined;
  return typeof stream === "string" ? stream : stream.toString("utf-8");
}

const UNRESOLVED_VAR = /\{\{[a-zA-Z0-9_]+\}\}/;

/**
 * Normalizes one Newman run summary into this layer's ExecutionResult[].
 * Classification follows docs/local-execution.md's status mapping: PASS/FAIL
 * come from assertion outcomes (never HTTP status alone — see brief §7), and
 * anything that couldn't meaningfully execute (no assertions ran, a request
 * error, or an unresolved `{{variable}}` reaching the wire) is BLOCKED, not FAIL.
 */
export function parseNewmanSummary(summary: NewmanSummaryLike, executedAt: string = new Date().toISOString()): ExecutionResult[] {
  const executions = summary.run?.executions ?? [];
  const results: ExecutionResult[] = [];

  for (const exec of executions) {
    const requestName = exec.item?.name ?? "";
    const tcId = extractTcId(requestName);
    if (!tcId) {
      // A request with no [TC_ID] prefix should never reach execution —
      // collection-validator.ts blocks it at build time. If one shows up
      // anyway (e.g. reconciling an older/hand-edited report), it can't be
      // reconciled against any testcase; skip rather than fabricate an id.
      continue;
    }

    const method = exec.request?.method;
    const urlText = requestUrlText(exec.request);
    const bodyText = exec.request?.body?.raw;
    const statusCode = exec.response?.code;
    const responseTime = exec.response?.responseTime;
    const rawResponseBody = responseBodyText(exec.response);

    const assertions: AssertionResult[] = (exec.assertions ?? []).map((a) => ({
      name: a.assertion ?? "",
      passed: !a.error,
      error: a.error?.message,
    }));

    let result: ExecutionResult["result"];
    let error: string | undefined;

    if (exec.requestError) {
      result = "BLOCKED";
      error = `Infrastructure/request error: ${exec.requestError.message ?? "unknown error"}`;
    } else if (assertions.length === 0) {
      result = "BLOCKED";
      error = "No assertions executed for this request — nothing was verified.";
    } else if (UNRESOLVED_VAR.test(urlText) || (bodyText && UNRESOLVED_VAR.test(bodyText))) {
      result = "BLOCKED";
      const match = UNRESOLVED_VAR.exec(urlText) ?? (bodyText ? UNRESOLVED_VAR.exec(bodyText) : null);
      error = `BLOCKED: unresolved environment variable ${match?.[0] ?? "{{?}}"} reached the request — missing environment/secret value.`;
    } else {
      const failed = assertions.find((a) => !a.passed);
      if (failed) {
        result = "FAIL";
        error = failed.error
          ? `Assertion failed: ${failed.name} — ${failed.error}`
          : `Assertion failed: ${failed.name}`;
      } else {
        result = "PASS";
      }
    }

    results.push({
      tcId,
      method,
      requestName,
      statusCode,
      responseBody: safeCaptureResponseBody(rawResponseBody),
      responseTime,
      assertions,
      result,
      error,
      executedAt,
    });
  }

  return results;
}
