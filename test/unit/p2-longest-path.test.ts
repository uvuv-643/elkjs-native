import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LongestPathLayerer } from '../../src/layered/phases/p2-longest-path-layerer.js';

describe('LongestPathLayerer', () => {
  it('places a single node into one layer', () => {
    const b = new TestGraphBuilder();
    b.createNode();
    LongestPathLayerer.process(b.graph);
    expect(b.graph.layers.length).toBe(1);
    expect(b.graph.layers[0].nodes.length).toBe(1);
    expect(b.graph.layerlessNodes.length).toBe(0);
  });

  it('puts a chain of three nodes into three layers', () => {
    const b = new TestGraphBuilder();
    const n1 = b.createNode();
    const n2 = b.createNode();
    const n3 = b.createNode();
    b.createEdge(n1, n2);
    b.createEdge(n2, n3);
    LongestPathLayerer.process(b.graph);
    expect(b.graph.layers.length).toBe(3);
    expect(b.graph.layers[0].nodes).toContain(n1);
    expect(b.graph.layers[1].nodes).toContain(n2);
    expect(b.graph.layers[2].nodes).toContain(n3);
  });

  it('honours longest path over shorter alternatives', () => {
    // a → b → c   and  a → c   ⇒ c lands on layer 2, not 1.
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const m = b.createNode();
    const c = b.createNode();
    b.createEdge(a, m);
    b.createEdge(m, c);
    b.createEdge(a, c);
    LongestPathLayerer.process(b.graph);
    expect(b.graph.layers.length).toBe(3);
    expect(c.layer).toBe(b.graph.layers[2]);
  });

  it('ignores self-loops', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode();
    b.createEdge(n, n);
    LongestPathLayerer.process(b.graph);
    expect(b.graph.layers.length).toBe(1);
  });
});
