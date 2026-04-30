import { describe, expect, it } from 'vitest';
import { KVector, KVectorChain } from '../../src/math/kvector.js';

describe('KVector', () => {
  it('add/sub/scale mutate and chain', () => {
    const v = new KVector(1, 2);
    v.add({ x: 3, y: 4 }).sub({ x: 1, y: 1 }).scale(2);
    expect(v.x).toBe(6);
    expect(v.y).toBe(10);
  });

  it('length is Euclidean', () => {
    expect(new KVector(3, 4).length()).toBe(5);
  });

  it('clone is independent', () => {
    const v = new KVector(1, 2);
    const c = v.clone();
    c.x = 99;
    expect(v.x).toBe(1);
  });
});

describe('KVectorChain', () => {
  it('clone deep-copies elements', () => {
    const c = new KVectorChain();
    c.push(new KVector(1, 2), new KVector(3, 4));
    const d = c.clone();
    d[0].x = 99;
    expect(c[0].x).toBe(1);
    expect(d.length).toBe(2);
  });
});
