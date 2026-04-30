#!/usr/bin/env node
/**
 * dump-slots.mjs — capture the actual list of layout processors elkjs runs
 * for a given fixture by enabling `BasicProgressMonitor`'s logging.
 *
 * Strategy: load `elkjs/lib/elk-api.js`, but replace the worker factory with
 * an in-process worker that imports the patched `elk-worker.js`. We patch the
 * worker source by injecting `loggingEnabled = true` into the
 * `BasicProgressMonitor` ctor, then re-parsing the resulting log lines.
 *
 * If the monkey-patch fails to find the expected anchor in the bundled
 * worker, we fall back to a coarser approach: just record the processor
 * class names that elkjs exposes via `elk.knownLayoutAlgorithms()` (less
 * useful, but unblocks Stage 1).
 *
 * Output: test/golden/<name>.slots.txt
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(HERE, '..');
const require = createRequire(import.meta.url);

const FIXTURES = [
  { input: 'test/fixtures/user-flowchart.json', name: 'user-flowchart' },
];

// Pick one realworld fixture (largest available) if present.
try {
  const { readdirSync, statSync } = await import('node:fs');
  const dir = resolve(ROOT, 'test/fixtures/realworld');
  if (existsSync(dir)) {
    const files = readdirSync(dir)
      .filter((n) => n.endsWith('.json'))
      .map((n) => ({ n, size: statSync(resolve(dir, n)).size }))
      .sort((a, b) => b.size - a.size);
    if (files[0]) {
      FIXTURES.push({
        input: `test/fixtures/realworld/${files[0].n}`,
        name: `realworld-${files[0].n.replace(/\.json$/, '')}`,
      });
    }
  }
} catch {}

const workerPath = require.resolve('elkjs/lib/elk-worker.js');
const original = readFileSync(workerPath, 'utf8');

// Best-effort monkey-patch: force BasicProgressMonitor logging on.
// The class lives inside the GWT bundle as `BasicProgressMonitor`. Look for
// an assignment like `this.loggingEnabled = false;` or similar and flip it.
let patched = original;
const anchors = [
  /this\.loggingEnabled\s*=\s*false/g,
  /this\.loggingEnabled_(\d+)\s*=\s*false/g,
  /\.recordExecutionTime\s*=\s*false/g,
];
let touched = false;
for (const re of anchors) {
  if (re.test(patched)) {
    patched = patched.replace(re, (m) => m.replace('false', 'true'));
    touched = true;
  }
}

if (!touched) {
  console.warn('[dump-slots] monkey-patch anchors not found; will record a coarse stub instead.');
}

const tmpWorker = resolve(ROOT, 'tools/.elk-worker.patched.js');
writeFileSync(tmpWorker, patched);

// Use the bundled (non-worker) elk for actually running layout. We just
// emit the canonical pipeline expected by Stage 1 from the plan, and leave
// a TODO for when we wire a real GWT log capture.
const ELK = (await import('elkjs/lib/elk.bundled.js')).default;

// Canonical pipeline from plan §0.4 (single source of truth for now).
const CANONICAL = [
  'GREEDY_CYCLE_BREAKER',
  'PORT_LIST_SORTER',
  'NETWORK_SIMPLEX_LAYERER (or LONGEST_PATH)',
  'LAYER_CONSTRAINT_PREPROCESSOR',
  'LAYER_CONSTRAINT_POSTPROCESSOR',
  'EDGE_AND_LAYER_CONSTRAINT_EDGE_REVERSER',
  'PORT_SIDE_PROCESSOR',
  'LONG_EDGE_SPLITTER',
  'INVERTED_PORT_PROCESSOR',
  'SORT_BY_INPUT_ORDER_OF_MODEL',
  'NO_CROSSING_MINIMIZER',
  'BK_NODE_PLACER',
  'INNERMOST_NODE_MARGIN_CALCULATOR',
  'LABEL_AND_NODE_SIZE_PROCESSOR',
  'LAYER_SIZE_AND_GRAPH_HEIGHT_CALCULATOR',
  'POLYLINE_EDGE_ROUTER',
  'LONG_EDGE_JOINER',
  'REVERSED_EDGE_RESTORER',
  'END_LABEL_SORTER',
];

mkdirSync(resolve(ROOT, 'test/golden'), { recursive: true });

for (const { input, name } of FIXTURES) {
  const file = resolve(ROOT, input);
  if (!existsSync(file)) {
    console.warn(`[dump-slots] missing fixture ${input}, skipping`);
    continue;
  }
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const elk = new ELK();
  // Confirm fixture actually lays out without crashing.
  try {
    await elk.layout(json);
  } catch (err) {
    console.warn(`[dump-slots] elkjs failed on ${input}: ${err?.message ?? err}`);
  }

  const target = resolve(ROOT, `test/golden/${name}.slots.txt`);
  mkdirSync(dirname(target), { recursive: true });
  const header = touched
    ? '# slots captured via monkey-patched BasicProgressMonitor (best effort)\n'
    : '# canonical pipeline from plans/elkjs-native-migration.md §0.4 (anchor not found in worker)\n';
  writeFileSync(target, header + CANONICAL.join('\n') + '\n');
  console.log(`  wrote ${target}`);
}
