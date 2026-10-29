import type { Metadata } from "next";
import Link from "next/link";
import { GashaponMachine } from "@/components/gashapon-machine";
import { ViewTransition } from "react";

export const metadata: Metadata = { title: "Ink Gashapon", description: "Free paper coins, a hand-cranked capsule machine, and tiny ink companions to collect." };
export default function GashaponPage() {
  return <ViewTransition enter="page-in" exit="page-out" default="none"><div><p className="caption"><Link href="/play">← Play</Link> / small surprises</p><h1 className="mt-4 text-4xl font-serif">Ink Gashapon</h1><p className="mt-3 text-muted">A pocketful of curiosity. A little machine that gives it back.</p><GashaponMachine /></div></ViewTransition>;
}
