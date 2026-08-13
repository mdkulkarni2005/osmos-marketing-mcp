/**
 * Execution-layer types. Two status vocabularies exist on purpose:
 *
 * - `ExecutionResultStatus` is this layer's internal, richer taxonomy
 *   (matches the brief's PASS/FAIL/BLOCKED/NOT_EXECUTED/SKIPPED).
 * - `StatusValue` (src/schemas/testcase.ts) is the company's four-value
 *   spreadsheet vocabulary (`Not executed` / `Pass` / `Fail` / `Blocker`).
 *
 * Only reconciliation/testcase-mapper.ts's `toExcelStatus` may translate
 * between them — never write an `ExecutionResultStatus` value into a
 * workbook Status cell directly.
 */
export const EXECUTION_MODES = ["BUILD_ONLY", "VALIDATE_ONLY", "DRY_RUN", "RUN"] as const;
export type ExecutionMode = (typeof EXECUTION_MODES)[number];

export const EXECUTION_RESULT_STATUSES = ["PASS", "FAIL", "BLOCKED", "SKIPPED", "NOT_EXECUTED"] as const;
export type ExecutionResultStatus = (typeof EXECUTION_RESULT_STATUSES)[number];

export interface AssertionResult {
  name: string;
  passed: boolean;
  error?: string;
}

export interface ExecutionResult {
  tcId: string;
  apiName?: string;
  method?: string;
  requestName: string;
  statusCode?: number;
  /** Redacted, possibly truncated. Never the raw Newman stream. */
  responseBody?: string;
  responseTime?: number;
  assertions: AssertionResult[];
  result: ExecutionResultStatus;
  error?: string;
  executedAt: string;
}

/** A request selector for a rerun. Exactly one field should be set. */
export interface RunSelector {
  tcIds?: string[];
  folder?: string;
  failedOnly?: boolean;
  blockedOnly?: boolean;
}

export interface RunOptions {
  mode: ExecutionMode;
  collectionPath: string;
  /** Placeholder/generated environment (no real values) — always safe to read on the home machine. */
  environmentPath: string;
  /** Real, local, gitignored environment with actual secret values. Required only for RUN. */
  realEnvironmentPath?: string;
  workbookPath: string;
  outDir: string;
  selector?: RunSelector;
  /** RUN executes real API calls; must be explicitly true or RUN is blocked. */
  confirmRun?: boolean;
  /** Detected-production-URL override; must be explicitly true to run against a suspected prod base URL. */
  allowProductionUrl?: boolean;
  /** Skip writing reconciliation results back into the workbook (report-only). */
  skipWorkbookUpdate?: boolean;
}
