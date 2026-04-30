/**
 * Assigns a {@link PortSide} to every port that doesn't have one yet.
 *
 * Port of `org.eclipse.elk.alg.layered.intermediate.PortSideProcessor`.
 * Simplified: no compound external-port dummies (we don't ship them in
 * the MVP), so the side is decided purely from the port's net flow:
 *   - net flow < 0  → output port → EAST
 *   - otherwise     → input port  → WEST
 *
 * Runs before P1 in our pipeline (slot {@code BEFORE_P1}).
 */
import type { LayoutProcessor } from '../processor.js';
import type { LGraph, LNode, LPort } from '../lgraph.js';
import { PortConstraints, PortSide } from '../../options/enums.js';
import { CoreOptions } from '../../options/core-options.js';

function isSideFixed(pc: PortConstraints): boolean {
  return (
    pc === PortConstraints.FIXED_SIDE ||
    pc === PortConstraints.FIXED_ORDER ||
    pc === PortConstraints.FIXED_RATIO ||
    pc === PortConstraints.FIXED_POS
  );
}

/** incoming - outgoing (matches `LPort.getNetFlow` in Java). Negative net
 *  flow ≈ output port → goes on the EAST side. */
function netFlow(port: LPort): number {
  return port.incomingEdges.length - port.outgoingEdges.length;
}

function setPortSide(port: LPort): void {
  port.side = netFlow(port) < 0 ? PortSide.EAST : PortSide.WEST;
}

/**
 * Snap the port's `position` to the relevant edge of the node based on
 * `port.side`. Mirrors `LGraphUtil.placePorts` and the implicit Java
 * convention that a WEST port's local x is 0 and an EAST port's local x is
 * the node's width. Without this, `LPort.getAbsoluteAnchor()` would return
 * the same X for east-side and west-side ports, breaking edge routing.
 */
function snapPortPosition(node: LNode, port: LPort): void {
  if (port.side === PortSide.WEST) {
    port.position.x = 0;
  } else if (port.side === PortSide.EAST) {
    port.position.x = node.size.x;
  } else if (port.side === PortSide.NORTH) {
    port.position.y = 0;
  } else if (port.side === PortSide.SOUTH) {
    port.position.y = node.size.y;
  }
}

function processNode(node: LNode): void {
  const pc = node.getProperty(CoreOptions.PORT_CONSTRAINTS);
  if (isSideFixed(pc)) {
    for (const port of node.ports) {
      if (port.side === PortSide.UNDEFINED) setPortSide(port);
    }
  } else {
    for (const port of node.ports) setPortSide(port);
    node.setProperty(CoreOptions.PORT_CONSTRAINTS, PortConstraints.FIXED_SIDE);
  }
  // Snap port positions onto the node border so absolute anchors land on
  // the node edges (not all in the top-left corner).
  for (const port of node.ports) snapPortPosition(node, port);
}

export const PortSideProcessor: LayoutProcessor = {
  id: 'PORT_SIDE_PROCESSOR',
  process(graph: LGraph): void {
    for (const node of graph.layerlessNodes) processNode(node);
    for (const layer of graph.layers) for (const node of layer.nodes) processNode(node);
  },
};
