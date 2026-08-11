import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readTestcaseWorkbook } from "../postman/workbook-reader.js";
import { runExecution } from "./runner.js";
import { runPreflight } from "./preflight.js";
import { reconcile } from "../reconciliation/testcase-mapper.js";
import { updateWorkbookWithResults } from "../reconciliation/workbook-updater.js";
import type { PostmanEnvironment } from "../schemas/environment.js";
import type { ExecutionResult, RunSelector } from "./types.js";

/**
 * Thin, narrowly-scoped functions behind each MCP tool in server.mjs — one
 * responsibility each, JSON-serializable in and out, no MCP/SDK types
 * leaking in here. server.mjs is expected to do argument parsing and
 * response wrapping only; every actual decision (build/validate/run/
 * reconcile/update) happens in src/execution + src/postman.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

export const DEFAULT_PATHS = {
  workbookPath: path.join(ROOT, "generated", "fixtures", "SPA-API-Test-Suite.fixture.xlsx"),
  collectionPath: path.join(ROOT, "generated", "collections", "OSMOS-SPA-Regression.postman_collection.json"),
  environmentPath: path.join(ROOT, "generated", "environments", "OSMOS-SPA-Regression.postman_environment.json"),
  outDir: path.join(ROOT, "generated", "execution"),
};

export interface BuildArgs {
  workbookPath?: string;
  collectionPath?: string;
  environmentPath?: string;
}

function resolvePaths(args: BuildArgs) {
  return {
    workbookPath: args.workbookPath ?? DEFAULT_PATHS.workbookPath,
    collectionPath: args.collectionPath ?? DEFAULT_PATHS.collectionPath,
    environmentPath: args.environmentPath ?? DEFAULT_PATHS.environmentPath,
    outDir: DEFAULT_PATHS.outDir,
  };
}

/** postman_build_collection — BUILD_ONLY. No credentials, no execution. */
export async function buildCollectionTool(args: BuildArgs) {
  const paths = resolvePaths(args);
  const report = await runExecution({ mode: "BUILD_ONLY", ...paths });
  return {
    collectionPath: paths.collectionPath,
    requestCount: countRequests(report.collection),
    findingsCount: report.validation.findings.length,
  };
}

/** postman_build_environment — same BUILD_ONLY pipeline (env depends on the built collection's used variables), surfaced as its own tool per the brief's tool list. */
export async function buildEnvironmentTool(args: BuildArgs) {
  const paths = resolvePaths(args);
  const report = await runExecution({ mode: "BUILD_ONLY", ...paths });
  return {
    environmentPath: paths.environmentPath,
    variableCount: report.environment.values.length,
    variables: report.environment.values.map((v) => ({ key: v.key, type: v.type })), // never values
  };
}

/** postman_validate_collection — VALIDATE_ONLY. Rebuilds fresh from the workbook so it can never validate a stale artifact. */
export async function validateCollectionTool(args: BuildArgs) {
  const paths = resolvePaths(args);
  const report = await runExecution({ mode: "VALIDATE_ONLY", ...paths });
  return { passed: report.validation.passed, findings: report.validation.findings };
}

export interface ValidateEnvironmentArgs extends BuildArgs {
  /** Path to the environment to validate. Defaults to the generated placeholder (never a real-secrets file unless the caller passes one explicitly). */
  environmentToCheckPath?: string;
  allowProductionUrl?: boolean;
}

/**
 * postman_validate_environment — checks a real (or placeholder) environment
 * file against the collection's actual required variables, without
 * executing anything. Distinct from postman_build_environment: that one
 * generates a safe placeholder template; this one audits an environment
 * (typically the office machine's real one) for completeness before RUN.
 */
export async function validateEnvironmentTool(args: ValidateEnvironmentArgs) {
  const paths = resolvePaths(args);
  const buildReport = await runExecution({ mode: "BUILD_ONLY", ...paths });

  const envPath = args.environmentToCheckPath ?? paths.environmentPath;
  if (!fs.existsSync(envPath)) {
    return { allowed: false, blockers: [`Environment file does not exist: ${envPath}`], warnings: [] };
  }
  const environment: PostmanEnvironment = JSON.parse(fs.readFileSync(envPath, "utf-8"));
  const usedVariables = buildReport.environment.values.map((v) => v.key);

  return runPreflight({
    mode: "RUN",
    validation: buildReport.validation,
    environment,
    usedVariables,
    confirmRun: true, // this tool only audits; RUN's own confirmRun gate is enforced separately by postman_run_collection
    allowProductionUrl: args.allowProductionUrl,
  });
}

export interface RunCollectionArgs extends BuildArgs {
  realEnvironmentPath: string;
  confirmRun: boolean;
  allowProductionUrl?: boolean;
  selector?: RunSelector;
  skipWorkbookUpdate?: boolean;
}

/**
 * postman_run_collection — the only tool that can execute a real request.
 * Requires confirmRun=true explicitly; never triggered as a side effect of
 * any other tool call (brief §17).
 */
export async function runCollectionTool(args: RunCollectionArgs) {
  const paths = resolvePaths(args);
  const report = await runExecution({
    mode: "RUN",
    ...paths,
    realEnvironmentPath: args.realEnvironmentPath,
    confirmRun: args.confirmRun,
    allowProductionUrl: args.allowProductionUrl,
    selector: args.selector,
    skipWorkbookUpdate: args.skipWorkbookUpdate,
  });

  if (report.blocked) {
    return { blocked: true, blockReasons: report.blockReasons, preflight: report.preflight };
  }
  return {
    blocked: false,
    executedCount: report.executionResults?.length ?? 0,
    reconciliationSummary: report.reconciliation?.summary,
    workbookUpdate: report.workbookUpdate,
  };
}

export interface GetExecutionResultsArgs {
  outDir?: string;
}

/** postman_get_execution_results — reads back the last run's already-redacted execution-results.json. */
export async function getExecutionResultsTool(args: GetExecutionResultsArgs) {
  const outDir = args.outDir ?? DEFAULT_PATHS.outDir;
  const filePath = path.join(outDir, "execution-results.json");
  if (!fs.existsSync(filePath)) {
    return { found: false, message: `No execution results at ${filePath}. Run postman_run_collection first.` };
  }
  const results: ExecutionResult[] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  return { found: true, filePath, count: results.length, results };
}

export interface ReconcileResultsArgs extends BuildArgs {
  outDir?: string;
}

/**
 * postman_reconcile_results — re-runs reconciliation against a prior
 * execution-results.json without executing anything (docs/local-execution.md's
 * "reconcile" mode) — for re-applying results after a manual fix to the
 * workbook or the results file.
 */
export async function reconcileResultsTool(args: ReconcileResultsArgs) {
  const paths = resolvePaths(args);
  const outDir = args.outDir ?? DEFAULT_PATHS.outDir;
  const resultsPath = path.join(outDir, "execution-results.json");
  if (!fs.existsSync(resultsPath)) {
    return { found: false, message: `No execution results at ${resultsPath}. Run postman_run_collection first.` };
  }
  const executionResults: ExecutionResult[] = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  const { testcases } = await readTestcaseWorkbook(paths.workbookPath);
  const report = reconcile(testcases, executionResults);
  return { summary: report.summary, unmatchedResults: report.unmatchedResults, duplicateResults: report.duplicateResults };
}

export interface UpdateWorkbookArgs extends BuildArgs {
  outDir?: string;
}

/**
 * postman_update_workbook — writes reconciled results into the workbook's
 * Actual Status Code / Actual Response / Status / Bug Description columns
 * only. A separate, explicit step from RUN (which can skip this via
 * skipWorkbookUpdate) and from reconcile (report-only, no file mutation).
 */
export async function updateWorkbookTool(args: UpdateWorkbookArgs) {
  const paths = resolvePaths(args);
  const outDir = args.outDir ?? DEFAULT_PATHS.outDir;
  const resultsPath = path.join(outDir, "execution-results.json");
  if (!fs.existsSync(resultsPath)) {
    return { found: false, message: `No execution results at ${resultsPath}. Run postman_run_collection first.` };
  }
  const executionResults: ExecutionResult[] = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
  const { testcases } = await readTestcaseWorkbook(paths.workbookPath);
  const report = reconcile(testcases, executionResults);
  const updateResult = await updateWorkbookWithResults(paths.workbookPath, report.matched);
  return {
    workbookPath: paths.workbookPath,
    updatedRows: updateResult.updatedRows.length,
    skipped: updateResult.skipped,
  };
}

function countRequests(collection: { item: unknown[] }): number {
  let count = 0;
  const isFolder = (n: any) => Array.isArray(n?.item);
  const walk = (nodes: any[]) => {
    for (const n of nodes) {
      if (isFolder(n)) walk(n.item);
      else count++;
    }
  };
  walk(collection.item as any[]);
  return count;
}
