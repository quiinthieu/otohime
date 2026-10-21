// The series in teaching order: each page uses only pictures from the ones
// before it. The pages, the costs card and the tests all read this list.
import type { Structure } from "../machine.ts";
import { array } from "./array.ts";
import { binarySearchTree } from "./binary-search-tree.ts";
import { graph } from "./graph.ts";
import { hashTable } from "./hash-table.ts";
import { heap } from "./heap.ts";
import { linkedList } from "./linked-list.ts";
import { queue } from "./queue.ts";
import { stack } from "./stack.ts";

export const STRUCTURES: readonly Structure<unknown>[] = [array, linkedList, stack, queue, hashTable, binarySearchTree, heap, graph];

export function bySlug(slug: string): Structure<unknown> | undefined {
  return STRUCTURES.find((s) => s.slug === slug);
}
