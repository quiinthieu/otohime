// Capsule's copy of Sun's shim (never imported from app/(sun)/): rough.js ships
// types for its package root only, and the CJS bundle that ink.ts imports (so
// plain Node can load it) is the same object, so it gets the same types.
declare module "roughjs/bundled/rough.cjs.js" {
  import rough from "roughjs";
  export default rough;
}
