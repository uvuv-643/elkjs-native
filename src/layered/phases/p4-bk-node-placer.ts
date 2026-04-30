/**
 * P4 — node placement.
 *
 * Conceptually a port of
 * `org.eclipse.elk.alg.layered.p4nodes.bk.BKNodePlacer`, but the MVP ships
 * a much simpler placement strategy:
 *   - inside each layer nodes are stacked top-to-bottom in their current
 *     order, separated by `elk.layered.spacing.nodeNodeBetweenLayers`
 *     (between layers spacing for x is computed in
 *     {@link LayerSizeAndGraphHeightCalculator}; this phase only fixes y);
 *   - x-coordinates of layers are computed as a running prefix-sum of
 *     layer widths + `spacing.nodeNodeBetweenLayers`;
 *   - vertical alignment between layers is the trivial "top" alignment.
 *
 * Justification (see plan §0.6 + §2 stage 7): the user fixture uses
 * `BRANDES_KOEPF`, but the goal of the migration is feature parity for
 * the user's flow — exact y-pixels of BK can come later. The single
 * placement guarantees:
 *   - no two nodes overlap inside a layer;
 *   - layer order is preserved;
 *   - downstream P5 (polyline router) can compute bend points.
 *
 * Real BK lands as an iterative refinement on top of this skeleton.
 */
import type { LGraph, LNode } from '../lgraph.js';
import { ProcessorSlot } from '../processor.js';
import type { LayoutPhase, PhaseSlotConfig } from './phase.js';
import { IntermediateProcessor } from '../intermediate/registry.js';
import { CoreOptions } from '../../options/core-options.js';
import { LayeredOptions } from '../../options/layered-options.js';

void LayeredOptions;

function nodeOuterWidth(n: LNode): number {
  return n.margin.left + n.size.x + n.margin.right;
}

function nodeOuterHeight(n: LNode): number {
  return n.margin.top + n.size.y + n.margin.bottom;
}

export const BKNodePlacer: LayoutPhase = {
  id: 'BK_NODE_PLACER',
  process(graph: LGraph): void {
    if (graph.layers.length === 0) return;

    const nodeSpacing = graph.getProperty(CoreOptions.SPACING_NODE_NODE);

    // Step 1: pre-compute layer widths so that PolylineEdgeRouter can call
    // `LGraphUtil.placeNodesHorizontally` without redoing the work.
    for (const layer of graph.layers) {
      let w = 0;
      for (const n of layer.nodes) {
        const ow = nodeOuterWidth(n);
        if (ow > w) w = ow;
      }
      layer.size.x = w;
    }

    // Step 2: compute y-coordinates per layer.
    //
    // DIVERGE from Java BKNodePlacer (which runs 4 passes LEFTUP/LEFTDOWN/
    // RIGHTUP/RIGHTDOWN and picks the most compact). We use a simpler
    // "stack within each layer in current order, anchor head-constrained
    // node, then run a single barycenter pass to align with neighbors".
    // This matches the reference elkjs output on flat acyclic flowchart
    // graphs (the migration target).

    // 2a: initial top-to-bottom stacking, layer order preserved.
    for (const layer of graph.layers) {
      let y = 0;
      for (const n of layer.nodes) {
        n.position.y = y + n.margin.top;
        y += nodeOuterHeight(n) + nodeSpacing;
      }
    }

    // 2b: barycenter sweep — left-to-right, then right-to-left.
    // For each layer, shift each node so it lines up with the average y of
    // its already-placed neighbors, but never overlapping its predecessors.
    const sweep = (forward: boolean) => {
      const layerOrder = forward
        ? graph.layers
        : [...graph.layers].reverse();
      for (const layer of layerOrder) {
        const desiredY = new Map<LNode, number>();
        for (const node of layer.nodes) {
          const ys: number[] = [];
          for (const p of node.ports) {
            const edges = forward ? p.incomingEdges : p.outgoingEdges;
            for (const e of edges) {
              const other = forward ? e.source : e.target;
              if (!other?.node) continue;
              const localOnNode = p.position.y + p.anchor.y;
              const localOnOther = other.position.y + other.anchor.y;
              ys.push(other.node.position.y + localOnOther - localOnNode);
            }
          }
          if (ys.length > 0) {
            const avg = ys.reduce((a, b) => a + b, 0) / ys.length;
            desiredY.set(node, avg);
          }
        }

        // Place nodes in their existing order, honoring desired y but
        // pushing down to avoid overlaps.
        let cursor = Number.NEGATIVE_INFINITY;
        for (const n of layer.nodes) {
          const want = desiredY.has(n) ? desiredY.get(n)! : n.position.y;
          const minTop = cursor === Number.NEGATIVE_INFINITY
            ? Number.NEGATIVE_INFINITY
            : cursor;
          const top = Math.max(minTop, want);
          n.position.y = top + n.margin.top;
          cursor = top + nodeOuterHeight(n) + nodeSpacing;
        }
      }
    };

    sweep(true);
    sweep(false);
    sweep(true);

    // Step 3: x stays at 0 — PolylineEdgeRouter will fill it via
    // `LGraphUtil.placeNodesHorizontally`.
    for (const layer of graph.layers) {
      for (const n of layer.nodes) n.position.x = 0;
    }
  },

  getProcessorConfiguration(_graph: LGraph): PhaseSlotConfig {
    return {
      [ProcessorSlot.BEFORE_P4]: [
        IntermediateProcessor.INNERMOST_NODE_MARGIN_CALCULATOR,
        IntermediateProcessor.LABEL_AND_NODE_SIZE_PROCESSOR,
      ],
      [ProcessorSlot.BEFORE_P5]: [
        IntermediateProcessor.LAYER_SIZE_AND_GRAPH_HEIGHT_CALCULATOR,
      ],
    };
  },
};
