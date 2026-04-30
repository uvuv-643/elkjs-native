import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LongestPathLayerer } from '../../src/layered/phases/p2-longest-path-layerer.js';
import { LongEdgeSplitter } from '../../src/layered/intermediate/long-edge-splitter.js';
import { NodeType } from '../../src/layered/lgraph.js';

describe('LongEdgeSplitter', () => {
  it('does nothing when graph has ≤2 layers', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const c = b.createNode();
    b.createEdge(a, c);
    LongestPathLayerer.process(b.graph);
    LongEdgeSplitter.process(b.graph);
    expect(b.graph.layers.length).toBe(2);
    expect(b.graph.layers[1].nodes.length).toBe(1);
  });

  it('inserts one dummy for an edge spanning a single intermediate layer', () => {
    // Chain a→b→d; extra direct a→d should be split through layer 1.
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const m = b.createNode();
    const d = b.createNode();
    b.createEdge(a, m);
    b.createEdge(m, d);
    b.createEdge(a, d);
    LongestPathLayerer.process(b.graph);
    LongEdgeSplitter.process(b.graph);

    expect(b.graph.layers.length).toBe(3);
    // Middle layer should have m + 1 long-edge dummy.
    const middle = b.graph.layers[1].nodes;
    expect(middle).toContain(m);
    const dummies = middle.filter((n) => n.type === NodeType.LONG_EDGE);
    expect(dummies.length).toBe(1);
  });

  it('produces a proper layering: every edge between adjacent layers', () => {
    const b = new TestGraphBuilder();
    const n1 = b.createNode();
    const n2 = b.createNode();
    const n3 = b.createNode();
    const n4 = b.createNode();
    b.createEdge(n1, n2);
    b.createEdge(n2, n3);
    b.createEdge(n3, n4);
    b.createEdge(n1, n4); // long edge of length 3
    LongestPathLayerer.process(b.graph);
    LongEdgeSplitter.process(b.graph);

    for (let li = 0; li < b.graph.layers.length; li++) {
      for (const node of b.graph.layers[li].nodes) {
        for (const port of node.ports) {
          for (const edge of port.outgoingEdges) {
            const tgtLayer = edge.target?.node?.layer;
            const tgtIndex = b.graph.layers.indexOf(tgtLayer!);
            expect(tgtIndex - li).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });
});
