import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { EdgeAndLayerConstraintEdgeReverser } from '../../src/layered/intermediate/edge-and-layer-constraint-edge-reverser.js';
import { EdgeConstraint, LayerConstraint } from '../../src/options/enums.js';
import { LayeredOptions } from '../../src/options/layered-options.js';
import { InternalProperties } from '../../src/options/internal-properties.js';

describe('EdgeAndLayerConstraintEdgeReverser', () => {
  it('reverses incoming edges of a FIRST node so it has only outgoing ones', () => {
    const b = new TestGraphBuilder();
    const head = b.createNode();
    head.setProperty(LayeredOptions.LAYERING_LAYER_CONSTRAINT, LayerConstraint.FIRST);
    const other = b.createNode();
    const e = b.createEdge(other, head);
    EdgeAndLayerConstraintEdgeReverser.process(b.graph);
    expect(e.getProperty(InternalProperties.REVERSED)).toBe(true);
    expect(head.getProperty(InternalProperties.EDGE_CONSTRAINT)).toBe(
      EdgeConstraint.OUTGOING_ONLY
    );
    expect(e.source?.node).toBe(head);
    expect(e.target?.node).toBe(other);
  });

  it('reverses outgoing edges of a LAST node', () => {
    const b = new TestGraphBuilder();
    const tail = b.createNode();
    tail.setProperty(LayeredOptions.LAYERING_LAYER_CONSTRAINT, LayerConstraint.LAST);
    const other = b.createNode();
    const e = b.createEdge(tail, other);
    EdgeAndLayerConstraintEdgeReverser.process(b.graph);
    expect(e.getProperty(InternalProperties.REVERSED)).toBe(true);
    expect(tail.getProperty(InternalProperties.EDGE_CONSTRAINT)).toBe(
      EdgeConstraint.INCOMING_ONLY
    );
  });

  it('does nothing if node has no layer constraint', () => {
    const b = new TestGraphBuilder();
    const a = b.createNode();
    const c = b.createNode();
    const e = b.createEdge(a, c);
    EdgeAndLayerConstraintEdgeReverser.process(b.graph);
    expect(e.getProperty(InternalProperties.REVERSED)).toBe(false);
  });
});
