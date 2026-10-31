import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ViewTransition } from "react";
import { FigTitle } from "@/components/figures";
import { HankoSignature } from "@/components/hanko-signature";
import {
  APP_STATUSES,
  PLATFORM_META,
  resolveFollowAction,
  STATUS_META,
  type AppMilestoneState,
} from "@/lib/apps";
import { appBySlug, loadApps } from "@/lib/apps-server";
import { away } from "@/lib/end";
import { AppIllustration } from "../_components/app-illustration";
import { CopySnippet } from "../_components/copy-snippet";
import { HankoStatus } from "../_components/hanko-status";
import "../apps.css";

const MILESTONE_BADGE: Record<AppMilestoneState, { glyph: string; label: string }> = {
  done: { glyph: "✓", label: "Done" },
  active: { glyph: "●", label: "Active" },
  next: { glyph: "○", label: "Next" },
};

// Block unlisted slugs before streaming the generic PPR shell so notFound()
// returns a real HTTP 404 status code while still rendering newly dropped
// manifests on demand.
export const unstable_paramMatching = { slug: "blocking" } as const;

export function generateStaticParams() {
  return loadApps().map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/apps/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const app = appBySlug(slug);
  if (!app) return {};

  return {
    title: app.name,
    description: app.tagline,
    alternates: { canonical: `/apps/${app.slug}` },
  };
}

export default async function AppDetailPage({ params }: PageProps<"/apps/[slug]">) {
  const { slug } = await params;
  const app = appBySlug(slug);
  if (!app) notFound();

  const follow = resolveFollowAction(app);
  const currentStep = STATUS_META[app.status].step;

  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <article className="rise app-detail">
        <div>
          <Link href="/apps" className="caption underline underline-offset-4">
            ← All apps
          </Link>

          <header className="app-detail-hero">
            <div className="app-detail-heading-row">
              <FigTitle n="08">{app.name}</FigTitle>
              <HankoStatus status={app.status} seal={app.seal} />
            </div>

            <p className="app-detail-tagline">{app.tagline}</p>

            <div className="app-detail-meta">
              <ul className="app-badge-list" aria-label="Supported platforms">
                {app.platforms.map((platform) => (
                  <li key={platform}>
                    <span className="badge">{PLATFORM_META[platform].label}</span>
                  </li>
                ))}
              </ul>

              <ul className="app-stack-list" aria-label="Tech stack">
                {app.techStack.map((tech) => (
                  <li key={tech}>
                    <span className="app-stack-chip">{tech}</span>
                  </li>
                ))}
              </ul>
            </div>
          </header>
        </div>

        <section aria-label="Preview and installation" className="app-detail-showcase">
          <AppIllustration slug={app.slug} swatch={app.swatch} illustration={app.illustration} />

          <div className="app-detail-aside">
            <CopySnippet
              label={app.install.label}
              command={app.install.command}
              note={app.install.note}
            />

            <div className="app-links-card">
              <span className="caption">Links &amp; updates</span>

              {app.links.repo || app.links.homebrew || app.links.docs ? (
                <ul className="app-links-list">
                  {app.links.repo ? (
                    <li className="app-links-row">
                      <span className="text-muted">Repository</span>
                      <a href={app.links.repo} {...away(app.links.repo)} className="link">
                        {app.links.repo.replace(/^https:\/\/(www\.)?/, "")} ↗
                      </a>
                    </li>
                  ) : null}

                  {app.links.docs ? (
                    <li className="app-links-row">
                      <span className="text-muted">Documentation</span>
                      <a href={app.links.docs} {...away(app.links.docs)} className="link">
                        Read docs ↗
                      </a>
                    </li>
                  ) : null}

                  {app.links.homebrew ? (
                    <li className="app-homebrew-box">
                      <div className="app-links-row">
                        <span className="text-muted">Homebrew</span>
                        <span>
                          {app.links.homebrew.cask
                            ? `Cask: ${app.links.homebrew.cask}`
                            : app.links.homebrew.formula
                              ? `Formula: ${app.links.homebrew.formula}`
                              : "Package"}
                        </span>
                      </div>
                      <code className="app-homebrew-cmd">$ {app.links.homebrew.command}</code>
                      {app.links.homebrew.url ? (
                        <div>
                          <a
                            href={app.links.homebrew.url}
                            {...away(app.links.homebrew.url)}
                            className="link"
                          >
                            Formula repository ↗
                          </a>
                        </div>
                      ) : null}
                    </li>
                  ) : null}
                </ul>
              ) : null}

              <div className="app-follow-actions">
                <a
                  href={follow.primary.href}
                  {...away(follow.primary.href)}
                  className="btn btn-primary btn-sm"
                >
                  {follow.primary.label}
                </a>
                {follow.secondary ? (
                  <a
                    href={follow.secondary.href}
                    {...away(follow.secondary.href)}
                    className="link"
                  >
                    {follow.secondary.label}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="app-what-it-does" className="app-section">
          <h2 id="app-what-it-does" className="app-section-title">
            What it does
          </h2>
          <div className="app-prose">
            {app.description.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </section>

        <section aria-labelledby="app-key-features" className="app-section">
          <h2 id="app-key-features" className="app-section-title">
            Key features
          </h2>
          <ul className="app-features-grid">
            {app.features.map((feature) => (
              <li key={feature.title} className="app-feature-card">
                <h3 className="app-feature-title">{feature.title}</h3>
                <p className="app-feature-detail">{feature.detail}</p>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="app-roadmap" className="app-section">
          <h2 id="app-roadmap" className="app-section-title">
            Lifecycle &amp; roadmap
          </h2>

          <ol className="app-lifecycle" aria-label="Application lifecycle stage">
            {APP_STATUSES.map((stage) => {
              const stageMeta = STATUS_META[stage];
              const stepState =
                stageMeta.step < currentStep
                  ? "complete"
                  : stageMeta.step === currentStep
                    ? "current"
                    : "upcoming";
              const marker =
                stepState === "complete" ? "✓" : stepState === "current" ? "●" : "○";

              return (
                <li
                  key={stage}
                  className="app-lifecycle-step"
                  data-step-state={stepState}
                  aria-current={stepState === "current" ? "step" : undefined}
                >
                  <span className="app-lifecycle-marker" aria-hidden="true">
                    {marker}
                  </span>
                  <span>{stageMeta.label}</span>
                </li>
              );
            })}
          </ol>

          <ol className="app-milestones" aria-label="Roadmap milestones">
            {app.milestones.map((milestone) => {
              const badge = MILESTONE_BADGE[milestone.state];
              return (
                <li
                  key={milestone.title}
                  className="app-milestone"
                  data-milestone-state={milestone.state}
                >
                  <div className="app-milestone-head">
                    <span
                      className="app-milestone-state"
                      data-milestone-state={milestone.state}
                    >
                      <span aria-hidden="true">{badge.glyph}</span>
                      <span>{badge.label}</span>
                    </span>
                    <h3 className="app-milestone-title">{milestone.title}</h3>
                    {milestone.target ? (
                      <span className="caption app-milestone-target">{milestone.target}</span>
                    ) : null}
                  </div>
                  {milestone.note ? <p className="app-milestone-note">{milestone.note}</p> : null}
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="app-changelog" className="app-section">
          <h2 id="app-changelog" className="app-section-title">
            Changelog
          </h2>
          <ol className="app-changelog">
            {app.changelog.map((entry) => (
              <li key={`${entry.version}-${entry.date}`} className="app-changelog-item">
                <div className="app-changelog-head">
                  <span className="app-changelog-version">{entry.version}</span>
                  <time dateTime={entry.date} className="caption">
                    {entry.date}
                  </time>
                </div>
                <p className="app-changelog-summary">{entry.summary}</p>
                {entry.highlights ? (
                  <ul className="app-changelog-highlights">
                    {entry.highlights.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </section>

        <div>
          <HankoSignature />
        </div>
      </article>
    </ViewTransition>
  );
}
