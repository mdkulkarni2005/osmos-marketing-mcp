import type { PostmanFolder, PostmanItem } from "../schemas/collection.js";
import type { TestcaseRow } from "../schemas/testcase.js";

export interface BuiltRequest {
  row: TestcaseRow;
  item: PostmanItem;
}

/**
 * Two root folders (Regression Suite / E2E Suite) — COMPANY_CONVENTION per
 * knowledge/company/postman-conventions.md. The reference artifact further
 * subdivides Regression Suite into numbered domain-theme folders
 * (`01_Campaign_Budget_Bidding`, etc.); that theming is SDA-specific and
 * this project has no domain-grouping input yet, so Regression Suite is
 * subfoldered by API Name instead — one folder per operation under test.
 * E2E Suite is subfoldered by sheet name, since workflow state-path naming
 * (`Create → Publish → ... → Delete`) requires explicit sequencing data
 * this reader does not yet extract (NOT_DOCUMENTED / NEEDS_REVIEW).
 */
export function buildFolders(requests: BuiltRequest[]): (PostmanFolder)[] {
  const regression = requests.filter((r) => r.row.tcType !== "E2E");
  const e2e = requests.filter((r) => r.row.tcType === "E2E");

  const regressionFolder: PostmanFolder = {
    name: "Regression Suite",
    item: groupBy(regression, (r) => r.row.apiName),
  };
  const e2eFolder: PostmanFolder = {
    name: "E2E Suite",
    item: groupBy(e2e, (r) => r.row.sheetName),
  };

  const folders: PostmanFolder[] = [regressionFolder];
  if (e2e.length > 0) folders.push(e2eFolder);
  return folders;
}

function groupBy(requests: BuiltRequest[], keyFn: (r: BuiltRequest) => string): PostmanFolder[] {
  const groups = new Map<string, PostmanItem[]>();
  for (const r of requests) {
    const key = keyFn(r);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r.item);
  }
  return [...groups.entries()].map(([name, item]) => ({ name, item }));
}
