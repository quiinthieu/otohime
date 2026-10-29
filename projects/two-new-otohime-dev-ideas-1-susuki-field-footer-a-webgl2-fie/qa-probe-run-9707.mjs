// Independent Task 3 QA. Run from repository root with Node's type stripping.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const require = createRequire(`${process.cwd()}/package.json`);
const { chromium } = require('playwright-core');
const { Matrix4, Vector3, PerspectiveCamera } = await import(pathToFileURL(`${process.cwd()}/node_modules/three/build/three.module.js`));
const { site } = await import(pathToFileURL(`${process.cwd()}/content/site.ts`));
const { buildShelfBooks, projectBookScreenRect } = await import(pathToFileURL(`${process.cwd()}/lib/shelf.ts`));
const books = buildShelfBooks(site.projectList, site.notes);
const expected = [...site.projectList.flatMap(p => p.href ? [p.href] : []), ...site.notes.map(n => `/notes/${n.slug}`)].sort();
assert.deepEqual(books.map(b => b.href).sort(), expected);
// A separate Three.js oracle, with translated/rotated boxes wholly inside the frustum.
let projections = 0;
const camera = new PerspectiveCamera(42, 1366 / 768, 0.1, 100);
camera.position.set(0, 0, 12); camera.updateMatrixWorld();
for (let i = 0; i < 80; i++) {
  const model = new Matrix4().makeRotationY(i / 31);
  model.setPosition((i % 9 - 4) / 3, (i % 7 - 3) / 3, 0);
  const mvp = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).multiply(model);
  const bounds = { min: { x: -0.3, y: -0.7, z: -0.2 }, max: { x: 0.3, y: 0.7, z: 0.2 } };
  const points = [];
  for (const x of [-0.3, 0.3]) for (const y of [-0.7, 0.7]) for (const z of [-0.2, 0.2]) points.push(new Vector3(x, y, z).applyMatrix4(mvp));
  const xs = points.map(p => (p.x + 1) * 683), ys = points.map(p => (1 - p.y) * 384);
  const actual = projectBookScreenRect(bounds, mvp.elements, { width: 1366, height: 768 });
  const wanted = { left: Math.min(...xs), top: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  assert.equal(actual.visible, true);
  for (const key of Object.keys(wanted)) assert.ok(Math.abs(actual[key] - wanted[key]) < 1e-7, `${i} ${key}`);
  projections++;
}
const behind = new Matrix4().copy(camera.projectionMatrix).multiply(new Matrix4().makeTranslation(0, 0, 2));
assert.equal(projectBookScreenRect({ min: { x: -1, y: -1, z: 0 }, max: { x: 1, y: 1, z: 1 } }, behind.elements, { width: 1366, height: 768 }).visible, false);
console.log(JSON.stringify({ oracle: 'real Three.js camera/Matrix4/Vector3', projections, behindCameraNegative: 'pass', catalog: expected }));
const base = process.env.QA_BASE || 'https://otohime.dev';
const response = await fetch(`${base}/shelf`);
assert.equal(response.status, 200);
const html = await response.text();
const scriptURLs = [...new Set([...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => new URL(m[1].replaceAll('&amp;', '&'), base).href))];
const artifacts = (await Promise.all(scriptURLs.map(async url => {
  const r = await fetch(url); assert.equal(r.status, 200);
  const text = await r.text();
  return text.includes('shelf-book-list') ? { url, bytes: Buffer.byteLength(text), sha256: createHash('sha256').update(text).digest('hex') } : null;
}))).filter(Boolean);
assert.ok(artifacts.length, 'real shelf client chunk must be present');
console.log(JSON.stringify({ ssrBytes: Buffer.byteLength(html), ssrSha256: createHash('sha256').update(html).digest('hex'), shelfClientArtifacts: artifacts }));
const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
console.log(JSON.stringify({ base, chrome: browser.version() }));
try {
  // Compare clipped projection with real WebGL rasterization, independently of
  // the CPU plane-intersection implementation. Raster edges allow two pixels.
  const gpuPage = await browser.newPage();
  const gpuCamera = new PerspectiveCamera(42, 128 / 96, 1, 10);
  const matrix = gpuCamera.projectionMatrix.elements;
  const cases = [
    [[-0.5, -0.5, -3], [0.5, 0.5, -2]],
    [[0.1, -0.3, -2], [1, 0.4, -0.6]],
    [[2, -0.5, -3], [4, 0.5, -2]],
    [[-1, -1, 1], [1, 1, 3]],
    [[-3, -0.5, -2], [-0.5, 0.5, -1.1]],
    [[-0.5, -0.5, -12], [0.5, 0.5, -9]],
    [[-0.1, -0.1, -0.9], [0.1, 0.1, -0.2]],
  ];
  const raster = await gpuPage.evaluate(({ matrix, cases }) => {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 96;
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('Real WebGL2 raster oracle unavailable');
    const shader = (type, source) => { const s = gl.createShader(type); gl.shaderSource(s, source); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, '#version 300 es\nin vec3 p; uniform mat4 m; void main(){gl_Position=m*vec4(p,1.0);}'));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float; out vec4 color; void main(){color=vec4(1.0);}'));
    gl.linkProgram(program); if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program); gl.uniformMatrix4fv(gl.getUniformLocation(program, 'm'), false, matrix);
    const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const loc = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
    const indices = [0,1,3,0,3,2,4,6,7,4,7,5,0,4,5,0,5,1,2,3,7,2,7,6,0,2,6,0,6,4,1,5,7,1,7,3];
    const results = cases.map(([min, max]) => {
      const corners = Array.from({ length: 8 }, (_, i) => [i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]]);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(indices.flatMap(i => corners[i])), gl.STATIC_DRAW);
      gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, indices.length);
      const pixels = new Uint8Array(128 * 96 * 4); gl.readPixels(0,0,128,96,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let x0 = 128, x1 = -1, y0 = 96, y1 = -1;
      for(let y=0;y<96;y++) for(let x=0;x<128;x++) if(pixels[(y*128+x)*4]) { x0=Math.min(x0,x); x1=Math.max(x1,x); y0=Math.min(y0,95-y); y1=Math.max(y1,95-y); }
      return { left:x0, top:y0, width:x1-x0+1, height:y1-y0+1, visible:x1>=0 };
    });
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    return { results, renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), error: gl.getError() };
  }, { matrix, cases });
  assert.equal(raster.error, 0);
  for (let i = 0; i < cases.length; i++) {
    const [min, max] = cases[i];
    const point = a => ({ x:a[0], y:a[1], z:a[2] });
    const cpu = projectBookScreenRect({ min:point(min), max:point(max) }, matrix, { width:128, height:96 });
    assert.equal(cpu.visible, raster.results[i].visible, `GPU visibility ${i}`);
    if (cpu.visible) for (const k of ['left','top','width','height']) assert.ok(Math.abs(cpu[k]-raster.results[i][k]) <= 2, `GPU case ${i} ${k}`);
  }
  console.log(JSON.stringify({ realWebGLRasterCases:cases.length, renderer:raster.renderer, clippedProjection:'pass', nearFarBehindNegative:'pass' }));
  await gpuPage.close();
  for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
    const nojs = await browser.newContext({ viewport, javaScriptEnabled: false });
    const raw = await nojs.newPage();
    assert.equal((await raw.goto(`${base}/shelf`)).status(), 200);
    const links = raw.locator('[data-testid="shelf-book-list"] a');
    assert.deepEqual((await links.evaluateAll(es => es.map(e => e.getAttribute('href')))).sort(), expected);
    const initial = await raw.locator('.shelf-frame').boundingBox();
    const note = links.filter({ has: raw.locator('.shelf-spine-kind', { hasText: 'N' }) }).first();
    const href = await note.getAttribute('href');
    await note.click(); await raw.waitForURL(`**${href}`);
    assert.ok(await raw.locator('h1').innerText());
    await raw.goto(`${base}/shelf`);
    const project = raw.locator('.shelf-book[data-book-id^="project-"]').first();
    const projectHref = await project.getAttribute('href');
    await project.click(); await raw.waitForURL(`**${projectHref}`);
    assert.ok(await raw.locator('h1').innerText());
    await nojs.close();
    const context = await browser.newContext({ viewport });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`${base}/shelf`);
    const shelf = page.locator('[data-shelf-mode="flat"]');
    await shelf.waitFor();
    for (const [label, kind] of [['Notes', 'note'], ['Projects', 'project'], ['All', null]]) {
      await page.getByRole('button', { name: label, exact: true }).click();
      const visible = page.locator('.shelf-slot:visible a');
      await page.waitForFunction(n => document.querySelectorAll('.shelf-slot:not([hidden]) a').length === n, books.filter(b => !kind || b.kind === kind).length);
      assert.deepEqual((await visible.evaluateAll(es => es.map(e => e.getAttribute('href')))).sort(), books.filter(b => !kind || b.kind === kind).map(b => b.href).sort());
      const rect = await page.locator('.shelf-frame').boundingBox();
      assert.equal(rect.height, initial.height); assert.equal(rect.width, initial.width);
    }
    const names = await page.locator('.shelf-book').evaluateAll(es => es.map(e => getComputedStyle(e).viewTransitionName));
    assert.equal(new Set(names).size, books.length);
    assert.ok(names.every(n => /^(project|note)-/.test(n)));
    await page.getByRole('button', { name: 'Notes', exact: true }).focus();
    await page.keyboard.press('Tab');
    const id = await page.locator(':focus').getAttribute('data-book-id');
    assert.ok(id); assert.equal(await shelf.getAttribute('data-focused-book'), id);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    if (process.env.QA_SCREENSHOT) await page.screenshot({ path: `${process.env.QA_SCREENSHOT}-${viewport.width}.png`, fullPage: true });
    console.log(JSON.stringify({ viewport, links: books.length, geometry: initial, filters: 'pass', keyboard: id, errors }));
    assert.deepEqual(errors, []);
    await context.close();
  }
  const negative = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await negative.addInitScript(() => {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) { return /webgl/.test(type) ? null : original.call(this, type, ...args); };
  });
  const page = await negative.newPage();
  const negativeErrors = [];
  page.on('pageerror', e => negativeErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') negativeErrors.push(m.text()); });
  await page.goto(`${base}/shelf`);
  assert.equal(await page.locator('[data-shelf-mode="flat"]').count(), 1);
  assert.deepEqual((await page.locator('.shelf-book').evaluateAll(es => es.map(e => getComputedStyle(e).viewTransitionName))), books.map(() => 'none'));
  await page.getByRole('button', { name: 'Notes', exact: true }).click();
  await page.waitForFunction(n => document.querySelectorAll('.shelf-slot:not([hidden])').length === n, site.notes.length);
  const first = page.locator('.shelf-slot:visible a').first(), href = await first.getAttribute('href');
  await first.click(); await page.waitForURL(`**${href}`);
  assert.deepEqual(negativeErrors, []);
  console.log(JSON.stringify({ capabilityFixtures: 'Save-Data + unavailable WebGL', reducedMotion: 'real browser media emulation', negativeControl: 'flat links, filter and navigation pass' }));
  await negative.close();
} finally { await browser.close(); }
