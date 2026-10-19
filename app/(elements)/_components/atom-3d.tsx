"use client";

import { Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Component, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Box3, Color, MeshBasicMaterial, Object3D, Sphere, type InstancedMesh, type MeshStandardMaterial } from "three";
import { NUCLEON_RADIUS, NUCLEUS_CAP, RING_BASE, RING_STEP, neutronsOf, nucleus, rings } from "../_lib/atom.ts";
import { categoryOf } from "../_lib/categories.ts";
import type { Element } from "../_lib/elements.ts";

// The interactive Bohr atom: the only file that imports three, fiber or drei,
// loaded by the dialog through next/dynamic after the first open. Everything is
// allocated once (a 64-nucleon InstancedMesh, a 118-electron InstancedMesh and
// seven tori), so stepping through the elements only rewrites matrices,
// colours and `visible`: nothing to dispose, nothing to grow. Lighting is a
// hemisphere light, a key light and an environment built from two Lightformers,
// so nothing is fetched at runtime.

const SHELLS_MAX = 7;
const ELECTRONS_MAX = 118;
const ELECTRON_RADIUS = 0.085;
const OUTER_MAX = RING_BASE + (SHELLS_MAX - 1) * RING_STEP;
const RESUME_MS = 4000;
const GLB = process.env.NEXT_PUBLIC_ELEMENTS_GLB === "1";
// Radius and tilt of each of the seven possible shells; they never depend on the element.
const RING_LAYOUT = rings(Array.from({ length: SHELLS_MAX }, () => 0));

const dummy = new Object3D();
const scratch = new Color();

/** A colour custom property as resolved on `el` (the theme's --cat), else `fallback`. */
function cssColour(el: HTMLElement, name: string, fallback: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || fallback;
}

class Boundary extends Component<{ fallback: ReactNode; onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Atom({ el, still }: { el: Element; still: boolean }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const group = useRef<Object3D>(null);
  const nucleons = useRef<InstancedMesh>(null);
  const electrons = useRef<InstancedMesh>(null);
  const electronMat = useRef<MeshStandardMaterial>(null);
  const t = useRef(0);
  // One material shared by the seven tori, so it is created and disposed here.
  const ringMat = useMemo(() => new MeshBasicMaterial({ transparent: true, opacity: 0.45, depthWrite: false }), []);
  useEffect(() => () => ringMat.dispose(), [ringMat]);

  const shells = el.shells;
  const fit = Math.min(2, OUTER_MAX / (RING_BASE + (shells.length - 1) * RING_STEP));

  // Swap the element: nucleus matrices and colours, ring visibility and tint.
  useLayoutEffect(() => {
    const cat = categoryOf(el);
    const tint = cssColour(gl.domElement, "--cat", cat.light);
    const grey = cssColour(gl.domElement, "--neutron", "#9a9ca3");
    const nuc = nucleus(el.number, neutronsOf(el));
    const mesh = nucleons.current!;
    nuc.points.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, scratch.set(p.kind === "proton" ? tint : grey));
    });
    mesh.count = nuc.points.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    ringMat.color.set(tint);
    electronMat.current!.color.set(tint);
    electronMat.current!.emissive.set(tint);
    group.current!.scale.setScalar(fit);
    t.current = 0;
    invalidate();
  }, [el, gl, fit, ringMat, invalidate]);

  // Electrons: advanced every frame from rings(), or held at t = 0 when still.
  const place = () => {
    const mesh = electrons.current!;
    let i = 0;
    for (const ring of rings(shells, t.current)) {
      for (const e of ring.electrons) {
        dummy.position.set(e.x, e.y, e.z);
        dummy.updateMatrix();
        mesh.setMatrixAt(i++, dummy.matrix);
      }
    }
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
  };
  useLayoutEffect(place);
  useFrame((_, delta) => {
    if (still) return;
    // A long pause (dialog closed, tab hidden) resumes smoothly instead of jumping.
    t.current += Math.min(delta, 0.1);
    place();
  });

  return (
    <group ref={group}>
      <instancedMesh ref={nucleons} args={[undefined, undefined, NUCLEUS_CAP]} frustumCulled={false}>
        <sphereGeometry args={[NUCLEON_RADIUS, 12, 8]} />
        <meshStandardMaterial roughness={0.4} metalness={0.1} />
      </instancedMesh>
      <instancedMesh ref={electrons} args={[undefined, undefined, ELECTRONS_MAX]} frustumCulled={false}>
        <sphereGeometry args={[ELECTRON_RADIUS, 10, 8]} />
        <meshStandardMaterial ref={electronMat} emissiveIntensity={0.6} roughness={0.3} />
      </instancedMesh>
      {RING_LAYOUT.map((ring) => (
        // The ring lies in its x-z plane, tilted about x then z, as in atom.ts:
        // Rz(tiltZ) · Rx(tiltX) · Rx(π/2) on a torus that starts in x-y.
        <mesh
          key={ring.index}
          visible={ring.index < shells.length}
          material={ringMat}
          rotation={[ring.tiltX + Math.PI / 2, 0, ring.tiltZ, "ZXY"]}
        >
          <torusGeometry args={[ring.radius, 0.012, 6, 96]} />
        </mesh>
      ))}
    </group>
  );
}

// The dataset's own GLB (behind NEXT_PUBLIC_ELEMENTS_GLB=1), scaled to the
// procedural atom's size. No Draco decoder, so nothing else is fetched.
function Glb({ url }: { url: string }) {
  const { scene } = useGLTF(url, false);
  const scale = useMemo(() => {
    const r = new Box3().setFromObject(scene).getBoundingSphere(new Sphere()).radius;
    return r > 0 ? OUTER_MAX / r : 1;
  }, [scene]);
  useEffect(() => () => useGLTF.clear(url), [url]);
  return <primitive object={scene} scale={scale} />;
}

function Model({ el, still }: { el: Element; still: boolean }) {
  const atom = <Atom el={el} still={still} />;
  if (!GLB || !el.bohr_model_3d) return atom;
  return (
    <Boundary key={el.bohr_model_3d} fallback={atom}>
      <Suspense fallback={atom}>
        <Glb url={el.bohr_model_3d} />
      </Suspense>
    </Boundary>
  );
}

export default function Atom3D({
  element,
  reducedMotion,
  active,
  onFail,
}: {
  element: Element;
  reducedMotion: boolean;
  /** false while the dialog is closed: the Canvas stays mounted but stops rendering */
  active: boolean;
  /** no renderer, a render error or a lost context: the dialog shows the SVG instead */
  onFail: () => void;
}) {
  const [spin, setSpin] = useState(true);
  const resume = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(resume.current), []);

  return (
    <Boundary fallback={null} onError={onFail}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 2.5, 13], fov: 40 }}
        frameloop={!active ? "never" : reducedMotion ? "demand" : "always"}
        gl={{ antialias: true, powerPreference: "low-power" }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault();
              onFail();
            },
            { once: true },
          );
        }}
        style={{ width: "100%", maxWidth: "min(300px, 56vw)", aspectRatio: "1 / 1", margin: "0 auto", touchAction: "none" }}
        aria-hidden="true"
      >
        <hemisphereLight args={["#ffffff", "#3a3f4b", 0.9]} />
        <pointLight position={[6, 7, 9]} intensity={120} decay={2} />
        <Environment resolution={64}>
          <Lightformer form="rect" intensity={2} position={[0, 5, 6]} scale={[10, 4, 1]} />
          <Lightformer form="ring" intensity={1.2} position={[-6, -2, -4]} scale={4} />
        </Environment>
        <Model el={element} still={reducedMotion} />
        <OrbitControls
          enablePan={false}
          enableDamping
          minDistance={6}
          maxDistance={22}
          autoRotate={spin && !reducedMotion}
          autoRotateSpeed={0.8}
          onStart={() => {
            clearTimeout(resume.current);
            setSpin(false);
          }}
          onEnd={() => {
            clearTimeout(resume.current);
            resume.current = setTimeout(() => setSpin(true), RESUME_MS);
          }}
        />
      </Canvas>
    </Boundary>
  );
}
