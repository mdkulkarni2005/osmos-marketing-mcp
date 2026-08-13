import path from "node:path";
import { fileURLToPath } from "node:url";
import { runExecution } from "./runner.js";
import type { ExecutionMode, RunSelector } from "./types.js";
import { EXECUTION_MODES } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

/**
 * Manual argv parsing — no CLI-args dependency needed for this small a
 * surface. Usage:
 *
 *   node dist/execution/cli.js --mode=DRY_RUN
 *   node dist/execution/cli.js --mode=RUN --confirm-run \
 *     --real-environment=/local/office-env.postman_environment.json \
 *     [--tc-ids=CSC_001,CSC_002 | --folder="Create SPA Campaign" | --failed-only | --blocked-only]
 */
function parseArgs(argv: string[]) {
  const flags: Record<string, string | boolean> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, value] = arg.slice(2).split(/=(.*)/s);
    flags[key] = value ?? true;
  }
  return flags;
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));

  const mode = String(flags.mode ?? "DRY_RUN") as ExecutionMode;
  if (!EXECUTION_MODES.includes(mode)) {
    console.error(`Unknown --mode "${mode}". Expected one of: ${EXECUTION_MODES.join(", ")}`);
    process.exit(1);
  }

  const selector: RunSelector | undefined = flags["tc-ids"]
    ? { tcIds: String(flags["tc-ids"]).split(",").map((s) => s.trim()) }
    : flags.folder
      ? { folder: String(flags.folder) }
      : flags["failed-only"]
        ? { failedOnly: true }
        : flags["blocked-only"]
          ? { blockedOnly: true }
          : undefined;

  const report = await runExecution({
    mode,
    collectionPath:
      String(flags.collection ?? path.join(ROOT, "generated", "collections", "OSMOS-SPA-Regression.postman_collection.json")),
    environmentPath:
      String(flags.environment ?? path.join(ROOT, "generated", "environments", "OSMOS-SPA-Regression.postman_environment.json")),
    realEnvironmentPath: flags["real-environment"] ? String(flags["real-environment"]) : undefined,
    workbookPath: String(flags.workbook ?? path.join(ROOT, "generated", "fixtures", "SPA-API-Test-Suite.fixture.xlsx")),
    outDir: String(flags.out ?? path.join(ROOT, "generated", "execution")),
    selector,
    confirmRun: Boolean(flags["confirm-run"]),
    allowProductionUrl: Boolean(flags["allow-production-url"]),
    skipWorkbookUpdate: Boolean(flags["skip-workbook-update"]),
  });

  console.log(`\n=== Mode: ${report.mode} ===`);
  console.log(`Validation passed: ${report.validation.passed}`);
  for (const f of report.validation.findings) {
    console.log(`  [${f.severity}]${f.tcId ? ` ${f.tcId}` : ""} ${f.message}`);
  }
  if (report.preflight) {
    console.log(`\nPreflight allowed: ${report.preflight.allowed}`);
    for (const b of report.preflight.blockers) console.log(`  [BLOCKER] ${b}`);
    for (const w of report.preflight.warnings) console.log(`  [WARNING] ${w}`);
  }
  if (report.blocked) {
    console.error(`\nEXECUTION BLOCKED:`);
    for (const r of report.blockReasons) console.error(`  - ${r}`);
    process.exit(1);
  }
  if (report.reconciliation) {
    console.log(`\n=== Reconciliation summary ===`);
    console.log(JSON.stringify(report.reconciliation.summary, null, 2));
  }
  if (report.workbookUpdate) {
    console.log(`\nWorkbook rows updated: ${report.workbookUpdate.updatedRows}`);
    if (report.workbookUpdate.skipped.length > 0) {
      console.log(`Skipped:`, report.workbookUpdate.skipped);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
