/**
 * End-to-end tests for `OrthogonalEdgeRouter` (selected via
 * `elk.layered.edgeRouting = ORTHOGONAL`).
 */
import { describe, expect, it } from 'vitest';
import { ELK } from '../../src/index.js';
import type { ElkExtendedEdge, ElkNode, ElkPoint } from '../../src/graph/elk-types.js';

function isAxisAligned(p1: ElkPoint, p2: ElkPoint): boolean {
  const TOL = 1e-6;
  return Math.abs(p1.x - p2.x) < TOL || Math.abs(p1.y - p2.y) < TOL;
}

function* allPoints(edge: ElkExtendedEdge): IterableIterator<ElkPoint> {
  for (const sec of edge.sections ?? []) {
    if (sec.startPoint) yield sec.startPoint;
    for (const bp of sec.bendPoints ?? []) yield bp;
    if (sec.endPoint) yield sec.endPoint;
  }
}

describe('OrthogonalEdgeRouter', () => {
  it('produces only axis-aligned segments', async () => {
    const graph: ElkNode = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.layered.edgeRouting': 'ORTHOGONAL',
        'elk.layered.crossingMinimization.strategy': 'NONE',
        'elk.spacing.nodeNode': '50',
      },
      children: [
        { id: 's', width: 100, height: 80,
          ports: [
            { id: 's.o1', layoutOptions: { 'elk.port.side': 'EAST', 'elk.port.index': '0', 'elk.port.anchor': '0,30' } },
            { id: 's.o2', layoutOptions: { 'elk.port.side': 'EAST', 'elk.port.index': '1', 'elk.port.anchor': '0,60' } },
          ],
        },
        { id: 't1', width: 100, height: 60, ports: [{ id: 't1.in', layoutOptions: { 'elk.port.side': 'WEST', 'elk.port.anchor': '0,30' } }] },
        { id: 't2', width: 100, height: 60, ports: [{ id: 't2.in', layoutOptions: { 'elk.port.side': 'WEST', 'elk.port.anchor': '0,30' } }] },
      ],
      edges: [
        { id: 'e1', sources: ['s.o1'], targets: ['t1.in'] },
        { id: 'e2', sources: ['s.o2'], targets: ['t2.in'] },
      ],
    };
    const r = await new ELK().layout(graph);
    for (const e of r.edges ?? []) {
      const pts = [...allPoints(e)];
      for (let i = 1; i < pts.length; i++) {
        expect(isAxisAligned(pts[i - 1], pts[i])).toBe(true);
      }
    }
  });

  it('falls back to single straight segment when source y == target y', async () => {
    const graph: ElkNode = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.layered.edgeRouting': 'ORTHOGONAL',
        'elk.layered.crossingMinimization.strategy': 'NONE',
      },
      children: [
        { id: 'a', width: 100, height: 60, ports: [{ id: 'a.o', layoutOptions: { 'elk.port.side': 'EAST', 'elk.port.anchor': '0,30' } }] },
        { id: 'b', width: 100, height: 60, ports: [{ id: 'b.i', layoutOptions: { 'elk.port.side': 'WEST', 'elk.port.anchor': '0,30' } }] },
      ],
      edges: [
        { id: 'e', sources: ['a.o'], targets: ['b.i'] },
      ],
    };
    const r = await new ELK().layout(graph);
    const e = r.edges![0];
    expect(e.sections?.[0].bendPoints?.length ?? 0).toBe(0);
  });
});
