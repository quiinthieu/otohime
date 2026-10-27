"use client";

import { afterPaperHydration } from "@/lib/paper-hydration";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useEffect, useState, type ComponentType } from "react";
import "@/app/(site)/kame.css";

export function KameLoader() {
  const path = usePathname();
  // These public tool/identity routes keep their existing gestures and forms.
  const eligible = ["/", "/work", "/play", "/notes", "/music", "/projects", "/sketches"].includes(path);
  const [Companion, setCompanion] = useState<ComponentType | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [deferred, setDeferred] = useState(false);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!eligible) return;
    let gone = false;
    let cancel = () => {};
    return afterPaperHydration(() => {
      const load = () => {
        setSlot(document.getElementById("kame-shell"));
        if (!enabled && (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) {
          setDeferred(true); return;
        }
        const go = () => { void import("./companion").then((m) => { if (!gone) setCompanion(() => m.default); }).catch(() => { if (!gone) setDeferred(true); }); };
        if (typeof requestIdleCallback === "function") {
          const id = requestIdleCallback(go, { timeout: 2000 }); cancel = () => cancelIdleCallback(id);
        } else { const id = setTimeout(go, 200); cancel = () => clearTimeout(id); }
      };
      if (document.readyState === "complete") load();
      else addEventListener("load", load, { once: true });
      return () => { gone = true; cancel(); removeEventListener("load", load); };
    });
  }, [eligible, enabled, path]);

  if (!eligible) return null;
  if (Companion) return <Companion key={path} />;
  return deferred && slot ? createPortal(<button className="kame-button" type="button" onClick={() => setEnabled(true)}>Enable Kame companion</button>, slot) : null;
}
