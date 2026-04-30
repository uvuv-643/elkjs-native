/**
 * Subset of ELK enums that the layered MVP pipeline actually consumes.
 *
 * Names match Java enum constants so that string values from
 * `layoutOptions` parse trivially via `Direction[s as Direction]`.
 */

export enum Direction {
  UNDEFINED = 'UNDEFINED',
  RIGHT = 'RIGHT',
  LEFT = 'LEFT',
  DOWN = 'DOWN',
  UP = 'UP',
}

export enum PortSide {
  UNDEFINED = 'UNDEFINED',
  NORTH = 'NORTH',
  EAST = 'EAST',
  SOUTH = 'SOUTH',
  WEST = 'WEST',
}

export enum EdgeRouting {
  UNDEFINED = 'UNDEFINED',
  POLYLINE = 'POLYLINE',
  ORTHOGONAL = 'ORTHOGONAL',
  SPLINES = 'SPLINES',
}

export enum NodePlacementStrategy {
  SIMPLE = 'SIMPLE',
  INTERACTIVE = 'INTERACTIVE',
  LINEAR_SEGMENTS = 'LINEAR_SEGMENTS',
  BRANDES_KOEPF = 'BRANDES_KOEPF',
  NETWORK_SIMPLEX = 'NETWORK_SIMPLEX',
}

export enum CycleBreakingStrategy {
  GREEDY = 'GREEDY',
  DEPTH_FIRST = 'DEPTH_FIRST',
  INTERACTIVE = 'INTERACTIVE',
  MODEL_ORDER = 'MODEL_ORDER',
  GREEDY_MODEL_ORDER = 'GREEDY_MODEL_ORDER',
}

export enum LayeringStrategy {
  NETWORK_SIMPLEX = 'NETWORK_SIMPLEX',
  LONGEST_PATH = 'LONGEST_PATH',
  COFFMAN_GRAHAM = 'COFFMAN_GRAHAM',
  INTERACTIVE = 'INTERACTIVE',
  STRETCH_WIDTH = 'STRETCH_WIDTH',
  MIN_WIDTH = 'MIN_WIDTH',
  BF_MODEL_ORDER = 'BF_MODEL_ORDER',
  DF_MODEL_ORDER = 'DF_MODEL_ORDER',
}

export enum CrossingMinimizationStrategy {
  NONE = 'NONE',
  LAYER_SWEEP = 'LAYER_SWEEP',
  INTERACTIVE = 'INTERACTIVE',
}

export enum OrderingStrategy {
  NONE = 'NONE',
  NODES_AND_EDGES = 'NODES_AND_EDGES',
  PREFER_EDGES = 'PREFER_EDGES',
  PREFER_NODES = 'PREFER_NODES',
}

export enum LayerConstraint {
  NONE = 'NONE',
  FIRST = 'FIRST',
  FIRST_SEPARATE = 'FIRST_SEPARATE',
  LAST = 'LAST',
  LAST_SEPARATE = 'LAST_SEPARATE',
}

export enum InLayerConstraint {
  NONE = 'NONE',
  TOP = 'TOP',
  BOTTOM = 'BOTTOM',
}

export enum PortType {
  UNDEFINED = 'UNDEFINED',
  INPUT = 'INPUT',
  OUTPUT = 'OUTPUT',
}

export enum PortConstraints {
  UNDEFINED = 'UNDEFINED',
  FREE = 'FREE',
  FIXED_SIDE = 'FIXED_SIDE',
  FIXED_ORDER = 'FIXED_ORDER',
  FIXED_RATIO = 'FIXED_RATIO',
  FIXED_POS = 'FIXED_POS',
}

export enum HierarchyHandling {
  INHERIT = 'INHERIT',
  SEPARATE_CHILDREN = 'SEPARATE_CHILDREN',
  INCLUDE_CHILDREN = 'INCLUDE_CHILDREN',
}

export enum PortAlignment {
  UNDEFINED = 'UNDEFINED',
  JUSTIFIED = 'JUSTIFIED',
  BEGIN = 'BEGIN',
  CENTER = 'CENTER',
  END = 'END',
  DISTRIBUTED = 'DISTRIBUTED',
}

export enum EdgeConstraint {
  UNDEFINED = 'UNDEFINED',
  OUTGOING_ONLY = 'OUTGOING_ONLY',
  INCOMING_ONLY = 'INCOMING_ONLY',
}

export enum SizeConstraint {
  NODE_LABELS = 'NODE_LABELS',
  PORTS = 'PORTS',
  PORT_LABELS = 'PORT_LABELS',
  MINIMUM_SIZE = 'MINIMUM_SIZE',
}
