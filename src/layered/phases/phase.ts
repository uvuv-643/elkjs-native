/**
 * Shared phase contract.
 *
 * A `LayoutPhase` is a `LayoutProcessor` that also declares which
 * intermediate processors it needs around it (mirrors
 * `ILayoutPhase.getLayoutProcessorConfiguration` in Java).
 */
import type { LayoutProcessor, ProcessorSlot } from '../processor.js';
import type { IntermediateProcessor } from '../intermediate/registry.js';
import type { LGraph } from '../lgraph.js';

/** Maps a slot to the intermediates a phase requires there. */
export type PhaseSlotConfig = Partial<Record<ProcessorSlot, IntermediateProcessor[]>>;

/** A pipeline phase. */
export interface LayoutPhase extends LayoutProcessor {
  /** Declares the intermediates the phase wants inserted around it. */
  getProcessorConfiguration(graph: LGraph): PhaseSlotConfig;
}
