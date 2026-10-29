"use client";

/* eslint-disable react-hooks/immutability -- R3F owns mutable Three.js objects; effects and useFrame must update their uniforms, camera and renderer state imperatively. */

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CanvasTexture, Color, DepthTexture, Mesh, NearestFilter, NoColorSpace,
  OrthographicCamera, PerspectiveCamera, PlaneGeometry, Scene, ShaderMaterial,
  SRGBColorSpace, UnsignedIntType, Vector2, WebGLRenderTarget,
} from "three";
import { SHELF_BOOK_DEPTH, SHELF_ROW_GAP, SHELF_WIDTH, shelfRowCount, type ShelfBook } from "@/lib/shelf";
import {
  buildShelfUniforms, parseOutlineDebugParams, shelfCompositeFragment, shelfCompositeVertex,
  shelfNormalFragment, shelfObjectFragment, shelfObjectVertex, type OutlineParams,
} from "@/lib/shelf-shader";

type Props = {
  books: readonly ShelfBook[];
  filter: "all" | ShelfBook["kind"];
  focusedBook: string | null;
  onReady: () => void;
  onFail: () => void;
  onActivate: (book: ShelfBook) => void;
};

class Boundary extends Component<{ children: ReactNode; onFail: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error("Ink Shelf renderer failed", error); this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

/** A local system serif, rendered once. No font/model/texture network requests. */
function spineTexture(book: ShelfBook) {
  const canvas = document.createElement("canvas");
  canvas.width = 128; canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Shelf spine canvas unavailable");
  context.fillStyle = "#fffdf6"; context.fillRect(0, 0, 128, 512);
  const colours = { yellow: "#dfbe69", coral: "#d58e7f", mint: "#91b7a4", blue: "#8faabf", pink: "#cfa1b3" };
  context.fillStyle = colours[book.swatch]; context.fillRect(0, 20, 128, 42);
  context.fillStyle = "#302e2a"; context.font = "bold 28px Georgia, serif";
  context.textAlign = "center"; context.fillText(book.kind === "project" ? "P" : "N", 64, 482);
  context.save(); context.translate(64, 82); context.rotate(Math.PI / 2);
  context.textAlign = "left"; context.font = "26px Georgia, serif";
  context.fillText(book.title, 0, 9, 350); context.restore();
  context.strokeStyle = "#777166"; context.lineWidth = 2;
  context.strokeRect(6, 6, 116, 500);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function objectMaterial(texture: CanvasTexture | null, wood = false) {
  return new ShaderMaterial({
    vertexShader: shelfObjectVertex, fragmentShader: shelfObjectFragment,
    uniforms: {
      uSpine: { value: texture }, uHasSpine: { value: texture ? 1 : 0 },
      uWood: { value: wood ? 1 : 0 }, uHighlight: { value: 0 },
      uPaper: { value: new Color("#f2eddc") }, uInk: { value: new Color("#302e2a") },
    },
  });
}

function resolvedThemeColour(canvas: HTMLCanvasElement, variable: string, fallback: string) {
  // Custom properties can retain light-dark()/color-mix() tokens. Resolve through
  // a real CSS colour property before passing the resulting rgb() to Three.js.
  const probe = document.createElement("span");
  probe.style.display = "none"; probe.style.color = `var(${variable}, ${fallback})`;
  canvas.parentElement!.append(probe);
  const colour = getComputedStyle(probe).color;
  probe.remove();
  return colour;
}

function Volume({ book, active, still, onHover, onActivate }: {
  book: ShelfBook; active: boolean; still: boolean;
  onHover: (id: string | null) => void; onActivate: Props["onActivate"];
}) {
  const mesh = useRef<Mesh>(null);
  const velocity = useRef(0);
  const invalidate = useThree((state) => state.invalidate);
  const resources = useMemo(() => {
    const texture = spineTexture(book);
    return { texture, material: objectMaterial(texture) };
  }, [book]);
  useEffect(() => () => { resources.material.dispose(); resources.texture.dispose(); }, [resources]);
  useLayoutEffect(() => { resources.material.uniforms.uHighlight.value = active ? 1 : 0; invalidate(); }, [active, resources, invalidate]);
  useFrame((_, delta) => {
    if (!mesh.current) return;
    const target = book.y + (active ? 0.18 : 0);
    const distance = mesh.current.position.y - target;
    if (still || (Math.abs(distance) < 0.0005 && Math.abs(velocity.current) < 0.0005)) {
      mesh.current.position.y = target; velocity.current = 0;
      return;
    }
    // Exact critically damped spring; invalidate only until it settles.
    const dt = Math.min(Math.max(delta, 1 / 240), 0.05), omega = 18;
    const c = velocity.current + omega * distance;
    const decay = Math.exp(-omega * dt);
    mesh.current.position.y = target + (distance + c * dt) * decay;
    velocity.current = (velocity.current - omega * c * dt) * decay;
    invalidate();
  });
  return (
    <mesh ref={mesh} name={book.id} position={[book.x, book.y, book.z]} rotation={[0, 0, book.tiltRad]}
      material={resources.material}
      onPointerOver={(event) => { event.stopPropagation(); onHover(book.id); }}
      onPointerOut={() => onHover(null)}
      onClick={(event) => { event.stopPropagation(); onActivate(book); }}>
      <boxGeometry args={[book.thickness, book.height, SHELF_BOOK_DEPTH]} />
    </mesh>
  );
}

function ShelfScene({ books, filter, focusedBook, onReady, onFail, onActivate, params, still }: Props & { params: OutlineParams; still: boolean }) {
  const { gl, camera, size, scene, invalidate } = useThree();
  const [hoveredBook, setHoveredBook] = useState<string | null>(null);
  const parallax = useRef(new Vector2());
  const centreY = (2.4 - (shelfRowCount(books.length) - 1) * SHELF_ROW_GAP) / 2;
  const ready = useRef(false);
  const frames = useRef(0);
  const pipeline = useMemo(() => {
    const colour = new WebGLRenderTarget(1, 1, { minFilter: NearestFilter, magFilter: NearestFilter });
    colour.depthTexture = new DepthTexture(1, 1, UnsignedIntType);
    const normals = new WebGLRenderTarget(1, 1, { minFilter: NearestFilter, magFilter: NearestFilter });
    normals.texture.colorSpace = NoColorSpace;
    const normalMaterial = new ShaderMaterial({ vertexShader: shelfObjectVertex, fragmentShader: shelfNormalFragment });
    const composite = new ShaderMaterial({
      vertexShader: shelfCompositeVertex, fragmentShader: shelfCompositeFragment,
      depthTest: false, depthWrite: false,
      uniforms: {
        ...buildShelfUniforms(params), uColour: { value: colour.texture },
        uDepth: { value: colour.depthTexture }, uNormal: { value: normals.texture },
        uResolution: { value: new Vector2(1, 1) },
        uNear: { value: camera.near }, uFar: { value: camera.far },
        uPaper: { value: new Color("#f2eddc") }, uInk: { value: new Color("#302e2a") },
      },
    });
    const quad = new Mesh(new PlaneGeometry(2, 2), composite);
    quad.frustumCulled = false;
    const screen = new Scene(); screen.add(quad);
    return { colour, normals, normalMaterial, composite, quad, screen, screenCamera: new OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, [camera, params]);

  const wood = useMemo(() => objectMaterial(null, true), []);
  useEffect(() => () => wood.dispose(), [wood]);
  useEffect(() => () => {
    pipeline.colour.dispose(); // RenderTarget disposes its attached DepthTexture too.
    pipeline.normals.dispose(); pipeline.normalMaterial.dispose(); pipeline.composite.dispose();
    pipeline.quad.geometry.dispose(); pipeline.screen.clear();
  }, [pipeline]);

  useLayoutEffect(() => {
    const perspective = camera as PerspectiveCamera;
    const halfFov = Math.tan(perspective.fov * Math.PI / 360);
    const height = shelfRowCount(books.length) * SHELF_ROW_GAP;
    const distance = Math.max(height / 2 / halfFov, (SHELF_WIDTH + 1) / 2 / halfFov / (size.width / size.height)) * 1.05;
    camera.position.set(parallax.current.x, centreY + 1 + parallax.current.y, distance);
    camera.lookAt(0, centreY, 0); camera.updateProjectionMatrix();
    const dimensions = gl.getDrawingBufferSize(new Vector2());
    pipeline.colour.setSize(dimensions.x, dimensions.y); pipeline.normals.setSize(dimensions.x, dimensions.y);
    pipeline.composite.uniforms.uResolution.value.copy(dimensions);
    invalidate();
  }, [camera, size, gl, pipeline, books.length, centreY, invalidate]);

  useEffect(() => {
    const canvas = gl.domElement;
    canvas.dataset.outlineDebug = params.debug ? "1" : "0";
    canvas.dataset.outlineUniforms = JSON.stringify({
      ...Object.fromEntries(Object.entries(buildShelfUniforms(params)).map(([key, uniform]) => [key, uniform.value])),
    });
    canvas.dataset.focusedBook = focusedBook ?? "";
    canvas.dataset.hoveredBook = hoveredBook ?? "";
    canvas.style.cursor = hoveredBook ? "pointer" : "default";
    invalidate();
  }, [gl, params, focusedBook, hoveredBook, invalidate]);

  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onFail(); };
    const move = (event: PointerEvent) => {
      if (still) return;
      const rect = canvas.getBoundingClientRect();
      parallax.current.set(((event.clientX - rect.left) / rect.width - 0.5) * 0.6, -((event.clientY - rect.top) / rect.height - 0.5) * 0.35);
      camera.position.x = parallax.current.x; camera.position.y = centreY + 1 + parallax.current.y;
      camera.lookAt(0, centreY, 0); invalidate();
    };
    const leave = () => {
      parallax.current.set(0, 0); camera.position.x = 0; camera.position.y = centreY + 1;
      camera.lookAt(0, centreY, 0); setHoveredBook(null); invalidate();
    };
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("pointermove", move, { passive: true });
    canvas.addEventListener("pointerleave", leave);
    const previousShaderError = gl.debug.onShaderError;
    gl.debug.onShaderError = (...args) => {
      previousShaderError?.(...args);
      const [context, program, vertex, fragment] = args;
      console.error("Ink Shelf shader compilation failed", context.getProgramInfoLog(program), context.getShaderInfoLog(vertex), context.getShaderInfoLog(fragment));
      onFail();
    };
    return () => {
      canvas.removeEventListener("webglcontextlost", lost); canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerleave", leave); gl.debug.onShaderError = previousShaderError;
    };
  }, [gl, camera, centreY, still, invalidate, onFail]);

  // Retint on theme changes without creating a perpetual render loop.
  useEffect(() => {
    const retint = () => {
      const paper = resolvedThemeColour(gl.domElement, "--paper", "#f2eddc");
      const ink = resolvedThemeColour(gl.domElement, "--ink", "#302e2a");
      scene.traverse((object) => {
        if (object instanceof Mesh && object.material instanceof ShaderMaterial && object.material.uniforms.uPaper) {
          object.material.uniforms.uPaper.value.setStyle(paper); object.material.uniforms.uInk.value.setStyle(ink);
        }
      });
      // Both FBOs remain linear; only the final composite converts to display sRGB.
      pipeline.composite.uniforms.uPaper.value.setStyle(paper);
      pipeline.composite.uniforms.uInk.value.setStyle(ink);
      invalidate();
    };
    retint();
    const observer = new MutationObserver(retint);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "style", "class"] });
    const scheme = matchMedia("(prefers-color-scheme: dark)"); scheme.addEventListener("change", retint);
    return () => { observer.disconnect(); scheme.removeEventListener("change", retint); };
  }, [gl, scene, pipeline, books, invalidate]);

  // Positive priority takes ownership of rendering. R3F's demand scheduler remains idle at rest.
  useFrame(() => {
    const oldTarget = gl.getRenderTarget();
    const oldBackground = scene.background, oldOverride = scene.overrideMaterial;
    const oldClear = gl.getClearColor(new Color()), oldAlpha = gl.getClearAlpha();
    try {
      gl.setClearColor(pipeline.composite.uniforms.uPaper.value, 1);
      gl.setRenderTarget(pipeline.colour); gl.clear(); gl.render(scene, camera);
      scene.background = null; scene.overrideMaterial = pipeline.normalMaterial;
      gl.setClearColor(new Color(0.5, 0.5, 1), 0);
      gl.setRenderTarget(pipeline.normals); gl.clear(); gl.render(scene, camera);
      scene.overrideMaterial = oldOverride; scene.background = oldBackground;
      gl.setRenderTarget(null); gl.render(pipeline.screen, pipeline.screenCamera);
      gl.domElement.dataset.shelfFrames = String(++frames.current);
      if (!ready.current) { ready.current = true; onReady(); }
    } finally {
      scene.overrideMaterial = oldOverride; scene.background = oldBackground;
      gl.setRenderTarget(oldTarget); gl.setClearColor(oldClear, oldAlpha);
    }
  }, 1);

  return <>
    {Array.from({ length: shelfRowCount(books.length) }, (_, row) => (
      <mesh key={row} position={[0, -row * SHELF_ROW_GAP - 0.12, -0.07]} material={wood}>
        <boxGeometry args={[SHELF_WIDTH, 0.24, 1.1]} />
      </mesh>
    ))}
    {books.filter((book) => filter === "all" || book.kind === filter).map((book) => <Volume key={book.id} book={book} active={focusedBook === book.id || hoveredBook === book.id}
      still={still} onHover={setHoveredBook} onActivate={onActivate} />)}
  </>;
}

export default function InkShelf3D(props: Props) {
  const params = useMemo(() => parseOutlineDebugParams(new URLSearchParams(window.location.search)), []);
  const [still, setStill] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setStill(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return <Boundary onFail={props.onFail}>
    <Canvas frameloop="demand" dpr={[1, 1.5]} camera={{ fov: 28, near: 0.1, far: 180, position: [0, 0, 32] }}
      gl={{ antialias: false, alpha: false, powerPreference: "low-power" }} aria-hidden="true"
      fallback={null} style={{ width: "100%", height: "100%", touchAction: "pan-y" }}>
      <ShelfScene {...props} params={params} still={still} />
    </Canvas>
  </Boundary>;
}
