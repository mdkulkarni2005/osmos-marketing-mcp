import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readTestcaseWorkbook } from "./workbook-reader.js";
import { loadEndpointRegistry } from "./endpoint-registry.js";
import { buildTestcaseGraph } from "./graph-model.js";
import { buildTestcaseGraphHtml } from "./visualizer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const WORKBOOK_PATH = path.join(ROOT, "generated", "fixtures", "SPA-API-Test-Suite.fixture.xlsx");
const OUT_PATH = path.join(ROOT, "generated", "reports", "testcase-graph.html");

export async function generateVisualizer(workbookPath: string, outPath: string): Promise<{ outPath: string; nodeCount: number }> {
  const { testcases } = await readTestcaseWorkbook(workbookPath);
  const registry = loadEndpointRegistry();
  const root = buildTestcaseGraph(testcases, registry, registry.service.name);
  const html = buildTestcaseGraphHtml(root, `${registry.service.name} — Testcase Map`);

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, html);

  const countNodes = (n: typeof root): number => 1 + n.children.reduce((sum, c) => sum + countNodes(c), 0);
  return { outPath, nodeCount: countNodes(root) };
}

async function main() {
  const result = await generateVisualizer(WORKBOOK_PATH, OUT_PATH);
  console.log(`Wrote ${result.nodeCount} nodes to ${result.outPath}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
