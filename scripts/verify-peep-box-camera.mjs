/** Real locked imports/assets + isolated production browser; lifecycle fakes are labelled in TAP. */
import { spawn } from "node:child_process";
import { vendor } from "./vendor-peep-box.mjs";
await vendor();
await vendor({ check: true });
const { FaceLandmarker, FilesetResolver } = await import(
  "@mediapipe/tasks-vision"
);
if (
  typeof FaceLandmarker.createFromOptions !== "function" ||
  typeof FilesetResolver.forVisionTasks !== "function"
)
  throw new Error("sdk_import");
const env = { ...process.env, TMPDIR: "/tmp" };
delete env.BASE_URL;
// CI passes SKIP_BUILD=1 only after its production build succeeds.
const child = spawn(
  process.execPath,
  [
    "--experimental-strip-types",
    "--disable-warning=ExperimentalWarning",
    "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
    "scripts/e2e.mjs",
    "--test",
    "e2e/peep-box-camera.test.ts",
  ],
  { env, stdio: "inherit" },
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
process.exitCode = await new Promise((resolve) => {
  child.on("error", () => resolve(1));
  child.on("exit", (code) => resolve(code ?? 1));
});
