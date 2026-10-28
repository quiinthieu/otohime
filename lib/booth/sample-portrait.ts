// Deterministic procedural paper portrait generator for the Ink Purikura Photobooth (/play/booth).
// Used whenever no webcam is present, permission is denied, the context is insecure, or the visitor
// selects "Use sample portrait". Runs through the identical WebGL2 / Canvas 2D film-stock pipeline.

import { createPixelBuffer, type PixelBuffer } from "./film-stock.ts";

export const SAMPLE_PORTRAIT_SEED = 0x50726174;
export const SAMPLE_PORTRAIT_WIDTH = 480;
export const SAMPLE_PORTRAIT_HEIGHT = 360;

export interface SamplePortraitOptions {
  readonly width?: number;
  readonly height?: number;
  readonly poseIndex?: number;
  readonly seed?: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

function smoothDisk(dx: number, dy: number, rx: number, ry: number, feather = 0.04): number {
  const d = Math.hypot(dx / rx, dy / ry);
  if (d <= 1 - feather) return 1;
  if (d >= 1 + feather) return 0;
  const t = (d - (1 - feather)) / (2 * feather);
  return 1 - t * t * (3 - 2 * t);
}

export function generateSamplePortrait(
  options: SamplePortraitOptions = {},
): PixelBuffer {
  const width = Math.max(16, Math.floor(options.width ?? SAMPLE_PORTRAIT_WIDTH));
  const height = Math.max(16, Math.floor(options.height ?? SAMPLE_PORTRAIT_HEIGHT));
  const pose = ((options.poseIndex ?? 0) % 4 + 4) % 4;
  const seed = (options.seed ?? SAMPLE_PORTRAIT_SEED) ^ Math.imul(pose + 1, 0x9e3779b9);
  const rand = mulberry32(seed);

  // Subtle deterministic pose variations across the 4 strip shots
  const headShiftX = ((pose === 1 ? -0.04 : pose === 2 ? 0.045 : pose === 3 ? -0.02 : 0) + (rand() - 0.5) * 0.01);
  const headShiftY = (pose === 2 ? -0.025 : pose === 3 ? 0.015 : 0);
  const headTilt = pose === 1 ? -0.08 : pose === 2 ? 0.07 : pose === 3 ? -0.05 : 0.02;
  const cosT = Math.cos(headTilt);
  const sinT = Math.sin(headTilt);

  const data = new Uint8ClampedArray(width * height * 4);

  for (let py = 0; py < height; py++) {
    const ny = (py / (height - 1)) * 2 - 1; // [-1, 1]
    for (let px = 0; px < width; px++) {
      const nx = ((px / (width - 1)) * 2 - 1) * (width / height); // aspect-corrected

      // Paper backdrop with subtle radial halo and diagonal screen texture
      const radial = Math.hypot(nx * 0.75, ny + 0.1);
      const sunHalo = smoothDisk(nx - 0.28, ny + 0.34, 0.42, 0.42, 0.06);
      const wavePattern = Math.sin(nx * 18 + ny * 6) * 0.5 + 0.5;

      let r = 236 - radial * 38 + wavePattern * 8;
      let g = 226 - radial * 42 + wavePattern * 6;
      let b = 208 - radial * 46;

      // Vermilion sun / moon circle behind shoulder
      if (sunHalo > 0) {
        r = r * (1 - sunHalo * 0.75) + 224 * (sunHalo * 0.75);
        g = g * (1 - sunHalo * 0.75) + 74 * (sunHalo * 0.75);
        b = b * (1 - sunHalo * 0.75) + 68 * (sunHalo * 0.75);
      }

      // Transform coordinates into head-local space
      const hx0 = nx - headShiftX;
      const hy0 = ny - headShiftY;
      const hx = hx0 * cosT - hy0 * sinT;
      const hy = hx0 * sinT + hy0 * cosT;

      // Kimono / haori shoulders & geometric collar at bottom
      const shoulderMask = smoothDisk(hx0, ny - 0.88, 0.78, 0.58, 0.04);
      if (shoulderMask > 0) {
        const check = ((Math.floor((hx0 + 2) * 14) + Math.floor((ny + 2) * 14)) & 1) === 0 ? 1 : 0;
        const indigoR = check ? 34 : 52;
        const indigoG = check ? 74 : 104;
        const indigoB = check ? 108 : 138;
        r = r * (1 - shoulderMask) + indigoR * shoulderMask;
        g = g * (1 - shoulderMask) + indigoG * shoulderMask;
        b = b * (1 - shoulderMask) + indigoB * shoulderMask;

        // Collar V-lapel in warm cream & crimson trim
        const collarDist = Math.abs(hx0) - (0.34 - (ny - 0.38) * 0.48);
        if (ny > 0.32 && Math.abs(collarDist) < 0.065) {
          r = 242;
          g = 232;
          b = 216;
        } else if (ny > 0.32 && Math.abs(collarDist - 0.065) < 0.025) {
          r = 204;
          g = 52;
          b = 64;
        }
      }

      // Back hair silhouette (sumi ink)
      const backHair = Math.max(
        smoothDisk(hx, hy + 0.06, 0.44, 0.52, 0.03),
        smoothDisk(hx, hy - 0.14, 0.47, 0.40, 0.03),
      );
      if (backHair > 0) {
        const sheen = Math.exp(-Math.pow((hy + 0.24) * 8, 2)) * 0.25;
        const hairR = 24 + sheen * 70;
        const hairG = 24 + sheen * 68;
        const hairB = 30 + sheen * 85;
        r = r * (1 - backHair) + hairR * backHair;
        g = g * (1 - backHair) + hairG * backHair;
        b = b * (1 - backHair) + hairB * backHair;
      }

      // Neck
      const neck = smoothDisk(hx, hy - 0.32, 0.13, 0.18, 0.03);
      if (neck > 0) {
        r = r * (1 - neck) + 228 * neck;
        g = g * (1 - neck) + 198 * neck;
        b = b * (1 - neck) + 178 * neck;
      }

      // Face oval (warm paper-ivory with soft cheek shading)
      const face = smoothDisk(hx, hy + 0.02, 0.31, 0.38, 0.03);
      if (face > 0) {
        const shade = Math.max(0, hx * 0.12 + hy * 0.1);
        let fr = 246 - shade * 55;
        let fg = 228 - shade * 60;
        let fb = 208 - shade * 65;

        // Rosy purikura cheek blush (strong warm pink for Riso berry channel)
        const blushL = smoothDisk(hx + 0.16, hy - 0.05, 0.085, 0.055, 0.18);
        const blushR = smoothDisk(hx - 0.16, hy - 0.05, 0.085, 0.055, 0.18);
        const blush = Math.max(blushL, blushR);
        if (blush > 0) {
          fr = fr * (1 - blush * 0.55) + 238 * (blush * 0.55);
          fg = fg * (1 - blush * 0.55) + 92 * (blush * 0.55);
          fb = fb * (1 - blush * 0.55) + 118 * (blush * 0.55);
        }

        r = r * (1 - face) + fr * face;
        g = g * (1 - face) + fg * face;
        b = b * (1 - face) + fb * face;
      }

      // Hime-cut bangs across forehead
      const bangs = smoothDisk(hx, hy + 0.29, 0.34, 0.18, 0.025);
      if (bangs > 0 && hy < -0.10 + Math.cos(hx * 12) * 0.018) {
        r = r * (1 - bangs) + 22 * bangs;
        g = g * (1 - bangs) + 22 * bangs;
        b = b * (1 - bangs) + 26 * bangs;
      }

      // Eyes & eyebrows
      const eyeLX = hx + 0.115;
      const eyeRX = hx - 0.115;
      const eyeY = hy + 0.03;

      // Eyebrows
      const browL = smoothDisk(eyeLX, eyeY + 0.075, 0.065, 0.014, 0.1);
      const browR = smoothDisk(eyeRX, eyeY + 0.075, 0.065, 0.014, 0.1);
      if (browL > 0 || browR > 0) {
        const bw = Math.max(browL, browR);
        r = r * (1 - bw) + 28 * bw;
        g = g * (1 - bw) + 26 * bw;
        b = b * (1 - bw) + 24 * bw;
      }

      // Left eye (winks on pose 1)
      if (pose === 1) {
        const winkL = smoothDisk(eyeLX, eyeY - Math.abs(eyeLX) * 0.15, 0.058, 0.013, 0.1);
        if (winkL > 0) {
          r = 24;
          g = 22;
          b = 22;
        }
      } else {
        const irisL = smoothDisk(eyeLX, eyeY, 0.042, 0.048, 0.06);
        if (irisL > 0) {
          const highlightL = smoothDisk(eyeLX + 0.012, eyeY + 0.014, 0.014, 0.014, 0.1);
          r = highlightL > 0.5 ? 250 : 20;
          g = highlightL > 0.5 ? 248 : 20;
          b = highlightL > 0.5 ? 245 : 26;
        }
      }

      // Right eye
      const irisR = smoothDisk(eyeRX, eyeY, 0.042, 0.048, 0.06);
      if (irisR > 0) {
        const highlightR = smoothDisk(eyeRX + 0.012, eyeY + 0.014, 0.014, 0.014, 0.1);
        r = highlightR > 0.5 ? 250 : 20;
        g = highlightR > 0.5 ? 248 : 20;
        b = highlightR > 0.5 ? 245 : 26;
      }

      // Nose bridge tick
      const nose = smoothDisk(hx, hy - 0.04, 0.012, 0.028, 0.15);
      if (nose > 0) {
        r = r * (1 - nose * 0.4) + 140 * (nose * 0.4);
        g = g * (1 - nose * 0.4) + 110 * (nose * 0.4);
        b = b * (1 - nose * 0.4) + 95 * (nose * 0.4);
      }

      // Mouth expression (varies by pose)
      const mouthY = hy - 0.145;
      if (pose === 2) {
        // Open surprised/laughing oval
        const mouth = smoothDisk(hx, mouthY, 0.045, 0.038, 0.08);
        if (mouth > 0) {
          r = 185;
          g = 44;
          b = 58;
        }
      } else {
        // Smile arc
        const smileCurve = mouthY + hx * hx * (pose === 3 ? 2.4 : 1.8);
        const mouth = smoothDisk(hx, smileCurve, pose === 3 ? 0.075 : 0.06, 0.018, 0.1);
        if (mouth > 0) {
          r = 192;
          g = 48;
          b = 62;
        }
      }

      // Kanzashi flower hairpin on top-left of hair
      const pin = smoothDisk(hx + 0.30, hy + 0.25, 0.068, 0.068, 0.08);
      if (pin > 0) {
        r = 232;
        g = 62;
        b = 96;
      }

      const idx = (py * width + px) * 4;
      data[idx] = clampByte(r);
      data[idx + 1] = clampByte(g);
      data[idx + 2] = clampByte(b);
      data[idx + 3] = 255;
    }
  }

  return createPixelBuffer(width, height, data);
}

export function generateSamplePortraitFrames(
  count = 4,
  options: Omit<SamplePortraitOptions, "poseIndex"> = {},
): readonly PixelBuffer[] {
  const frames: PixelBuffer[] = [];
  for (let i = 0; i < count; i++) {
    frames.push(generateSamplePortrait({ ...options, poseIndex: i }));
  }
  return Object.freeze(frames);
}
