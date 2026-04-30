/**
 * End-to-end test: every edge segment of every routed edge must be either
 * horizontal (Δy ≈ 0) or vertical (Δx ≈ 0). No diagonal/sloped lines.
 */
import { describe, it, expect } from 'vitest';
import { ELK } from '../../src/index.js';
import type { ElkExtendedEdge, ElkNode, ElkPoint } from '../../src/graph/elk-types.js';

const TOL = 1e-6;

function isOrthogonal(p1: ElkPoint, p2: ElkPoint): boolean {
  const dx = Math.abs(p1.x - p2.x);
  const dy = Math.abs(p1.y - p2.y);
  return dx < TOL || dy < TOL;
}

function* allPoints(edge: ElkExtendedEdge): IterableIterator<ElkPoint> {
  for (const section of edge.sections ?? []) {
    if (section.startPoint) yield section.startPoint;
    for (const bp of section.bendPoints ?? []) yield bp;
    if (section.endPoint) yield section.endPoint;
  }
}

function checkOrthogonality(graph: ElkNode): { edge: string; segment: [ElkPoint, ElkPoint] }[] {
  const violations: { edge: string; segment: [ElkPoint, ElkPoint] }[] = [];
  for (const e of graph.edges ?? []) {
    const pts = [...allPoints(e)];
    for (let i = 1; i < pts.length; i++) {
      if (!isOrthogonal(pts[i - 1], pts[i])) {
        violations.push({ edge: e.id, segment: [pts[i - 1], pts[i]] });
      }
    }
  }
  return violations;
}

function buildSimpleGraph(): ElkNode {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.layered.edgeRouting': 'POLYLINE',
      'elk.layered.crossingMinimization.strategy': 'NONE',
      'elk.layered.considerModelOrder.strategy': 'PREFER_EDGES',
      'elk.spacing.nodeNode': '50',
      'elk.layered.spacing.nodeNodeBetweenLayers': '20',
    },
    children: [
      { id: 'a', width: 100, height: 60,
        ports: [{ id: 'a.out', layoutOptions: { 'elk.port.side': 'EAST' } }] },
      { id: 'b', width: 100, height: 60,
        ports: [{ id: 'b.in', layoutOptions: { 'elk.port.side': 'WEST' } }] },
      { id: 'c', width: 100, height: 60,
        ports: [{ id: 'c.in', layoutOptions: { 'elk.port.side': 'WEST' } }] },
      { id: 'd', width: 100, height: 60,
        ports: [{ id: 'd.in', layoutOptions: { 'elk.port.side': 'WEST' } }] },
    ],
    edges: [
      { id: 'e1', sources: ['a.out'], targets: ['b.in'] },
      { id: 'e2', sources: ['a.out'], targets: ['c.in'] },
      { id: 'e3', sources: ['a.out'], targets: ['d.in'] },
    ],
  };
}

function buildBigGraph(): ElkNode {
  // 50 nodes in a wide fan-out: source connects to 49 sinks, each at a
  // different y. Forces lots of orthogonal routing.
  const sinks = Array.from({ length: 49 }, (_, i) => ({
    id: `sink${i}`,
    width: 280,
    height: 60,
    ports: [
      {
        id: `sink${i}.in`,
        layoutOptions: { 'elk.port.side': 'WEST', 'elk.port.anchor': '0,30' },
      },
    ],
  }));
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.layered.edgeRouting': 'POLYLINE',
      'elk.layered.crossingMinimization.strategy': 'NONE',
      'elk.spacing.nodeNode': '50',
    },
    children: [
      {
        id: 'src',
        width: 280,
        height: 60,
        ports: sinks.map((s, i) => ({
          id: `src.out${i}`,
          layoutOptions: { 'elk.port.side': 'EAST', 'elk.port.anchor': '0,30' },
        })),
      },
      ...sinks,
    ],
    edges: sinks.map((s, i) => ({
      id: `e${i}`,
      sources: [`src.out${i}`],
      targets: [`${s.id}.in`],
    })),
  };
}

describe('Edge orthogonality', () => {
  it('every segment of every edge is horizontal or vertical (small graph)', async () => {
    const elk = new ELK();
    const result = await elk.layout(buildSimpleGraph());
    const violations = checkOrthogonality(result);
    expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
  });

  it('every segment of every edge is horizontal or vertical (50-node fan-out)', async () => {
    const elk = new ELK();
    const result = await elk.layout(buildBigGraph());
    const violations = checkOrthogonality(result);
    expect(violations.length, JSON.stringify(violations.slice(0, 3), null, 2)).toBe(0);
  });

  it('every segment of every edge is horizontal or vertical (real user fixture)', async () => {
    const elk = new ELK();
    const fixture = await import('../fixtures/user-flowchart.json');
    const result = await elk.layout(structuredClone(fixture.default) as ElkNode);
    const violations = checkOrthogonality(result);
    expect(violations.length, JSON.stringify(violations.slice(0, 3), null, 2)).toBe(0);
  });
});

describe('Edge separation', () => {
  // The compact polyline router (matching Java ELK) routes every edge in
  // a lane through the same mid-x track. This is a deliberate visual
  // trade-off — edges merge along the lane and split toward their
  // targets, mirroring elkjs reference output. Per-edge tracks would
  // make every fan-out balloon to N×spacing wide.
  //
  // What we *do* require: middle-vertical segments don't escape their
  // lane (i.e. mid-x is between source-layer right and target-layer
  // left). That's an invariant the compact router preserves.
  it('every edge\'s middle vertical segment stays inside its lane', async () => {
    const elk = new ELK();
    const result = await elk.layout(buildBigGraph());
    const src = result.children?.find((c) => c.id === 'src');
    expect(src).toBeDefined();
    const sourceRight = (src!.x ?? 0) + (src!.width ?? 0);
    const t0 = result.children?.find((c) => c.id === 'sink0');
    const targetLeft = t0?.x ?? Number.POSITIVE_INFINITY;
    for (const e of result.edges ?? []) {
      const sec = e.sections?.[0];
      if (!sec?.bendPoints || sec.bendPoints.length < 2) continue;
      const x = sec.bendPoints[0].x;
      expect(x).toBeGreaterThanOrEqual(sourceRight);
      expect(x).toBeLessThanOrEqual(targetLeft);
    }
  });
});
