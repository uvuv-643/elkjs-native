/**
 * Enforces minimum node sizes and (very minimally) places node-internal
 * labels.
 *
 * Port of `org.eclipse.elk.alg.layered.intermediate.LabelAndNodeSizeProcessor`,
 * stripped to:
 *   - apply `elk.nodeSize.minimum` as a floor on width/height;
 *   - if the node has a single label whose bbox is bigger than the current
 *     size, grow the node to fit the label;
 *   - centre each label inside the node.
 *
 * Skipped vs. Java: full label-side placement, port-label flow, ratio
 * sizing, label-management. Sufficient for our flat user fixture.
 */
import type { LayoutProcessor } from '../processor.js';
import type { LGraph, LNode } from '../lgraph.js';
import { NodeType } from '../lgraph.js';
import { CoreOptions } from '../../options/core-options.js';

function processNode(node: LNode): void {
  // 1) Grow to label content if any.
  let labelW = 0;
  let labelH = 0;
  for (const lbl of node.labels) {
    if (lbl.size.x > labelW) labelW = lbl.size.x;
    labelH += lbl.size.y;
  }
  if (labelW > node.size.x) node.size.x = labelW;
  if (labelH > node.size.y) node.size.y = labelH;

  // 2) Apply minimum size from options.
  const min = node.getProperty(CoreOptions.NODE_SIZE_MINIMUM);
  if (min) {
    if (min.width > node.size.x) node.size.x = min.width;
    if (min.height > node.size.y) node.size.y = min.height;
  }

  // 3) Centre labels.
  let y = (node.size.y - labelH) / 2;
  for (const lbl of node.labels) {
    lbl.position.x = (node.size.x - lbl.size.x) / 2;
    lbl.position.y = y;
    y += lbl.size.y;
  }
}

export const LabelAndNodeSizeProcessor: LayoutProcessor = {
  id: 'LABEL_AND_NODE_SIZE_PROCESSOR',
  process(graph: LGraph): void {
    for (const layer of graph.layers) {
      for (const node of layer.nodes) {
        if (node.type === NodeType.NORMAL) processNode(node);
      }
    }
  },
};
