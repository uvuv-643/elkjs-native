import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LongestPathLayerer } from '../../src/layered/phases/p2-longest-path-layerer.js';
import { SortByInputModelOrder } from '../../src/layered/intermediate/sort-by-input-order-of-model.js';
import { LayeredOptions } from '../../src/options/layered-options.js';
import { OrderingStrategy } from '../../src/options/enums.js';
import { InternalProperties } from '../../src/options/internal-properties.js';

describe('SortByInputModelOrder', () => {
  it('is a no-op when strategy is NONE', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const c = b.createNode();
    a.setProperty(InternalProperties.MODEL_ORDER, 5);
    c.setProperty(InternalProperties.MODEL_ORDER, 1);
    LongestPathLayerer.process(b.graph);
    SortByInputModelOrder.process(b.graph);
    // Strategy default = NONE → original layer-insertion order kept.
    expect(b.graph.layers[0].nodes[0]).toBe(a);
  });

  it('sorts nodes within a layer by MODEL_ORDER ascending', () => {
    const b = new TestGraphBuilder();
    b.graph.setProperty(
      LayeredOptions.CONSIDER_MODEL_ORDER_STRATEGY,
      OrderingStrategy.PREFER_EDGES
    );
    const n1 = b.createNode();
    const n2 = b.createNode();
    const n3 = b.createNode();
    n1.setProperty(InternalProperties.MODEL_ORDER, 2);
    n2.setProperty(InternalProperties.MODEL_ORDER, 0);
    n3.setProperty(InternalProperties.MODEL_ORDER, 1);
    LongestPathLayerer.process(b.graph);
    SortByInputModelOrder.process(b.graph);
    expect(b.graph.layers[0].nodes).toEqual([n2, n3, n1]);
  });
});
