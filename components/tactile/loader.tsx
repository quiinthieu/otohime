"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { eligibleRoute } from "@/lib/tactile";

const PaperLayer = dynamic(() => import("./paper-layer"), { ssr: false });

/** No server UI or toy request: activate only after load + idle on opted-in routes. */
export function TactileLoader() {
  const route = usePathname();
  const [enabledRoute, setEnabledRoute] = useState<string | null>(null);
  const [offerRoute, setOfferRoute] = useState<string | null>(null);
  useEffect(() => {
    if (!eligibleRoute(route)) return;
    let cancel = () => {};
    const loaded = () => {
      const activate = () => {
        const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
        if (saveData) setOfferRoute(route);
        else setEnabledRoute(route);
      };
      if (typeof requestIdleCallback === "function") {
        const id = requestIdleCallback(activate, { timeout: 2000 });
        cancel = () => cancelIdleCallback(id);
      } else {
        const id = setTimeout(activate, 200);
        cancel = () => clearTimeout(id);
      }
    };
    if (document.readyState === "complete") loaded();
    else window.addEventListener("load", loaded, { once: true });
    return () => { window.removeEventListener("load", loaded); cancel(); };
  }, [route]);
  if (!eligibleRoute(route)) return null;
  if (enabledRoute === route) return <PaperLayer key={route} route={route} />;
  if (offerRoute === route) return <button type="button" className="paper-enable" onClick={() => setEnabledRoute(route)}>Enable paper corners</button>;
  return null;
}
