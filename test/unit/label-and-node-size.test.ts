import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LongestPathLayerer } from '../../src/layered/phases/p2-longest-path-layerer.js';
import { LabelAndNodeSizeProcessor } from '../../src/layered/intermediate/label-and-node-size-processor.js';
import { CoreOptions } from '../../src/options/core-options.js';

describe('LabelAndNodeSizeProcessor', () => {
  it('respects nodeSize.minimum', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode(10, 5);
    n.setProperty(CoreOptions.NODE_SIZE_MINIMUM, { width: 50, height: 40 });
    LongestPathLayerer.process(b.graph);
    LabelAndNodeSizeProcessor.process(b.graph);
    expect(n.size.x).toBe(50);
    expect(n.size.y).toBe(40);
  });

  it('grows the node to fit its label', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode(10, 10);
    b.createLabel(n, 'hello', 80, 20);
    LongestPathLayerer.process(b.graph);
    LabelAndNodeSizeProcessor.process(b.graph);
    expect(n.size.x).toBeGreaterThanOrEqual(80);
    expect(n.size.y).toBeGreaterThanOrEqual(20);
  });

  it('centres the label inside the node', () => {
    const b = new TestGraphBuilder();
    const n = b.createNode(100, 50);
    const lbl = b.createLabel(n, 'x', 20, 10);
    LongestPathLayerer.process(b.graph);
    LabelAndNodeSizeProcessor.process(b.graph);
    expect(lbl.position.x).toBe(40); // (100 - 20) / 2
    expect(lbl.position.y).toBe(20); // (50 - 10) / 2
  });
});
