/**
 * Wraps `json-importer` to produce an `LGraph` ready for the layered pipeline.
 *
 * Mirrors `org.eclipse.elk.alg.layered.graph.transform.ElkGraphImporter`,
 * but most of the EMF-flavoured work (compound graphs, external ports,
 * insets, conversion of EMF into LGraph) is collapsed into the JSON
 * importer step. What's left here is the post-import normalization:
 *
 * - resolve `Direction.UNDEFINED → RIGHT` (ELK's default for layered);
 * - copy `elk.port.side` (already on the port's properties) into the typed
 *   `LPort.side` field;
 * - fold `elk.padding` / `elk.padding.{top,left,bottom,right}` into the
 *   typed `LGraph.padding` field;
 * - build a {@link Spacings} bundle and stash it on the graph.
 *
 * MVP-only: no external ports, no compound preprocessing, no inside-self-loops,
 * no hierarchical port constraints.
 */
import type { ElkNode } from '../../graph/elk-types.js';
import { importGraph as importFromJson } from '../../graph/json-importer.js';
import { LGraph, LNode, LPort } from '../lgraph.js';
import { CoreOptions } from '../../options/core-options.js';
import { Direction, PortSide } from '../../options/enums.js';
import { Spacings, SPACINGS_KEY } from '../../options/spacings.js';
import { InternalProperties } from '../../options/internal-properties.js';

/**
 * Imports the JSON graph into an `LGraph`, then normalizes properties so
 * downstream phases can just read typed fields.
 */
export function importGraph(json: ElkNode): LGraph {
  const lgraph = importFromJson(json);
  normalizeDirection(lgraph);
  applyPadding(lgraph);
  assignModelOrder(lgraph);
  for (const node of lgraph.layerlessNodes) {
    normalizePortSides(node);
  }
  lgraph.setProperty(SPACINGS_KEY, new Spacings(lgraph));
  return lgraph;
}

/**
 * Assigns `MODEL_ORDER` to nodes and edges in their input order. Mirrors
 * `ElkGraphImporter.importFlatGraph` (lines 229-258) and `transformNode`
 * (lines 311-394) for ports/edges. We always set the property — the strict
 * Java code conditions it on a heuristic that is irrelevant for our
 * pipeline (we never run the disabled paths).
 */
function assignModelOrder(lgraph: LGraph): void {
  let nodeIdx = 0;
  for (const node of lgraph.layerlessNodes) {
    node.setProperty(InternalProperties.MODEL_ORDER, nodeIdx++);
    let portIdx = 0;
    for (const port of node.ports) {
      port.setProperty(InternalProperties.MODEL_ORDER, portIdx++);
    }
  }
  // Edges: walk in source-port order, then their outgoing edges.
  let edgeIdx = 0;
  for (const node of lgraph.layerlessNodes) {
    for (const port of node.ports) {
      for (const edge of port.outgoingEdges) {
        if (!edge.hasProperty(InternalProperties.MODEL_ORDER)) {
          edge.setProperty(InternalProperties.MODEL_ORDER, edgeIdx++);
        }
      }
    }
  }
}

function normalizeDirection(lgraph: LGraph): void {
  const dir = lgraph.getProperty(CoreOptions.DIRECTION);
  if (dir === Direction.UNDEFINED) {
    lgraph.setProperty(CoreOptions.DIRECTION, Direction.RIGHT);
  }
}

function applyPadding(lgraph: LGraph): void {
  // `elk.padding` (object form) wins if present; otherwise per-side fields.
  if (lgraph.hasProperty(CoreOptions.PADDING)) {
    const p = lgraph.getProperty(CoreOptions.PADDING);
    lgraph.padding.top = p.top;
    lgraph.padding.left = p.left;
    lgraph.padding.bottom = p.bottom;
    lgraph.padding.right = p.right;
    return;
  }
  lgraph.padding.top = lgraph.getProperty(CoreOptions.PADDING_TOP);
  lgraph.padding.left = lgraph.getProperty(CoreOptions.PADDING_LEFT);
  lgraph.padding.bottom = lgraph.getProperty(CoreOptions.PADDING_BOTTOM);
  lgraph.padding.right = lgraph.getProperty(CoreOptions.PADDING_RIGHT);
}

function normalizePortSides(node: LNode): void {
  for (const port of node.ports) {
    if (port.side === PortSide.UNDEFINED) {
      const sideProp = port.getProperty(CoreOptions.PORT_SIDE);
      if (sideProp && sideProp !== PortSide.UNDEFINED) {
        port.side = sideProp;
      }
    }
    void (port as LPort);
  }
}
