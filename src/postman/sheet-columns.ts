import type ExcelJS from "exceljs";
import { HEADER_COLUMN_ORDER } from "../schemas/testcase.js";

/**
 * Shared with workbook-reader.ts and reconciliation/workbook-updater.ts so
 * both always resolve the same column for the same header text — column
 * order in a real company workbook is not guaranteed, so neither reader nor
 * writer may assume a fixed index.
 */
export function normalizeHeader(v: unknown): string {
  return String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Maps canonical company header names -> 1-based column index for one worksheet's header row. */
export function mapHeaderColumns(worksheet: ExcelJS.Worksheet): Map<string, number> {
  const headerRow = worksheet.getRow(1);
  const colIndexByHeader = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    colIndexByHeader.set(normalizeHeader(cell.value), colNumber);
  });
  return colIndexByHeader;
}

export function missingHeaders(colIndexByHeader: Map<string, number>): string[] {
  return HEADER_COLUMN_ORDER.filter((h) => !colIndexByHeader.has(h));
}
