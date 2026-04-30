import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { PortSide } from '../../src/options/enums.js';

describe('TestGraphBuilder', () => {
  it('creates standalone nodes', () => {
    const b = new TestGraphBuilder();
    const n1 = b.createNode(40, 20);
    const n2 = b.createNode();
    expect(b.graph.layerlessNodes).toEqual([n1, n2]);
    expect(n1.size.x).toBe(40);
    expect(n1.size.y).toBe(20);
  });

  it('connects nodes via implicit ports', () => {
    const b = new TestGraphBuilder();
    const n1 = b.createNode();
    const n2 = b.createNode();
    const e = b.createEdge(n1, n2);
    expect(e.source?.node).toBe(n1);
    expect(e.target?.node).toBe(n2);
    expect(n1.ports).toHaveLength(1);
    expect(n2.ports).toHaveLength(1);
    expect(n1.ports[0].outgoingEdges).toContain(e);
    expect(n2.ports[0].incomingEdges).toContain(e);
  });

  it('creates explicit ports with sides', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode();
    const p = b.createPort(n, PortSide.EAST);
    expect(p.side).toBe(PortSide.EAST);
    expect(p.node).toBe(n);
    expect(n.ports).toContain(p);
  });

  it('attaches labels', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode();
    const l = b.createLabel(n, 'hi', 10, 5);
    expect(l.text).toBe('hi');
    expect(l.parent).toBe(n);
    expect(n.labels).toContain(l);
  });

  it('LEdge.reverse flips source and target', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const c = b.createNode();
    const e = b.createEdge(a, c);
    const oldSource = e.source;
    const oldTarget = e.target;
    e.reverse();
    expect(e.source).toBe(oldTarget);
    expect(e.target).toBe(oldSource);
    expect(oldSource!.outgoingEdges).not.toContain(e);
    expect(oldTarget!.incomingEdges).not.toContain(e);
    expect(oldSource!.incomingEdges).toContain(e);
    expect(oldTarget!.outgoingEdges).toContain(e);
  });
});
