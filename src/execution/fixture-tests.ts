import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HEADER_COLUMN_ORDER } from "../schemas/testcase.js";
import type { ExecutableTestcase, TestcaseRow } from "../schemas/testcase.js";
import { parseNewmanSummary, type NewmanSummaryLike } from "./result-parser.js";
import { reconcile } from "../reconciliation/testcase-mapper.js";
import { updateWorkbookWithResults } from "../reconciliation/workbook-updater.js";

/**
 * Deterministic fixture reconciliation tests (brief §20, A–H). No Newman
 * process, no real API — hand-built Newman-summary-shaped objects feed
 * parseNewmanSummary() and reconcile() directly, and a small in-memory
 * workbook exercises workbook-updater.ts's round trip. Run with:
 *
 *   npm run execution:fixture-test
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function row(partial: Partial<TestcaseRow> & Pick<TestcaseRow, "tcId" | "rowNumber">): TestcaseRow {
  return {
    apiName: "Fixture API",
    method: "GET",
    tcType: "Functional",
    testScenario: "fixture scenario",
    preConditions: "",
    requestHeaders: "",
    requestBody: "",
    expectedStatusCode: 200,
    expectedResponse: "result present",
    curl: "",
    status: "Not executed",
    bugDescription: "",
    sheetName: "FixtureSheet",
    ...partial,
  };
}

function testcase(r: TestcaseRow): ExecutableTestcase {
  return { row: r, executability: { executable: true } };
}

// ---- Fixture testcases (A, B, C, D, F, G, H — E has no corresponding testcase by definition) ----
const tcPass = testcase(row({ tcId: "T_PASS_A", rowNumber: 2, expectedStatusCode: 200 }));
const tcFailStatus = testcase(row({ tcId: "T_FAIL_B", rowNumber: 3, method: "POST", expectedStatusCode: 400 }));
const tcBlocked = testcase(row({ tcId: "T_BLOCKED_C", rowNumber: 4, expectedStatusCode: 200 }));
const tcNotExecuted = testcase(row({ tcId: "T_NOTEXEC_D", rowNumber: 5, expectedStatusCode: 200 }));
const tcDuplicate = testcase(row({ tcId: "T_DUP_F", rowNumber: 6, expectedStatusCode: 200 }));
const tcAssertionFailSameStatus = testcase(row({ tcId: "T_ASSERTFAIL_G", rowNumber: 7, expectedStatusCode: 200 }));
const tcNegativePass = testcase(row({ tcId: "T_NEGPASS_H", rowNumber: 8, method: "POST", expectedStatusCode: 400 }));

const testcases: ExecutableTestcase[] = [
  tcPass,
  tcFailStatus,
  tcBlocked,
  tcNotExecuted,
  tcDuplicate,
  tcAssertionFailSameStatus,
  tcNegativePass,
];

function exec(opts: {
  name: string;
  method?: string;
  code?: number;
  responseTime?: number;
  body?: unknown;
  assertions?: { assertion: string; error?: { message: string } | null }[];
  requestError?: { message: string };
  urlOverride?: string;
}) {
  return {
    item: { name: opts.name },
    request: {
      method: opts.method ?? "GET",
      url: { toString: () => opts.urlOverride ?? "https://api.example.com/fixture" },
    },
    response: opts.requestError
      ? undefined
      : {
          code: opts.code,
          responseTime: opts.responseTime ?? 120,
          stream: Buffer.from(JSON.stringify(opts.body ?? {})),
        },
    assertions: opts.assertions,
    requestError: opts.requestError ?? null,
  };
}

const summary: NewmanSummaryLike = {
  run: {
    executions: [
      // A: PASS
      exec({
        name: "[T_PASS_A] Fixture GET succeeds",
        code: 200,
        body: { result: { id: "abc" } },
        assertions: [{ assertion: "[T_PASS_A] status code is 200" }],
      }),
      // B: FAIL — status mismatch
      exec({
        name: "[T_FAIL_B] Fixture POST rejects bad input",
        method: "POST",
        code: 500,
        body: { error: "internal" },
        assertions: [
          { assertion: "[T_FAIL_B] status code is 400", error: { message: "expected 500 to equal 400" } },
        ],
      }),
      // C: BLOCKED — infra/request error, no response at all
      exec({
        name: "[T_BLOCKED_C] Fixture GET (unreachable)",
        requestError: { message: "connect ECONNREFUSED 127.0.0.1:9999" },
      }),
      // D: T_NOTEXEC_D deliberately has no execution at all.
      // E: UNKNOWN TC_ID — no matching testcase exists for this id.
      exec({
        name: "[T_UNKNOWN_E] Fixture GET for a TC_ID nobody defined",
        code: 200,
        body: { ok: true },
        assertions: [{ assertion: "[T_UNKNOWN_E] status code is 200" }],
      }),
      // F: DUPLICATE — two executions map to the same TC_ID
      exec({
        name: "[T_DUP_F] Fixture GET run once",
        code: 200,
        body: { ok: true },
        assertions: [{ assertion: "[T_DUP_F] status code is 200" }],
      }),
      exec({
        name: "[T_DUP_F] Fixture GET run twice",
        code: 200,
        body: { ok: true },
        assertions: [{ assertion: "[T_DUP_F] status code is 200" }],
      }),
      // G: expected 200 / actual 200 / assertion fails
      exec({
        name: "[T_ASSERTFAIL_G] Fixture GET returns 200 but wrong body",
        code: 200,
        body: { result: {} },
        assertions: [
          { assertion: "[T_ASSERTFAIL_G] status code is 200" },
          {
            assertion: "[T_ASSERTFAIL_G] response has campaign_id",
            error: { message: "expected undefined to exist" },
          },
        ],
      }),
      // H: expected 400 / actual 400 / assertions pass (negative testcase success)
      exec({
        name: "[T_NEGPASS_H] Fixture POST correctly rejects missing field",
        method: "POST",
        code: 400,
        body: { error: "budget_setting.max_limit is required" },
        assertions: [{ assertion: "[T_NEGPASS_H] status code is 400" }],
      }),
    ],
  },
};

function testParserAndReconciliation() {
  const results = parseNewmanSummary(summary, "2026-08-11T00:00:00.000Z");

  // Parser-level checks
  const byTcId = new Map(results.map((r) => [r.tcId, r]));
  assert.equal(byTcId.get("T_PASS_A")?.result, "PASS", "A: parser should classify as PASS");
  assert.equal(byTcId.get("T_FAIL_B")?.result, "FAIL", "B: parser should classify as FAIL");
  assert.equal(byTcId.get("T_BLOCKED_C")?.result, "BLOCKED", "C: parser should classify as BLOCKED");
  assert.equal(byTcId.get("T_ASSERTFAIL_G")?.result, "FAIL", "G: same status, failed assertion -> FAIL");
  assert.equal(byTcId.get("T_NEGPASS_H")?.result, "PASS", "H: expected 400 / actual 400 / assertions pass -> PASS");
  assert.equal(results.filter((r) => r.tcId === "T_DUP_F").length, 2, "F: parser should emit both duplicate executions");

  // Reconciliation-level checks
  const report = reconcile(testcases, results);

  assert.equal(report.matched.find((m) => m.tcId === "T_PASS_A")?.excelStatus, "Pass", "A -> Excel Pass");
  assert.equal(report.matched.find((m) => m.tcId === "T_FAIL_B")?.excelStatus, "Fail", "B -> Excel Fail");
  assert.equal(report.matched.find((m) => m.tcId === "T_BLOCKED_C")?.excelStatus, "Blocker", "C -> Excel Blocker");
  assert.equal(report.matched.find((m) => m.tcId === "T_ASSERTFAIL_G")?.excelStatus, "Fail", "G -> Excel Fail");
  assert.equal(report.matched.find((m) => m.tcId === "T_NEGPASS_H")?.excelStatus, "Pass", "H -> Excel Pass");

  assert.ok(
    report.notExecuted.some((n) => n.tcId === "T_NOTEXEC_D"),
    "D: executable testcase with no result -> NOT_EXECUTED"
  );
  assert.ok(
    report.unmatchedResults.some((u) => u.tcId === "T_UNKNOWN_E"),
    "E: result for unknown TC_ID -> UNMATCHED_RESULT"
  );
  assert.ok(
    report.duplicateResults.some((d) => d.tcId === "T_DUP_F" && d.results.length === 2),
    "F: two results for same TC_ID -> DUPLICATE_RESULT"
  );
  assert.ok(
    !report.matched.some((m) => m.tcId === "T_DUP_F"),
    "F: duplicate TC_ID must not be silently attached to the testcase"
  );

  assert.equal(report.summary.pass, 2, "expected 2 Pass (A, H)");
  assert.equal(report.summary.fail, 2, "expected 2 Fail (B, G)");
  assert.equal(report.summary.blocked, 1, "expected 1 Blocker (C)");
  assert.equal(report.summary.notExecuted, 1, "expected 1 NOT_EXECUTED (D)");
  assert.equal(report.summary.unmatchedResults, 1, "expected 1 UNMATCHED_RESULT (E)");
  assert.equal(report.summary.duplicateResults, 1, "expected 1 DUPLICATE_RESULT (F)");

  console.log("[OK] parser + reconciliation fixtures A-H");
  return report;
}

async function testWorkbookUpdaterRoundTrip() {
  const wbPath = path.resolve(__dirname, "..", "..", "generated", "fixtures", "execution-updater-test.xlsx");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("FixtureSheet", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = HEADER_COLUMN_ORDER.map((h) => ({ header: h, key: h, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDDDDDD" } };

  const rows = [
    { TC_ID: "T_PASS_A", "API Name": "Fixture API", Method: "GET", "TC Type": "Functional", "Test Scenario": "s", "Expected Status Code": 200, Status: "Not executed" },
    { TC_ID: "T_FAIL_B", "API Name": "Fixture API", Method: "POST", "TC Type": "Negative", "Test Scenario": "s", "Expected Status Code": 400, Status: "Not executed" },
    { TC_ID: "T_UNTOUCHED", "API Name": "Fixture API", Method: "GET", "TC Type": "Functional", "Test Scenario": "s", "Expected Status Code": 200, Status: "Not executed" },
  ];
  for (const r of rows) sheet.addRow(r);
  await workbook.xlsx.writeFile(wbPath);

  const results = parseNewmanSummary(summary, "2026-08-11T00:00:00.000Z");
  const report = reconcile(
    [
      testcase(row({ tcId: "T_PASS_A", rowNumber: 2, expectedStatusCode: 200 })),
      testcase(row({ tcId: "T_FAIL_B", rowNumber: 3, method: "POST", expectedStatusCode: 400 })),
      testcase(row({ tcId: "T_UNTOUCHED", rowNumber: 4, expectedStatusCode: 200 })),
    ],
    results
  );

  const updateReport = await updateWorkbookWithResults(wbPath, report.matched);
  assert.equal(updateReport.updatedRows.length, 2, "should update exactly the 2 matched rows (A, B)");

  const reread = new ExcelJS.Workbook();
  await reread.xlsx.readFile(wbPath);
  const reSheet = reread.getWorksheet("FixtureSheet")!;

  assert.equal(reSheet.getRow(1).font?.bold, true, "header formatting must survive the round trip");
  assert.equal(reSheet.getColumn(1).width, 22, "column width must survive the round trip");

  const statusCol = HEADER_COLUMN_ORDER.indexOf("Status") + 1;
  const actualStatusCol = HEADER_COLUMN_ORDER.indexOf("Actual Status Code") + 1;
  assert.equal(reSheet.getRow(2).getCell(statusCol).value, "Pass", "row 2 (T_PASS_A) Status updated to Pass");
  assert.equal(reSheet.getRow(2).getCell(actualStatusCol).value, 200, "row 2 Actual Status Code updated");
  assert.equal(reSheet.getRow(3).getCell(statusCol).value, "Fail", "row 3 (T_FAIL_B) Status updated to Fail");
  assert.equal(reSheet.getRow(4).getCell(statusCol).value, "Not executed", "untouched row must remain untouched");

  console.log("[OK] workbook-updater round trip (formatting + targeted cells only)");
}

async function main() {
  testParserAndReconciliation();
  await testWorkbookUpdaterRoundTrip();
  console.log("\nAll execution-layer fixture tests passed.");
}

main().catch((err) => {
  console.error("\nFIXTURE TEST FAILED:", err);
  process.exit(1);
});
