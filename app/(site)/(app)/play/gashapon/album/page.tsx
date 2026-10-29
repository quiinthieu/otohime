import type { Metadata } from "next";
import Link from "next/link";
import { StickerAlbum } from "@/components/sticker-album";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Sticker Book" };
export default function AlbumPage() {
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div><p className="caption"><Link href="/play/gashapon">← Ink Gashapon</Link> / keepsakes</p><h1 className="mt-4 text-4xl font-serif">Sticker Book</h1><StickerAlbum /></div></ViewTransition>;
}
