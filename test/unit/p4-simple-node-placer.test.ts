/**
 * Unit tests for {@link SimpleNodePlacer}.
 *
 * Stacks nodes in each layer top-to-bottom with `spacing.nodeNode`
 * between adjacent nodes.
 */
import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LongestPathLayerer } from '../../src/layered/phases/p2-longest-path-layerer.js';
import { SimpleNodePlacer } from '../../src/layered/phases/p4-simple-node-placer.js';
import { CoreOptions } from '../../src/options/core-options.js';

describe('SimpleNodePlacer', () => {
  it('stacks 3 nodes vertically with the configured spacing', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const c = b.createNode();
    const d = b.createNode();
    a.size.x = 100; a.size.y = 60;
    c.size.x = 100; c.size.y = 60;
    d.size.x = 100; d.size.y = 60;
    b.graph.setProperty(CoreOptions.SPACING_NODE_NODE, 50);
    LongestPathLayerer.process(b.graph);
    SimpleNodePlacer.process(b.graph);
    // All three nodes are sources → end up in one layer.
    const layer = b.graph.layers[0];
    expect(layer.nodes.length).toBe(3);
    const ys = layer.nodes.map((n) => n.position.y);
    expect(ys[1] - ys[0]).toBeCloseTo(60 + 50);
    expect(ys[2] - ys[1]).toBeCloseTo(60 + 50);
  });

  it('handles empty graph', () => {
    const b = new TestGraphBuilder();
    expect(() => SimpleNodePlacer.process(b.graph)).not.toThrow();
  });
});
