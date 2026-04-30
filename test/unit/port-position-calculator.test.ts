/**
 * Unit tests for {@link PortPositionCalculator}.
 *
 * The calculator is opt-in (not in the default pipeline yet) — these
 * tests drive it directly off a small layered graph.
 */
import { describe, expect, it } from 'vitest';
import { TestGraphBuilder } from '../../src/test-utils/test-graph-builder.js';
import { LongestPathLayerer } from '../../src/layered/phases/p2-longest-path-layerer.js';
import { PortPositionCalculator } from '../../src/layered/intermediate/port-position-calculator.js';
import { PortAlignment, PortSide } from '../../src/options/enums.js';
import { CoreOptions } from '../../src/options/core-options.js';
import { LPort } from '../../src/layered/lgraph.js';

describe('PortPositionCalculator', () => {
  it('distributes 3 EAST ports along the right side using JUSTIFIED alignment', () => {
    const b = new TestGraphBuilder();
    const node = b.createNode();
    node.size.x = 100;
    node.size.y = 90;
    node.setProperty(CoreOptions.PORT_ALIGNMENT_DEFAULT, PortAlignment.JUSTIFIED);
    for (let i = 0; i < 3; i++) {
      const p = new LPort();
      p.side = PortSide.EAST;
      p.size.x = 0;
      p.size.y = 0;
      p.node = node;
      node.ports.push(p);
    }
    LongestPathLayerer.process(b.graph);
    PortPositionCalculator.process(b.graph);

    const ys = node.ports.map((p) => p.position.y);
    // JUSTIFIED with 3 zero-size ports & 0 spacing-default: ports
    // distributed evenly with no end gap → positions 0, 45, 90.
    expect(ys[0]).toBeCloseTo(0);
    expect(ys[2]).toBeCloseTo(90, 0);
    expect(node.ports.every((p) => p.position.x === 100)).toBe(true);
  });

  it('skips ports that already have an explicit anchor', () => {
    const b = new TestGraphBuilder();
    const node = b.createNode();
    node.size.x = 100;
    node.size.y = 100;
    const p = new LPort();
    p.side = PortSide.EAST;
    p.position.x = 100;
    p.position.y = 42; // user-set
    p.node = node;
    node.ports.push(p);
    LongestPathLayerer.process(b.graph);
    PortPositionCalculator.process(b.graph);
    // y must stay at 42, not get re-distributed.
    expect(p.position.y).toBe(42);
  });

  it('BEGIN alignment stacks ports flush to the start of the side', () => {
    const b = new TestGraphBuilder();
    const node = b.createNode();
    node.size.x = 100;
    node.size.y = 200;
    node.setProperty(CoreOptions.PORT_ALIGNMENT_DEFAULT, PortAlignment.BEGIN);
    for (let i = 0; i < 3; i++) {
      const p = new LPort();
      p.side = PortSide.WEST;
      p.size.x = 0;
      p.size.y = 0;
      p.node = node;
      node.ports.push(p);
    }
    LongestPathLayerer.process(b.graph);
    PortPositionCalculator.process(b.graph);
    expect(node.ports[0].position.y).toBeCloseTo(0);
  });
});
