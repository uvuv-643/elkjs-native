/**
 * Computes margins around each node so that ports/labels stick out cleanly.
 *
 * Port of `org.eclipse.elk.alg.layered.intermediate.InnermostNodeMarginCalculator`.
 *
 * Minimal MVP: walks all NORMAL nodes and sets margins to the bounding box
 * of all attached ports + port labels relative to the node rectangle.
 * No node-label awareness here (that lives in
 * {@link LabelAndNodeSizeProcessor}). Sufficient for our pipeline since
 * the user fixture has node-internal labels only.
 */
import type { LayoutProcessor } from '../processor.js';
import type { LGraph, LNode } from '../lgraph.js';
import { NodeType } from '../lgraph.js';

function processNode(node: LNode): void {
  const w = node.size.x;
  const h = node.size.y;
  let top = 0;
  let left = 0;
  let bottom = 0;
  let right = 0;
  for (const port of node.ports) {
    const px = port.position.x;
    const py = port.position.y;
    const pw = port.size.x;
    const ph = port.size.y;
    if (px < 0) left = Math.max(left, -px);
    if (py < 0) top = Math.max(top, -py);
    if (px + pw > w) right = Math.max(right, px + pw - w);
    if (py + ph > h) bottom = Math.max(bottom, py + ph - h);
  }
  node.margin.top = top;
  node.margin.left = left;
  node.margin.bottom = bottom;
  node.margin.right = right;
}

export const InnermostNodeMarginCalculator: LayoutProcessor = {
  id: 'INNERMOST_NODE_MARGIN_CALCULATOR',
  process(graph: LGraph): void {
    for (const layer of graph.layers) {
      for (const node of layer.nodes) {
        if (node.type === NodeType.NORMAL) processNode(node);
      }
    }
  },
};
