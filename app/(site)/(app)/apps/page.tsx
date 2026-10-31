import type { Metadata } from "next";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { HankoSignature } from "@/components/hanko-signature";
import { loadApps } from "@/lib/apps-server";
import { AppsCatalog } from "./_components/apps-catalog";
import "./apps.css";

export const metadata: Metadata = {
  title: "Apps",
  description:
    "Applications in the workshop — macOS, CLI, and TUI tools built on warm paper, calm motion, and lean token budgets.",
  alternates: { canonical: "/apps" },
};

export default function AppsPage() {
  const apps = loadApps();

  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="rise">
        <FigTitle n="08" hint="in the workshop">
          Apps
        </FigTitle>
        <p className="mt-2 max-w-prose text-muted">
          Desktop utilities and quiet terminal companions in progress — audited context budgets,
          local-first ledgers, idle gardens, and seasonal palettes.
        </p>
        <AppsCatalog apps={apps} />
        <div className="mt-8">
          <HankoSignature />
        </div>
      </div>
    </ViewTransition>
  );
}
