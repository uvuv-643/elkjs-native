import { describe, expect, it } from 'vitest';
import { parseOptionValue, findProperty } from '../../src/options/parsers.js';
import { CoreOptions } from '../../src/options/core-options.js';
import { LayeredOptions } from '../../src/options/layered-options.js';

describe('parseOptionValue', () => {
  it('parses numeric options', () => {
    expect(parseOptionValue('elk.spacing.nodeNode', '50.0')).toBe(50);
    expect(parseOptionValue('elk.spacing.edgeNode', '20')).toBe(20);
  });

  it('parses boolean options', () => {
    expect(
      parseOptionValue('elk.layered.considerModelOrder.portModelOrder', 'true')
    ).toBe(true);
    expect(
      parseOptionValue('elk.layered.considerModelOrder.portModelOrder', 'false')
    ).toBe(false);
  });

  it('keeps enum-like strings as-is', () => {
    expect(parseOptionValue('elk.algorithm', 'layered')).toBe('layered');
    expect(parseOptionValue('elk.direction', 'RIGHT')).toBe('RIGHT');
    expect(
      parseOptionValue('elk.layered.nodePlacement.strategy', 'BRANDES_KOEPF')
    ).toBe('BRANDES_KOEPF');
  });

  it('parses port anchor "x,y" into an object', () => {
    expect(parseOptionValue('elk.port.anchor', '0,40')).toEqual({ x: 0, y: 40 });
  });

  it('keeps unknown options as raw strings', () => {
    expect(parseOptionValue('elk.unknown.thing', 'foo')).toBe('foo');
  });

  it('findProperty resolves both core and layered ids', () => {
    expect(findProperty('elk.algorithm')).toBe(CoreOptions.ALGORITHM);
    expect(findProperty('elk.layered.edgeRouting')).toBe(LayeredOptions.EDGE_ROUTING);
    expect(findProperty('elk.does.not.exist')).toBeUndefined();
  });
});
