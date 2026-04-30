/**
 * Phase 4 — Simple node placer.
 *
 * The trivial counterpart to {@link BKNodePlacer}: every node in a layer
 * is stacked top-to-bottom with `spacing.nodeNode` between each pair,
 * regardless of edge connectivity. The layer's height is the sum of
 * node heights + spacings.
 *
 * Mirrors `org.eclipse.elk.alg.layered.p4nodes.SimpleNodePlacer`. We use
 * this when callers explicitly select `NodePlacementStrategy.SIMPLE` —
 * its main purpose in elkjs-native is debugging: BK is the default and
 * produces straighter layouts, while simple placement is easy to reason
 * about and useful for golden-test regression diffing.
 */
import type { LayoutPhase, PhaseSlotConfig } from './phase.js';
import type { LGraph } from '../lgraph.js';
import { ProcessorSlot } from '../processor.js';
import { CoreOptions } from '../../options/core-options.js';
import { IntermediateProcessor } from '../intermediate/registry.js';

export const SimpleNodePlacer: LayoutPhase = {
  id: 'SIMPLE_NODE_PLACER',

  process(graph: LGraph): void {
    const spacing = graph.getProperty(CoreOptions.SPACING_NODE_NODE) ?? 20;
    let maxHeight = 0;
    for (const layer of graph.layers) {
      let y = 0;
      for (let i = 0; i < layer.nodes.length; i++) {
        const n = layer.nodes[i];
        n.position.y = y + n.margin.top;
        y += n.margin.top + n.size.y + n.margin.bottom;
        if (i + 1 < layer.nodes.length) y += spacing;
      }
      layer.size.y = y;
      if (y > maxHeight) maxHeight = y;
    }
    graph.size.y = maxHeight;
  },

  getProcessorConfiguration(_graph: LGraph): PhaseSlotConfig {
    return {
      [ProcessorSlot.BEFORE_P4]: [
        IntermediateProcessor.INNERMOST_NODE_MARGIN_CALCULATOR,
        IntermediateProcessor.LABEL_AND_NODE_SIZE_PROCESSOR,
        IntermediateProcessor.LAYER_SIZE_AND_GRAPH_HEIGHT_CALCULATOR,
      ],
    };
  },
};
