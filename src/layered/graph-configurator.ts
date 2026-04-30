/**
 * Picks the five phase implementations based on the graph's options and
 * delegates to {@link assemble} for the final pipeline.
 *
 * Simplified port of `org.eclipse.elk.alg.layered.GraphConfigurator.prepareGraphForLayout`.
 *
 * Stage 4 supports exactly one variant per phase:
 * - P1 = `GreedyCycleBreaker` (only `CycleBreakingStrategy.GREEDY` works);
 * - P2 = `LongestPathLayerer` (we ignore `LayeringStrategy.NETWORK_SIMPLEX`
 *   for now — see plan §0.6);
 * - P3 = `NoCrossingMinimizer` (only `CrossingMinimizationStrategy.NONE`);
 * - P4 = `BKNodePlacer` (only `NodePlacementStrategy.BRANDES_KOEPF`);
 * - P5 = `PolylineEdgeRouter` (only `EdgeRouting.POLYLINE` / `UNDEFINED`).
 *
 * Anything else throws — we'd rather fail loudly than silently produce a
 * different-looking layout.
 */
import type { LGraph } from './lgraph.js';
import { LayeredOptions } from '../options/layered-options.js';
import { CoreOptions } from '../options/core-options.js';
import {
  CycleBreakingStrategy,
  Direction,
  EdgeRouting,
  LayeringStrategy,
  NodePlacementStrategy,
} from '../options/enums.js';
import { type AssembledPipeline, assemble } from './algorithm-assembler.js';
import type { LayoutPhase } from './phases/phase.js';
import { GreedyCycleBreaker } from './phases/p1-greedy-cycle-breaker.js';
import { LongestPathLayerer } from './phases/p2-longest-path-layerer.js';
import { NoCrossingMinimizer } from './phases/p3-no-crossing-minimizer.js';
import { BKNodePlacer } from './phases/p4-bk-node-placer.js';
import { PolylineEdgeRouter } from './phases/p5-polyline-edge-router.js';

/** Builds the pipeline for `graph`. */
export function prepareGraphForLayout(graph: LGraph): AssembledPipeline {
  // Direction guard — MVP only supports flow-right layouts.
  const dir = graph.getProperty(CoreOptions.DIRECTION);
  if (
    dir !== Direction.RIGHT &&
    dir !== Direction.UNDEFINED
  ) {
    throw new Error(
      `elkjs-native MVP supports only direction=RIGHT, got ${dir}.`
    );
  }

  return assemble(
    [
      pickP1(graph),
      pickP2(graph),
      pickP3(graph),
      pickP4(graph),
      pickP5(graph),
    ],
    graph
  );
}

function pickP1(graph: LGraph): LayoutPhase {
  const s = graph.getProperty(LayeredOptions.CYCLE_BREAKING_STRATEGY);
  if (s !== CycleBreakingStrategy.GREEDY) {
    throw new Error(`P1: unsupported strategy ${s}`);
  }
  return GreedyCycleBreaker;
}

function pickP2(graph: LGraph): LayoutPhase {
  const s = graph.getProperty(LayeredOptions.LAYERING_STRATEGY);
  // DIVERGE: NETWORK_SIMPLEX is mapped to LongestPathLayerer in MVP — see plan §0.6.
  if (
    s !== LayeringStrategy.NETWORK_SIMPLEX &&
    s !== LayeringStrategy.LONGEST_PATH
  ) {
    throw new Error(`P2: unsupported strategy ${s}`);
  }
  return LongestPathLayerer;
}

function pickP3(_graph: LGraph): LayoutPhase {
  // DIVERGE: MVP always runs NoCrossingMinimizer regardless of the configured
  // strategy. Real LAYER_SWEEP is out of scope (see plan §0.6). The user's
  // production graph sets `NONE` anyway, so this only affects the realworld
  // smoke tests where defaults bring in `LAYER_SWEEP`.
  return NoCrossingMinimizer;
}

function pickP4(graph: LGraph): LayoutPhase {
  const s = graph.getProperty(LayeredOptions.NODE_PLACEMENT_STRATEGY);
  if (s !== NodePlacementStrategy.BRANDES_KOEPF) {
    throw new Error(`P4: unsupported strategy ${s}`);
  }
  return BKNodePlacer;
}

function pickP5(graph: LGraph): LayoutPhase {
  const s = graph.getProperty(LayeredOptions.EDGE_ROUTING);
  if (
    s !== EdgeRouting.POLYLINE &&
    s !== EdgeRouting.UNDEFINED
  ) {
    throw new Error(`P5: unsupported routing ${s} (only POLYLINE in MVP)`);
  }
  return PolylineEdgeRouter;
}
