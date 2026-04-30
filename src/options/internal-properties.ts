/**
 * Internal pipeline-state properties (subset of `InternalProperties.java`).
 *
 * These are not user-facing options; phases write them so other phases can
 * read them. Mirrors `org.eclipse.elk.alg.layered.options.InternalProperties`,
 * but only the entries we actually consume in the MVP.
 */
import { property } from '../properties.js';
import type { LEdge, LPort, LNode } from '../layered/lgraph.js';
import { EdgeConstraint } from './enums.js';

export const InternalProperties = {
  /** True if the edge has been reversed by the cycle breaker (or one of the
   *  layer-constraint-aware reversers). Toggled, not just set. */
  REVERSED: property<boolean>('internal.layered.reversed', false),

  /** Set on the graph when at least one edge was reversed. */
  CYCLIC: property<boolean>('internal.layered.cyclic', false),

  /** Edge-direction constraint a node has acquired from its layer constraint. */
  EDGE_CONSTRAINT: property<EdgeConstraint>(
    'internal.layered.edgeConstraint',
    EdgeConstraint.UNDEFINED
  ),

  /** Saved opposite endpoint of an edge that was hidden away by the
   *  layer-constraint preprocessor (restored by the postprocessor). */
  ORIGINAL_OPPOSITE_PORT: property<LPort | undefined>(
    'internal.layered.originalOppositePort',
    undefined
  ),

  /** Nodes hidden by the layer-constraint preprocessor. */
  HIDDEN_NODES: property<LNode[]>('internal.layered.hiddenNodes', []),

  /** Original element a dummy node was created for (typically an `LEdge`). */
  ORIGIN: property<LEdge | LNode | null>('internal.layered.origin', null),

  /** Source port of the long edge that a `LONG_EDGE` dummy stands in for. */
  LONG_EDGE_SOURCE: property<LPort | null>(
    'internal.layered.longEdgeSource',
    null
  ),

  /** Target port of the long edge that a `LONG_EDGE` dummy stands in for. */
  LONG_EDGE_TARGET: property<LPort | null>(
    'internal.layered.longEdgeTarget',
    null
  ),

  /** Sequential model order of an edge / node taken from input JSON. */
  MODEL_ORDER: property<number>('internal.layered.modelOrder', 0),
} as const;
