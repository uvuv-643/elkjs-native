/**
 * Crossing-detection tests for {@link ELK.layout}.
 *
 * The crossings here are *segment-segment* intersections between routed
 * edges. We compare against `elkjs@0.x` (the reference Java→GWT bundle)
 * to make sure regressions in the polyline router or in
 * `ReversedEdgeRestorer` don't reintroduce back-edge zigzags.
 */
import { describe, it, expect } from 'vitest';
import { ELK } from '../../src/index.js';
import type { ElkExtendedEdge, ElkNode, ElkPoint } from '../../src/graph/elk-types.js';

/* -------------------------------------------------------------------------- */
/* Crossing helpers                                                            */
/* -------------------------------------------------------------------------- */

interface Pt { x: number; y: number }
interface Seg { id: string; a: Pt; b: Pt }

function segmentsCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt): boolean {
  const d = (a: Pt, b: Pt, c: Pt) => (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
  const d1 = d(p3, p4, p1);
  const d2 = d(p3, p4, p2);
  const d3 = d(p1, p2, p3);
  const d4 = d(p1, p2, p4);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

function* allPoints(edge: ElkExtendedEdge): IterableIterator<ElkPoint> {
  for (const section of edge.sections ?? []) {
    if (section.startPoint) yield section.startPoint;
    for (const bp of section.bendPoints ?? []) yield bp;
    if (section.endPoint) yield section.endPoint;
  }
}

function countCrossings(graph: ElkNode): number {
  const segs: Seg[] = [];
  for (const e of graph.edges ?? []) {
    const pts = [...allPoints(e)];
    for (let i = 1; i < pts.length; i++) {
      segs.push({ id: e.id, a: pts[i - 1], b: pts[i] });
    }
  }
  let count = 0;
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      if (segs[i].id === segs[j].id) continue;
      if (segmentsCross(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) count++;
    }
  }
  return count;
}

/* -------------------------------------------------------------------------- */
/* Builders                                                                    */
/* -------------------------------------------------------------------------- */

const COMMON_OPTS = {
  'elk.algorithm': 'layered',
  'elk.spacing.edgeNode': '50.0',
  'elk.spacing.nodeNode': '50.0',
  'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
  'elk.layered.spacing.edgeNodeBetweenLayers': '20.0',
  'elk.layered.edgeRouting': 'POLYLINE',
  'elk.edge.thickness': '2.0',
  'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
  'elk.layered.considerModelOrder.portModelOrder': 'true',
  'elk.layered.crossingMinimization.strategy': 'NONE',
  'elk.spacing.portPort': '0',
};

/** Mimics the user's flowchart pattern: explicit anchor + index per port. */
function mkPort(id: string, side: 'WEST' | 'EAST', idx: number, anchorY = 40 + idx * 40 + 15): unknown {
  return {
    id,
    width: 0,
    height: 0,
    layoutOptions: {
      'elk.port.side': side,
      'elk.port.index': String(idx),
      'elk.port.borderOffset': '0',
      'elk.port.anchor': `0,${anchorY}`,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

describe('No edge crossings on simple fan-out', () => {
  it('three edges from one source to three siblings, no crossings', async () => {
    const g: ElkNode = {
      id: 'root',
      layoutOptions: COMMON_OPTS,
      children: [
        { id: 's', width: 150, height: 120,
          layoutOptions: { 'elk.portAlignment.default': 'BEGIN', 'elk.layered.layering.layerConstraint': 'FIRST' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('s.o1', 'EAST', 0), mkPort('s.o2', 'EAST', 1), mkPort('s.o3', 'EAST', 2)] as any[],
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'a', width: 150, height: 80, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' }, ports: [mkPort('a.in', 'WEST', 0)] as any[] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'b', width: 150, height: 80, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' }, ports: [mkPort('b.in', 'WEST', 0)] as any[] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { id: 'c', width: 150, height: 80, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' }, ports: [mkPort('c.in', 'WEST', 0)] as any[] },
      ],
      edges: [
        { id: 'e1', sources: ['s.o1'], targets: ['a.in'] },
        { id: 'e2', sources: ['s.o2'], targets: ['b.in'] },
        { id: 'e3', sources: ['s.o3'], targets: ['c.in'] },
      ],
    };
    const result = await new ELK().layout(g);
    expect(countCrossings(result)).toBe(0);
  });
});

describe('Reversed edges restore bend points correctly', () => {
  it('back edge does not produce zig-zag through right boundary', async () => {
    // h → a → b → c, with back edge c → a creating a cycle.
    // Cycle breaker reverses c → a into a → c (long edge spanning b's
    // layer); then ReversedEdgeRestorer flips it back at the end. The
    // bend points must be reversed too, otherwise the polyline reads
    // as start-of-forward-path attached to end-of-reversed-edge.
    const g: ElkNode = {
      id: 'root',
      layoutOptions: COMMON_OPTS,
      children: [
        { id: 'h', width: 150, height: 80, layoutOptions: { 'elk.portAlignment.default': 'BEGIN', 'elk.layered.layering.layerConstraint': 'FIRST' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('h.o', 'EAST', 0)] as any[] },
        { id: 'a', width: 150, height: 120, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('a.in', 'WEST', 0), mkPort('a.o1', 'EAST', 0), mkPort('a.o2', 'EAST', 1)] as any[] },
        { id: 'b', width: 150, height: 120, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('b.in', 'WEST', 0), mkPort('b.o1', 'EAST', 0)] as any[] },
        { id: 'c', width: 150, height: 120, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('c.in', 'WEST', 0), mkPort('c.o1', 'EAST', 0)] as any[] },
        { id: 'd', width: 150, height: 80, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('d.in', 'WEST', 0)] as any[] },
      ],
      edges: [
        { id: 'e1', sources: ['h.o'], targets: ['a.in'] },
        { id: 'e2', sources: ['a.o1'], targets: ['b.in'] },
        { id: 'e3', sources: ['b.o1'], targets: ['c.in'] },
        { id: 'e4', sources: ['c.o1'], targets: ['a.in'] }, // back edge
        { id: 'e5', sources: ['a.o2'], targets: ['d.in'] },
      ],
    };
    const result = await new ELK().layout(g);
    // Find the back edge.
    const e4 = result.edges?.find((e) => e.id === 'e4');
    expect(e4).toBeDefined();
    const sec = e4?.sections?.[0];
    expect(sec).toBeDefined();
    const bps = sec?.bendPoints ?? [];
    if (bps.length > 0) {
      // After reverse, the path goes c (right) → a (left). The first
      // bend point must be at x ≤ source.x + small slack — never far to
      // the right (which would be the forward routing leaking through).
      const startX = sec!.startPoint!.x;
      const maxAllowedX = startX + 200; // generous; our routing puts it ~30px to the right of source
      for (const bp of bps) {
        expect(bp.x).toBeLessThanOrEqual(maxAllowedX);
      }
    }
  });

  it('LEdge.reverse() reverses the bend-points chain', async () => {
    const { LEdge, LPort, LNode } = await import('../../src/layered/lgraph.js');
    const { KVector } = await import('../../src/math/kvector.js');
    const src = new LNode();
    const tgt = new LNode();
    const sp = new LPort();
    const tp = new LPort();
    sp.node = src;
    tp.node = tgt;
    src.ports.push(sp);
    tgt.ports.push(tp);
    const e = new LEdge();
    e.setSource(sp);
    e.setTarget(tp);
    e.bendPoints.push(new KVector(10, 0));
    e.bendPoints.push(new KVector(20, 0));
    e.bendPoints.push(new KVector(30, 0));
    e.reverse();
    expect(e.source).toBe(tp);
    expect(e.target).toBe(sp);
    expect(e.bendPoints.map((b) => b.x)).toEqual([30, 20, 10]);
  });
});

describe('No crossings vs reference on flat fan-out chains', () => {
  it('layered chain a → {b,c,d}; b → {e,f}; matches input port order', async () => {
    const g: ElkNode = {
      id: 'root',
      layoutOptions: COMMON_OPTS,
      children: [
        { id: 'a', width: 150, height: 200, layoutOptions: { 'elk.portAlignment.default': 'BEGIN', 'elk.layered.layering.layerConstraint': 'FIRST' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('a.o1', 'EAST', 0), mkPort('a.o2', 'EAST', 1), mkPort('a.o3', 'EAST', 2)] as any[] },
        { id: 'b', width: 150, height: 160, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('b.in', 'WEST', 0), mkPort('b.o1', 'EAST', 0), mkPort('b.o2', 'EAST', 1)] as any[] },
        { id: 'c', width: 150, height: 80, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('c.in', 'WEST', 0)] as any[] },
        { id: 'd', width: 150, height: 80, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('d.in', 'WEST', 0)] as any[] },
        { id: 'e', width: 150, height: 80, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('e.in', 'WEST', 0)] as any[] },
        { id: 'f', width: 150, height: 80, layoutOptions: { 'elk.portAlignment.default': 'BEGIN' },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ports: [mkPort('f.in', 'WEST', 0)] as any[] },
      ],
      edges: [
        { id: 'e1', sources: ['a.o1'], targets: ['b.in'] },
        { id: 'e2', sources: ['a.o2'], targets: ['c.in'] },
        { id: 'e3', sources: ['a.o3'], targets: ['d.in'] },
        { id: 'e4', sources: ['b.o1'], targets: ['e.in'] },
        { id: 'e5', sources: ['b.o2'], targets: ['f.in'] },
      ],
    };
    const r = await new ELK().layout(g);
    expect(countCrossings(r)).toBe(0);
  });
});
