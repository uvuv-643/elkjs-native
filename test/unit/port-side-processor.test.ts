import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { PortSideProcessor } from '../../src/layered/intermediate/port-side-processor.js';
import { PortConstraints, PortSide } from '../../src/options/enums.js';
import { CoreOptions } from '../../src/options/core-options.js';

describe('PortSideProcessor', () => {
  it('puts pure-output ports on the EAST side', () => {
    const b = new TestGraphBuilder();
    const src = b.createNode();
    const tgt = b.createNode();
    const out = b.createPort(src);
    const inp = b.createPort(tgt);
    b.createEdge(out, inp);
    PortSideProcessor.process(b.graph);
    expect(out.side).toBe(PortSide.EAST);
    expect(inp.side).toBe(PortSide.WEST);
  });

  it('respects ports that already have a fixed side', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode();
    n.setProperty(CoreOptions.PORT_CONSTRAINTS, PortConstraints.FIXED_SIDE);
    const p = b.createPort(n, PortSide.NORTH);
    PortSideProcessor.process(b.graph);
    expect(p.side).toBe(PortSide.NORTH);
  });

  it('promotes the port-constraint to FIXED_SIDE when distributing ports', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode();
    b.createPort(n);
    PortSideProcessor.process(b.graph);
    expect(n.getProperty(CoreOptions.PORT_CONSTRAINTS)).toBe(PortConstraints.FIXED_SIDE);
  });
});
