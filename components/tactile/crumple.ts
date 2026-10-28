import { MAX_BALLS } from '@/lib/crumple';
import type { createCrumpleRenderer } from './crumple-renderer';

/** Route-local slots include pending imports, preventing concurrent over-allocation. */
export function createPaperCrumple(signal: AbortSignal, motion: MediaQueryList) {
  const slots = new Set<() => void>();
  const attach = (el: HTMLElement, root: HTMLElement, actions: HTMLElement, seed: number, clearPaper: () => void) => {
    const button = (text: string, className: string) => {
      const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.className = className; actions.insertBefore(b, actions.querySelector('.paper-margin')); return b;
    };
    const crumple = button('Crumple', 'paper-crumple'), read = button('Read card', 'paper-read');
    const live = root.querySelector<HTMLElement>('[data-paper-message]')!;
    let renderer: ReturnType<typeof createCrumpleRenderer> | undefined, generation = 0;
    const restore = () => {
      generation++; renderer?.dispose(); renderer = undefined; slots.delete(restore);
      delete el.dataset.crumpleState; delete el.dataset.crumplePaint;
    };
    const start = async () => {
      if (signal.aborted || !el.isConnected || document.hidden || document.querySelector('[aria-modal="true"],dialog[open]')) return;
      if (slots.has(restore)) return;
      if (slots.size >= MAX_BALLS) { live.textContent = 'Eight paper balls is the limit. Read or Reset a card first.'; return; }
      clearPaper(); slots.add(restore);
      const token = ++generation;
      const failure = () => { restore(); live.textContent = 'Paper restored. Canvas folding is unavailable; Read card and Reset still work.'; };
      try {
        const { createCrumpleRenderer } = await import('./crumple-renderer');
        if (signal.aborted || generation !== token || !el.isConnected) return;
        renderer = createCrumpleRenderer(root, seed, motion.matches, failure);
        if (generation !== token) { renderer.dispose(); renderer = undefined; return; }
        el.dataset.crumplePaint = 'true';
        live.textContent = 'Paper crumpled. Read card or Reset restores it.';
      } catch { if (generation === token) failure(); }
    };
    crumple.addEventListener('click', () => { void start(); }, { signal });
    for (const type of ['focus', 'click'] as const) read.addEventListener(type, () => { restore(); clearPaper(); }, { signal });
    el.addEventListener('focusin', e => { if (e.target instanceof Node && !root.contains(e.target)) { restore(); clearPaper(); } }, { signal });
    return { start: () => { void start(); }, restore };
  };
  const cancel = () => { for (const restore of [...slots]) restore(); };
  return { attach, cancel };
}
