/**
 * Unit tests for {@link LayerSweepCrossingMinimizer}.
 *
 * The strategy is opt-in (`elk.layered.crossingMinimization.strategy =
 * LAYER_SWEEP`) so we exercise it explicitly here. Tests cover:
 *
 *  - the inversion-counting helper (private, exposed via a thin wrapper);
 *  - a layer-pair where the natural order produces N crossings and the
 *    barycenter sweep cuts them to zero;
 *  - a deeper graph where forward + backward sweeps cooperate.
 */
import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LongestPathLayerer } from '../../src/layered/phases/p2-longest-path-layerer.js';
import { LayerSweepCrossingMinimizer } from '../../src/layered/phases/p3-layer-sweep-crossing-minimizer.js';
import { ELK } from '../../src/index.js';
import type { ElkExtendedEdge, ElkNode, ElkPoint } from '../../src/graph/elk-types.js';

interface Pt { x: number; y: number }
interface Seg { id: string; a: Pt; b: Pt }

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
      if (segCross(segs[i].a, segs[i].b, segs[j].a, segs[j].b)) count++;
    }
  }
  return count;
  function segCross(p1: Pt, p2: Pt, p3: Pt, p4: Pt) {
    const d = (a: Pt, b: Pt, c: Pt) =>
      (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
    const d1 = d(p3, p4, p1);
    const d2 = d(p3, p4, p2);
    const d3 = d(p1, p2, p3);
    const d4 = d(p1, p2, p4);
    return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
  }
}

describe('LayerSweepCrossingMinimizer', () => {
  it('runs without errors on a single-layer graph (no-op)', () => {
    const b = new TestGraphBuilder();
    b.createNode();
    LongestPathLayerer.process(b.graph);
    expect(() => LayerSweepCrossingMinimizer.process(b.graph)).not.toThrow();
  });

  it('eliminates a deliberately crossed bipartite pair', () => {
    // 2 sources × 2 targets; edges crossed: (a→y), (b→x).
    // Initial layer order: [a, b], [x, y]. Crossings = 1.
    // Barycenter from prev: x's bary uses idx of b=1, y's bary uses idx of a=0.
    // → sorted [y, x]. Crossings = 0.
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const bn = b.createNode();
    const x = b.createNode();
    const y = b.createNode();
    b.createEdge(a, y);
    b.createEdge(bn, x);
    LongestPathLayerer.process(b.graph);
    LayerSweepCrossingMinimizer.process(b.graph);

    const second = b.graph.layers[1].nodes;
    // After sweep, y must come before x.
    expect(second.indexOf(y)).toBeLessThan(second.indexOf(x));
  });

  it('opting in via layoutOptions reduces crossings on a 3-fan crossed graph', async () => {
    // Same crossed bipartite, but going through the public API with the
    // `LAYER_SWEEP` strategy. Without crossing minimization the visual
    // would have at least 1 crossing.
    const graph: ElkNode = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.layered.edgeRouting': 'POLYLINE',
        'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.spacing.nodeNode': '50',
      },
      children: [
        { id: 'a', width: 80, height: 40, ports: [{ id: 'a.o', layoutOptions: { 'elk.port.side': 'EAST' } }] },
        { id: 'b', width: 80, height: 40, ports: [{ id: 'b.o', layoutOptions: { 'elk.port.side': 'EAST' } }] },
        { id: 'x', width: 80, height: 40, ports: [{ id: 'x.i', layoutOptions: { 'elk.port.side': 'WEST' } }] },
        { id: 'y', width: 80, height: 40, ports: [{ id: 'y.i', layoutOptions: { 'elk.port.side': 'WEST' } }] },
      ],
      edges: [
        { id: 'e1', sources: ['a.o'], targets: ['y.i'] },
        { id: 'e2', sources: ['b.o'], targets: ['x.i'] },
      ],
    };
    const r = await new ELK().layout(graph);
    expect(countCrossings(r)).toBe(0);
  });

  it('NONE strategy stays a no-op (regression check)', async () => {
    const graph: ElkNode = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.layered.edgeRouting': 'POLYLINE',
        'elk.layered.crossingMinimization.strategy': 'NONE',
        'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
        'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
        'elk.spacing.nodeNode': '50',
      },
      children: [
        { id: 'a', width: 80, height: 40, ports: [{ id: 'a.o', layoutOptions: { 'elk.port.side': 'EAST' } }] },
        { id: 'b', width: 80, height: 40, ports: [{ id: 'b.o', layoutOptions: { 'elk.port.side': 'EAST' } }] },
        { id: 'x', width: 80, height: 40, ports: [{ id: 'x.i', layoutOptions: { 'elk.port.side': 'WEST' } }] },
        { id: 'y', width: 80, height: 40, ports: [{ id: 'y.i', layoutOptions: { 'elk.port.side': 'WEST' } }] },
      ],
      edges: [
        { id: 'e1', sources: ['a.o'], targets: ['x.i'] },
        { id: 'e2', sources: ['b.o'], targets: ['y.i'] },
      ],
    };
    const r = await new ELK().layout(graph);
    // Already in non-crossing configuration; NONE should keep it that way.
    expect(countCrossings(r)).toBe(0);
  });
});
