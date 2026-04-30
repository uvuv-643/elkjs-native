/**
 * Mirrors `TestGraphCreator.java` from the ELK test suite, but minimal:
 * just enough to construct small `LGraph`s in unit tests for phase
 * processors (used heavily in stages 5–8).
 */
import {
  LEdge,
  LGraph,
  LLabel,
  LNode,
  LPort,
  NodeType,
} from '../layered/lgraph.js';
import { PortSide } from '../options/enums.js';

export class TestGraphBuilder {
  readonly graph: LGraph = new LGraph();
  private idCounter = 0;

  /** Creates a NORMAL node and adds it to `layerlessNodes`. */
  createNode(width = 30, height = 30): LNode {
    const n = new LNode();
    n.id = ++this.idCounter;
    n.type = NodeType.NORMAL;
    n.size.x = width;
    n.size.y = height;
    n.graph = this.graph;
    this.graph.layerlessNodes.push(n);
    return n;
  }

  /** Creates a port on `node` on the given side. */
  createPort(node: LNode, side: PortSide = PortSide.UNDEFINED): LPort {
    const p = new LPort();
    p.id = ++this.idCounter;
    p.side = side;
    p.node = node;
    node.ports.push(p);
    return p;
  }

  /** Creates an edge from `src` (port or node) to `tgt` (port or node). */
  createEdge(src: LNode | LPort, tgt: LNode | LPort): LEdge {
    const e = new LEdge();
    e.id = ++this.idCounter;
    const sourcePort = src instanceof LNode ? this.implicitPort(src) : src;
    const targetPort = tgt instanceof LNode ? this.implicitPort(tgt) : tgt;
    e.setSource(sourcePort);
    e.setTarget(targetPort);
    return e;
  }

  /** Adds a label to a node/edge/port. */
  createLabel(parent: LNode | LEdge | LPort, text: string, w = 0, h = 0): LLabel {
    const l = new LLabel();
    l.id = ++this.idCounter;
    l.text = text;
    l.size.x = w;
    l.size.y = h;
    l.parent = parent;
    parent.labels.push(l);
    return l;
  }

  /** Returns a freshly-built (or first existing) port on the node. */
  private implicitPort(node: LNode): LPort {
    if (node.ports.length === 0) return this.createPort(node);
    return node.ports[0];
  }
}
