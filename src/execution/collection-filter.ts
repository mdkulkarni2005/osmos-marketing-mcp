import type { PostmanCollection, PostmanFolder, PostmanItem } from "../schemas/collection.js";
import { isFolder } from "../schemas/collection.js";
import { extractTcId } from "./tc-id.js";

/**
 * Filters a built collection down to only the requests whose TC_ID is in
 * `tcIds`, preserving folder structure and every collection-level construct
 * (auth, pre-request script, variables) — only `item` is pruned. Empty
 * folders left over after pruning are dropped. Used for "rerun one
 * testcase" / "rerun failed-only" / "rerun one folder" (resolved to a
 * TC_ID set by the caller before this runs).
 */
export function filterCollectionByTcIds(collection: PostmanCollection, tcIds: Set<string>): PostmanCollection {
  const filterNodes = (nodes: (PostmanItem | PostmanFolder)[]): (PostmanItem | PostmanFolder)[] => {
    const out: (PostmanItem | PostmanFolder)[] = [];
    for (const node of nodes) {
      if (isFolder(node)) {
        const filteredItem = filterNodes(node.item);
        if (filteredItem.length > 0) out.push({ ...node, item: filteredItem });
      } else {
        const tcId = extractTcId(node.name);
        if (tcId && tcIds.has(tcId)) out.push(node);
      }
    }
    return out;
  };

  return { ...collection, item: filterNodes(collection.item) };
}

export function collectionTcIds(collection: PostmanCollection): string[] {
  const ids: string[] = [];
  const walk = (nodes: (PostmanItem | PostmanFolder)[]) => {
    for (const node of nodes) {
      if (isFolder(node)) walk(node.item);
      else {
        const tcId = extractTcId(node.name);
        if (tcId) ids.push(tcId);
      }
    }
  };
  walk(collection.item);
  return ids;
}
