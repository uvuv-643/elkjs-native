/**
 * Top-level orchestration for the layered algorithm.
 *
 * Port of `org.eclipse.elk.alg.layered.ElkLayered.doLayout`, minus the
 * compound-graph branch and the progress-monitor plumbing.
 *
 * Flow:
 * 1. Build the pipeline via {@link prepareGraphForLayout}.
 * 2. Split the graph into weakly-connected components.
 * 3. Run each pipeline processor over every component.
 * 4. Combine components back into the original graph.
 *
 * Stage 4: most pipeline processors are no-op stubs; this function exists
 * primarily so the integration test can prove the wiring works end-to-end.
 */
import type { LGraph } from './lgraph.js';
import { prepareGraphForLayout } from './graph-configurator.js';
import * as components from './components/components-processor.js';

/** Whether to log the executed processor sequence; toggle via the env hook
 *  exposed on `globalThis` (works under Node and the browser). */
function isDebugSlots(): boolean {
  const env = (globalThis as { ELKJS_NATIVE_DEBUG_SLOTS?: unknown }).ELKJS_NATIVE_DEBUG_SLOTS;
  return env === true || env === '1';
}

/** Runs the layered pipeline on `graph` in place. */
export function doLayout(graph: LGraph): void {
  const pipeline = prepareGraphForLayout(graph);
  if (isDebugSlots()) {
    // eslint-disable-next-line no-console
    console.debug('[elkjs-native] pipeline:', pipeline.ids.join(' -> '));
  }

  const comps = components.split(graph);
  for (const comp of comps) {
    for (const processor of pipeline.processors) {
      processor.process(comp);
    }
  }
  components.combine(comps, graph);
}
