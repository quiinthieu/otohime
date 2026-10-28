import { launchBall, placeInBasket, stepBall, type BallWorld, type PaperBall } from '@/lib/crumple';
import type { GesturePort } from '@/lib/tactile';

/** The paper adapter owns disposal; this adapter owns the ball's capture and rAF. */
export function createBallFlight(el: HTMLElement, root: HTMLElement, canvas: HTMLCanvasElement, gesture: GesturePort, motion: MediaQueryList, signal: AbortSignal, restore: () => void, live: HTMLElement) {
  const grip = document.createElement('button');
  grip.type = 'button'; grip.className = 'paper-ball-grip'; grip.setAttribute('aria-label', 'Drag paper ball');
  grip.dataset.sourceId = el.dataset.paperId;
  const image = document.createElement('canvas'); image.width = image.height = 88; image.setAttribute('aria-hidden', 'true');
  const context = image.getContext('2d');
  if (!context) throw new Error('Ball canvas unavailable');
  const rect = canvas.getBoundingClientRect(), dpr = canvas.width / rect.width;
  const crop = Math.min(76, rect.width, rect.height) * dpr;
  context.drawImage(canvas, (canvas.width - crop) / 2, (canvas.height - crop) / 2, crop, crop, 8, 8, 72, 72);
  const picture = document.createElement('img'); picture.src = image.toDataURL(); picture.alt = ''; picture.setAttribute('aria-hidden', 'true');
  image.width = image.height = 0; grip.append(picture); root.append(grip);
  let frame = 0, previous = 0, disposed = false, ball: PaperBall | null = null;
  let drag: { pointer: number; x: number; y: number; time: number; vx: number; vy: number } | null = null;
  const world = (): BallWorld => {
    const k = document.querySelector('[data-paper-basket]')?.getBoundingClientRect();
    if (!k) throw new Error('Basket unavailable');
    return { width: innerWidth, height: innerHeight, basket: { left: k.left + 14, right: k.right - 14, top: k.top + 14, bottom: k.bottom - 8 } };
  };
  const release = () => {
    const pointer = drag?.pointer; drag = null;
    if (pointer !== undefined) { gesture.cancel(); if (grip.hasPointerCapture(pointer)) grip.releasePointerCapture(pointer); }
  };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };
  const paint = () => {
    if (!ball) return;
    grip.dataset.ballState = ball.state; grip.dataset.rimHits = String(ball.rimHits);
    grip.dataset.activeMs = String(ball.activeMs); grip.dataset.simulating = String(!!frame);
    el.dataset.tossState = ball.state;
    grip.style.left = `${ball.x - 22 + (ball.state === 'basket' ? scrollX : 0)}px`;
    grip.style.top = `${ball.y - 22 + (ball.state === 'basket' ? scrollY : 0)}px`;
    grip.style.position = ball.state === 'basket' ? 'absolute' : 'fixed';
    if (ball.state === 'basket') live.textContent = 'Paper landed in the basket. Read card or Reset brings it back.';
    else if (ball.state === 'rest') live.textContent = 'Paper came to rest outside the basket. Toss again, Read card or Reset.';
  };
  const tick = (now: number) => {
    frame = 0;
    if (disposed || !ball) return;
    if (!el.isConnected || document.hidden || motion.matches || document.querySelector('[aria-modal="true"],dialog[open]')) { restore(); return; }
    try {
      ball = stepBall(ball, now - previous, world()); previous = now;
      if (ball.state === 'flying') frame = requestAnimationFrame(tick);
      paint();
    } catch { restore(); }
  };
  const toss = (point?: { x: number; y: number }, velocity = { x: 0, y: 0 }) => {
    if (disposed || gesture.pointer !== null || document.hidden) return;
    stop();
    try {
      const w = world(), k = w.basket;
      const offscreen = k.top < 18 || k.bottom > w.height || k.left < 0 || k.right > w.width;
      canvas.style.opacity = '0'; if (grip.parentElement !== document.body) document.body.append(grip);
      if (motion.matches || (!point && offscreen)) ball = placeInBasket(w);
      else if (point) ball = launchBall(point, velocity, w);
      else {
        const r = root.getBoundingClientRect();
        const start = { x: Math.max(18, Math.min(innerWidth - 18, r.x + r.width / 2)), y: Math.max(18, Math.min(k.top - 65, r.y + r.height / 2)) };
        const seconds = Math.sqrt(Math.max(50, k.top - start.y) * 2 / 980);
        ball = launchBall(start, { x: ((k.left + k.right) / 2 - start.x) / seconds, y: 0 }, w);
      }
      previous = performance.now();
      if (ball.state === 'flying') frame = requestAnimationFrame(tick);
      paint();
    } catch { restore(); }
  };
  grip.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !e.isPrimary || disposed || gesture.pointer !== null || document.querySelector('[aria-modal="true"],dialog[open]')) return;
    if (!gesture.start({ pointer: e.pointerId, x: e.clientX, y: e.clientY, intent: 'grip' })) return;
    stop();
    const box = grip.getBoundingClientRect();
    canvas.style.opacity = '0'; if (grip.parentElement !== document.body) document.body.append(grip);
    ball = launchBall({ x: box.x + 22, y: box.y + 22 }, { x: 0, y: 0 }, world()); paint();
    drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, time: performance.now(), vx: 0, vy: 0 };
    grip.focus({ preventScroll: true }); grip.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();
  }, { signal });
  grip.addEventListener('pointermove', e => {
    if (drag?.pointer !== e.pointerId) return;
    const now = performance.now(), dt = Math.max(8, now - drag.time) / 1000;
    drag = { pointer: e.pointerId, x: e.clientX, y: e.clientY, time: now, vx: (e.clientX - drag.x) / dt, vy: (e.clientY - drag.y) / dt };
    canvas.style.opacity = '0'; if (grip.parentElement !== document.body) document.body.append(grip);
    ball = launchBall(drag, { x: 0, y: 0 }, world()); paint();
    e.preventDefault();
  }, { signal });
  grip.addEventListener('pointerup', e => {
    if (drag?.pointer !== e.pointerId) return;
    const old = drag, fresh = performance.now() - old.time < 150;
    release(); toss({ x: e.clientX, y: e.clientY }, fresh ? { x: old.vx, y: old.vy } : { x: 0, y: 0 });
  }, { signal });
  for (const type of ['pointercancel', 'lostpointercapture'] as const) grip.addEventListener(type, e => { if (drag?.pointer === e.pointerId) restore(); }, { signal });
  grip.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); if (!e.detail) toss(); }, { signal });
  return {
    toss: () => toss(),
    dispose() { disposed = true; stop(); release(); if (document.activeElement === grip) el.querySelector<HTMLButtonElement>('.paper-crumple')?.focus({ preventScroll: true }); grip.remove(); image.width = image.height = 0; delete el.dataset.tossState; },
  };
}
