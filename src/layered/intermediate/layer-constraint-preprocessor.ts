/**
 * Hides nodes with `FIRST_SEPARATE`/`LAST_SEPARATE` layer constraints
 * from the graph before layering. The companion postprocessor restores
 * them after P2 in their dedicated layers.
 *
 * Port of `org.eclipse.elk.alg.layered.intermediate.LayerConstraintPreprocessor`.
 *
 * MVP: we don't auto-promote opposite nodes to FIRST/LAST when their last
 * remaining neighbour gets hidden — that heuristic is only relevant when
 * isolated leftovers would otherwise drift far away, which doesn't apply
 * to flat user graphs in our scope.
 */
import type { LayoutProcessor } from '../processor.js';
import type { LEdge, LGraph, LNode, LPort } from '../lgraph.js';
import { LayerConstraint } from '../../options/enums.js';
import { LayeredOptions } from '../../options/layered-options.js';
import { InternalProperties } from '../../options/internal-properties.js';

function isHiddenConstraint(node: LNode): boolean {
  const lc = node.getProperty(LayeredOptions.LAYERING_LAYER_CONSTRAINT);
  return lc === LayerConstraint.FIRST_SEPARATE || lc === LayerConstraint.LAST_SEPARATE;
}

function detachEdge(edge: LEdge, node: LNode): void {
  const isOutgoing = edge.source?.node === node;
  const oppositePort: LPort | null = isOutgoing ? edge.target : edge.source;
  if (isOutgoing) edge.setTarget(null);
  else edge.setSource(null);
  if (oppositePort)
    edge.setProperty(InternalProperties.ORIGINAL_OPPOSITE_PORT, oppositePort);
}

export const LayerConstraintPreprocessor: LayoutProcessor = {
  id: 'LAYER_CONSTRAINT_PREPROCESSOR',
  process(graph: LGraph): void {
    const hidden: LNode[] = [];
    const remaining: LNode[] = [];

    for (const node of graph.layerlessNodes) {
      if (!isHiddenConstraint(node)) {
        remaining.push(node);
        continue;
      }
      // Detach all incident edges.
      for (const port of node.ports) {
        for (const edge of port.outgoingEdges.slice()) detachEdge(edge, node);
        for (const edge of port.incomingEdges.slice()) detachEdge(edge, node);
      }
      hidden.push(node);
    }

    if (hidden.length > 0) {
      graph.setProperty(InternalProperties.HIDDEN_NODES, hidden);
      graph.layerlessNodes = remaining;
    }
  },
};
