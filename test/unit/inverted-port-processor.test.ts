import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LongestPathLayerer } from '../../src/layered/phases/p2-longest-path-layerer.js';
import { InvertedPortProcessor } from '../../src/layered/intermediate/inverted-port-processor.js';
import { NodeType } from '../../src/layered/lgraph.js';
import { CoreOptions } from '../../src/options/core-options.js';
import { PortConstraints, PortSide } from '../../src/options/enums.js';

describe('InvertedPortProcessor', () => {
  it('inserts a dummy for an INPUT port placed on the EAST side', () => {
    const b = new TestGraphBuilder();
    const src = b.createNode();
    const tgt = b.createNode();
    tgt.setProperty(CoreOptions.PORT_CONSTRAINTS, PortConstraints.FIXED_ORDER);
    const srcPort = b.createPort(src, PortSide.EAST);
    const eastInputPort = b.createPort(tgt, PortSide.EAST); // inverted
    b.createEdge(srcPort, eastInputPort);
    LongestPathLayerer.process(b.graph);

    const beforeLayerCount = b.graph.layers.length;
    InvertedPortProcessor.process(b.graph);
    expect(b.graph.layers.length).toBe(beforeLayerCount);

    // Target layer should now contain a LONG_EDGE dummy.
    const dummiesInTgtLayer = tgt.layer!.nodes.filter(
      (n) => n.type === NodeType.LONG_EDGE
    );
    expect(dummiesInTgtLayer.length).toBe(1);
  });

  it('skips nodes without fixed port sides', () => {
    const b = new TestGraphBuilder();
    const src = b.createNode();
    const tgt = b.createNode();
    // PORT_CONSTRAINTS stays UNDEFINED → not side-fixed.
    const srcPort = b.createPort(src, PortSide.EAST);
    const eastInput = b.createPort(tgt, PortSide.EAST);
    b.createEdge(srcPort, eastInput);
    LongestPathLayerer.process(b.graph);
    InvertedPortProcessor.process(b.graph);

    const dummies = tgt.layer!.nodes.filter((n) => n.type === NodeType.LONG_EDGE);
    expect(dummies.length).toBe(0);
  });
});
