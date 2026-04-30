/**
 * Restores nodes hidden by `LayerConstraintPreprocessor` and pulls nodes
 * with FIRST/LAST constraints into dedicated leading/trailing layers.
 *
 * Port of `org.eclipse.elk.alg.layered.intermediate.LayerConstraintPostprocessor`.
 *
 * MVP: no label-dummy handling (we don't ship label management); we only
 * handle FIRST / LAST / FIRST_SEPARATE / LAST_SEPARATE.
 */
import type { LayoutProcessor } from '../processor.js';
import { Layer, LGraph, LNode } from '../lgraph.js';
import { LayerConstraint } from '../../options/enums.js';
import { LayeredOptions } from '../../options/layered-options.js';
import { InternalProperties } from '../../options/internal-properties.js';

function constraintOf(n: LNode): LayerConstraint {
  return n.getProperty(LayeredOptions.LAYERING_LAYER_CONSTRAINT);
}

function detachFromLayer(node: LNode): void {
  const layer = node.layer;
  if (!layer) return;
  const idx = layer.nodes.indexOf(node);
  if (idx >= 0) layer.nodes.splice(idx, 1);
}

function moveTo(node: LNode, target: Layer): void {
  detachFromLayer(node);
  node.layer = target;
  target.nodes.push(node);
}

export const LayerConstraintPostprocessor: LayoutProcessor = {
  id: 'LAYER_CONSTRAINT_POSTPROCESSOR',

  process(graph: LGraph): void {
    const layers = graph.layers;

    if (layers.length > 0) {
      const firstLayer = layers[0];
      const lastLayer = layers[layers.length - 1];

      for (const layer of layers.slice()) {
        for (const node of layer.nodes.slice()) {
          const c = constraintOf(node);
          if (c === LayerConstraint.FIRST) moveTo(node, firstLayer);
          else if (c === LayerConstraint.LAST) moveTo(node, lastLayer);
        }
      }

      // Drop any layers that became empty.
      graph.layers = layers.filter((l) => l.nodes.length > 0);
    }

    // Restore *_SEPARATE nodes into fresh leading/trailing layers if needed.
    if (graph.hasProperty(InternalProperties.HIDDEN_NODES)) {
      const hidden = graph.getProperty(InternalProperties.HIDDEN_NODES);
      const firstSep = new Layer(graph);
      const lastSep = new Layer(graph);

      for (const node of hidden) {
        const c = constraintOf(node);
        if (c === LayerConstraint.FIRST_SEPARATE) {
          node.layer = firstSep;
          firstSep.nodes.push(node);
        } else if (c === LayerConstraint.LAST_SEPARATE) {
          node.layer = lastSep;
          lastSep.nodes.push(node);
        }

        // Restore detached edges.
        for (const port of node.ports) {
          for (const edge of [...port.outgoingEdges, ...port.incomingEdges]) {
            if (edge.source && edge.target) continue;
            const opposite = edge.getProperty(InternalProperties.ORIGINAL_OPPOSITE_PORT);
            if (!opposite) continue;
            if (!edge.target) edge.setTarget(opposite);
            else if (!edge.source) edge.setSource(opposite);
          }
        }
      }

      if (firstSep.nodes.length > 0) graph.layers.unshift(firstSep);
      if (lastSep.nodes.length > 0) graph.layers.push(lastSep);
    }
  },
};
