/**
 * Public entry point for elkjs-native.
 *
 * Stage 4 wires up the pipeline scaffolding. Phases other than P3 are
 * still stubs, so coordinates are placeholders — `pnpm test` checks the
 * pipeline structure, not absolute positions.
 */
export * from './graph/elk-types.js';
export { importGraph } from './graph/json-importer.js';
export { transferLayout } from './graph/json-exporter.js';
export { CoreOptions } from './options/core-options.js';
export { LayeredOptions } from './options/layered-options.js';
export * from './options/enums.js';
export { property, PropertyHolder, type IProperty } from './properties.js';
export { KVector, KVectorChain } from './math/kvector.js';
export { ELK } from './api/elk.js';

// Phases — exposed for advanced users assembling their own pipeline.
export { GreedyCycleBreaker } from './layered/phases/p1-greedy-cycle-breaker.js';
export { LongestPathLayerer } from './layered/phases/p2-longest-path-layerer.js';
export { NetworkSimplexLayerer } from './layered/phases/p2-network-simplex-layerer.js';
export { NoCrossingMinimizer } from './layered/phases/p3-no-crossing-minimizer.js';
export { LayerSweepCrossingMinimizer } from './layered/phases/p3-layer-sweep-crossing-minimizer.js';
export { BKNodePlacer } from './layered/phases/p4-bk-node-placer.js';
export { SimpleNodePlacer } from './layered/phases/p4-simple-node-placer.js';
export { PolylineEdgeRouter } from './layered/phases/p5-polyline-edge-router.js';
export { OrthogonalEdgeRouter } from './layered/phases/p5-orthogonal-edge-router.js';

// Intermediate processors that may be useful in custom pipelines.
export { PortPositionCalculator } from './layered/intermediate/port-position-calculator.js';
export { SelfLoopRouter } from './layered/intermediate/self-loop-router.js';

// Direction transformer — useful for callers that want to lay out a
// graph in a non-canonical direction without going through the public
// API.
export {
  applyDirectionPreLayout,
  applyDirectionPostLayout,
  effectiveDirection,
} from './layered/transform/direction-transformer.js';

import { ELK } from './api/elk.js';
export default ELK;
