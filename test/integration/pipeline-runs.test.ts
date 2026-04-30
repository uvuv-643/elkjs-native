import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ELK from '../../src/index.js';
import type { ElkNode } from '../../src/graph/elk-types.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const fixturesDir = resolve(here, '../fixtures');

function loadFixture(rel: string): ElkNode {
  return JSON.parse(readFileSync(resolve(fixturesDir, rel), 'utf8'));
}

describe('integration: pipeline-runs', () => {
  it('runs end-to-end on user-flowchart and writes coordinates+sections', async () => {
    const elk = new ELK();
    const result = await elk.layout(loadFixture('user-flowchart.json'));
    expect(result.children?.length).toBeGreaterThan(0);
    // At least one child must end up with non-default coordinates.
    const placed = result.children!.filter((c) => typeof c.x === 'number' || typeof c.y === 'number');
    expect(placed.length).toBeGreaterThan(0);
    // At least one edge ends up with a section.
    const edgesWithSections = (result.edges ?? []).filter((e) => 'sections' in e && Array.isArray((e as { sections?: unknown }).sections));
    expect(edgesWithSections.length).toBeGreaterThan(0);
  });

  it('does not throw on any harvested realworld fixture', () => {
    const realworldDir = resolve(fixturesDir, 'realworld');
    const files = readdirSync(realworldDir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    const elk = new ELK();
    for (const f of files) {
      const json = loadFixture(`realworld/${f}`);
      expect(() => elk.layoutSync(json), `fixture ${f} should not throw`).not.toThrow();
    }
  });
});
