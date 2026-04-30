/**
 * Walks every edge after edge routing, and reverses any edge that the
 * cycle breaker (or a layer-constraint reverser) marked with
 * `InternalProperties.REVERSED`. Mirrors
 * `org.eclipse.elk.alg.layered.intermediate.ReversedEdgeRestorer`.
 *
 * After this processor, each marked edge is restored to its original
 * direction; the property itself is also flipped so the flag stays
 * consistent if the graph is laid out again.
 */
import type { LayoutProcessor } from '../processor.js';
import { LEdge, LGraph } from '../lgraph.js';
import { InternalProperties } from '../../options/internal-properties.js';

export const ReversedEdgeRestorer: LayoutProcessor = {
  id: 'REVERSED_EDGE_RESTORER',
  process(graph: LGraph): void {
    for (const layer of graph.layers) {
      for (const node of layer.nodes) {
        for (const port of node.ports) {
          // Snapshot — `reverse` mutates port.outgoingEdges.
          const outgoing: LEdge[] = port.outgoingEdges.slice();
          for (const edge of outgoing) {
            if (edge.getProperty(InternalProperties.REVERSED)) {
              edge.reverse();
              edge.setProperty(InternalProperties.REVERSED, false);
            }
          }
        }
      }
    }
  },
};
