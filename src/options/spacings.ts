/**
 * Spacing bundle — port of `org.eclipse.elk.alg.layered.options.Spacings`.
 *
 * In Java this is a small object that GraphConfigurator stores on the LGraph
 * via `InternalProperties.SPACINGS`, so any phase/processor can read spacing
 * values without re-reading every individual option.
 *
 * We only carry the fields actually consumed by the MVP pipeline.
 */
import { CoreOptions } from './core-options.js';
import { LayeredOptions } from './layered-options.js';
import { PropertyHolder, property, IProperty } from '../properties.js';

export class Spacings {
  /** General node-to-node spacing within a layer. */
  nodeNodeSpacing: number;
  /** Node-to-node spacing between adjacent layers (P5 uses this for x-axis). */
  nodeNodeSpacingBetweenLayers: number;
  /** Edge-to-node spacing in-layer. */
  edgeNodeSpacing: number;
  /** Edge-to-node spacing between adjacent layers. */
  edgeNodeSpacingBetweenLayers: number;
  /** Edge-to-edge spacing within a layer. */
  edgeEdgeSpacing: number;
  /** Edge-to-edge spacing between adjacent layers. */
  edgeEdgeSpacingBetweenLayers: number;
  /** Port-to-port spacing on the same node side. */
  portPortSpacing: number;
  /** Label-to-node spacing. */
  labelNodeSpacing: number;

  constructor(holder: PropertyHolder) {
    this.nodeNodeSpacing = holder.getProperty(CoreOptions.SPACING_NODE_NODE);
    this.edgeNodeSpacing = holder.getProperty(CoreOptions.SPACING_EDGE_NODE);
    this.edgeEdgeSpacing = holder.getProperty(CoreOptions.SPACING_EDGE_EDGE);
    this.portPortSpacing = holder.getProperty(CoreOptions.SPACING_PORT_PORT);
    this.labelNodeSpacing = holder.getProperty(CoreOptions.SPACING_LABEL_NODE);

    this.nodeNodeSpacingBetweenLayers = this.nodeNodeSpacing;
    this.edgeNodeSpacingBetweenLayers = holder.getProperty(
      LayeredOptions.SPACING_EDGE_NODE_BETWEEN_LAYERS
    );
    this.edgeEdgeSpacingBetweenLayers = holder.getProperty(
      LayeredOptions.SPACING_EDGE_EDGE_BETWEEN_LAYERS
    );
    // Layered nodeNode override if explicitly set.
    if (holder.hasProperty(LayeredOptions.SPACING_NODE_NODE_BETWEEN_LAYERS)) {
      this.nodeNodeSpacingBetweenLayers = holder.getProperty(
        LayeredOptions.SPACING_NODE_NODE_BETWEEN_LAYERS
      );
    }
  }
}

/** Property key used to attach a {@link Spacings} bundle to an `LGraph`. */
export const SPACINGS_KEY: IProperty<Spacings | undefined> = property<Spacings | undefined>(
  'internal.layered.spacings',
  undefined
);
