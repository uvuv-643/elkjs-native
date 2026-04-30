/**
 * Common types for the layered pipeline.
 *
 * A `LayoutProcessor` is the unit that the engine runs on an `LGraph`.
 * Phases (P1..P5) and intermediate processors all share this contract.
 *
 * `ProcessorSlot` enumerates the positions where an intermediate
 * processor can be inserted relative to the five Sugiyama phases.
 * Mirrors `IntermediateProcessingConfiguration.SlotIndex` from
 * `org.eclipse.elk.alg.layered.intermediate`.
 */
import type { LGraph } from './lgraph.js';

/** Single unit of work in the pipeline. */
export interface LayoutProcessor {
  /** Stable identifier used for debug logging / golden slot comparisons. */
  readonly id: string;
  /** Mutates the graph in place. */
  process(graph: LGraph): void;
}

/** Position relative to phases P1..P5. */
export enum ProcessorSlot {
  BEFORE_P1 = 0,
  BEFORE_P2 = 1,
  BEFORE_P3 = 2,
  BEFORE_P4 = 3,
  BEFORE_P5 = 4,
  AFTER_P5 = 5,
}

/** Number of slots in a pipeline (5 BEFORE_* + AFTER_P5 + the 5 phases). */
export const SLOT_COUNT = 6;
