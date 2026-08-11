import type { PostmanCollection, PostmanFolder, PostmanItem } from "../schemas/collection.js";
import type { ExecutableTestcase } from "../schemas/testcase.js";
import { isFolder } from "../schemas/collection.js";

export interface ValidationFinding {
  severity: "critical" | "warning";
  tcId?: string;
  message: string;
}

export interface ValidationReport {
  passed: boolean; // false only if any "critical" finding exists — execution must not start
  findings: ValidationFinding[];
}

function flattenItems(items: (PostmanItem | PostmanFolder)[]): PostmanItem[] {
  const out: PostmanItem[] = [];
  for (const node of items) {
    if (isFolder(node)) out.push(...flattenItems(node.item));
    else out.push(node);
  }
  return out;
}

function extractTcId(itemName: string): string | undefined {
  const m = itemName.match(/^\[([^\]]+)\]/);
  return m?.[1];
}

const UNRESOLVED_PATH_PARAM = /\{[a-zA-Z0-9_]+\}(?!\})/; // single-brace, not part of {{var}}
const RAW_SECRET_HEADER_KEYS = new Set(["x-token", "authorization", "token"]);

/**
 * Validates a built collection before any execution is allowed. Anything
 * critical here must block execution (see docs/local-execution.md); warnings
 * are surfaced for human review but don't block a dry-run/build.
 */
export function validateCollection(
  collection: PostmanCollection,
  executableTestcases: ExecutableTestcase[],
  unresolved: { tcId: string; reason: string }[],
  nonExecutable: { tcId: string; reason: string }[]
): ValidationReport {
  const findings: ValidationFinding[] = [];
  const items = flattenItems(collection.item);

  // unresolved = the reader marked the row executable but the builder
  // couldn't find a matching endpoint — a real build error, blocks execution.
  for (const u of unresolved) {
    findings.push({
      severity: "critical",
      tcId: u.tcId,
      message: `Executable testcase produced no request: ${u.reason}`,
    });
  }

  // nonExecutable = the reader already determined, for a documented reason
  // (e.g. rate-limit gated), that this row isn't a single-request execution.
  // Expected, not a build error — surfaced for visibility only.
  for (const n of nonExecutable) {
    findings.push({
      severity: "warning",
      tcId: n.tcId,
      message: `Row intentionally has no request: ${n.reason}.`,
    });
  }

  const expectedTcIds = new Set(
    executableTestcases.filter((t) => t.executability.executable).map((t) => t.row.tcId)
  );
  const seenTcIds = new Map<string, number>();

  for (const item of items) {
    const tcId = extractTcId(item.name);
    if (!tcId) {
      findings.push({ severity: "critical", message: `Request "${item.name}" has no [TC_ID] prefix.` });
      continue;
    }
    seenTcIds.set(tcId, (seenTcIds.get(tcId) ?? 0) + 1);

    if (!item.request.method) {
      findings.push({ severity: "critical", tcId, message: "Request has no method." });
    }
    if (!item.request.url.raw || !item.request.url.raw.includes("{{base_url}}")) {
      findings.push({ severity: "critical", tcId, message: "Request URL does not use {{base_url}}." });
    }
    if (UNRESOLVED_PATH_PARAM.test(item.request.url.raw)) {
      findings.push({
        severity: "critical",
        tcId,
        message: `Request URL has an unresolved path parameter: ${item.request.url.raw}`,
      });
    }
    if (item.request.body?.raw) {
      try {
        // Body may contain {{var}} tokens inside string values, which is
        // still syntactically valid JSON — parse to confirm structure.
        JSON.parse(item.request.body.raw);
      } catch {
        findings.push({ severity: "critical", tcId, message: "Request body is not valid JSON." });
      }
    }
    for (const h of item.request.header) {
      if (RAW_SECRET_HEADER_KEYS.has(h.key.toLowerCase()) && !/^\{\{.*\}\}$/.test(h.value.trim())) {
        findings.push({
          severity: "critical",
          tcId,
          message: `Header "${h.key}" does not reference a Postman variable — possible embedded secret.`,
        });
      }
    }
    const testScript = item.event?.find((e) => e.listen === "test");
    const assertionCount = testScript?.script.exec.filter((line) => line.includes("pm.test(")).length ?? 0;
    if (assertionCount === 0) {
      // A request whose script is only comments/retry-bookkeeping (both
      // Expected Status Code and Expected Response were NOT_DOCUMENTED, or
      // blank) would otherwise pass validation, run in Newman, assert
      // nothing, and get reconciled as a silent Pass. Block it instead.
      findings.push({
        severity: "critical",
        tcId,
        message: "Request has no pm.test assertions — nothing would be verified if this ran.",
      });
    }
  }

  for (const [tcId, count] of seenTcIds) {
    if (count > 1) {
      findings.push({ severity: "critical", tcId, message: `TC_ID "${tcId}" appears in ${count} requests.` });
    }
  }

  for (const tcId of expectedTcIds) {
    if (!seenTcIds.has(tcId)) {
      findings.push({ severity: "critical", tcId, message: "Executable testcase has no corresponding request." });
    }
  }

  for (const tc of executableTestcases) {
    if (tc.row.tcType === "E2E") {
      findings.push({
        severity: "warning",
        tcId: tc.row.tcId,
        message:
          "E2E row: chain-variable extraction not generated (NOT_DOCUMENTED response field) — NEEDS_REVIEW before this step can run inside a workflow.",
      });
    }
  }

  const passed = !findings.some((f) => f.severity === "critical");
  return { passed, findings };
}
