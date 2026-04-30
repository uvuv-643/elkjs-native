/**
 * Layer-size and graph-height calculator.
 *
 * Direct port of
 * `org.eclipse.elk.alg.layered.intermediate.LayerSizeAndGraphHeightCalculator`
 * (see Java source at lines 41-108).
 *
 * Postconditions (mirrors Java javadoc):
 *  - Layer sizes (`layer.size.x` / `layer.size.y`) are set.
 *  - Graph height (`graph.size.y`) is set.
 *  - Graph offset y is corrected by the lowest node top so the topmost
 *    node ends up at y=0 once the offset is folded in by the
 *    layout-transferrer.
 *
 * Note: this processor must NOT touch `graph.size.x` — the polyline edge
 * router is responsible for the horizontal extent.
 */
import type { LayoutProcessor } from '../processor.js';
import type { LGraph } from '../lgraph.js';

export const LayerSizeAndGraphHeightCalculator: LayoutProcessor = {
  id: 'LAYER_SIZE_AND_GRAPH_HEIGHT_CALCULATOR',
  process(graph: LGraph): void {
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let foundNodes = false;

    for (const layer of graph.layers) {
      const layerSize = layer.size;
      layerSize.x = 0;
      layerSize.y = 0;

      if (layer.nodes.length === 0) continue;
      foundNodes = true;

      // Java line 65-73: layer width = max(node outer width)
      for (const node of layer.nodes) {
        const w = node.size.x + node.margin.left + node.margin.right;
        if (w > layerSize.x) layerSize.x = w;
      }

      // DIVERGE from Java: in the reference pipeline center-edge labels are
      // turned into dummy LABEL nodes by `LABEL_DUMMY_INSERTER`, which
      // naturally inflates each layer's width to the longest label. Our MVP
      // pipeline doesn't run that processor, so we approximate by adding the
      // widest *outgoing* edge label of any node in this layer. This keeps
      // the layout from cramming long labels into a too-narrow lane.
      let maxLabelW = 0;
      for (const node of layer.nodes) {
        for (const port of node.ports) {
          for (const edge of port.outgoingEdges) {
            for (const label of edge.labels) {
              if (label.size.x > maxLabelW) maxLabelW = label.size.x;
            }
          }
        }
      }
      if (maxLabelW > 0) layerSize.x += maxLabelW;

      // Java line 76-89: layer height from first/last node
      const first = layer.nodes[0];
      const last = layer.nodes[layer.nodes.length - 1];
      const top = first.position.y - first.margin.top;
      const bottom = last.position.y + last.size.y + last.margin.bottom;
      layerSize.y = bottom - top;

      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    }

    if (!foundNodes) {
      minY = 0;
      maxY = 0;
    }

    // Java line 104-105
    graph.size.y = maxY - minY;
    graph.offset.y -= minY;
  },
};
