/**
 * P2 — `LongestPathSourceLayerer`.
 *
 * Direct port of `org.eclipse.elk.alg.layered.p2layers.LongestPathSourceLayerer`
 * (Java source 37-138). This is the source-rooted variant: every node's layer
 * index equals the length of the longest directed path from any source node.
 *
 * This matches the layering produced by the reference elkjs build for the
 * user's flowchart — the previous sink-rooted `LongestPathLayerer` produced a
 * different layering on graphs with multiple sinks at different depths.
 *
 * Precondition: graph has no cycles (P1 already ran).
 */
import { Layer, type LGraph, type LNode } from '../lgraph.js';
import { ProcessorSlot } from '../processor.js';
import type { LayoutPhase, PhaseSlotConfig } from './phase.js';
import { IntermediateProcessor } from '../intermediate/registry.js';

export const LongestPathLayerer: LayoutPhase = {
  id: 'LONGEST_PATH_LAYERER',

  process(graph: LGraph): void {
    const nodes = graph.layerlessNodes;
    if (nodes.length === 0) return;

    // Re-index nodes for fast Int32Array lookup.
    for (let i = 0; i < nodes.length; i++) nodes[i].id = i;
    const nodeHeights = new Int32Array(nodes.length).fill(-1);

    const layers: Layer[] = [];

    /** Java `visit(node)` at lines 97-118. Returns longest path from a source. */
    const visit = (node: LNode): number => {
      if (nodeHeights[node.id] >= 0) return nodeHeights[node.id];

      let maxHeight = 1;
      for (const port of node.ports) {
        for (const edge of port.incomingEdges) {
          const src = edge.source?.node;
          if (!src || src === node) continue; // ignore self-loops
          const sourceHeight = visit(src);
          if (sourceHeight + 1 > maxHeight) maxHeight = sourceHeight + 1;
        }
      }

      // Java `putNode(node, height)` at lines 127-138.
      while (layers.length < maxHeight) layers.push(new Layer(graph));
      const layer = layers[maxHeight - 1];
      node.layer = layer;
      layer.nodes.push(node);
      nodeHeights[node.id] = maxHeight;
      return maxHeight;
    };

    for (const node of nodes) visit(node);

    graph.layers = layers;
    graph.layerlessNodes = [];
  },

  getProcessorConfiguration(_graph: LGraph): PhaseSlotConfig {
    return {
      [ProcessorSlot.BEFORE_P1]: [
        IntermediateProcessor.EDGE_AND_LAYER_CONSTRAINT_EDGE_REVERSER,
      ],
      [ProcessorSlot.BEFORE_P2]: [
        IntermediateProcessor.PORT_LIST_SORTER,
        IntermediateProcessor.LAYER_CONSTRAINT_PREPROCESSOR,
      ],
      [ProcessorSlot.BEFORE_P3]: [
        IntermediateProcessor.LAYER_CONSTRAINT_POSTPROCESSOR,
        IntermediateProcessor.PORT_SIDE_PROCESSOR,
        IntermediateProcessor.LONG_EDGE_SPLITTER,
        IntermediateProcessor.INVERTED_PORT_PROCESSOR,
        IntermediateProcessor.SORT_BY_INPUT_ORDER_OF_MODEL,
      ],
    };
  },
};
