/**
 * Routes self-loops around their owning node.
 *
 * Java ELK has a sophisticated self-loop subsystem
 * (`SelfLoopPreProcessor`, `SelfLoopPortRestorer`,
 * `SelfLoopRouter` …) that:
 *  - hides self-loop edges before phases 2-4 run, so they don't disturb
 *    layering or node placement;
 *  - re-attaches them after phase 5, computing port-side-aware bend
 *    points along the node's perimeter.
 *
 * For the elkjs-native MVP we use a smaller, deterministic router that
 * matches the **shape** of what Java produces for the common case
 * (single-port self-loop on the EAST/WEST side, polyline routing):
 *
 *  - skip self-loops in earlier phases (already done — `LEdge.isSelfLoop()`
 *    is checked in the cycle-breaker, layerer, BK placer, polyline router);
 *  - here, AFTER P5 + LongEdgeJoiner have run, draw each self-loop with
 *    three bend-points that hug the node's right/left side.
 *
 * Layout for an EAST→EAST self-loop on a node of height `h`, anchor at
 * the right side:
 *
 *   start = source.absolute        ┌────────┐
 *   bp[0] = (right + slack, srcY)  │        │───┐ ← bp[0]
 *   bp[1] = (right + slack, tgtY)  │        │   │
 *   bp[2] = (right, tgtY)          │  node  │───┘ ← bp[1]
 *   end   = target.absolute        └────────┘
 *
 * The slack is `LayeredOptions.SPACING_NODE_SELF_LOOP / 2` (defaults to
 * `nodeNode / 2`). For WEST sides the slack mirrors to the left.
 */
import type { LayoutProcessor } from '../processor.js';
import { KVector } from '../../math/kvector.js';
import type { LEdge, LGraph, LNode } from '../lgraph.js';
import { PortSide } from '../../options/enums.js';
import { CoreOptions } from '../../options/core-options.js';

const DEFAULT_SLACK = 20;

function selfLoopSlack(node: LNode): number {
  const spacing = node.getProperty(CoreOptions.SPACING_NODE_NODE);
  return spacing > 0 ? spacing / 2 : DEFAULT_SLACK;
}

function routeSelfLoop(edge: LEdge): void {
  const src = edge.source;
  const tgt = edge.target;
  if (!src || !tgt) return;
  const node = src.node;
  if (!node || node !== tgt.node) return;

  // Clear any leftover bend points from earlier passes.
  edge.bendPoints.length = 0;

  const sa = src.getAbsoluteAnchor();
  const ta = tgt.getAbsoluteAnchor();
  const slack = selfLoopSlack(node);

  // Pick the side based on the source port's side; ports without a
  // resolved side default to EAST.
  const side = src.side === PortSide.WEST ? PortSide.WEST : PortSide.EAST;
  const baseX =
    side === PortSide.EAST
      ? node.position.x + node.size.x + slack
      : node.position.x - slack;

  // Three bend-points: (baseX, srcY), (baseX, tgtY), (anchor edge, tgtY)
  edge.bendPoints.push(new KVector(baseX, sa.y));
  edge.bendPoints.push(new KVector(baseX, ta.y));
  // Final approach to the target port; horizontal approach matches
  // the perimeter of the node.
  const approachX =
    side === PortSide.EAST
      ? node.position.x + node.size.x
      : node.position.x;
  edge.bendPoints.push(new KVector(approachX, ta.y));
}

export const SelfLoopRouter: LayoutProcessor = {
  id: 'SELF_LOOP_ROUTER',
  process(graph: LGraph): void {
    for (const layer of graph.layers) {
      for (const node of layer.nodes) {
        for (const port of node.ports) {
          for (const edge of port.outgoingEdges) {
            if (edge.isSelfLoop()) routeSelfLoop(edge);
          }
        }
      }
    }
  },
};
