/**
 * Sorts nodes within each layer (and outgoing ports of each node) by the
 * order of incoming edges from the previous layer.
 *
 * Port of `org.eclipse.elk.alg.layered.intermediate.SortByInputModelProcessor`
 * combined with the comparator logic from `ModelOrderNodeComparator`
 * (preserveorder/ModelOrderNodeComparator.java lines 111-278).
 *
 * MVP scope (matching our user pipeline):
 *  - `OrderingStrategy.PREFER_EDGES` is the only mode that fires; everything
 *    else short-circuits to insertion order.
 *  - No long-edge dummy handling, no group order — those branches in Java
 *    are unreachable for plain flowchart graphs.
 *
 * The algorithm walks layers left-to-right. For each non-zero layer it
 * sorts nodes by the position of their incoming source-node within the
 * previous layer. Ties (same source node) are broken by source port order.
 * Nodes with no incoming edge fall back to `MODEL_ORDER`.
 */
import type { LayoutProcessor } from '../processor.js';
import type { LGraph, LNode, LPort } from '../lgraph.js';
import { OrderingStrategy, PortConstraints } from '../../options/enums.js';
import { CoreOptions } from '../../options/core-options.js';
import { LayeredOptions } from '../../options/layered-options.js';
import { InternalProperties } from '../../options/internal-properties.js';

function getModelOrder(o: { hasProperty: (p: typeof InternalProperties.MODEL_ORDER) => boolean; getProperty: (p: typeof InternalProperties.MODEL_ORDER) => number }): number {
  return o.hasProperty(InternalProperties.MODEL_ORDER)
    ? o.getProperty(InternalProperties.MODEL_ORDER)
    : Number.MAX_SAFE_INTEGER;
}

interface NodeKey {
  /** index of source node in previous layer; -1 if no incoming edge */
  prevIdx: number;
  /** within same source: index of source port */
  sourcePortIdx: number;
  /** model order of this node, fallback */
  selfMo: number;
  /** original layer index, ultimate tie-break */
  origIdx: number;
}

function findIncomingSourcePort(node: LNode): LPort | null {
  for (const p of node.ports) {
    if (p.incomingEdges.length === 0) continue;
    const src = p.incomingEdges[0].source;
    if (!src) continue;
    if (src.node?.layer === node.layer) continue; // in-layer edge — skip
    return src;
  }
  return null;
}

function keyForNode(
  node: LNode,
  origIdx: number,
  prevLayerIndex: Map<LNode, number>
): NodeKey {
  const sourcePort = findIncomingSourcePort(node);
  if (!sourcePort || !sourcePort.node) {
    return {
      prevIdx: Number.MAX_SAFE_INTEGER,
      sourcePortIdx: 0,
      selfMo: getModelOrder(node),
      origIdx,
    };
  }
  const idx = prevLayerIndex.get(sourcePort.node);
  return {
    prevIdx: idx ?? Number.MAX_SAFE_INTEGER,
    sourcePortIdx: sourcePort.node.ports.indexOf(sourcePort),
    selfMo: getModelOrder(node),
    origIdx,
  };
}

function compareKeys(a: NodeKey, b: NodeKey): number {
  if (a.prevIdx !== b.prevIdx) return a.prevIdx - b.prevIdx;
  if (a.sourcePortIdx !== b.sourcePortIdx) return a.sourcePortIdx - b.sourcePortIdx;
  if (a.selfMo !== b.selfMo) return a.selfMo - b.selfMo;
  return a.origIdx - b.origIdx;
}

export const SortByInputModelOrder: LayoutProcessor = {
  id: 'SORT_BY_INPUT_ORDER_OF_MODEL',

  process(graph: LGraph): void {
    const strategy = graph.getProperty(LayeredOptions.CONSIDER_MODEL_ORDER_STRATEGY);
    if (strategy === OrderingStrategy.NONE) return;

    // Layer 0: order purely by MODEL_ORDER.
    if (graph.layers.length > 0) {
      const layer0 = graph.layers[0];
      const indexed = layer0.nodes.map((n, i) => ({ n, mo: getModelOrder(n), i }));
      indexed.sort((a, b) => (a.mo - b.mo) || (a.i - b.i));
      layer0.nodes.length = 0;
      for (const v of indexed) layer0.nodes.push(v.n);
    }

    // Subsequent layers: order by source-node position in the previous layer
    // (PREFER_EDGES semantics; see ModelOrderNodeComparator in Java).
    for (let li = 1; li < graph.layers.length; li++) {
      const prev = graph.layers[li - 1];
      const prevIndex = new Map<LNode, number>();
      for (let i = 0; i < prev.nodes.length; i++) prevIndex.set(prev.nodes[i], i);

      const layer = graph.layers[li];
      const indexed = layer.nodes.map((n, i) => ({
        n,
        key: keyForNode(n, i, prevIndex),
      }));
      indexed.sort((a, b) => compareKeys(a.key, b.key));
      layer.nodes.length = 0;
      for (const v of indexed) layer.nodes.push(v.n);
    }

    // Ports: keep input order unless the port-constraints say otherwise.
    for (const layer of graph.layers) {
      for (const node of layer.nodes) {
        const pc = node.getProperty(CoreOptions.PORT_CONSTRAINTS);
        if (pc !== PortConstraints.FIXED_ORDER && pc !== PortConstraints.FIXED_POS) {
          const indexed = node.ports.map((p, i) => ({ p, mo: getModelOrder(p), i }));
          indexed.sort((a, b) => (a.mo - b.mo) || (a.i - b.i));
          node.ports.length = 0;
          for (const v of indexed) node.ports.push(v.p);
        }
      }
    }
  },
};
