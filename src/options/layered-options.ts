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
  /** Edge priority for shortness (smaller-priority edges are made shorter
   *  during layering — when implemented). */
  PRIORITY_SHORTNESS: property<number>('elk.layered.priority.shortness', 0),

  /** Cap for the number of crossings in a single sweep before we abort
   *  the layer-sweep loop. */
  CROSSING_MINIMIZATION_FORCE_NODE_MODEL_ORDER: property<boolean>(
    'elk.layered.crossingMinimization.forceNodeModelOrder',
    false
  ),
  /** When true, ports of unconstrained nodes share their model order with
   *  the connected node to bundle parallel edges. */
  CROSSING_MINIMIZATION_HIERARCHICAL_SWEEPINESS: property<number>(
    'elk.layered.crossingMinimization.hierarchicalSweepiness',
    -0.1
  ),
  /** Greedy switch passes after the layer-sweep barycenter heuristic. */
  CROSSING_MINIMIZATION_GREEDY_SWITCH_TYPE: property<string>(
    'elk.layered.crossingMinimization.greedySwitch.type',
    'OFF'
  ),
  CROSSING_MINIMIZATION_SEMI_INTERACTIVE: property<boolean>(
    'elk.layered.crossingMinimization.semiInteractive',
    false
  ),

  /** Choose between BK alignment biases. */
  NODE_PLACEMENT_BK_FIXED_ALIGNMENT: property<string>(
    'elk.layered.nodePlacement.bk.fixedAlignment',
    'NONE'
  ),
  /** When true, the BK placer also uses a balanced layout. */
  NODE_PLACEMENT_BK_EDGE_STRAIGHTENING: property<string>(
    'elk.layered.nodePlacement.bk.edgeStraightening',
    'NONE'
  ),
  /** Per-node-placement minimum distance constraint. */
  NODE_PLACEMENT_FAVOR_STRAIGHT_EDGES: property<boolean>(
    'elk.layered.nodePlacement.favorStraightEdges',
    false
  ),

  /** Whether long edges are split into chains of dummies. Defaults to true. */
  UNNECESSARY_BENDPOINTS: property<boolean>(
    'elk.layered.unnecessaryBendpoints',
    false
  ),

  /** Self-loop spacing (in pixels). */
  SPACING_NODE_SELF_LOOP: property<number>(
    'elk.layered.spacing.nodeNodeBetweenLayers',
    20
  ),

  /** Compaction modes (we always run NONE in the MVP). */
  COMPACTION_POST_COMPACTION_STRATEGY: property<string>(
    'elk.layered.compaction.postCompaction.strategy',
    'NONE'
  ),
  /** Whether to run the post-compaction strategy. */
  COMPACTION_CONNECTED_COMPONENTS: property<boolean>(
    'elk.layered.compaction.connectedComponents',
    false
  ),
} as const;
