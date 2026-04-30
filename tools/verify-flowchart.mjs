import { ELK } from '../src/index.js';

const blocks = [
  { id: '827', anchorsCount: 3, head: true },
  { id: '5601', anchorsCount: 1 },
  { id: '828', anchorsCount: 3 },
  { id: '829', anchorsCount: 5 },
  { id: '4401', anchorsCount: 2 },
  { id: '4501', anchorsCount: 1 },
  { id: '4601', anchorsCount: 2 },
  { id: '4602', anchorsCount: 1 },
  { id: '4701', anchorsCount: 1 },
  { id: '4801', anchorsCount: 1 },
  { id: '4901', anchorsCount: 1 },
];

const conns = [
  { id: '1875', src: '827', dst: '828', label: 'Нужного аккаунта нет в саджесте' },
  { id: '1876', src: '827', dst: '829', label: 'В саджесте лишние аккаунты' },
  { id: '1877', src: '828', dst: '4401', label: 'В долгий шаг' },
  { id: '1878', src: '828', dst: '4701', label: 'В кривой шаг' },
  { id: '1879', src: '829', dst: '4501', label: 'В последний шаг ветки' },
  { id: '1880', src: '829', dst: '4801', label: 'Негатив 1' },
  { id: '1881', src: '829', dst: '4901', label: 'Негатив 2' },
  { id: '1882', src: '829', dst: '5601', label: 'Негатив 3' },
  { id: '1883', src: '4401', dst: '4601', label: 'прямо' },
  { id: '1884', src: '4601', dst: '4602', label: 'Еще дальше' },
];

// build "out" port indexes per src
const outIdx = {};
for (const c of conns) outIdx[c.src] = (outIdx[c.src] ?? 0);

const children = blocks.map((b) => {
  const inSlots = conns.filter(c => c.dst === b.id).length;
  const outSlots = conns.filter(c => c.src === b.id).length;
  const ports = [];
  // inputs
  if (inSlots > 0) {
    ports.push({ id: `${b.id}-IN`, width: 0, height: 0, layoutOptions: { 'elk.port.side':'WEST', 'elk.port.index':'0', 'elk.port.borderOffset':'0', 'elk.port.anchor':'0,68' } });
  }
  // outs (indexed)
  let i = 0;
  for (const c of conns.filter(cc => cc.src === b.id)) {
    ports.push({ id: `${c.id}-OUT`, width: 0, height: 0, layoutOptions: { 'elk.port.side':'EAST','elk.port.index': String(i), 'elk.port.borderOffset':'0', 'elk.port.anchor':'0,68' } });
    i++;
  }
  return {
    id: b.id, width: 280, height: 280,
    layoutOptions: { 'elk.portAlignment.default':'BEGIN', ...(b.head ? { 'elk.layered.crossingMinimization.positionConstraint':'FIRST', 'elk.layered.layering.layerConstraint':'FIRST' } : {}) },
    ports,
  };
});

const edges = conns.map(c => ({
  id: c.id,
  sources: [`${c.id}-OUT`],
  targets: [`${c.dst}-IN`],
  labels: [{ text: c.label, width: c.label.length * 7, height: 14 }],
}));

const graph = {
  id: 'root',
  layoutOptions: {
    'elk.algorithm':'layered',
    'elk.spacing.edgeNode':'50.0',
    'elk.spacing.nodeNode':'50.0',
    'elk.layered.nodePlacement.strategy':'BRANDES_KOEPF',
    'elk.layered.spacing.edgeNodeBetweenLayers':'20.0',
    'elk.layered.edgeRouting':'POLYLINE',
    'elk.edge.thickness':'2.0',
    'elk.layered.considerModelOrder.strategy':'PREFER_EDGES',
    'elk.layered.considerModelOrder.portModelOrder':'true',
    'elk.layered.crossingMinimization.strategy':'NONE',
    'elk.spacing.portPort':'0',
    'elk.layered.wrapping.additionalEdgeSpacing':'0',
  },
  children, edges,
};

const elk = new ELK();
const r = await elk.layout(graph);
console.log('blocks:');
for (const c of r.children) {
  console.log(`  ${c.id}: x=${c.x}, y=${c.y}`);
}
console.log('edges:');
for (const e of r.edges) {
  const s = e.sections?.[0];
  console.log(`  ${e.id}: pts=${(s?.bendPoints?.length ?? 0) + 2}, start=(${s?.startPoint?.x},${s?.startPoint?.y}) end=(${s?.endPoint?.x},${s?.endPoint?.y})`);
}
console.log('size:', r.width, 'x', r.height);
