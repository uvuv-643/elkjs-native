/**
 * Core option keys (subset). IDs match `org.eclipse.elk.*` from `Core.melk`.
 */
import { property, IProperty } from '../properties.js';
import {
  Direction,
  HierarchyHandling,
  PortSide,
  PortAlignment,
  PortConstraints,
  SizeConstraint,
} from './enums.js';

export const CoreOptions = {
  ALGORITHM: property<string>('elk.algorithm', 'layered'),
  DIRECTION: property<Direction>('elk.direction', Direction.UNDEFINED),
  HIERARCHY_HANDLING: property<HierarchyHandling>(
    'elk.hierarchyHandling',
    HierarchyHandling.INHERIT
  ),
  RANDOM_SEED: property<number>('elk.randomSeed', 1),

  PADDING_TOP: property<number>('elk.padding.top', 12),
  PADDING_LEFT: property<number>('elk.padding.left', 12),
  PADDING_BOTTOM: property<number>('elk.padding.bottom', 12),
  PADDING_RIGHT: property<number>('elk.padding.right', 12),
  /** Stored as a parsed `LPadding` object: `{top, left, bottom, right}`. */
  PADDING: property<{ top: number; left: number; bottom: number; right: number }>(
    'elk.padding',
    { top: 12, left: 12, bottom: 12, right: 12 }
  ),

  SPACING_NODE_NODE: property<number>('elk.spacing.nodeNode', 20),
  SPACING_EDGE_NODE: property<number>('elk.spacing.edgeNode', 10),
  SPACING_EDGE_EDGE: property<number>('elk.spacing.edgeEdge', 10),
  SPACING_PORT_PORT: property<number>('elk.spacing.portPort', 10),
  SPACING_LABEL_NODE: property<number>('elk.spacing.labelNode', 5),

  // Node sizing
  NODE_SIZE_CONSTRAINTS: property<SizeConstraint[]>('elk.nodeSize.constraints', []),
  NODE_SIZE_MINIMUM: property<{ width: number; height: number }>(
    'elk.nodeSize.minimum',
    { width: 0, height: 0 }
  ),

  // Ports
  PORT_SIDE: property<PortSide>('elk.port.side', PortSide.UNDEFINED),
  PORT_INDEX: property<number | undefined>('elk.port.index', undefined),
  PORT_BORDER_OFFSET: property<number>('elk.port.borderOffset', 0),
  /** Anchor stored as `{x,y}` (parsed from `"x,y"` string). */
  PORT_ANCHOR: property<{ x: number; y: number } | undefined>(
    'elk.port.anchor',
    undefined
  ),
  PORT_ALIGNMENT_DEFAULT: property<PortAlignment>(
    'elk.portAlignment.default',
    PortAlignment.JUSTIFIED
  ),
  PORT_CONSTRAINTS: property<PortConstraints>(
    'elk.portConstraints',
    PortConstraints.UNDEFINED
  ),

  // Edges
  EDGE_THICKNESS: property<number>('elk.edge.thickness', 1),
} as const;

/** Public alias used elsewhere. */
export type AnyOption = IProperty<unknown>;
