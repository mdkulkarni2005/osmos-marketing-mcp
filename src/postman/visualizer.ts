import type { GraphNode } from "./graph-model.js";

const SPACING_X = 240;
const SPACING_Y = 42;

/**
 * Deterministic layered tree layout (every re-run of the same input
 * produces the same coordinates — no force simulation, no randomness, so
 * regenerating after a workbook edit gives a diffable, comparable page).
 * x = depth * SPACING_X; y = vertical midpoint of the node's children,
 * leaves packed at SPACING_Y apart in traversal order.
 */
function layoutTree(node: GraphNode, depth: number, yCursor: { next: number }): void {
  node.x = depth * SPACING_X;
  if (node.children.length === 0) {
    node.y = yCursor.next;
    yCursor.next += SPACING_Y;
    return;
  }
  for (const child of node.children) {
    layoutTree(child, depth + 1, yCursor);
  }
  const first = node.children[0];
  const last = node.children[node.children.length - 1];
  node.y = ((first.y ?? 0) + (last.y ?? 0)) / 2;
}

const STATUS_COLOR: Record<string, string> = {
  Pass: "#2fb170",
  Fail: "#e5484d",
  Blocker: "#f5a524",
  "Not executed": "#8a8f98",
};

const KIND_COLOR: Record<string, string> = {
  service: "#6e56cf",
  endpoint: "#3e9bd6",
  tctype: "#3e9bd6",
  testcase: "#8a8f98",
  field: "#c9a86a",
};

const KIND_RADIUS: Record<string, number> = {
  service: 9,
  endpoint: 7,
  tctype: 6,
  testcase: 5,
  field: 3.5,
};

function nodeColor(n: GraphNode): string {
  if (n.kind === "testcase" && n.status) return STATUS_COLOR[n.status] ?? KIND_COLOR.testcase;
  return KIND_COLOR[n.kind] ?? "#8a8f98";
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function flatten(node: GraphNode, out: GraphNode[] = []): GraphNode[] {
  out.push(node);
  for (const c of node.children) flatten(c, out);
  return out;
}

function edgesOf(node: GraphNode, out: { from: GraphNode; to: GraphNode }[] = []): { from: GraphNode; to: GraphNode }[] {
  for (const c of node.children) {
    out.push({ from: node, to: c });
    edgesOf(c, out);
  }
  return out;
}

function renderEdgePath(from: GraphNode, to: GraphNode): string {
  const x1 = from.x ?? 0;
  const y1 = from.y ?? 0;
  const x2 = to.x ?? 0;
  const y2 = to.y ?? 0;
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

/**
 * Renders one self-contained HTML file: inline SVG graph, inline CSS/JS,
 * no CDN or network dependency, so it opens offline in any browser
 * regardless of which harness (Claude Code, opencode, other) produced it.
 * Pan (drag) and zoom (wheel / buttons) are done with a single CSS
 * transform on a <g> wrapper — no charting library.
 */
export function renderTestcaseGraphHtml(root: GraphNode, title: string): string {
  const nodes = flatten(root);
  const edges = edgesOf(root);

  const maxX = Math.max(...nodes.map((n) => n.x ?? 0)) + 220;
  const maxY = Math.max(...nodes.map((n) => n.y ?? 0)) + 40;
  const minY = Math.min(...nodes.map((n) => n.y ?? 0)) - 40;

  const edgesSvg = edges
    .map((e) => `<path class="edge" d="${renderEdgePath(e.from, e.to)}"></path>`)
    .join("\n");

  const nodesSvg = nodes
    .map((n) => {
      const r = KIND_RADIUS[n.kind] ?? 4;
      const color = nodeColor(n);
      const title = n.tooltip ? `${n.label} — ${n.tooltip}` : n.label;
      return `<g class="node node-${n.kind}" transform="translate(${n.x},${n.y})" data-label="${escapeXml(n.label.toLowerCase())}">
  <title>${escapeXml(title)}</title>
  <circle r="${r}" fill="${color}"></circle>
  <text x="${r + 6}" y="4">${escapeXml(n.label)}</text>
</g>`;
    })
    .join("\n");

  const legendEntries = [
    ...Object.entries(KIND_COLOR).map(([k, c]) => ({ label: k, color: c })),
    { label: "— testcase status —", color: "transparent" },
    ...Object.entries(STATUS_COLOR).map(([k, c]) => ({ label: k, color: c })),
  ];
  const legendSvg = legendEntries
    .map(
      (e) =>
        `<div class="legend-row"><span class="dot" style="background:${e.color}"></span>${escapeXml(e.label)}</div>`
    )
    .join("\n");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${escapeXml(title)}</title>
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; height: 100%; background: #0b0d12; color: #e6e6e6; font-family: -apple-system, Segoe UI, sans-serif; overflow: hidden; }
  #toolbar { position: fixed; top: 12px; left: 12px; z-index: 10; background: rgba(20,22,28,0.9); border: 1px solid #2a2d36; border-radius: 8px; padding: 10px 14px; max-width: 320px; }
  #toolbar h1 { font-size: 14px; margin: 0 0 8px; }
  #toolbar input { width: 100%; box-sizing: border-box; padding: 6px 8px; border-radius: 6px; border: 1px solid #2a2d36; background: #14161c; color: #e6e6e6; margin-bottom: 8px; }
  #toolbar button { background: #1d2029; color: #e6e6e6; border: 1px solid #2a2d36; border-radius: 6px; padding: 4px 10px; cursor: pointer; margin-right: 6px; }
  #legend { position: fixed; bottom: 12px; left: 12px; z-index: 10; background: rgba(20,22,28,0.9); border: 1px solid #2a2d36; border-radius: 8px; padding: 10px 14px; font-size: 12px; max-height: 40vh; overflow-y: auto; }
  .legend-row { display: flex; align-items: center; gap: 6px; margin: 2px 0; }
  .dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }
  svg { width: 100vw; height: 100vh; cursor: grab; }
  svg.dragging { cursor: grabbing; }
  .edge { fill: none; stroke: #3a3f4b; stroke-width: 1.25; }
  .node circle { stroke: #0b0d12; stroke-width: 1.5; }
  .node text { fill: #cfd3db; font-size: 11px; }
  .node-service text, .node-endpoint text { font-weight: 600; fill: #f2f2f2; }
  .node.dimmed { opacity: 0.12; }
  .node.matched circle { stroke: #fff; stroke-width: 2px; }
  #count { position: fixed; top: 12px; right: 12px; z-index: 10; font-size: 12px; color: #8a8f98; }
</style>
</head>
<body>
<div id="toolbar">
  <h1>${escapeXml(title)}</h1>
  <input id="search" type="text" placeholder="Filter by TC_ID, endpoint, field...">
  <div>
    <button id="zoomIn">+</button>
    <button id="zoomOut">-</button>
    <button id="reset">Reset view</button>
  </div>
</div>
<div id="count">${nodes.length} nodes / ${edges.length} edges</div>
<div id="legend">${legendSvg}</div>
<svg id="canvas" viewBox="0 0 ${maxX} ${maxY - minY}">
  <g id="viewport" transform="translate(20, ${-minY + 20})">
    <g id="edges">${edgesSvg}</g>
    <g id="nodes">${nodesSvg}</g>
  </g>
</svg>
<script>
(function () {
  var svg = document.getElementById('canvas');
  var viewport = document.getElementById('viewport');
  var baseTranslateY = ${-minY + 20};
  var tx = 20, ty = baseTranslateY, scale = 1;
  var dragging = false, lastX = 0, lastY = 0;

  function apply() {
    viewport.setAttribute('transform', 'translate(' + tx + ',' + ty + ') scale(' + scale + ')');
  }

  svg.addEventListener('mousedown', function (e) {
    dragging = true; lastX = e.clientX; lastY = e.clientY; svg.classList.add('dragging');
  });
  window.addEventListener('mouseup', function () { dragging = false; svg.classList.remove('dragging'); });
  window.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    tx += (e.clientX - lastX); ty += (e.clientY - lastY);
    lastX = e.clientX; lastY = e.clientY;
    apply();
  });
  svg.addEventListener('wheel', function (e) {
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.1 : 0.9;
    scale = Math.max(0.1, Math.min(4, scale * factor));
    apply();
  }, { passive: false });

  document.getElementById('zoomIn').onclick = function () { scale = Math.min(4, scale * 1.2); apply(); };
  document.getElementById('zoomOut').onclick = function () { scale = Math.max(0.1, scale / 1.2); apply(); };
  document.getElementById('reset').onclick = function () { tx = 20; ty = baseTranslateY; scale = 1; apply(); };

  var searchBox = document.getElementById('search');
  var nodeEls = Array.prototype.slice.call(document.querySelectorAll('.node'));
  searchBox.addEventListener('input', function () {
    var q = searchBox.value.trim().toLowerCase();
    nodeEls.forEach(function (el) {
      if (!q) { el.classList.remove('dimmed'); el.classList.remove('matched'); return; }
      var match = el.getAttribute('data-label').indexOf(q) !== -1;
      el.classList.toggle('dimmed', !match);
      el.classList.toggle('matched', match);
    });
  });

  apply();
})();
</script>
</body>
</html>`;
}

export function buildTestcaseGraphHtml(root: GraphNode, title: string): string {
  const yCursor = { next: 0 };
  layoutTree(root, 0, yCursor);
  return renderTestcaseGraphHtml(root, title);
}
