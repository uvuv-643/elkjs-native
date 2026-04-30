/**
 * Round-trip property: import → exportLayout (no layout actually run)
 * must not change the JSON.
 *
 * The exporter only writes a field when the corresponding internal value
 * is non-zero OR the field already existed in the input. Since `importGraph`
 * reads x/y/width/height verbatim, the export writes the same value back
 * (or skips it). Edges without computed bend points are not touched.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { importGraph } from '../../src/graph/json-importer.js';
import { transferLayout } from '../../src/graph/json-exporter.js';
import type { ElkNode } from '../../src/graph/elk-types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__dirname, '../fixtures');

function* walkJson(dir: string): IterableIterator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walkJson(full);
    else if (entry.isFile() && entry.name.endsWith('.json')) yield full;
  }
}

describe('JSON round-trip (no layout)', () => {
  const files = [...walkJson(FIXTURES_DIR)];
  expect(files.length).toBeGreaterThan(0);

  for (const file of files) {
    const rel = path.relative(FIXTURES_DIR, file);
    it(`preserves ${rel}`, () => {
      const original = fs.readFileSync(file, 'utf8');
      const json: ElkNode = JSON.parse(original);
      const before = JSON.parse(original); // independent deep copy
      const lgraph = importGraph(json);
      transferLayout(lgraph, json);
      expect(json).toEqual(before);
    });
  }
});
