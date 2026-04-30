/**
 * Unit tests for the heuristic {@link NetworkSimplexLayerer}.
 *
 * Invariants verified:
 *  - every edge spans ≥ 1 layer (no in-layer edges, no negative spans);
 *  - layer indices are dense (no empty layers);
 *  - source nodes (no incoming edges) end up at the leftmost layer
 *    when the longest-path baseline already places them there.
 */
import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { NetworkSimplexLayerer } from '../../src/layered/phases/p2-network-simplex-layerer.js';

describe('NetworkSimplexLayerer (heuristic)', () => {
  it('handles an empty graph as a no-op', () => {
    const b = new TestGraphBuilder();
    expect(() => NetworkSimplexLayerer.process(b.graph)).not.toThrow();
    expect(b.graph.layers.length).toBe(0);
  });

  it('places a single node into one layer', () => {
    const b = new TestGraphBuilder();
    b.createNode();
    NetworkSimplexLayerer.process(b.graph);
    expect(b.graph.layers.length).toBe(1);
    expect(b.graph.layers[0].nodes.length).toBe(1);
  });

  it('lays out a chain a → b → c into three consecutive layers', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const bn = b.createNode();
    const c = b.createNode();
    b.createEdge(a, bn);
    b.createEdge(bn, c);
    NetworkSimplexLayerer.process(b.graph);
    expect(b.graph.layers.length).toBe(3);
    const idx = (n: typeof a) => b.graph.layers.findIndex((l) => l.nodes.includes(n));
    expect(idx(a)).toBeLessThan(idx(bn));
    expect(idx(bn)).toBeLessThan(idx(c));
    // Span exactly 1.
    expect(idx(bn) - idx(a)).toBe(1);
    expect(idx(c) - idx(bn)).toBe(1);
  });

  it('every edge spans ≥ 1 layer on a diamond DAG', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const bn = b.createNode();
    const c = b.createNode();
    const d = b.createNode();
    b.createEdge(a, bn);
    b.createEdge(a, c);
    b.createEdge(bn, d);
    b.createEdge(c, d);
    NetworkSimplexLayerer.process(b.graph);
    const idx = (n: typeof a) => b.graph.layers.findIndex((l) => l.nodes.includes(n));
    expect(idx(bn) - idx(a)).toBeGreaterThanOrEqual(1);
    expect(idx(c) - idx(a)).toBeGreaterThanOrEqual(1);
    expect(idx(d) - idx(bn)).toBeGreaterThanOrEqual(1);
    expect(idx(d) - idx(c)).toBeGreaterThanOrEqual(1);
  });

  it('produces dense layers (no empty in-betweens)', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const bn = b.createNode();
    const c = b.createNode();
    b.createEdge(a, bn);
    b.createEdge(bn, c);
    b.createEdge(a, c);
    NetworkSimplexLayerer.process(b.graph);
    for (const layer of b.graph.layers) {
      expect(layer.nodes.length).toBeGreaterThan(0);
    }
  });
});
