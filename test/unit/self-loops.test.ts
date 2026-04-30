/**
 * End-to-end tests for self-loop edges.
 *
 * Self-loops are edges whose source and target node are the same. The
 * MVP polyline router skipped them entirely; the new
 * `SelfLoopRouter` (an after-P5 processor) draws a 3-bend polyline
 * that hugs the node's right (or left) side.
 */
import { describe, expect, it } from 'vitest';
import { ELK } from '../../src/index.js';
import type { ElkNode } from '../../src/graph/elk-types.js';

describe('Self-loops', () => {
  it('routes a single self-loop with three bend points', async () => {
    const g: ElkNode = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.layered.edgeRouting': 'POLYLINE',
        'elk.layered.crossingMinimization.strategy': 'NONE',
        'elk.spacing.nodeNode': '50',
      },
      children: [
        { id: 'a', width: 80, height: 60,
          ports: [
            { id: 'a.out', layoutOptions: { 'elk.port.side': 'EAST' } },
            { id: 'a.in', layoutOptions: { 'elk.port.side': 'EAST' } },
          ],
        },
      ],
      edges: [
        { id: 'loop', sources: ['a.out'], targets: ['a.in'] },
      ],
    };
    const r = await new ELK().layout(g);
    const e = r.edges?.find((x) => x.id === 'loop');
    expect(e).toBeDefined();
    expect(e?.sections?.length).toBe(1);
    const sec = e?.sections?.[0];
    expect(sec?.startPoint).toBeDefined();
    expect(sec?.endPoint).toBeDefined();
    expect(sec?.bendPoints?.length).toBe(3);
    // All bend points should sit to the right of the node.
    const a = r.children!.find((c) => c.id === 'a')!;
    const nodeRight = (a.x ?? 0) + (a.width ?? 0);
    for (const bp of sec?.bendPoints ?? []) {
      expect(bp.x).toBeGreaterThanOrEqual(nodeRight - 1e-6);
    }
  });

  it('does not interfere with non-loop edges', async () => {
    const g: ElkNode = {
      id: 'root',
      layoutOptions: {
        'elk.algorithm': 'layered',
        'elk.layered.edgeRouting': 'POLYLINE',
        'elk.layered.crossingMinimization.strategy': 'NONE',
      },
      children: [
        { id: 'a', width: 80, height: 60, ports: [
          { id: 'a.out', layoutOptions: { 'elk.port.side': 'EAST' } },
          { id: 'a.in', layoutOptions: { 'elk.port.side': 'EAST' } },
        ]},
        { id: 'b', width: 80, height: 60, ports: [
          { id: 'b.in', layoutOptions: { 'elk.port.side': 'WEST' } },
        ]},
      ],
      edges: [
        { id: 'loop', sources: ['a.out'], targets: ['a.in'] },
        { id: 'normal', sources: ['a.out'], targets: ['b.in'] },
      ],
    };
    const r = await new ELK().layout(g);
    const normal = r.edges?.find((x) => x.id === 'normal');
    expect(normal?.sections?.length).toBe(1);
    const loop = r.edges?.find((x) => x.id === 'loop');
    expect(loop?.sections?.length).toBe(1);
  });
});
