/**
 * Public-facing JSON shapes, identical to `elkjs/typings/elk-api.d.ts`.
 *
 * Re-declared here so the package has zero runtime dependency on `elkjs`.
 */

export type LayoutOptions = Record<string, string>;

export interface ElkPoint {
  x: number;
  y: number;
}

export interface ElkGraphElement {
  id?: string;
  labels?: ElkLabel[];
  layoutOptions?: LayoutOptions;
}

export interface ElkShape extends ElkGraphElement {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface ElkLabel extends ElkShape {
  text?: string;
}

export interface ElkPort extends ElkShape {
  id: string;
}

export interface ElkEdgeSection extends ElkGraphElement {
  id: string;
  startPoint: ElkPoint;
  endPoint: ElkPoint;
  bendPoints?: ElkPoint[];
  incomingShape?: string;
  outgoingShape?: string;
  incomingSections?: string[];
  outgoingSections?: string[];
}

export interface ElkExtendedEdge extends ElkGraphElement {
  id: string;
  sources: string[];
  targets: string[];
  sections?: ElkEdgeSection[];
  container?: string;
  junctionPoints?: ElkPoint[];
}

export interface ElkNode extends ElkShape {
  id: string;
  children?: ElkNode[];
  ports?: ElkPort[];
  edges?: ElkExtendedEdge[];
}
