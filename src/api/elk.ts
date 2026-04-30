/**
 * Public layout API. Mirrors the parts of the elkjs surface we care about.
 *
 * `layoutSync` is the actual entry point — synchronous, no worker,
 * mutates the input JSON in place (and returns it for convenience).
 * `layout` is a thin async wrapper that returns the same result via
 * `Promise.resolve` so existing elkjs callers don't need to change.
 */
import type { ElkNode } from '../graph/elk-types.js';
import { importGraph } from '../layered/transform/elk-graph-importer.js';
import { doLayout } from '../layered/layered-engine.js';
import { applyLayout } from '../layered/transform/elk-graph-layout-transferrer.js';

export class ELK {
  /** Synchronous layout. Mutates and returns `graph`. */
  layoutSync(graph: ElkNode): ElkNode {
    const lgraph = importGraph(graph);
    doLayout(lgraph);
    applyLayout(lgraph, graph);
    return graph;
  }

  /** Async wrapper for elkjs API compatibility. */
  layout(graph: ElkNode): Promise<ElkNode> {
    return Promise.resolve(this.layoutSync(graph));
  }
}

export default ELK;
