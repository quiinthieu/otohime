/** Fail closed: validated locked-package bytes and pinned model; no binaries in git. */
import { createHash } from "node:crypto";
import { readFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";
export const manifest = JSON.parse(
  await readFile(new URL("../content/hand-landmarker-assets.json", import.meta.url)),
);
export function verifyAsset(bytes, asset) {
  if (
    bytes.length !== asset.size ||
    createHash("sha256").update(bytes).digest("hex") !== asset.sha256
  )
    throw new Error(`hand_asset_integrity:${asset.file}`);
  return bytes;
}
export async function vendor({
  check = false,
  root = process.cwd(),
  fetcher = fetch,
} = {}) {
  const pkg = JSON.parse(
    await readFile(
      path.join(root, "node_modules/@mediapipe/tasks-vision/package.json"),
    ),
  );
  const lock = JSON.parse(await readFile(path.join(root, "package-lock.json")));
  if (
    pkg.version !== manifest.packageVersion ||
    lock.packages["node_modules/@mediapipe/tasks-vision"].version !==
      pkg.version
  )
    throw new Error("hand_package_version");
  const dest = path.join(root, "public/vendor/hand-landmarker", manifest.version);
  const outputs = [];
  for (const asset of manifest.assets) {
    let bytes;
    if (asset.packagePath)
      bytes = verifyAsset(
        await readFile(
          path.join(
            root,
            "node_modules/@mediapipe/tasks-vision",
            asset.packagePath,
          ),
        ),
        asset,
      );
    else {
      try {
        bytes = verifyAsset(await readFile(path.join(dest, asset.file)), asset);
      } catch (error) {
        if (check) throw error;
        const response = await fetcher(asset.url, {
          signal: AbortSignal.timeout(60_000),
        });
        if (!response.ok)
          throw new Error(`hand_asset_fetch:${response.status}`);
        bytes = verifyAsset(Buffer.from(await response.arrayBuffer()), asset);
      }
    }
    outputs.push([asset.file, bytes]);
  }
  const worker = (
    await readFile(
      path.join(root, "components/shadows/hand-worker.js"),
      "utf8",
    )
  ).replace("/* ASSET_MANIFEST */ null", JSON.stringify(manifest));
  outputs.push(["hand-worker.js", Buffer.from(worker)]);
  for (const file of ["Apache-2.0.txt", "NOTICE.txt"])
    outputs.push([
      file,
      await readFile(path.join(root, "content/licenses/hand-landmarker", file)),
    ]);
  if (check) {
    for (const [file, bytes] of outputs)
      if (!(await readFile(path.join(dest, file))).equals(bytes))
        throw new Error(`hand_cache_mismatch:${file}`);
    return;
  }
  // Validate the complete candidate before publishing; each write is atomic, interrupted writes are never served.
  await mkdir(dest, { recursive: true });
  for (const [file, bytes] of outputs) {
    const target = path.join(dest, file);
    await mkdir(path.dirname(target), { recursive: true });
    const temp = `${target}.${process.pid}.tmp`;
    try {
      await writeFile(temp, bytes);
      await rename(temp, target);
    } finally {
      await rm(temp, { force: true });
    }
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await vendor({ check: process.argv.includes("--check") });
  console.log(
    `Hand Landmarker ${manifest.version}: ${process.argv.includes("--check") ? "checked" : "vendored"}`,
  );
}
