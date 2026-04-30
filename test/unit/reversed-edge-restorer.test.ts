import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { ReversedEdgeRestorer } from '../../src/layered/intermediate/reversed-edge-restorer.js';
import { Layer } from '../../src/layered/lgraph.js';
import { InternalProperties } from '../../src/options/internal-properties.js';
import { PortSide } from '../../src/options/enums.js';

describe('ReversedEdgeRestorer', () => {
  it('reverses every edge marked REVERSED back to its original direction', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const z = b.createNode();
    const aPort = b.createPort(a, PortSide.EAST);
    const zPort = b.createPort(z, PortSide.WEST);
    // Pretend cycle breaker reversed an edge a -> z. After reversal it
    // appears as z -> a with REVERSED=true.
    const edge = b.createEdge(zPort, aPort);
    edge.setProperty(InternalProperties.REVERSED, true);

    // Put both nodes into a layer so the restorer iterates them.
    const layer = new Layer(b.graph);
    layer.nodes.push(a, z);
    a.layer = layer;
    z.layer = layer;
    b.graph.layers.push(layer);
    b.graph.layerlessNodes = [];

    ReversedEdgeRestorer.process(b.graph);

    expect(edge.source).toBe(aPort);
    expect(edge.target).toBe(zPort);
    expect(edge.getProperty(InternalProperties.REVERSED)).toBe(false);
  });
});
