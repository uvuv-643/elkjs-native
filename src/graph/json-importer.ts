/**
 * JSON → internal `LGraph`. Mirrors `JsonImporter.xtend` from
 * `org.eclipse.elk.graph.json`, but writes directly into `LGraph`/`LNode`
 * (skipping the EMF `ElkNode` layer — we don't need it for layered-only).
 *
 * The importer also keeps a reference to the original JSON node on every
 * `LNode`/`LPort`/`LEdge`/`LLabel`, so {@link './json-exporter.ts' transferLayout}
 * can mutate it in place after layout.
 */
import type {
  ElkExtendedEdge,
  ElkLabel,
  ElkNode,
  ElkPort,
} from './elk-types.js';
import {
  LEdge,
  LGraph,
  LLabel,
  LNode,
  LPort,
} from '../layered/lgraph.js';
import { findProperty, parseOptionValue } from '../options/parsers.js';

/** Symbol that links an LGraphElement back to its source JSON object. */
export const SOURCE_JSON = Symbol('sourceJson');

/** Marker stored on `LGraph` indicating layout has actually been computed. */
export const LAID_OUT = Symbol('laidOut');

interface MaybeWithSource {
  [SOURCE_JSON]?: object;
}

/** Importer entry point: build an `LGraph` from a JSON `ElkNode` root. */
export function importGraph(json: ElkNode): LGraph {
  const graph = new LGraph();
  (graph as MaybeWithSource)[SOURCE_JSON] = json;

  applyLayoutOptions(graph, json.layoutOptions);

  // Map external id → LPort (used to resolve edge endpoints).
  const portIndex = new Map<string, LPort>();
  // Map external id → LNode (so edges by node-id can resolve too).
  const nodeIndex = new Map<string, LNode>();

  let idCounter = 0;

  // ---- nodes (top-level children) ----
  if (json.children) {
    for (const childJson of json.children) {
      const lnode = transformNode(childJson, ++idCounter, nodeIndex, portIndex, () => ++idCounter);
      lnode.graph = graph;
      graph.layerlessNodes.push(lnode);
    }
  }

  // ---- edges ----
  if (json.edges) {
    for (const edgeJson of json.edges) {
      transformEdge(edgeJson, ++idCounter, nodeIndex, portIndex, graph, () => ++idCounter);
    }
  }

  // ---- root labels (rare for layered, but parse for round-trip) ----
  if (json.labels) {
    // Stash labels on the graph holder via a reserved key — we don't model
    // graph-level labels in LGraph, but we want them to round-trip.
    // No-op: exporter walks the JSON directly, so we can ignore here.
  }

  return graph;
}

function transformNode(
  json: ElkNode,
  id: number,
  nodeIndex: Map<string, LNode>,
  portIndex: Map<string, LPort>,
  nextId: () => number
): LNode {
  const lnode = new LNode();
  lnode.id = id;
  lnode.externalId = json.id;
  (lnode as MaybeWithSource)[SOURCE_JSON] = json;
  if (json.id !== undefined) nodeIndex.set(json.id, lnode);

  if (typeof json.width === 'number') lnode.size.x = json.width;
  if (typeof json.height === 'number') lnode.size.y = json.height;
  if (typeof json.x === 'number') lnode.position.x = json.x;
  if (typeof json.y === 'number') lnode.position.y = json.y;

  applyLayoutOptions(lnode, json.layoutOptions);

  if (json.ports) {
    for (const portJson of json.ports) {
      const lport = transformPort(portJson, nextId());
      lport.node = lnode;
      lnode.ports.push(lport);
      portIndex.set(portJson.id, lport);
    }
  }
  if (json.labels) {
    for (const labelJson of json.labels) {
      const llabel = transformLabel(labelJson, nextId());
      llabel.parent = lnode;
      lnode.labels.push(llabel);
    }
  }
  return lnode;
}

function transformPort(json: ElkPort, id: number): LPort {
  const lport = new LPort();
  lport.id = id;
  lport.externalId = json.id;
  (lport as MaybeWithSource)[SOURCE_JSON] = json;

  if (typeof json.width === 'number') lport.size.x = json.width;
  if (typeof json.height === 'number') lport.size.y = json.height;
  if (typeof json.x === 'number') lport.position.x = json.x;
  if (typeof json.y === 'number') lport.position.y = json.y;

  applyLayoutOptions(lport, json.layoutOptions);

  // Pull port.anchor into the typed `anchor` field for convenience; keep the
  // raw property too (so re-export of `layoutOptions` includes it).
  const anchor = lport.getRawProperty('elk.port.anchor') as
    | { x: number; y: number }
    | undefined;
  if (anchor) {
    lport.anchor.x = anchor.x;
    lport.anchor.y = anchor.y;
  }

  return lport;
}

function transformLabel(json: ElkLabel, id: number): LLabel {
  const ll = new LLabel();
  ll.id = id;
  ll.text = json.text ?? '';
  (ll as MaybeWithSource)[SOURCE_JSON] = json;
  if (typeof json.width === 'number') ll.size.x = json.width;
  if (typeof json.height === 'number') ll.size.y = json.height;
  if (typeof json.x === 'number') ll.position.x = json.x;
  if (typeof json.y === 'number') ll.position.y = json.y;
  applyLayoutOptions(ll, json.layoutOptions);
  return ll;
}

function transformEdge(
  json: ElkExtendedEdge,
  id: number,
  nodeIndex: Map<string, LNode>,
  portIndex: Map<string, LPort>,
  _graph: LGraph,
  nextId: () => number
): LEdge {
  const ledge = new LEdge();
  ledge.id = id;
  ledge.externalId = json.id;
  (ledge as MaybeWithSource)[SOURCE_JSON] = json;
  applyLayoutOptions(ledge, json.layoutOptions);

  // For MVP we only handle the first source/target (no hyperedges).
  const sourceRef = json.sources?.[0];
  const targetRef = json.targets?.[0];
  ledge.setSource(resolveEndpoint(sourceRef, nodeIndex, portIndex, nextId));
  ledge.setTarget(resolveEndpoint(targetRef, nodeIndex, portIndex, nextId));

  if (json.labels) {
    for (const labelJson of json.labels) {
      const llabel = transformLabel(labelJson, nextId());
      llabel.parent = ledge;
      ledge.labels.push(llabel);
    }
  }

  return ledge;
}

/**
 * Resolves an edge endpoint reference. If it's a port id, returns the port.
 * If it's a node id (no port specified), creates a dummy port on the node
 * (mirrors `JsonImporter.findPortOrNode`).
 */
function resolveEndpoint(
  ref: string | undefined,
  nodeIndex: Map<string, LNode>,
  portIndex: Map<string, LPort>,
  nextId: () => number
): LPort | null {
  if (!ref) return null;
  const port = portIndex.get(ref);
  if (port) return port;
  const node = nodeIndex.get(ref);
  if (node) {
    const dummy = new LPort();
    dummy.id = nextId();
    dummy.dummy = true;
    dummy.node = node;
    node.ports.push(dummy);
    return dummy;
  }
  return null;
}

/** Parse `layoutOptions` from JSON onto a property holder. */
function applyLayoutOptions(
  holder: { setRawProperty(id: string, v: unknown): void },
  options: Record<string, string> | undefined
): void {
  if (!options) return;
  for (const [id, raw] of Object.entries(options)) {
    holder.setRawProperty(id, parseOptionValue(id, raw));
    // Side-channel: even unknown options are kept on the holder by id.
    void findProperty; // kept for future strict-mode toggling
  }
}
