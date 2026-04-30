import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { importGraph } from '../../src/layered/transform/elk-graph-importer.js';
import { CoreOptions } from '../../src/options/core-options.js';
import { Direction, PortSide } from '../../src/options/enums.js';
import { SPACINGS_KEY } from '../../src/options/spacings.js';

const here = dirname(fileURLToPath(import.meta.url));
const flowPath = join(here, '..', 'fixtures', 'user-flowchart.json');
const flow = JSON.parse(readFileSync(flowPath, 'utf8'));

describe('elk-graph-importer', () => {
  it('imports user-flowchart with the right shape', () => {
    const g = importGraph(structuredClone(flow));
    expect(g.layerlessNodes).toHaveLength(flow.children.length);
    // Per-node port counts.
    const portCounts = g.layerlessNodes.map((n) => n.ports.length);
    expect(portCounts).toEqual(flow.children.map((c: { ports?: unknown[] }) => c.ports?.length ?? 0));
  });

  it('defaults Direction to RIGHT when undefined', () => {
    const g = importGraph(structuredClone(flow));
    expect(g.getProperty(CoreOptions.DIRECTION)).toBe(Direction.RIGHT);
  });

  it('keeps explicit direction value', () => {
    const cloned = structuredClone(flow);
    cloned.layoutOptions['elk.direction'] = 'DOWN';
    const g = importGraph(cloned);
    expect(g.getProperty(CoreOptions.DIRECTION)).toBe(Direction.DOWN);
  });

  it('copies elk.port.side onto LPort.side', () => {
    const g = importGraph(structuredClone(flow));
    const n1 = g.layerlessNodes[0];
    expect(n1.ports[0].side).toBe(PortSide.EAST);
    const n3 = g.layerlessNodes[2];
    expect(n3.ports[0].side).toBe(PortSide.WEST);
  });

  it('attaches a Spacings bundle on the graph', () => {
    const g = importGraph(structuredClone(flow));
    const sp = g.getProperty(SPACINGS_KEY);
    expect(sp).toBeDefined();
    // user-flowchart sets nodeNode=50.0
    expect(sp!.nodeNodeSpacing).toBe(50);
  });

  it('applies elk.padding default (12) onto LGraph.padding', () => {
    const g = importGraph(structuredClone(flow));
    expect(g.padding.top).toBe(12);
    expect(g.padding.left).toBe(12);
    expect(g.padding.bottom).toBe(12);
    expect(g.padding.right).toBe(12);
  });
});
