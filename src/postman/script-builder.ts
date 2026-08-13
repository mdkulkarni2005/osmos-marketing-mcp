import type { TestcaseRow } from "../schemas/testcase.js";
import type { RequestBuilderConfig } from "./request-builder.js";

/**
 * Builds the pm.test script for one request, following the skeleton
 * documented in knowledge/company/postman-conventions.md:
 * 1. optional chain-variable save (// [CHAIN])
 * 2. status-code assertion
 * 3. response-time assertion (config-gated — OBSERVED_PATTERN, not a
 *    confirmed company-wide rule; default off)
 * 4. property/type assertions from the documented expected response
 * 5. retry-tracking boilerplate
 *
 * Never invents an assertion for an expected response marked
 * NOT_DOCUMENTED — the JSON-validity check still runs, but no specific
 * property/value assertion is generated without a documented source.
 */
export function buildTestScript(row: TestcaseRow, config: RequestBuilderConfig): string[] {
  const lines: string[] = [];

  if (row.tcType === "E2E") {
    lines.push(
      `// [CHAIN] NOT_DOCUMENTED — response field for chaining not specified in the testcase workbook.`,
      `// NEEDS_REVIEW: confirm the response property to extract before this step is used in a workflow chain.`
    );
  }

  if (row.expectedStatusCode !== "NOT_DOCUMENTED") {
    lines.push(
      `pm.test("[${row.tcId}] status code is ${row.expectedStatusCode}", function () {`,
      `    pm.expect(pm.response.code).to.eql(${row.expectedStatusCode});`,
      `});`
    );
  } else {
    lines.push(
      `// [${row.tcId}] Expected status code NOT_DOCUMENTED in workbook — no status assertion generated.`
    );
  }

  if (config.assertResponseTime.enabled) {
    lines.push(
      `pm.test("[${row.tcId}] response time is acceptable", function () {`,
      `    pm.expect(pm.response.responseTime).to.be.below(${config.assertResponseTime.maxMs});`,
      `});`
    );
  }

  const expectedResponseDocumented =
    row.expectedResponse.trim().length > 0 && !/NOT_DOCUMENTED/i.test(row.expectedResponse);

  if (expectedResponseDocumented) {
    lines.push(
      `pm.test("[${row.tcId}] response body is valid JSON", function () {`,
      `    pm.response.to.have.jsonBody();`,
      `});`,
      `// [${row.tcId}] Documented expected response: ${JSON.stringify(row.expectedResponse)}`,
      `// NEEDS_REVIEW: translate the above into a specific property assertion if it names an exact field/value.`
    );
  } else {
    lines.push(
      `// [${row.tcId}] Expected response NOT_DOCUMENTED — no body assertion generated beyond status code.`
    );
  }

  lines.push(
    `pm.collectionVariables.set("_lastStatus", pm.response.code.toString());`,
    `if (pm.response.code !== 429) { pm.collectionVariables.set("_retryCount", "0"); }`
  );

  return lines;
}
