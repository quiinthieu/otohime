// Jeff Jones (2010) Physarum, seeded and CPU-side, so the sumi toy and the
// Work/Projects veins share one trail. WebGL only paints this buffer.

export const MOULD_PRESETS = ["work-pipeline", "projects-constellation", "petri-ring"] as const;
export type MouldPresetId = (typeof MOULD_PRESETS)[number];
export type MouldWeightMode = "commits" | "throughput" | "blended";

export const WEIGHT_BASIS =
  "Commit counts are non-merge commits that touch each project's route. Pipeline and stack throughput weights are illustrative, not measured throughput.";

export const PIPELINE_THROUGHPUT = { source: 0.62, queue: 0.84, warehouse: 1.2, dashboard: 0.5 } as const;

export type MouldNode = {
  id: string;
  label: string;
  kind: "station" | "stack" | "project" | "food";
  href?: string;
  x: number;
  y: number;
  commits: number;
  throughputWeight: number;
  depositWeight: number;
  swatch: string;
};

export type MouldEdge = { from: string; to: string; weight: number; kind: "pipeline" | "project" };

export type MouldGraphData = {
  generatedAt: string;
  head: string | null;
  weightBasis: string;
  workGraph: { nodes: MouldNode[]; edges: MouldEdge[] };
  projectsGraph: { nodes: MouldNode[]; edges: MouldEdge[] };
};

export type MouldWorldConfig = {
  seed: number;
  width: number;
  height: number;
  agentCount: number;
  preset: MouldPresetId;
  weightMode: MouldWeightMode;
  nodes?: MouldNode[];
  edges?: MouldEdge[];
  sensorAngle?: number;
  sensorDistance?: number;
  turnAngle?: number;
  stepSize?: number;
  decay?: number;
};

export type MouldWorld = {
  config: MouldWorldConfig;
  foods: MouldNode[];
  edges: MouldEdge[];
  agents: { x: Float32Array; y: Float32Array; angle: Float32Array; weight: Float32Array };
  trail: Float32Array;
  nextTrail: Float32Array;
  rngState: number;
  stepCount: number;
};

const PAPER: [number, number, number] = [246, 241, 230];
const INK: [number, number, number] = [23, 22, 20];
const RING = ["#231e16", "#c4492c", "#e2a23a", "#6d8f62", "#3e4d73", "#7f97b8", "#ef6a4c"];

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const round = (n: number, places = 4) => {
  const m = 10 ** places;
  return Math.round(n * m) / m;
};

export function computeVeinWeight(commits: number, throughputWeight: number, mode: MouldWeightMode = "blended") {
  const commitT = Math.atan(Math.max(0, commits)) / (Math.PI / 2);
  const throughT = Math.atan(Math.max(0, throughputWeight)) / (Math.PI / 2);
  const t = mode === "commits" ? commitT : mode === "throughput" ? throughT : (commitT + throughT) / 2;
  return {
    depositWeight: round(0.35 + 0.65 * t, 6),
    strokeWidthPx: round(1.25 + 4.25 * t, 6),
  };
}

function nextUnit(world: { rngState: number }) {
  let a = world.rngState | 0;
  a = (a + 0x6d2b79f5) | 0;
  world.rngState = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function petriDish(mode: MouldWeightMode = "commits") {
  return petriRing(mode);
}

function petriRing(mode: MouldWeightMode): { nodes: MouldNode[]; edges: MouldEdge[] } {
  const nodes: MouldNode[] = [];
  for (let i = 0; i < 7; i++) {
    const angle = -Math.PI / 2 + (i / 7) * Math.PI * 2;
    const commits = 4 + i * 5;
    const throughputWeight = 0.35 + i * 0.12;
    nodes.push({
      id: `ring-${i}`,
      label: `Dish ${i + 1}`,
      kind: "food",
      x: round(0.5 + Math.cos(angle) * 0.32),
      y: round(0.5 + Math.sin(angle) * 0.3),
      commits,
      throughputWeight,
      depositWeight: computeVeinWeight(commits, throughputWeight, mode).depositWeight,
      swatch: RING[i],
    });
  }
  const edges = nodes.map((node, i) => ({
    from: node.id,
    to: nodes[(i + 1) % nodes.length].id,
    weight: 0.7,
    kind: "project" as const,
  }));
  return { nodes, edges };
}

function placed(node: MouldNode, mode: MouldWeightMode): MouldNode {
  return { ...node, depositWeight: computeVeinWeight(node.commits, node.throughputWeight, mode).depositWeight };
}

export function createMouldWorld(config: MouldWorldConfig): MouldWorld {
  const mode = config.weightMode;
  const preset = config.nodes ? null : config.preset === "petri-ring" ? petriRing(mode) : null;
  const nodes = (config.nodes ?? preset?.nodes ?? []).map((node) => placed(node, mode));
  const edges = config.edges ?? preset?.edges ?? [];
  const world: MouldWorld = {
    config: { ...config, weightMode: mode },
    foods: nodes,
    edges,
    agents: {
      x: new Float32Array(config.agentCount),
      y: new Float32Array(config.agentCount),
      angle: new Float32Array(config.agentCount),
      weight: new Float32Array(config.agentCount),
    },
    trail: new Float32Array(config.width * config.height),
    nextTrail: new Float32Array(config.width * config.height),
    rngState: config.seed >>> 0,
    stepCount: 0,
  };
  const weight = nodes.reduce((sum, node) => sum + node.depositWeight, 0) / Math.max(1, nodes.length);
  for (let i = 0; i < config.agentCount; i++) {
    world.agents.x[i] = nextUnit(world) * (config.width - 1);
    world.agents.y[i] = nextUnit(world) * (config.height - 1);
    world.agents.angle[i] = nextUnit(world) * Math.PI * 2;
    world.agents.weight[i] = weight || 0.5;
  }
  return world;
}

function cell(world: MouldWorld, x: number, y: number) {
  const w = world.config.width;
  const h = world.config.height;
  const ix = ((Math.floor(x) % w) + w) % w;
  const iy = ((Math.floor(y) % h) + h) % h;
  return iy * w + ix;
}

function read(world: MouldWorld, x: number, y: number) {
  return world.trail[cell(world, x, y)];
}

function add(world: MouldWorld, x: number, y: number, amount: number) {
  if (amount <= 0) return;
  world.trail[cell(world, x, y)] += amount;
}

function toPixel(world: MouldWorld, normX: number, normY: number) {
  return {
    x: clamp(normX, 0, 1) * (world.config.width - 1),
    y: clamp(normY, 0, 1) * (world.config.height - 1),
  };
}

function stampDisk(world: MouldWorld, normX: number, normY: number, radius: number, amount: number) {
  const { x: cx, y: cy } = toPixel(world, normX, normY);
  const r = Math.max(1, radius);
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r * r) add(world, x, y, amount);
    }
  }
}

function stampSegment(world: MouldWorld, a: MouldNode, b: MouldNode, amount: number) {
  const from = toPixel(world, a.x, a.y);
  const to = toPixel(world, b.x, b.y);
  const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y)));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    add(world, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, amount);
  }
}

function depositAttractors(world: MouldWorld) {
  const byId = new Map(world.foods.map((node) => [node.id, node]));
  for (const food of world.foods) stampDisk(world, food.x, food.y, 2.2, food.depositWeight * 1.15);
  for (const edge of world.edges) {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    if (from && to) stampSegment(world, from, to, Math.max(edge.weight, 0.35) * 0.85);
  }
}

function diffuse(world: MouldWorld) {
  const { width: w, height: h, decay = 0.9 } = world.config;
  const src = world.trail;
  const dst = world.nextTrail;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let oy = -1; oy <= 1; oy++) {
        const yy = (y + oy + h) % h;
        for (let ox = -1; ox <= 1; ox++) sum += src[yy * w + ((x + ox + w) % w)];
      }
      dst[y * w + x] = (sum / 9) * decay;
    }
  }
  world.trail = dst;
  world.nextTrail = src;
  world.nextTrail.fill(0);
}

export function stepMouldWorld(world: MouldWorld, steps = 1): MouldWorld {
  const { width, height, sensorAngle = 0.5, sensorDistance = 3.2, turnAngle = 0.42, stepSize = 1 } = world.config;
  const { x, y, angle, weight } = world.agents;
  for (let n = 0; n < steps; n++) {
    for (let i = 0; i < x.length; i++) {
      const a = angle[i];
      const left = read(world, x[i] + Math.cos(a - sensorAngle) * sensorDistance, y[i] + Math.sin(a - sensorAngle) * sensorDistance);
      const forward = read(world, x[i] + Math.cos(a) * sensorDistance, y[i] + Math.sin(a) * sensorDistance);
      const right = read(world, x[i] + Math.cos(a + sensorAngle) * sensorDistance, y[i] + Math.sin(a + sensorAngle) * sensorDistance);
      if (forward >= left && forward >= right) angle[i] += (nextUnit(world) - 0.5) * 0.08;
      else if (left > right) angle[i] = a - turnAngle;
      else if (right > left) angle[i] = a + turnAngle;
      else angle[i] = a + (nextUnit(world) - 0.5) * turnAngle;
      x[i] = (x[i] + Math.cos(angle[i]) * stepSize + width) % width;
      y[i] = (y[i] + Math.sin(angle[i]) * stepSize + height) % height;
      add(world, x[i], y[i], weight[i] * 0.45);
    }
    depositAttractors(world);
    diffuse(world);
    world.stepCount += 1;
  }
  return world;
}

export function dropMouldFood(world: MouldWorld, normX: number, normY: number, radius = 0.045, strength = 0.9): MouldNode {
  const x = clamp(normX, 0, 1);
  const y = clamp(normY, 0, 1);
  const node: MouldNode = {
    id: `food-${world.foods.length}-${Math.round(x * 1000)}-${Math.round(y * 1000)}`,
    label: "Food",
    kind: "food",
    x,
    y,
    commits: 0,
    throughputWeight: strength,
    depositWeight: clamp(strength, 0.35, 1),
    swatch: "#171614",
  };
  world.foods.push(node);
  stampDisk(world, x, y, Math.max(2, radius * world.config.width), node.depositWeight * 3);
  return node;
}

export function repelMouldAt(world: MouldWorld, normX: number, normY: number, radius = 0.08): MouldWorld {
  const { x: cx, y: cy } = toPixel(world, normX, normY);
  const r = Math.max(1, radius * world.config.width);
  const r2 = r * r;
  const { width: w, height: h } = world.config;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) world.trail[y * w + x] = 0;
    }
  }
  const agents = world.agents;
  for (let i = 0; i < agents.x.length; i++) {
    const dx = agents.x[i] - cx;
    const dy = agents.y[i] - cy;
    if (dx * dx + dy * dy > r2 * 1.6) continue;
    agents.angle[i] = Math.atan2(dy, dx);
    agents.x[i] = (agents.x[i] + Math.cos(agents.angle[i]) * 2 + w) % w;
    agents.y[i] = (agents.y[i] + Math.sin(agents.angle[i]) * 2 + h) % h;
  }
  return world;
}

export function boostMouldNode(world: MouldWorld, id: string, amount = 0.18): MouldWorld {
  const node = world.foods.find((food) => food.id === id);
  if (!node) return world;
  node.depositWeight = clamp(node.depositWeight + amount, 0.35, 1);
  stampDisk(world, node.x, node.y, 3, amount * 4);
  return world;
}

export function resetMouldWorld(world: MouldWorld, preset?: MouldPresetId): MouldWorld {
  return createMouldWorld({ ...world.config, preset: preset ?? world.config.preset });
}

export function settleMouldWorld(config: MouldWorldConfig, warmupSteps = 90): MouldWorld {
  return stepMouldWorld(createMouldWorld(config), warmupSteps);
}

export function sampleSumiInkRgba(trailValue: number, grainNoise: number): [number, number, number, number] {
  const t = Math.max(0, trailValue);
  const grain = (clamp(grainNoise, 0, 1) - 0.5) * 0.12;
  const ink = clamp(smoothstep(0.04, 0.62, t) + grain * Math.min(1, t * 3), 0, 1);
  const bleed = smoothstep(0.02, 0.22, t) * 0.28;
  const mix = clamp(ink * 0.92 + bleed, 0, 1);
  return [
    Math.round(PAPER[0] + (INK[0] - PAPER[0]) * mix),
    Math.round(PAPER[1] + (INK[1] - PAPER[1]) * mix),
    Math.round(PAPER[2] + (INK[2] - PAPER[2]) * mix),
    255,
  ];
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export type MouldProjectInput = {
  title: string;
  href?: string;
  colour?: string;
  commits: number;
};

const SWATCH: Record<string, string> = {
  yellow: "#f4b829",
  coral: "#ef6a4c",
  mint: "#93d3b0",
  blue: "#76a0e2",
  pink: "#f3a6bb",
};

export function buildMouldGraph(input: {
  generatedAt: string;
  head: string | null;
  projects: readonly MouldProjectInput[];
  stack: readonly { what: string; tools: string }[];
}): MouldGraphData {
  const stationIds = ["source", "queue", "warehouse", "dashboard"] as const;
  const stationLabels = ["Source", "Queue", "Warehouse", "Dashboard"];
  const stationSwatch = ["#231e16", "#6d8f62", "#3e4d73", "#c4492c"];
  const workNodes: MouldNode[] = stationIds.map((id, i) => {
    const throughputWeight = PIPELINE_THROUGHPUT[id];
    return {
      id,
      label: stationLabels[i],
      kind: "station",
      href: "/work",
      x: round(0.12 + i * 0.25),
      y: 0.34,
      commits: 0,
      throughputWeight,
      depositWeight: computeVeinWeight(0, throughputWeight, "throughput").depositWeight,
      swatch: stationSwatch[i],
    };
  });
  input.stack.forEach((item, i) => {
    const throughputWeight = round(0.4 + i * 0.06);
    const n = Math.max(1, input.stack.length - 1);
    workNodes.push({
      id: item.what.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      label: item.what,
      kind: "stack",
      href: "/work",
      x: round(0.14 + (i / n) * 0.72),
      y: 0.74,
      commits: 0,
      throughputWeight,
      depositWeight: computeVeinWeight(0, throughputWeight, "throughput").depositWeight,
      swatch: "#8a8175",
    });
  });
  const workEdges: MouldEdge[] = [];
  for (let i = 0; i < stationIds.length - 1; i++) {
    workEdges.push({
      from: stationIds[i],
      to: stationIds[i + 1],
      weight: round((PIPELINE_THROUGHPUT[stationIds[i]] + PIPELINE_THROUGHPUT[stationIds[i + 1]]) / 2),
      kind: "pipeline",
    });
  }
  for (const node of workNodes) {
    if (node.kind === "stack") workEdges.push({ from: "warehouse", to: node.id, weight: node.throughputWeight, kind: "pipeline" });
  }

  const projects = input.projects.filter((project) => project.href);
  const projectNodes: MouldNode[] = projects.map((project, i) => {
    const angle = -Math.PI / 2 + (i / Math.max(1, projects.length)) * Math.PI * 2;
    const slug = project.href!.replace(/^\//, "");
    return {
      id: slug,
      label: project.title,
      kind: "project",
      href: project.href,
      x: round(0.5 + Math.cos(angle) * 0.36),
      y: round(0.5 + Math.sin(angle) * 0.32),
      commits: project.commits,
      throughputWeight: round(0.45 + (project.commits > 0 ? 0.25 : 0)),
      depositWeight: computeVeinWeight(project.commits, 0.45, "commits").depositWeight,
      swatch: SWATCH[project.colour ?? ""] ?? "#231e16",
    };
  });
  const projectEdges: MouldEdge[] = projectNodes.map((node, i) => ({
    from: node.id,
    to: projectNodes[(i + 1) % projectNodes.length].id,
    weight: round((node.depositWeight + projectNodes[(i + 1) % projectNodes.length].depositWeight) / 2),
    kind: "project",
  }));

  return {
    generatedAt: input.generatedAt,
    head: input.head,
    weightBasis: WEIGHT_BASIS,
    workGraph: { nodes: workNodes, edges: workEdges },
    projectsGraph: { nodes: projectNodes, edges: projectEdges },
  };
}

export function serializeMouldGraph(data: MouldGraphData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

export function parseMouldGraph(value: unknown): MouldGraphData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as MouldGraphData;
  if (!data.workGraph?.nodes?.length || !data.projectsGraph?.nodes?.length) return null;
  if (typeof data.weightBasis !== "string") return null;
  return data;
}

export function trailChecksum(trail: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < trail.length; i++) sum = (sum + trail[i] * (i + 1)) % 1_000_003;
  return sum;
}
