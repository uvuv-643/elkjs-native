/**
 * Reverses edges around nodes that carry layer constraints so that
 * `FIRST`/`FIRST_SEPARATE` nodes have only outgoing edges and
 * `LAST`/`LAST_SEPARATE` nodes have only incoming ones. This pre-pass
 * runs before the cycle breaker.
 *
 * Port of `org.eclipse.elk.alg.layered.intermediate.EdgeAndLayerConstraintEdgeReverser`.
 *
 * MVP scope:
 * - we only handle outer nodes (i.e. nodes with FIRST/LAST/FIRST_SEPARATE/
 *   LAST_SEPARATE). The "all-ports-reversed" inner-node heuristic is dropped
 *   because the user fixture has no such nodes (see plan §5).
 * - label-dummy guard rails are dropped — no LABEL nodes exist before P2.
 */
import type { LayoutProcessor } from '../processor.js';
import type { LEdge, LGraph, LNode } from '../lgraph.js';
import { EdgeConstraint, LayerConstraint } from '../../options/enums.js';
import { LayeredOptions } from '../../options/layered-options.js';
import { InternalProperties } from '../../options/internal-properties.js';

function reverseEdge(edge: LEdge): void {
  edge.reverse();
  const cur = edge.getProperty(InternalProperties.REVERSED);
  edge.setProperty(InternalProperties.REVERSED, !cur);
}

function targetConstraint(edge: LEdge): LayerConstraint {
  return edge.target!.node!.getProperty(LayeredOptions.LAYERING_LAYER_CONSTRAINT);
}

function sourceConstraint(edge: LEdge): LayerConstraint {
  return edge.source!.node!.getProperty(LayeredOptions.LAYERING_LAYER_CONSTRAINT);
}

function reverseAllOutgoing(node: LNode): void {
  for (const port of node.ports.slice()) {
    for (const edge of port.outgoingEdges.slice()) {
      if (edge.getProperty(InternalProperties.REVERSED)) continue;
      // Don't reverse if it would produce an edge OUT of LAST_SEPARATE.
      if (targetConstraint(edge) === LayerConstraint.LAST_SEPARATE) continue;
      reverseEdge(edge);
    }
  }
}

function reverseAllIncoming(node: LNode): void {
  for (const port of node.ports.slice()) {
    for (const edge of port.incomingEdges.slice()) {
      if (edge.getProperty(InternalProperties.REVERSED)) continue;
      if (sourceConstraint(edge) === LayerConstraint.FIRST_SEPARATE) continue;
      reverseEdge(edge);
    }
  }
}

export const EdgeAndLayerConstraintEdgeReverser: LayoutProcessor = {
  id: 'EDGE_AND_LAYER_CONSTRAINT_EDGE_REVERSER',
  process(graph: LGraph): void {
    for (const node of graph.layerlessNodes) {
      const lc = node.getProperty(LayeredOptions.LAYERING_LAYER_CONSTRAINT);
      switch (lc) {
        case LayerConstraint.FIRST:
        case LayerConstraint.FIRST_SEPARATE:
          node.setProperty(
            InternalProperties.EDGE_CONSTRAINT,
            EdgeConstraint.OUTGOING_ONLY
          );
          reverseAllIncoming(node);
          break;
        case LayerConstraint.LAST:
        case LayerConstraint.LAST_SEPARATE:
          node.setProperty(
            InternalProperties.EDGE_CONSTRAINT,
            EdgeConstraint.INCOMING_ONLY
          );
          reverseAllOutgoing(node);
          break;
      }
    }
  },
};
