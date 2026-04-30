/**
 * Maps a graph laid out left-to-right (`Direction.RIGHT`, ELK's internal
 * canonical orientation) to/from any of the four cardinal directions.
 *
 * Java ELK ships a `LayoutOptions.DIRECTION` aware path inside
 * `RotatingPlatform`/coordinate handling. We replicate just the part we
 * need: a 2D rotation+mirror that:
 *
 *  - swaps the meaning of port sides on the input,
 *  - swaps the size axes,
 *  - is undone after layout to write back coordinates in user-space.
 *
 * Mapping summary (every cell shows `internal ← external`):
 *
 * | Direction | x-axis | y-axis | port-side mapping       |
 * |-----------|--------|--------|-------------------------|
 * | RIGHT     | x      | y      | identity                |
 * | DOWN      | y      | x      | N→W, E→S, S→E, W→N      |
 * | LEFT      | -x     | y      | N→N, E→W, S→S, W→E      |
 * | UP        | y      | -x     | N→E, E→N, S→W, W→S      |
 *
 * Two passes:
 *   - {@link applyDirectionPreLayout}: input → internal RIGHT.
 *   - {@link applyDirectionPostLayout}: internal RIGHT → original direction.
 *
 * The pre-pass mutates `LNode`, `LPort`, `LLabel` size and side fields.
 * The post-pass mutates positions and bend-points after layout finishes,
 * just before {@link transferLayout} writes back to JSON.
 */
import { Direction, PortSide } from '../../options/enums.js';
import { CoreOptions } from '../../options/core-options.js';
import { LGraph, LNode, LPort } from '../lgraph.js';

const PORT_PRE: Record<Direction, Record<PortSide, PortSide>> = {
  [Direction.RIGHT]: identityPortMap(),
  [Direction.UNDEFINED]: identityPortMap(),
  [Direction.DOWN]: {
    [PortSide.UNDEFINED]: PortSide.UNDEFINED,
    [PortSide.NORTH]: PortSide.WEST,
    [PortSide.EAST]: PortSide.SOUTH,
    [PortSide.SOUTH]: PortSide.EAST,
    [PortSide.WEST]: PortSide.NORTH,
  },
  [Direction.LEFT]: {
    [PortSide.UNDEFINED]: PortSide.UNDEFINED,
    [PortSide.NORTH]: PortSide.NORTH,
    [PortSide.EAST]: PortSide.WEST,
    [PortSide.SOUTH]: PortSide.SOUTH,
    [PortSide.WEST]: PortSide.EAST,
  },
  [Direction.UP]: {
    [PortSide.UNDEFINED]: PortSide.UNDEFINED,
    [PortSide.NORTH]: PortSide.EAST,
    [PortSide.EAST]: PortSide.NORTH,
    [PortSide.SOUTH]: PortSide.WEST,
    [PortSide.WEST]: PortSide.SOUTH,
  },
};

function identityPortMap(): Record<PortSide, PortSide> {
  return {
    [PortSide.UNDEFINED]: PortSide.UNDEFINED,
    [PortSide.NORTH]: PortSide.NORTH,
    [PortSide.EAST]: PortSide.EAST,
    [PortSide.SOUTH]: PortSide.SOUTH,
    [PortSide.WEST]: PortSide.WEST,
  };
}

/**
 * Returns the effective layout direction (UNDEFINED collapses to RIGHT).
 */
export function effectiveDirection(graph: LGraph): Direction {
  const d = graph.getProperty(CoreOptions.DIRECTION);
  return d === Direction.UNDEFINED ? Direction.RIGHT : d;
}

/**
 * Pre-layout: transforms node sizes, port sides, port positions and
 * port anchors so the rest of the pipeline sees a `RIGHT`-flowing graph.
 */
export function applyDirectionPreLayout(graph: LGraph): void {
  const dir = effectiveDirection(graph);
  if (dir === Direction.RIGHT) return;

  for (const node of graph.layerlessNodes) preTransformNode(node, dir);
}

/**
 * Post-layout: undoes the pre-pass on every absolute coordinate
 * (`node.position`, `port.position`, `bendPoints`, label positions,
 * graph size). Run **before** `transferLayout`.
 */
export function applyDirectionPostLayout(graph: LGraph): void {
  const dir = effectiveDirection(graph);
  if (dir === Direction.RIGHT) return;

  // Total bbox to flip around when the direction inverts an axis.
  const W = graph.size.x;
  const H = graph.size.y;

  const allNodes: LNode[] = [];
  for (const n of graph.layerlessNodes) allNodes.push(n);
  for (const layer of graph.layers) for (const n of layer.nodes) allNodes.push(n);

  for (const node of allNodes) postTransformNode(node, dir, W, H);

  // Graph size axes swap for DOWN/UP (vertical flow).
  if (dir === Direction.DOWN || dir === Direction.UP) {
    [graph.size.x, graph.size.y] = [graph.size.y, graph.size.x];
  }
}

function preTransformNode(node: LNode, dir: Direction): void {
  // Rotate node size; node.position is (0,0) before layout so no work there.
  if (dir === Direction.DOWN || dir === Direction.UP) {
    [node.size.x, node.size.y] = [node.size.y, node.size.x];
    [node.margin.left, node.margin.top] = [node.margin.top, node.margin.left];
    [node.margin.right, node.margin.bottom] = [node.margin.bottom, node.margin.right];
  }
  // For LEFT we keep axes but mirror x — applied at post step.

  for (const port of node.ports) preTransformPort(port, node, dir);
}

function preTransformPort(port: LPort, _node: LNode, dir: Direction): void {
  const newSide = PORT_PRE[dir][port.side];
  port.side = newSide;
  // Port position relative to node — flip axes when needed.
  if (dir === Direction.DOWN || dir === Direction.UP) {
    [port.size.x, port.size.y] = [port.size.y, port.size.x];
    [port.position.x, port.position.y] = [port.position.y, port.position.x];
    [port.anchor.x, port.anchor.y] = [port.anchor.y, port.anchor.x];
  }
}

function postTransformNode(node: LNode, dir: Direction, W: number, H: number): void {
  // For each direction, transform absolute (x, y) of the node.
  const newPos = transformPoint(node.position.x, node.position.y, dir, W, H);
  node.position.x = newPos.x;
  node.position.y = newPos.y;
  // Restore size axes back if rotated.
  if (dir === Direction.DOWN || dir === Direction.UP) {
    [node.size.x, node.size.y] = [node.size.y, node.size.x];
    [node.margin.left, node.margin.top] = [node.margin.top, node.margin.left];
    [node.margin.right, node.margin.bottom] = [node.margin.bottom, node.margin.right];
  }
  // Adjust position for size if axis was inverted (rotation pivots around origin).
  if (dir === Direction.LEFT) {
    node.position.x -= node.size.x;
  } else if (dir === Direction.UP) {
    node.position.y -= node.size.y;
  }

  for (const port of node.ports) postTransformPort(port, dir);
  for (const lbl of node.labels) {
    const p = transformPoint(lbl.position.x, lbl.position.y, dir, W, H);
    lbl.position.x = p.x;
    lbl.position.y = p.y;
    if (dir === Direction.DOWN || dir === Direction.UP) {
      [lbl.size.x, lbl.size.y] = [lbl.size.y, lbl.size.x];
    }
  }
  for (const port of node.ports) {
    for (const e of port.outgoingEdges) {
      for (const bp of e.bendPoints) {
        const p = transformPoint(bp.x, bp.y, dir, W, H);
        bp.x = p.x;
        bp.y = p.y;
      }
      for (const lbl of e.labels) {
        const p = transformPoint(lbl.position.x, lbl.position.y, dir, W, H);
        lbl.position.x = p.x;
        lbl.position.y = p.y;
      }
    }
  }
}

function postTransformPort(port: LPort, dir: Direction): void {
  // Port position is relative to node — only rotate axes (no translation).
  if (dir === Direction.DOWN || dir === Direction.UP) {
    [port.size.x, port.size.y] = [port.size.y, port.size.x];
    [port.position.x, port.position.y] = [port.position.y, port.position.x];
    [port.anchor.x, port.anchor.y] = [port.anchor.y, port.anchor.x];
  }
  // For LEFT: x within node frame stays unchanged after rotation step,
  // but the node x has shifted. Port relative position must remain
  // relative — keep as-is; the node-position correction above handles it.
  // Port-side flips back too.
  port.side = inversePortMap(dir, port.side);
}

function inversePortMap(dir: Direction, internal: PortSide): PortSide {
  // Build inverse from PORT_PRE[dir]: find external such that
  // PORT_PRE[dir][external] === internal.
  const fwd = PORT_PRE[dir];
  for (const k of Object.keys(fwd) as PortSide[]) {
    if (fwd[k] === internal) return k;
  }
  return internal;
}

function transformPoint(x: number, y: number, dir: Direction, W: number, H: number): { x: number; y: number } {
  switch (dir) {
    case Direction.DOWN:
      return { x: y, y: x };
    case Direction.UP:
      return { x: y, y: -x + W };
    case Direction.LEFT:
      return { x: -x + W, y };
    default:
      return { x, y };
  }
}
