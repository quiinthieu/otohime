// One In life drawing per page, keyed by slug: the everyday thing that works
// the way the structure does, its one spot the thing the rule is about.
import type { Figure } from "../kit.ts";
import { arrayLife } from "./array.ts";
import { binarySearchTreeLife } from "./binary-search-tree.ts";
import { graphLife } from "./graph.ts";
import { hashTableLife } from "./hash-table.ts";
import { heapLife } from "./heap.ts";
import { linkedListLife } from "./linked-list.ts";
import { queueLife } from "./queue.ts";
import { stackLife } from "./stack.ts";

export type { Figure, Label } from "../kit.ts";

export const LIFE: Record<string, () => Figure> = {
  array: arrayLife,
  "linked-list": linkedListLife,
  stack: stackLife,
  queue: queueLife,
  "hash-table": hashTableLife,
  "binary-search-tree": binarySearchTreeLife,
  heap: heapLife,
  graph: graphLife,
};

export function lifeFigure(slug: string): Figure {
  const draw = LIFE[slug];
  if (!draw) throw new Error(`no In life drawing for ${slug}`);
  return draw();
}
