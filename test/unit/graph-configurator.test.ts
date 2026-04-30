import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importGraph } from '../../src/layered/transform/elk-graph-importer.js';
import { prepareGraphForLayout } from '../../src/layered/graph-configurator.js';

const here = fileURLToPath(new URL('.', import.meta.url));
const fixture = JSON.parse(
  readFileSync(resolve(here, '../fixtures/user-flowchart.json'), 'utf8')
);

describe('graph-configurator', () => {
  it('builds a pipeline that contains the canonical phases for the user fixture', () => {
    const lgraph = importGraph(structuredClone(fixture));
    const pipeline = prepareGraphForLayout(lgraph);
    const phaseIds = [
      'GREEDY_CYCLE_BREAKER',
      'LONGEST_PATH_LAYERER',
      'NO_CROSSING_MINIMIZER',
      'BK_NODE_PLACER',
      'POLYLINE_EDGE_ROUTER',
    ];
    for (const id of phaseIds) {
      expect(pipeline.ids).toContain(id);
    }
  });

  it('phase ids appear in P1..P5 order', () => {
    const lgraph = importGraph(structuredClone(fixture));
    const pipeline = prepareGraphForLayout(lgraph);
    const order = ['GREEDY_CYCLE_BREAKER', 'LONGEST_PATH_LAYERER', 'NO_CROSSING_MINIMIZER', 'BK_NODE_PLACER', 'POLYLINE_EDGE_ROUTER'];
    const positions = order.map((id) => pipeline.ids.indexOf(id));
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it('includes all intermediates declared by phases in the canonical pipeline', () => {
    const lgraph = importGraph(structuredClone(fixture));
    const pipeline = prepareGraphForLayout(lgraph);
    // Subset of the canonical slot dump (only those active in our MVP wiring).
    const expected = [
      'EDGE_AND_LAYER_CONSTRAINT_EDGE_REVERSER',
      'PORT_LIST_SORTER',
      'LAYER_CONSTRAINT_PREPROCESSOR',
      'PORT_SIDE_PROCESSOR',
      'LONG_EDGE_SPLITTER',
      'INVERTED_PORT_PROCESSOR',
      'SORT_BY_INPUT_ORDER_OF_MODEL',
      'LAYER_CONSTRAINT_POSTPROCESSOR',
      'INNERMOST_NODE_MARGIN_CALCULATOR',
      'LABEL_AND_NODE_SIZE_PROCESSOR',
      'LAYER_SIZE_AND_GRAPH_HEIGHT_CALCULATOR',
      'LONG_EDGE_JOINER',
      'REVERSED_EDGE_RESTORER',
      'END_LABEL_SORTER',
    ];
    for (const id of expected) {
      expect(pipeline.ids).toContain(id);
    }
  });
});
