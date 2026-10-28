"use client";

import {
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BUCKET_BOTTOM_Y,
  BUCKET_TOP_Y,
  createPachinkoSim,
  createPegClickLimiter,
  DEDUPE_GATE_Y,
  DEFAULT_BACKFILL_COUNT,
  DEFAULT_SEED,
  dismissPager,
  DLQ_GUTTER_CENTER_X,
  DLQ_GUTTER_LEFT_X,
  DLQ_GUTTER_RIGHT_X,
  formatAriaLiveSummary,
  FUNNEL_CENTER_X,
  FUNNEL_EXIT_Y,
  FUNNEL_HOLD_Y,
  FUNNEL_TOP_Y,
  getReadout,
  INGEST_TOP_Y,
  launchBall,
  MAX_PEG_CLICKS_PER_SECOND,
  nudgeBalls,
  type PachinkoReadout,
  type PachinkoSimState,
  PARTITION_BUCKET_IDS,
  PARTITION_TOP_Y,
  PLAYFIELD_LEFT_X,
  PLAYFIELD_RIGHT_X,
  PLUNGER_LANE_CENTER_X,
  PLUNGER_LANE_LEFT_X,
  PLUNGER_LANE_RIGHT_X,
  REDUCED_MOTION_BACKFILL_COUNT,
  scheduleBackfill,
  setTiltAcceleration,
  setTiltFromGamma,
  stepPachinko,
  triggerDlqStreakFixture,
} from "@/lib/pachinko/sim";
import { getServerSound, getSound, play, setSound, subscribeSound } from "@/lib/sound-client";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

type TiltStatus = "idle" | "active" | "denied" | "unsupported";

const STEPS_PER_FRAME_NORMAL = 6;
const STEPS_PER_FRAME_REDUCED = 14;
const ARIA_THROTTLE_MS = 1000;

const INITIAL_READOUT: PachinkoReadout = getReadout(createPachinkoSim({ seed: DEFAULT_SEED }));
const INITIAL_ARIA_SUMMARY: string = formatAriaLiveSummary(INITIAL_READOUT);

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return false;
}

function subscribeHydrated(): () => void {
  return () => {};
}

function getHydratedSnapshot(): boolean {
  return true;
}

function getHydratedServerSnapshot(): boolean {
  return false;
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  sim: PachinkoSimState,
  readout: PachinkoReadout,
  plungerPull: number,
) {
  ctx.save();
  ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // 1. Washi paper background
  ctx.fillStyle = "#f5efe2";
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // Subtle registration grid lines
  ctx.strokeStyle = "rgba(26, 23, 20, 0.06)";
  ctx.lineWidth = 1;
  for (let y = 40; y < BOARD_HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(BOARD_WIDTH, y);
    ctx.stroke();
  }

  // 2. Stage zone bands & labels
  const stages: Array<{ y: number; label: string; sub: string }> = [
    { y: INGEST_TOP_Y - 22, label: "STAGE 01 · INGEST PEG FIELD", sub: "stream intake" },
    { y: DEDUPE_GATE_Y - 16, label: "STAGE 02 · DEDUPE FILTER GATE", sub: "seen-key bloom check" },
    { y: FUNNEL_TOP_Y - 12, label: "STAGE 03 · STREAM JOIN FUNNEL", sub: "pair 2 records → 1" },
    { y: PARTITION_TOP_Y - 14, label: "STAGE 04 · PARTITION SPLITTER", sub: "consistent key hash" },
    { y: BUCKET_TOP_Y - 14, label: "STAGE 05 · PARTITION BUCKETS", sub: "p0 .. p5 sinks" },
  ];

  ctx.font = "700 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  for (const st of stages) {
    ctx.strokeStyle = "rgba(26, 23, 20, 0.22)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(PLAYFIELD_LEFT_X, st.y);
    ctx.lineTo(PLAYFIELD_RIGHT_X, st.y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(26, 23, 20, 0.68)";
    ctx.textAlign = "left";
    ctx.fillText(st.label, PLAYFIELD_LEFT_X + 8, st.y - 4);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(26, 23, 20, 0.45)";
    ctx.fillText(st.sub, PLAYFIELD_RIGHT_X - 8, st.y - 4);
  }

  // 3. Left DLQ Gutter (x: 24..76)
  ctx.fillStyle = "rgba(196, 59, 43, 0.08)";
  ctx.fillRect(DLQ_GUTTER_LEFT_X, 64, DLQ_GUTTER_RIGHT_X - DLQ_GUTTER_LEFT_X, BUCKET_BOTTOM_Y - 64);

  // Diagonal hatch inside DLQ gutter
  ctx.save();
  ctx.beginPath();
  ctx.rect(DLQ_GUTTER_LEFT_X, 64, DLQ_GUTTER_RIGHT_X - DLQ_GUTTER_LEFT_X, BUCKET_BOTTOM_Y - 64);
  ctx.clip();
  ctx.strokeStyle = "rgba(196, 59, 43, 0.16)";
  ctx.lineWidth = 1;
  for (let y = 40; y < BUCKET_BOTTOM_Y + 60; y += 16) {
    ctx.beginPath();
    ctx.moveTo(DLQ_GUTTER_LEFT_X, y);
    ctx.lineTo(DLQ_GUTTER_RIGHT_X, y - 28);
    ctx.stroke();
  }
  ctx.restore();

  // DLQ Gutter walls
  ctx.strokeStyle = "#1a1714";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(DLQ_GUTTER_LEFT_X, 64);
  ctx.lineTo(DLQ_GUTTER_LEFT_X, BUCKET_BOTTOM_Y);
  ctx.lineTo(DLQ_GUTTER_RIGHT_X, BUCKET_BOTTOM_Y);
  ctx.moveTo(DLQ_GUTTER_RIGHT_X, 260);
  ctx.lineTo(DLQ_GUTTER_RIGHT_X, BUCKET_BOTTOM_Y);
  ctx.stroke();

  ctx.strokeStyle = "#c43b2b";
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(DLQ_GUTTER_RIGHT_X, 64);
  ctx.lineTo(DLQ_GUTTER_RIGHT_X, 260);
  ctx.stroke();
  ctx.setLineDash([]);

  // DLQ label and 3-streak indicator dots
  ctx.fillStyle = "#c43b2b";
  ctx.font = "700 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText("DLQ", DLQ_GUTTER_CENTER_X, 82);
  ctx.fillText("死信", DLQ_GUTTER_CENTER_X, 96);

  for (let i = 0; i < 3; i++) {
    const lit = readout.dlqStreak > i || readout.pagerActive;
    ctx.beginPath();
    ctx.arc(DLQ_GUTTER_CENTER_X - 12 + i * 12, 114, 4, 0, Math.PI * 2);
    ctx.fillStyle = lit ? "#c43b2b" : "rgba(26, 23, 20, 0.15)";
    ctx.fill();
    ctx.strokeStyle = "#1a1714";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 4. Right Plunger Lane (x: 536..576)
  ctx.fillStyle = "rgba(26, 23, 20, 0.04)";
  ctx.fillRect(PLUNGER_LANE_LEFT_X, 64, PLUNGER_LANE_RIGHT_X - PLUNGER_LANE_LEFT_X, BUCKET_BOTTOM_Y - 64);
  ctx.strokeStyle = "#1a1714";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PLUNGER_LANE_LEFT_X, 110);
  ctx.lineTo(PLUNGER_LANE_LEFT_X, BUCKET_BOTTOM_Y);
  ctx.moveTo(PLUNGER_LANE_RIGHT_X, 64);
  ctx.lineTo(PLUNGER_LANE_RIGHT_X, BUCKET_BOTTOM_Y);
  ctx.stroke();

  // Top arch guide line
  ctx.beginPath();
  ctx.moveTo(DLQ_GUTTER_LEFT_X, 64);
  ctx.lineTo(PLUNGER_LANE_RIGHT_X, 64);
  ctx.stroke();

  // Plunger spring & piston at bottom of plunger lane
  const springBottomY = BUCKET_BOTTOM_Y - 12;
  const springRestTopY = BUCKET_BOTTOM_Y - 110;
  const pistonY = springRestTopY + plungerPull * 64;

  ctx.strokeStyle = "#1a1714";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const coils = 7;
  ctx.moveTo(PLUNGER_LANE_CENTER_X, springBottomY);
  for (let i = 1; i <= coils; i++) {
    const t = i / coils;
    const y = springBottomY - t * (springBottomY - pistonY);
    const xOffset = i % 2 === 0 ? -9 : 9;
    ctx.lineTo(PLUNGER_LANE_CENTER_X + xOffset, y);
  }
  ctx.lineTo(PLUNGER_LANE_CENTER_X, pistonY);
  ctx.stroke();

  // Piston head
  ctx.fillStyle = "#c43b2b";
  ctx.fillRect(PLUNGER_LANE_LEFT_X + 4, pistonY - 8, PLUNGER_LANE_RIGHT_X - PLUNGER_LANE_LEFT_X - 8, 8);
  ctx.strokeRect(PLUNGER_LANE_LEFT_X + 4, pistonY - 8, PLUNGER_LANE_RIGHT_X - PLUNGER_LANE_LEFT_X - 8, 8);

  // 5. Stage 2 Dedupe Filter Gate bar
  ctx.fillStyle = "rgba(196, 59, 43, 0.12)";
  ctx.fillRect(PLAYFIELD_LEFT_X + 18, DEDUPE_GATE_Y - 6, PLAYFIELD_RIGHT_X - PLAYFIELD_LEFT_X - 36, 12);
  ctx.strokeStyle = "#c43b2b";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(PLAYFIELD_LEFT_X + 18, DEDUPE_GATE_Y - 6, PLAYFIELD_RIGHT_X - PLAYFIELD_LEFT_X - 36, 12);

  // 6. Stage 3 Stream Join Funnel walls
  ctx.strokeStyle = "#1a1714";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(FUNNEL_CENTER_X - 150, FUNNEL_TOP_Y);
  ctx.lineTo(FUNNEL_CENTER_X - 24, FUNNEL_HOLD_Y);
  ctx.lineTo(FUNNEL_CENTER_X - 24, FUNNEL_EXIT_Y);
  ctx.moveTo(FUNNEL_CENTER_X + 150, FUNNEL_TOP_Y);
  ctx.lineTo(FUNNEL_CENTER_X + 24, FUNNEL_HOLD_Y);
  ctx.lineTo(FUNNEL_CENTER_X + 24, FUNNEL_EXIT_Y);
  ctx.stroke();

  // Join funnel hold chamber badge
  const hasJoinWaiter = sim.joinHeldBallId !== null;
  ctx.fillStyle = hasJoinWaiter ? "rgba(196, 59, 43, 0.2)" : "rgba(26, 23, 20, 0.06)";
  ctx.beginPath();
  ctx.arc(FUNNEL_CENTER_X, FUNNEL_HOLD_Y, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hasJoinWaiter ? "#c43b2b" : "rgba(26, 23, 20, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (hasJoinWaiter) {
    ctx.fillStyle = "#c43b2b";
    ctx.font = "700 9px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText("HOLD 1/2", FUNNEL_CENTER_X, FUNNEL_HOLD_Y - 20);
  }

  // 7. Stage 5 Partition Buckets (p0..p5) + DLQ sink at bottom
  const playWidth = PLAYFIELD_RIGHT_X - PLAYFIELD_LEFT_X;
  const bucketWidth = playWidth / PARTITION_BUCKET_IDS.length;
  const maxCount = Math.max(
    6,
    ...PARTITION_BUCKET_IDS.map((id) => readout.buckets[id]),
    readout.dlqCount,
  );

  for (let i = 0; i < PARTITION_BUCKET_IDS.length; i++) {
    const id = PARTITION_BUCKET_IDS[i]!;
    const bx = PLAYFIELD_LEFT_X + i * bucketWidth;
    const count = readout.buckets[id];
    const fillRatio = Math.min(1, count / maxCount);
    const barH = Math.round(fillRatio * (BUCKET_BOTTOM_Y - BUCKET_TOP_Y - 22));

    ctx.strokeStyle = "#1a1714";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx, BUCKET_TOP_Y);
    ctx.lineTo(bx, BUCKET_BOTTOM_Y);
    ctx.stroke();

    if (barH > 0) {
      ctx.fillStyle = "rgba(26, 23, 20, 0.82)";
      ctx.fillRect(bx + 6, BUCKET_BOTTOM_Y - barH, bucketWidth - 12, barH);
    }

    ctx.fillStyle = "#1a1714";
    ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText(id.toUpperCase(), bx + bucketWidth * 0.5, BUCKET_BOTTOM_Y + 16);
    ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(String(count), bx + bucketWidth * 0.5, BUCKET_TOP_Y + 14);
  }

  // Bottom floor line across buckets
  ctx.strokeStyle = "#1a1714";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(DLQ_GUTTER_LEFT_X, BUCKET_BOTTOM_Y);
  ctx.lineTo(PLUNGER_LANE_RIGHT_X, BUCKET_BOTTOM_Y);
  ctx.stroke();

  // DLQ bottom sink bar & count
  const dlqFillRatio = Math.min(1, readout.dlqCount / maxCount);
  const dlqBarH = Math.round(dlqFillRatio * (BUCKET_BOTTOM_Y - BUCKET_TOP_Y - 22));
  if (dlqBarH > 0) {
    ctx.fillStyle = "rgba(196, 59, 43, 0.85)";
    ctx.fillRect(
      DLQ_GUTTER_LEFT_X + 6,
      BUCKET_BOTTOM_Y - dlqBarH,
      DLQ_GUTTER_RIGHT_X - DLQ_GUTTER_LEFT_X - 12,
      dlqBarH,
    );
  }
  ctx.fillStyle = "#c43b2b";
  ctx.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "center";
  ctx.fillText("DLQ", DLQ_GUTTER_CENTER_X, BUCKET_BOTTOM_Y + 16);
  ctx.fillText(String(readout.dlqCount), DLQ_GUTTER_CENTER_X, BUCKET_TOP_Y + 14);

  // 8. Draw Pegs
  for (const peg of sim.board.pegs) {
    ctx.beginPath();
    ctx.arc(peg.x, peg.y, peg.radius, 0, Math.PI * 2);
    if (peg.stage === "dedupe") {
      ctx.fillStyle = "#c43b2b";
    } else if (peg.stage === "join") {
      ctx.fillStyle = "#2b4c65";
    } else {
      ctx.fillStyle = "#1a1714";
    }
    ctx.fill();
  }

  // 9. Draw Active Ink Balls (records)
  for (const ball of sim.balls) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    if (ball.stage === "dlq" || ball.routeToDlq) {
      ctx.fillStyle = "#c43b2b";
    } else if (ball.dedupeBounced) {
      ctx.fillStyle = "#8c3b2b";
    } else if (ball.joined) {
      ctx.fillStyle = "#1d4e5f";
    } else {
      ctx.fillStyle = "#1a1714";
    }
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#f5efe2";
    ctx.stroke();

    // Specular paper dot
    ctx.beginPath();
    ctx.arc(ball.x - 2.2, ball.y - 2.2, 1.6, 0, Math.PI * 2);
    ctx.fillStyle = "#f5efe2";
    ctx.fill();

    // Stamp tag if present (DUP / JOIN / LATE / DLQ)
    if (ball.stamp) {
      ctx.font = "700 8px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = ball.stamp === "DUP" || ball.stamp === "DLQ" ? "#c43b2b" : "#1a1714";
      ctx.fillText(ball.stamp, ball.x, ball.y - ball.radius - 3);
    }
    ctx.restore();
  }

  ctx.restore();
}

export function PachinkoMachine() {
  const simRef = useRef<PachinkoSimState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const plungerTrackRef = useRef<HTMLDivElement | null>(null);
  const dismissBtnRef = useRef<HTMLButtonElement | null>(null);
  const pegClickLimiterRef = useRef(createPegClickLimiter(MAX_PEG_CLICKS_PER_SECOND));

  const soundOn = useSyncExternalStore(subscribeSound, getSound, getServerSound);
  const soundOnRef = useRef(soundOn);
  useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );
  const hydrated = useSyncExternalStore(
    subscribeHydrated,
    getHydratedSnapshot,
    getHydratedServerSnapshot,
  );

  const [seedInput, setSeedInput] = useState<string>(String(DEFAULT_SEED));
  const [plungerPull, setPlungerPull] = useState<number>(0);
  const plungerPullRef = useRef<number>(0);
  const dragStateRef = useRef<{ active: boolean; startY: number } | null>(null);

  const [readout, setReadout] = useState<PachinkoReadout>(INITIAL_READOUT);
  const [pendingBackfillCount, setPendingBackfillCount] = useState<number>(0);
  const [totalLaunchedCount, setTotalLaunchedCount] = useState<number>(0);
  const [ariaLiveText, setAriaLiveText] = useState<string>(INITIAL_ARIA_SUMMARY);
  const [ariaUpdateCount, setAriaUpdateCount] = useState<number>(1);
  const lastAriaUpdateRef = useRef<number>(0);
  const ariaTimerRef = useRef<number | null>(null);

  const [tiltStatus, setTiltStatus] = useState<TiltStatus>("idle");
  const [tiltGamma, setTiltGamma] = useState<number>(0);
  const [nudgeCount, setNudgeCount] = useState<number>(0);
  const [lastNudgeDir, setLastNudgeDir] = useState<"left" | "right" | "none">("none");
  const [lastDuplicateKey, setLastDuplicateKey] = useState<string>("rec-dup-1");

  const ensureSim = useCallback((): PachinkoSimState => {
    if (simRef.current === null) {
      simRef.current = createPachinkoSim({ seed: DEFAULT_SEED });
    }
    return simRef.current;
  }, []);

  const playRateLimitedPegClicks = useCallback((sim: PachinkoSimState) => {
    if (!soundOnRef.current || sim.events.length === 0) return;
    const nowSec = performance.now() / 1000;
    for (const ev of sim.events) {
      if (ev.type === "peg-hit" && pegClickLimiterRef.current(nowSec)) {
        play("move");
      }
    }
  }, []);

  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const sim = ensureSim();
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const currentReadout = getReadout(sim);
    drawBoard(ctx, sim, currentReadout, plungerPullRef.current);
  }, [ensureSim]);

  const syncAriaLiveThrottled = useCallback((nextReadout: PachinkoReadout, immediate = false) => {
    const now = performance.now();
    const elapsed = now - lastAriaUpdateRef.current;
    const formatted = formatAriaLiveSummary(nextReadout);

    if (immediate || lastAriaUpdateRef.current === 0 || elapsed >= ARIA_THROTTLE_MS) {
      if (ariaTimerRef.current !== null) {
        window.clearTimeout(ariaTimerRef.current);
        ariaTimerRef.current = null;
      }
      lastAriaUpdateRef.current = now;
      setAriaLiveText((prev) => {
        if (prev !== formatted) {
          setAriaUpdateCount((c) => c + 1);
        }
        return formatted;
      });
      return;
    }

    if (ariaTimerRef.current === null) {
      const remaining = Math.max(50, ARIA_THROTTLE_MS - elapsed);
      ariaTimerRef.current = window.setTimeout(() => {
        ariaTimerRef.current = null;
        if (!simRef.current) return;
        const latest = getReadout(simRef.current);
        const latestText = formatAriaLiveSummary(latest);
        lastAriaUpdateRef.current = performance.now();
        setAriaLiveText((prev) => {
          if (prev !== latestText) {
            setAriaUpdateCount((c) => c + 1);
          }
          return latestText;
        });
      }, remaining);
    }
  }, []);

  const syncUiFromSim = useCallback(
    (immediateAria = false) => {
      const sim = ensureSim();
      const nextReadout = getReadout(sim);
      setReadout(nextReadout);
      setPendingBackfillCount(sim.scheduledSpawns.length);
      setTotalLaunchedCount(Math.max(0, sim.nextBallSeq - 1));
      syncAriaLiveThrottled(nextReadout, immediateAria);
      renderCanvas();
    },
    [ensureSim, renderCanvas, syncAriaLiveThrottled],
  );

  // Initialize from URL query parameters (?seed=... & ?fixture=dlq-streak)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const seedParam = params.get("seed");
    const fixtureParam = params.get("fixture");

    let initialSeed = DEFAULT_SEED;
    let hasCustomSeed = false;
    if (seedParam !== null) {
      const parsed = Number.parseInt(seedParam, 10);
      if (Number.isFinite(parsed)) {
        initialSeed = parsed >>> 0;
        hasCustomSeed = true;
      }
    }

    const sim = createPachinkoSim({ seed: initialSeed });
    simRef.current = sim;

    if (fixtureParam === "dlq-streak") {
      triggerDlqStreakFixture(sim, 3);
      stepPachinko(sim, 260);
    }

    const initId = window.requestAnimationFrame(() => {
      if (hasCustomSeed) {
        setSeedInput(String(initialSeed));
      }
      syncUiFromSim(true);
    });

    return () => {
      window.cancelAnimationFrame(initId);
      if (ariaTimerRef.current !== null) {
        window.clearTimeout(ariaTimerRef.current);
      }
    };
  }, [syncUiFromSim]);

  // Configure HiDPI canvas backing store (devicePixelRatio clamped to 2)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = BOARD_WIDTH * dpr;
    canvas.height = BOARD_HEIGHT * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    renderCanvas();
  }, [renderCanvas]);

  // Move focus to the pager Acknowledge/Dismiss button when pagerActive opens
  useEffect(() => {
    if (readout.pagerActive) {
      const id = window.requestAnimationFrame(() => {
        dismissBtnRef.current?.focus({ preventScroll: true });
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, [readout.pagerActive]);

  // Close pager on Escape key and support ArrowLeft / ArrowRight keyboard nudges
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName;
      if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
        return;
      }

      const sim = ensureSim();
      if (e.key === "Escape" && sim.pagerActive) {
        e.preventDefault();
        dismissPager(sim);
        syncUiFromSim(true);
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        nudgeBalls(sim, "left");
        setNudgeCount((c) => c + 1);
        setLastNudgeDir("left");
        syncUiFromSim();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nudgeBalls(sim, "right");
        setNudgeCount((c) => c + 1);
        setLastNudgeDir("right");
        syncUiFromSim();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [ensureSim, syncUiFromSim]);

  // Main requestAnimationFrame simulation loop
  useEffect(() => {
    let rafId = 0;

    const tick = () => {
      const sim = ensureSim();
      if (sim.balls.length > 0 || sim.scheduledSpawns.length > 0) {
        const steps = reducedMotion ? STEPS_PER_FRAME_REDUCED : STEPS_PER_FRAME_NORMAL;
        stepPachinko(sim, steps);
        playRateLimitedPegClicks(sim);

        const nextReadout = getReadout(sim);
        setReadout(nextReadout);
        setPendingBackfillCount(sim.scheduledSpawns.length);
        setTotalLaunchedCount(Math.max(0, sim.nextBallSeq - 1));
        syncAriaLiveThrottled(nextReadout);
        renderCanvas();
      } else {
        renderCanvas();
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [ensureSim, playRateLimitedPegClicks, reducedMotion, renderCanvas, syncAriaLiveThrottled]);

  // DeviceOrientationEvent listener when tilt is active
  useEffect(() => {
    if (tiltStatus !== "active") return;

    const onOrientation = (e: DeviceOrientationEvent) => {
      const sim = ensureSim();
      const gamma = typeof e.gamma === "number" ? e.gamma : 0;
      setTiltGamma(Math.round(gamma));
      setTiltFromGamma(sim, gamma);
    };

    window.addEventListener("deviceorientation", onOrientation, { passive: true });
    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
    };
  }, [ensureSim, tiltStatus]);

  const handleLaunchRecord = useCallback(
    (powerAmount = 0.78) => {
      const sim = ensureSim();
      const ball = launchBall(sim, { power: powerAmount });
      if (ball) {
        setLastDuplicateKey(ball.key);
      }
      stepPachinko(sim, reducedMotion ? 160 : 36);
      playRateLimitedPegClicks(sim);
      syncUiFromSim();
    },
    [ensureSim, playRateLimitedPegClicks, reducedMotion, syncUiFromSim],
  );

  const handleLaunchDuplicate = useCallback(() => {
    const sim = ensureSim();
    const keyToUse = lastDuplicateKey || "rec-dup-1";
    if (!sim.recentKeys.includes(keyToUse)) {
      launchBall(sim, { key: keyToUse, power: 0.76 });
      stepPachinko(sim, 95);
      playRateLimitedPegClicks(sim);
    }
    launchBall(sim, { key: keyToUse, power: 0.74 });
    stepPachinko(sim, 110);
    playRateLimitedPegClicks(sim);
    syncUiFromSim();
  }, [ensureSim, lastDuplicateKey, playRateLimitedPegClicks, syncUiFromSim]);

  const handleBackfill = useCallback(() => {
    const sim = ensureSim();
    scheduleBackfill(sim, { reducedMotion });
    stepPachinko(sim, reducedMotion ? 240 : 48);
    playRateLimitedPegClicks(sim);
    syncUiFromSim();
  }, [ensureSim, playRateLimitedPegClicks, reducedMotion, syncUiFromSim]);

  const handleLaunchSingleDlq = useCallback(() => {
    const sim = ensureSim();
    triggerDlqStreakFixture(sim, 1);
    stepPachinko(sim, 180);
    playRateLimitedPegClicks(sim);
    syncUiFromSim(true);
  }, [ensureSim, playRateLimitedPegClicks, syncUiFromSim]);

  const handleTriggerDlqStreak = useCallback(() => {
    const sim = ensureSim();
    triggerDlqStreakFixture(sim, 3);
    stepPachinko(sim, 260);
    playRateLimitedPegClicks(sim);
    syncUiFromSim(true);
  }, [ensureSim, playRateLimitedPegClicks, syncUiFromSim]);

  const handleDismissPager = useCallback(() => {
    const sim = ensureSim();
    dismissPager(sim);
    syncUiFromSim(true);
  }, [ensureSim, syncUiFromSim]);

  const handleNudge = useCallback(
    (direction: "left" | "right") => {
      const sim = ensureSim();
      nudgeBalls(sim, direction);
      setNudgeCount((c) => c + 1);
      setLastNudgeDir(direction);
      syncUiFromSim();
    },
    [ensureSim, syncUiFromSim],
  );

  const handleToggleTilt = useCallback(async () => {
    const sim = ensureSim();
    if (tiltStatus === "active") {
      setTiltStatus("idle");
      setTiltGamma(0);
      setTiltAcceleration(sim, 0);
      return;
    }

    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) {
      setTiltStatus("unsupported");
      return;
    }

    const DevOrient = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<"granted" | "denied">;
    };

    if (typeof DevOrient.requestPermission === "function") {
      try {
        const res = await DevOrient.requestPermission();
        if (res !== "granted") {
          setTiltStatus("denied");
          return;
        }
      } catch {
        setTiltStatus("denied");
        return;
      }
    }

    setTiltStatus("active");
  }, [ensureSim, tiltStatus]);

  const handleResetSeed = useCallback(
    (customSeed?: number) => {
      const parsed =
        customSeed !== undefined
          ? customSeed >>> 0
          : (Number.parseInt(seedInput, 10) || DEFAULT_SEED) >>> 0;
      setSeedInput(String(parsed));
      simRef.current = createPachinkoSim({ seed: parsed });
      setNudgeCount(0);
      setLastNudgeDir("none");
      syncUiFromSim(true);
    },
    [seedInput, syncUiFromSim],
  );

  // Pointer drag handlers for the spring plunger
  const onPlungerPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointer events in headless tests may omit pointer capture
    }
    dragStateRef.current = { active: true, startY: e.clientY };
    plungerPullRef.current = 0.25;
    setPlungerPull(0.25);
  }, []);

  const onPlungerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragStateRef.current;
      if (!drag || !drag.active) return;
      const deltaY = Math.max(0, e.clientY - drag.startY);
      const nextPull = Math.min(1, Math.max(0.15, deltaY / 56));
      plungerPullRef.current = nextPull;
      setPlungerPull(nextPull);
      renderCanvas();
    },
    [renderCanvas],
  );

  const onPlungerPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const drag = dragStateRef.current;
      if (!drag || !drag.active) return;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore capture release errors on synthetic events
      }
      const deltaY = Math.max(0, e.clientY - drag.startY);
      const releasePull = deltaY > 6 ? Math.min(1, Math.max(0.3, deltaY / 56)) : 0.75;
      dragStateRef.current = null;
      plungerPullRef.current = 0;
      setPlungerPull(0);
      handleLaunchRecord(releasePull);
    },
    [handleLaunchRecord],
  );

  const onPlungerKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleLaunchRecord(0.82);
      }
    },
    [handleLaunchRecord],
  );

  const maxBucketVal = Math.max(
    1,
    ...PARTITION_BUCKET_IDS.map((id) => readout.buckets[id]),
  );

  const backfillBatchSize = reducedMotion
    ? REDUCED_MOTION_BACKFILL_COUNT
    : DEFAULT_BACKFILL_COUNT;

  return (
    <div
      className="pachinko-root"
      data-testid="pachinko-root"
      data-hydrated={hydrated ? "true" : "false"}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      data-sound-on={soundOn ? "true" : "false"}
      data-tilt-status={tiltStatus}
    >
      {/* Sticky Status & Controls Bar */}
      <div className="pachinko-status-bar" data-testid="pachinko-status-bar">
        <div className="pachinko-status-group">
          <span className="pachinko-badge" data-testid="pachinko-active-badge">
            IN-FLIGHT: {readout.activeBalls + pendingBackfillCount}
          </span>
          <span className="pachinko-badge" data-testid="pachinko-settled-badge">
            SETTLED: {readout.totalCompleted}
          </span>
          <span
            className={`pachinko-badge ${readout.dlqStreak > 0 ? "pachinko-badge-accent" : ""}`}
            data-testid="pachinko-streak-badge"
          >
            DLQ STREAK: {readout.dlqStreak}/3
          </span>
        </div>

        <div className="pachinko-controls-row">
          <button
            type="button"
            className={`pachinko-btn ${soundOn ? "pachinko-btn-active" : ""}`}
            aria-pressed={soundOn}
            onClick={() => setSound(!soundOn)}
            data-testid="pachinko-sound-toggle"
          >
            {soundOn ? "Peg clicks: ON" : "Peg clicks: OFF"}
          </button>

          <button
            type="button"
            className={`pachinko-btn ${tiltStatus === "active" ? "pachinko-btn-active" : ""}`}
            aria-pressed={tiltStatus === "active"}
            onClick={handleToggleTilt}
            data-testid="pachinko-tilt-btn"
          >
            {tiltStatus === "active"
              ? `Tilt active (${tiltGamma}°)`
              : tiltStatus === "denied"
                ? "Tilt permission denied"
                : "Enable tilt"}
          </button>
        </div>
      </div>

      {/* Main Two-Column Workbench */}
      <div className="pachinko-workbench">
        {/* Left Column: Vertical Board & Spring Plunger */}
        <section className="pachinko-stage-panel" aria-label="Pipeline Pachinko playfield">
          <div className="pachinko-panel-header">
            <span className="pachinko-panel-title">Washi Pipeline Playfield</span>
            <span className="font-mono text-xs text-muted">
              Drag plunger down &amp; release · or press Space
            </span>
          </div>

          <div className="pachinko-board-layout">
            <div className="pachinko-canvas-frame">
              <canvas
                ref={canvasRef}
                width={BOARD_WIDTH}
                height={BOARD_HEIGHT}
                className="pachinko-canvas"
                tabIndex={0}
                role="application"
                aria-label="Pipeline Pachinko board. Press Space or Enter to launch a record, or ArrowLeft and ArrowRight to nudge active records."
                data-testid="pachinko-canvas"
                onPointerDown={onPlungerPointerDown}
                onPointerMove={onPlungerPointerMove}
                onPointerUp={onPlungerPointerUp}
                onPointerCancel={onPlungerPointerUp}
                onKeyDown={onPlungerKeyDown}
              />
            </div>

            {/* Dedicated Interactive Spring Plunger Track */}
            <div className="pachinko-plunger-rail">
              <span className="pachinko-plunger-label">PLUNGER</span>
              <div
                ref={plungerTrackRef}
                role="slider"
                tabIndex={0}
                aria-label="Spring plunger"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(plungerPull * 100)}
                className="pachinko-plunger-track"
                data-testid="pachinko-plunger"
                data-pull={plungerPull.toFixed(2)}
                onPointerDown={onPlungerPointerDown}
                onPointerMove={onPlungerPointerMove}
                onPointerUp={onPlungerPointerUp}
                onPointerCancel={onPlungerPointerUp}
                onKeyDown={onPlungerKeyDown}
              >
                <div
                  className="pachinko-plunger-knob"
                  style={{ top: `calc(${Math.round(plungerPull * 74)}% + 0.25rem)` }}
                >
                  ↓
                </div>
              </div>
              <span className="pachinko-plunger-pct" data-testid="pachinko-plunger-pct">
                {Math.round(plungerPull * 100)}%
              </span>
            </div>
          </div>

          {/* Primary Launch, Backfill, and Nudge Controls */}
          <div className="pachinko-controls-row">
            <button
              type="button"
              className="pachinko-btn pachinko-btn-primary"
              onClick={() => handleLaunchRecord(0.8)}
              data-testid="pachinko-launch-btn"
            >
              Launch record
            </button>

            <button
              type="button"
              className="pachinko-btn pachinko-btn-accent"
              onClick={handleBackfill}
              data-testid="pachinko-backfill-btn"
              data-batch-size={backfillBatchSize}
            >
              Backfill ({backfillBatchSize} records)
            </button>

            <button
              type="button"
              className="pachinko-btn"
              onClick={() => handleNudge("left")}
              data-testid="pachinko-nudge-left"
              aria-label="Nudge records left"
            >
              ← Nudge left
            </button>

            <button
              type="button"
              className="pachinko-btn"
              onClick={() => handleNudge("right")}
              data-testid="pachinko-nudge-right"
              aria-label="Nudge records right"
            >
              Nudge right →
            </button>
          </div>
        </section>

        {/* Right Column: Live Bar Chart, Readouts, Stage Diagnostics & Fault Injection */}
        <section className="pachinko-telemetry-panel" aria-label="Pipeline telemetry and controls">
          <div className="pachinko-panel-header">
            <span className="pachinko-panel-title">Live Telemetry Readout</span>
            <span
              className="font-mono text-xs text-muted"
              data-testid="pachinko-nudge-readout"
              data-nudge-count={nudgeCount}
              data-last-nudge={lastNudgeDir}
            >
              Nudges: {nudgeCount} ({lastNudgeDir})
            </span>
          </div>

          {/* Three core metrics required by acceptance criteria */}
          <div className="pachinko-readout-grid">
            <div className="pachinko-metric-card">
              <span className="pachinko-metric-label">Throughput</span>
              <span
                className="pachinko-metric-value"
                data-testid="pachinko-readout-rps"
                data-value={readout.recordsPerSec}
              >
                {readout.recordsPerSec.toFixed(1)}
              </span>
              <span className="pachinko-metric-sub">records/sec</span>
            </div>

            <div className="pachinko-metric-card">
              <span className="pachinko-metric-label">Late arrivals</span>
              <span
                className="pachinko-metric-value"
                data-testid="pachinko-readout-late"
                data-value={readout.lateArrivalPct}
              >
                {readout.lateArrivalPct.toFixed(1)}%
              </span>
              <span className="pachinko-metric-sub">watermark lag</span>
            </div>

            <div
              className={`pachinko-metric-card ${
                readout.dlqCount > 0 ? "pachinko-metric-card-alert" : ""
              }`}
            >
              <span className="pachinko-metric-label">DLQ spills</span>
              <span
                className="pachinko-metric-value"
                data-testid="pachinko-readout-dlq"
                data-value={readout.dlqCount}
                data-streak={readout.dlqStreak}
              >
                {readout.dlqCount}
              </span>
              <span className="pachinko-metric-sub">streak {readout.dlqStreak}/3</span>
            </div>
          </div>

          {/* Live 6-Bucket Partition Bar Chart */}
          <div className="pachinko-chart-section">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-xs font-bold uppercase">
                Partition Buckets (p0–p5)
              </span>
              <span className="font-mono text-xs text-muted" data-testid="pachinko-partition-total">
                {readout.totalPartitionCount} partitioned
              </span>
            </div>

            <div
              className="pachinko-bar-chart"
              role="img"
              aria-label="Six-bucket partition distribution bar chart for p0 through p5"
              data-testid="pachinko-bar-chart"
            >
              {PARTITION_BUCKET_IDS.map((bucketId) => {
                const count = readout.buckets[bucketId];
                const pct = count > 0 ? Math.max(10, Math.round((count / maxBucketVal) * 100)) : 2;
                return (
                  <div
                    key={bucketId}
                    className="pachinko-bar-col"
                    data-testid={`pachinko-bucket-${bucketId}`}
                    data-count={count}
                  >
                    <span
                      className="pachinko-bar-count"
                      data-testid={`pachinko-bucket-count-${bucketId}`}
                    >
                      {count}
                    </span>
                    <div className="pachinko-bar-well">
                      <div
                        className="pachinko-bar-fill"
                        style={{ height: `${pct}%` }}
                        data-testid={`pachinko-bucket-bar-${bucketId}`}
                      />
                    </div>
                    <span className="pachinko-bar-label">{bucketId}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 5 Pipeline Stages Breakdown */}
          <ul className="pachinko-stage-list" aria-label="Pipeline stage counters">
            <li className="pachinko-stage-item">
              <span>1. Ingest peg field</span>
              <span className="font-mono font-semibold" data-testid="pachinko-readout-launched">
                {totalLaunchedCount} launched
              </span>
            </li>
            <li className="pachinko-stage-item">
              <span>2. Dedupe filter gate (DUP stamps)</span>
              <span className="font-mono font-semibold" data-testid="pachinko-readout-deduped">
                {readout.dedupeBounceCount} deduped
              </span>
            </li>
            <li className="pachinko-stage-item">
              <span>3. Stream join funnel (2 → 1 pairs)</span>
              <span className="font-mono font-semibold" data-testid="pachinko-readout-joined">
                {readout.joinMergeCount} joined
              </span>
            </li>
            <li className="pachinko-stage-item">
              <span>4. Hash partition splitter (p0–p5)</span>
              <span className="font-mono font-semibold" data-testid="pachinko-readout-settled">
                {readout.totalCompleted} settled
              </span>
            </li>
          </ul>

          {/* Fault Injection & Deterministic Stage Probes */}
          <div className="pachinko-chart-section">
            <span className="font-mono text-xs font-bold uppercase">
              Fault Injection &amp; Stage Probes
            </span>
            <p className="text-xs text-muted">
              Send a duplicate record key to test the Dedupe Gate, or inject poison-pill records down
              the DLQ gutter. Three consecutive DLQ hits page the on-call engineer.
            </p>
            <div className="pachinko-controls-row">
              <button
                type="button"
                className="pachinko-btn"
                onClick={handleLaunchDuplicate}
                data-testid="pachinko-launch-duplicate-btn"
              >
                Send duplicate key (DUP)
              </button>

              <button
                type="button"
                className="pachinko-btn"
                onClick={handleLaunchSingleDlq}
                data-testid="pachinko-launch-dlq-btn"
              >
                Inject DLQ spill
              </button>

              <button
                type="button"
                className="pachinko-btn pachinko-btn-accent"
                onClick={handleTriggerDlqStreak}
                data-testid="pachinko-dlq-streak-btn"
              >
                Trigger 3× DLQ streak
              </button>
            </div>

            <div className="pachinko-seed-row pt-1">
              <label htmlFor="pachinko-seed-input" className="font-mono text-xs text-muted">
                PRNG seed:
              </label>
              <input
                id="pachinko-seed-input"
                type="number"
                className="pachinko-seed-input"
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                data-testid="pachinko-seed-input"
              />
              <button
                type="button"
                className="pachinko-btn"
                onClick={() => handleResetSeed()}
                data-testid="pachinko-reset-btn"
              >
                Reset board
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Throttled (~1s) aria-live="polite" screen reader telemetry summary */}
      <div
        className="pachinko-sr-only"
        aria-live="polite"
        aria-atomic="true"
        data-testid="pachinko-aria-live"
        data-update-count={ariaUpdateCount}
      >
        {ariaLiveText}
      </div>

      {/* Viewport-pinned Paper "On-Call Pager" Easter Egg on 3 consecutive DLQ hits */}
      {readout.pagerActive && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="pachinko-pager-title"
          aria-describedby="pachinko-pager-desc"
          className="pachinko-pager"
          data-testid="pachinko-pager"
        >
          <div className="pachinko-pager-header">
            <span className="pachinko-pager-stamp">SEV-2 · PAGER ALERT · 呼出</span>
            <span className="font-mono text-xs text-muted">
              DLQ STREAK {readout.dlqStreak}×
            </span>
          </div>
          <h3 id="pachinko-pager-title" className="pachinko-pager-title">
            On-Call Pager: 3 Consecutive Dead-Letter Queue Spills
          </h3>
          <p id="pachinko-pager-desc" className="pachinko-pager-body">
            Three consecutive records bypassed partition buckets <span className="font-mono">p0–p5</span>{" "}
            and spilled into the dead-letter queue gutter (<span className="font-mono">DLQ={readout.dlqCount}</span>
            ). Acknowledge this page to silence the paper buzzer and reset the consecutive DLQ streak.
          </p>
          <div className="pachinko-pager-actions">
            <button
              ref={dismissBtnRef}
              type="button"
              className="pachinko-btn pachinko-btn-primary"
              onClick={handleDismissPager}
              data-testid="pachinko-pager-dismiss"
            >
              Acknowledge &amp; dismiss page
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
