// Can this browser draw WebGL at all? Probed once on a throwaway canvas
// (webgl2, then webgl) and cached, so the dialog can choose between the 3D
// atom and the Bohr SVG before it asks for the 3D chunk. No three import.

let cached: boolean | null = null;

export function hasWebGL(): boolean {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    cached = gl !== null;
    // Hand the probe's context back rather than waiting for GC to reclaim it.
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}
