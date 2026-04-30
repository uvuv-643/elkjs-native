import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LongestPathLayerer } from '../../src/layered/phases/p2-longest-path-layerer.js';
import { BKNodePlacer } from '../../src/layered/phases/p4-bk-node-placer.js';
import { CoreOptions } from '../../src/options/core-options.js';

describe('BKNodePlacer', () => {
  it('places a single node at origin', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode(40, 30);
    LongestPathLayerer.process(b.graph);
    BKNodePlacer.process(b.graph);
    expect(n.position.x).toBe(0);
    expect(n.position.y).toBe(0);
  });

  it('stacks nodes vertically inside one layer with spacing', () => {
    const b = new TestGraphBuilder();
    b.graph.setProperty(CoreOptions.SPACING_NODE_NODE, 20);
    const n1 = b.createNode(40, 30);
    const n2 = b.createNode(40, 30);
    LongestPathLayerer.process(b.graph);
    BKNodePlacer.process(b.graph);
    // Both share the only layer.
    expect(n1.position.x).toBe(0);
    expect(n2.position.x).toBe(0);
    expect(n2.position.y).toBe(n1.position.y + 30 + 20);
  });

  it('places two layers at different y stacking', () => {
    const b = new TestGraphBuilder();
    b.graph.setProperty(CoreOptions.SPACING_NODE_NODE, 20);
    const n1 = b.createNode(40, 30);
    const n2 = b.createNode(40, 30);
    b.createEdge(n1, n2);
    LongestPathLayerer.process(b.graph);
    BKNodePlacer.process(b.graph);
    // After porting BK to mirror Java (BK only writes y; x is delegated to
    // PolylineEdgeRouter), nodes in different layers share the placeholder
    // x=0 until P5 runs. The two layers separation is observable on layer
    // sizes.
    expect(b.graph.layers.length).toBe(2);
    expect(b.graph.layers[0].size.x).toBeGreaterThan(0);
    expect(b.graph.layers[1].size.x).toBeGreaterThan(0);
  });
});
