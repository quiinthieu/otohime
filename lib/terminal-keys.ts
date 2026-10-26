// The keys that open the Pocket Terminal, alone in their own module: components/pocket-terminal-loader.tsx is on
// every site page and imports only this, so the command parser (lib/terminal.ts, which re-exports it) stays in the
// terminal's lazy chunk.
export type KeyLike = { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean };

// The keys that open the terminal: Cmd/Ctrl-K from anywhere, and "/" when nothing is being typed into and no
// Cmd, Ctrl or Alt is held (Shift is allowed: some layouts need it to type "/").
export function opensTerminal(e: KeyLike, editing: boolean): boolean {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") return true;
  return e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey && !editing;
}
