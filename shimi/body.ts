import { shimiRng, type ShimiRng } from "./rng.ts";
import { extractCrawlableWords } from "./walker.ts";

export const SHIMI_TRAIL_ALPHA = 0.12;
export const SHIMI_TRAIL_CAP = 48;
export const SHIMI_NIBBLE_CAP = 12;
export type ShimiPoint = { x: number; y: number };
export type ShimiWordTarget = ShimiPoint & { id: string; text: string; width: number; height: number };
export type ShimiNibble = ShimiPoint & {
  id: number; targetId: string; char: string; width: number; height: number; alpha: number; born: number;
};
export type ShimiSegment = { x: number; radius: number };
export type ShimiLegPair = { x: number; length: number; phase: number; leftAngle: number; rightAngle: number };
export type ShimiFeeler = { x: number; length: number; angle: number };
export type ShimiCreature = ShimiPoint & {
  id: string; seed: number; segmentCount: number; segments: readonly ShimiSegment[];
  legs: readonly ShimiLegPair[]; antennae: readonly ShimiFeeler[]; cerci: readonly ShimiFeeler[];
  heading: number; speed: number; phase: number; targetId: string | null; nibbleIn: number;
  trail: readonly (ShimiPoint & { alpha: number })[]; trailHead: number;
};
export type ShimiSwarm = {
  creatures: readonly ShimiCreature[]; nibbles: readonly ShimiNibble[]; elapsed: number; nextNibbleId: number;
};

export function createShimiSwarm(seed: number, count = 4): ShimiSwarm {
  const rng = shimiRng(seed);
  const size = Math.max(3, Math.min(5, Number.isFinite(count) ? Math.floor(count) : 4));
  const creatures = Array.from({ length: size }, (_, id): ShimiCreature => {
    const creatureSeed = Math.floor(rng() * 4294967296), next = shimiRng(creatureSeed);
    const segmentCount = 7 + Math.floor(next() * 3), radius = 2 + next();
    const segments = Array.from({ length: segmentCount }, (_, i) => ({
      x: -i * radius * 1.15, radius: radius * (1 - i / segmentCount) ** 0.8,
    }));
    const phase = next() * Math.PI * 2;
    const legs = Array.from({ length: 3 + Math.floor(next() * 2) }, (_, i) => {
      const legPhase = phase + i * Math.PI * 0.7;
      return { x: segments[i + 1].x, length: radius * (1.7 + next() * 0.4), phase: legPhase,
        leftAngle: Math.PI / 2 + Math.sin(legPhase) * 0.45,
        rightAngle: -Math.PI / 2 + Math.sin(legPhase + Math.PI) * 0.45 };
    });
    return {
      id: `shimi-${id}`, seed: creatureSeed, segmentCount, segments, legs,
      antennae: [-1, 1].map(side => ({ x: radius, length: radius * (2.5 + next()), angle: side * 0.6 })),
      cerci: [-1, 0, 1].map(side => ({ x: segments[segmentCount - 1].x,
        length: radius * (2 + next()), angle: Math.PI + side * 0.55 })),
      x: 24 + next() * 180, y: 24 + next() * 180, heading: next() * Math.PI * 2,
      speed: 18 + next() * 18, phase, targetId: null, nibbleIn: 0,
      trail: [], trailHead: 0,
    };
  });
  return { creatures, nibbles: [], elapsed: 0, nextNibbleId: 0 };
}

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));
function usableTargets(wordTargets: readonly ShimiWordTarget[], viewport: { width: number; height: number }) {
  return wordTargets.filter(target => {
    if (![target.x, target.y, target.width, target.height].every(Number.isFinite) ||
      target.width <= 0 || target.height <= 0 || target.x < 0 || target.y < 0 ||
      target.x + target.width > viewport.width || target.y + target.height > viewport.height) return false;
    const words = extractCrawlableWords(target.text);
    return words.length === 1 && words[0] === target.text;
  });
}

/** Start beside visible prose rather than crossing an empty page margin first. */
export function placeShimiSwarm(swarm: ShimiSwarm, wordTargets: readonly ShimiWordTarget[],
  viewport: { width: number; height: number }): ShimiSwarm {
  const targets = usableTargets(wordTargets, viewport);
  if (!targets.length) return swarm;
  return { ...swarm, creatures: swarm.creatures.map(creature => {
    const target = targets[creature.seed % targets.length];
    const x = clamp(target.x - 32, viewport.width), y = clamp(target.y + target.height / 2, viewport.height);
    return { ...creature, x, y, targetId: target.id, heading: 0 };
  }) };
}

/** dt is seconds, viewport and cached word rectangles are pixels. No layout reads.
 * A stalled frame advances at most 100ms; pass dt=0 for a static resting pose.
 * Trail storage is a fixed ring; trailHead points at the next slot to replace.
 */
export function stepShimiSwarm(swarm: ShimiSwarm, wordTargets: readonly ShimiWordTarget[], dt: number,
  viewport: { width: number; height: number }, rng: ShimiRng): ShimiSwarm {
  if (!Number.isFinite(dt) || dt <= 0 || !Number.isFinite(viewport.width) || !Number.isFinite(viewport.height) ||
    viewport.width <= 0 || viewport.height <= 0) return swarm;
  const seconds = Math.min(dt, 0.1), elapsed = swarm.elapsed + seconds;
  const targets = usableTargets(wordTargets, viewport);
  const nibbles = swarm.nibbles.filter(nibble => elapsed - nibble.born < 4).slice(-SHIMI_NIBBLE_CAP)
    .map(nibble => ({ ...nibble, alpha: Math.min(1, Math.max(0, (4 - (elapsed - nibble.born)) / 0.4)) }));
  let nextNibbleId = swarm.nextNibbleId;
  const creatures = swarm.creatures.map(creature => {
    const target = targets.find(word => word.id === creature.targetId) ??
      (targets.length ? targets[Math.floor(rng() * targets.length)] : undefined);
    const x0 = clamp(creature.x, viewport.width), y0 = clamp(creature.y, viewport.height);
    const dx = target ? target.x + target.width / 2 - x0 : Math.cos(creature.heading) * 40;
    const dy = target ? target.y + target.height / 2 - y0 : Math.sin(creature.heading) * 40;
    const distance = Math.hypot(dx, dy), travel = Math.min(distance, creature.speed * seconds);
    const x = clamp(x0 + (distance ? dx / distance * travel : 0), viewport.width);
    const y = clamp(y0 + (distance ? dy / distance * travel : 0), viewport.height);
    let heading = distance ? Math.atan2(dy, dx) : creature.heading;
    if (!target && (x === 0 || x === viewport.width || y === 0 || y === viewport.height)) heading += Math.PI;
    let nibbleIn = Math.max(0, creature.nibbleIn - seconds);
    let targetId = target?.id ?? null;
    if (target && distance <= travel + 2 && nibbleIn === 0) {
      if (nibbles.length < SHIMI_NIBBLE_CAP) {
        const chars = [...target.text], index = Math.floor(rng() * chars.length), width = target.width / chars.length;
        nibbles.push({ id: nextNibbleId++, targetId: target.id, char: chars[index],
          x: target.x + width * index, y: target.y + target.height * 0.25,
          width: width * 0.65, height: target.height * 0.5, alpha: 1, born: elapsed });
      }
      nibbleIn = 1.25;
      targetId = null;
    }
    const trail = [...creature.trail];
    trail[creature.trailHead] = { x, y, alpha: SHIMI_TRAIL_ALPHA };
    return { ...creature, x, y, heading, nibbleIn, targetId,
      legs: creature.legs.map(leg => ({ ...leg,
        leftAngle: Math.PI / 2 + Math.sin(elapsed * 12 + leg.phase) * 0.45,
        rightAngle: -Math.PI / 2 + Math.sin(elapsed * 12 + leg.phase + Math.PI) * 0.45,
      })),
      trail, trailHead: (creature.trailHead + 1) % SHIMI_TRAIL_CAP };
  });
  return { creatures, nibbles, elapsed, nextNibbleId };
}

/** Distance to the notch rectangle, so hovering its edge also restores it. */
export function restoreShimiNibblesNear(nibbles: readonly ShimiNibble[], x: number, y: number, radius = 24): ShimiNibble[] {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return [...nibbles];
  const r = Number.isFinite(radius) ? Math.max(0, radius) : 24;
  return nibbles.filter(nibble => Math.hypot(Math.max(nibble.x - x, 0, x - nibble.x - nibble.width),
    Math.max(nibble.y - y, 0, y - nibble.y - nibble.height)) > r);
}

/** Focus restoration is immediate, including under reduced motion. */
export function restoreAllShimiNibbles(nibbles: readonly ShimiNibble[]): ShimiNibble[] { return nibbles.slice(0, 0); }
