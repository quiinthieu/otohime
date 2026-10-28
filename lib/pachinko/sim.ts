// Pure, deterministic 2D Verlet physics and 5-stage data-pipeline simulation
// for Pipeline Pachinko (/play/pachinko). Zero external runtime dependencies.

import { type Cue, MAX_DB } from "../sound.ts";

export const FIXED_DT = 1 / 120;
export const DEFAULT_SUBSTEPS = 3;
export const MAX_ACTIVE_BALLS = 150;
export const MAX_SPEED = 780;
export const DEFAULT_GRAVITY = 720;
export const PEG_RESTITUTION = 0.54;
export const WALL_RESTITUTION = 0.48;
export const BALL_RESTITUTION = 0.52;

export const DEFAULT_BALL_RADIUS = 8;
export const JOINED_BALL_RADIUS = 11.5;
export const DEFAULT_PEG_RADIUS = 5.5;
export const SPATIAL_HASH_CELL_SIZE = 28;

export const BOARD_WIDTH = 600;
export const BOARD_HEIGHT = 860;

export const DLQ_GUTTER_LEFT_X = 24;
export const DLQ_GUTTER_RIGHT_X = 76;
export const DLQ_GUTTER_CENTER_X = 50;

export const PLAYFIELD_LEFT_X = 76;
export const PLAYFIELD_RIGHT_X = 536;
export const PLUNGER_LANE_LEFT_X = 536;
export const PLUNGER_LANE_RIGHT_X = 576;
export const PLUNGER_LANE_CENTER_X = 556;

export const INGEST_TOP_Y = 95;
export const INGEST_BOTTOM_Y = 275;
export const DEDUPE_GATE_Y = 310;
export const DEDUPE_WINDOW_SIZE = 12;

export const FUNNEL_CENTER_X = 306;
export const FUNNEL_TOP_Y = 355;
export const FUNNEL_HOLD_Y = 438;
export const FUNNEL_EXIT_Y = 466;
export const FUNNEL_CAPTURE_RADIUS_X = 54;
export const DEFAULT_JOIN_TIMEOUT_SECONDS = 1.8;

export const PARTITION_TOP_Y = 495;
export const BUCKET_TOP_Y = 720;
export const BUCKET_BOTTOM_Y = 820;

export const ROLLING_WINDOW_SECONDS = 5;
export const DEFAULT_LATE_TRANSIT_THRESHOLD_SECONDS = 3.2;
export const DLQ_STREAK_PAGER_THRESHOLD = 3;

export const DEFAULT_BACKFILL_COUNT = 60;
export const REDUCED_MOTION_BACKFILL_COUNT = 12;
export const DEFAULT_BACKFILL_DURATION_SECONDS = 2.0;
export const DEFAULT_SEED = 0x50414348; // "PACH"

export const MAX_PEG_CLICKS_PER_SECOND = 20;

// Quiet wood-and-brass pachinko pin click cue, capped at <= MAX_DB (-18 dB).
export const PACHINKO_CLICK_CUE: Cue = {
  db: Math.min(-22, MAX_DB),
  wave: "triangle",
  notes: [
    { hz: 1380, at: 0, attack: 0.0015, decay: 0.018 },
    { hz: 920, at: 0.008, attack: 0.0015, decay: 0.022 },
  ],
};

export type PartitionBucketId = "p0" | "p1" | "p2" | "p3" | "p4" | "p5";

export const PARTITION_BUCKET_IDS: readonly PartitionBucketId[] = [
  "p0",
  "p1",
  "p2",
  "p3",
  "p4",
  "p5",
] as const;

export type SinkId = PartitionBucketId | "dlq";

export type PachinkoStageId =
  | "launch"
  | "ingest"
  | "dedupe"
  | "join"
  | "partition"
  | "dlq"
  | "settled";

export type BallStamp = "DUP" | "JOIN" | "LATE" | "DLQ" | null;

export type Peg = {
  id: string;
  x: number;
  y: number;
  radius: number;
  stage: "ingest" | "dedupe" | "join" | "partition" | "dlq";
};

export type SegmentKind =
  | "wall"
  | "plunger-ramp"
  | "plunger-gate"
  | "dedupe-gate"
  | "funnel"
  | "splitter"
  | "dlq-gutter"
  | "bucket-divider";

export type Segment = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: SegmentKind;
};

export type BucketZone = {
  id: SinkId;
  label: string;
  x1: number;
  x2: number;
  centerX: number;
  y1: number;
  y2: number;
};

export type PachinkoBoard = {
  width: number;
  height: number;
  pegs: readonly Peg[];
  segments: readonly Segment[];
  buckets: readonly BucketZone[];
  bucketById: Readonly<Record<SinkId, BucketZone>>;
};

export type InkBall = {
  id: string;
  key: string;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  radius: number;
  mass: number;
  stage: PachinkoStageId;
  spawnedAt: number;
  enteredBoardAt: number | null;
  stamp: BallStamp;
  dedupeChecked: boolean;
  dedupeBounced: boolean;
  heldInJoin: boolean;
  heldSince: number | null;
  joinProcessed: boolean;
  joined: boolean;
  joinedFromIds: readonly string[];
  releasedByJoinTimeout: boolean;
  lateArrival: boolean;
  targetBucket: PartitionBucketId;
  routeToDlq: boolean;
  pegHits: number;
};

export type CompletedRecord = {
  id: string;
  key: string;
  sink: SinkId;
  completedAt: number;
  transitTime: number;
  lateArrival: boolean;
  releasedByJoinTimeout: boolean;
  dedupeBounced: boolean;
  joined: boolean;
};

export type LaunchBallOptions = {
  id?: string;
  key?: string;
  power?: number;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  routeToDlq?: boolean;
  lateArrival?: boolean;
  skipLaunchLane?: boolean;
};

export type ScheduledSpawn = {
  atSimTime: number;
  options: LaunchBallOptions;
};

export type PachinkoSimConfig = {
  seed: number;
  dt: number;
  substeps: number;
  maxActiveBalls: number;
  gravity: number;
  maxSpeed: number;
  pegRestitution: number;
  wallRestitution: number;
  ballRestitution: number;
  dedupeWindowSize: number;
  joinTimeoutSeconds: number;
  lateTransitThresholdSeconds: number;
  rollingWindowSeconds: number;
  dlqProbability: number;
  dlqStreakThreshold: number;
};

export type PachinkoSimEvent =
  | {
      type: "peg-hit";
      ballId: string;
      pegId: string;
      x: number;
      y: number;
      speed: number;
      simTime: number;
    }
  | {
      type: "dedupe-bounce";
      ballId: string;
      key: string;
      x: number;
      y: number;
      simTime: number;
    }
  | {
      type: "join-hold";
      ballId: string;
      key: string;
      simTime: number;
    }
  | {
      type: "join-merge";
      mergedBallId: string;
      firstBallId: string;
      secondBallId: string;
      key: string;
      simTime: number;
    }
  | {
      type: "join-timeout-release";
      ballId: string;
      key: string;
      waitedSeconds: number;
      simTime: number;
    }
  | {
      type: "bucket-land";
      ballId: string;
      key: string;
      bucket: PartitionBucketId;
      lateArrival: boolean;
      simTime: number;
    }
  | {
      type: "dlq-land";
      ballId: string;
      key: string;
      dlqStreak: number;
      pagerTriggered: boolean;
      simTime: number;
    }
  | {
      type: "pager-triggered";
      dlqStreak: number;
      dlqCount: number;
      simTime: number;
    }
  | {
      type: "pager-dismissed";
      simTime: number;
    };

export type PachinkoReadout = {
  buckets: Record<PartitionBucketId, number>;
  totalPartitionCount: number;
  dlqCount: number;
  dlqStreak: number;
  pagerActive: boolean;
  pagerTriggerCount: number;
  recordsPerSec: number;
  lateArrivalPct: number;
  lateArrivalCount: number;
  totalCompleted: number;
  activeBalls: number;
  dedupeBounceCount: number;
  joinMergeCount: number;
  joinTimeoutReleaseCount: number;
};

export type PachinkoSimState = {
  config: PachinkoSimConfig;
  board: PachinkoBoard;
  rngState: number;
  simTime: number;
  stepCount: number;
  nextBallSeq: number;
  balls: InkBall[];
  scheduledSpawns: ScheduledSpawn[];
  recentKeys: string[];
  joinHeldBallId: string | null;
  tiltAccel: number;
  buckets: Record<PartitionBucketId, number>;
  dlqCount: number;
  dlqStreak: number;
  pagerActive: boolean;
  pagerTriggerCount: number;
  dedupeBounceCount: number;
  joinMergeCount: number;
  joinTimeoutReleaseCount: number;
  lateArrivalCount: number;
  totalCompleted: number;
  completedRecords: CompletedRecord[];
  events: PachinkoSimEvent[];
  pegHitsThisStep: number;
};

/**
 * Deterministic 32-bit Mulberry32 PRNG returning values in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nextStateRandom(state: PachinkoSimState): number {
  const a = (state.rngState + 0x6d2b79f5) >>> 0;
  state.rngState = a;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * Deterministic 32-bit FNV-1a hash of a record key string.
 */
export function hashRecordKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Deterministically maps any record key to one of the 6 partition buckets (p0..p5).
 */
export function hashKeyToPartition(key: string): PartitionBucketId {
  const trimmed = key.trim();
  for (const id of PARTITION_BUCKET_IDS) {
    if (trimmed === id || trimmed.startsWith(`${id}:`)) {
      return id;
    }
  }
  const idx = hashRecordKey(trimmed) % PARTITION_BUCKET_IDS.length;
  return PARTITION_BUCKET_IDS[idx] ?? "p0";
}

/**
 * Generates a record key guaranteed to hash to the requested partition bucket (p0..p5).
 */
export function keyForPartitionBucket(
  bucket: PartitionBucketId,
  seq = 1,
): string {
  const targetIdx = PARTITION_BUCKET_IDS.indexOf(bucket);
  for (let attempt = 0; attempt < 256; attempt++) {
    const candidate = `rec-${seq}-${attempt}`;
    if (hashRecordKey(candidate) % PARTITION_BUCKET_IDS.length === targetIdx) {
      return candidate;
    }
  }
  return `${bucket}:rec-${seq}`;
}

/**
 * Maps plunger pull power in [0, 1] to initial launch velocity (vx, vy) in px/s.
 */
export function mapPlungerLaunchVelocity(
  power = 0.75,
  jitter = 0,
): { vx: number; vy: number; clampedPower: number } {
  const clampedPower = Math.max(0, Math.min(1, Number.isFinite(power) ? power : 0.75));
  const vy = -(560 + clampedPower * 210);
  const vx = -18 + (jitter - 0.5) * 16;
  return { vx, vy, clampedPower };
}

/**
 * Maps mobile DeviceOrientationEvent gamma angle (degrees) to horizontal acceleration (px/s^2).
 */
export function mapGammaToTiltAccel(gammaDegrees: number): number {
  if (!Number.isFinite(gammaDegrees)) return 0;
  const clamped = Math.max(-35, Math.min(35, gammaDegrees));
  return Math.round((clamped / 35) * 210 * 100) / 100;
}

/**
 * Builds the static geometry for the 5-stage Pipeline Pachinko board.
 */
export function createPachinkoBoard(): PachinkoBoard {
  const pegs: Peg[] = [];
  const segments: Segment[] = [];

  // 1. Ingest peg lattice (5 staggered rows across playfield x = 104..508, y = 112..256)
  const ingestRows = 5;
  for (let row = 0; row < ingestRows; row++) {
    const y = 112 + row * 36;
    const isOdd = row % 2 === 1;
    const count = isOdd ? 7 : 8;
    const startX = isOdd ? 128 : 104;
    const spacing = 54;
    for (let col = 0; col < count; col++) {
      const x = startX + col * spacing;
      pegs.push({
        id: `ingest-r${row}-c${col}`,
        x,
        y,
        radius: DEFAULT_PEG_RADIUS,
        stage: "ingest",
      });
    }
  }

  // 2. Dedupe filter gate pegs (y = 296..326)
  const dedupeXs = [116, 178, 242, 306, 370, 434, 496];
  for (let i = 0; i < dedupeXs.length; i++) {
    pegs.push({
      id: `dedupe-p${i}`,
      x: dedupeXs[i]!,
      y: DEDUPE_GATE_Y,
      radius: DEFAULT_PEG_RADIUS - 0.5,
      stage: "dedupe",
    });
  }

  // 3. Join funnel guide pegs (strictly above the funnel throat with >= 36px clearance from funnel walls)
  const joinPegCoords: readonly [number, number][] = [
    [242, 356],
    [370, 356],
    [280, 380],
    [332, 380],
  ];
  for (let i = 0; i < joinPegCoords.length; i++) {
    const [x, y] = joinPegCoords[i]!;
    pegs.push({
      id: `join-p${i}`,
      x,
      y,
      radius: DEFAULT_PEG_RADIUS,
      stage: "join",
    });
  }

  // 4. Partition splitter wedge lattice (4 rows fanning out below the funnel exit y = 512..646,
  //    with the bottom row aligned to the 5 bucket dividers so all 6 bucket channels are clear)
  const partitionRows: readonly { y: number; xs: readonly number[] }[] = [
    { y: 512, xs: [268, 344] },
    { y: 556, xs: [229, 306, 383] },
    { y: 600, xs: [191, 268, 344, 421] },
    { y: 646, xs: [153, 229, 306, 383, 459] },
  ];
  for (let r = 0; r < partitionRows.length; r++) {
    const row = partitionRows[r]!;
    for (let c = 0; c < row.xs.length; c++) {
      pegs.push({
        id: `partition-r${r}-c${c}`,
        x: row.xs[c]!,
        y: row.y,
        radius: DEFAULT_PEG_RADIUS,
        stage: "partition",
      });
    }
  }

  // 5. DLQ side-gutter pegs (alternating side pins at x = 30 and x = 70 leaving center channel clear)
  const dlqPegCoords: readonly [number, number][] = [
    [30, 370],
    [70, 460],
    [30, 550],
    [70, 640],
  ];
  for (let i = 0; i < dlqPegCoords.length; i++) {
    const [x, y] = dlqPegCoords[i]!;
    pegs.push({
      id: `dlq-p${i}`,
      x,
      y,
      radius: 3.5,
      stage: "dlq",
    });
  }

  // Board outer walls and plunger ramp
  segments.push(
    {
      id: "wall-left-outer",
      x1: DLQ_GUTTER_LEFT_X,
      y1: 36,
      x2: DLQ_GUTTER_LEFT_X,
      y2: BUCKET_BOTTOM_Y,
      kind: "wall",
    },
    {
      id: "wall-top",
      x1: DLQ_GUTTER_LEFT_X,
      y1: 36,
      x2: PLUNGER_LANE_RIGHT_X,
      y2: 36,
      kind: "wall",
    },
    {
      id: "wall-right-outer",
      x1: PLUNGER_LANE_RIGHT_X,
      y1: 36,
      x2: PLUNGER_LANE_RIGHT_X,
      y2: BUCKET_BOTTOM_Y,
      kind: "wall",
    },
    // Plunger top curved deflector ramp directing launched balls leftward into Ingest
    {
      id: "plunger-ramp-1",
      x1: PLUNGER_LANE_RIGHT_X,
      y1: 110,
      x2: 548,
      y2: 56,
      kind: "plunger-ramp",
    },
    {
      id: "plunger-ramp-2",
      x1: 548,
      y1: 56,
      x2: 498,
      y2: 38,
      kind: "plunger-ramp",
    },
    // Plunger lane inner divider (below the top entry opening y = 92..820)
    {
      id: "plunger-lane-divider",
      x1: PLUNGER_LANE_LEFT_X,
      y1: 92,
      x2: PLUNGER_LANE_LEFT_X,
      y2: BUCKET_BOTTOM_Y,
      kind: "plunger-gate",
    },
    // DLQ gutter divider wall (above and below the DLQ intake gate at y = 265..330)
    {
      id: "dlq-wall-upper",
      x1: DLQ_GUTTER_RIGHT_X,
      y1: 36,
      x2: DLQ_GUTTER_RIGHT_X,
      y2: 265,
      kind: "dlq-gutter",
    },
    {
      id: "dlq-wall-lower",
      x1: DLQ_GUTTER_RIGHT_X,
      y1: 330,
      x2: DLQ_GUTTER_RIGHT_X,
      y2: BUCKET_BOTTOM_Y,
      kind: "dlq-gutter",
    },
    // Join funnel slanted guide walls converging toward FUNNEL_CENTER_X (306)
    {
      id: "funnel-left",
      x1: FUNNEL_CENTER_X - 150,
      y1: FUNNEL_TOP_Y,
      x2: FUNNEL_CENTER_X - 24,
      y2: FUNNEL_HOLD_Y,
      kind: "funnel",
    },
    {
      id: "funnel-right",
      x1: FUNNEL_CENTER_X + 150,
      y1: FUNNEL_TOP_Y,
      x2: FUNNEL_CENTER_X + 24,
      y2: FUNNEL_HOLD_Y,
      kind: "funnel",
    },
  );

  // 6 partition buckets (p0..p5) across PLAYFIELD_LEFT_X..PLAYFIELD_RIGHT_X + DLQ bucket on left
  const buckets: BucketZone[] = [];
  const playfieldWidth = PLAYFIELD_RIGHT_X - PLAYFIELD_LEFT_X; // 460
  const bucketWidth = playfieldWidth / PARTITION_BUCKET_IDS.length;

  for (let i = 0; i < PARTITION_BUCKET_IDS.length; i++) {
    const id = PARTITION_BUCKET_IDS[i]!;
    const x1 = Math.round((PLAYFIELD_LEFT_X + i * bucketWidth) * 100) / 100;
    const x2 =
      i === PARTITION_BUCKET_IDS.length - 1
        ? PLAYFIELD_RIGHT_X
        : Math.round((PLAYFIELD_LEFT_X + (i + 1) * bucketWidth) * 100) / 100;
    const centerX = Math.round(((x1 + x2) / 2) * 100) / 100;
    buckets.push({
      id,
      label: id.toUpperCase(),
      x1,
      x2,
      centerX,
      y1: BUCKET_TOP_Y,
      y2: BUCKET_BOTTOM_Y,
    });
    if (i > 0) {
      segments.push({
        id: `bucket-divider-${i}`,
        x1,
        y1: BUCKET_TOP_Y - 18,
        x2: x1,
        y2: BUCKET_BOTTOM_Y,
        kind: "bucket-divider",
      });
    }
  }

  const dlqZone: BucketZone = {
    id: "dlq",
    label: "DLQ",
    x1: DLQ_GUTTER_LEFT_X,
    x2: DLQ_GUTTER_RIGHT_X,
    centerX: DLQ_GUTTER_CENTER_X,
    y1: BUCKET_TOP_Y,
    y2: BUCKET_BOTTOM_Y,
  };
  buckets.push(dlqZone);

  const bucketById = Object.fromEntries(
    buckets.map((b) => [b.id, b]),
  ) as Record<SinkId, BucketZone>;

  return {
    width: BOARD_WIDTH,
    height: BOARD_HEIGHT,
    pegs,
    segments,
    buckets,
    bucketById,
  };
}

const DEFAULT_BOARD = createPachinkoBoard();

/**
 * Creates a fresh, deterministic Pipeline Pachinko simulation state.
 */
export function createPachinkoSim(
  overrides: Partial<PachinkoSimConfig> = {},
): PachinkoSimState {
  const config: PachinkoSimConfig = {
    seed: overrides.seed ?? DEFAULT_SEED,
    dt: overrides.dt ?? FIXED_DT,
    substeps: Math.max(1, overrides.substeps ?? DEFAULT_SUBSTEPS),
    maxActiveBalls: Math.min(
      MAX_ACTIVE_BALLS,
      Math.max(1, overrides.maxActiveBalls ?? MAX_ACTIVE_BALLS),
    ),
    gravity: overrides.gravity ?? DEFAULT_GRAVITY,
    maxSpeed: overrides.maxSpeed ?? MAX_SPEED,
    pegRestitution: overrides.pegRestitution ?? PEG_RESTITUTION,
    wallRestitution: overrides.wallRestitution ?? WALL_RESTITUTION,
    ballRestitution: overrides.ballRestitution ?? BALL_RESTITUTION,
    dedupeWindowSize: Math.max(1, overrides.dedupeWindowSize ?? DEDUPE_WINDOW_SIZE),
    joinTimeoutSeconds:
      overrides.joinTimeoutSeconds ?? DEFAULT_JOIN_TIMEOUT_SECONDS,
    lateTransitThresholdSeconds:
      overrides.lateTransitThresholdSeconds ??
      DEFAULT_LATE_TRANSIT_THRESHOLD_SECONDS,
    rollingWindowSeconds:
      overrides.rollingWindowSeconds ?? ROLLING_WINDOW_SECONDS,
    dlqProbability: overrides.dlqProbability ?? 0.1,
    dlqStreakThreshold:
      overrides.dlqStreakThreshold ?? DLQ_STREAK_PAGER_THRESHOLD,
  };

  return {
    config,
    board: DEFAULT_BOARD,
    rngState: config.seed >>> 0,
    simTime: 0,
    stepCount: 0,
    nextBallSeq: 1,
    balls: [],
    scheduledSpawns: [],
    recentKeys: [],
    joinHeldBallId: null,
    tiltAccel: 0,
    buckets: {
      p0: 0,
      p1: 0,
      p2: 0,
      p3: 0,
      p4: 0,
      p5: 0,
    },
    dlqCount: 0,
    dlqStreak: 0,
    pagerActive: false,
    pagerTriggerCount: 0,
    dedupeBounceCount: 0,
    joinMergeCount: 0,
    joinTimeoutReleaseCount: 0,
    lateArrivalCount: 0,
    totalCompleted: 0,
    completedRecords: [],
    events: [],
    pegHitsThisStep: 0,
  };
}

function clampVelocity(
  vx: number,
  vy: number,
  maxSpeed: number,
): { vx: number; vy: number } {
  const speedSq = vx * vx + vy * vy;
  if (speedSq <= maxSpeed * maxSpeed || speedSq === 0) {
    return { vx, vy };
  }
  const scale = maxSpeed / Math.sqrt(speedSq);
  return { vx: vx * scale, vy: vy * scale };
}

/**
 * Launches a single ink-ball record into the simulation.
 * If active balls are already at `maxActiveBalls` (<= 150), queues the spawn
 * so active balls never exceed the cap.
 */
export function launchBall(
  state: PachinkoSimState,
  options: LaunchBallOptions = {},
): InkBall | null {
  if (state.balls.length >= state.config.maxActiveBalls) {
    state.scheduledSpawns.push({
      atSimTime: state.simTime + state.config.dt,
      options,
    });
    return null;
  }

  const seq = state.nextBallSeq++;
  const id = options.id ?? `ball-${seq}`;
  const defaultBucket =
    PARTITION_BUCKET_IDS[(seq - 1) % PARTITION_BUCKET_IDS.length] ?? "p0";
  const key = options.key ?? keyForPartitionBucket(defaultBucket, seq);
  const jitter = nextStateRandom(state);
  const routeToDlq =
    options.routeToDlq !== undefined
      ? options.routeToDlq
      : nextStateRandom(state) < state.config.dlqProbability;

  const subDt = state.config.dt / state.config.substeps;
  const skipLane = options.skipLaunchLane ?? options.x !== undefined;

  let x: number;
  let y: number;
  let vx: number;
  let vy: number;
  let stage: PachinkoStageId;
  let enteredBoardAt: number | null;

  if (skipLane) {
    x =
      options.x ??
      PLAYFIELD_LEFT_X + 54 + jitter * (PLAYFIELD_RIGHT_X - PLAYFIELD_LEFT_X - 108);
    y = options.y ?? INGEST_TOP_Y - 12;
    vx = options.vx ?? (jitter - 0.5) * 65;
    vy = options.vy ?? 95 + jitter * 45;
    stage = "ingest";
    enteredBoardAt = state.simTime;
  } else {
    const mapped = mapPlungerLaunchVelocity(options.power ?? 0.75, jitter);
    x = PLUNGER_LANE_CENTER_X;
    y = options.y ?? 210;
    vx = options.vx ?? mapped.vx;
    vy = options.vy ?? mapped.vy;
    stage = "launch";
    enteredBoardAt = null;
  }

  const clamped = clampVelocity(vx, vy, state.config.maxSpeed);
  const targetBucket = hashKeyToPartition(key);

  const ball: InkBall = {
    id,
    key,
    x,
    y,
    prevX: x - clamped.vx * subDt,
    prevY: y - clamped.vy * subDt,
    vx: clamped.vx,
    vy: clamped.vy,
    radius: DEFAULT_BALL_RADIUS,
    mass: 1,
    stage,
    spawnedAt: state.simTime,
    enteredBoardAt,
    stamp: routeToDlq ? "DLQ" : null,
    dedupeChecked: false,
    dedupeBounced: false,
    heldInJoin: false,
    heldSince: null,
    joinProcessed: false,
    joined: false,
    joinedFromIds: [],
    releasedByJoinTimeout: false,
    lateArrival: options.lateArrival ?? false,
    targetBucket,
    routeToDlq,
    pegHits: 0,
  };

  state.balls.push(ball);
  return ball;
}

export type BackfillOptions = {
  count?: number;
  reducedMotion?: boolean;
  durationSeconds?: number;
  includeDuplicates?: boolean;
  dlqEvery?: number;
};

/**
 * Schedules a staggered backfill flood of records (60 default, 12 under prefers-reduced-motion).
 */
export function scheduleBackfill(
  state: PachinkoSimState,
  options: BackfillOptions = {},
): number {
  const defaultCount = options.reducedMotion
    ? REDUCED_MOTION_BACKFILL_COUNT
    : DEFAULT_BACKFILL_COUNT;
  const count = Math.max(
    1,
    Math.min(MAX_ACTIVE_BALLS, options.count ?? defaultCount),
  );
  const duration = Math.max(
    0,
    options.durationSeconds ?? DEFAULT_BACKFILL_DURATION_SECONDS,
  );
  const includeDuplicates = options.includeDuplicates ?? true;
  const dlqEvery = options.dlqEvery ?? 11;

  for (let i = 0; i < count; i++) {
    const frac = count > 1 ? i / (count - 1) : 0;
    const atSimTime = state.simTime + frac * duration;
    const bucket = PARTITION_BUCKET_IDS[i % PARTITION_BUCKET_IDS.length] ?? "p0";

    // Every 7th record repeats the previous record's key to exercise the dedupe 'DUP' bounce
    const isDup = includeDuplicates && i > 0 && i % 7 === 0;
    const keySeq = isDup ? i : i + 1;
    const prevBucket =
      PARTITION_BUCKET_IDS[(keySeq - 1) % PARTITION_BUCKET_IDS.length] ?? bucket;
    const key = keyForPartitionBucket(isDup ? prevBucket : bucket, keySeq);

    const routeToDlq = dlqEvery > 0 && (i + 1) % dlqEvery === 0;
    const power = 0.55 + ((i * 37) % 40) / 100;

    state.scheduledSpawns.push({
      atSimTime,
      options: {
        key,
        power,
        routeToDlq,
      },
    });
  }

  state.scheduledSpawns.sort((a, b) => a.atSimTime - b.atSimTime);
  return count;
}

/**
 * Spawns a deterministic sequence of poison-pill DLQ records that route down the
 * DLQ side gutter and trigger the 3-streak on-call pager state.
 */
export function triggerDlqStreakFixture(
  state: PachinkoSimState,
  streakCount = DLQ_STREAK_PAGER_THRESHOLD,
): InkBall[] {
  const spawned: InkBall[] = [];
  for (let i = 0; i < streakCount; i++) {
    const ball = launchBall(state, {
      key: `dlq-poison-${state.nextBallSeq}`,
      x: DLQ_GUTTER_CENTER_X,
      y: 280 + i * 22,
      vx: 0,
      vy: 240,
      routeToDlq: true,
      skipLaunchLane: true,
    });
    if (ball) {
      ball.stage = "dlq";
      ball.stamp = "DLQ";
      spawned.push(ball);
    }
  }
  return spawned;
}

/**
 * Dismisses the on-call pager Easter egg and resets the consecutive DLQ streak.
 */
export function dismissPager(state: PachinkoSimState): void {
  state.pagerActive = false;
  state.dlqStreak = 0;
  state.events.push({
    type: "pager-dismissed",
    simTime: state.simTime,
  });
}

/**
 * Sets continuous horizontal tilt acceleration (px/s^2).
 */
export function setTiltAcceleration(
  state: PachinkoSimState,
  accelPxPerSec2: number,
): void {
  const clamped = Math.max(
    -240,
    Math.min(240, Number.isFinite(accelPxPerSec2) ? accelPxPerSec2 : 0),
  );
  state.tiltAccel = clamped;
}

/**
 * Sets horizontal tilt acceleration from a DeviceOrientationEvent gamma reading in degrees.
 */
export function setTiltFromGamma(
  state: PachinkoSimState,
  gammaDegrees: number,
): number {
  const accel = mapGammaToTiltAccel(gammaDegrees);
  state.tiltAccel = accel;
  return accel;
}

/**
 * Applies an immediate horizontal velocity nudge to all active playfield balls.
 */
export function nudgeBalls(
  state: PachinkoSimState,
  direction: "left" | "right" | number,
  impulsePxPerSec = 90,
): number {
  const sign =
    typeof direction === "number"
      ? Math.sign(direction)
      : direction === "left"
        ? -1
        : 1;
  if (sign === 0) return 0;

  const subDt = state.config.dt / state.config.substeps;
  let nudged = 0;
  for (const ball of state.balls) {
    if (ball.heldInJoin || ball.stage === "launch" || ball.stage === "dlq") {
      continue;
    }
    const next = clampVelocity(
      ball.vx + sign * impulsePxPerSec,
      ball.vy,
      state.config.maxSpeed,
    );
    ball.vx = next.vx;
    ball.vy = next.vy;
    ball.prevX = ball.x - ball.vx * subDt;
    ball.prevY = ball.y - ball.vy * subDt;
    nudged++;
  }
  return nudged;
}

function setBallVelocity(
  ball: InkBall,
  vx: number,
  vy: number,
  subDt: number,
  maxSpeed: number,
): void {
  const clamped = clampVelocity(vx, vy, maxSpeed);
  ball.vx = clamped.vx;
  ball.vy = clamped.vy;
  ball.prevX = ball.x - ball.vx * subDt;
  ball.prevY = ball.y - ball.vy * subDt;
}

function computeStageGuidanceAccel(
  state: PachinkoSimState,
  ball: InkBall,
): { ax: number; ay: number } {
  const g = state.config.gravity;

  // Plunger launch lane: climb upward and curve into the top of the ingest stage
  if (ball.stage === "launch") {
    if (ball.y < 95) {
      return { ax: -520, ay: g * 0.35 };
    }
    return { ax: 0, ay: -g * 0.25 };
  }

  // DLQ side gutter: stay centered in [DLQ_GUTTER_LEFT_X, DLQ_GUTTER_RIGHT_X]
  if (ball.stage === "dlq") {
    const dx = DLQ_GUTTER_CENTER_X - ball.x;
    return { ax: dx * 12, ay: g * 1.05 };
  }

  // If destined for DLQ, steer leftward toward the DLQ intake gate at y = 260..325
  if (ball.routeToDlq && ball.y >= 190) {
    const dx = DLQ_GUTTER_CENTER_X - ball.x;
    return { ax: dx * 9.5 - 180, ay: g };
  }

  // Stage 3 Join funnel: guide along the funnel slope toward FUNNEL_CENTER_X (306) and mouth (y = 438)
  if (ball.y >= DEDUPE_GATE_Y + 8 && ball.y < FUNNEL_EXIT_Y && !ball.joinProcessed) {
    const dx = FUNNEL_CENTER_X - ball.x;
    const dy = Math.max(16, FUNNEL_HOLD_Y - ball.y);
    const len = Math.hypot(dx, dy);
    const slopeAx = len > 1e-6 ? (dx / len) * g * 0.72 : 0;
    const slopeAy = len > 1e-6 ? Math.max(g * 0.88, (dy / len) * g * 1.15) : g;
    return {
      ax: state.tiltAccel * 0.35 + dx * 6.5 + slopeAx,
      ay: slopeAy,
    };
  }

  // Stage 4 Partition splitter: guide toward hashed partition bucket centerX
  if (ball.y >= FUNNEL_EXIT_Y) {
    const targetZone = state.board.bucketById[ball.targetBucket];
    const targetX = targetZone ? targetZone.centerX : FUNNEL_CENTER_X;
    const progress = Math.max(
      0,
      Math.min(1, (ball.y - FUNNEL_EXIT_Y) / (BUCKET_TOP_Y - FUNNEL_EXIT_Y)),
    );
    const strength = 5.5 + progress * 14;
    const dx = targetX - ball.x;
    return { ax: state.tiltAccel * (1 - progress * 0.7) + dx * strength, ay: g };
  }

  return { ax: state.tiltAccel, ay: g };
}

function resolveSpatialHashBallCollisions(
  state: PachinkoSimState,
  subDt: number,
): void {
  const balls = state.balls;
  if (balls.length < 2) return;

  const cellSize = SPATIAL_HASH_CELL_SIZE;
  const grid = new Map<number, number[]>();

  const cellKey = (cx: number, cy: number): number =>
    ((cx & 0xffff) << 16) | (cy & 0xffff);

  for (let i = 0; i < balls.length; i++) {
    const b = balls[i]!;
    if (b.heldInJoin || b.stage === "launch") continue;
    const cx = Math.floor(b.x / cellSize);
    const cy = Math.floor(b.y / cellSize);
    const key = cellKey(cx, cy);
    const bucket = grid.get(key);
    if (bucket) {
      bucket.push(i);
    } else {
      grid.set(key, [i]);
    }
  }

  const restitution = state.config.ballRestitution;
  const maxSpeed = state.config.maxSpeed;

  for (let i = 0; i < balls.length; i++) {
    const a = balls[i]!;
    if (a.heldInJoin || a.stage === "launch") continue;
    const cx = Math.floor(a.x / cellSize);
    const cy = Math.floor(a.y / cellSize);

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const neighbors = grid.get(cellKey(cx + dx, cy + dy));
        if (!neighbors) continue;

        for (let k = 0; k < neighbors.length; k++) {
          const j = neighbors[k]!;
          if (j <= i) continue;
          const b = balls[j]!;
          if (b.heldInJoin || a.stage !== b.stage) continue;

          const rx = b.x - a.x;
          const ry = b.y - a.y;
          const minDist = a.radius + b.radius;
          const distSq = rx * rx + ry * ry;
          if (distSq >= minDist * minDist) continue;

          const dist = Math.sqrt(distSq);
          const nx = dist > 1e-6 ? rx / dist : 1;
          const ny = dist > 1e-6 ? ry / dist : 0;
          const overlap = minDist - (dist > 1e-6 ? dist : minDist - 0.1);

          const totalMass = a.mass + b.mass;
          const aShare = b.mass / totalMass;
          const bShare = a.mass / totalMass;

          const shiftAX = -nx * overlap * aShare;
          const shiftAY = -ny * overlap * aShare;
          const shiftBX = nx * overlap * bShare;
          const shiftBY = ny * overlap * bShare;

          a.x += shiftAX;
          a.y += shiftAY;
          a.prevX += shiftAX;
          a.prevY += shiftAY;

          b.x += shiftBX;
          b.y += shiftBY;
          b.prevX += shiftBX;
          b.prevY += shiftBY;

          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;
          if (velAlongNormal < 0) {
            const impulse =
              (-(1 + restitution) * velAlongNormal) /
              (1 / a.mass + 1 / b.mass);
            const ix = impulse * nx;
            const iy = impulse * ny;
            setBallVelocity(
              a,
              a.vx - ix / a.mass,
              a.vy - iy / a.mass,
              subDt,
              maxSpeed,
            );
            setBallVelocity(
              b,
              b.vx + ix / b.mass,
              b.vy + iy / b.mass,
              subDt,
              maxSpeed,
            );
          }
        }
      }
    }
  }
}

function resolveBallPegCollisions(
  state: PachinkoSimState,
  subDt: number,
): void {
  const pegs = state.board.pegs;
  const restitution = state.config.pegRestitution;
  const maxSpeed = state.config.maxSpeed;

  for (const ball of state.balls) {
    if (ball.heldInJoin || ball.stage === "launch") continue;

    for (let p = 0; p < pegs.length; p++) {
      const peg = pegs[p]!;
      const dx = ball.x - peg.x;
      const dy = ball.y - peg.y;
      const minDist = ball.radius + peg.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq >= minDist * minDist) continue;

      const dist = Math.sqrt(distSq);
      let nx = dist > 1e-6 ? dx / dist : 0;
      let ny = dist > 1e-6 ? dy / dist : -1;

      // Prevent dead-center vertical balancing on top of a peg
      if (Math.abs(nx) < 0.08) {
        const sign = (hashRecordKey(`${ball.id}:${peg.id}`) & 1) === 0 ? 1 : -1;
        nx = sign * 0.16;
        const invLen = 1 / Math.hypot(nx, ny);
        nx *= invLen;
        ny *= invLen;
      }

      const overlap = minDist - dist + 0.15;
      const shiftX = nx * overlap;
      const shiftY = ny * overlap;
      ball.x += shiftX;
      ball.y += shiftY;
      ball.prevX += shiftX;
      ball.prevY += shiftY;

      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        let nextVx = ball.vx - (1 + restitution) * vn * nx;
        const nextVy = ball.vy - (1 + restitution) * vn * ny;
        const jitter = (nextStateRandom(state) - 0.5) * 28;
        nextVx += jitter;
        setBallVelocity(ball, nextVx, nextVy, subDt, maxSpeed);

        ball.pegHits += 1;
        state.pegHitsThisStep += 1;
        state.events.push({
          type: "peg-hit",
          ballId: ball.id,
          pegId: peg.id,
          x: peg.x,
          y: peg.y,
          speed: Math.hypot(nextVx, nextVy),
          simTime: state.simTime,
        });
      }
    }
  }
}

function resolveBallSegmentCollisions(
  state: PachinkoSimState,
  subDt: number,
): void {
  const segments = state.board.segments;
  const restitution = state.config.wallRestitution;
  const maxSpeed = state.config.maxSpeed;

  for (const ball of state.balls) {
    if (ball.heldInJoin) continue;

    for (let s = 0; s < segments.length; s++) {
      const seg = segments[s]!;

      // Funnel walls only guide balls before they have been processed by the join funnel
      if (seg.kind === "funnel" && (ball.joinProcessed || ball.stage === "dlq")) {
        continue;
      }
      // Bucket dividers only apply in the lower partition / bucket region
      if (seg.kind === "bucket-divider" && ball.stage === "dlq") {
        continue;
      }

      const abx = seg.x2 - seg.x1;
      const aby = seg.y2 - seg.y1;
      const abLenSq = abx * abx + aby * aby;
      if (abLenSq === 0) continue;

      const apx = ball.x - seg.x1;
      const apy = ball.y - seg.y1;
      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
      const closestX = seg.x1 + t * abx;
      const closestY = seg.y1 + t * aby;

      const dx = ball.x - closestX;
      const dy = ball.y - closestY;
      const distSq = dx * dx + dy * dy;
      if (distSq >= ball.radius * ball.radius) continue;

      const dist = Math.sqrt(distSq);
      if (seg.kind === "funnel") {
        const abLen = Math.sqrt(abLenSq);
        const tx = abx / abLen;
        const ty = aby / abLen;
        // Inward normal pointing into the upper funnel interior toward FUNNEL_CENTER_X
        const nxIn = abx > 0 ? ty : -ty;
        const nyIn = abx > 0 ? -tx : tx;
        const overlap = ball.radius - dist + 0.2;
        const shiftX = nxIn * overlap;
        const shiftY = nyIn * overlap;
        ball.x += shiftX;
        ball.y += shiftY;
        ball.prevX += shiftX;
        ball.prevY += shiftY;

        const vt = Math.max(145, ball.vx * tx + ball.vy * ty);
        const vn = Math.max(0, -(ball.vx * nxIn + ball.vy * nyIn) * 0.16);
        const nextVx = tx * vt + nxIn * vn;
        const nextVy = ty * vt + nyIn * vn;
        setBallVelocity(ball, nextVx, nextVy, subDt, maxSpeed);
        continue;
      }

      const nx = dist > 1e-6 ? dx / dist : -aby / Math.sqrt(abLenSq);
      const ny = dist > 1e-6 ? dy / dist : abx / Math.sqrt(abLenSq);
      const overlap = ball.radius - dist + 0.1;

      const shiftX = nx * overlap;
      const shiftY = ny * overlap;
      ball.x += shiftX;
      ball.y += shiftY;
      ball.prevX += shiftX;
      ball.prevY += shiftY;

      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) {
        const nextVx = ball.vx - (1 + restitution) * vn * nx;
        const nextVy = ball.vy - (1 + restitution) * vn * ny;
        setBallVelocity(ball, nextVx, nextVy, subDt, maxSpeed);
      }
    }

    // Enforce hard stage corridor boundaries so balls never tunnel out of their lane
    if (ball.stage === "launch") {
      if (ball.y > 95 && ball.x < PLUNGER_LANE_LEFT_X + ball.radius) {
        const shiftX = PLUNGER_LANE_LEFT_X + ball.radius - ball.x;
        ball.x += shiftX;
        ball.prevX += shiftX;
        if (ball.vx < 0) {
          setBallVelocity(ball, -ball.vx * restitution, ball.vy, subDt, maxSpeed);
        }
      }
      if (ball.x > PLUNGER_LANE_RIGHT_X - ball.radius) {
        const shiftX = PLUNGER_LANE_RIGHT_X - ball.radius - ball.x;
        ball.x += shiftX;
        ball.prevX += shiftX;
        if (ball.vx > 0) {
          setBallVelocity(ball, -ball.vx * restitution, ball.vy, subDt, maxSpeed);
        }
      }
      if (ball.y > 225) {
        const shiftY = 225 - ball.y;
        ball.y += shiftY;
        ball.prevY += shiftY;
        setBallVelocity(
          ball,
          ball.vx,
          -Math.max(580, Math.abs(ball.vy)),
          subDt,
          maxSpeed,
        );
      }
    } else if (ball.stage === "dlq") {
      const minX = DLQ_GUTTER_LEFT_X + ball.radius;
      const maxX = DLQ_GUTTER_RIGHT_X - ball.radius;
      if (ball.x < minX) {
        const shiftX = minX - ball.x;
        ball.x += shiftX;
        ball.prevX += shiftX;
        setBallVelocity(ball, Math.abs(ball.vx) * restitution, ball.vy, subDt, maxSpeed);
      } else if (ball.x > maxX) {
        const shiftX = maxX - ball.x;
        ball.x += shiftX;
        ball.prevX += shiftX;
        setBallVelocity(ball, -Math.abs(ball.vx) * restitution, ball.vy, subDt, maxSpeed);
      }
    } else {
      const minX = PLAYFIELD_LEFT_X + ball.radius;
      const maxX = PLAYFIELD_RIGHT_X - ball.radius;
      if (!ball.routeToDlq && ball.x < minX) {
        const shiftX = minX - ball.x;
        ball.x += shiftX;
        ball.prevX += shiftX;
        setBallVelocity(ball, Math.abs(ball.vx) * restitution, ball.vy, subDt, maxSpeed);
      } else if (ball.x > maxX) {
        const shiftX = maxX - ball.x;
        ball.x += shiftX;
        ball.prevX += shiftX;
        setBallVelocity(ball, -Math.abs(ball.vx) * restitution, ball.vy, subDt, maxSpeed);
      }
    }

    if (ball.y < 36 + ball.radius) {
      const shiftY = 36 + ball.radius - ball.y;
      ball.y += shiftY;
      ball.prevY += shiftY;
      if (ball.vy < 0) {
        setBallVelocity(
          ball,
          ball.stage === "launch" ? -Math.max(240, Math.abs(ball.vx)) : ball.vx,
          Math.abs(ball.vy) * restitution + 60,
          subDt,
          maxSpeed,
        );
      }
    }
  }
}

function processStageTransitions(
  state: PachinkoSimState,
  subDt: number,
): void {
  const maxSpeed = state.config.maxSpeed;

  // Release lone waiting ball in join funnel if timeout elapsed
  if (state.joinHeldBallId !== null) {
    const heldBall = state.balls.find((b) => b.id === state.joinHeldBallId);
    if (!heldBall) {
      state.joinHeldBallId = null;
    } else if (
      heldBall.heldSince !== null &&
      state.simTime - heldBall.heldSince >= state.config.joinTimeoutSeconds - 1e-9
    ) {
      const waitedSeconds = state.simTime - heldBall.heldSince;
      heldBall.heldInJoin = false;
      heldBall.heldSince = null;
      heldBall.joinProcessed = true;
      heldBall.releasedByJoinTimeout = true;
      heldBall.lateArrival = true;
      if (!heldBall.stamp) {
        heldBall.stamp = "LATE";
      }
      heldBall.x = FUNNEL_CENTER_X;
      heldBall.y = FUNNEL_EXIT_Y;
      heldBall.stage = "partition";
      setBallVelocity(
        heldBall,
        (nextStateRandom(state) - 0.5) * 36,
        155,
        subDt,
        maxSpeed,
      );
      state.joinHeldBallId = null;
      state.joinTimeoutReleaseCount += 1;
      state.events.push({
        type: "join-timeout-release",
        ballId: heldBall.id,
        key: heldBall.key,
        waitedSeconds,
        simTime: state.simTime,
      });
    }
  }

  const idsToRemove = new Set<string>();

  for (let i = 0; i < state.balls.length; i++) {
    const ball = state.balls[i]!;
    if (idsToRemove.has(ball.id) || ball.heldInJoin) continue;

    // 1. Plunger launch lane -> Ingest stage
    if (ball.stage === "launch" && ball.x < PLUNGER_LANE_LEFT_X - ball.radius) {
      ball.stage = "ingest";
      ball.enteredBoardAt = state.simTime;
    } else if (ball.stage === "launch" && state.simTime - ball.spawnedAt > 0.65) {
      ball.stage = "ingest";
      ball.enteredBoardAt = state.simTime;
      ball.x = PLAYFIELD_RIGHT_X - 24 - nextStateRandom(state) * 36;
      ball.y = INGEST_TOP_Y - 10;
      setBallVelocity(
        ball,
        -130 - nextStateRandom(state) * 70,
        120,
        subDt,
        maxSpeed,
      );
    }

    if (ball.stage === "launch") {
      continue;
    }

    const boardAge = state.simTime - (ball.enteredBoardAt ?? ball.spawnedAt);

    // Join-stage slope guidance & anti-stall: guide slow balls along the funnel slope toward (FUNNEL_CENTER_X, FUNNEL_HOLD_Y)
    if (
      !ball.joinProcessed &&
      !ball.routeToDlq &&
      ball.y >= FUNNEL_TOP_Y - 18 &&
      ball.y <= FUNNEL_EXIT_Y &&
      (Math.hypot(ball.vx, ball.vy) < 75 || ball.vy < 35)
    ) {
      const dx = FUNNEL_CENTER_X - ball.x;
      const dy = Math.max(14, FUNNEL_HOLD_Y - ball.y);
      const len = Math.hypot(dx, dy);
      const speed = Math.max(160, Math.hypot(ball.vx, ball.vy));
      setBallVelocity(
        ball,
        (dx / len) * speed,
        (dy / len) * speed,
        subDt,
        maxSpeed,
      );
    } else if (
      boardAge > 1.8 &&
      Math.hypot(ball.vx, ball.vy) < 52
    ) {
      // General anti-stall safeguard for slow-moving playfield balls
      setBallVelocity(
        ball,
        ball.vx + (nextStateRandom(state) - 0.5) * 70,
        Math.max(ball.vy, 145),
        subDt,
        maxSpeed,
      );
    }

    // Deterministic stage-progression guarantees so no ball can remain trapped in ingest/dedupe/join/partition
    if (!ball.dedupeChecked && !ball.routeToDlq && boardAge > 2.8) {
      ball.y = Math.max(ball.y, DEDUPE_GATE_Y - ball.radius - DEFAULT_PEG_RADIUS);
      setBallVelocity(ball, ball.vx, Math.max(ball.vy, 190), subDt, maxSpeed);
    }
    if (
      ball.dedupeChecked &&
      !ball.joinProcessed &&
      !ball.routeToDlq &&
      ball.stage !== "dlq" &&
      (ball.y > FUNNEL_HOLD_Y + 6 || boardAge > 4.2)
    ) {
      ball.x = FUNNEL_CENTER_X;
      ball.y = FUNNEL_HOLD_Y;
    }
    if (
      ball.joinProcessed &&
      ball.stage !== "dlq" &&
      boardAge > 6.5
    ) {
      ball.y = BUCKET_TOP_Y;
    }

    // 5. DLQ intake shunt (around y = 265..335) for balls routed to DLQ
    if (
      ball.routeToDlq &&
      ball.stage !== "dlq" &&
      ball.y >= 265
    ) {
      ball.stage = "dlq";
      if (ball.stamp !== "DUP") {
        ball.stamp = "DLQ";
      }
      ball.x = DLQ_GUTTER_CENTER_X;
      setBallVelocity(ball, 0, Math.max(ball.vy, 190), subDt, maxSpeed);
    }

    if (ball.stage === "dlq") {
      if (ball.y >= BUCKET_TOP_Y) {
        completeBallInSink(state, ball, "dlq");
        idsToRemove.add(ball.id);
      }
      continue;
    }

    // 2. Dedupe filter gate at y >= DEDUPE_GATE_Y - ball.radius - DEFAULT_PEG_RADIUS - 1
    if (
      !ball.dedupeChecked &&
      ball.y >= DEDUPE_GATE_Y - ball.radius - DEFAULT_PEG_RADIUS - 1
    ) {
      const isDuplicate = state.recentKeys.includes(ball.key);
      ball.dedupeChecked = true;

      if (isDuplicate) {
        ball.dedupeBounced = true;
        ball.stamp = "DUP";
        ball.stage = "dedupe";
        ball.y = DEDUPE_GATE_Y - ball.radius - DEFAULT_PEG_RADIUS - 2;
        const bounceVy = -Math.max(250, Math.abs(ball.vy) * 0.85 + 170);
        const bounceVx = ball.vx * 0.5 + (nextStateRandom(state) - 0.5) * 120;
        setBallVelocity(ball, bounceVx, bounceVy, subDt, maxSpeed);
        state.dedupeBounceCount += 1;
        state.events.push({
          type: "dedupe-bounce",
          ballId: ball.id,
          key: ball.key,
          x: ball.x,
          y: ball.y,
          simTime: state.simTime,
        });
        continue;
      } else {
        state.recentKeys.push(ball.key);
        if (state.recentKeys.length > state.config.dedupeWindowSize) {
          state.recentKeys.shift();
        }
        ball.stage = "dedupe";
      }
    }

    // 3. Two-ball Join Funnel (y in [FUNNEL_HOLD_Y - 12, FUNNEL_EXIT_Y])
    if (
      !ball.joinProcessed &&
      ball.y >= FUNNEL_HOLD_Y - 12 &&
      ball.y <= FUNNEL_EXIT_Y + 12 &&
      Math.abs(ball.x - FUNNEL_CENTER_X) <= FUNNEL_CAPTURE_RADIUS_X
    ) {
      const heldId = state.joinHeldBallId;
      const heldBall =
        heldId !== null && heldId !== ball.id
          ? state.balls.find((b) => b.id === heldId && !idsToRemove.has(b.id))
          : undefined;

      if (!heldBall) {
        // Hold this first arriving ball inside the join funnel
        ball.stage = "join";
        ball.heldInJoin = true;
        ball.heldSince = state.simTime;
        ball.x = FUNNEL_CENTER_X;
        ball.y = FUNNEL_HOLD_Y;
        setBallVelocity(ball, 0, 0, subDt, maxSpeed);
        state.joinHeldBallId = ball.id;
        state.events.push({
          type: "join-hold",
          ballId: ball.id,
          key: ball.key,
          simTime: state.simTime,
        });
        continue;
      } else {
        // Second ball arrived: merge both into one larger joined ball!
        idsToRemove.add(heldBall.id);
        state.joinHeldBallId = null;

        const mergedKey = `${heldBall.key}+${ball.key}`;
        ball.key = mergedKey;
        ball.joined = true;
        ball.joinedFromIds = [
          ...(heldBall.joinedFromIds.length > 0
            ? heldBall.joinedFromIds
            : [heldBall.id]),
          ball.id,
        ];
        ball.joinProcessed = true;
        ball.heldInJoin = false;
        ball.heldSince = null;
        ball.radius = JOINED_BALL_RADIUS;
        ball.mass = heldBall.mass + ball.mass;
        ball.spawnedAt = Math.min(heldBall.spawnedAt, ball.spawnedAt);
        ball.dedupeBounced = heldBall.dedupeBounced || ball.dedupeBounced;
        ball.lateArrival = heldBall.lateArrival || ball.lateArrival;
        if (ball.dedupeBounced) {
          ball.stamp = "DUP";
        } else {
          ball.stamp = "JOIN";
        }
        ball.targetBucket = hashKeyToPartition(mergedKey);
        ball.x = FUNNEL_CENTER_X;
        ball.y = FUNNEL_EXIT_Y;
        ball.stage = "partition";
        setBallVelocity(
          ball,
          (nextStateRandom(state) - 0.5) * 42,
          165,
          subDt,
          maxSpeed,
        );
        state.joinMergeCount += 1;
        state.events.push({
          type: "join-merge",
          mergedBallId: ball.id,
          firstBallId: heldBall.id,
          secondBallId: ball.id,
          key: mergedKey,
          simTime: state.simTime,
        });
        continue;
      }
    }

    if (ball.y >= PARTITION_TOP_Y && ball.stage !== "partition") {
      ball.stage = "partition";
    }

    // 4. Partition bucket landing at y >= BUCKET_TOP_Y
    if (ball.y >= BUCKET_TOP_Y) {
      const targetZone = state.board.bucketById[ball.targetBucket];
      if (targetZone) {
        ball.x = targetZone.centerX;
      }
      completeBallInSink(state, ball, ball.targetBucket);
      idsToRemove.add(ball.id);
    }
  }

  if (idsToRemove.size > 0) {
    state.balls = state.balls.filter((b) => !idsToRemove.has(b.id));
  }
}

function completeBallInSink(
  state: PachinkoSimState,
  ball: InkBall,
  sink: SinkId,
): void {
  const transitTime = Math.max(0, state.simTime - ball.spawnedAt);
  const isLate =
    ball.lateArrival ||
    ball.releasedByJoinTimeout ||
    transitTime > state.config.lateTransitThresholdSeconds;

  ball.lateArrival = isLate;
  ball.stage = "settled";

  state.totalCompleted += 1;
  if (isLate) {
    state.lateArrivalCount += 1;
  }

  state.completedRecords.push({
    id: ball.id,
    key: ball.key,
    sink,
    completedAt: state.simTime,
    transitTime,
    lateArrival: isLate,
    releasedByJoinTimeout: ball.releasedByJoinTimeout,
    dedupeBounced: ball.dedupeBounced,
    joined: ball.joined,
  });

  if (sink === "dlq") {
    state.dlqCount += 1;
    state.dlqStreak += 1;
    let pagerTriggered = false;
    if (state.dlqStreak >= state.config.dlqStreakThreshold) {
      if (!state.pagerActive) {
        state.pagerTriggerCount += 1;
      }
      state.pagerActive = true;
      pagerTriggered = true;
    }
    state.events.push({
      type: "dlq-land",
      ballId: ball.id,
      key: ball.key,
      dlqStreak: state.dlqStreak,
      pagerTriggered,
      simTime: state.simTime,
    });
    if (pagerTriggered) {
      state.events.push({
        type: "pager-triggered",
        dlqStreak: state.dlqStreak,
        dlqCount: state.dlqCount,
        simTime: state.simTime,
      });
    }
  } else {
    state.buckets[sink] += 1;
    state.dlqStreak = 0;
    state.events.push({
      type: "bucket-land",
      ballId: ball.id,
      key: ball.key,
      bucket: sink,
      lateArrival: isLate,
      simTime: state.simTime,
    });
  }
}

/**
 * Advances the simulation by `steps` fixed-dt increments (`dt = 1/120 s` default).
 */
export function stepPachinko(
  state: PachinkoSimState,
  steps = 1,
): PachinkoSimState {
  const totalSteps = Math.max(1, Math.floor(steps));
  const dt = state.config.dt;
  const substeps = state.config.substeps;
  const subDt = dt / substeps;
  const damping = 0.9993;

  state.events = [];
  state.pegHitsThisStep = 0;

  for (let step = 0; step < totalSteps; step++) {
    state.simTime = Math.round((state.simTime + dt) * 1e6) / 1e6;
    state.stepCount += 1;

    // Spawn any scheduled backfill balls whose spawn time has arrived (respecting maxActiveBalls cap)
    while (
      state.scheduledSpawns.length > 0 &&
      state.scheduledSpawns[0]!.atSimTime <= state.simTime + 1e-9 &&
      state.balls.length < state.config.maxActiveBalls
    ) {
      const nextSpawn = state.scheduledSpawns.shift()!;
      launchBall(state, nextSpawn.options);
    }

    for (let s = 0; s < substeps; s++) {
      // Verlet position integration
      for (let i = 0; i < state.balls.length; i++) {
        const ball = state.balls[i]!;
        if (ball.heldInJoin) {
          ball.x = FUNNEL_CENTER_X;
          ball.y = FUNNEL_HOLD_Y;
          ball.prevX = FUNNEL_CENTER_X;
          ball.prevY = FUNNEL_HOLD_Y;
          ball.vx = 0;
          ball.vy = 0;
          continue;
        }

        const curVx = (ball.x - ball.prevX) / subDt;
        const curVy = (ball.y - ball.prevY) / subDt;
        const { ax, ay } = computeStageGuidanceAccel(state, ball);

        const rawVx = curVx * damping + ax * subDt;
        const rawVy = curVy * damping + ay * subDt;
        const clamped = clampVelocity(rawVx, rawVy, state.config.maxSpeed);

        ball.prevX = ball.x;
        ball.prevY = ball.y;
        ball.x += clamped.vx * subDt;
        ball.y += clamped.vy * subDt;
        ball.vx = clamped.vx;
        ball.vy = clamped.vy;
      }

      resolveSpatialHashBallCollisions(state, subDt);
      resolveBallPegCollisions(state, subDt);
      resolveBallSegmentCollisions(state, subDt);
    }

    processStageTransitions(state, subDt);
  }

  return state;
}

/**
 * Computes live throughput, late-arrival %, bucket counts, DLQ count, and pager readout.
 */
export function getReadout(state: PachinkoSimState): PachinkoReadout {
  const windowSec = state.config.rollingWindowSeconds;
  const cutoff = state.simTime - windowSec;
  let recentCount = 0;
  for (let i = state.completedRecords.length - 1; i >= 0; i--) {
    const rec = state.completedRecords[i]!;
    if (rec.completedAt > cutoff && rec.completedAt <= state.simTime + 1e-9) {
      recentCount += 1;
    } else if (rec.completedAt <= cutoff) {
      break;
    }
  }

  const recordsPerSec =
    windowSec > 0 ? Math.round((recentCount / windowSec) * 100) / 100 : 0;

  const lateArrivalPct =
    state.totalCompleted > 0
      ? Math.round((state.lateArrivalCount / state.totalCompleted) * 1000) / 10
      : 0;

  const totalPartitionCount =
    state.buckets.p0 +
    state.buckets.p1 +
    state.buckets.p2 +
    state.buckets.p3 +
    state.buckets.p4 +
    state.buckets.p5;

  return {
    buckets: { ...state.buckets },
    totalPartitionCount,
    dlqCount: state.dlqCount,
    dlqStreak: state.dlqStreak,
    pagerActive: state.pagerActive,
    pagerTriggerCount: state.pagerTriggerCount,
    recordsPerSec,
    lateArrivalPct,
    lateArrivalCount: state.lateArrivalCount,
    totalCompleted: state.totalCompleted,
    activeBalls: state.balls.length,
    dedupeBounceCount: state.dedupeBounceCount,
    joinMergeCount: state.joinMergeCount,
    joinTimeoutReleaseCount: state.joinTimeoutReleaseCount,
  };
}

/**
 * Formats a concise polite aria-live summary string for screen readers.
 */
export function formatAriaLiveSummary(readout: PachinkoReadout): string {
  const pagerNote = readout.pagerActive
    ? " On-call pager alert active: 3 consecutive DLQ records."
    : "";
  return `Throughput ${readout.recordsPerSec.toFixed(1)} records/sec, late arrivals ${readout.lateArrivalPct.toFixed(1)}%, DLQ ${readout.dlqCount}, partitioned ${readout.totalPartitionCount}.${pagerNote}`;
}

/**
 * Rate limiter helper for WebAudio peg-hit clicks (caps clicks at <= maxPerSecond, default 20/s).
 */
export function createPegClickLimiter(
  maxPerSecond = MAX_PEG_CLICKS_PER_SECOND,
): (nowSeconds: number) => boolean {
  const minInterval = 1 / Math.max(1, maxPerSecond);
  let lastClickAt = -Infinity;
  return (nowSeconds: number): boolean => {
    if (nowSeconds - lastClickAt >= minInterval) {
      lastClickAt = nowSeconds;
      return true;
    }
    return false;
  };
}
