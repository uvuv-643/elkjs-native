/**
 * Phase 5 — Orthogonal edge router (simplified HVH variant).
 *
 * Java ELK ships a full `OrthogonalRoutingGenerator` that builds a
 * conflict graph between vertical track segments and a topological sort
 * over hyperedges. We reuse the bend-point structure of the polyline
 * router (each edge gets its own vertical track within the lane between
 * two layers) but force every segment to be axis-aligned: source-side
 * horizontal, vertical lane segment, target-side horizontal — three
 * straight segments, two bend points.
 *
 * This matches the visual produced by the polyline router for the
 * `Δy ≠ 0` case and degenerates to a single straight segment for
 * `Δy ≈ 0`. The track assignment is shared with
 * {@link PolylineEdgeRouter} via the same per-lane sort-by-srcY-desc
 * heuristic.
 *
 * Trade-offs vs. a full orthogonal router:
 *  - we do not merge parallel edges into a hyperedge;
 *  - we do not compact tracks via a conflict-graph topological sort;
 *  - we don't perform the iterative spread-and-relax for in-layer
 *    edges that share endpoints.
 *
 * For the user's flowchart and small/medium graphs this is visually
 * indistinguishable from Java's output. Larger fan-ins may reveal
 * track-overlap on the same x; that is a known limitation.
 */
import { KVector } from '../../math/kvector.js';
import type { LEdge, LGraph, LNode, LPort } from '../lgraph.js';
import { PortSide } from '../../options/enums.js';
import { LayeredOptions } from '../../options/layered-options.js';
import { CoreOptions } from '../../options/core-options.js';
import { ProcessorSlot } from '../processor.js';
import type { LayoutPhase, PhaseSlotConfig } from './phase.js';
import { IntermediateProcessor } from '../intermediate/registry.js';

const MIN_VERT_DIFF = 1.0;

export const OrthogonalEdgeRouter: LayoutPhase = {
  id: 'ORTHOGONAL_EDGE_ROUTER',

  process(graph: LGraph): void {
    const nodeSpacing = graph.getProperty(
      LayeredOptions.SPACING_NODE_NODE_BETWEEN_LAYERS
    );
    const edgeSpacing = graph.getProperty(
      LayeredOptions.SPACING_EDGE_EDGE_BETWEEN_LAYERS
    );

    // Step 1: collect lane edges + compute lane widths.
    const laneEdges = collectLaneEdges(graph);
    const laneWidths = computeLaneWidths(graph, laneEdges, edgeSpacing);

    // Step 2: place nodes left-aligned and accumulate xpos.
    let xpos = 0.0;
    const layerRight = new Float64Array(graph.layers.length);
    for (let li = 0; li < graph.layers.length; li++) {
      const layer = graph.layers[li];
      for (const node of layer.nodes) {
        node.position.x = xpos + node.margin.left;
      }
      const right = xpos + layer.size.x;
      layerRight[li] = right;
      if (li + 1 < graph.layers.length) {
        xpos = right + nodeSpacing + laneWidths[li];
      } else {
        xpos = right;
      }
    }
    graph.size.x = xpos;

    // Step 3: route every edge with H-V-H (or straight when Δy=0).
    for (let li = 0; li < graph.layers.length; li++) {
      const layer = graph.layers[li];
      const edgeTrack = computeEdgeTracks(laneEdges[li]);

      for (const node of layer.nodes) {
        for (const port of node.ports) {
          for (const edge of port.outgoingEdges) {
            if (!edge.source || !edge.target) continue;
            if (edge.isSelfLoop()) continue;

            const targetLayer = edge.target.node?.layer;
            if (!targetLayer || targetLayer === layer) continue;
            const targetLi = graph.layers.indexOf(targetLayer);
            if (targetLi <= li) continue;

            const trackIdx = edgeTrack.get(edge) ?? 0;
            const trackOffset = (trackIdx + 1) * edgeSpacing;
            const laneStart = layerRight[li] + nodeSpacing;
            const laneX = laneStart + trackOffset;
            routeOrthogonal(edge, laneX);
          }
        }
      }
    }
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

function routeOrthogonal(edge: LEdge, laneX: number): void {
  if (!edge.source || !edge.target) return;
  const src = edge.source.getAbsoluteAnchor();
  const tgt = edge.target.getAbsoluteAnchor();
  if (Math.abs(src.y - tgt.y) > MIN_VERT_DIFF) {
    edge.bendPoints.push(new KVector(laneX, src.y));
    edge.bendPoints.push(new KVector(laneX, tgt.y));
  }
}

function collectLaneEdges(graph: LGraph): LEdge[][] {
  const out: LEdge[][] = [];
  for (let li = 0; li < graph.layers.length; li++) {
    const list: LEdge[] = [];
    if (li + 1 < graph.layers.length) {
      for (const n of graph.layers[li].nodes) {
        for (const p of n.ports) {
          for (const e of p.outgoingEdges) {
            const tli = e.target?.node?.layer
              ? graph.layers.indexOf(e.target.node.layer)
              : -1;
            if (tli > li) list.push(e);
          }
        }
      }
    }
    out.push(list);
  }
  return out;
}

function computeLaneWidths(
  graph: LGraph,
  laneEdges: LEdge[][],
  edgeSpacing: number
): Float64Array {
  const widths = new Float64Array(graph.layers.length);
  for (let li = 0; li + 1 < graph.layers.length; li++) {
    const trackWidth = (laneEdges[li].length + 1) * edgeSpacing;
    widths[li] = trackWidth;
  }
  return widths;
}

function computeEdgeTracks(edges: LEdge[]): Map<LEdge, number> {
  const result = new Map<LEdge, number>();
  if (edges.length === 0) return result;
  const annotated = edges.map((e) => ({
    e,
    srcY: e.source!.getAbsoluteAnchor().y,
    tgtY: e.target!.getAbsoluteAnchor().y,
  }));
  // Same monotonic-fan rule as the polyline router: top edges get outer
  // tracks, bottom edges get inner tracks.
  annotated.sort((a, b) => (b.srcY - a.srcY) || (b.tgtY - a.tgtY));
  for (let i = 0; i < annotated.length; i++) {
    result.set(annotated[i].e, i);
  }
  return result;
}

// Touch unused imports so esbuild keeps them.
void CoreOptions;
void PortSide;
void (null as unknown as LNode);
void (null as unknown as LPort);
