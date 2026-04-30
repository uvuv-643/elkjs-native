/**
 * Layered-internal graph structures (`LGraph`/`LNode`/`LEdge`/`LPort`/
 * `LLabel`/`Layer`).
 *
 * Mirrors `org.eclipse.elk.alg.layered.graph.*` but stripped of EMF, change
 * notifications and compound-graph plumbing. Plain data classes, mutable.
 */
import { KVector, KVectorChain } from '../math/kvector.js';
import { PropertyHolder } from '../properties.js';
import { PortSide } from '../options/enums.js';

/** Common base for everything that carries properties. */
export class LGraphElement extends PropertyHolder {
  /** Numeric handle assigned during importer; used as Int32Array index in P4. */
  id = 0;
}

/** Node type — mirrors `LNode.NodeType`. Only the values we actually emit. */
export enum NodeType {
  NORMAL = 'NORMAL',
  LONG_EDGE = 'LONG_EDGE',
  EXTERNAL_PORT = 'EXTERNAL_PORT',
  NORTH_SOUTH_PORT = 'NORTH_SOUTH_PORT',
  LABEL = 'LABEL',
  BIG_NODE = 'BIG_NODE',
  BREAKING_POINT = 'BREAKING_POINT',
  BREAKING_POINT_TARGET = 'BREAKING_POINT_TARGET',
}

/** Padding rectangle around a graph. */
export class LPadding {
  top = 0;
  left = 0;
  bottom = 0;
  right = 0;

  constructor(top = 0, left = 0, bottom = 0, right = 0) {
    this.top = top;
    this.left = left;
    this.bottom = bottom;
    this.right = right;
  }

  /** Adds padding values from `other` into this. */
  add(other: LPadding): this {
    this.top += other.top;
    this.left += other.left;
    this.bottom += other.bottom;
    this.right += other.right;
    return this;
  }

  clone(): LPadding {
    return new LPadding(this.top, this.left, this.bottom, this.right);
  }
}

/** Margins around a single node. Same shape as {@link LPadding}. */
export class LMargin extends LPadding {}

export class LLabel extends LGraphElement {
  text = '';
  position = new KVector();
  size = new KVector();

  /** Label's owner (node, port, or edge). Set on attach. */
  parent: LGraphElement | null = null;
}

export class LPort extends LGraphElement {
  /** External id from the JSON, or auto-generated for dummy ports. */
  externalId: string | undefined;
  position = new KVector();
  size = new KVector();
  /** Anchor point (relative to port top-left). */
  anchor = new KVector();
  side: PortSide = PortSide.UNDEFINED;
  margin = new LMargin();
  labels: LLabel[] = [];

  node: LNode | null = null;
  /** Adjacency. Always kept in sync via {@link LEdge.setSource} / `setTarget`. */
  outgoingEdges: LEdge[] = [];
  incomingEdges: LEdge[] = [];

  /** True if this port is an artificial dummy created for an unattached edge. */
  dummy = false;

  /**
   * Mirrors `LPort.getAbsoluteAnchor()`: position of the port anchor
   * relative to the containing graph (= node.position + port.position +
   * port.anchor). Returns a fresh vector.
   */
  getAbsoluteAnchor(): KVector {
    const np = this.node?.position ?? new KVector();
    return new KVector(
      np.x + this.position.x + this.anchor.x,
      np.y + this.position.y + this.anchor.y
    );
  }

  /** All edges incident to this port (incoming + outgoing). */
  *getConnectedEdges(): IterableIterator<LEdge> {
    for (const e of this.incomingEdges) yield e;
    for (const e of this.outgoingEdges) yield e;
  }
}

export class LEdge extends LGraphElement {
  externalId: string | undefined;
  labels: LLabel[] = [];
  bendPoints = new KVectorChain();

  private _source: LPort | null = null;
  private _target: LPort | null = null;

  get source(): LPort | null {
    return this._source;
  }

  get target(): LPort | null {
    return this._target;
  }

  /** Attaches the edge as outgoing of `port`. Detaches the previous source. */
  setSource(port: LPort | null): void {
    if (this._source) {
      const idx = this._source.outgoingEdges.indexOf(this);
      if (idx >= 0) this._source.outgoingEdges.splice(idx, 1);
    }
    this._source = port;
    if (port) port.outgoingEdges.push(this);
  }

  setTarget(port: LPort | null): void {
    if (this._target) {
      const idx = this._target.incomingEdges.indexOf(this);
      if (idx >= 0) this._target.incomingEdges.splice(idx, 1);
    }
    this._target = port;
    if (port) port.incomingEdges.push(this);
  }

  /** Swaps source and target endpoints (used by cycle breaker). */
  reverse(): void {
    const s = this._source;
    const t = this._target;
    // Detach both first to keep adjacency clean.
    this.setSource(null);
    this.setTarget(null);
    this.setSource(t);
    this.setTarget(s);
  }

  /** Mirrors `LEdge.isSelfLoop()`. */
  isSelfLoop(): boolean {
    return !!this._source && !!this._target && this._source.node === this._target.node;
  }

  /** Mirrors `LEdge.isInLayerEdge()`. */
  isInLayerEdge(): boolean {
    if (!this._source || !this._target) return false;
    if (this.isSelfLoop()) return false;
    return this._source.node?.layer === this._target.node?.layer;
  }
}

export class LNode extends LGraphElement {
  externalId: string | undefined;
  type: NodeType = NodeType.NORMAL;
  position = new KVector();
  size = new KVector();
  margin = new LMargin();
  ports: LPort[] = [];
  labels: LLabel[] = [];

  /** The layer this node belongs to (set by P2). */
  layer: Layer | null = null;

  /**
   * The graph this node lives in (top-level only — we don't model compound
   * graphs in MVP).
   */
  graph: LGraph | null = null;

  /** Convenience: all incoming edges across all ports. */
  *getIncomingEdges(): IterableIterator<LEdge> {
    for (const p of this.ports) for (const e of p.incomingEdges) yield e;
  }

  /** Convenience: all outgoing edges across all ports. */
  *getOutgoingEdges(): IterableIterator<LEdge> {
    for (const p of this.ports) for (const e of p.outgoingEdges) yield e;
  }
}

export class Layer extends LGraphElement {
  nodes: LNode[] = [];
  graph: LGraph;
  /** Bounding-box size of the layer, computed by P4 helpers. */
  size = new KVector();

  constructor(graph: LGraph) {
    super();
    this.graph = graph;
  }
}

export class LGraph extends LGraphElement {
  size = new KVector();
  offset = new KVector();
  padding = new LPadding();

  /**
   * Nodes that have not yet been assigned to a layer. Populated by the
   * importer; emptied by P2 (layering); refilled by some intermediates.
   */
  layerlessNodes: LNode[] = [];
  layers: Layer[] = [];

  /** Compound parent — always `null` in the MVP (flat graphs only). */
  parentNode: LNode | null = null;
}
