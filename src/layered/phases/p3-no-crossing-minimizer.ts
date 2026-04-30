/**
 * P3 — `NoCrossingMinimizer`. Real (no-op) implementation.
 *
 * Mirrors `org.eclipse.elk.alg.layered.p3order.NoCrossingMinimizer`,
 * which is an empty processor used when
 * `crossingMinimization.strategy = NONE` (our user fixture's setting).
 */
import type { LGraph } from '../lgraph.js';
import type { LayoutPhase, PhaseSlotConfig } from './phase.js';

export const NoCrossingMinimizer: LayoutPhase = {
  id: 'NO_CROSSING_MINIMIZER',
  process(_graph: LGraph): void {
    /* intentionally empty — strategy = NONE */
  },
  getProcessorConfiguration(_graph: LGraph): PhaseSlotConfig {
    return {};
  },
};
