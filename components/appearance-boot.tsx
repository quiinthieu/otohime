import { appearanceBootScript, appearanceStyle, type AppearanceRootId } from "@/lib/appearance-client";
import "./appearance.css";

// The print run before first paint, in a root layout's <head>: the root's token aliases (generated from the trusted
// presets, so no stored text reaches CSS) and the script that marks <html> from validated storage. The same two lines
// in every root layout; components/appearance-runtime.tsx keeps them current after hydration.
export function AppearanceBoot({ root }: { root: AppearanceRootId }) {
  return (
    <>
      <style data-appearance={root} dangerouslySetInnerHTML={{ __html: appearanceStyle(root) }} />
      <script dangerouslySetInnerHTML={{ __html: appearanceBootScript }} />
    </>
  );
}
