/** Only the verifier acquires these public-domain bytes; never put them in public/. */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
export async function faceFixture() {
  const spec = JSON.parse(
    await readFile("content/peep-box-test-assets.json", "utf8"),
  );
  const file = `.cache/peep-box/${spec.file}`;
  const verify = (bytes: Buffer) => {
    if (
      bytes.length !== spec.size ||
      createHash("sha256").update(bytes).digest("hex") !== spec.sha256
    )
      throw new Error("fixture_integrity");
    return bytes;
  };
  let bytes: Buffer;
  try {
    bytes = verify(await readFile(file));
  } catch {
    const response = await fetch(spec.url, {
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`fixture_fetch:${response.status}`);
    bytes = verify(Buffer.from(await response.arrayBuffer()));
    await mkdir(".cache/peep-box", { recursive: true });
    const temp = `${file}.${process.pid}.tmp`;
    await writeFile(temp, bytes);
    await rename(temp, file);
  }
  return { spec, dataURL: `data:image/png;base64,${bytes.toString("base64")}` };
}
