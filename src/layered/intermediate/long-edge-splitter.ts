/**
 * Splits edges that span more than one layer by inserting `LONG_EDGE`
 * dummy nodes (one per intermediate layer crossed). After this processor,
 * every edge connects nodes from adjacent layers — i.e. the layering is
 * "proper".
 *
 * Port of `org.eclipse.elk.alg.layered.intermediate.LongEdgeSplitter`.
 *
 * MVP simplifications:
 *  - we don't move HEAD edge labels (no end-label support yet);
 *  - dummy edges don't copy properties beyond ORIGIN tracking.
 */
import type { LayoutProcessor } from '../processor.js';
import { Layer, LEdge, LGraph, LNode, LPort, NodeType } from '../lgraph.js';
import { PortSide, PortConstraints } from '../../options/enums.js';
import { CoreOptions } from '../../options/core-options.js';
import { InternalProperties } from '../../options/internal-properties.js';

export const LongEdgeSplitter: LayoutProcessor = {
  id: 'LONG_EDGE_SPLITTER',

  process(graph: LGraph): void {
    if (graph.layers.length <= 2) return;

    for (let i = 0; i < graph.layers.length - 1; i++) {
      const layer = graph.layers[i];
      const nextLayer = graph.layers[i + 1];

      // Snapshot nodes — `splitEdge` adds dummies into nextLayer; iterating
      // the live array could pick them up and process them again.
      const nodes = layer.nodes.slice();
      for (const node of nodes) {
        for (const port of node.ports) {
          for (const edge of port.outgoingEdges.slice()) {
            const targetLayer = edge.target?.node?.layer;
            if (targetLayer && targetLayer !== layer && targetLayer !== nextLayer) {
              splitEdge(edge, createDummyNode(graph, nextLayer, edge));
            }
          }
        }
      }
    }
  },
};

function createDummyNode(graph: LGraph, layer: Layer, edge: LEdge): LNode {
  const dummy = new LNode();
  dummy.type = NodeType.LONG_EDGE;
  dummy.graph = graph;
  dummy.setProperty(InternalProperties.ORIGIN, edge);
  dummy.setProperty(CoreOptions.PORT_CONSTRAINTS, PortConstraints.FIXED_POS);
  dummy.layer = layer;
  layer.nodes.push(dummy);
  return dummy;
}

/**
 * Reroutes `edge` to terminate at a freshly-built west port on `dummyNode`,
 * and creates a continuation edge from a new east port on the dummy to the
 * original target. Records LONG_EDGE_SOURCE/TARGET on the dummy.
 *
 * @returns the freshly-created continuation edge.
 */
export function splitEdge(edge: LEdge, dummyNode: LNode): LEdge {
  const oldTarget = edge.target!;

  // Edge thickness drives the dummy's height (defaults to 0 if not set).
  let thickness = edge.getProperty(CoreOptions.EDGE_THICKNESS);
  if (thickness < 0) {
    thickness = 0;
    edge.setProperty(CoreOptions.EDGE_THICKNESS, 0);
  }
  dummyNode.size.y = thickness;
  const portPos = Math.floor(thickness / 2);

  const dummyInput = new LPort();
  dummyInput.side = PortSide.WEST;
  dummyInput.node = dummyNode;
  dummyInput.position.y = portPos;
  dummyNode.ports.push(dummyInput);

  const dummyOutput = new LPort();
  dummyOutput.side = PortSide.EAST;
  dummyOutput.node = dummyNode;
  dummyOutput.position.y = portPos;
  dummyNode.ports.push(dummyOutput);

  edge.setTarget(dummyInput);

  const dummyEdge = new LEdge();
  dummyEdge.setSource(dummyOutput);
  dummyEdge.setTarget(oldTarget);

  setLongEdgeSourceTarget(dummyNode, edge, dummyEdge);
  return dummyEdge;
}

function setLongEdgeSourceTarget(dummyNode: LNode, inEdge: LEdge, outEdge: LEdge): void {
  const inSourceNode = inEdge.source?.node;
  if (inSourceNode && inSourceNode.type === NodeType.LONG_EDGE) {
    dummyNode.setProperty(
      InternalProperties.LONG_EDGE_SOURCE,
      inSourceNode.getProperty(InternalProperties.LONG_EDGE_SOURCE)
    );
    dummyNode.setProperty(
      InternalProperties.LONG_EDGE_TARGET,
      inSourceNode.getProperty(InternalProperties.LONG_EDGE_TARGET)
    );
  } else {
    dummyNode.setProperty(InternalProperties.LONG_EDGE_SOURCE, inEdge.source);
    dummyNode.setProperty(InternalProperties.LONG_EDGE_TARGET, outEdge.target);
  }
}
