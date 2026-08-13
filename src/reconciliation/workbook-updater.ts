import ExcelJS from "exceljs";
import { mapHeaderColumns } from "../postman/sheet-columns.js";
import type { MatchedResult } from "./testcase-mapper.js";

const UPDATABLE_COLUMNS = ["Actual Status Code", "Actual Response", "Status", "Bug Description"] as const;

export interface WorkbookUpdateReport {
  updatedRows: { sheet: string; row: number; tcId: string }[];
  skipped: { tcId: string; reason: string }[];
}

/**
 * Reads the existing testcase workbook, writes reconciled execution results
 * into the four result columns (Actual Status Code, Actual Response,
 * Status, Bug Description) by (sheetName, rowNumber) — never by header
 * position or row order — and writes it back to the SAME file. Every other
 * column, and all workbook formatting (fonts/fills/borders/widths/freeze
 * panes/Summary/Endpoint Inventory/Coverage sheets), is left exactly as
 * exceljs read it, since only the four target cells are ever assigned.
 */
export async function updateWorkbookWithResults(
  workbookPath: string,
  matched: MatchedResult[]
): Promise<WorkbookUpdateReport> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);

  const updatedRows: WorkbookUpdateReport["updatedRows"] = [];
  const skipped: WorkbookUpdateReport["skipped"] = [];

  const sheetColumnsCache = new Map<string, Map<string, number>>();

  for (const m of matched) {
    const sheetName = m.testcase.row.sheetName;
    const rowNumber = m.testcase.row.rowNumber;
    const worksheet = workbook.getWorksheet(sheetName);
    if (!worksheet) {
      skipped.push({ tcId: m.tcId, reason: `Sheet "${sheetName}" no longer exists in the workbook.` });
      continue;
    }

    let colIndexByHeader = sheetColumnsCache.get(sheetName);
    if (!colIndexByHeader) {
      colIndexByHeader = mapHeaderColumns(worksheet);
      sheetColumnsCache.set(sheetName, colIndexByHeader);
    }

    const missing = UPDATABLE_COLUMNS.filter((h) => !colIndexByHeader!.has(h));
    if (missing.length > 0) {
      skipped.push({
        tcId: m.tcId,
        reason: `Sheet "${sheetName}" is missing expected columns: ${missing.join(", ")}.`,
      });
      continue;
    }

    const row = worksheet.getRow(rowNumber);
    const tcIdCol = colIndexByHeader.get("TC_ID");
    const rowTcId = tcIdCol ? String(row.getCell(tcIdCol).value ?? "").trim() : undefined;
    if (rowTcId !== undefined && rowTcId !== m.tcId) {
      skipped.push({
        tcId: m.tcId,
        reason: `Row ${rowNumber} on "${sheetName}" now holds TC_ID "${rowTcId}", not "${m.tcId}" — workbook changed since it was read; not writing.`,
      });
      continue;
    }

    row.getCell(colIndexByHeader.get("Actual Status Code")!).value = m.result.statusCode ?? "";
    row.getCell(colIndexByHeader.get("Actual Response")!).value = m.result.responseBody ?? "";
    row.getCell(colIndexByHeader.get("Status")!).value = m.excelStatus;
    row.getCell(colIndexByHeader.get("Bug Description")!).value = m.excelBugDescription;

    updatedRows.push({ sheet: sheetName, row: rowNumber, tcId: m.tcId });
  }

  if (updatedRows.length > 0) {
    await workbook.xlsx.writeFile(workbookPath);
  }

  return { updatedRows, skipped };
}
