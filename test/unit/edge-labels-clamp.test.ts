/**
 * Edge labels must never overlap source/target node bounding boxes —
 * a regression test that became necessary once the polyline router
 * started compacting lanes (a wide label in a narrow lane used to
 * spill across cards).
 */
import { describe, expect, it } from 'vitest';
import { ELK } from '../../src/index.js';
import type { ElkNode } from '../../src/graph/elk-types.js';

function buildGraph(labelWidth: number): ElkNode {
  return {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.layered.edgeRouting': 'POLYLINE',
      'elk.layered.crossingMinimization.strategy': 'NONE',
      'elk.spacing.nodeNode': '30',
    },
    children: [
      { id: 'a', width: 80, height: 40, ports: [{ id: 'a.o', layoutOptions: { 'elk.port.side': 'EAST' } }] },
      { id: 'b', width: 80, height: 40, ports: [{ id: 'b.i', layoutOptions: { 'elk.port.side': 'WEST' } }] },
    ],
    edges: [
      {
        id: 'e',
        sources: ['a.o'],
        targets: ['b.i'],
        labels: [{ text: 'long-label', width: labelWidth, height: 14 }],
      },
    ],
  };
}

describe('Edge label clamping', () => {
  it('label stays inside the lane between two cards (small label)', async () => {
    const elk = new ELK();
    const r = await elk.layout(buildGraph(20));
    const a = r.children!.find((c) => c.id === 'a')!;
    const b = r.children!.find((c) => c.id === 'b')!;
    const e = r.edges![0];
    const lbl = (e.labels ?? [])[0]!;
    const aRight = (a.x ?? 0) + (a.width ?? 0);
    const bLeft = (b.x ?? 0);
    expect(lbl.x).toBeGreaterThanOrEqual(aRight);
    expect((lbl.x ?? 0) + (lbl.width ?? 0)).toBeLessThanOrEqual(bLeft);
  });

  it('lane widens to fit a long label so it never overlaps cards', async () => {
    const elk = new ELK();
    const r = await elk.layout(buildGraph(120));
    const a = r.children!.find((c) => c.id === 'a')!;
    const b = r.children!.find((c) => c.id === 'b')!;
    const e = r.edges![0];
    const lbl = (e.labels ?? [])[0]!;
    const aRight = (a.x ?? 0) + (a.width ?? 0);
    const bLeft = (b.x ?? 0);
    // Label must sit fully inside the lane between the two cards.
    expect(lbl.x).toBeGreaterThanOrEqual(aRight);
    expect((lbl.x ?? 0) + (lbl.width ?? 0)).toBeLessThanOrEqual(bLeft);
    // Lane must be wide enough for the label.
    expect(bLeft - aRight).toBeGreaterThanOrEqual(120);
  });
});
