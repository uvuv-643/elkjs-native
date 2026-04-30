/**
 * Removes `LONG_EDGE` dummy nodes inserted by {@link './long-edge-splitter.ts' LongEdgeSplitter}
 * and stitches the chain of edges back into the original surviving edge.
 *
 * Port of `org.eclipse.elk.alg.layered.intermediate.LongEdgeJoiner`.
 *
 * MVP simplifications:
 *  - we do not honour the `UNNECESSARY_BENDPOINTS` option (always treated
 *    as `false`); the user's pipeline does not set it either;
 *  - junction points are not propagated (we don't compute them in P5).
 */
import type { LayoutProcessor } from '../processor.js';
import { LGraph, LNode, NodeType } from '../lgraph.js';
import { KVector } from '../../math/kvector.js';

export const LongEdgeJoiner: LayoutProcessor = {
  id: 'LONG_EDGE_JOINER',
  process(graph: LGraph): void {
    for (const layer of graph.layers) {
      const survivors: LNode[] = [];
      for (const node of layer.nodes) {
        if (node.type === NodeType.LONG_EDGE) {
          joinAt(node);
        } else {
          survivors.push(node);
        }
      }
      layer.nodes = survivors;
    }
  },
};

/**
 * Stitches the incoming and outgoing edges of a `LONG_EDGE` dummy back
 * into single edges. The incoming edge survives; the outgoing edge is
 * dropped after copying its bend points and labels.
 */
function joinAt(dummy: LNode): void {
  // Long-edge dummies always have exactly one west port (input) and one
  // east port (output) created by LongEdgeSplitter; both ports carry one
  // edge each in the MVP (we don't merge hyperedges).
  let inputPort = null;
  let outputPort = null;
  for (const p of dummy.ports) {
    if (p.incomingEdges.length > 0) inputPort = p;
    if (p.outgoingEdges.length > 0) outputPort = p;
  }
  if (!inputPort || !outputPort) return;

  // Snapshot — the loop mutates incomingEdges via setTarget.
  const inEdges = inputPort.incomingEdges.slice();
  const outEdges = outputPort.outgoingEdges.slice();
  const n = Math.min(inEdges.length, outEdges.length);

  for (let i = 0; i < n; i++) {
    const surviving = inEdges[i];
    const dropped = outEdges[i];
    const newTarget = dropped.target;

    // Re-route surviving edge to the dropped edge's target.
    surviving.setTarget(newTarget);
    dropped.setSource(null);
    dropped.setTarget(null);

    // Concatenate bend points (cloned to avoid aliasing).
    for (const bp of dropped.bendPoints) {
      surviving.bendPoints.push(new KVector(bp.x, bp.y));
    }
    // Carry labels too (rare in MVP, but cheap).
    for (const lbl of dropped.labels) surviving.labels.push(lbl);
  }
}
