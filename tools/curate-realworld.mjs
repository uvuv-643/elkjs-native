#!/usr/bin/env node
/**
 * curate-realworld.mjs — pick flat real-world JSON graphs from
 * elk-models/realworld/ptolemy/flattened/ that don't use features we
 * intentionally drop (compound, self-loops, splines, ...).
 *
 * Output:
 *   test/fixtures/realworld/<file>.json  (with elk.algorithm:layered injected)
 *   test/fixtures/REALWORLD.md           (list of selected files)
 *
 * Selection rules (kept minimal):
 *   - children only at top level (no nested children → no compound);
 *   - JSON.stringify must NOT contain forbidden keywords (case-insensitive):
 *     'selfloop', 'splines', 'partition', 'wrapping', 'hyperedge', 'comment',
 *     'hierarchical';
 *   - 5..200 children;
 *   - take ~10 spread across sizes (smallest, largest, evenly-spaced).
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..');
const SRC_DIR = resolve(ROOT, '../elk-models/realworld/ptolemy/flattened');
const OUT_DIR = resolve(ROOT, 'test/fixtures/realworld');
const REPORT = resolve(ROOT, 'test/fixtures/REALWORLD.md');

const FORBIDDEN = [
  'selfloop',
  'splines',
  'partition',
  'wrapping',
  'hyperedge',
  'comment',
  'hierarchical',
];

const hasNestedChildren = (node) => {
  if (!node || !Array.isArray(node.children)) return false;
  return node.children.some((c) => Array.isArray(c.children) && c.children.length > 0);
};

const fileSize = (json) => (Array.isArray(json.children) ? json.children.length : 0);

const candidates = [];
for (const name of readdirSync(SRC_DIR)) {
  if (!name.endsWith('.json')) continue;
  const full = join(SRC_DIR, name);
  let raw;
  try {
    raw = readFileSync(full, 'utf8');
  } catch {
    continue;
  }
  const lower = raw.toLowerCase();
  if (FORBIDDEN.some((w) => lower.includes(w))) continue;
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    continue;
  }
  if (hasNestedChildren(json)) continue;
  const size = fileSize(json);
  if (size < 5 || size > 200) continue;
  candidates.push({ name, json, size });
}

candidates.sort((a, b) => a.size - b.size);

// Pick ~10 spread by size.
const TARGET = 10;
const picked = [];
if (candidates.length <= TARGET) {
  picked.push(...candidates);
} else {
  for (let i = 0; i < TARGET; i++) {
    const idx = Math.floor((i * (candidates.length - 1)) / (TARGET - 1));
    if (!picked.includes(candidates[idx])) picked.push(candidates[idx]);
  }
}

if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const lines = [
  '# Curated realworld fixtures',
  '',
  `Source: \`elk-models/realworld/ptolemy/flattened/\` — ${candidates.length} candidates after filtering, ${picked.length} picked.`,
  '',
  '| File | Children |',
  '| --- | --- |',
];

for (const { name, json, size } of picked) {
  json.layoutOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    ...(json.layoutOptions ?? {}),
  };
  writeFileSync(join(OUT_DIR, name), JSON.stringify(json, null, 2) + '\n');
  lines.push(`| \`${name}\` | ${size} |`);
}

writeFileSync(REPORT, lines.join('\n') + '\n');
console.log(`Curated ${picked.length} fixtures → ${OUT_DIR}`);
