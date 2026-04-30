/**
 * Registry of intermediate-processor identifiers we ship in the MVP.
 *
 * Mirrors `org.eclipse.elk.alg.layered.intermediate.IntermediateProcessorStrategy`,
 * but only the values referenced by our pipeline (see slot dump in
 * [test/golden/user-flowchart.slots.txt](../../../test/golden/user-flowchart.slots.txt)).
 *
 * Stage 4 ships every entry as a no-op stub. Subsequent stages replace
 * stubs with real implementations one by one without touching the
 * pipeline wiring.
 */
import type { LayoutProcessor } from '../processor.js';
import type { LGraph } from '../lgraph.js';

/** Enumeration of intermediate processors. The order matches the canonical
 *  Java enum order, which is also the dependency order the engine relies
 *  on (see plan §2 Stage 4). */
export enum IntermediateProcessor {
  EDGE_AND_LAYER_CONSTRAINT_EDGE_REVERSER = 'EDGE_AND_LAYER_CONSTRAINT_EDGE_REVERSER',
  PORT_LIST_SORTER = 'PORT_LIST_SORTER',
  LAYER_CONSTRAINT_PREPROCESSOR = 'LAYER_CONSTRAINT_PREPROCESSOR',
  PORT_SIDE_PROCESSOR = 'PORT_SIDE_PROCESSOR',
  LONG_EDGE_SPLITTER = 'LONG_EDGE_SPLITTER',
  INVERTED_PORT_PROCESSOR = 'INVERTED_PORT_PROCESSOR',
  SORT_BY_INPUT_ORDER_OF_MODEL = 'SORT_BY_INPUT_ORDER_OF_MODEL',
  LAYER_CONSTRAINT_POSTPROCESSOR = 'LAYER_CONSTRAINT_POSTPROCESSOR',
  INNERMOST_NODE_MARGIN_CALCULATOR = 'INNERMOST_NODE_MARGIN_CALCULATOR',
  LABEL_AND_NODE_SIZE_PROCESSOR = 'LABEL_AND_NODE_SIZE_PROCESSOR',
  LAYER_SIZE_AND_GRAPH_HEIGHT_CALCULATOR = 'LAYER_SIZE_AND_GRAPH_HEIGHT_CALCULATOR',
  LONG_EDGE_JOINER = 'LONG_EDGE_JOINER',
  REVERSED_EDGE_RESTORER = 'REVERSED_EDGE_RESTORER',
  SELF_LOOP_ROUTER = 'SELF_LOOP_ROUTER',
  PORT_POSITION_CALCULATOR = 'PORT_POSITION_CALCULATOR',
  END_LABEL_SORTER = 'END_LABEL_SORTER',
}

/** Canonical execution order. Matches the Java enum declaration order. */
export const INTERMEDIATE_PROCESSOR_ORDER: readonly IntermediateProcessor[] = [
  IntermediateProcessor.EDGE_AND_LAYER_CONSTRAINT_EDGE_REVERSER,
  IntermediateProcessor.PORT_LIST_SORTER,
  IntermediateProcessor.LAYER_CONSTRAINT_PREPROCESSOR,
  IntermediateProcessor.PORT_SIDE_PROCESSOR,
  IntermediateProcessor.LONG_EDGE_SPLITTER,
  IntermediateProcessor.INVERTED_PORT_PROCESSOR,
  IntermediateProcessor.SORT_BY_INPUT_ORDER_OF_MODEL,
  IntermediateProcessor.LAYER_CONSTRAINT_POSTPROCESSOR,
  IntermediateProcessor.INNERMOST_NODE_MARGIN_CALCULATOR,
  IntermediateProcessor.LABEL_AND_NODE_SIZE_PROCESSOR,
  IntermediateProcessor.LAYER_SIZE_AND_GRAPH_HEIGHT_CALCULATOR,
  IntermediateProcessor.LONG_EDGE_JOINER,
  IntermediateProcessor.REVERSED_EDGE_RESTORER,
  IntermediateProcessor.SELF_LOOP_ROUTER,
  IntermediateProcessor.PORT_POSITION_CALCULATOR,
  IntermediateProcessor.END_LABEL_SORTER,
];

import { PortSideProcessor } from './port-side-processor.js';
import { PortListSorter } from './port-list-sorter.js';
import { EdgeAndLayerConstraintEdgeReverser } from './edge-and-layer-constraint-edge-reverser.js';
import { LayerConstraintPreprocessor } from './layer-constraint-preprocessor.js';
import { LongEdgeSplitter } from './long-edge-splitter.js';
import { InvertedPortProcessor } from './inverted-port-processor.js';
import { LayerConstraintPostprocessor } from './layer-constraint-postprocessor.js';
import { SortByInputModelOrder } from './sort-by-input-order-of-model.js';
import { InnermostNodeMarginCalculator } from './innermost-node-margin-calculator.js';
import { LabelAndNodeSizeProcessor } from './label-and-node-size-processor.js';
import { LayerSizeAndGraphHeightCalculator } from './layer-size-and-graph-height-calculator.js';
import { LongEdgeJoiner } from './long-edge-joiner.js';
import { ReversedEdgeRestorer } from './reversed-edge-restorer.js';
import { SelfLoopRouter } from './self-loop-router.js';
import { PortPositionCalculator } from './port-position-calculator.js';

/** Real implementations registered so far. Stages 6-8 will fill the rest. */
const REAL: Partial<Record<IntermediateProcessor, LayoutProcessor>> = {
  [IntermediateProcessor.PORT_SIDE_PROCESSOR]: PortSideProcessor,
  [IntermediateProcessor.PORT_LIST_SORTER]: PortListSorter,
  [IntermediateProcessor.EDGE_AND_LAYER_CONSTRAINT_EDGE_REVERSER]:
    EdgeAndLayerConstraintEdgeReverser,
  [IntermediateProcessor.LAYER_CONSTRAINT_PREPROCESSOR]: LayerConstraintPreprocessor,
  [IntermediateProcessor.LONG_EDGE_SPLITTER]: LongEdgeSplitter,
  [IntermediateProcessor.INVERTED_PORT_PROCESSOR]: InvertedPortProcessor,
  [IntermediateProcessor.LAYER_CONSTRAINT_POSTPROCESSOR]: LayerConstraintPostprocessor,
  [IntermediateProcessor.SORT_BY_INPUT_ORDER_OF_MODEL]: SortByInputModelOrder,
  [IntermediateProcessor.INNERMOST_NODE_MARGIN_CALCULATOR]: InnermostNodeMarginCalculator,
  [IntermediateProcessor.LABEL_AND_NODE_SIZE_PROCESSOR]: LabelAndNodeSizeProcessor,
  [IntermediateProcessor.LAYER_SIZE_AND_GRAPH_HEIGHT_CALCULATOR]:
    LayerSizeAndGraphHeightCalculator,
  [IntermediateProcessor.LONG_EDGE_JOINER]: LongEdgeJoiner,
  [IntermediateProcessor.REVERSED_EDGE_RESTORER]: ReversedEdgeRestorer,
  [IntermediateProcessor.SELF_LOOP_ROUTER]: SelfLoopRouter,
  [IntermediateProcessor.PORT_POSITION_CALCULATOR]: PortPositionCalculator,
};

/** Named no-op for processors that haven't been ported yet. */
function stub(id: IntermediateProcessor): LayoutProcessor {
  return {
    id,
    process(_graph: LGraph): void {
      /* no-op until later stages */
    },
  };
}

/** Returns the processor instance for an id (real if available, stub otherwise). */
export function createIntermediate(id: IntermediateProcessor): LayoutProcessor {
  return REAL[id] ?? stub(id);
}
