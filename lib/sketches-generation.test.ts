import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { inspect } from "node:util";
import { handlePortraitDownload, PORTRAIT_CONCEPTS, validatePortraitManifest } from "./sketches.ts";
import {
  createEmptyLedger,
  processCandidateImage,
  redactSecrets,
  resolveXaiCredential,
  runGenerationWorkflow,
  runImportWorkflow,
  runPublishWorkflow,
  synthesizeFixturePortraitPng,
  withScrubbedHermeticEnv,
  XaiImagePublisher,
} from "./sketches-generation.ts";

async function withLoopbackServer(
  handler: (req: IncomingMessage, res: ServerResponse, body: Buffer) => void | Promise<void>,
  fn: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      void Promise.resolve(handler(req, res, Buffer.concat(chunks))).catch((err) => {
        res.statusCode = 500;
        res.end(String(err));
      });
    });
  });
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  }
}

test("withScrubbedHermeticEnv removes lowercase and uppercase proxy and provider env vars", async () => {
  process.env.http_proxy = "http://proxy.invalid:8080";
  process.env.HTTPS_PROXY = "http://proxy.invalid:8443";
  process.env.XAI_API_KEY = "xai-secret-should-not-leak";
  try {
    await withScrubbedHermeticEnv(async () => {
      assert.equal(process.env.http_proxy, undefined);
      assert.equal(process.env.HTTPS_PROXY, undefined);
      assert.equal(process.env.XAI_API_KEY, undefined);
    });
  } finally {
    delete process.env.http_proxy;
    delete process.env.HTTPS_PROXY;
    delete process.env.XAI_API_KEY;
  }
});

test("resolveXaiCredential reads env or mounted .grok settings in memory and never prints secrets", () => {
  const work = mkdtempSync(join(tmpdir(), "sketches-cred-"));
  try {
    const settingsPath = join(work, "user-settings.json");
    writeFileSync(settingsPath, JSON.stringify({ apiKey: "xai-test-mounted-key-987654321" }), "utf8");

    const fromEnv = resolveXaiCredential({ XAI_API_KEY: "xai-test-env-key-123456789" }, { settingsPaths: [settingsPath] });
    assert.equal(fromEnv.available, true);
    assert.equal(fromEnv.source, "env:XAI_API_KEY");
    assert.equal(fromEnv.getAuthorizationHeader(), "Bearer xai-test-env-key-123456789");
    assert.doesNotMatch(JSON.stringify(fromEnv), /xai-test-env-key/);
    assert.doesNotMatch(String(fromEnv), /xai-test-env-key/);
    assert.doesNotMatch(inspect(fromEnv), /xai-test-env-key/);

    const fromFile = resolveXaiCredential({}, { settingsPaths: [settingsPath] });
    assert.equal(fromFile.available, true);
    assert.equal(fromFile.source, "file:.grok/user-settings.json");
    assert.equal(fromFile.getAuthorizationHeader(), "Bearer xai-test-mounted-key-987654321");
    assert.doesNotMatch(JSON.stringify(fromFile), /xai-test-mounted-key/);

    const redacted = redactSecrets(
      "Authorization: Bearer xai-test-env-key-123456789 failed with key xai-test-mounted-key-987654321",
      ["xai-test-env-key-123456789", "xai-test-mounted-key-987654321"],
    );
    assert.doesNotMatch(redacted, /xai-test/);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test("processCandidateImage encodes lossless 3:4 PNG master and 1152x1536 <600KB JPEG derivative and rejects wrong aspect ratio", async () => {
  const rawPng = await synthesizeFixturePortraitPng({
    conceptIndex: 0,
    width: 1536,
    height: 2048,
    variant: 1,
  });
  const processed = await processCandidateImage(rawPng);
  assert.equal(processed.nativeWidth, 1536);
  assert.equal(processed.nativeHeight, 2048);
  assert.equal(processed.masterWidth, 1536);
  assert.equal(processed.masterHeight, 2048);
  assert.equal(processed.derivativeWidth, 1152);
  assert.equal(processed.derivativeHeight, 1536);
  assert.ok(processed.derivativeBytes.byteLength > 0 && processed.derivativeBytes.byteLength < 600_000);
  assert.notEqual(processed.masterSha256, processed.derivativeSha256);

  // Wrong aspect ratio (1:1 square) is rejected
  const squarePng = await synthesizeFixturePortraitPng({
    conceptIndex: 0,
    width: 1024,
    height: 1024,
    variant: 1,
  });
  await assert.rejects(
    () => processCandidateImage(squarePng),
    /aspect ratio|3:4/i,
  );
});

test("loopback fake proves request serialization, 401/429/5xx, malformed payloads, duplicate bytes, resume, attempt bounds and non-expiring publication", async () => {
  await withScrubbedHermeticEnv(async () => {
    const work = mkdtempSync(join(tmpdir(), "sketches-loopback-"));
    try {
      const candidateBuffers = await Promise.all(
        PORTRAIT_CONCEPTS.map((_, i) =>
          synthesizeFixturePortraitPng({
            conceptIndex: i,
            width: 768,
            height: 1024,
            variant: 1,
          }),
        ),
      );

      const seenGenBodies: Array<Record<string, unknown>> = [];
      const seenAuthHeaders: string[] = [];
      const uploadedFiles = new Map<string, { filename: string; bytes: Buffer; expiresAt: number | null }>();
      let mode:
        | "ok"
        | "401"
        | "429"
        | "500"
        | "malformed"
        | "wrong-dimensions"
        | "duplicate-bytes"
        | "expiring-file"
        | "expiring-url"
        | "ephemeral-public-url" = "ok";
      let genCallCount = 0;
      let fileSeq = 0;

      const squareBuffer = await synthesizeFixturePortraitPng({
        conceptIndex: 0,
        width: 800,
        height: 800,
        variant: 99,
      });

      await withLoopbackServer(
        async (req, res, body) => {
          const url = new URL(req.url ?? "/", "http://127.0.0.1");
          if (req.headers.authorization) {
            seenAuthHeaders.push(req.headers.authorization);
          }

          if (req.method === "POST" && (url.pathname === "/v1/images/generations" || url.pathname === "/v1/images/edits")) {
            genCallCount++;
            const parsed = JSON.parse(body.toString("utf8")) as Record<string, unknown>;
            seenGenBodies.push({ endpoint: url.pathname, ...parsed });

            if (mode === "401") {
              res.writeHead(401, { "Content-Type": "application/json", "x-request-id": "req-401" });
              res.end(JSON.stringify({ error: { message: "Invalid Bearer xai-secret-loopback-token" } }));
              return;
            }
            if (mode === "429") {
              res.writeHead(429, { "Content-Type": "application/json", "x-request-id": "req-429" });
              res.end(JSON.stringify({ error: { message: "Rate limit exceeded" } }));
              return;
            }
            if (mode === "500") {
              res.writeHead(503, { "Content-Type": "application/json", "x-request-id": "req-503" });
              res.end(JSON.stringify({ error: { message: "Upstream service unavailable" } }));
              return;
            }
            if (mode === "malformed") {
              res.writeHead(200, { "Content-Type": "application/json", "x-request-id": "req-malformed" });
              res.end(JSON.stringify({ data: [{}] }));
              return;
            }

            // Pick concept buffer based on prompt match
            const promptText = String(parsed.prompt ?? "");
            const matchedIdx = PORTRAIT_CONCEPTS.findIndex((c) => promptText.includes(c.composition));
            const idx = matchedIdx >= 0 ? matchedIdx : 0;
            const imgBuf =
              mode === "wrong-dimensions"
                ? squareBuffer
                : mode === "duplicate-bytes"
                  ? candidateBuffers[0]
                  : candidateBuffers[idx];

            res.writeHead(200, { "Content-Type": "application/json", "x-request-id": `req-gen-${genCallCount}` });
            res.end(
              JSON.stringify({
                model: "grok-imagine-image-2.0",
                data: [
                  {
                    url: `http://${req.headers.host}/ephemeral/${idx}-${genCallCount}.png`,
                    b64_json: Buffer.from(imgBuf).toString("base64"),
                  },
                ],
              }),
            );
            return;
          }

          if (req.method === "POST" && url.pathname === "/v1/files") {
            fileSeq++;
            const fileId = `file_real_${String(fileSeq).padStart(4, "0")}`;
            // Extract filename and raw binary from multipart form-data or JSON test body
            const contentType = req.headers["content-type"] ?? "";
            assert.match(contentType, /multipart\/form-data/);
            assert.ok(!body.includes(Buffer.from('name="expires_after"')), "upload must not set expires_after");
            const fnMatch = body.toString("latin1").match(/filename="([^"]+)"/);
            const filename = fnMatch ? fnMatch[1] : `upload-${fileSeq}.bin`;
            // Locate PNG or JPEG signature in multipart buffer
            const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            const jpgSig = Buffer.from([0xff, 0xd8, 0xff]);
            const sigIdx = filename.endsWith(".png") ? body.indexOf(pngSig) : body.indexOf(jpgSig);
            const endBoundaryIdx = body.lastIndexOf(Buffer.from("\r\n--"));
            const fileBytes =
              sigIdx >= 0 && endBoundaryIdx > sigIdx ? body.subarray(sigIdx, endBoundaryIdx) : Buffer.alloc(0);

            const expiresAt = mode === "expiring-file" ? 1765000000 : null;
            uploadedFiles.set(fileId, { filename, bytes: Buffer.from(fileBytes), expiresAt });

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                id: fileId,
                filename,
                bytes: fileBytes.byteLength,
                ...(expiresAt ? { expires_at: expiresAt } : {}),
              }),
            );
            return;
          }

          const pubMatch = url.pathname.match(/^\/v1\/files\/([^/]+)\/public-url$/);
          if (req.method === "POST" && pubMatch) {
            const fileId = decodeURIComponent(pubMatch[1]);
            const parsed = JSON.parse(body.toString("utf8") || "{}") as Record<string, unknown>;
            assert.equal(parsed.expires_after, undefined, "public-url request must not set expires_after");
            const stored = uploadedFiles.get(fileId);
            const ext = stored?.filename.endsWith(".png") ? ".png" : ".jpg";
            if (mode === "expiring-url") {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  public_url: `https://files-cdn.x.ai/tok_${fileId}/${fileId}${ext}`,
                  expires_at: 1765000000,
                }),
              );
              return;
            }
            if (mode === "ephemeral-public-url") {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  public_url: `https://imgen.x.ai/xai-imgen/xai-tmp-${fileId}${ext}`,
                }),
              );
              return;
            }
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(
              JSON.stringify({
                public_url: `https://files-cdn.x.ai/tok_${fileId}/${fileId}${ext}`,
              }),
            );
            return;
          }

          const cdnMatch = url.pathname.match(/^\/cdn\/tok_([^/]+)\/([^/]+)\.(png|jpg)$/);
          if (req.method === "GET" && cdnMatch) {
            assert.equal(req.headers.authorization, undefined, "anonymous CDN check must not send Authorization");
            const fileId = cdnMatch[2];
            const stored = uploadedFiles.get(fileId);
            if (!stored) {
              res.writeHead(404);
              res.end("not found");
              return;
            }
            res.writeHead(200, {
              "Content-Type": stored.filename.endsWith(".png") ? "image/png" : "image/jpeg",
            });
            res.end(stored.bytes);
            return;
          }

          res.writeHead(404);
          res.end("not found");
        },
        async (baseUrl) => {
          const credential = resolveXaiCredential({ XAI_API_KEY: "xai-secret-loopback-token" });
          const publisher = new XaiImagePublisher({
            baseUrl: `${baseUrl}/v1`,
            credential,
            cdnRewriteOrigin: `${baseUrl}/cdn`,
          });

          const ledgerPath = join(work, "ledger.json");
          const outDir = join(work, "candidates");

          // 1. Prove 401, 429, 503 and malformed payload handling + immediate redacted ledger writes
          for (const errMode of ["401", "429", "500", "malformed", "wrong-dimensions"] as const) {
            mode = errMode;
            await assert.rejects(() =>
              runGenerationWorkflow({
                publisher,
                ledgerPath,
                outDir,
                conceptIds: ["01-quiet-reader"],
              }),
            );
          }

          // After 4 generate attempts for 01-quiet-reader, a 5th attempt is blocked by the 4-attempt budget!
          mode = "ok";
          await assert.rejects(
            () =>
              runGenerationWorkflow({
                publisher,
                ledgerPath,
                outDir,
                conceptIds: ["01-quiet-reader"],
              }),
            /budget|4 attempts/i,
          );

          const failedLedgerText = readFileSync(ledgerPath, "utf8");
          assert.doesNotMatch(failedLedgerText, /xai-secret-loopback-token/);
          const failedLedger = JSON.parse(failedLedgerText);
          assert.ok(failedLedger.failedRequests.length >= 4);

          // 2. Reset ledger and prove duplicate-bytes rejection across concepts
          writeFileSync(ledgerPath, JSON.stringify(createEmptyLedger(), null, 2), "utf8");
          mode = "duplicate-bytes";
          await assert.rejects(
            () =>
              runGenerationWorkflow({
                publisher,
                ledgerPath,
                outDir,
                conceptIds: ["01-quiet-reader", "02-flower-girl"],
              }),
            /duplicate/i,
          );

          // 3. Reset ledger and run full 10-concept generation + reference edit serialization check
          writeFileSync(ledgerPath, JSON.stringify(createEmptyLedger(), null, 2), "utf8");
          seenGenBodies.length = 0;
          genCallCount = 0;
          mode = "ok";

          const genResult = await runGenerationWorkflow({
            publisher,
            ledgerPath,
            outDir,
            referenceImageUrl: "https://i.pinimg.com/originals/41/9a/49/419a49689748e94025c4a9f00d06347b.jpg",
            acceptAllForTest: true,
          });
          assert.equal(genResult.ledger.decodedCandidates.length, 10);
          assert.equal(genCallCount, 10);
          for (const reqBody of seenGenBodies) {
            assert.equal(reqBody.endpoint, "/v1/images/edits");
            assert.equal(reqBody.model, "grok-imagine-image-2.0");
            assert.equal(reqBody.aspect_ratio, "3:4");
            assert.equal(reqBody.resolution, "2k");
            assert.equal("seed" in reqBody, false, "must never fabricate unsupported seed");
          }
          for (const cand of genResult.ledger.decodedCandidates) {
            assert.equal(cand.seed, "not supported");
            assert.equal(cand.nativeWidth, 768);
            assert.equal(cand.nativeHeight, 1024);
            assert.ok(existsSync(cand.masterPath));
            assert.ok(existsSync(cand.derivativePath));
          }

          // 4. Resume generation: re-running does not make any new API calls!
          const countBeforeResume = genCallCount;
          await runGenerationWorkflow({
            publisher,
            ledgerPath,
            outDir,
            acceptAllForTest: true,
          });
          assert.equal(genCallCount, countBeforeResume, "resume must not repurchase existing candidates");

          // 5. Prove expiry and ephemeral-URL rejection during publication
          for (const badPubMode of ["expiring-file", "expiring-url", "ephemeral-public-url"] as const) {
            mode = badPubMode;
            await assert.rejects(
              () =>
                runPublishWorkflow({
                  publisher,
                  ledgerPath,
                }),
              /expir|files-cdn\.x\.ai/i,
            );
          }

          // 6. Publish all 10 concepts to permanent Files + public URLs and verify anonymous download
          mode = "ok";
          const manifestPath = join(work, "portraits.json");
          const pubResult = await runPublishWorkflow({
            publisher,
            ledgerPath,
            manifestPath,
          });
          assert.equal(pubResult.records.length, 10);
          const manifestValidation = validatePortraitManifest(pubResult.records, { requirePeople: true });
          assert.equal(manifestValidation.errors.length, 0, manifestValidation.errors.join("\n"));

          // 7. Resume publication: re-running reuses existing published receipts without re-uploading
          const uploadsBeforeResume = fileSeq;
          await runPublishWorkflow({
            publisher,
            ledgerPath,
            manifestPath,
          });
          assert.equal(fileSeq, uploadsBeforeResume, "publish resume must not re-upload already published files");

          // 8. Prove import workflow from directory of native 3:4 PNGs
          const importLedgerPath = join(work, "import-ledger.json");
          const importInputDir = join(work, "import-input");
          const importOutDir = join(work, "import-out");
          rmSync(importInputDir, { recursive: true, force: true });
          writeFileSync(importLedgerPath, JSON.stringify(createEmptyLedger(), null, 2), "utf8");
          const { mkdirSync } = await import("node:fs");
          mkdirSync(importInputDir, { recursive: true });
          for (let i = 0; i < PORTRAIT_CONCEPTS.length; i++) {
            writeFileSync(join(importInputDir, PORTRAIT_CONCEPTS[i].masterFilename), candidateBuffers[i]);
          }
          const imported = await runImportWorkflow({
            inputDir: importInputDir,
            outDir: importOutDir,
            ledgerPath: importLedgerPath,
            reviewer: "qa-importer",
            accept: true,
          });
          assert.equal(imported.ledger.decodedCandidates.length, 10);

          // 9. Prove download route against the loopback server
          const dlRes = await handlePortraitDownload(
            new Request("http://localhost:4000/sketches/download/01_Quiet_Reader.png"),
            "01_Quiet_Reader.png",
            {
              records: pubResult.records,
              fetchImpl: (input) => {
                const target = String(input).replace("https://files-cdn.x.ai", `${baseUrl}/cdn`);
                return fetch(target);
              },
            },
          );
          assert.equal(dlRes.status, 200);
          assert.equal(dlRes.headers.get("content-disposition"), 'attachment; filename="01_Quiet_Reader.png"');
        },
      );
    } finally {
      rmSync(work, { recursive: true, force: true });
    }
  });
});
