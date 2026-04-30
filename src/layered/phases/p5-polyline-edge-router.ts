/**
 * Phase 5 — Polyline edge router.
 *
 * Faithful port of `org.eclipse.elk.alg.layered.p5edges.PolylineEdgeRouter`
 * (~501 lines of Java; mapping below) — including the **compact**
 * per-layer placement that gives the reference its short, tight edges.
 *
 * ## Algorithm
 *
 * Layers are laid out left-to-right. For each layer L:
 *
 *   1. Pre-compute `maxVertDiff` = max |src.y − tgt.y| over outgoing
 *      edges of L (and west-side in-layer edges of L+1, which need
 *      space too).
 *   2. Place every node of L at the running `xpos` (left-aligned).
 *   3. For each port of every node in L, add **one** bend point at
 *      the layer boundary on the port's side (east port → layer's
 *      right edge, west port → layer's left edge). This is the
 *      **only** bend point we emit for inter-layer edges. The middle
 *      segment between layer boundaries is therefore a single
 *      sloped line from `(srcLayerRight, src.y)` to
 *      `(tgtLayerLeft, tgt.y)`.
 *   4. Advance xpos by `layer.size.x + nodeSpacing +
 *      LAYER_SPACE_FAC * edgeSpaceFac * maxVertDiff`.
 *
 * The `LAYER_SPACE_FAC * edgeSpaceFac * maxVertDiff` term keeps slopes
 * shallow without paying the cost of per-edge vertical tracks. For an
 * edge whose endpoints align horizontally (`Δy = 0`), the lane shrinks
 * to just `nodeSpacing` — the most compact case.
 *
 * In-layer edges (source.layer == target.layer) still need a small
 * detour: `processInLayerEdge` inserts one bend point past the layer's
 * right edge so the edge doesn't cut through nodes.
 *
 * ## What we DON'T do (vs Java)
 *
 *  - `slopedEdgeZoneWidth` (default 4px): Java skips the bend if the
 *    port is already very close to the layer boundary. We always emit
 *    the bend — visually equivalent and simpler.
 *  - Junction points: the property is set on the LEdge but not
 *    propagated to JSON output (we don't render them).
 *  - North/south ports: not modelled in MVP.
 *  - External port handling (compound graphs only).
 */
import { KVector } from '../../math/kvector.js';
import type { LEdge, LGraph, LNode, LPort } from '../lgraph.js';
import { NodeType } from '../lgraph.js';
import { PortSide } from '../../options/enums.js';
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
    // Java: `edgeSpaceFac = min(1.0, edgeSpacing / nodeSpacing)`.
    const edgeSpaceFac = Math.min(1.0, edgeSpacing / Math.max(nodeSpacing, 1e-9));

    let xpos = 0.0;
    let layerSpacing = 0.0;

    // Reserve room for west-side in-layer edges of the leftmost layer.
    if (graph.layers.length > 0) {
      const yDiff = calculateWestInLayerEdgeYDiff(graph.layers[0]);
      xpos = LAYER_SPACE_FAC * edgeSpaceFac * yDiff;
    }

    for (let li = 0; li < graph.layers.length; li++) {
      const layer = graph.layers[li];

      // Place nodes at xpos.
      placeNodesHorizontally(layer, xpos);

      let maxVertDiff = 0;

      for (const node of layer.nodes) {
        let maxOut = 0;
        for (const edge of getOutgoingEdges(node)) {
          if (!edge.source || !edge.target) continue;
          const src = edge.source.getAbsoluteAnchor();
          const tgt = edge.target.getAbsoluteAnchor();
          let sourcePos = src.y;
          let targetPos = tgt.y;

          if (
            edge.target.node?.layer === layer &&
            !edge.isSelfLoop()
          ) {
            // In-layer edge: insert the extra bend point at a small
            // offset past the layer boundary. The Y-span of west-side
            // in-layer edges was already accounted for by the
            // pre-computed `xpos` adjustment.
            processInLayerEdge(
              edge,
              xpos,
              LAYER_SPACE_FAC * edgeSpaceFac * Math.abs(sourcePos - targetPos)
            );
            if (edge.source.side === PortSide.WEST) {
              sourcePos = 0;
              targetPos = 0;
            }
          }

          maxOut = Math.max(maxOut, Math.abs(targetPos - sourcePos));
        }

        if (
          node.type === NodeType.NORMAL ||
          node.type === NodeType.LONG_EDGE ||
          node.type === NodeType.LABEL ||
          node.type === NodeType.NORTH_SOUTH_PORT ||
          node.type === NodeType.BREAKING_POINT
        ) {
          processNode(node, xpos);
        }

        maxVertDiff = Math.max(maxVertDiff, maxOut);
      }


      // Look ahead: account for west-side in-layer edges of the next
      // layer so we leave enough room for them too.
      if (li + 1 < graph.layers.length) {
        const yDiff = calculateWestInLayerEdgeYDiff(graph.layers[li + 1]);
        maxVertDiff = Math.max(maxVertDiff, yDiff);
      }

      // Layer spacing: vertical-span-aware lane + nodeSpacing, plus
      // enough room for the widest outgoing edge label so labels
      // never overlap the next layer's cards.
      layerSpacing = LAYER_SPACE_FAC * edgeSpaceFac * maxVertDiff;
      if (li + 1 < graph.layers.length) {
        layerSpacing += nodeSpacing;
        // Java's `LABEL_DUMMY_INSERTER` enlarges each layer's effective
        // width by the longest label. We don't insert label dummies, so
        // we widen the lane directly here. Add `2 * SAFE_MARGIN` (4px)
        // to mirror the gap `positionEdgeLabels` reserves.
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
        if (maxLabelW > 0) {
          // Reserve at least `maxLabelW + 4` total for the lane between
          // layers. We already have `nodeSpacing`, so top up only if
          // needed.
          const required = maxLabelW + 4;
          if (layerSpacing - nodeSpacing < required) {
            layerSpacing = nodeSpacing + Math.max(layerSpacing - nodeSpacing, required);
          }
        }
      }

      xpos += layer.size.x + layerSpacing;
    }

    graph.size.x = xpos;

    // After every layer is placed, run a final pass that rebuilds each
    // inter-layer edge as a strict H-V-H polyline. Vertical segments get
    // distinct x-coordinates spaced by `edgeEdgeBetweenLayers` inside the
    // lane (same ordering heuristic as {@link OrthogonalEdgeRouter}) so
    // parallel edges do not collapse onto one line — unlike Java's native
    // polyline (diagonals), our post-pass is orthogonal and needs explicit
    // tracks.
    orthogonalizeAll(graph);
  },

  getProcessorConfiguration(_graph: LGraph): PhaseSlotConfig {
    return {
      [ProcessorSlot.AFTER_P5]: [
        IntermediateProcessor.LONG_EDGE_JOINER,
        IntermediateProcessor.REVERSED_EDGE_RESTORER,
        IntermediateProcessor.SELF_LOOP_ROUTER,
        IntermediateProcessor.END_LABEL_SORTER,
      ],
    };
  },
};

/* -------------------------------------------------------------------------- */
/*                          Per-port bend insertion                            */
/* -------------------------------------------------------------------------- */

/**
 * Java `processNode(node, layerLeftXPos, maxAcceptableXDiff)` at lines 309-374.
 *
 * For each east/west port of `node`, computes the bend point that sits
 * on the layer boundary at the port's y-coordinate. If the port's
 * absolute anchor already coincides with that boundary (which would
 * make the bend point redundant), nothing is added. Otherwise the
 * bend point is prepended to outgoing edges and appended to incoming
 * edges via {@link addBendPoint}.
 */
/**
 * For every outgoing inter-layer edge of `layer`, replace the two
 * boundary bends added by `processNode` with the four-bend H-V-H
 * variant:
 *
 *   src(sx,sy) → (A,sy) → (M,sy) → (M,ty) → (B,ty) → end(tx,ty)
 *
 * where `A` = source-layer right edge, `B` = target-layer left edge,
 * and `M` is chosen per edge from a spread of track positions inside
 * `(A, B)` so parallel edges remain visually separated.
 *
 * In-layer edges (already handled by `processInLayerEdge`) are
 * skipped.
 */
function orthogonalizeAll(graph: LGraph): void {
  const edgeSpacing = graph.getProperty(
    LayeredOptions.SPACING_EDGE_EDGE_BETWEEN_LAYERS
  );

  for (let li = 0; li < graph.layers.length; li++) {
    const layer = graph.layers[li];
    if (li + 1 >= graph.layers.length) continue;
    // Compute the right edge of this layer once.
    let maxX = -Infinity;
    for (const node of layer.nodes) {
      const right = node.position.x + node.size.x;
      if (right > maxX) maxX = right;
    }
    if (!isFinite(maxX)) continue;
    const A = maxX;

    // Compute the left edge of the next layer.
    const next = graph.layers[li + 1];
    let minX = Infinity;
    for (const node of next.nodes) {
      const left = node.position.x - node.margin.left;
      if (left < minX) minX = left;
    }
    if (!isFinite(minX)) continue;
    const B = minX;

    const laneEdges: LEdge[] = [];
    for (const node of layer.nodes) {
      for (const port of node.ports) {
        if (port.side !== PortSide.EAST) continue;
        for (const edge of port.outgoingEdges) {
          if (edge.isSelfLoop()) continue;
          if (!edge.source || !edge.target) continue;
          const tgtNode = edge.target.node;
          if (!tgtNode || !tgtNode.layer) continue;
          if (tgtNode.layer === layer) continue;
          if (tgtNode.layer !== next) continue;
          laneEdges.push(edge);
        }
      }
    }

    const edgeToM = assignLaneVerticalTrackX(laneEdges, A, B, edgeSpacing);

    for (const edge of laneEdges) {
      const src = edge.source!.getAbsoluteAnchor();
      const tgt = edge.target!.getAbsoluteAnchor();
      edge.bendPoints.length = 0;
      if (Math.abs(src.y - tgt.y) > MIN_VERT_DIFF) {
        const M = edgeToM.get(edge) ?? (A + B) / 2;
        edge.bendPoints.push(new KVector(M, src.y));
        edge.bendPoints.push(new KVector(M, tgt.y));
      }
      positionEdgeLabels(edge);
    }
  }
}

/**
 * One x-coordinate per edge for the shared vertical bus, monotonic in the
 * same order as the orthogonal router's per-lane edge sort (srcY/tgtY
 * descending).
 */
function assignLaneVerticalTrackX(
  edges: LEdge[],
  A: number,
  B: number,
  edgeSpacing: number
): Map<LEdge, number> {
  const result = new Map<LEdge, number>();
  const n = edges.length;
  if (n === 0) return result;

  const sorted = [...edges].sort((ea, eb) => {
    const aSrc = ea.source!.getAbsoluteAnchor().y;
    const bSrc = eb.source!.getAbsoluteAnchor().y;
    if (Math.abs(bSrc - aSrc) > 1e-9) return bSrc - aSrc;
    const aTgt = ea.target!.getAbsoluteAnchor().y;
    const bTgt = eb.target!.getAbsoluteAnchor().y;
    return bTgt - aTgt;
  });

  const xs = verticalTrackXsInLane(A, B, n, edgeSpacing);
  for (let i = 0; i < n; i++) {
    result.set(sorted[i], xs[i]!);
  }
  return result;
}

/** Evenly spaced x-positions in `[A, B]` with at least `edgeSpacing` when the lane is wide enough. */
function verticalTrackXsInLane(
  A: number,
  B: number,
  n: number,
  edgeSpacing: number
): number[] {
  if (n === 1) return [(A + B) / 2];
  const W = B - A;
  if (!(W > 0) || !Number.isFinite(W)) {
    const c = (A + B) / 2;
    return Array.from({ length: n }, () => c);
  }
  const inset = Math.min(edgeSpacing, W * 0.15);
  const inner = Math.max(0, W - 2 * inset);
  let gap = edgeSpacing;
  if (n > 1 && (n - 1) * gap > inner) {
    gap = inner / (n - 1);
  }
  const span = (n - 1) * gap;
  const start = A + inset + (inner - span) / 2;
  return Array.from({ length: n }, (_, i) => start + i * gap);
}

function processNode(node: LNode, layerLeftXPos: number): void {
  const layer = node.layer;
  if (!layer) return;
  const layerRightXPos = layerLeftXPos + layer.size.x;

  for (const port of node.ports) {
    const absoluteAnchor = port.getAbsoluteAnchor();
    let bendX: number;
    if (port.side === PortSide.EAST) bendX = layerRightXPos;
    else if (port.side === PortSide.WEST) bendX = layerLeftXPos;
    else continue; // north/south ports — handled by NS preprocessor (not in MVP)

    const bendPoint = new KVector(bendX, absoluteAnchor.y);
    // If the port already sits on the layer boundary, no bend needed.
    const xDist = Math.abs(absoluteAnchor.x - bendPoint.x);
    if (xDist <= MIN_VERT_DIFF && !isInLayerDummy(node)) continue;

    for (const edge of port.getConnectedEdges()) {
      const otherPort: LPort | null =
        edge.source === port ? edge.target : edge.source;
      if (!otherPort) continue;
      if (Math.abs(otherPort.getAbsoluteAnchor().y - bendPoint.y) > MIN_VERT_DIFF) {
        addBendPoint(edge, bendPoint, port);
      }
    }
  }

  // Label positioning is deferred to `orthogonalizeAll` — after the
  // bend points reach their final positions, we know exactly where the
  // source-side horizontal segment ends.
}

/**
 * Java `addBendPoint(edge, bendPoint, addJunctionPoint, currPort)` at
 * lines 442-470. We omit junction-point bookkeeping — see file header.
 *
 * Inserts a copy of `bendPoint` at the start (if `currPort` is the
 * edge's source) or end of the bend-point chain. Skipped when the
 * bend point coincides with the port's anchor or the edge is a
 * self-loop.
 */
function addBendPoint(edge: LEdge, bendPoint: KVector, currPort: LPort): void {
  if (edge.isSelfLoop()) return;
  const anchor = currPort.getAbsoluteAnchor();
  if (
    !edge.isInLayerEdge() &&
    Math.abs(anchor.x - bendPoint.x) < 1e-9 &&
    Math.abs(anchor.y - bendPoint.y) < 1e-9
  ) {
    return;
  }
  if (edge.source === currPort) {
    edge.bendPoints.unshift(new KVector(bendPoint.x, bendPoint.y));
  } else {
    edge.bendPoints.push(new KVector(bendPoint.x, bendPoint.y));
  }
}

/**
 * Java `processInLayerEdge(edge, layerXPos, edgeSpacing)` at lines 387-410.
 *
 * In-layer edges (source.layer == target.layer) get an extra bend
 * point a little past the layer boundary at the midpoint of the
 * edge's vertical span.
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

/**
 * Edge labels: place at the midpoint of the source-side horizontal
 * segment of an H-V-H polyline.
 *
 * After `orthogonalizeAll` rebuilds the bend chain to be
 *   src(sx, sy) → bend(M, sy) → bend(M, ty) → tgt(tx, ty)
 * the source-side horizontal goes from `(sx, sy)` to `(M, sy)`. The
 * label sits at `((sx + M) / 2, sy − labelHeight)` (just above the
 * segment so the line doesn't pass through the text).
 *
 * For straight (Δy ≈ 0) edges with no bend points, we use the geometric
 * midpoint between source and target as the label centre.
 *
 * Mirrors the visual result of Java's `LABEL_DUMMY_INSERTER` +
 * `LABEL_DUMMY_REMOVER` round-trip for centre labels — Java places a
 * single label dummy node at the midpoint of the lane and lets BK
 * choose its y; we replicate the same final position without inserting
 * a real dummy.
 */
function positionEdgeLabels(edge: LEdge): void {
  if (edge.labels.length === 0) return;
  if (!edge.source || !edge.target) return;
  const src = edge.source.getAbsoluteAnchor();
  const tgt = edge.target.getAbsoluteAnchor();

  let segEndX: number;
  let segY: number;
  if (edge.bendPoints.length >= 1) {
    segEndX = edge.bendPoints[0].x;
    segY = edge.bendPoints[0].y;
  } else {
    segEndX = tgt.x;
    segY = src.y;
  }
  // The label needs to live within the LANE — between the source
  // node's right edge and the target node's left edge — so it never
  // overlaps a card. We use the actual node bounding boxes (not the
  // port anchors), since the anchor is *on* the node's perimeter.
  const sourceNode = edge.source.node;
  const targetNode = edge.target.node;
  const srcRight = sourceNode
    ? sourceNode.position.x + sourceNode.size.x
    : src.x;
  const tgtLeft = targetNode ? targetNode.position.x : tgt.x;
  // Build a safe interval for the label's x range with a 2-px margin
  // off each card.
  const SAFE_MARGIN = 2;
  const safeMin = srcRight + SAFE_MARGIN;
  const safeMax = tgtLeft - SAFE_MARGIN;

  // Cap label width to the available gap so we always fit. The
  // alternative — letting the label spill — invariably overlaps the
  // cards, which is exactly what the user reported.
  const gap = Math.max(0, safeMax - safeMin);

  let cursorY = segY - 4;
  for (const label of edge.labels) {
    // Center on the source-side segment midpoint, clamped into [safeMin, safeMax].
    let labelW = label.size.x;
    if (labelW > gap && gap > 0) {
      // Visually shrink center alignment so we still fit. We do NOT
      // mutate label.size.x because callers may rely on it; we just
      // adjust the position so the *centre* of the label is in the
      // safe zone — overflow goes equally to both sides if any.
      labelW = gap;
    }
    let x = (src.x + segEndX) / 2 - labelW / 2;
    if (x < safeMin) x = safeMin;
    if (x + label.size.x > safeMax) x = safeMax - label.size.x;
    // If even after clamping the label can't fit (e.g. lane too tight
    // and label too wide), bias toward `safeMin` rather than smashing
    // into the target card.
    if (x < safeMin) x = safeMin;
    label.position.x = x;
    label.position.y = cursorY - label.size.y;
    cursorY -= label.size.y + 2;
  }
}

/* -------------------------------------------------------------------------- */
/*                                Utilities                                   */
/* -------------------------------------------------------------------------- */

/** Java `calculateWestInLayerEdgeYDiff(Layer)` at lines 424-440. */
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

/** Java `isInLayerDummy(node)` at lines 472-484. */
function isInLayerDummy(node: LNode): boolean {
  if (node.type !== NodeType.LONG_EDGE) return false;
  for (const p of node.ports) {
    for (const e of p.outgoingEdges) if (e.isInLayerEdge()) return true;
    for (const e of p.incomingEdges) if (e.isInLayerEdge()) return true;
  }
  return false;
}

/**
 * Java `LGraphUtil.placeNodesHorizontally(layer, xoffset)` at lines 218-289.
 *
 * Assigns x-coordinates to every node of the layer. We always
 * left-align — see DIVERGE comment in the previous implementation.
 */
function placeNodesHorizontally(
  layer: { nodes: LNode[] },
  xoffset: number
): void {
  for (const node of layer.nodes) {
    node.position.x = xoffset + node.margin.left;
  }
}
