import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LongestPathLayerer } from '../../src/layered/phases/p2-longest-path-layerer.js';
import { LongEdgeSplitter } from '../../src/layered/intermediate/long-edge-splitter.js';
import { LongEdgeJoiner } from '../../src/layered/intermediate/long-edge-joiner.js';
import { NodeType } from '../../src/layered/lgraph.js';
import { PortSide } from '../../src/options/enums.js';

describe('LongEdgeJoiner', () => {
  it('removes LONG_EDGE dummies and rejoins the chain into a single edge', () => {
    // Build chain a -> b -> c -> d so that edge a->d spans 3 layers.
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const bb = b.createNode();
    const c = b.createNode();
    const d = b.createNode();
    const aOut = b.createPort(a, PortSide.EAST);
    const bIn = b.createPort(bb, PortSide.WEST);
    const bOut = b.createPort(bb, PortSide.EAST);
    const cIn = b.createPort(c, PortSide.WEST);
    const cOut = b.createPort(c, PortSide.EAST);
    const dIn = b.createPort(d, PortSide.WEST);
    b.createEdge(aOut, bIn);
    b.createEdge(bOut, cIn);
    b.createEdge(cOut, dIn);
    // The long edge.
    const long = b.createEdge(aOut, dIn);

    LongestPathLayerer.process(b.graph);
    LongEdgeSplitter.process(b.graph);

    // Sanity: dummies were inserted.
    let dummies = 0;
    for (const layer of b.graph.layers) {
      for (const n of layer.nodes) if (n.type === NodeType.LONG_EDGE) dummies++;
    }
    expect(dummies).toBeGreaterThan(0);

    LongEdgeJoiner.process(b.graph);

    // No LONG_EDGE dummies remain.
    for (const layer of b.graph.layers) {
      for (const n of layer.nodes) expect(n.type).not.toBe(NodeType.LONG_EDGE);
    }
    // The original long edge keeps its source/target after rejoining.
    expect(long.source?.node).toBe(a);
    expect(long.target?.node).toBe(d);
  });
});
