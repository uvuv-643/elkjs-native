/**
 * Splits an `LGraph` into weakly-connected components and combines them
 * back. Port of `org.eclipse.elk.alg.layered.components.ComponentsProcessor`.
 *
 * MVP simplification:
 * - we always run on `layerlessNodes` (split is called before P2);
 * - combine just stacks components vertically (or horizontally for vertical
 *   layout direction) with a `componentSpacing` gap;
 * - `componentsPlacementStrategy = NONE` is treated as "single component";
 *   in that case we still run split for safety, but a connected graph
 *   produces exactly one component.
 */
import { LGraph, LNode } from '../lgraph.js';
import { CoreOptions } from '../../options/core-options.js';
import { Direction } from '../../options/enums.js';

/**
 * Splits the graph into weakly-connected components. Each component is a
 * fresh {@link LGraph} containing a slice of `layerlessNodes`. Properties
 * on the original graph are copied to each component so per-graph options
 * stay accessible.
 *
 * If the graph is connected (or has zero/one node), returns `[graph]`.
 */
export function split(graph: LGraph): LGraph[] {
  const nodes = graph.layerlessNodes;
  if (nodes.length <= 1) return [graph];

  const visited = new Set<LNode>();
  const components: LNode[][] = [];

  for (const start of nodes) {
    if (visited.has(start)) continue;
    const stack: LNode[] = [start];
    const group: LNode[] = [];
    while (stack.length > 0) {
      const n = stack.pop() as LNode;
      if (visited.has(n)) continue;
      visited.add(n);
      group.push(n);
      for (const port of n.ports) {
        for (const e of port.outgoingEdges) {
          const t = e.target?.node;
          if (t && !visited.has(t)) stack.push(t);
        }
        for (const e of port.incomingEdges) {
          const s = e.source?.node;
          if (s && !visited.has(s)) stack.push(s);
        }
      }
    }
    components.push(group);
  }

  if (components.length === 1) return [graph];

  return components.map((group) => {
    const sub = new LGraph();
    sub.copyProperties(graph);
    sub.padding = graph.padding.clone();
    sub.layerlessNodes = group;
    for (const n of group) n.graph = sub;
    return sub;
  });
}

/**
 * Combines previously-split components back into a single graph.
 * Components are placed side-by-side along the layout's secondary axis
 * (perpendicular to flow direction) with `spacing.componentComponent`
 * fallback to `spacing.nodeNode` * 2.
 *
 * Returns the original graph (mutated in place) — see Java equivalent
 * which also returns the LGraph to chain calls.
 */
export function combine(components: LGraph[], target: LGraph): LGraph {
  if (components.length === 0) {
    target.layerlessNodes = [];
    target.size.x = 0;
    target.size.y = 0;
    return target;
  }
  if (components.length === 1 && components[0] === target) {
    return target;
  }

  const dir = target.getProperty(CoreOptions.DIRECTION);
  const isHorizontal = dir === Direction.RIGHT || dir === Direction.LEFT || dir === Direction.UNDEFINED;
  const spacing = target.getProperty(CoreOptions.SPACING_NODE_NODE) * 2;

  let cursor = 0;
  let totalX = 0;
  let totalY = 0;

  const merged: LNode[] = [];
  for (const comp of components) {
    const ox = isHorizontal ? 0 : cursor;
    const oy = isHorizontal ? cursor : 0;
    for (const n of comp.layerlessNodes) {
      n.position.x += ox;
      n.position.y += oy;
      n.graph = target;
      merged.push(n);
    }
    if (isHorizontal) {
      totalX = Math.max(totalX, comp.size.x);
      totalY = cursor + comp.size.y;
      cursor += comp.size.y + spacing;
    } else {
      totalX = cursor + comp.size.x;
      totalY = Math.max(totalY, comp.size.y);
      cursor += comp.size.x + spacing;
    }
  }

  target.layerlessNodes = merged;
  target.size.x = totalX;
  target.size.y = totalY;
  return target;
}
