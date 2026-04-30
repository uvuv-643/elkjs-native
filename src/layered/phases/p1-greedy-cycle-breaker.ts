/**
 * P1: Greedy cycle-breaker.
 *
 * Direct port of `org.eclipse.elk.alg.layered.p1cycles.GreedyCycleBreaker`.
 * Implements the Eades/Lin/Smyth heuristic: rank nodes left-to-right via
 * a "remove sinks from the right, sources from the left, otherwise pick
 * the one with the highest out-flow" loop, then reverse any edge that
 * points right-to-left under that ranking.
 *
 * Postcondition: the graph contains no cycles. Reversed edges carry
 * `InternalProperties.REVERSED = true`.
 */
import type { LEdge, LGraph, LNode } from '../lgraph.js';
import { ProcessorSlot } from '../processor.js';
import type { LayoutPhase, PhaseSlotConfig } from './phase.js';
import { IntermediateProcessor } from '../intermediate/registry.js';
import { LayeredOptions } from '../../options/layered-options.js';
import { InternalProperties } from '../../options/internal-properties.js';

/** Reverses an edge in place and toggles the REVERSED flag. */
function reverseEdge(edge: LEdge): void {
  edge.reverse();
  const cur = edge.getProperty(InternalProperties.REVERSED);
  edge.setProperty(InternalProperties.REVERSED, !cur);
}

export const GreedyCycleBreaker: LayoutPhase = {
  id: 'GREEDY_CYCLE_BREAKER',

  process(graph: LGraph): void {
    const nodes = graph.layerlessNodes;
    const n = nodes.length;
    if (n === 0) return;

    const indeg = new Int32Array(n);
    const outdeg = new Int32Array(n);
    const mark = new Int32Array(n);

    // Java uses LinkedList; here Arrays as stacks/queues are fine. The Java
    // code calls `removeFirst`, so to mirror order we use shift() — but for
    // correctness the order inside sources/sinks doesn't change layout.
    const sources: LNode[] = [];
    const sinks: LNode[] = [];

    // Initialise indeg/outdeg using PRIORITY_DIRECTION-weighted edges.
    for (let i = 0; i < n; i++) {
      const node = nodes[i];
      node.id = i;
      for (const port of node.ports) {
        for (const edge of port.incomingEdges) {
          if (edge.source && edge.source.node === node) continue; // self-loop
          const prio = edge.getProperty(LayeredOptions.PRIORITY_DIRECTION);
          indeg[i] += prio > 0 ? prio + 1 : 1;
        }
        for (const edge of port.outgoingEdges) {
          if (edge.target && edge.target.node === node) continue; // self-loop
          const prio = edge.getProperty(LayeredOptions.PRIORITY_DIRECTION);
          outdeg[i] += prio > 0 ? prio + 1 : 1;
        }
      }
      if (outdeg[i] === 0) sinks.push(node);
      else if (indeg[i] === 0) sources.push(node);
    }

    let nextRight = -1;
    let nextLeft = 1;
    let unprocessed = n;

    while (unprocessed > 0) {
      while (sinks.length > 0) {
        const sink = sinks.shift()!;
        mark[sink.id] = nextRight--;
        updateNeighbors(sink, mark, indeg, outdeg, sources, sinks);
        unprocessed--;
      }
      while (sources.length > 0) {
        const source = sources.shift()!;
        mark[source.id] = nextLeft++;
        updateNeighbors(source, mark, indeg, outdeg, sources, sinks);
        unprocessed--;
      }
      if (unprocessed > 0) {
        // Find the unmarked node with the largest outflow.
        let maxOutflow = Number.NEGATIVE_INFINITY;
        let maxNode: LNode | null = null;
        for (const node of nodes) {
          if (mark[node.id] === 0) {
            const flow = outdeg[node.id] - indeg[node.id];
            if (flow > maxOutflow) {
              maxOutflow = flow;
              maxNode = node;
            }
          }
        }
        // Note: Java picks randomly among ties; we take the first to keep
        // the result deterministic without an RNG. // DIVERGE: deterministic tie-break.
        mark[maxNode!.id] = nextLeft++;
        updateNeighbors(maxNode!, mark, indeg, outdeg, sources, sinks);
        unprocessed--;
      }
    }

    // Shift negative ranks (sinks) up to be positive.
    const shiftBase = n + 1;
    for (let i = 0; i < n; i++) {
      if (mark[i] < 0) mark[i] += shiftBase;
    }

    // Reverse edges that point left in the ranking.
    for (const node of nodes) {
      // Snapshot ports/edges before mutating.
      for (const port of node.ports.slice()) {
        for (const edge of port.outgoingEdges.slice()) {
          if (!edge.target) continue;
          const targetIx = edge.target.node!.id;
          if (mark[node.id] > mark[targetIx]) {
            reverseEdge(edge);
            graph.setProperty(InternalProperties.CYCLIC, true);
          }
        }
      }
    }
  },

  getProcessorConfiguration(_graph: LGraph): PhaseSlotConfig {
    return {
      [ProcessorSlot.BEFORE_P1]: [
        IntermediateProcessor.EDGE_AND_LAYER_CONSTRAINT_EDGE_REVERSER,
      ],
      [ProcessorSlot.AFTER_P5]: [IntermediateProcessor.REVERSED_EDGE_RESTORER],
    };
  },
};

/** Mirrors `GreedyCycleBreaker.updateNeighbors` — simulates removal of `node`
 *  from the graph by decrementing degrees of its neighbours. */
function updateNeighbors(
  node: LNode,
  mark: Int32Array,
  indeg: Int32Array,
  outdeg: Int32Array,
  sources: LNode[],
  sinks: LNode[]
): void {
  for (const port of node.ports) {
    const connected: { edge: LEdge; outgoing: boolean }[] = [];
    for (const e of port.outgoingEdges) connected.push({ edge: e, outgoing: true });
    for (const e of port.incomingEdges) connected.push({ edge: e, outgoing: false });

    for (const { edge, outgoing } of connected) {
      const otherPort = outgoing ? edge.target : edge.source;
      if (!otherPort) continue;
      const endpoint = otherPort.node!;
      if (endpoint === node) continue; // self-loop

      let prio = edge.getProperty(LayeredOptions.PRIORITY_DIRECTION);
      if (prio < 0) prio = 0;
      const ix = endpoint.id;
      if (mark[ix] !== 0) continue;

      if (outgoing) {
        // The edge is incoming for the endpoint.
        indeg[ix] -= prio + 1;
        if (indeg[ix] <= 0 && outdeg[ix] > 0) sources.push(endpoint);
      } else {
        outdeg[ix] -= prio + 1;
        if (outdeg[ix] <= 0 && indeg[ix] > 0) sinks.push(endpoint);
      }
    }
  }
}
