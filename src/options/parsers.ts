/**
 * Parses a single `layoutOptions` entry (always a string in JSON) to the
 * typed value expected by the corresponding {@link IProperty}.
 *
 * Resolution rules — kept simple:
 * - If the property's default is a number  → `parseFloat`.
 * - If the property's default is a boolean → `'true' | 'false'`.
 * - If the property's default is a string  → returned as-is.
 * - If the default is an enum-like string (one of a known enum object) →
 *   returned as-is (caller is responsible for knowing valid values).
 * - Special-cased ids: `elk.padding`, `elk.port.anchor`, `elk.nodeSize.minimum`,
 *   `elk.nodeSize.constraints`.
 *
 * Unknown ids (no matching property) are returned as the raw string — they
 * are stored as-is on the holder. ELK silently ignores unknown options
 * (see plan §3.4).
 */
import { CoreOptions } from './core-options.js';
import { LayeredOptions } from './layered-options.js';
import { IProperty } from '../properties.js';

const ALL_PROPS = (() => {
  const m = new Map<string, IProperty<unknown>>();
  for (const p of Object.values(CoreOptions)) m.set(p.id, p as IProperty<unknown>);
  for (const p of Object.values(LayeredOptions)) m.set(p.id, p as IProperty<unknown>);
  return m;
})();

/** Public: lookup property descriptor by id (covers core + layered). */
export function findProperty(id: string): IProperty<unknown> | undefined {
  return ALL_PROPS.get(id);
}

/** Parse a single `"top,left,bottom,right"` padding string. */
function parsePadding(raw: string): { top: number; left: number; bottom: number; right: number } {
  // ELK accepts either `top=12,left=12,...` or `12` (uniform).
  const trimmed = raw.trim();
  if (!isNaN(Number(trimmed))) {
    const n = Number(trimmed);
    return { top: n, left: n, bottom: n, right: n };
  }
  const out = { top: 12, left: 12, bottom: 12, right: 12 };
  for (const part of trimmed.split(/[\s,]+/)) {
    const m = part.match(/^(top|left|bottom|right)\s*=\s*([\d.+-eE]+)$/);
    if (m) (out as Record<string, number>)[m[1]] = Number(m[2]);
  }
  return out;
}

function parseAnchor(raw: string): { x: number; y: number } | undefined {
  const m = raw.match(/^\s*([\d.+-eE]+)\s*[, ]\s*([\d.+-eE]+)\s*$/);
  return m ? { x: Number(m[1]), y: Number(m[2]) } : undefined;
}

function parseSize(raw: string): { width: number; height: number } {
  const parts = raw.split(/[\s,()]+/).filter(Boolean).map(Number);
  return { width: parts[0] ?? 0, height: parts[1] ?? 0 };
}

/**
 * Coerces a string (or already-typed) value into the property's value type.
 * Returns the original value if no property descriptor is known.
 */
export function parseOptionValue(id: string, raw: unknown): unknown {
  const p = ALL_PROPS.get(id);
  if (p === undefined) return raw;
  if (typeof raw !== 'string') return raw; // already typed (numbers/booleans from JSON)

  // Special-cased ids:
  switch (id) {
    case 'elk.padding':
      return parsePadding(raw);
    case 'elk.port.anchor':
      return parseAnchor(raw);
    case 'elk.nodeSize.minimum':
      return parseSize(raw);
    case 'elk.nodeSize.constraints':
      return raw
        .replace(/[[\]]/g, '')
        .split(/[\s,]+/)
        .filter(Boolean);
  }

  const def = p.defaultValue;
  if (typeof def === 'number') return Number(raw);
  if (typeof def === 'boolean') {
    return raw === 'true' || raw === '1';
  }
  // Enum-like / string default: return raw string. The enum object's
  // string values match the JSON values exactly (see options/enums.ts).
  return raw;
}
