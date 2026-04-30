import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { GreedyCycleBreaker } from '../../src/layered/phases/p1-greedy-cycle-breaker.js';
import { InternalProperties } from '../../src/options/internal-properties.js';
import type { LEdge, LGraph } from '../../src/layered/lgraph.js';

function reversedEdges(graph: LGraph): LEdge[] {
  const out: LEdge[] = [];
  for (const node of graph.layerlessNodes) {
    for (const port of node.ports) {
      for (const edge of port.outgoingEdges) {
        if (edge.getProperty(InternalProperties.REVERSED)) out.push(edge);
      }
    }
  }
  return out;
}

function hasCycle(graph: LGraph): boolean {
  // Iterative DFS with white/gray/black colouring.
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<number, number>();
  for (const node of graph.layerlessNodes) color.set(node.id, WHITE);

  const stack: { id: number; iter: Iterator<{ tgt: number }> }[] = [];

  function* outNeighbours(nodeId: number) {
    const node = graph.layerlessNodes.find((n) => n.id === nodeId)!;
    for (const port of node.ports) {
      for (const edge of port.outgoingEdges) {
        if (edge.target?.node) yield { tgt: edge.target.node.id };
      }
    }
  }

  for (const start of graph.layerlessNodes) {
    if (color.get(start.id) !== WHITE) continue;
    stack.push({ id: start.id, iter: outNeighbours(start.id) });
    color.set(start.id, GRAY);
    while (stack.length > 0) {
      const top = stack[stack.length - 1];
      const next = top.iter.next();
      if (next.done) {
        color.set(top.id, BLACK);
        stack.pop();
        continue;
      }
      const c = color.get(next.value.tgt) ?? WHITE;
      if (c === GRAY) return true;
      if (c === WHITE) {
        color.set(next.value.tgt, GRAY);
        stack.push({ id: next.value.tgt, iter: outNeighbours(next.value.tgt) });
      }
    }
  }
  return false;
}

describe('GreedyCycleBreaker', () => {
  it('does nothing on a DAG', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const c = b.createNode();
    const d = b.createNode();
    b.createEdge(a, c);
    b.createEdge(c, d);
    GreedyCycleBreaker.process(b.graph);
    expect(reversedEdges(b.graph)).toHaveLength(0);
    expect(hasCycle(b.graph)).toBe(false);
  });

  it('breaks a single 3-cycle', () => {
    const b = new TestGraphBuilder();
    const n1 = b.createNode();
    const n2 = b.createNode();
    const n3 = b.createNode();
    b.createEdge(n1, n2);
    b.createEdge(n2, n3);
    b.createEdge(n3, n1);
    GreedyCycleBreaker.process(b.graph);
    expect(reversedEdges(b.graph).length).toBeGreaterThanOrEqual(1);
    expect(hasCycle(b.graph)).toBe(false);
    expect(b.graph.getProperty(InternalProperties.CYCLIC)).toBe(true);
  });

  it('handles multiple disjoint cycles', () => {
    const b = new TestGraphBuilder();
    const a1 = b.createNode();
    const a2 = b.createNode();
    const c1 = b.createNode();
    const c2 = b.createNode();
    b.createEdge(a1, a2);
    b.createEdge(a2, a1);
    b.createEdge(c1, c2);
    b.createEdge(c2, c1);
    GreedyCycleBreaker.process(b.graph);
    expect(hasCycle(b.graph)).toBe(false);
  });

  it('leaves an isolated node untouched', () => {
    const b = new TestGraphBuilder();
    b.createNode();
    GreedyCycleBreaker.process(b.graph);
    expect(reversedEdges(b.graph)).toHaveLength(0);
  });
});
