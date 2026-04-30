/**
 * Public entry point for elkjs-native.
 *
 * Stage 4 wires up the pipeline scaffolding. Phases other than P3 are
 * still stubs, so coordinates are placeholders — `pnpm test` checks the
 * pipeline structure, not absolute positions.
 */
export * from './graph/elk-types.js';
export { importGraph } from './graph/json-importer.js';
export { transferLayout } from './graph/json-exporter.js';
export { CoreOptions } from './options/core-options.js';
export { LayeredOptions } from './options/layered-options.js';
export * from './options/enums.js';
export { property, PropertyHolder, type IProperty } from './properties.js';
export { KVector, KVectorChain } from './math/kvector.js';
export { ELK } from './api/elk.js';

import { ELK } from './api/elk.js';
export default ELK;
