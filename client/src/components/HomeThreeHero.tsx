import { useEffect, useRef, useState } from "react";
import type { Group, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { ChevronLeft, Compass, MoonStar, Sparkles } from "lucide-react";

type SceneStatus = "loading" | "ready" | "fallback";

const destinations = [
  { id: "home-wird", label: "وردك", x: "50%", y: "86%", icon: BookMarkIcon },
  { id: "home-salat", label: "صلاتك", x: "76%", y: "73%", icon: MoonStar },
  { id: "home-tranquility", label: "طمأنينتك", x: "24%", y: "73%", icon: Sparkles },
];

function BookMarkIcon({ size = 15 }: { size?: number }) {
  return <span className="home-three-point-rosette" style={{ width: size, height: size }} aria-hidden="true">۞</span>;
}

function starShape(THREE: typeof import("three")) {
  const shape = new THREE.Shape();
  const points = 16;
  for (let index = 0; index < points; index += 1) {
    const angle = (Math.PI * 2 * index) / points - Math.PI / 2;
    const radius = index % 2 === 0 ? 0.43 : 0.19;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function makePageGeometry(THREE: typeof import("three"), side: -1 | 1) {
  const columns = 18;
  const rows = 14;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    const z = -0.9 + (1.8 * row) / rows;
    for (let column = 0; column <= columns; column += 1) {
      const distance = (1.34 * column) / columns;
      const x = side === 1 ? distance : -distance;
      const curl = 0.04 + 0.15 * Math.sin((distance / 1.34) * Math.PI * 0.82);
      const edgeLift = Math.pow(Math.abs(z) / 0.9, 2) * 0.055;
      positions.push(x, curl + edgeLift, z);
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + columns + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makePageLines(THREE: typeof import("three"), side: -1 | 1) {
  const positions: number[] = [];
  for (let row = 0; row < 8; row += 1) {
    const z = -0.55 + row * 0.15;
    const from = 0.18;
    const to = 1.13 - (row % 3) * 0.07;
    const steps = 16;
    for (let step = 0; step < steps; step += 1) {
      const a = from + ((to - from) * step) / steps;
      const b = from + ((to - from) * (step + 1)) / steps;
      const curve = (distance: number) => 0.065 + 0.15 * Math.sin((distance / 1.34) * Math.PI * 0.82) + 0.008;
      positions.push(side * a, curve(a), z, side * b, curve(b), z);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
}

function addMinaret(THREE: typeof import("three"), scene: Scene, x: number, z: number, height: number) {
  const stone = new THREE.MeshStandardMaterial({ color: 0x1c5840, roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.32, roughness: 0.48 });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.15, height, 8), stone);
  shaft.position.set(x, height / 2 + 0.12, z);
  scene.add(shaft);
  const balcony = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.07, 8), gold);
  balcony.position.set(x, height * 0.7, z);
  scene.add(balcony);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.36, 8), stone);
  cap.position.set(x, height + 0.3, z);
  scene.add(cap);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 4), gold);
  finial.position.set(x, height + 0.53, z);
  scene.add(finial);
}

function makeScene(THREE: typeof import("three"), scene: Scene) {
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.55, roughness: 0.35 });
  const green = new THREE.MeshStandardMaterial({ color: 0x0f4a36, roughness: 0.68 });
  const domeGreen = new THREE.MeshStandardMaterial({ color: 0x2e8b63, roughness: 0.52, metalness: 0.06 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xf3ebd3, roughness: 0.82, side: THREE.DoubleSide });

  scene.add(new THREE.HemisphereLight(0xf3ebd3, 0x101820, 2.1));
  const keyLight = new THREE.DirectionalLight(0xf3dfaa, 2.4);
  keyLight.position.set(-3, 6, 5);
  scene.add(keyLight);
  const greenRim = new THREE.PointLight(0x2e8b63, 11, 11);
  greenRim.position.set(0, 1.6, -2.2);
  scene.add(greenRim);

  const skyline = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.79, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeGreen);
  dome.scale.set(1.22, 1.15, 0.8);
  dome.position.set(0, 1.12, -2.15);
  skyline.add(dome);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.76, 0.82, 0.25, 12), green);
  drum.position.set(0, 0.83, -2.15);
  skyline.add(drum);
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.095, 0.32, 8), gold);
  finial.position.set(0, 2.13, -2.15);
  skyline.add(finial);
  scene.add(skyline);
  addMinaret(THREE, scene, -1.58, -2.1, 2.1);
  addMinaret(THREE, scene, 1.58, -2.1, 2.35);

  const cityBase = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.34, 0.42), green);
  cityBase.position.set(0, 0.26, -2.08);
  scene.add(cityBase);
  for (const x of [-1.02, -0.68, 0.68, 1.02]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.02), gold);
    window.position.set(x, 0.28, -1.855);
    scene.add(window);
  }

  const book = new THREE.Group();
  book.position.set(0, 0.62, 0.12);
  const coverBase = new THREE.Mesh(new THREE.BoxGeometry(2.94, 0.13, 1.98), green);
  coverBase.position.y = -0.055;
  book.add(coverBase);
  const coverEdge = new THREE.Mesh(new THREE.BoxGeometry(2.88, 0.035, 1.92), gold);
  coverEdge.position.y = 0.02;
  book.add(coverEdge);
  const leftPage = new THREE.Group();
  const rightPage = new THREE.Group();
  const leftMesh = new THREE.Mesh(makePageGeometry(THREE, -1), cream);
  const rightMesh = new THREE.Mesh(makePageGeometry(THREE, 1), cream);
  leftMesh.position.y = 0.045;
  rightMesh.position.y = 0.045;
  leftPage.add(leftMesh);
  rightPage.add(rightMesh);
  const ink = new THREE.LineBasicMaterial({ color: 0x8f7b52, transparent: true, opacity: 0.43 });
  leftPage.add(new THREE.LineSegments(makePageLines(THREE, -1), ink));
  rightPage.add(new THREE.LineSegments(makePageLines(THREE, 1), ink));
  book.add(leftPage, rightPage);
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.92, 8), gold);
  spine.rotation.x = Math.PI / 2;
  spine.position.set(0, 0.1, 0);
  book.add(spine);
  const cornerMedallion = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), gold);
  cornerMedallion.position.set(0, 0.12, 0);
  book.add(cornerMedallion);
  scene.add(book);

  const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xf3d77d, transparent: true, opacity: 0.085, side: THREE.DoubleSide, depthWrite: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.78, 2.7, 12, 1, true), beamMaterial);
  beam.position.set(0, 2.05, 0.2);
  scene.add(beam);
  const star = new THREE.Mesh(new THREE.ShapeGeometry(starShape(THREE)), new THREE.MeshStandardMaterial({ color: 0xd4af37, emissive: 0x715516, emissiveIntensity: 0.34, metalness: 0.72, roughness: 0.28, side: THREE.DoubleSide }));
  star.rotation.x = -Math.PI / 2;
  star.position.set(0, 3.34, 0.04);
  scene.add(star);
  const starHalo = new THREE.PointLight(0xd4af37, 5, 5);
  starHalo.position.set(0, 3.16, 0.05);
  scene.add(starHalo);

  const orbitPoints: import("three").Vector3[] = [];
  for (let index = 0; index <= 100; index += 1) {
    const angle = (Math.PI * 2 * index) / 100;
    orbitPoints.push(new THREE.Vector3(Math.cos(angle) * 2.22, 0.28, Math.sin(angle) * 1.35));
  }
  const orbitGeometry = new THREE.BufferGeometry().setFromPoints(orbitPoints);
  const orbit = new THREE.Line(orbitGeometry, new THREE.LineDashedMaterial({ color: 0xd4af37, dashSize: 0.08, gapSize: 0.075, transparent: true, opacity: 0.78 }));
  orbit.computeLineDistances();
  scene.add(orbit);
  const orbitDots: Group = new THREE.Group();
  for (let index = 0; index < 3; index += 1) {
    const angle = [-Math.PI / 2, 0.72, Math.PI - 0.72][index];
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.073, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf3d77d, emissive: 0xd4af37, emissiveIntensity: 0.65, metalness: 0.35, roughness: 0.28 }));
    dot.position.set(Math.cos(angle) * 2.22, 0.32, Math.sin(angle) * 1.35);
    orbitDots.add(dot);
    const glow = new THREE.PointLight(0xd4af37, 1.6, 1.4);
    glow.position.copy(dot.position);
    orbitDots.add(glow);
  }
  scene.add(orbitDots);

  const particleCount = 70;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let index = 0; index < particleCount; index += 1) {
    const seed = index + 17;
    particlePositions[index * 3] = (Math.sin(seed * 12.9898) * 43758.5453 % 1) * 5.5;
    particlePositions[index * 3 + 1] = 0.25 + ((Math.sin(seed * 8.23) + 1) / 2) * 3.3;
    particlePositions[index * 3 + 2] = -3 + ((Math.sin(seed * 4.17) + 1) / 2) * 5;
  }
  const particlesGeometry = new THREE.BufferGeometry();
  particlesGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(particlesGeometry, new THREE.PointsMaterial({ color: 0xd4af37, size: 0.035, transparent: true, opacity: 0.68, sizeAttenuation: true }));
  scene.add(particles);

  return { book, leftPage, rightPage, star, particles, skyline, orbitDots };
}

export default function HomeThreeHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLElement>(null);
  const pointerRef = useRef({ x: 0, y: 0 });
  const deviceOrientationHandlerRef = useRef<((event: DeviceOrientationEvent) => void) | null>(null);
  const pageTurnRef = useRef(0);
  const [status, setStatus] = useState<SceneStatus>("loading");
  const [motionEnabled, setMotionEnabled] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    if (typeof IntersectionObserver === "undefined" || typeof ResizeObserver === "undefined") {
      setStatus("fallback");
      return;
    }
    let disposed = false;
    let renderer: WebGLRenderer | null = null;
    let frameId = 0;
    let observer: IntersectionObserver | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let scene: Scene | null = null;
    let camera: PerspectiveCamera | null = null;
    let animatables: ReturnType<typeof makeScene> | null = null;
    let visible = false;
    let started = false;
    let renderFrame: ((time: number) => void) | null = null;
    let reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let scrollTarget = 0;
    let lastScroll = window.scrollY;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const setMotionPreference = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches;
      if (reducedMotion) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
        if (renderer && scene && camera) renderer.render(scene, camera);
      } else if (visible && renderFrame && !frameId) {
        frameId = window.requestAnimationFrame(renderFrame);
      }
    };
    mediaQuery.addEventListener("change", setMotionPreference);

    const onPointerMove = (event: PointerEvent) => {
      const bounds = host.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      pointerRef.current.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    };
    const onPointerLeave = () => { pointerRef.current.x = 0; pointerRef.current.y = 0; };
    const onScroll = () => {
      if (reducedMotion) return;
      const difference = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      scrollTarget = Math.max(-0.18, Math.min(0.18, scrollTarget + difference * 0.0007));
    };
    const onVisibilityChange = () => {
      if (document.hidden && frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      } else if (!document.hidden && visible && !reducedMotion && renderFrame && !frameId) {
        frameId = window.requestAnimationFrame(renderFrame);
      }
    };
    host.addEventListener("pointermove", onPointerMove, { passive: true });
    host.addEventListener("pointerleave", onPointerLeave, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);

    const start = async () => {
      try {
        const THREE = await import("three");
        if (disposed) return;
        scene = new THREE.Scene();
        scene.background = null;
        camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
        camera.position.set(0, 3.6, 10.2);
        camera.lookAt(0, 1.25, -0.15);
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: "low-power", stencil: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x101820, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.06;
        animatables = makeScene(THREE, scene);
        const resize = () => {
          if (!renderer || !camera || !host) return;
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
          renderer.setSize(width, height, false);
          renderer.render(scene!, camera);
        };
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        resize();
        if (disposed) return;
        setStatus("ready");

        const render = (time: number) => {
          frameId = 0;
          if (disposed || !renderer || !scene || !camera || !animatables) return;
          if (visible && !document.hidden) {
            if (!reducedMotion) {
              const seconds = time * 0.001;
              const targetX = pointerRef.current.x * 0.12;
              const targetZ = pointerRef.current.y * 0.055;
              scene.rotation.y += (targetX - scene.rotation.y) * 0.035;
              scene.rotation.x += (targetZ - scene.rotation.x) * 0.035;
              animatables.star.rotation.y = seconds * 0.16;
              animatables.star.position.y = 3.34 + Math.sin(seconds * 0.5) * 0.035;
              animatables.book.position.y = 0.62 + Math.sin(seconds * 0.65) * 0.035;
              animatables.skyline.rotation.y = Math.sin(seconds * 0.15) * 0.025;
              const turn = Math.sin(pageTurnRef.current * 0.8) * 0.28 + Math.sin(seconds * 0.22) * 0.018 + scrollTarget * 0.2;
              animatables.leftPage.rotation.z += (turn - animatables.leftPage.rotation.z) * 0.025;
              animatables.rightPage.rotation.z += (-turn - animatables.rightPage.rotation.z) * 0.025;
              animatables.particles.rotation.y = seconds * 0.012;
              animatables.orbitDots.rotation.y = seconds * 0.035;
              scrollTarget *= 0.995;
            }
            renderer.render(scene, camera);
          }
          if (visible && !document.hidden && !reducedMotion) {
            frameId = window.requestAnimationFrame(render);
          }
        };
        renderFrame = render;
        if (reducedMotion) renderer.render(scene, camera);
        else if (visible) frameId = window.requestAnimationFrame(render);
      } catch {
        if (!disposed) setStatus("fallback");
        renderer?.dispose();
        renderer = null;
      }
    };

    observer = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible && !started) {
        started = true;
        void start();
      } else if (visible && renderer && !reducedMotion && renderFrame && !frameId) {
        frameId = window.requestAnimationFrame(renderFrame);
      } else if (!visible && frameId) {
        window.cancelAnimationFrame(frameId);
        frameId = 0;
      }
    }, { rootMargin: "180px" });
    observer.observe(host);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      observer?.disconnect();
      resizeObserver?.disconnect();
      mediaQuery.removeEventListener("change", setMotionPreference);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (deviceOrientationHandlerRef.current) {
        window.removeEventListener("deviceorientation", deviceOrientationHandlerRef.current);
        deviceOrientationHandlerRef.current = null;
      }
      if (scene) {
        scene.traverse(object => {
          const mesh = object as { geometry?: { dispose: () => void }; material?: unknown };
          mesh.geometry?.dispose();
          const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          materials.forEach(material => {
            const candidate = material as { dispose?: () => void } | undefined;
            candidate?.dispose?.();
          });
        });
      }
      renderer?.dispose();
      renderer?.forceContextLoss();
    };
  }, []);

  async function enableDeviceTilt() {
    if (deviceOrientationHandlerRef.current) {
      window.removeEventListener("deviceorientation", deviceOrientationHandlerRef.current);
      deviceOrientationHandlerRef.current = null;
      pointerRef.current = { x: 0, y: 0 };
      setMotionEnabled(false);
      return;
    }
    if (!("DeviceOrientationEvent" in window)) return;
    const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    try {
      if (orientation.requestPermission && await orientation.requestPermission() !== "granted") return;
      const handler = (event: DeviceOrientationEvent) => {
        if (event.gamma === null || event.beta === null) return;
        pointerRef.current.x = Math.max(-1, Math.min(1, event.gamma / 35));
        pointerRef.current.y = Math.max(-1, Math.min(1, (event.beta - 35) / 55));
      };
      deviceOrientationHandlerRef.current = handler;
      window.addEventListener("deviceorientation", handler, { passive: true });
      setMotionEnabled(true);
    } catch {
      setMotionEnabled(false);
    }
  }

  function scrollToDestination(id: string) {
    const target = document.getElementById(id);
    target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  }

  return (
    <section className="home-three-hero" ref={hostRef} aria-labelledby="home-three-title">
      <img className={`home-three-fallback ${status === "ready" ? "is-ready" : ""}`} src="/images/mushaf-3d-fallback.svg" alt="" aria-hidden="true" />
      <canvas className={`home-three-canvas ${status === "ready" ? "is-ready" : ""}`} ref={canvasRef} aria-hidden="true" />
      <div className="home-three-vignette" aria-hidden="true" />
      <div className="home-three-copy">
        <span className="home-three-eyebrow"><Sparkles size={13} /> صحبةٌ هادئة على طريق النور</span>
        <h2 id="home-three-title">بين يدي كتاب الله</h2>
        <p>وردٌ يطمئن القلب، وصلاةٌ تجمع يومك، وسكينةٌ ترافق خطاك.</p>
        <button className="home-three-motion" type="button" onClick={() => void enableDeviceTilt()} aria-pressed={motionEnabled}>
          <Compass size={14} /> {motionEnabled ? "حركة الجهاز مفعّلة" : "حرّك المشهد بلمسة أو بإمالة جهازك"}
        </button>
        <button className="home-three-turn" type="button" onClick={() => { pageTurnRef.current += Math.PI / 2; }} aria-label="قلّب صفحة المصحف">
          قلّب الصفحة <ChevronLeft size={14} />
        </button>
      </div>
      <div className="home-three-points" aria-label="روابط سريعة">
        {destinations.map(({ id, label, x, y, icon: Icon }) => (
          <button key={id} className={`home-three-point home-three-point-${id}`} type="button" style={{ left: x, top: y }} onClick={() => scrollToDestination(id)}>
            <span className="home-three-point-pulse"><Icon size={14} /></span>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <span className="home-three-status" role="status" aria-live="polite">
        {status === "loading" ? "يتهيأ المشهد" : status === "fallback" ? "مشهد زخرفي ثابت" : ""}
      </span>
    </section>
  );
}
