/** Commit acknowledgements are per DOM identity, never inferred from load or elapsed time. */
export function createHydrationRegistry() {
  const committed = new WeakSet<object>();
  const waiting = new Set<() => void>();
  const changed = () => { for (const check of waiting) check(); };
  return {
    has: (host: object) => committed.has(host),
    changed,
    mark(host: object) {
      committed.add(host);
      changed();
      return () => { committed.delete(host); changed(); };
    },
    wait(hosts: () => readonly object[], ready: () => void) {
      const check = () => {
        const current = hosts();
        if (!current.length || !current.every(host => committed.has(host))) return;
        waiting.delete(check);
        ready();
      };
      waiting.add(check);
      check();
      return () => { waiting.delete(check); };
    },
  };
}

export const paperHydration = createHydrationRegistry();

/** Wait for the current route's actual hosts, including selectively hydrated subtrees.
 * No timers: a frozen Playwright clock cannot make React hydration happen sooner.
 * The callback may own a lifecycle; cancellation tears it down after activation too.
 */
export function afterPaperHydration(activate: () => void | (() => void)) {
  let teardown: void | (() => void);
  const observer = new MutationObserver(() => paperHydration.changed());
  observer.observe(document.body, { childList: true, subtree: true });
  const cancel = paperHydration.wait(
    // Next keeps previous routes in hidden Activity trees with effects disconnected.
    () => document.getElementById("kame-shell")
      ? [...document.querySelectorAll("[data-paper-host]")].filter(host => host.getClientRects().length > 0)
      : [],
    () => { observer.disconnect(); teardown = activate(); },
  );
  return () => { cancel(); observer.disconnect(); teardown?.(); };
}
