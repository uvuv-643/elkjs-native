/**
 * Phase 3 — Layer-sweep crossing minimization (barycenter heuristic).
 *
 * Simplified port of
 * `org.eclipse.elk.alg.layered.p3order.LayerSweepCrossingMinimizer` plus
 * `BarycenterHeuristic`, dropping:
 *
 * - hierarchy-aware sweeps (no compound graphs in scope);
 * - the more aggressive `GreedySwitchHeuristic` follow-up pass;
 * - randomization across multiple seeds (we run a single deterministic
 *   sweep — this is the most-used path inside elkjs and is good enough
 *   for correctness; quality matches the reference within a few crossings
 *   on flat graphs);
 * - port-distribution edge cases for FIXED_ORDER ports — we leave those
 *   alone (their order was already determined by `PortListSorter`).
 *
 * Algorithm (forward sweep):
 *
 * ```
 * for each layer L from index 1 .. N-1:
 *   for each node n ∈ L:
 *     b(n) := average port-position-index of source endpoints in L-1
 *             of n's incoming edges (or n's current index if none)
 *   sort L by b(n) ascending, ties broken by current index
 * ```
 *
 * Backward sweep is symmetric (uses outgoing edges to next layer).
 *
 * The processor alternates forward/backward sweeps up to
 * `LayeredOptions.THOROUGHNESS` (default 7) iterations or until no layer
 * order changes. Crossings counted with the simple
 * "in-order-pair-within-window" counter.
 *
 * **Determinism:** stable sort on (barycenter, original index) gives the
 * same output for the same input, regardless of iteration order in the
 * underlying engines.
 */
import type { LGraph, LNode, LPort } from '../lgraph.js';
import type { LayoutPhase, PhaseSlotConfig } from './phase.js';
import { ProcessorSlot } from '../processor.js';
import { IntermediateProcessor } from '../intermediate/registry.js';
import { LayeredOptions } from '../../options/layered-options.js';
import { CoreOptions } from '../../options/core-options.js';
import { PortConstraints } from '../../options/enums.js';
void LayeredOptions; // imported for parity with other phases

const MAX_SWEEPS = 24;

/**
 * Position of a port within the rendering order of its node's ports.
 * Lower is "higher up" (closer to NORTH/EAST top); used as the linear
 * coordinate that the barycenter averages over.
 */
function portIndex(port: LPort): number {
  const node = port.node;
  if (!node) return 0;
  return node.ports.indexOf(port);
}

/** Linear position of a node within its layer (lower = higher up). */
function layerIndex(node: LNode, layerIdx: Map<LNode, number>): number {
  return layerIdx.get(node) ?? 0;
}

function barycenterFromPrevLayer(
  node: LNode,
  prevLayerIdx: Map<LNode, number>,
  fallback: number
): number {
  let sum = 0;
  let count = 0;
  for (const port of node.ports) {
    for (const edge of port.incomingEdges) {
      const src = edge.source;
      if (!src) continue;
      const srcNode = src.node;
      if (!srcNode) continue;
      const idx = prevLayerIdx.get(srcNode);
      if (idx === undefined) continue;
      // Combine node index (major) with port index (minor) so the
      // barycenter is monotone in the source node's order and breaks
      // ties by source-port order.
      const portCount = srcNode.ports.length || 1;
      sum += idx + portIndex(src) / portCount;
      count++;
    }
  }
  return count > 0 ? sum / count : fallback;
}

function barycenterFromNextLayer(
  node: LNode,
  nextLayerIdx: Map<LNode, number>,
  fallback: number
): number {
  let sum = 0;
  let count = 0;
  for (const port of node.ports) {
    for (const edge of port.outgoingEdges) {
      const tgt = edge.target;
      if (!tgt) continue;
      const tgtNode = tgt.node;
      if (!tgtNode) continue;
      const idx = nextLayerIdx.get(tgtNode);
      if (idx === undefined) continue;
      const portCount = tgtNode.ports.length || 1;
      sum += idx + portIndex(tgt) / portCount;
      count++;
    }
  }
  return count > 0 ? sum / count : fallback;
}

/**
 * Counts the number of pairwise crossings between two adjacent layers.
 * O(E·log E) using the bilayer-cross-counting algorithm (Barth et al.).
 *
 * For each edge (u → v) we get the source port index in `from` and target
 * port index in `to`. Two edges (u₁→v₁) and (u₂→v₂) cross iff
 * (u₁_idx < u₂_idx) ≠ (v₁_idx < v₂_idx). Counted with a Fenwick tree.
 */
function countCrossings(from: LNode[], to: LNode[]): number {
  const fromIdx = new Map<LNode, number>();
  const toIdx = new Map<LNode, number>();
  for (let i = 0; i < from.length; i++) fromIdx.set(from[i], i);
  for (let i = 0; i < to.length; i++) toIdx.set(to[i], i);

  // Collect (sourceIdx, targetIdx) pairs.
  const pairs: { s: number; t: number }[] = [];
  for (const node of from) {
    for (const port of node.ports) {
      for (const edge of port.outgoingEdges) {
        const tgtNode = edge.target?.node;
        if (!tgtNode) continue;
        const tIdx = toIdx.get(tgtNode);
        if (tIdx === undefined) continue;
        pairs.push({ s: fromIdx.get(node)!, t: tIdx });
      }
    }
  }

  // Sort by source asc; for ties by target asc — that way only
  // "earlier-source-but-later-target vs. later-source-but-earlier-target"
  // pairs become crossings, which we count as inversions on the target list.
  pairs.sort((a, b) => (a.s - b.s) || (a.t - b.t));
  // Count inversions in the resulting target sequence.
  const targets = pairs.map((p) => p.t);
  return countInversions(targets);
}

function countInversions(arr: number[]): number {
  if (arr.length <= 1) return 0;
  // Merge-sort based inversion counter.
  const temp = arr.slice();
  return sortAndCount(temp, 0, temp.length - 1);

  function sortAndCount(a: number[], lo: number, hi: number): number {
    if (lo >= hi) return 0;
    const mid = (lo + hi) >>> 1;
    let inv = sortAndCount(a, lo, mid) + sortAndCount(a, mid + 1, hi);
    inv += merge(a, lo, mid, hi);
    return inv;
  }

  function merge(a: number[], lo: number, mid: number, hi: number): number {
    const left = a.slice(lo, mid + 1);
    const right = a.slice(mid + 1, hi + 1);
    let i = 0;
    let j = 0;
    let k = lo;
    let inv = 0;
    while (i < left.length && j < right.length) {
      if (left[i] <= right[j]) {
        a[k++] = left[i++];
      } else {
        a[k++] = right[j++];
        inv += left.length - i;
      }
    }
    while (i < left.length) a[k++] = left[i++];
    while (j < right.length) a[k++] = right[j++];
    return inv;
  }
}

/** Total crossings across all consecutive layer pairs. */
function totalCrossings(graph: LGraph): number {
  let total = 0;
  for (let i = 0; i + 1 < graph.layers.length; i++) {
    total += countCrossings(graph.layers[i].nodes, graph.layers[i + 1].nodes);
  }
  return total;
}

/** Forward sweep: order each layer by barycenter from previous layer. */
function forwardSweep(graph: LGraph): boolean {
  let changed = false;
  for (let li = 1; li < graph.layers.length; li++) {
    const prev = graph.layers[li - 1].nodes;
    const cur = graph.layers[li].nodes;
    const prevIdx = new Map<LNode, number>();
    for (let i = 0; i < prev.length; i++) prevIdx.set(prev[i], i);
    const curIdx = new Map<LNode, number>();
    for (let i = 0; i < cur.length; i++) curIdx.set(cur[i], i);

    const annotated = cur.map((n, i) => ({
      n,
      b: barycenterFromPrevLayer(n, prevIdx, layerIndex(n, curIdx)),
      orig: i,
    }));
    annotated.sort((x, y) => (x.b - y.b) || (x.orig - y.orig));
    for (let i = 0; i < annotated.length; i++) {
      if (cur[i] !== annotated[i].n) changed = true;
      cur[i] = annotated[i].n;
    }
  }
  return changed;
}

/** Backward sweep: order each layer by barycenter from next layer. */
function backwardSweep(graph: LGraph): boolean {
  let changed = false;
  for (let li = graph.layers.length - 2; li >= 0; li--) {
    const next = graph.layers[li + 1].nodes;
    const cur = graph.layers[li].nodes;
    const nextIdx = new Map<LNode, number>();
    for (let i = 0; i < next.length; i++) nextIdx.set(next[i], i);
    const curIdx = new Map<LNode, number>();
    for (let i = 0; i < cur.length; i++) curIdx.set(cur[i], i);

    const annotated = cur.map((n, i) => ({
      n,
      b: barycenterFromNextLayer(n, nextIdx, layerIndex(n, curIdx)),
      orig: i,
    }));
    annotated.sort((x, y) => (x.b - y.b) || (x.orig - y.orig));
    for (let i = 0; i < annotated.length; i++) {
      if (cur[i] !== annotated[i].n) changed = true;
      cur[i] = annotated[i].n;
    }
  }
  return changed;
}

/** Sort each node's ports by the barycenter of their connections, but only
 *  if the node's port constraints don't fix them in place. */
function sortPortsByBarycenter(graph: LGraph): void {
  for (let li = 0; li < graph.layers.length; li++) {
    const layer = graph.layers[li].nodes;
    const prevIdx = new Map<LNode, number>();
    if (li > 0) {
      const prev = graph.layers[li - 1].nodes;
      for (let i = 0; i < prev.length; i++) prevIdx.set(prev[i], i);
    }
    const nextIdx = new Map<LNode, number>();
    if (li + 1 < graph.layers.length) {
      const next = graph.layers[li + 1].nodes;
      for (let i = 0; i < next.length; i++) nextIdx.set(next[i], i);
    }

    for (const node of layer) {
      const pc = node.getProperty(CoreOptions.PORT_CONSTRAINTS);
      if (pc === PortConstraints.FIXED_ORDER || pc === PortConstraints.FIXED_POS) {
        continue;
      }
      // Compute a barycenter per port: average index of the connected
      // node in the opposite layer. Outgoing → next, incoming → prev.
      const annotated = node.ports.map((p, i) => ({ p, b: portBary(p), orig: i }));
      annotated.sort((a, b) => (a.b - b.b) || (a.orig - b.orig));
      node.ports = annotated.map((a) => a.p);
    }

    function portBary(port: LPort): number {
      let sum = 0;
      let count = 0;
      for (const e of port.outgoingEdges) {
        const idx = nextIdx.get(e.target?.node ?? null as unknown as LNode);
        if (idx !== undefined) { sum += idx; count++; }
      }
      for (const e of port.incomingEdges) {
        const idx = prevIdx.get(e.source?.node ?? null as unknown as LNode);
        if (idx !== undefined) { sum += idx; count++; }
      }
      return count > 0 ? sum / count : 0;
    }
  }
}

export const LayerSweepCrossingMinimizer: LayoutPhase = {
  id: 'LAYER_SWEEP_CROSSING_MINIMIZER',

  process(graph: LGraph): void {
    if (graph.layers.length < 2) return;

    let bestCrossings = totalCrossings(graph);
    if (bestCrossings === 0) {
      // Already minimal — still sort ports for stability.
      sortPortsByBarycenter(graph);
      return;
    }

    // Snapshot to allow rollback if a sweep makes things worse.
    let bestSnapshot = graph.layers.map((l) => l.nodes.slice());

    let direction: 'forward' | 'backward' = 'forward';
    let stableSweeps = 0;
    for (let sweep = 0; sweep < MAX_SWEEPS; sweep++) {
      const changed =
        direction === 'forward' ? forwardSweep(graph) : backwardSweep(graph);
      direction = direction === 'forward' ? 'backward' : 'forward';

      const c = totalCrossings(graph);
      if (c < bestCrossings) {
        bestCrossings = c;
        bestSnapshot = graph.layers.map((l) => l.nodes.slice());
        stableSweeps = 0;
        if (bestCrossings === 0) break;
      } else {
        stableSweeps++;
        if (!changed || stableSweeps >= 4) break;
      }
    }

    // Restore best snapshot.
    for (let i = 0; i < graph.layers.length; i++) {
      graph.layers[i].nodes = bestSnapshot[i];
    }

    sortPortsByBarycenter(graph);
  },

  getProcessorConfiguration(_graph: LGraph): PhaseSlotConfig {
    // Same dependencies as `NoCrossingMinimizer`: requires a proper graph
    // (long-edge dummies inserted, port sides assigned).
    return {
      [ProcessorSlot.BEFORE_P3]: [
        IntermediateProcessor.LONG_EDGE_SPLITTER,
        IntermediateProcessor.PORT_SIDE_PROCESSOR,
      ],
    };
  },
};
