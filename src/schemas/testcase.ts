import { z } from "zod";

/**
 * The 15 core columns held identically across every sheet in the real
 * company reference workbook (see skills/company-testcase-format/SKILL.md,
 * "Spreadsheet structure"). Columns beyond #15 vary per sheet and are
 * intentionally not modeled — they're ad hoc per-author defect-tracking
 * columns, not part of the company format.
 */
export const TC_TYPES = ["Functional", "Negative", "Security", "Rate Limit", "E2E"] as const;
export type TcType = (typeof TC_TYPES)[number];

/**
 * Company status vocabulary, observed verbatim in the reference workbook.
 * Note "Blocker", not "Blocked" — the skill flags this explicitly.
 */
export const STATUS_VALUES = ["Not executed", "Pass", "Fail", "Blocker"] as const;
export type StatusValue = (typeof STATUS_VALUES)[number];

export const TestcaseRowSchema = z.object({
  tcId: z.string().min(1, "TC_ID is required"),
  apiName: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  tcType: z.enum(TC_TYPES),
  testScenario: z.string().min(1),
  preConditions: z.string().default(""),
  requestHeaders: z.string().default(""),
  requestBody: z.string().default(""),
  expectedStatusCode: z.union([z.number().int(), z.literal("NOT_DOCUMENTED")]),
  expectedResponse: z.string().default(""),
  actualStatusCode: z.union([z.number().int(), z.string()]).optional(),
  actualResponse: z.string().optional(),
  curl: z.string().default(""),
  status: z.enum(STATUS_VALUES).default("Not executed"),
  bugDescription: z.string().optional().default(""),

  // Not spreadsheet columns — provenance the reader attaches per row so
  // downstream tools (builder, validator, reconciler) can map back exactly.
  sheetName: z.string().min(1),
  rowNumber: z.number().int().positive(),
});
export type TestcaseRow = z.infer<typeof TestcaseRowSchema>;

/**
 * Why a row is or isn't executable as a single Postman request. Rows can be
 * non-executable for legitimate documented reasons (gated rate-limit class,
 * undocumented expected response) — the reader must record the reason
 * rather than silently dropping the row, so the validation report can show
 * every row landed somewhere.
 */
export type ExecutabilityReason =
  | { executable: true }
  | { executable: false; reason: "rate_limit_gated" | "expected_response_not_documented" };

export interface ExecutableTestcase {
  row: TestcaseRow;
  executability: ExecutabilityReason;
}

export const HEADER_COLUMN_ORDER = [
  "TC_ID",
  "API Name",
  "Method",
  "TC Type",
  "Test Scenario",
  "Pre-Conditions",
  "Request Headers",
  "Request Body",
  "Expected Status Code",
  "Expected Response",
  "Actual Status Code",
  "Actual Response",
  "Curl",
  "Status",
  "Bug Description",
] as const;

/** Sheet names that are workbook-level, never per-operation testcase sheets. */
export const NON_TESTCASE_SHEET_NAMES = new Set(["Summary", "Endpoint Inventory", "Coverage"]);
