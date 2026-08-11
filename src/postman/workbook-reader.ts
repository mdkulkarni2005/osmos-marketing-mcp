import ExcelJS from "exceljs";
import {
  HEADER_COLUMN_ORDER,
  NON_TESTCASE_SHEET_NAMES,
  TestcaseRowSchema,
  type ExecutabilityReason,
  type ExecutableTestcase,
  type TestcaseRow,
} from "../schemas/testcase.js";
import { mapHeaderColumns, missingHeaders as computeMissingHeaders } from "./sheet-columns.js";

interface SheetReadIssue {
  sheet: string;
  row: number;
  message: string;
}

export interface WorkbookReadReport {
  workbookPath: string;
  sheetsDiscovered: string[];
  sheetsSkippedNonTestcase: string[];
  perSheetRowCounts: Record<string, number>;
  issues: SheetReadIssue[];
  nonExecutable: { tcId: string; sheet: string; reason: ExecutabilityReason }[];
}

export interface WorkbookReadResult {
  testcases: ExecutableTestcase[];
  report: WorkbookReadReport;
}

function determineExecutability(row: Partial<TestcaseRow>): ExecutabilityReason {
  if (row.tcType === "Rate Limit") {
    return { executable: false, reason: "rate_limit_gated" };
  }
  // Deliberately does NOT treat an empty Request Body on a POST/PUT/PATCH as
  // non-executable: "body omitted entirely" is a legitimate required-field
  // negative scenario (the MISSING/NULL/EMPTY distinction the api-test-design
  // skill preserves), not a workbook defect. request-builder simply emits no
  // body field for that row, which is the correct request to send.
  if (
    row.expectedResponse &&
    /NOT_DOCUMENTED/i.test(row.expectedResponse) &&
    (row.expectedStatusCode === "NOT_DOCUMENTED" || row.expectedStatusCode === undefined)
  ) {
    return { executable: false, reason: "expected_response_not_documented" };
  }
  return { executable: true };
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in (v as any)) {
    return (v as any).richText.map((r: any) => r.text).join("");
  }
  if (typeof v === "object" && "text" in (v as any)) {
    return String((v as any).text);
  }
  return String(v);
}

/**
 * Distinguishes an explicitly-authored "NOT_DOCUMENTED" cell (a deliberate,
 * reviewed statement that the contract doesn't specify this) from a blank
 * cell (a workbook gap nobody has looked at yet). Both currently flow into
 * the same schema value, but the caller records the blank case as a reader
 * issue so it surfaces in the validation report instead of silently reading
 * the same as a reviewed "NOT_DOCUMENTED".
 */
function cellNumberOrLiteral(cell: ExcelJS.Cell): { value: number | "NOT_DOCUMENTED"; wasBlank: boolean } {
  const text = cellText(cell).trim();
  if (!text) return { value: "NOT_DOCUMENTED", wasBlank: true };
  const n = Number(text);
  return { value: Number.isFinite(n) ? n : "NOT_DOCUMENTED", wasBlank: false };
}

/**
 * Reads every per-operation testcase sheet in a company-format workbook
 * (skills/company-testcase-format/SKILL.md) into typed rows. Skips
 * workbook-level sheets (Summary/Endpoint Inventory/Coverage). Every row is
 * either mapped to an executable request or recorded in the report with a
 * documented reason it can't run as-is — no row is silently dropped.
 */
export async function readTestcaseWorkbook(workbookPath: string): Promise<WorkbookReadResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);

  const sheetsDiscovered: string[] = [];
  const sheetsSkippedNonTestcase: string[] = [];
  const perSheetRowCounts: Record<string, number> = {};
  const issues: SheetReadIssue[] = [];
  const testcases: ExecutableTestcase[] = [];

  for (const worksheet of workbook.worksheets) {
    if (NON_TESTCASE_SHEET_NAMES.has(worksheet.name)) {
      sheetsSkippedNonTestcase.push(worksheet.name);
      continue;
    }

    // "Expected Status Code" is stored with an internal newline in the real
    // reference workbook ("Expected \nStatus Code"); normalizeHeader
    // collapses that, so an exact match against the canonical name works.
    const colIndexByHeader = mapHeaderColumns(worksheet);

    const missing = computeMissingHeaders(colIndexByHeader);
    if (missing.length > 0) {
      issues.push({
        sheet: worksheet.name,
        row: 1,
        message: `Not a recognized testcase sheet — missing columns: ${missing.join(", ")}. Skipped.`,
      });
      continue;
    }

    sheetsDiscovered.push(worksheet.name);
    let rowsRead = 0;

    for (let r = 2; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const tcIdCell = row.getCell(colIndexByHeader.get("TC_ID")!);
      const tcId = cellText(tcIdCell).trim();
      if (!tcId) continue; // blank trailing row — workbook padding, not data

      const get = (header: (typeof HEADER_COLUMN_ORDER)[number]) =>
        cellText(row.getCell(colIndexByHeader.get(header)!));

      const methodRaw = get("Method").trim().toUpperCase();
      const expectedStatus = cellNumberOrLiteral(row.getCell(colIndexByHeader.get("Expected Status Code")!));
      if (expectedStatus.wasBlank) {
        issues.push({
          sheet: worksheet.name,
          row: r,
          message: `TC_ID ${tcId}: Expected Status Code is blank (not an authored "NOT_DOCUMENTED") — likely an incomplete row, needs human review.`,
        });
      }
      const parsed = TestcaseRowSchema.safeParse({
        tcId,
        apiName: get("API Name").trim(),
        method: methodRaw,
        tcType: get("TC Type").trim(),
        testScenario: get("Test Scenario").trim(),
        preConditions: get("Pre-Conditions").trim(),
        requestHeaders: get("Request Headers"),
        requestBody: get("Request Body"),
        expectedStatusCode: expectedStatus.value,
        expectedResponse: get("Expected Response"),
        curl: get("Curl"),
        status: get("Status").trim() || "Not executed",
        bugDescription: get("Bug Description"),
        sheetName: worksheet.name,
        rowNumber: r,
      });

      if (!parsed.success) {
        issues.push({
          sheet: worksheet.name,
          row: r,
          message: `Row failed schema validation: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
        });
        continue;
      }

      rowsRead++;
      const executability = determineExecutability(parsed.data);
      testcases.push({ row: parsed.data, executability });
    }

    perSheetRowCounts[worksheet.name] = rowsRead;
  }

  const nonExecutable = testcases
    .filter((t) => !t.executability.executable)
    .map((t) => ({ tcId: t.row.tcId, sheet: t.row.sheetName, reason: t.executability }));

  return {
    testcases,
    report: {
      workbookPath,
      sheetsDiscovered,
      sheetsSkippedNonTestcase,
      perSheetRowCounts,
      issues,
      nonExecutable,
    },
  };
}
