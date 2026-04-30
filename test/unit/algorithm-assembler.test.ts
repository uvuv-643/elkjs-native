import { describe, expect, it } from 'vitest';
import { LGraph } from '../../src/layered/lgraph.js';
import { ProcessorSlot } from '../../src/layered/processor.js';
import { assemble } from '../../src/layered/algorithm-assembler.js';
import { IntermediateProcessor } from '../../src/layered/intermediate/registry.js';
import type { LayoutPhase } from '../../src/layered/phases/phase.js';

function makePhase(id: string, cfg: Record<number, IntermediateProcessor[]> = {}): LayoutPhase {
  return {
    id,
    process: () => {},
    getProcessorConfiguration: () => cfg,
  };
}

describe('algorithm-assembler', () => {
  it('produces P1..P5 with no intermediates when phases declare none', () => {
    const phases = [
      makePhase('P1'),
      makePhase('P2'),
      makePhase('P3'),
      makePhase('P4'),
      makePhase('P5'),
    ] as const;
    const out = assemble(phases as never, new LGraph());
    expect(out.ids).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
  });

  it('inserts an intermediate before its phase', () => {
    const phases = [
      makePhase('P1'),
      makePhase('P2', {
        [ProcessorSlot.BEFORE_P2]: [IntermediateProcessor.PORT_LIST_SORTER],
      }),
      makePhase('P3'),
      makePhase('P4'),
      makePhase('P5'),
    ] as const;
    const out = assemble(phases as never, new LGraph());
    expect(out.ids).toEqual([
      'P1',
      IntermediateProcessor.PORT_LIST_SORTER,
      'P2',
      'P3',
      'P4',
      'P5',
    ]);
  });

  it('deduplicates intermediates requested by multiple phases', () => {
    const phases = [
      makePhase('P1', {
        [ProcessorSlot.BEFORE_P3]: [IntermediateProcessor.LONG_EDGE_SPLITTER],
      }),
      makePhase('P2', {
        [ProcessorSlot.BEFORE_P3]: [IntermediateProcessor.LONG_EDGE_SPLITTER],
      }),
      makePhase('P3'),
      makePhase('P4'),
      makePhase('P5'),
    ] as const;
    const out = assemble(phases as never, new LGraph());
    expect(out.ids.filter((id) => id === IntermediateProcessor.LONG_EDGE_SPLITTER)).toHaveLength(1);
  });

  it('orders intermediates within a slot by canonical order', () => {
    const phases = [
      makePhase('P1'),
      makePhase('P2', {
        [ProcessorSlot.BEFORE_P3]: [
          // request out-of-order on purpose
          IntermediateProcessor.SORT_BY_INPUT_ORDER_OF_MODEL,
          IntermediateProcessor.LONG_EDGE_SPLITTER,
          IntermediateProcessor.PORT_SIDE_PROCESSOR,
        ],
      }),
      makePhase('P3'),
      makePhase('P4'),
      makePhase('P5'),
    ] as const;
    const out = assemble(phases as never, new LGraph());
    const beforeP3 = out.ids.slice(out.ids.indexOf('P2') + 1, out.ids.indexOf('P3'));
    expect(beforeP3).toEqual([
      IntermediateProcessor.PORT_SIDE_PROCESSOR,
      IntermediateProcessor.LONG_EDGE_SPLITTER,
      IntermediateProcessor.SORT_BY_INPUT_ORDER_OF_MODEL,
    ]);
  });
});
