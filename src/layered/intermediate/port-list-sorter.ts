/**
 * Sorts each node's port list into the canonical clockwise order:
 * NORTH → EAST → SOUTH → WEST. For nodes with `FIXED_ORDER`/`FIXED_POS`,
 * ports on the same side are additionally ordered by `PORT_INDEX` (or by
 * coordinates).
 *
 * Port of `org.eclipse.elk.alg.layered.intermediate.PortListSorter`.
 * Simplified for MVP: we don't run the optional `PortSortingStrategy`
 * post-pass (port-degree reordering on EAST/WEST) — `LongestPathLayerer`
 * does not depend on it, and the user fixture uses `FIXED_ORDER`.
 */
import type { LayoutProcessor } from '../processor.js';
import type { LGraph, LNode, LPort } from '../lgraph.js';
import { PortConstraints, PortSide } from '../../options/enums.js';
import { CoreOptions } from '../../options/core-options.js';

const SIDE_ORDER: Record<PortSide, number> = {
  [PortSide.UNDEFINED]: 0,
  [PortSide.NORTH]: 1,
  [PortSide.EAST]: 2,
  [PortSide.SOUTH]: 3,
  [PortSide.WEST]: 4,
};

function isOrderFixed(pc: PortConstraints): boolean {
  return (
    pc === PortConstraints.FIXED_ORDER ||
    pc === PortConstraints.FIXED_POS ||
    pc === PortConstraints.FIXED_RATIO
  );
}

function isSideFixed(pc: PortConstraints): boolean {
  return isOrderFixed(pc) || pc === PortConstraints.FIXED_SIDE;
}

/** Compares ports first by side, then (for FIXED_ORDER/FIXED_POS) by
 *  port-index or coordinates. Stable sort preserves input order otherwise. */
function comparePorts(a: LPort, b: LPort, pc: PortConstraints): number {
  const sd = SIDE_ORDER[a.side] - SIDE_ORDER[b.side];
  if (sd !== 0) return sd;
  if (!isOrderFixed(pc)) return 0;

  if (pc === PortConstraints.FIXED_ORDER) {
    const i1 = a.getProperty(CoreOptions.PORT_INDEX);
    const i2 = b.getProperty(CoreOptions.PORT_INDEX);
    if (i1 !== undefined && i2 !== undefined) {
      const d = i1 - i2;
      if (d !== 0) return d;
    }
  }

  // Fall back to coordinates (FIXED_POS or tied indices).
  switch (a.side) {
    case PortSide.NORTH:
      return a.position.x - b.position.x;
    case PortSide.EAST:
      return a.position.y - b.position.y;
    case PortSide.SOUTH:
      return b.position.x - a.position.x;
    case PortSide.WEST:
      return b.position.y - a.position.y;
    default:
      return 0;
  }
}

function reverseSlice(arr: LPort[], lo: number, hi: number): void {
  let i = lo;
  let j = hi - 1;
  while (i < j) {
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
    i++;
    j--;
  }
}

/** Mirrors `reverseWestAndSouthSide`. */
function reverseWestAndSouthSide(ports: LPort[]): void {
  if (ports.length <= 1) return;
  for (const side of [PortSide.SOUTH, PortSide.WEST]) {
    let lo = -1;
    let hi = -1;
    for (let i = 0; i < ports.length; i++) {
      if (ports[i].side === side) {
        if (lo === -1) lo = i;
        hi = i + 1;
      }
    }
    if (lo !== -1 && hi - lo > 1) reverseSlice(ports, lo, hi);
  }
}

function processNode(node: LNode): void {
  const pc = node.getProperty(CoreOptions.PORT_CONSTRAINTS);
  if (isOrderFixed(pc)) {
    node.ports.sort((a, b) => comparePorts(a, b, pc));
  } else if (isSideFixed(pc)) {
    node.ports.sort((a, b) => comparePorts(a, b, pc));
    reverseWestAndSouthSide(node.ports);
  }
}

export const PortListSorter: LayoutProcessor = {
  id: 'PORT_LIST_SORTER',
  process(graph: LGraph): void {
    for (const node of graph.layerlessNodes) processNode(node);
    for (const layer of graph.layers) for (const node of layer.nodes) processNode(node);
  },
};
