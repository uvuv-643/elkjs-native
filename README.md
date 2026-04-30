# elkjs-native

Native TypeScript ELK layered layout.

**Install and import**

```sh
npm install elkjs-native
```

```ts
import ELK from 'elkjs-native';
```

**elkjs-native** gives you the ELK layered layout flow without the heavy generated elkjs worker. In real UI code this means the graph does not freeze while the layout bundle wakes up: where elkjs can spend seconds loading a worker and generated runtime, native TypeScript code is imported immediately and starts laying out the graph right away.

It is built for flowcharts, DAG editors, node graphs, pipelines, process diagrams and interactive canvases. You pass nodes with sizes and edges with source/target ids. You get coordinates and routed edge sections back.

## Quick Start

```ts
import ELK from 'elkjs-native';

const elk = new ELK();

const graph = {
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.layered.edgeRouting': 'POLYLINE',
  },
  children: [
    { id: 'start', width: 100, height: 40 },
    { id: 'finish', width: 120, height: 40 },
  ],
  edges: [{ id: 'e1', sources: ['start'], targets: ['finish'] }],
};

const result = elk.layoutSync(graph);

console.log(result.children);
console.log(result.edges);
```

You send this:

```ts
{
  children: [
    { id: 'start', width: 100, height: 40 },
    { id: 'finish', width: 120, height: 40 }
  ],
  edges: [
    { id: 'e1', sources: ['start'], targets: ['finish'] }
  ]
}
```

You get the same graph back with layout data:

```ts
{
  children: [
    { id: 'start', width: 100, height: 40, x: 12, y: 12 },
    { id: 'finish', width: 120, height: 40, x: 132, y: 12 }
  ],
  edges: [
    {
      id: 'e1',
      sources: ['start'],
      targets: ['finish'],
      sections: [
        {
          id: 'e1_s0',
          startPoint: { x: 112, y: 32 },
          endPoint: { x: 132, y: 32 }
        }
      ]
    }
  ]
}
```

The exact numbers depend on spacing, padding, ports and routing options. The contract is simple: **input graph in, positioned graph out**.

## Sync And Async

The native entry point is synchronous:

```ts
const result = elk.layoutSync(graph);
```

This is the best path for editors and render loops where layout should happen inside the same action that changed the graph.

For elkjs compatibility, the package also exposes an async method:

```ts
const result = await elk.layout(graph);
```

The async method does not start a worker. It wraps the same native layout result in a Promise, so existing elkjs code can usually keep the same await-based flow while replacing the import with **elkjs-native**.

Both methods mutate the input graph and return it.

## API

```ts
class ELK {
  layoutSync(graph: ElkNode): ElkNode;
  layout(graph: ElkNode): Promise<ElkNode>;
}
```

Most projects only need the default import:

```ts
import ELK from 'elkjs-native';
```

TypeScript types are exported for graph data, edges, ports, labels, points, options and enums.

## Supported Features And Options

Options use the same layoutOptions object style as elkjs. Values are strings, matching ELK JSON.

```ts
const graph = {
  id: 'root',
  layoutOptions: {
    'elk.algorithm': 'layered',
    'elk.direction': 'RIGHT',
    'elk.padding': '16',
    'elk.spacing.nodeNode': '32',
    'elk.layered.edgeRouting': 'ORTHOGONAL',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  },
  children: [],
  edges: [],
};
```

| Feature / option | Values | What it does | Status |
| --- | --- | --- | --- |
| elk.algorithm | `layered` | Runs the layered layout pipeline for flowcharts, DAGs and left-to-right process graphs. | Full |
| Other ELK algorithms | force, radial, box, stress, tree | Not implemented. This package is intentionally focused on layered layout. | No |
| elk.direction | `RIGHT`, `LEFT`, `DOWN`, `UP` | Controls the main graph direction. The internal layout runs in a canonical direction and is transformed back. | Full |
| layoutSync | sync call | Runs layout immediately and returns the positioned graph. No worker, no async boundary. | Full |
| layout | Promise call | Keeps elkjs-style await compatibility while using the same native engine. | Full |
| Node sizes | width, height | Uses provided node dimensions to place nodes without overlap. | Full |
| Edges | sources, targets | Routes extended ELK edges and writes sections with start/end points and bend points. | Full |
| Ports | port ids, side, index, anchor | Allows edges to connect to explicit ports. Fixed sides and ordering are supported for common editor graphs. | Full |
| Labels | node, edge and port labels | Accepted in the graph shape and used where the current layered pipeline needs label size information. | Partial |
| Connected components | graph components | Splits disconnected parts, lays them out and combines them back into one result. | Full |
| Cycles | cyclic input | Breaks cycles for layered layout and restores routed edges for output. | Full |
| Self-loops | self edges | Routes edges that start and end on the same node. | Full |
| Long edges | edges across many layers | Splits long edges through intermediate layers and joins them back into output sections. | Full |
| elk.padding | number, top/left/bottom/right | Adds outer graph padding. | Full |
| elk.spacing.nodeNode | number | Controls spacing between nodes inside a layer. | Full |
| elk.spacing.edgeNode | number | Controls distance between edges and nodes where supported by routing. | Full |
| elk.spacing.edgeEdge | number | Controls distance between nearby routed edges. | Full |
| elk.spacing.portPort | number | Controls spacing between ports on the same node side. | Full |
| elk.layered.spacing.nodeNodeBetweenLayers | number | Controls distance between layers. This is one of the most useful visual tuning knobs. | Full |
| elk.layered.spacing.edgeEdgeBetweenLayers | number | Controls edge spacing in lanes between layers. | Full |
| elk.layered.spacing.edgeNodeBetweenLayers | number | Controls edge-to-node spacing between layers. | Full |
| elk.port.side | `NORTH`, `EAST`, `SOUTH`, `WEST` | Pins a port to a node side. | Full |
| elk.port.index | number | Orders ports on a side. | Full |
| elk.port.anchor | x,y | Sets a fixed port anchor. | Full |
| elk.portConstraints | `FREE`, `FIXED_SIDE`, `FIXED_ORDER`, `FIXED_RATIO`, `FIXED_POS` | Controls how strictly port positions are respected. | Partial |
| elk.layered.edgeRouting | `POLYLINE`, `ORTHOGONAL` | Produces routed edge sections. Polyline is the default practical path; orthogonal uses axis-aligned segments. | Full |
| elk.layered.edgeRouting | `SPLINES` | Accepted, but falls back to polyline-style routing rather than real curves. | Partial |
| elk.layered.layering.strategy | `LONGEST_PATH`, `NETWORK_SIMPLEX` | Builds layers for the graph. Network simplex is available as a compatible layered path, with longest-path behavior used where it keeps output stable. | Partial |
| elk.layered.crossingMinimization.strategy | `NONE`, `LAYER_SWEEP` | Keeps model order or runs a layer sweep to reduce crossings. | Full |
| elk.layered.nodePlacement.strategy | `BRANDES_KOEPF`, `SIMPLE` | Places nodes inside layers. The supported path is tuned for clean editor-style diagrams. | Partial |
| elk.layered.considerModelOrder.strategy | `NONE`, `NODES_AND_EDGES`, `PREFER_EDGES`, `PREFER_NODES` | Uses input order as a hint for stable diagrams. | Partial |
| Unknown options | any string | Preserved as raw values and ignored when they are not used by the native pipeline. | Partial |

## Development

```sh
pnpm install
pnpm test
pnpm run build
```

The repository keeps real-world fixtures and golden data around the layered pipeline. They are useful when changing the algorithm, but none of the fixture tooling is required to use the package.

## Disclaimer

The fully supported items above are intended for normal use. Partial items may work well for common graphs, but can differ from Java ELK or elkjs on complex inputs. Test graphs that depend on exact routing, port behavior, model order, labels or non-default strategies carefully before relying on them in production.
