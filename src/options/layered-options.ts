/**
 * Layered-algorithm option keys (subset).
 * IDs match `org.eclipse.elk.layered.*` from `Layered.melk`.
 */
import { property } from '../properties.js';
import {
  CrossingMinimizationStrategy,
  CycleBreakingStrategy,
  EdgeRouting,
  InLayerConstraint,
  LayerConstraint,
  LayeringStrategy,
  NodePlacementStrategy,
  OrderingStrategy,
} from './enums.js';

export const LayeredOptions = {
  // Phases
  CYCLE_BREAKING_STRATEGY: property<CycleBreakingStrategy>(
    'elk.layered.cycleBreaking.strategy',
    CycleBreakingStrategy.GREEDY
  ),
  LAYERING_STRATEGY: property<LayeringStrategy>(
    'elk.layered.layering.strategy',
    LayeringStrategy.NETWORK_SIMPLEX
  ),
  CROSSING_MINIMIZATION_STRATEGY: property<CrossingMinimizationStrategy>(
    'elk.layered.crossingMinimization.strategy',
    CrossingMinimizationStrategy.LAYER_SWEEP
  ),
  NODE_PLACEMENT_STRATEGY: property<NodePlacementStrategy>(
    'elk.layered.nodePlacement.strategy',
    NodePlacementStrategy.BRANDES_KOEPF
  ),
  EDGE_ROUTING: property<EdgeRouting>(
    'elk.layered.edgeRouting',
    EdgeRouting.UNDEFINED
  ),

  // Layer constraints
  LAYERING_LAYER_CONSTRAINT: property<LayerConstraint>(
    'elk.layered.layering.layerConstraint',
    LayerConstraint.NONE
  ),
  CROSSING_MINIMIZATION_IN_LAYER_CONSTRAINT: property<InLayerConstraint>(
    'elk.layered.crossingMinimization.inLayerConstraint',
    InLayerConstraint.NONE
  ),
  CROSSING_MINIMIZATION_POSITION_CONSTRAINT: property<string>(
    'elk.layered.crossingMinimization.positionConstraint',
    'NONE'
  ),

  // Model order
  CONSIDER_MODEL_ORDER_STRATEGY: property<OrderingStrategy>(
    'elk.layered.considerModelOrder.strategy',
    OrderingStrategy.NONE
  ),
  CONSIDER_MODEL_ORDER_PORT_MODEL_ORDER: property<boolean>(
    'elk.layered.considerModelOrder.portModelOrder',
    false
  ),

  // Spacings
  SPACING_EDGE_NODE_BETWEEN_LAYERS: property<number>(
    'elk.layered.spacing.edgeNodeBetweenLayers',
    10
  ),
  SPACING_NODE_NODE_BETWEEN_LAYERS: property<number>(
    'elk.layered.spacing.nodeNodeBetweenLayers',
    20
  ),
  SPACING_EDGE_EDGE_BETWEEN_LAYERS: property<number>(
    'elk.layered.spacing.edgeEdgeBetweenLayers',
    10
  ),

  // Wrapping (we keep only the one option seen in the user fixture)
  WRAPPING_ADDITIONAL_EDGE_SPACING: property<number>(
    'elk.layered.wrapping.additionalEdgeSpacing',
    10
  ),

  /**
   * Width of the area where the polyline edge router may add bend points
   * to keep edges from steeply diverging from a straight line. Default
   * mirrors Java `LayeredMetaDataProvider#EDGE_ROUTING_POLYLINE_SLOPED_EDGE_ZONE_WIDTH`.
   */
  EDGE_ROUTING_POLYLINE_SLOPED_EDGE_ZONE_WIDTH: property<number>(
    'elk.layered.edgeRouting.polyline.slopedEdgeZoneWidth',
    4
  ),

  // Misc — referenced by a single fixture or by intermediates we ship.
  THOROUGHNESS: property<number>('elk.layered.thoroughness', 7),
  MERGE_EDGES: property<boolean>('elk.layered.mergeEdges', false),

  /** Edge priority for cycle breaking (higher = less likely to be reversed). */
  PRIORITY_DIRECTION: property<number>('elk.layered.priority.direction', 0),
} as const;
