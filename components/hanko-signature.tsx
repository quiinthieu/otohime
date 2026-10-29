"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import Image from "next/image";
import { getSeal, getServerSeal, subscribeSeal } from "@/lib/hanko-client";
import { readSeal, sealSvg, SITE_SEAL } from "@/lib/hanko";

export function HankoSignature() {
  const raw = useSyncExternalStore(subscribeSeal, getSeal, getServerSeal);
  const choice = readSeal(raw) ?? SITE_SEAL;
  return <Link href="/play/hanko" aria-label="Make your own Hanko seal" data-hanko-signature="" className="inline-flex size-14 flex-none items-center justify-center rounded-sm bg-[#f5eddf] p-1 align-middle">
    <Image src={`data:image/svg+xml,${encodeURIComponent(sealSvg(choice))}`} width={48} height={48} alt={`${choice.name} seal`} data-hanko-name={choice.name} unoptimized />
  </Link>;
}
