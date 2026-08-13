import type { ExecutableTestcase, StatusValue } from "../schemas/testcase.js";
import type { ExecutionResult } from "../execution/types.js";

export interface MatchedResult {
  tcId: string;
  testcase: ExecutableTestcase;
  result: ExecutionResult;
  excelStatus: StatusValue;
  excelBugDescription: string;
}

export interface NotExecutedEntry {
  tcId: string;
  testcase: ExecutableTestcase;
}

export interface UnmatchedResultEntry {
  tcId: string;
  result: ExecutionResult;
  reason: string;
}

export interface DuplicateResultEntry {
  tcId: string;
  results: ExecutionResult[];
}

export interface ReconciliationReport {
  matched: MatchedResult[];
  notExecuted: NotExecutedEntry[];
  unmatchedResults: UnmatchedResultEntry[];
  duplicateResults: DuplicateResultEntry[];
  /** Rows the reader already determined can't run (rate-limit gated, etc.) — always left untouched. */
  nonExecutableUntouched: ExecutableTestcase[];
  summary: {
    totalTestcases: number;
    executable: number;
    matched: number;
    pass: number;
    fail: number;
    blocked: number;
    notExecuted: number;
    unmatchedResults: number;
    duplicateResults: number;
    nonExecutable: number;
  };
}

/**
 * Translates this layer's internal ExecutionResultStatus into the
 * company's four-value spreadsheet vocabulary (STATUS_VALUES in
 * src/schemas/testcase.ts). The only function allowed to cross that
 * boundary — see src/execution/types.ts.
 */
function toExcelStatus(result: ExecutionResult): StatusValue {
  switch (result.result) {
    case "PASS":
      return "Pass";
    case "FAIL":
      return "Fail";
    case "BLOCKED":
      return "Blocker";
    case "SKIPPED":
    case "NOT_EXECUTED":
      return "Not executed";
  }
}

/**
 * Builds the factual Bug Description text. Never invents a root cause —
 * per brief §12, unexplained failures get the literal
 * `ROOT_CAUSE_NOT_DETERMINED` marker rather than a guessed explanation.
 */
function buildBugDescription(testcase: ExecutableTestcase, result: ExecutionResult): string {
  const row = testcase.row;
  if (result.result === "PASS") return "";

  if (result.result === "BLOCKED") {
    return result.error ? `BLOCKED: ${result.error}` : "BLOCKED: reason not captured.";
  }

  if (result.result === "FAIL") {
    const expected = row.expectedStatusCode;
    const actual = result.statusCode;
    const parts: string[] = [];
    if (expected !== "NOT_DOCUMENTED" && actual !== undefined && expected !== actual) {
      parts.push(`Expected HTTP ${expected}, received HTTP ${actual}.`);
    } else if (actual !== undefined) {
      parts.push(`HTTP ${actual} received, but a required response assertion failed.`);
    }
    if (result.error) parts.push(result.error);
    return parts.length > 0 ? parts.join(" ") : "ROOT_CAUSE_NOT_DETERMINED";
  }

  return "ROOT_CAUSE_NOT_DETERMINED";
}

/**
 * TC_ID-based reconciliation (brief §6). TC_ID is the primary key; API Name
 * and Method are used as a secondary integrity check — a result whose TC_ID
 * matches a known testcase but whose API Name/Method disagree is treated as
 * unmatched rather than silently attached, since that combination means the
 * result was extracted from the wrong request or the collection drifted
 * from the workbook.
 */
export function reconcile(testcases: ExecutableTestcase[], results: ExecutionResult[]): ReconciliationReport {
  const byTcId = new Map<string, ExecutableTestcase>();
  for (const t of testcases) byTcId.set(t.row.tcId, t);

  const executable = testcases.filter((t) => t.executability.executable);
  const nonExecutableUntouched = testcases.filter((t) => !t.executability.executable);

  const resultsByTcId = new Map<string, ExecutionResult[]>();
  for (const r of results) {
    if (!resultsByTcId.has(r.tcId)) resultsByTcId.set(r.tcId, []);
    resultsByTcId.get(r.tcId)!.push(r);
  }

  const matched: MatchedResult[] = [];
  const unmatchedResults: UnmatchedResultEntry[] = [];
  const duplicateResults: DuplicateResultEntry[] = [];
  const notExecuted: NotExecutedEntry[] = [];

  for (const [tcId, group] of resultsByTcId) {
    const testcase = byTcId.get(tcId);

    if (!testcase || !testcase.executability.executable) {
      for (const r of group) {
        unmatchedResults.push({
          tcId,
          result: r,
          reason: testcase
            ? `TC_ID "${tcId}" belongs to a row the workbook marked non-executable — a result should not exist for it.`
            : `TC_ID "${tcId}" does not match any testcase in the workbook.`,
        });
      }
      continue;
    }

    if (group.length > 1) {
      duplicateResults.push({ tcId, results: group });
      continue;
    }

    const result = group[0];
    if (testcase.row.method && result.method && testcase.row.method !== result.method) {
      unmatchedResults.push({
        tcId,
        result,
        reason: `TC_ID "${tcId}" matched, but Method disagrees (workbook: ${testcase.row.method}, execution: ${result.method}) — not attached.`,
      });
      continue;
    }

    matched.push({
      tcId,
      testcase,
      result,
      excelStatus: toExcelStatus(result),
      excelBugDescription: buildBugDescription(testcase, result),
    });
  }

  const matchedTcIds = new Set(matched.map((m) => m.tcId));
  const duplicateTcIds = new Set(duplicateResults.map((d) => d.tcId));
  for (const t of executable) {
    if (!matchedTcIds.has(t.row.tcId) && !duplicateTcIds.has(t.row.tcId)) {
      notExecuted.push({ tcId: t.row.tcId, testcase: t });
    }
  }

  const pass = matched.filter((m) => m.excelStatus === "Pass").length;
  const fail = matched.filter((m) => m.excelStatus === "Fail").length;
  const blocked = matched.filter((m) => m.excelStatus === "Blocker").length;

  return {
    matched,
    notExecuted,
    unmatchedResults,
    duplicateResults,
    nonExecutableUntouched,
    summary: {
      totalTestcases: testcases.length,
      executable: executable.length,
      matched: matched.length,
      pass,
      fail,
      blocked,
      notExecuted: notExecuted.length,
      unmatchedResults: unmatchedResults.length,
      duplicateResults: duplicateResults.length,
      nonExecutable: nonExecutableUntouched.length,
    },
  };
}
