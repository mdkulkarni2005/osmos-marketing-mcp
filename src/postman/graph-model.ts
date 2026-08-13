import type { ExecutableTestcase, StatusValue, TcType } from "../schemas/testcase.js";
import { resolveEndpoint, type EndpointRegistry } from "./endpoint-registry.js";

export type GraphNodeKind = "service" | "endpoint" | "tctype" | "testcase" | "field";

export interface GraphNode {
  id: string;
  label: string;
  kind: GraphNodeKind;
  status?: StatusValue;
  tooltip?: string;
  children: GraphNode[];
  /** Layout coordinates, filled in by layoutTree(). */
  x?: number;
  y?: number;
}

/**
 * Best-effort extraction of a dotted field path mentioned in a Test
 * Scenario cell (e.g. "budget_setting.max_limit missing (required)" ->
 * "budget_setting.max_limit"). This is a derived display hint, not stored
 * data — the company format's 15 columns are never extended with a
 * parent/child column. If no dotted path appears in the text, no field
 * node is added; nothing is invented to fill the branch.
 */
const DOTTED_PATH = /\b[a-zA-Z_][a-zA-Z0-9_]*(?:\.[a-zA-Z_][a-zA-Z0-9_]*)+\b/g;

function extractFieldPaths(testScenario: string): string[] {
  const matches = testScenario.match(DOTTED_PATH) ?? [];
  return [...new Set(matches)];
}

const TC_TYPE_ORDER: TcType[] = ["Functional", "Negative", "Security", "Rate Limit", "E2E"];

/**
 * Builds a layered tree: Service -> Endpoint (workbook tab) -> TC Type ->
 * Test Case -> (optional derived) Field. Grouping is by sheetName (the
 * literal "tab wise" structure the workbook already has), labeled with the
 * registry's canonical endpoint name when it resolves, falling back to the
 * raw "API Name" cell text so an unresolved row still renders — the
 * visualizer's job is visibility, not gating (gating already happens in
 * collection-validator).
 */
export function buildTestcaseGraph(
  testcases: ExecutableTestcase[],
  registry: EndpointRegistry,
  serviceName: string
): GraphNode {
  const root: GraphNode = { id: "root", label: serviceName, kind: "service", children: [] };

  const bySheet = new Map<string, ExecutableTestcase[]>();
  for (const tc of testcases) {
    const list = bySheet.get(tc.row.sheetName) ?? [];
    list.push(tc);
    bySheet.set(tc.row.sheetName, list);
  }

  for (const [sheetName, sheetTestcases] of [...bySheet.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const apiName = sheetTestcases[0]?.row.apiName ?? sheetName;
    const resolution = resolveEndpoint(registry, apiName);
    const endpointLabel = resolution.status === "resolved" ? resolution.endpoint.name : `${apiName} (unresolved)`;
    const endpointNode: GraphNode = {
      id: `endpoint:${sheetName}`,
      label: endpointLabel,
      kind: "endpoint",
      tooltip: resolution.status === "resolved" ? `${resolution.endpoint.method} ${resolution.endpoint.path}` : "No matching registry endpoint",
      children: [],
    };
    root.children.push(endpointNode);

    const byType = new Map<TcType, ExecutableTestcase[]>();
    for (const tc of sheetTestcases) {
      const list = byType.get(tc.row.tcType) ?? [];
      list.push(tc);
      byType.set(tc.row.tcType, list);
    }

    for (const tcType of TC_TYPE_ORDER) {
      const rows = byType.get(tcType);
      if (!rows || rows.length === 0) continue;

      const typeNode: GraphNode = {
        id: `${endpointNode.id}:type:${tcType}`,
        label: `${tcType} (${rows.length})`,
        kind: "tctype",
        children: [],
      };
      endpointNode.children.push(typeNode);

      for (const tc of rows.sort((a, b) => a.row.tcId.localeCompare(b.row.tcId))) {
        const tcNode: GraphNode = {
          id: `tc:${tc.row.tcId}`,
          label: tc.row.tcId,
          kind: "testcase",
          status: tc.row.status,
          tooltip: tc.row.testScenario,
          children: [],
        };
        typeNode.children.push(tcNode);

        for (const fieldPath of extractFieldPaths(tc.row.testScenario)) {
          tcNode.children.push({
            id: `${tcNode.id}:field:${fieldPath}`,
            label: fieldPath,
            kind: "field",
            tooltip: `Field referenced in ${tc.row.tcId}'s scenario text (derived, not a stored column)`,
            children: [],
          });
        }
      }
    }
  }

  return root;
}
