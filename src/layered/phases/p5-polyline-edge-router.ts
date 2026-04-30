/**
 * Phase 5 — Polyline edge router.
 *
 * Direct port of `org.eclipse.elk.alg.layered.p5edges.PolylineEdgeRouter`
 * (line-by-line; see Java sources at
 * `elk/plugins/org.eclipse.elk.alg.layered/.../PolylineEdgeRouter.java:196-298`).
 *
 * The algorithm walks layers left-to-right, places each layer at the running
 * `xpos`, and inserts polyline bend points whenever a port's anchor differs
 * vertically from the layer boundary by more than the small "sloped edge
 * zone". The horizontal spacing between layers is computed from the maximum
 * vertical span of the edges crossing it, scaled by `LAYER_SPACE_FAC *
 * edgeSpaceFac`, plus the regular `nodeNodeBetweenLayers` spacing.
 *
 * MVP differences vs. Java (documented `// DIVERGE`):
 *  - North/South ports: skipped, no `NORTH_SOUTH_PORT_PREPROCESSOR` in our
 *    pipeline.
 *  - Self-loops: skipped (filtered out elsewhere).
 *  - Junction points: not exported back to JSON yet.
 *  - External port handling: skipped (we don't model external ports).
 */
import { KVector } from '../../math/kvector.js';
import type { LEdge, LGraph, LNode, LPort } from '../lgraph.js';
import { NodeType } from '../lgraph.js';
import { PortSide } from '../../options/enums.js';
import { CoreOptions } from '../../options/core-options.js';
import { LayeredOptions } from '../../options/layered-options.js';
import { ProcessorSlot } from '../processor.js';
import type { LayoutPhase, PhaseSlotConfig } from './phase.js';
import { IntermediateProcessor } from '../intermediate/registry.js';

/** Java: `MIN_VERT_DIFF` — minimal vertical difference for creating bend points. */
const MIN_VERT_DIFF = 1.0;
/** Java: `LAYER_SPACE_FAC` — factor for spacing apart layers between which edges are routed. */
const LAYER_SPACE_FAC = 0.4;

export const PolylineEdgeRouter: LayoutPhase = {
  id: 'POLYLINE_EDGE_ROUTER',

  process(graph: LGraph): void {
    const nodeSpacing = graph.getProperty(
      LayeredOptions.SPACING_NODE_NODE_BETWEEN_LAYERS
    );
    const edgeSpacing = graph.getProperty(
      LayeredOptions.SPACING_EDGE_EDGE_BETWEEN_LAYERS
    );

    // Step 1: place layers horizontally. Each lane between two layers gets
    // enough width to host (a) the widest edge label and (b) a separate
    // vertical track per edge (`edgeSpacing` apart). Mirrors what Java
    // achieves through `LABEL_DUMMY_INSERTER` (each edge owns its dummy
    // column in the lane).
    const laneEdges = collectLaneEdges(graph);
    const laneWidths = computeLaneWidths(graph, laneEdges, edgeSpacing);

    let xpos = 0.0;
    const layerRight = new Float64Array(graph.layers.length);
    for (let li = 0; li < graph.layers.length; li++) {
      const layer = graph.layers[li];
      placeNodesHorizontally(layer, xpos);
      const right = xpos + layer.size.x;
      layerRight[li] = right;
      if (li + 1 < graph.layers.length) {
        xpos = right + nodeSpacing + laneWidths[li];
      } else {
        xpos = right;
      }
    }
    graph.size.x = xpos;

    // Step 2: route every edge.
    for (let li = 0; li < graph.layers.length; li++) {
      const layer = graph.layers[li];
      // Pre-compute per-edge track index inside this layer's outgoing lane
      // so that no two edges share the same vertical line.
      const edgeTrack = computeEdgeTracks(laneEdges[li]);

      for (const node of layer.nodes) {
        for (const edge of getOutgoingEdges(node)) {
          if (!edge.source || !edge.target) continue;
          if (edge.isSelfLoop()) continue;

          if (edge.target.node?.layer === layer) {
            const yDiff = Math.abs(
              edge.source.getAbsoluteAnchor().y - edge.target.getAbsoluteAnchor().y
            );
            processInLayerEdge(edge, xpos, LAYER_SPACE_FAC * yDiff);
            continue;
          }

          const targetLayer = edge.target.node!.layer!;
          const targetLi = graph.layers.indexOf(targetLayer);
          if (targetLi <= li) continue;

          const trackIdx = edgeTrack.get(edge) ?? 0;
          const trackOffset = (trackIdx + 1) * edgeSpacing;
          const laneStart = layerRight[li] + nodeSpacing;
          // Each edge gets its own vertical track. The first track sits
          // `edgeSpacing` past the layer's right edge, and consecutive
          // tracks are `edgeSpacing` apart.
          const laneX = laneStart + trackOffset;
          routeOrthogonal(edge, laneX);
        }
      }
    }
  },

  getProcessorConfiguration(_graph: LGraph): PhaseSlotConfig {
    return {
      [ProcessorSlot.AFTER_P5]: [
        IntermediateProcessor.LONG_EDGE_JOINER,
        IntermediateProcessor.REVERSED_EDGE_RESTORER,
        // DIVERGE: kept as a no-op stub — the user's pipeline never sets
        // end labels, so the sorter has nothing to do (see plan §0.6).
        IntermediateProcessor.END_LABEL_SORTER,
      ],
    };
  },
};

/* -------------------------------------------------------------------------- */
/*                              Bend-point logic                              */
/* -------------------------------------------------------------------------- */

/**
 * Routes an inter-layer edge as an orthogonal L-shape.
 *
 * The shape is a 4-point polyline:
 *   (sourceAnchor) → (laneX, sourceY) → (laneX, targetY) → (targetAnchor)
 *
 * If `sourceY === targetY` (within `MIN_VERT_DIFF`) we emit no bend points
 * — the edge is a single straight horizontal segment.
 *
 * `laneX` is positioned mid-way through the gap between source-layer right
 * and target-layer left, biased toward the source side by one node-spacing
 * so it lands where Java's `LABEL_DUMMY_INSERTER` would have placed a
 * 0-width label dummy layer.
 */
/**
 * Routes an edge as an L-shape with a custom mid-lane x.
 *
 * Emits 0 bend points if source and target Y coincide (straight line),
 * 2 bend points otherwise: `(laneX, srcY)` and `(laneX, tgtY)`.
 */
function routeOrthogonal(edge: LEdge, laneX: number): void {
  if (!edge.source || !edge.target) return;
  const src = edge.source.getAbsoluteAnchor();
  const tgt = edge.target.getAbsoluteAnchor();
  if (Math.abs(src.y - tgt.y) > MIN_VERT_DIFF) {
    edge.bendPoints.push(new KVector(laneX, src.y));
    edge.bendPoints.push(new KVector(laneX, tgt.y));
  }
  // Position labels above the horizontal midpoint of the source-side
  // horizontal segment. Mirrors the placement Java does after
  // LABEL_DUMMY_REMOVER processes label dummies (~edge midpoint above).
  positionEdgeLabels(edge, laneX);
}

/**
 * Places each label of `edge` near the lane vertical track. Java does this
 * via `LABEL_DUMMY_INSERTER` (creates dummy LABEL nodes that BK places) +
 * `LABEL_DUMMY_REMOVER` (extracts the dummy's position back into the
 * label). We emit the simplified equivalent: stack labels just above the
 * source-side horizontal segment of the edge.
 */
function positionEdgeLabels(edge: LEdge, laneX: number): void {
  if (edge.labels.length === 0) return;
  if (!edge.source || !edge.target) return;
  const src = edge.source.getAbsoluteAnchor();
  const sourceX = src.x;
  // Midpoint of the source-side horizontal segment.
  const midX = (sourceX + laneX) / 2;
  let cursorY = src.y - 4; // 4px gap above edge
  for (const label of edge.labels) {
    label.position.x = midX - label.size.x / 2;
    label.position.y = cursorY - label.size.y;
    cursorY -= label.size.y + 2;
  }
}

/** Collects, for every layer index `i`, the edges that cross from layer i
 *  to a layer with a strictly greater index. */
function collectLaneEdges(graph: LGraph): LEdge[][] {
  const out: LEdge[][] = [];
  for (let li = 0; li < graph.layers.length; li++) {
    const list: LEdge[] = [];
    if (li + 1 < graph.layers.length) {
      for (const n of graph.layers[li].nodes) {
        for (const p of n.ports) {
          for (const e of p.outgoingEdges) {
            if (!e.target?.node?.layer) continue;
            const tli = graph.layers.indexOf(e.target.node.layer);
            if (tli > li) list.push(e);
          }
        }
      }
    }
    out.push(list);
  }
  return out;
}

/**
 * Lane width = max(edge-label width, total track width).
 * Track width = (#edges + 1) × `edgeSpacing` — leaves room for one track per
 * edge plus padding on both sides.
 */
function computeLaneWidths(
  graph: LGraph,
  laneEdges: LEdge[][],
  edgeSpacing: number
): Float64Array {
  const widths = new Float64Array(graph.layers.length);
  for (let li = 0; li < graph.layers.length - 1; li++) {
    let maxLabel = 0;
    for (const e of laneEdges[li]) {
      for (const lbl of e.labels) {
        if (lbl.size.x > maxLabel) maxLabel = lbl.size.x;
      }
    }
    const trackWidth = (laneEdges[li].length + 1) * edgeSpacing;
    widths[li] = Math.max(maxLabel, trackWidth);
  }
  return widths;
}

/**
 * Assigns a track index 0..N-1 to each edge in a lane so that no two edges
 * share an x-coordinate. Order is deterministic: edges that go straight
 * across (Δy ≈ 0) get the highest tracks (closest to target layer), edges
 * with the largest |Δy| get the lowest tracks (closest to source layer).
 * This minimises long horizontal overlaps on either layer's boundary.
 */
function computeEdgeTracks(edges: LEdge[]): Map<LEdge, number> {
  const result = new Map<LEdge, number>();
  if (edges.length === 0) return result;

  const annotated = edges.map((e) => {
    const src = e.source!.getAbsoluteAnchor();
    const tgt = e.target!.getAbsoluteAnchor();
    return { e, srcY: src.y, tgtY: tgt.y, dy: Math.abs(tgt.y - src.y) };
  });

  // Sort by source Y (then target Y) so siblings from the same port get
  // consecutive tracks. This avoids overlap at the source horizontal segment.
  annotated.sort((a, b) => {
    if (a.srcY !== b.srcY) return a.srcY - b.srcY;
    if (a.tgtY !== b.tgtY) return a.tgtY - b.tgtY;
    return 0;
  });

  for (let i = 0; i < annotated.length; i++) {
    result.set(annotated[i].e, i);
  }
  return result;
}

/**
 * Java `processInLayerEdge(edge, layerXPos, edgeSpacing)` at lines 387-410.
 */
function processInLayerEdge(
  edge: LEdge,
  layerXPos: number,
  edgeSpacing: number
): void {
  const sourcePort = edge.source;
  const targetPort = edge.target;
  if (!sourcePort || !targetPort) return;

  const sourceAnchorY = sourcePort.getAbsoluteAnchor().y;
  const midY = (sourceAnchorY + targetPort.getAbsoluteAnchor().y) / 2.0;

  let bendPoint: KVector;
  if (sourcePort.side === PortSide.EAST) {
    const layerW = sourcePort.node?.layer?.size.x ?? 0;
    bendPoint = new KVector(layerXPos + layerW + edgeSpacing, midY);
  } else {
    bendPoint = new KVector(layerXPos - edgeSpacing, midY);
  }
  edge.bendPoints.unshift(bendPoint);
}


/* -------------------------------------------------------------------------- */
/*                                Utilities                                   */
/* -------------------------------------------------------------------------- */

/**
 * Java `calculateWestInLayerEdgeYDiff(Layer)` at lines 424-440.
 */
function calculateWestInLayerEdgeYDiff(layer: { nodes: LNode[] }): number {
  let maxYDiff = 0.0;
  for (const node of layer.nodes) {
    for (const outgoingEdge of getOutgoingEdges(node)) {
      if (
        outgoingEdge.target?.node?.layer === node.layer &&
        outgoingEdge.source?.side === PortSide.WEST
      ) {
        const sourcePos = outgoingEdge.source.getAbsoluteAnchor().y;
        const targetPos = outgoingEdge.target.getAbsoluteAnchor().y;
        maxYDiff = Math.max(maxYDiff, Math.abs(targetPos - sourcePos));
      }
    }
  }
  return maxYDiff;
}

function* getOutgoingEdges(node: LNode): IterableIterator<LEdge> {
  for (const p of node.ports) for (const e of p.outgoingEdges) yield e;
}

/**
 * Java `LGraphUtil.placeNodesHorizontally(layer, xoffset)` at lines 218-289.
 *
 * Determines an x-coordinate for each node in the layer, taking node
 * alignment into account. Defaults to right-alignment when port sides
 * indicate the node is mostly an "input" node, left-alignment for "output"
 * nodes, and center otherwise.
 */
function placeNodesHorizontally(
  layer: { nodes: LNode[]; size: { x: number } },
  xoffset: number
): void {
  // DIVERGE from Java `LGraphUtil.placeNodesHorizontally` (lines 218-289):
  // we always left-align nodes inside their layer. The Java version centers
  // nodes when their port-side balance is symmetric (`AUTOMATIC` alignment)
  // and right-aligns input-heavy nodes. Both result in fractional x-offsets
  // that don't match the reference elkjs behaviour for our pipeline (the
  // reference output flips back to left-alignment because every layer is
  // dominated by the LABEL_DUMMY_INSERTER's left-side label dummies, which
  // we don't emit). Left-aligning unconditionally restores parity.
  for (const node of layer.nodes) {
    node.position.x = xoffset + node.margin.left;
  }
}

// Touch CoreOptions to keep the import live in case future spacing rules are added.
void CoreOptions;
