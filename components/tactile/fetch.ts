import type { GesturePort } from '@/lib/tactile';
import { arriveFetch, beginFetch, boundFetchPoint, carryFetch, consumeDragClick, releaseVelocity, stepFetch, FETCH_LIMIT_MS, type DragClickToken, type FetchFlight, type FetchPoint } from '@/lib/kame-fetch';
import { commandKame, subscribeKameCompletion } from '@/components/kame/commands';

type Sample = FetchPoint & { time: number };
const modal = () => !!document.querySelector('[aria-modal="true"],dialog[open]');

/** One proxy and one subscription, sharing PaperLayer's sole pointer owner. */
export function createPaperFetch(gesture: GesturePort, signal: AbortSignal, motion: MediaQueryList) {
  let sequence = 0, frame = 0, previous = 0, started = 0;
  let flight: FetchFlight | null = null;
  let source: HTMLElement | null = null, message: HTMLElement | null = null, proxy: HTMLElement | null = null;
  let leg = '';
  let captureSource: HTMLElement | null = null;
  let releaseCapture = () => {};
  const viewport = () => ({ x: innerWidth, y: innerHeight });
  const paint = () => {
    if (!proxy || !flight) return;
    proxy.style.transform = `translate3d(${flight.point.x - 36}px,${flight.point.y - 26}px,0)`;
    proxy.dataset.phase = flight.phase;
    if (source) source.dataset.fetchState = flight.phase;
  };
  const finish = (returned = false) => {
    cancelAnimationFrame(frame); frame = 0;
    releaseCapture(); captureSource = null; releaseCapture = () => {};
    const controlled = !!leg; leg = '';
    if (source) source.dataset.fetchState = returned ? 'returned' : 'cancelled';
    if (message) message.textContent = returned ? 'Kame brought the paper back.' : 'Paper is back. Fetch cancelled or Kame could not reach it.';
    flight = null; source = null; message = null;
    proxy?.remove(); proxy = null;
    if (controlled) commandKame({ type: 'cancel' });
  };
  const send = (target: FetchPoint, suffix: string) => {
    leg = `${sequence}:${suffix}`;
    if (!commandKame({ type: 'fetch', id: leg, target })) { finish(); return false; }
    return true;
  };
  const draw = (now: number) => {
    frame = 0;
    if (!flight) return;
    if (!source?.isConnected || document.hidden || motion.matches || modal()) { finish(); return; }
    const before = flight.phase;
    flight = stepFetch(flight, Math.max(0, now - previous)); previous = now;
    if (flight.phase === 'cancelled') { finish(); return; }
    paint();
    if (before === 'toss' && flight.phase === 'seeking' && !send(flight.point, 'seek')) return;
    if (flight) frame = requestAnimationFrame(draw);
  };
  const unsubscribe = subscribeKameCompletion(event => {
    if (!flight || event.id !== leg) return;
    if (!source?.isConnected || performance.now() - started >= FETCH_LIMIT_MS) { finish(); return; }
    if (event.type === 'cancelled') { finish(); return; }
    if (event.type === 'position') { flight = carryFetch(flight, event.position); paint(); return; }
    if (event.type !== 'arrived') return;
    const before = flight.phase;
    flight = arriveFetch(flight, event.position); paint();
    if (before === 'seeking' && flight.phase === 'returning') {
      const rect = source!.getBoundingClientRect();
      flight.source = boundFetchPoint({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }, viewport());
      send(flight.source, 'return');
    }
    else if (flight.phase === 'returned') {
      // Keep the measured arrival for this paint; do not teleport Kame before it.
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => finish(true));
    }
  });
  const start = (el: HTMLElement, live: HTMLElement, point: FetchPoint, velocity = { x: 0, y: 0 }) => {
    finish();
    if (motion.matches || document.hidden || modal()) {
      el.dataset.fetchState = 'restored'; live.textContent = 'Paper is back. Kame is resting.'; return;
    }
    source = el; message = live; sequence++; started = performance.now();
    try { flight = beginFetch(el.getBoundingClientRect(), point, velocity, viewport()); }
    catch { finish(); return; }
    // Acceptance is checked before any proxy appears, including Save-Data/unmounted Kame.
    if (!send(flight.point, 'toss')) return;
    proxy = document.createElement('div'); proxy.className = 'paper-fetch-proxy'; proxy.dataset.fetchProxy = '';
    proxy.dataset.sourceId = el.dataset.paperId; proxy.setAttribute('aria-hidden', 'true');
    proxy.textContent = el.dataset.paperLabel ?? 'Paper'; document.body.append(proxy);
    live.textContent = 'Kame is fetching the paper.'; previous = performance.now(); paint();
    frame = requestAnimationFrame(draw);
  };
  const attach = (el: HTMLElement, root: HTMLElement, actions: HTMLElement, crumple?: () => void, restore = () => {}) => {
    const button = (text: string, className: string) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.className = className; return b; };
    const grip = button('↗', 'paper-grip'); grip.setAttribute('aria-label', 'Drag paper'); grip.title = 'Drag to toss paper for Kame';
    const back = button('Fetch back', 'paper-fetch');
    const live = document.createElement('span'); live.className = 'sr-only'; live.dataset.paperMessage = '';
    live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
    root.append(grip, live); actions.append(back);
    let origin: { pointer: number; target: HTMLElement; a: Sample; b: Sample; dragging: boolean } | null = null;
    let clickToken: DragClickToken | null = null;
    let holdTimer: ReturnType<typeof setTimeout> | undefined;
    let heldPointer: number | null = null;
    const targetKey = (target: EventTarget | null) => target === grip ? 'grip' : 'body';
    const release = () => {
      clearTimeout(holdTimer);
      const old = origin; origin = null; gesture.cancel();
      if (old?.target.hasPointerCapture(old.pointer)) old.target.releasePointerCapture(old.pointer);
    };
    const cancel = () => {
      if (origin?.dragging) clickToken = { pointer: origin.pointer, at: performance.now(), target: targetKey(origin.target) };
      release();
    };
    const fetchBack = () => {
      if (gesture.pointer !== null) { live.textContent = 'Finish the current paper gesture first.'; return; }
      restore();
      const rect = el.getBoundingClientRect();
      start(el, live, { x: rect.x + rect.width / 2 + 90, y: rect.y + rect.height / 2 - 70 });
    };
    back.addEventListener('click', fetchBack, { signal });
    grip.addEventListener('click', fetchBack, { signal });
    el.addEventListener('click', e => {
      const result = consumeDragClick(clickToken, { pointer: (e as PointerEvent).pointerId, at: performance.now(), target: targetKey(e.target), detail: e.detail, modified: e.altKey || e.ctrlKey || e.metaKey || e.shiftKey });
      clickToken = result.token;
      if (result.suppress) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, { signal, capture: true });
    el.addEventListener('pointerdown', e => {
      clickToken = null;
      heldPointer = null;
      const explicit = e.target === grip;
      // Blank container paint only. Descendant prose, links, selection and all touch bodies keep native input.
      if (!explicit && (e.target !== el || (!crumple && e.pointerType === 'touch') || [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()) || getSelection()?.toString())) return;
      if (e.button !== 0 || !e.isPrimary || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || modal()) return;
      if (gesture.pointer !== null) return;
      finish();
      restore();
      if (!gesture.start({ pointer: e.pointerId, x: e.clientX, y: e.clientY, intent: explicit ? 'grip' : 'body', touch: e.pointerType === 'touch' })) return;
      const sample = { x: e.clientX, y: e.clientY, time: performance.now() };
      origin = { pointer: e.pointerId, target: explicit ? grip : el, a: sample, b: sample, dragging: false };
      releaseCapture = cancel; captureSource = el;
      if (crumple) holdTimer = setTimeout(() => {
        if (!origin || gesture.tick() !== 'crumple') return;
        heldPointer = origin.pointer;
        clickToken = { pointer: origin.pointer, at: performance.now(), target: targetKey(origin.target) };
        release(); releaseCapture = () => {}; crumple();
      }, 600);
      if (explicit) { grip.focus({ preventScroll: true }); grip.setPointerCapture(e.pointerId); e.preventDefault(); }
    }, { signal });
    el.addEventListener('pointermove', e => {
      if (origin?.pointer !== e.pointerId) return;
      const state = gesture.move(e.pointerId, e.clientX, e.clientY);
      if (state === 'idle') { cancel(); return; }
      if (state !== 'fetch') return;
      clearTimeout(holdTimer);
      if (motion.matches) { cancel(); live.textContent = 'Paper is back. Kame is resting.'; return; }
      if (!origin.dragging) {
        origin.dragging = true;
        proxy = document.createElement('div'); proxy.className = 'paper-fetch-proxy'; proxy.dataset.fetchProxy = ''; proxy.dataset.phase = 'dragging';
        proxy.dataset.sourceId = el.dataset.paperId; proxy.setAttribute('aria-hidden', 'true'); proxy.textContent = el.dataset.paperLabel ?? 'Paper'; document.body.append(proxy);
        origin.target.setPointerCapture(e.pointerId);
      }
      origin.a = origin.b; origin.b = { x: e.clientX, y: e.clientY, time: performance.now() };
      const p = boundFetchPoint(origin.b, viewport()); proxy!.style.transform = `translate3d(${p.x - 36}px,${p.y - 26}px,0)`;
      e.preventDefault();
    }, { signal });
    el.addEventListener('pointerup', e => {
      if (heldPointer === e.pointerId) {
        clickToken = { pointer: e.pointerId, at: performance.now(), target: targetKey(e.target) };
        heldPointer = null; return;
      }
      if (origin?.pointer !== e.pointerId) return;
      const old = origin;
      gesture.end(e.pointerId); release(); releaseCapture = () => {};
      if (!old.dragging) return;
      proxy?.remove(); proxy = null;
      clickToken = { pointer: e.pointerId, at: performance.now(), target: targetKey(old.target) };
      const velocity = performance.now() - old.b.time < 150 ? releaseVelocity(old.a, old.b) : { x: 0, y: 0 };
      start(el, live, { x: e.clientX, y: e.clientY }, velocity);
    }, { signal });
    for (const type of ['pointercancel', 'lostpointercapture'] as const) el.addEventListener(type, e => { if (origin?.pointer === e.pointerId) { cancel(); finish(); } }, { signal });
    el.addEventListener('pointercancel', e => { if (heldPointer === e.pointerId) { heldPointer = null; restore(); finish(); } }, { signal });
    el.addEventListener('contextmenu', () => { if (origin) { cancel(); finish(); } }, { signal });
    el.addEventListener('focusin', e => { if (e.target instanceof Node && !root.contains(e.target) && source === el) finish(); }, { signal });
  };
  return { attach, cancel: (el?: HTMLElement) => { if (!el || source === el || captureSource === el) finish(); }, dispose: () => { finish(); unsubscribe(); } };
}
