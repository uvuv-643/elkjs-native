/**
 * Algorithm assembler — builds the linear list of `LayoutProcessor`s that
 * the engine executes.
 *
 * Simplified port of `org.eclipse.elk.core.alg.AlgorithmAssembler`. We
 * skip the dependency-resolution machinery: each phase declares a
 * {@link PhaseSlotConfig}, the assembler unions the requested
 * intermediates per slot, deduplicates, and emits them in the canonical
 * order from {@link INTERMEDIATE_PROCESSOR_ORDER}.
 *
 * Output shape:
 *   [BEFORE_P1 intermediates...] P1
 *   [BEFORE_P2 intermediates...] P2
 *   [BEFORE_P3 intermediates...] P3
 *   [BEFORE_P4 intermediates...] P4
 *   [BEFORE_P5 intermediates...] P5
 *   [AFTER_P5  intermediates...]
 */
import type { LGraph } from './lgraph.js';
import type { LayoutProcessor } from './processor.js';
import { ProcessorSlot, SLOT_COUNT } from './processor.js';
import type { LayoutPhase } from './phases/phase.js';
import {
  IntermediateProcessor,
  INTERMEDIATE_PROCESSOR_ORDER,
  createIntermediate,
} from './intermediate/registry.js';

/** Five phases plus six slots. */
export interface AssembledPipeline {
  /** Flat, ordered list of processors for the engine to run. */
  readonly processors: readonly LayoutProcessor[];
  /** Convenience: just the slot/phase identifiers in order (for tests). */
  readonly ids: readonly string[];
}

/** Picks intermediates for a slot from any phase that requested them,
 *  returns them in canonical execution order (no duplicates). */
function intermediatesFor(
  slot: ProcessorSlot,
  phases: readonly LayoutPhase[],
  graph: LGraph
): IntermediateProcessor[] {
  const wanted = new Set<IntermediateProcessor>();
  for (const phase of phases) {
    const cfg = phase.getProcessorConfiguration(graph);
    const list = cfg[slot];
    if (list) for (const id of list) wanted.add(id);
  }
  return INTERMEDIATE_PROCESSOR_ORDER.filter((id) => wanted.has(id));
}

/** Assembles the final pipeline for the given phases and graph. */
export function assemble(
  phases: readonly [LayoutPhase, LayoutPhase, LayoutPhase, LayoutPhase, LayoutPhase],
  graph: LGraph
): AssembledPipeline {
  const out: LayoutProcessor[] = [];
  for (let slot = 0; slot < SLOT_COUNT; slot++) {
    for (const id of intermediatesFor(slot as ProcessorSlot, phases, graph)) {
      out.push(createIntermediate(id));
    }
    if (slot < phases.length) out.push(phases[slot]);
  }
  return { processors: out, ids: out.map((p) => p.id) };
}
