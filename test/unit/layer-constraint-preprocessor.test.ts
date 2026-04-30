import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LayerConstraintPreprocessor } from '../../src/layered/intermediate/layer-constraint-preprocessor.js';
import { LayerConstraint } from '../../src/options/enums.js';
import { LayeredOptions } from '../../src/options/layered-options.js';
import { InternalProperties } from '../../src/options/internal-properties.js';

describe('LayerConstraintPreprocessor', () => {
  it('hides FIRST_SEPARATE nodes and stores them on the graph', () => {
    const b = new TestGraphBuilder();
    const sep = b.createNode();
    sep.setProperty(
      LayeredOptions.LAYERING_LAYER_CONSTRAINT,
      LayerConstraint.FIRST_SEPARATE
    );
    const other = b.createNode();
    const e = b.createEdge(sep, other);
    LayerConstraintPreprocessor.process(b.graph);
    expect(b.graph.layerlessNodes).not.toContain(sep);
    expect(b.graph.layerlessNodes).toContain(other);
    expect(b.graph.getProperty(InternalProperties.HIDDEN_NODES)).toContain(sep);
    // The edge went sep → other; we hid sep, so its target was detached.
    expect(e.target).toBeNull();
    expect(e.getProperty(InternalProperties.ORIGINAL_OPPOSITE_PORT)).toBeDefined();
  });

  it('does nothing for plain FIRST nodes', () => {
    const b = new TestGraphBuilder();
    const head = b.createNode();
    head.setProperty(LayeredOptions.LAYERING_LAYER_CONSTRAINT, LayerConstraint.FIRST);
    const other = b.createNode();
    b.createEdge(head, other);
    LayerConstraintPreprocessor.process(b.graph);
    expect(b.graph.layerlessNodes).toContain(head);
    expect(b.graph.layerlessNodes).toContain(other);
  });
});
