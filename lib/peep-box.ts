/** Eye and world coordinates are SVG units, with +y down and the window at z=0. */
export interface EyePose {
  x: number;
  y: number;
  z: number;
}
export interface Aperture {
  width: number;
  height: number;
  viewer: number;
}
export interface LayerProjection {
  scale: number;
  x: number;
  y: number;
}
export interface PoseSource {
  readonly kind: "pointer" | "tilt" | "camera";
  start(emit: (pose: EyePose) => void): () => void;
}
export const WINDOW: Aperture = { width: 600, height: 360, viewer: 600 };
export const DEPTHS = [500, 300, 160, 60] as const;
export const NEUTRAL: EyePose = { x: 0, y: 0, z: 600 };

const finite = (n: number, fallback: number) =>
  Number.isFinite(n) ? n : fallback;
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export function boundEye(pose: EyePose, viewer = WINDOW.viewer): EyePose {
  return {
    x: clamp(finite(pose.x, 0), -150, 150),
    y: clamp(finite(pose.y, 0), -100, 100),
    z: clamp(finite(pose.z, viewer), viewer / 2, viewer * 1.5),
  };
}

/** Ray from eye E=(ex,ey,z) through layer point (X,Y,-depth), intersecting z=0.
 * Xwindow = z/(z+depth)*X + depth/(z+depth)*ex, relative to aperture centre.
 * The aperture itself never moves. No rotation/group-parallax approximation. */
export function projectLayer(
  pose: EyePose,
  depth: number,
  aperture: Aperture = WINDOW,
): LayerProjection {
  if (
    ![aperture.width, aperture.height, aperture.viewer].every(
      (n) => Number.isFinite(n) && n > 0,
    )
  )
    throw new RangeError("invalid_aperture");
  const eye = boundEye(pose, aperture.viewer);
  const d = clamp(finite(depth, 0), 0, aperture.viewer * 4);
  const scale = eye.z / (eye.z + d);
  return {
    scale,
    x: (aperture.width / 2 + eye.x) * (1 - scale),
    y: (aperture.height / 2 + eye.y) * (1 - scale),
  };
}

export function orientationPose(
  beta: number | null,
  gamma: number | null,
  angle: number,
  zero: { beta: number; gamma: number },
): EyePose | null {
  if (
    beta === null ||
    gamma === null ||
    ![beta, gamma, angle, zero.beta, zero.gamma].every(Number.isFinite)
  )
    return null;
  const rad = (angle * Math.PI) / 180;
  const delta = (n: number) => ((n + 540) % 360) - 180;
  const x = delta(gamma - zero.gamma) * 5,
    y = delta(beta - zero.beta) * 5;
  return boundEye({
    x: x * Math.cos(rad) + y * Math.sin(rad),
    y: y * Math.cos(rad) - x * Math.sin(rad),
    z: 600,
  });
}

export interface AxisState {
  position: number;
  velocity: number;
}
/** Exact critically damped spring step. Bounded dt avoids jumps after suspended tabs. */
export function smoothAxis(
  state: AxisState,
  target: number,
  elapsed: number,
): AxisState {
  const dt = clamp(finite(elapsed, 0), 0, 0.05),
    omega = 18;
  const offset = state.position - target,
    c = state.velocity + omega * offset,
    decay = Math.exp(-omega * dt);
  const position = target + (offset + c * dt) * decay,
    velocity = (state.velocity - omega * c * dt) * decay;
  return Math.abs(position - target) < 0.01 && Math.abs(velocity) < 0.05
    ? { position: target, velocity: 0 }
    : { position, velocity };
}

/** Exclusive ownership: a camera adapter can later use this same handoff. */
export class PoseSession {
  private release = () => {};
  private generation = 0;
  select(source: PoseSource, emit: (pose: EyePose) => void) {
    this.stop();
    const generation = this.generation;
    this.release = source.start((pose) => {
      if (generation === this.generation) emit(boundEye(pose));
    });
  }
  stop() {
    this.generation++;
    this.release();
    this.release = () => {};
  }
}
