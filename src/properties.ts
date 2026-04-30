/**
 * Typed property key, mirrors `org.eclipse.elk.graph.properties.IProperty<T>`.
 *
 * Identity is defined by {@link id}. Two `IProperty` instances with the same
 * id refer to the same logical property.
 */
export interface IProperty<T> {
  readonly id: string;
  readonly defaultValue: T;
  readonly lowerBound?: T;
  readonly upperBound?: T;
}

/** Convenience factory. */
export function property<T>(
  id: string,
  defaultValue: T,
  lowerBound?: T,
  upperBound?: T
): IProperty<T> {
  return { id, defaultValue, lowerBound, upperBound };
}

/**
 * Carrier of typed properties. Mirrors `IPropertyHolder` from ELK.
 *
 * Internally backed by a `Map<string, unknown>` keyed by property id.
 */
export class PropertyHolder {
  private readonly props = new Map<string, unknown>();

  /** Sets the property; pass `undefined` to unset. */
  setProperty<T>(p: IProperty<T>, value: T | undefined): this {
    if (value === undefined) {
      this.props.delete(p.id);
    } else {
      this.props.set(p.id, value);
    }
    return this;
  }

  /**
   * Returns the property value, or {@link IProperty.defaultValue} if not set.
   *
   * Note: behaves like ELK's `getProperty` — explicit `null`/`undefined` stored
   * values are not distinguished from "unset".
   */
  getProperty<T>(p: IProperty<T>): T {
    const v = this.props.get(p.id);
    return v === undefined ? p.defaultValue : (v as T);
  }

  /** True if a value (including non-default) was set. */
  hasProperty<T>(p: IProperty<T>): boolean {
    return this.props.has(p.id);
  }

  /** Copy all properties from `other` (overwrites existing keys). */
  copyProperties(other: PropertyHolder): this {
    for (const [k, v] of other.props) this.props.set(k, v);
    return this;
  }

  /** Internal: raw access by id (used by importer/exporter). */
  setRawProperty(id: string, value: unknown): void {
    if (value === undefined) this.props.delete(id);
    else this.props.set(id, value);
  }

  /** Internal: raw access by id. */
  getRawProperty(id: string): unknown {
    return this.props.get(id);
  }

  /** Iteration over (id, value) pairs. */
  allProperties(): IterableIterator<[string, unknown]> {
    return this.props.entries();
  }
}
