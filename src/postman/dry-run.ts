import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readTestcaseWorkbook } from "./workbook-reader.js";
import { loadEndpointRegistry } from "./endpoint-registry.js";
import { buildCollection } from "./collection-builder.js";
import { buildEnvironment } from "./environment-builder.js";
import { validateCollection } from "./collection-validator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const WORKBOOK_PATH = path.join(ROOT, "generated", "fixtures", "SPA-API-Test-Suite.fixture.xlsx");
const COLLECTION_OUT = path.join(ROOT, "generated", "collections", "OSMOS-SPA-Regression.postman_collection.json");
const ENVIRONMENT_OUT = path.join(ROOT, "generated", "environments", "OSMOS-SPA-Regression.postman_environment.json");

/**
 * BUILD_ONLY / VALIDATE_ONLY / DRY_RUN home-machine mode: read the fixture
 * workbook, build collection + environment, validate, write both JSON files
 * and a report to generated/. No real API call. No credentials required.
 */
async function main() {
  console.log(`Reading workbook: ${WORKBOOK_PATH}`);
  const { testcases, report: readReport } = await readTestcaseWorkbook(WORKBOOK_PATH);

  console.log("\n=== Workbook read report ===");
  console.log(`Sheets discovered: ${readReport.sheetsDiscovered.join(", ")}`);
  console.log(`Sheets skipped (non-testcase): ${readReport.sheetsSkippedNonTestcase.join(", ")}`);
  console.log(`Per-sheet row counts:`, readReport.perSheetRowCounts);
  if (readReport.issues.length > 0) {
    console.log("Issues:", readReport.issues);
  }
  console.log(
    `Non-executable rows: ${readReport.nonExecutable.map((n) => `${n.tcId} (${n.reason.executable ? "" : n.reason.reason})`).join(", ") || "none"}`
  );

  const registry = loadEndpointRegistry();
  const { collection, usedVariables, unresolved, nonExecutable, bodyFieldWarnings } = buildCollection(
    testcases,
    registry,
    { collectionName: "OSMOS Marketing API - SPA Regression Suite" }
  );

  console.log("\n=== Collection build ===");
  console.log(`Used variables: ${usedVariables.join(", ")}`);
  if (unresolved.length > 0) console.log("Unresolved (build error):", unresolved);
  if (nonExecutable.length > 0) console.log("Non-executable (expected, documented):", nonExecutable);
  if (bodyFieldWarnings.length > 0) console.log("Body field drift warnings:", bodyFieldWarnings);

  const environment = buildEnvironment(usedVariables, {
    serviceName: "OSMOS Marketing API",
    serviceVersion: "V1",
    suiteName: "Regression",
    baseUrl: registry.service.baseUrl,
  });

  const validation = validateCollection(collection, testcases, unresolved, nonExecutable, bodyFieldWarnings);
  console.log("\n=== Validation report ===");
  console.log(`Passed: ${validation.passed}`);
  for (const f of validation.findings) {
    console.log(`  [${f.severity}]${f.tcId ? ` ${f.tcId}` : ""} ${f.message}`);
  }

  fs.mkdirSync(path.dirname(COLLECTION_OUT), { recursive: true });
  fs.mkdirSync(path.dirname(ENVIRONMENT_OUT), { recursive: true });
  fs.writeFileSync(COLLECTION_OUT, JSON.stringify(collection, null, 2));
  fs.writeFileSync(ENVIRONMENT_OUT, JSON.stringify(environment, null, 2));
  console.log(`\nWrote: ${COLLECTION_OUT}`);
  console.log(`Wrote: ${ENVIRONMENT_OUT}`);

  if (!validation.passed) {
    console.error("\nValidation FAILED — critical findings present. Execution would be blocked.");
    process.exitCode = 1;
  } else {
    console.log("\nValidation PASSED. Ready for local execution (Newman) on the machine with real credentials.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
