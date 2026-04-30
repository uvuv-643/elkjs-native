/**
 * Inserts dummy nodes for "inverted" ports — INPUT ports on the EAST side
 * and OUTPUT ports on the WEST side. The dummy lives in the same layer as
 * the offending node and creates an in-layer edge so the layering stays
 * consistent.
 *
 * Port of `org.eclipse.elk.alg.layered.intermediate.InvertedPortProcessor`.
 *
 * MVP: only nodes with a side-fixed `PORT_CONSTRAINTS` are processed (same
 * as Java); self-loops are skipped.
 */
import type { LayoutProcessor } from '../processor.js';
import { Layer, LEdge, LGraph, LNode, LPort, NodeType } from '../lgraph.js';
import { PortConstraints, PortSide } from '../../options/enums.js';
import { CoreOptions } from '../../options/core-options.js';
import { InternalProperties } from '../../options/internal-properties.js';

function isSideFixed(c: PortConstraints): boolean {
  return (
    c === PortConstraints.FIXED_SIDE ||
    c === PortConstraints.FIXED_ORDER ||
    c === PortConstraints.FIXED_RATIO ||
    c === PortConstraints.FIXED_POS
  );
}

export const InvertedPortProcessor: LayoutProcessor = {
  id: 'INVERTED_PORT_PROCESSOR',

  process(graph: LGraph): void {
    const layers = graph.layers;
    let pending: LNode[] = [];

    for (let li = 0; li < layers.length; li++) {
      // Attach dummies queued for the previous layer.
      if (pending.length > 0) {
        const prev = layers[li - 1];
        for (const dummy of pending) {
          dummy.layer = prev;
          prev.nodes.push(dummy);
        }
        pending = [];
      }

      const currentLayer = layers[li];
      // Snapshot — we mutate `currentLayer.nodes` only for ports we created
      // *in this same layer*, but we also push to `pending` so it's safe.
      for (const node of currentLayer.nodes.slice()) {
        if (node.type !== NodeType.NORMAL) continue;
        if (!isSideFixed(node.getProperty(CoreOptions.PORT_CONSTRAINTS))) continue;

        for (const port of node.ports) {
          if (port.side === PortSide.EAST && port.incomingEdges.length > 0) {
            for (const edge of port.incomingEdges.slice()) {
              createInvertedDummy(graph, edge, port, pending);
            }
          } else if (port.side === PortSide.WEST && port.outgoingEdges.length > 0) {
            for (const edge of port.outgoingEdges.slice()) {
              createInvertedDummy(graph, edge, port, pending);
            }
          }
        }
      }
    }

    // Trailing dummies — attach them to the last layer.
    if (pending.length > 0 && layers.length > 0) {
      const last = layers[layers.length - 1];
      for (const dummy of pending) {
        dummy.layer = last;
        last.nodes.push(dummy);
      }
    }
  },
};

function createInvertedDummy(
  graph: LGraph,
  edge: LEdge,
  oddPort: LPort,
  pending: LNode[]
): void {
  // Skip self-loops.
  const isIncoming = edge.target === oddPort;
  const oppositeNode = isIncoming ? edge.source?.node : edge.target?.node;
  if (oppositeNode === oddPort.node) return;

  const dummy = new LNode();
  dummy.type = NodeType.LONG_EDGE;
  dummy.graph = graph;
  dummy.setProperty(InternalProperties.ORIGIN, edge);
  dummy.setProperty(CoreOptions.PORT_CONSTRAINTS, PortConstraints.FIXED_POS);
  pending.push(dummy);

  const dIn = new LPort();
  dIn.node = dummy;
  dIn.side = PortSide.WEST;
  dummy.ports.push(dIn);

  const dOut = new LPort();
  dOut.node = dummy;
  dOut.side = PortSide.EAST;
  dummy.ports.push(dOut);

  if (isIncoming) {
    // Reroute incoming edge through dummy: source → dIn, dOut → oddPort.
    edge.setTarget(dIn);
    const cont = new LEdge();
    cont.setSource(dOut);
    cont.setTarget(oddPort);
    setLongEdgeProps(dummy, edge, cont);
  } else {
    // Outgoing on a WEST port: oddPort → dIn, dOut → originalTarget.
    const originalTarget = edge.target!;
    edge.setTarget(dIn);
    const cont = new LEdge();
    cont.setSource(dOut);
    cont.setTarget(originalTarget);
    setLongEdgeProps(dummy, edge, cont);
  }
  void Layer; // keep import order stable
}

function setLongEdgeProps(dummy: LNode, inEdge: LEdge, outEdge: LEdge): void {
  const srcNode = inEdge.source?.node;
  if (srcNode && srcNode.type === NodeType.LONG_EDGE) {
    dummy.setProperty(
      InternalProperties.LONG_EDGE_SOURCE,
      srcNode.getProperty(InternalProperties.LONG_EDGE_SOURCE)
    );
  } else {
    dummy.setProperty(InternalProperties.LONG_EDGE_SOURCE, inEdge.source);
  }
  const tgtNode = outEdge.target?.node;
  if (tgtNode && tgtNode.type === NodeType.LONG_EDGE) {
    dummy.setProperty(
      InternalProperties.LONG_EDGE_TARGET,
      tgtNode.getProperty(InternalProperties.LONG_EDGE_TARGET)
    );
  } else {
    dummy.setProperty(InternalProperties.LONG_EDGE_TARGET, outEdge.target);
  }
}
