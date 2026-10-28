import { createFold, foldMesh } from '@/lib/crumple';

/** Basket work can retain this paint surface; dispose always releases its bitmap. */
export function createCrumpleRenderer(root: HTMLElement, seed: number, reduced: boolean, onFailure: () => void, onBall: (canvas: HTMLCanvasElement) => void) {
  const canvas = document.createElement('canvas');
  canvas.className = 'paper-fold-canvas'; canvas.setAttribute('aria-hidden', 'true');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D unavailable');
  const box = root.getBoundingClientRect();
  if (box.width <= 0 || box.height <= 0) throw new Error('Paper has no box');
  // Normalize the entire paper to the host, then converge to a circular 76px ball.
  const width = Math.min(2048, box.width), height = Math.min(2048, box.height);
  const dpr = Math.min(2, Math.max(1, devicePixelRatio || 1));
  canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr);
  const style = getComputedStyle(root);
  const paper = style.getPropertyValue('--paper').trim(), ink = style.getPropertyValue('--ink').trim();
  const fold = createFold({ seed, clock: () => performance.now() });
  let frame = 0, disposed = false;
  const paint = () => {
    if (disposed) return;
    try {
      if (!root.isConnected || document.hidden || context.isContextLost()) throw new Error('Paper canvas lost');
      fold.tick();
      context.setTransform(dpr, 0, 0, dpr, 0, 0); context.clearRect(0, 0, width, height);
      const t = fold.elapsed / 400, size = Math.min(152, width, height);
      const sx = width * (1 - t) + size * t, sy = height * (1 - t) + size * t;
      for (const triangle of foldMesh(seed, fold.elapsed)) {
        context.beginPath();
        triangle.points.forEach((p, i) => {
          const x = width / 2 + (p.x - .5) * sx, y = height / 2 + (p.y - .5) * sy;
          if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
        });
        context.closePath(); context.globalAlpha = 1; context.fillStyle = paper; context.fill();
        context.fillStyle = ink; context.globalAlpha = triangle.shade * .17 * t; context.fill();
        context.globalAlpha = .15 + .4 * t; context.strokeStyle = ink; context.lineWidth = .7; context.stroke();
      }
      context.globalAlpha = 1;
      root.parentElement!.dataset.crumpleState = fold.state;
      if (fold.state === 'folding') frame = requestAnimationFrame(paint);
      else onBall(canvas);
    } catch { onFailure(); }
  };
  const dispose = () => { disposed = true; cancelAnimationFrame(frame); canvas.removeEventListener('contextlost', onFailure); canvas.remove(); canvas.width = canvas.height = 0; fold.cancel(); };
  canvas.addEventListener('contextlost', onFailure);
  fold.start(reduced); root.append(canvas);
  // Prove the first paint before concealing any source children.
  paint();
  if (!canvas.width) { dispose(); throw new Error('Paper paint failed'); }
  return { canvas, dispose };
}
