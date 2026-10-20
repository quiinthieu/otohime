import { BrandMark } from "@/components/brand-mark";
import { FigurePlayground } from "@/components/figure-playground";
import { Figure } from "@/components/figures";
import { ThemeToggle } from "@/components/theme-toggle";
import { ViewTransition } from "react";

// Everything below the masthead fades as one when another group's layout takes
// over (a group swap); see app/(site)/(app)/layout.tsx.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="masthead">
        <BrandMark />
        <div className="flex items-center gap-3">
          <span className="caption">a personal place</span>
          <ThemeToggle />
        </div>
      </header>
      <ViewTransition enter="page-in" exit="page-out" default="none">
        <main className="mx-auto grid max-w-6xl items-center gap-x-16 gap-y-8 px-5 py-10 sm:px-8 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,22rem)_1fr]">
          <div className="rise">{children}</div>
          <FigurePlayground>
            <Figure kind="lock" color="inherit" className="mx-auto block w-full max-w-[28rem]" />
          </FigurePlayground>
        </main>
      </ViewTransition>
    </>
  );
}
