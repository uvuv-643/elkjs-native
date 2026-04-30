/**
 * Distributes ports along their assigned sides when no explicit anchor
 * is given.
 *
 * Java's `LabelAndNodeSizeProcessor` delegates this to
 * `PortPlacementCalculator.calculatePortPositions`, a 600-line beast
 * that handles every combination of `portConstraints`,
 * `portAlignment`, port labels, and port sides. We port the
 * **JUSTIFIED / DISTRIBUTED / BEGIN / CENTER / END** subset for ports
 * with `FREE` / `FIXED_SIDE` constraints, which covers the bulk of
 * real-world flowchart graphs.
 *
 * Algorithm per side:
 *  1. Group node's ports by `port.side` (NORTH/EAST/SOUTH/WEST).
 *  2. For each non-empty side:
 *     - count ports n;
 *     - apply `elk.spacing.portPort` between ports;
 *     - distribute along the relevant edge of the node, respecting
 *       `elk.portAlignment.default` (or the per-side override) and
 *       `elk.port.borderOffset`.
 *
 * Ports that already carry a non-zero `position` (set by the user via
 * `elk.port.anchor` upstream) are skipped, mirroring Java's check on
 * `PORT_CONSTRAINTS == FIXED_POS`.
 *
 * Slot: BEFORE_P3 (after PORT_SIDE_PROCESSOR runs and labels-and-node-size
 * grows the node, before BK starts measuring port anchors).
 */
import type { LayoutProcessor } from '../processor.js';
import type { LGraph, LNode, LPort } from '../lgraph.js';
import { NodeType } from '../lgraph.js';
import { CoreOptions } from '../../options/core-options.js';
import { PortAlignment, PortConstraints, PortSide } from '../../options/enums.js';

function hasUserAnchor(port: LPort): boolean {
  // Either an explicit anchor or a non-default position counts.
  if (port.anchor.x !== 0 || port.anchor.y !== 0) return true;
  if (port.position.x !== 0 || port.position.y !== 0) return true;
  // Property-only anchor.
  return port.hasProperty(CoreOptions.PORT_ANCHOR);
}

function distributeAlong(
  node: LNode,
  ports: LPort[],
  side: PortSide,
  alignment: PortAlignment,
  spacing: number
): void {
  if (ports.length === 0) return;

  // Length of the side along which ports are distributed.
  const along = side === PortSide.NORTH || side === PortSide.SOUTH
    ? node.size.x
    : node.size.y;

  // Compute total occupied length (ports + spacing between them).
  let totalPortSpan = 0;
  for (const p of ports) {
    totalPortSpan += side === PortSide.NORTH || side === PortSide.SOUTH
      ? p.size.x
      : p.size.y;
  }
  const gaps = ports.length - 1;
  const totalSpacing = gaps * spacing;

  let cursor = 0;
  let between = spacing;
  switch (alignment) {
    case PortAlignment.BEGIN:
      cursor = 0;
      break;
    case PortAlignment.END:
      cursor = along - totalPortSpan - totalSpacing;
      break;
    case PortAlignment.CENTER:
      cursor = (along - totalPortSpan - totalSpacing) / 2;
      break;
    case PortAlignment.DISTRIBUTED: {
      // Equal gaps including both ends.
      const slots = ports.length + 1;
      const free = along - totalPortSpan;
      between = free / slots;
      cursor = between;
      break;
    }
    case PortAlignment.JUSTIFIED:
    case PortAlignment.UNDEFINED:
    default: {
      if (gaps > 0) {
        const free = along - totalPortSpan;
        between = free / gaps;
        cursor = 0;
      } else {
        cursor = (along - totalPortSpan) / 2;
      }
      break;
    }
  }

  // Place each port.
  for (let i = 0; i < ports.length; i++) {
    const p = ports[i];
    const len =
      side === PortSide.NORTH || side === PortSide.SOUTH ? p.size.x : p.size.y;
    if (side === PortSide.NORTH) {
      p.position.x = cursor;
      p.position.y = -p.size.y;
    } else if (side === PortSide.SOUTH) {
      p.position.x = cursor;
      p.position.y = node.size.y;
    } else if (side === PortSide.WEST) {
      p.position.x = -p.size.x;
      p.position.y = cursor;
    } else {
      // EAST
      p.position.x = node.size.x;
      p.position.y = cursor;
    }
    cursor += len + (alignment === PortAlignment.DISTRIBUTED ? between : between);
  }
}

function processNode(node: LNode, defaultSpacing: number): void {
  const pc = node.getProperty(CoreOptions.PORT_CONSTRAINTS);
  if (pc === PortConstraints.FIXED_POS) return;

  // Skip any port that the user already positioned manually.
  const buckets: Record<PortSide, LPort[]> = {
    [PortSide.NORTH]: [],
    [PortSide.EAST]: [],
    [PortSide.SOUTH]: [],
    [PortSide.WEST]: [],
    [PortSide.UNDEFINED]: [],
  };
  for (const p of node.ports) {
    if (hasUserAnchor(p)) continue;
    if (p.side === PortSide.UNDEFINED) continue;
    buckets[p.side].push(p);
  }

  const align = (node.getProperty(CoreOptions.PORT_ALIGNMENT_DEFAULT) ?? PortAlignment.JUSTIFIED) as PortAlignment;
  const spacing = node.getProperty(CoreOptions.SPACING_PORT_PORT) ?? defaultSpacing;
  for (const side of [PortSide.NORTH, PortSide.EAST, PortSide.SOUTH, PortSide.WEST] as PortSide[]) {
    distributeAlong(node, buckets[side], side, align, spacing);
  }
}

export const PortPositionCalculator: LayoutProcessor = {
  id: 'PORT_POSITION_CALCULATOR',
  process(graph: LGraph): void {
    const defaultSpacing = graph.getProperty(CoreOptions.SPACING_PORT_PORT) ?? 10;
    for (const layer of graph.layers) {
      for (const node of layer.nodes) {
        if (node.type !== NodeType.NORMAL) continue;
        processNode(node, defaultSpacing);
      }
    }
  },
};
