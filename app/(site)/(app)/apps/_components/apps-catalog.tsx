"use client";

import Link from "next/link";
import { type CSSProperties, useState } from "react";
import { Notice, swatches } from "@/components/figures";
import {
  APP_STATUSES,
  availablePlatforms,
  filterApps,
  PLATFORM_META,
  STATUS_META,
  type AppManifest,
  type AppPlatform,
  type AppStatus,
} from "@/lib/apps";
import { AppIllustration } from "./app-illustration";
import { HankoStatus } from "./hanko-status";

export function AppsCatalog({ apps }: { apps: readonly AppManifest[] }) {
  const [selectedPlatform, setSelectedPlatform] = useState<AppPlatform | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<AppStatus | "all">("all");

  const platforms = availablePlatforms(apps);
  const filtered = filterApps(apps, {
    platform: selectedPlatform,
    status: selectedStatus,
  });
  const hasActiveFilter = selectedPlatform !== "all" || selectedStatus !== "all";

  function resetFilters() {
    setSelectedPlatform("all");
    setSelectedStatus("all");
  }

  return (
    <div className="apps-catalog">
      <section aria-label="Filter applications" className="apps-toolbar">
        <div className="apps-filter-row" role="group" aria-labelledby="apps-filter-platform">
          <span id="apps-filter-platform" className="caption apps-filter-label">
            Platform
          </span>
          <div className="apps-filter-pills">
            <button
              type="button"
              className="btn btn-sm apps-filter-btn"
              aria-pressed={selectedPlatform === "all"}
              onClick={() => setSelectedPlatform("all")}
            >
              All
            </button>
            {platforms.map((platform) => (
              <button
                key={platform}
                type="button"
                className="btn btn-sm apps-filter-btn"
                aria-pressed={selectedPlatform === platform}
                onClick={() =>
                  setSelectedPlatform((current) => (current === platform ? "all" : platform))
                }
              >
                {PLATFORM_META[platform].label}
              </button>
            ))}
          </div>
        </div>

        <div className="apps-filter-row" role="group" aria-labelledby="apps-filter-status">
          <span id="apps-filter-status" className="caption apps-filter-label">
            Status
          </span>
          <div className="apps-filter-pills">
            <button
              type="button"
              className="btn btn-sm apps-filter-btn"
              aria-pressed={selectedStatus === "all"}
              onClick={() => setSelectedStatus("all")}
            >
              All
            </button>
            {APP_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className="btn btn-sm apps-filter-btn"
                aria-pressed={selectedStatus === status}
                onClick={() =>
                  setSelectedStatus((current) => (current === status ? "all" : status))
                }
              >
                {STATUS_META[status].label}
              </button>
            ))}
          </div>
        </div>

        <div className="apps-toolbar-footer">
          <p className="caption apps-result-count" role="status" aria-live="polite">
            Showing {filtered.length} of {apps.length} {apps.length === 1 ? "app" : "apps"}
          </p>
          {hasActiveFilter ? (
            <button type="button" className="link apps-reset-link" onClick={resetFilters}>
              Reset filters
            </button>
          ) : null}
        </div>
      </section>

      {filtered.length === 0 ? (
        <div className="mt-8">
          <Notice n="—" title="No apps match those filters" figure="parcel" heading="h2">
            <p className="text-muted">
              Try another platform or lifecycle stage, or clear the active filter combination.
            </p>
            <button type="button" className="btn mt-2" onClick={resetFilters}>
              Reset filters
            </button>
          </Notice>
        </div>
      ) : (
        <ul className="apps-grid" aria-label="Applications">
          {filtered.map((app) => (
            <li key={app.slug} className="app-card-slot">
              <article
                className="app-card"
                style={{ "--fig": swatches[app.swatch] } as CSSProperties}
                data-app-slug={app.slug}
                data-app-status={app.status}
              >
                <div className="app-card-accent" aria-hidden="true" />
                <AppIllustration
                  slug={app.slug}
                  swatch={app.swatch}
                  illustration={app.illustration}
                  compact
                />
                <div className="app-card-body">
                  <div className="app-card-header">
                    <h2 className="app-card-title">
                      <Link href={`/apps/${app.slug}`} className="app-card-link">
                        {app.name}
                      </Link>
                    </h2>
                    <HankoStatus status={app.status} seal={app.seal} size="sm" />
                  </div>
                  <p className="app-card-tagline">{app.tagline}</p>
                  <div className="app-card-footer">
                    <ul className="app-badge-list" aria-label={`${app.name} platforms`}>
                      {app.platforms.map((platform) => (
                        <li key={platform}>
                          <span className="badge">{PLATFORM_META[platform].label}</span>
                        </li>
                      ))}
                    </ul>
                    <code className="app-card-cmd">$ {app.install.command}</code>
                  </div>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
