import { describe, expect, it } from 'vitest';
import { property, PropertyHolder } from '../../src/properties.js';

describe('PropertyHolder', () => {
  const NUM = property<number>('test.num', 42);
  const STR = property<string>('test.str', 'def');

  it('returns default when not set', () => {
    const h = new PropertyHolder();
    expect(h.getProperty(NUM)).toBe(42);
    expect(h.getProperty(STR)).toBe('def');
    expect(h.hasProperty(NUM)).toBe(false);
  });

  it('stores and reads back values', () => {
    const h = new PropertyHolder();
    h.setProperty(NUM, 7);
    h.setProperty(STR, 'hi');
    expect(h.getProperty(NUM)).toBe(7);
    expect(h.getProperty(STR)).toBe('hi');
    expect(h.hasProperty(NUM)).toBe(true);
  });

  it('unsets property when value is undefined', () => {
    const h = new PropertyHolder();
    h.setProperty(NUM, 7);
    h.setProperty(NUM, undefined);
    expect(h.hasProperty(NUM)).toBe(false);
    expect(h.getProperty(NUM)).toBe(42);
  });

  it('copyProperties merges from another holder', () => {
    const a = new PropertyHolder();
    a.setProperty(NUM, 11);
    const b = new PropertyHolder();
    b.setProperty(STR, 'x');
    b.copyProperties(a);
    expect(b.getProperty(NUM)).toBe(11);
    expect(b.getProperty(STR)).toBe('x');
  });
});
