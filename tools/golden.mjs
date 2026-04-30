#!/usr/bin/env node
/**
 * golden.mjs — run elkjs@0.12.0 on every fixture under test/fixtures/
 * and write the result next to it under test/golden/, preserving the
 * relative path. Deterministic: same input ⇒ identical output bytes.
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..');
const FIX = resolve(ROOT, 'test/fixtures');
const OUT = resolve(ROOT, 'test/golden');

const ELK = (await import('elkjs/lib/elk.bundled.js')).default;

const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (name.endsWith('.json')) out.push(full);
  }
  return out;
};

const files = walk(FIX);
let ok = 0;
let fail = 0;

for (const file of files) {
  const rel = relative(FIX, file);
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const elk = new ELK();
  try {
    const result = await elk.layout(json);
    const target = join(OUT, rel.replace(/\.json$/, '.expected.json'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, JSON.stringify(result, null, 2) + '\n');
    ok++;
    console.log(`  ok  ${rel}`);
  } catch (err) {
    fail++;
    console.error(`  ERR ${rel}: ${err?.message ?? err}`);
  }
}

console.log(`\nGolden: ${ok} ok, ${fail} failed (out of ${files.length}).`);
if (fail > 0) process.exit(1);
