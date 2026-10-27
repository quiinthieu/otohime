"use client";

import { useCallback, useEffect, useRef, type HTMLAttributes } from "react";
import { paperHydration } from "@/lib/paper-hydration";

/** Keep the server element and children intact; acknowledge only its React commit. */
export function PaperHost({ as = "div", children, ...props }: HTMLAttributes<HTMLElement> & { as?: "div" | "li" }) {
  const ref = useRef<HTMLElement>(null);
  const attach = useCallback((host: HTMLElement | null) => { ref.current = host; }, []);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.dataset.paperHydrated = "true";
    const unmark = paperHydration.mark(host);
    return () => { unmark(); delete host.dataset.paperHydrated; };
  }, []);
  const Host = as;
  return <Host {...props} ref={attach} data-paper-host="">{children}</Host>;
}
