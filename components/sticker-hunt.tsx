"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { FINDS, stickerById } from "@/content/stickers";
import { claimFind, explore, KONAMI, localDay, matchKonami } from "@/lib/gashapon";
import { updateCollection, useCollection } from "@/lib/sticker-store";
import { InkSticker } from "./ink-sticker";

export function StickerSpot({ id }: { id: string }) {
  const { collection, ready } = useCollection();
  const found = collection.finds.includes(id);
  const sticker = stickerById(id)!;
  return <div className="my-8 flex flex-wrap items-center gap-3" data-testid={`find-${id}`}>
    <button type="button" className="size-16 -rotate-6 hover:rotate-0" disabled={!ready || found}
      aria-label={found ? `${sticker.name} collected` : `Collect hidden ${sticker.name} sticker`}
      onClick={() => updateCollection(s => claimFind(s, id))}>
      <InkSticker sticker={sticker} />
    </button>
    <p aria-live="polite" className="text-sm text-muted">{found ? `${sticker.name} tucked into your sticker book. +1 paper coin.` : "A little ink scrap in the margin…"}</p>
  </div>;
}

export function StickerHunt() {
  const pathname = usePathname();
  const sequence = useRef<string[]>([]);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const visit = () => { if (!document.hidden) updateCollection(s => explore(s, pathname, localDay())); };
    visit();
    document.addEventListener("visibilitychange", visit);
    return () => document.removeEventListener("visibilitychange", visit);
  }, [pathname]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const target = e.target;
      const editing = target instanceof Element && !!target.closest("input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox]");
      sequence.current = matchKonami(sequence.current, e.key, editing || e.ctrlKey || e.metaKey || e.altKey);
      if (sequence.current.length === KONAMI.length) {
        updateCollection(s => {
          if (!s.finds.includes(FINDS.konami)) setMessage("Secret Kame found! A sticker and a paper coin for your curiosity.");
          return claimFind(s, FINDS.konami);
        });
        sequence.current = [];
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, []);
  const id = pathname === "/notes" ? FINDS.notes : pathname === "/sketches" ? FINDS.sketches : null;
  return <>
    {id && <aside className="mx-auto max-w-3xl px-6" aria-label="A scrap in the margin"><StickerSpot id={id} /></aside>}
    <div aria-live="polite" data-testid="sticker-hunt-announcement" className={message ? "fixed bottom-4 left-4 z-50 max-w-xs border bg-[#f6eed8] p-4 text-[#443c32] shadow-lg" : "sr-only"}>{message}</div>
  </>;
}
