import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LongestPathLayerer } from '../../src/layered/phases/p2-longest-path-layerer.js';
import { LayerSizeAndGraphHeightCalculator } from '../../src/layered/intermediate/layer-size-and-graph-height-calculator.js';
import { PolylineEdgeRouter } from '../../src/layered/phases/p5-polyline-edge-router.js';
import { LayeredOptions } from '../../src/options/layered-options.js';
import { PortSide } from '../../src/options/enums.js';

describe('PolylineEdgeRouter', () => {
  it('lays out node x-coordinates per layer using inter-layer spacing', () => {
    const b = new TestGraphBuilder();
    b.graph.setProperty(LayeredOptions.SPACING_NODE_NODE_BETWEEN_LAYERS, 50);
    const a = b.createNode(40, 30);
    const c = b.createNode(40, 30);
    b.createEdge(b.createPort(a, PortSide.EAST), b.createPort(c, PortSide.WEST));

    LongestPathLayerer.process(b.graph);
    LayerSizeAndGraphHeightCalculator.process(b.graph);
    PolylineEdgeRouter.process(b.graph);

    expect(a.position.x).toBe(0);
    // Second layer starts at first layer's width + nodeSpacing + lane width
    // (max of label widths and per-edge track allocation). Default edge
    // spacing is 10, so a single-edge lane reserves (1+1)*10 = 20 for
    // tracks.
    expect(c.position.x).toBeGreaterThan(40 + 50);
    expect(b.graph.size.x).toBeGreaterThan(40 + 50 + 40);
  });
});
