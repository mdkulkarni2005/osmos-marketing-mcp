import ExcelJS from "exceljs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { HEADER_COLUMN_ORDER } from "../schemas/testcase.js";

/**
 * Builds a small fixture workbook in the company-testcase-format shape
 * (skills/company-testcase-format/SKILL.md) for `create-spa-campaign`, used
 * only to prove the reader → builder → validator pipeline end-to-end on the
 * home machine without a real generated SPA-API-Test-Suite.xlsx. Every row's
 * content is sourced from registry/endpoints/create-spa-campaign.json — no
 * SDA field names or values are used, per the standing rule in
 * knowledge/company/postman-conventions.md.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, "..", "..", "generated", "fixtures", "SPA-API-Test-Suite.fixture.xlsx");

type Row = Record<(typeof HEADER_COLUMN_ORDER)[number], string | number>;

const POSITIVE_HEADERS = "accept: application/json\ncontent-type: application/json\nx-retailer-id: <retailer_id>\nx-token: <token>";
const MISSING_AUTH_HEADERS = "accept: application/json\ncontent-type: application/json\nx-retailer-id: <retailer_id>";

const rows: Row[] = [
  {
    TC_ID: "CSC_001",
    "API Name": "Create SPA Campaign",
    Method: "POST",
    "TC Type": "Functional",
    "Test Scenario": "Create campaign with valid required fields (AVERAGE_DAILY_BUDGET)",
    "Pre-Conditions": "Valid advertiser_id and token",
    "Request Headers": POSITIVE_HEADERS,
    "Request Body": JSON.stringify(
      {
        name: "Campaign_Functional_001",
        campaign_start_date: "2026-09-01",
        budget_setting: { max_limit: 10000, currency: "INR", daily_budget: 500 },
      },
      null,
      2
    ),
    "Expected Status Code": 200,
    "Expected Response": "result.campaign_id present, result.status = ACTIVE (see registry example response)",
    "Actual Status Code": "",
    "Actual Response": "",
    Curl: "curl --location --request POST '{{base_url}}/{{advertiser_id}}/sponsored_products/legacy/campaigns' --header 'x-retailer-id: <retailer_id>' --header 'x-token: <token>' --data '...'",
    Status: "Not executed",
    "Bug Description": "",
  },
  {
    TC_ID: "CSC_002",
    "API Name": "Create SPA Campaign",
    Method: "POST",
    "TC Type": "Negative",
    "Test Scenario": "budget_setting.max_limit missing (required)",
    "Pre-Conditions": "Valid advertiser_id and token",
    "Request Headers": POSITIVE_HEADERS,
    "Request Body": JSON.stringify(
      { name: "Campaign_Req_002", campaign_start_date: "2026-09-01", budget_setting: { currency: "INR" } },
      null,
      2
    ),
    "Expected Status Code": 400,
    "Expected Response": "NOT_DOCUMENTED (contract only documents the 400 status, not the error body shape)",
    "Actual Status Code": "",
    "Actual Response": "",
    Curl: "curl --location --request POST '{{base_url}}/{{advertiser_id}}/sponsored_products/legacy/campaigns' --data '...'",
    Status: "Not executed",
    "Bug Description": "",
  },
  {
    TC_ID: "CSC_003",
    "API Name": "Create SPA Campaign",
    Method: "POST",
    "TC Type": "Negative",
    "Test Scenario": "Invalid campaign_type value (FIXED)",
    "Pre-Conditions": "Valid advertiser_id and token",
    "Request Headers": POSITIVE_HEADERS,
    "Request Body": JSON.stringify(
      {
        name: "Campaign_Req_003",
        campaign_start_date: "2026-09-01",
        campaign_type: "FIXED",
        budget_setting: { max_limit: 10000, currency: "INR", daily_budget: 500 },
      },
      null,
      2
    ),
    "Expected Status Code": 400,
    "Expected Response": "NOT_DOCUMENTED (contract documents the enum, not the error body shape)",
    "Actual Status Code": "",
    "Actual Response": "",
    Curl: "curl --location --request POST '{{base_url}}/{{advertiser_id}}/sponsored_products/legacy/campaigns' --data '...'",
    Status: "Not executed",
    "Bug Description": "",
  },
  {
    TC_ID: "CSC_004",
    "API Name": "Create SPA Campaign",
    Method: "POST",
    "TC Type": "Security",
    "Test Scenario": "Missing x-token header (required)",
    "Pre-Conditions": "Valid advertiser_id, no token supplied",
    "Request Headers": MISSING_AUTH_HEADERS,
    "Request Body": JSON.stringify(
      {
        name: "Campaign_Sec_004",
        campaign_start_date: "2026-09-01",
        budget_setting: { max_limit: 10000, currency: "INR", daily_budget: 500 },
      },
      null,
      2
    ),
    "Expected Status Code": 401,
    "Expected Response": "NOT_DOCUMENTED (authentication error body shape not documented in contract)",
    "Actual Status Code": "",
    "Actual Response": "",
    Curl: "curl --location --request POST '{{base_url}}/{{advertiser_id}}/sponsored_products/legacy/campaigns' --data '...'",
    Status: "Not executed",
    "Bug Description": "",
  },
  {
    TC_ID: "CSC_005",
    "API Name": "Create SPA Campaign",
    Method: "POST",
    "TC Type": "E2E",
    "Test Scenario": "Create Campaign - setup step for campaign lifecycle chain",
    "Pre-Conditions": "Valid advertiser_id and token",
    "Request Headers": POSITIVE_HEADERS,
    "Request Body": JSON.stringify(
      {
        name: "Campaign_E2E_Setup_005",
        campaign_start_date: "2026-09-01",
        budget_setting: { max_limit: 10000, currency: "INR", daily_budget: 500 },
      },
      null,
      2
    ),
    "Expected Status Code": 200,
    "Expected Response": "result.campaign_id present (chained into later workflow steps)",
    "Actual Status Code": "",
    "Actual Response": "",
    Curl: "curl --location --request POST '{{base_url}}/{{advertiser_id}}/sponsored_products/legacy/campaigns' --data '...'",
    Status: "Not executed",
    "Bug Description": "",
  },
  {
    TC_ID: "CSC_006",
    "API Name": "Create SPA Campaign",
    Method: "POST",
    "TC Type": "Rate Limit",
    "Test Scenario": "Rapid sequential create requests exceed rate limit",
    "Pre-Conditions": "runRateLimits feature flag enabled",
    "Request Headers": POSITIVE_HEADERS,
    "Request Body": JSON.stringify(
      {
        name: "Campaign_RateLimit_006",
        campaign_start_date: "2026-09-01",
        budget_setting: { max_limit: 10000, currency: "INR", daily_budget: 500 },
      },
      null,
      2
    ),
    "Expected Status Code": 429,
    "Expected Response": "NOT_DOCUMENTED (rate limit error body shape not documented)",
    "Actual Status Code": "",
    "Actual Response": "",
    Curl: "curl --location --request POST '{{base_url}}/{{advertiser_id}}/sponsored_products/legacy/campaigns' --data '...'",
    Status: "Not executed",
    "Bug Description": "",
  },
];

async function main() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("CreateSpaCampaign", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = HEADER_COLUMN_ORDER.map((h) => ({ header: h, key: h, width: 22 }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow(row);
  }

  // A workbook-level sheet the reader must skip.
  const summary = workbook.addWorksheet("Summary");
  summary.addRow(["Total testcases", rows.length]);

  await workbook.xlsx.writeFile(OUT_PATH);
  console.log(`Fixture workbook written: ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
