import { BrandMark } from "@/components/brand-mark";
import { ThemeToggle } from "@/components/theme-toggle";
import { ViewTransition } from "react";

// Everything below the masthead fades as one when another group's layout takes
// over (a group swap); see app/(site)/(app)/layout.tsx.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="masthead">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4">
          <BrandMark />
          <div className="flex items-center gap-3">
            <span className="caption">Authentication</span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <ViewTransition enter="page-in" exit="page-out" default="none">
        <main className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md items-center px-5 py-10 sm:px-8">
          <div className="rise w-full">{children}</div>
        </main>
      </ViewTransition>
    </>
  );
}
