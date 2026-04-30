/**
 * Writes layout results from an `LGraph` back into the JSON that was
 * passed to {@link './json-importer.ts' importGraph}. Mirrors
 * `JsonImporter.transferLayout`.
 *
 * Important: the JSON passed in is mutated in place (same shape as elkjs).
 *
 * If no layout was performed, calling this immediately after `importGraph`
 * should produce the same JSON byte-for-byte (round-trip property).
 */
import type {
  ElkEdgeSection,
  ElkExtendedEdge,
  ElkLabel,
  ElkNode,
  ElkPoint,
  ElkPort,
} from './elk-types.js';
import {
  LEdge,
  LGraph,
  LLabel,
  LNode,
  LPort,
} from '../layered/lgraph.js';
import { SOURCE_JSON } from './json-importer.js';

interface MaybeWithSource {
  [SOURCE_JSON]?: object;
}

/**
 * Mutates `originalJson` in place with computed positions/sizes/sections
 * from `lgraph`. Pass-through for any element that wasn't laid out (its
 * existing fields stay as-is).
 */
/**
 * Heuristic for "did anyone actually lay this out?". The round-trip
 * importer never sets layers and never positions nodes, so on a no-layout
 * round-trip all of these will be at their initial values.
 */
function wasLaidOut(lgraph: LGraph): boolean {
  if (lgraph.layers.length > 0) return true;
  if (lgraph.size.x !== 0 || lgraph.size.y !== 0) return true;
  for (const n of lgraph.layerlessNodes) {
    if (n.position.x !== 0 || n.position.y !== 0) return true;
  }
  return false;
}

export function transferLayout(lgraph: LGraph, originalJson: ElkNode): void {
  const laidOut = wasLaidOut(lgraph);

  // Root size/offset.
  if (laidOut && (lgraph.size.x !== 0 || lgraph.size.y !== 0)) {
    originalJson.width = lgraph.size.x;
    originalJson.height = lgraph.size.y;
  }

  // Walk all nodes.
  for (const lnode of allNodesInGraph(lgraph)) {
    const targetJson = (lnode as MaybeWithSource)[SOURCE_JSON] as ElkNode | undefined;
    if (!targetJson) continue;
    if (laidOut) writeShape(targetJson, lnode);
    for (const lport of lnode.ports) writePort(lport, laidOut);
    for (const llabel of lnode.labels) writeLabel(llabel, laidOut);
  }

  if (laidOut) {
    // Walk all edges (collected from outgoing of every port).
    for (const ledge of allEdgesInGraph(lgraph)) {
      writeEdge(ledge);
    }
  }
}

/* -------------------------------------------------------------------------- */
/*                                  helpers                                   */
/* -------------------------------------------------------------------------- */

function* allNodesInGraph(lgraph: LGraph): IterableIterator<LNode> {
  for (const n of lgraph.layerlessNodes) yield n;
  for (const layer of lgraph.layers) for (const n of layer.nodes) yield n;
}

function* allEdgesInGraph(lgraph: LGraph): IterableIterator<LEdge> {
  const seen = new Set<LEdge>();
  for (const n of allNodesInGraph(lgraph)) {
    for (const p of n.ports) {
      for (const e of p.outgoingEdges) {
        if (!seen.has(e)) {
          seen.add(e);
          yield e;
        }
      }
    }
  }
}

function writeShape(
  json: { x?: number; y?: number; width?: number; height?: number },
  el: { position: { x: number; y: number }; size: { x: number; y: number } }
): void {
  // Mirror JsonImporter.transferLayout: always write resolved coordinates,
  // even if zero. The previous "skip-zero" heuristic dropped legitimate
  // top-left blocks (e.g. head node at the layer origin).
  json.x = el.position.x;
  json.y = el.position.y;
  if (el.size.x !== 0 || json.width !== undefined) json.width = el.size.x;
  if (el.size.y !== 0 || json.height !== undefined) json.height = el.size.y;
}

function writePort(lport: LPort, laidOut: boolean): void {
  const json = (lport as MaybeWithSource)[SOURCE_JSON] as ElkPort | undefined;
  if (!json) return;
  if (laidOut) writeShape(json, lport);
}

function writeLabel(llabel: LLabel, laidOut: boolean): void {
  const json = (llabel as MaybeWithSource)[SOURCE_JSON] as ElkLabel | undefined;
  if (!json) return;
  if (laidOut) writeShape(json, llabel);
}

function writeEdge(ledge: LEdge): void {
  const json = (ledge as MaybeWithSource)[SOURCE_JSON] as ElkExtendedEdge | undefined;
  if (!json) return;

  const startPort = ledge.source;
  const endPort = ledge.target;
  if (!startPort || !endPort) return;
  // Skip orphan edges that never participated in the layout (e.g. a
  // round-trip without a doLayout call).
  const startNode = startPort.node;
  const endNode = endPort.node;
  if (!startNode || !endNode) return;
  const laidOut =
    ledge.bendPoints.length > 0 ||
    startNode.position.x !== 0 || startNode.position.y !== 0 ||
    endNode.position.x !== 0 || endNode.position.y !== 0;
  if (!laidOut) return;

  const startPoint: ElkPoint = portCenterAbsolute(startPort);
  const endPoint: ElkPoint = portCenterAbsolute(endPort);
  const bendPoints: ElkPoint[] = ledge.bendPoints.map((v) => ({ x: v.x, y: v.y }));

  const section: ElkEdgeSection = {
    id: `${json.id}_s0`,
    startPoint,
    endPoint,
    ...(bendPoints.length > 0 ? { bendPoints } : {}),
  };
  json.sections = [section];

  for (const ll of ledge.labels) writeLabel(ll, true);
}

function portCenterAbsolute(p: LPort): ElkPoint {
  const node = p.node;
  const nx = node?.position.x ?? 0;
  const ny = node?.position.y ?? 0;
  return { x: nx + p.position.x + p.anchor.x, y: ny + p.position.y + p.anchor.y };
}
