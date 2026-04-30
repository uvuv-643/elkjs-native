/**
 * 2D vector with mutable x/y, mirrors `org.eclipse.elk.core.math.KVector`.
 */
export class KVector {
  x: number;
  y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  /** Mutates this vector by adding `other`. Returns `this` for chaining. */
  add(other: { x: number; y: number }): KVector {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  /** Mutates this vector by subtracting `other`. Returns `this`. */
  sub(other: { x: number; y: number }): KVector {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  /** Mutates this vector by scaling by `s`. Returns `this`. */
  scale(s: number): KVector {
    this.x *= s;
    this.y *= s;
    return this;
  }

  /** Euclidean length. */
  length(): number {
    return Math.hypot(this.x, this.y);
  }

  /** Returns a new independent copy. */
  clone(): KVector {
    return new KVector(this.x, this.y);
  }

  /** Mutating reset. */
  reset(x = 0, y = 0): KVector {
    this.x = x;
    this.y = y;
    return this;
  }

  toString(): string {
    return `(${this.x},${this.y})`;
  }
}

/**
 * Ordered chain of {@link KVector} (used for edge bend points).
 */
export class KVectorChain extends Array<KVector> {
  /** Returns a deep copy of the chain. */
  clone(): KVectorChain {
    const c = new KVectorChain();
    for (const v of this) c.push(v.clone());
    return c;
  }
}
