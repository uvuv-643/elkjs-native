import { describe, expect, it } from 'vitest';

import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { combine, split } from '../../src/layered/components/components-processor.js';

describe('components-processor.split', () => {
  it('returns [graph] for an empty graph', () => {
    const b = new TestGraphBuilder();
    expect(split(b.graph)).toEqual([b.graph]);
  });

  it('returns [graph] for a single-node graph', () => {
    const b = new TestGraphBuilder();
    b.createNode();
    expect(split(b.graph)).toEqual([b.graph]);
  });

  it('returns [graph] for a connected graph', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const c = b.createNode();
    b.createEdge(a, c);
    const result = split(b.graph);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(b.graph);
  });

  it('splits two isolated nodes into two components', () => {
    const b = new TestGraphBuilder();
    b.createNode();
    b.createNode();
    const result = split(b.graph);
    expect(result).toHaveLength(2);
    expect(result[0].layerlessNodes).toHaveLength(1);
    expect(result[1].layerlessNodes).toHaveLength(1);
  });

  it('finds two clusters connected internally but not to each other', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const c = b.createNode();
    b.createEdge(a, c);
    const x = b.createNode();
    const y = b.createNode();
    b.createEdge(x, y);
    const result = split(b.graph);
    expect(result).toHaveLength(2);
    const sizes = result.map((g) => g.layerlessNodes.length).sort();
    expect(sizes).toEqual([2, 2]);
  });

  it('treats incoming edges as connectivity (weakly connected)', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const c = b.createNode();
    // Edge from c -> a; DFS from a should still find c via incoming edges.
    b.createEdge(c, a);
    const result = split(b.graph);
    expect(result).toHaveLength(1);
  });
});

describe('components-processor.combine', () => {
  it('combine of single component returns the same graph', () => {
    const b = new TestGraphBuilder();
    b.createNode();
    const result = combine([b.graph], b.graph);
    expect(result).toBe(b.graph);
  });

  it('combine empty list zeroes the target graph', () => {
    const b = new TestGraphBuilder();
    b.createNode();
    const result = combine([], b.graph);
    expect(result.layerlessNodes).toHaveLength(0);
    expect(result.size.x).toBe(0);
    expect(result.size.y).toBe(0);
  });

  it('split + combine round-trips node membership', () => {
    const b = new TestGraphBuilder();
    b.createNode();
    b.createNode();
    b.createNode();
    const before = b.graph.layerlessNodes.slice();
    const components = split(b.graph);
    expect(components.length).toBeGreaterThan(1);
    const combined = combine(components, b.graph);
    expect(combined.layerlessNodes.sort((p, q) => p.id - q.id)).toEqual(
      before.sort((p, q) => p.id - q.id)
    );
  });
});
