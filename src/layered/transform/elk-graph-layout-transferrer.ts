/**
 * Writes computed layout from an `LGraph` back into the original JSON.
 *
 * Mirrors `ElkGraphLayoutTransferrer.applyLayout` from
 * `org.eclipse.elk.alg.layered.graph.transform`.
 *
 * In the EMF/Java world this is a separate step from the JSON exporter
 * because the graph could go ElkGraph (EMF) → JSON. We collapsed those
 * stages, so this is a thin wrapper that:
 *
 * - applies the LGraph's `offset` to every node before delegating to
 *   {@link transferLayout};
 * - resets `offset` after writing so subsequent calls (component combine)
 *   stay idempotent.
 */
import type { ElkNode } from '../../graph/elk-types.js';
import { transferLayout } from '../../graph/json-exporter.js';
import { LGraph } from '../lgraph.js';

/**
 * Applies the graph's pending offset to its nodes, then writes positions
 * into `originalJson`.
 */
export function applyLayout(lgraph: LGraph, originalJson: ElkNode): void {
  // Mirror Java ElkGraphLayoutTransferrer.applyLayout: fold the graph
  // padding into the offset before propagating, so children are shifted
  // away from the (0,0) origin by `padding.{left,top}`.
  lgraph.offset.x += lgraph.padding.left;
  lgraph.offset.y += lgraph.padding.top;
  applyOffset(lgraph);
  // Java additionally grows the root size by the padding values so the
  // exported `width`/`height` cover the padded area (see ElkLayered.resizeGraph
  // and resizeGraphNoReallyIMeanIt at lines 670-765).
  lgraph.size.x += lgraph.padding.left + lgraph.padding.right;
  lgraph.size.y += lgraph.padding.top + lgraph.padding.bottom;
  transferLayout(lgraph, originalJson);
}

/**
 * Adds `lgraph.offset` to every direct child node and resets the offset.
 * Called by the components processor before combining sub-component
 * results into a single graph.
 */
export function applyOffset(lgraph: LGraph): void {
  const ox = lgraph.offset.x;
  const oy = lgraph.offset.y;
  if (ox === 0 && oy === 0) return;

  const shiftEdges = (
    n: {
      ports: {
        outgoingEdges: {
          bendPoints: { x: number; y: number }[];
          labels: { position: { x: number; y: number } }[];
        }[];
      }[];
    }
  ) => {
    for (const p of n.ports) {
      for (const e of p.outgoingEdges) {
        for (const bp of e.bendPoints) {
          bp.x += ox;
          bp.y += oy;
        }
        // Edge labels are absolute too — shift them with the graph.
        for (const lbl of e.labels) {
          lbl.position.x += ox;
          lbl.position.y += oy;
        }
      }
    }
  };

  for (const n of lgraph.layerlessNodes) {
    n.position.x += ox;
    n.position.y += oy;
    shiftEdges(n);
  }
  for (const layer of lgraph.layers) {
    for (const n of layer.nodes) {
      n.position.x += ox;
      n.position.y += oy;
      shiftEdges(n);
    }
  }
  lgraph.offset.x = 0;
  lgraph.offset.y = 0;
}
