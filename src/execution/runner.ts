import fs from "node:fs";
import path from "node:path";
import { readTestcaseWorkbook } from "../postman/workbook-reader.js";
import { loadEndpointRegistry } from "../postman/endpoint-registry.js";
import { buildCollection } from "../postman/collection-builder.js";
import { buildEnvironment } from "../postman/environment-builder.js";
import { validateCollection, type ValidationReport } from "../postman/collection-validator.js";
import type { PostmanCollection } from "../schemas/collection.js";
import type { PostmanEnvironment } from "../schemas/environment.js";
import type { ExecutableTestcase, StatusValue } from "../schemas/testcase.js";
import { runPreflight, type PreflightResult } from "./preflight.js";
import { filterCollectionByTcIds, collectionTcIds } from "./collection-filter.js";
import { parseNewmanSummary, type NewmanSummaryLike } from "./result-parser.js";
import { redactNewmanSummaryForReport } from "./redact.js";
import { reconcile, type ReconciliationReport } from "../reconciliation/testcase-mapper.js";
import { updateWorkbookWithResults } from "../reconciliation/workbook-updater.js";
import type { ExecutionResult, RunOptions, RunSelector } from "./types.js";

export interface RunReport {
  mode: RunOptions["mode"];
  collection: PostmanCollection;
  environment: PostmanEnvironment;
  validation: ValidationReport;
  preflight?: PreflightResult;
  executionResults?: ExecutionResult[];
  reconciliation?: ReconciliationReport;
  workbookUpdate?: { updatedRows: number; skipped: { tcId: string; reason: string }[] };
  blocked: boolean;
  blockReasons: string[];
}

/**
 * Builds the collection + environment fresh from the workbook (the same
 * verified pipeline as src/postman/dry-run.ts — see docs/postman-workflow.md)
 * and validates it. Shared by every mode: BUILD_ONLY/VALIDATE_ONLY/DRY_RUN
 * stop here; RUN uses this as its pre-execution step so a stale collection
 * can never be executed against a since-edited workbook.
 */
async function buildAndValidate(options: RunOptions) {
  const { testcases: allTestcases } = await readTestcaseWorkbook(options.workbookPath);
  const registry = loadEndpointRegistry();
  const { collection, usedVariables, unresolved, nonExecutable, bodyFieldWarnings } = buildCollection(
    allTestcases,
    registry,
    { collectionName: "OSMOS Marketing API - SPA Regression Suite" }
  );
  const environment = buildEnvironment(usedVariables, {
    serviceName: "OSMOS Marketing API",
    serviceVersion: "V1",
    suiteName: "Regression",
    baseUrl: registry.service.baseUrl,
  });
  const validation = validateCollection(collection, allTestcases, unresolved, nonExecutable, bodyFieldWarnings);

  return { allTestcases, collection, usedVariables, environment, validation };
}

function writeJson(filePath: string, data: unknown) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

/** Resolves a run selector into the concrete TC_ID set to execute. Never selects by row number. */
function resolveSelector(
  selector: RunSelector | undefined,
  testcases: ExecutableTestcase[],
  collectionTcIds: string[]
): Set<string> | undefined {
  if (!selector) return undefined;

  if (selector.tcIds && selector.tcIds.length > 0) {
    return new Set(selector.tcIds);
  }
  if (selector.folder) {
    const ids = testcases
      .filter((t) => t.row.apiName === selector.folder || t.row.sheetName === selector.folder)
      .map((t) => t.row.tcId);
    return new Set(ids);
  }
  const targetStatus: StatusValue | undefined = selector.failedOnly ? "Fail" : selector.blockedOnly ? "Blocker" : undefined;
  if (targetStatus) {
    const ids = testcases.filter((t) => t.row.status === targetStatus).map((t) => t.row.tcId);
    return new Set(ids);
  }
  return new Set(collectionTcIds);
}

async function runNewman(collection: PostmanCollection, environment: PostmanEnvironment): Promise<NewmanSummaryLike> {
  // Imported lazily: BUILD_ONLY/VALIDATE_ONLY/DRY_RUN (the only modes that
  // work on the home machine, per docs/local-execution.md) must never pull
  // in newman or touch the network as a side effect of importing this file.
  const newman = await import("newman");
  return new Promise((resolve, reject) => {
    newman.run(
      {
        collection: collection as unknown as Record<string, unknown>,
        environment: environment as unknown as Record<string, unknown>,
        iterationCount: 1,
        reporters: [],
      },
      (err, summary) => {
        if (err) reject(err);
        else resolve(summary as unknown as NewmanSummaryLike);
      }
    );
  });
}

function writeExecutionSummaryMarkdown(report: ReconciliationReport, outPath: string) {
  const byApi = new Map<string, { pass: number; fail: number; blocked: number; notExecuted: number }>();
  const byTcType = new Map<string, { pass: number; fail: number; blocked: number; notExecuted: number }>();
  const bump = (map: Map<string, any>, key: string, field: string) => {
    if (!map.has(key)) map.set(key, { pass: 0, fail: 0, blocked: 0, notExecuted: 0 });
    map.get(key)[field]++;
  };
  for (const m of report.matched) {
    const field = m.excelStatus === "Pass" ? "pass" : m.excelStatus === "Fail" ? "fail" : "blocked";
    bump(byApi, m.testcase.row.apiName, field);
    bump(byTcType, m.testcase.row.tcType, field);
  }
  for (const n of report.notExecuted) {
    bump(byApi, n.testcase.row.apiName, "notExecuted");
    bump(byTcType, n.testcase.row.tcType, "notExecuted");
  }

  const section = (title: string, map: Map<string, any>) =>
    `## By ${title}\n\n| ${title} | Pass | Fail | Blocked | Not Executed |\n|---|---|---|---|---|\n` +
    [...map.entries()].map(([k, v]) => `| ${k} | ${v.pass} | ${v.fail} | ${v.blocked} | ${v.notExecuted} |`).join("\n");

  const md = `# Execution Summary

Total testcases: ${report.summary.totalTestcases}
Executable: ${report.summary.executable}
Executed (matched): ${report.summary.matched}
Passed: ${report.summary.pass}
Failed: ${report.summary.fail}
Blocked: ${report.summary.blocked}
Not executed: ${report.summary.notExecuted}
Unmatched results: ${report.summary.unmatchedResults}
Duplicate results: ${report.summary.duplicateResults}
Non-executable (workbook-gated, untouched): ${report.summary.nonExecutable}

${section("API", byApi)}

${section("TC Type", byTcType)}
`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
}

/**
 * The single entry point for every mode. BUILD_ONLY/VALIDATE_ONLY/DRY_RUN
 * never execute a request and never require realEnvironmentPath — those
 * work on the home machine with zero credentials (brief §18). RUN requires
 * confirmRun=true and a realEnvironmentPath with actual secret values, and
 * is refused (blocked=true, no request sent) if preflight finds anything
 * missing — see preflight.ts.
 */
export async function runExecution(options: RunOptions): Promise<RunReport> {
  const { collection, environment, usedVariables, allTestcases, validation } = await buildAndValidate(options);

  writeJson(options.collectionPath, collection);
  writeJson(options.environmentPath, environment);

  if (options.mode === "BUILD_ONLY") {
    return { mode: options.mode, collection, environment, validation, blocked: false, blockReasons: [] };
  }

  if (options.mode === "VALIDATE_ONLY" || options.mode === "DRY_RUN") {
    return {
      mode: options.mode,
      collection,
      environment,
      validation,
      blocked: !validation.passed,
      blockReasons: validation.passed ? [] : ["Validation failed — see validation.findings."],
    };
  }

  // ---- RUN ----
  if (!options.realEnvironmentPath) {
    return {
      mode: "RUN",
      collection,
      environment,
      validation,
      blocked: true,
      blockReasons: ["RUN mode requires realEnvironmentPath (a local, gitignored environment file with real values)."],
    };
  }
  if (!fs.existsSync(options.realEnvironmentPath)) {
    return {
      mode: "RUN",
      collection,
      environment,
      validation,
      blocked: true,
      blockReasons: [`realEnvironmentPath does not exist: ${options.realEnvironmentPath}`],
    };
  }
  const realEnvironment: PostmanEnvironment = JSON.parse(fs.readFileSync(options.realEnvironmentPath, "utf-8"));

  const preflight = runPreflight({
    mode: "RUN",
    validation,
    environment: realEnvironment,
    usedVariables,
    confirmRun: options.confirmRun,
    allowProductionUrl: options.allowProductionUrl,
  });

  if (!preflight.allowed) {
    return {
      mode: "RUN",
      collection,
      environment,
      validation,
      preflight,
      blocked: true,
      blockReasons: preflight.blockers,
    };
  }

  const selectedTcIds = resolveSelector(options.selector, allTestcases, collectionTcIds(collection));
  const runCollection = selectedTcIds ? filterCollectionByTcIds(collection, selectedTcIds) : collection;

  const summary = await runNewman(runCollection, realEnvironment);

  fs.mkdirSync(options.outDir, { recursive: true });
  writeJson(path.join(options.outDir, "redacted-newman-report.json"), redactNewmanSummaryForReport(summary));

  const executionResults = parseNewmanSummary(summary);
  writeJson(path.join(options.outDir, "execution-results.json"), executionResults);

  const reconciliation = reconcile(allTestcases, executionResults);
  writeExecutionSummaryMarkdown(reconciliation, path.join(options.outDir, "execution-summary.md"));

  let workbookUpdate: RunReport["workbookUpdate"];
  if (!options.skipWorkbookUpdate) {
    const updateResult = await updateWorkbookWithResults(options.workbookPath, reconciliation.matched);
    workbookUpdate = { updatedRows: updateResult.updatedRows.length, skipped: updateResult.skipped };
  }

  return {
    mode: "RUN",
    collection,
    environment,
    validation,
    preflight,
    executionResults,
    reconciliation,
    workbookUpdate,
    blocked: false,
    blockReasons: [],
  };
}
