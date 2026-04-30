import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { PortListSorter } from '../../src/layered/intermediate/port-list-sorter.js';
import { PortConstraints, PortSide } from '../../src/options/enums.js';
import { CoreOptions } from '../../src/options/core-options.js';

describe('PortListSorter', () => {
  it('sorts ports clockwise: NORTH → EAST → SOUTH → WEST', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode();
    n.setProperty(CoreOptions.PORT_CONSTRAINTS, PortConstraints.FIXED_SIDE);
    const w = b.createPort(n, PortSide.WEST);
    const s = b.createPort(n, PortSide.SOUTH);
    const e = b.createPort(n, PortSide.EAST);
    const north = b.createPort(n, PortSide.NORTH);
    PortListSorter.process(b.graph);
    expect(n.ports).toEqual([north, e, s, w]);
  });

  it('respects PORT_INDEX under FIXED_ORDER', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode();
    n.setProperty(CoreOptions.PORT_CONSTRAINTS, PortConstraints.FIXED_ORDER);
    const p2 = b.createPort(n, PortSide.EAST);
    p2.setProperty(CoreOptions.PORT_INDEX, 2);
    const p0 = b.createPort(n, PortSide.EAST);
    p0.setProperty(CoreOptions.PORT_INDEX, 0);
    const p1 = b.createPort(n, PortSide.EAST);
    p1.setProperty(CoreOptions.PORT_INDEX, 1);
    PortListSorter.process(b.graph);
    expect(n.ports).toEqual([p0, p1, p2]);
  });

  it('leaves nodes with FREE constraints alone', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode();
    const p1 = b.createPort(n, PortSide.WEST);
    const p2 = b.createPort(n, PortSide.NORTH);
    PortListSorter.process(b.graph);
    expect(n.ports).toEqual([p1, p2]);
  });
});
