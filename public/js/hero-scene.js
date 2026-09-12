/* ==========================================
   HERO-SCENE.JS
   Layered 3D misty mountains — homepage hero only.
   Progressive enhancement: if Three.js/WebGL is
   unavailable, the CSS gradient in .hero is the
   fallback and nothing breaks.
========================================== */
(() => {
  "use strict";

  const mount = document.getElementById("heroCanvas");
  if (!mount) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isNarrow = window.innerWidth < 700;

  if (typeof THREE === "undefined") return; // CDN failed to load — CSS gradient fallback remains visible

  let renderer, scene, camera, raf, running = false;
  let mountainLayers = [], mistLayers = [], motes;
  let pointer = { x: 0, y: 0 };
  let target = { x: 0, y: 0 };
  let scrollFactor = 0;
  const clock = new THREE.Clock();

  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "low-power" });
  } catch (e) {
    return; // no WebGL — fallback gradient stands in
  }
  if (!renderer.getContext()) return;

  const dpr = Math.min(window.devicePixelRatio || 1, isNarrow ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.setClearColor(0x000000, 0);
  mount.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b1512, 0.024);

  camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  camera.position.set(0, 0.4, 14);

  /* ---------- Palette (mirrors CSS tokens) ---------- */
  const near = new THREE.Color(0x0e2119);
  const mid1 = new THREE.Color(0x1c3a2c);
  const mid2 = new THREE.Color(0x3c5a52);
  const far = new THREE.Color(0x6e8da6);

  /* ---------- Ridge geometry builder ---------- */
  function makeRidge(width, height, segments, seed, jag) {
    const geo = new THREE.PlaneGeometry(width, height, segments, 1);
    const pos = geo.attributes.position;
    const cols = segments + 1;
    for (let i = 0; i < cols; i++) {
      const topIndex = i; // top row is first `cols` vertices in a 1-row-height plane
      const x = pos.getX(topIndex);
      const n =
        Math.sin(x * 0.18 + seed) * 0.55 +
        Math.sin(x * 0.42 + seed * 2.1) * 0.28 +
        Math.sin(x * 0.9 + seed * 3.7) * 0.14;
      pos.setY(topIndex, pos.getY(topIndex) + n * jag);
    }
    geo.computeVertexNormals();
    return geo;
  }

  const layerConfig = [
    { z: -2,  width: 34, height: 6.5, y: -2.6, color: near, seed: 1.3, jag: 1.5, seg: isNarrow ? 24 : 44 },
    { z: -8,  width: 46, height: 8,   y: -2.1, color: mid1, seed: 4.1, jag: 2.0, seg: isNarrow ? 20 : 36 },
    { z: -16, width: 60, height: 9,   y: -1.6, color: mid2, seed: 7.4, jag: 2.4, seg: isNarrow ? 18 : 30 },
    { z: -26, width: 78, height: 10,  y: -1.0, color: far,  seed: 2.8, jag: 2.6, seg: isNarrow ? 14 : 24 },
  ];

  layerConfig.forEach(cfg => {
    const geo = makeRidge(cfg.width, cfg.height, cfg.seg, cfg.seed, cfg.jag);
    const mat = new THREE.MeshBasicMaterial({ color: cfg.color, fog: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, cfg.y, cfg.z);
    scene.add(mesh);
    mountainLayers.push(mesh);
  });

  /* ---------- Soft mist planes ---------- */
  function mistTexture() {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 64);
    g.addColorStop(0, "rgba(245,241,230,0)");
    g.addColorStop(0.5, "rgba(245,241,230,0.9)");
    g.addColorStop(1, "rgba(245,241,230,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  const mistTex = mistTexture();
  const mistPositions = [
    { z: -6, y: -1.6, w: 50, h: 2.2, op: 0.16 },
    { z: -13, y: -1.1, w: 64, h: 2.6, op: 0.14 },
    { z: -21, y: -0.6, w: 76, h: 3, op: 0.12 },
  ];
  mistPositions.forEach((cfg, i) => {
    const geo = new THREE.PlaneGeometry(cfg.w, cfg.h);
    const mat = new THREE.MeshBasicMaterial({
      map: mistTex, transparent: true, opacity: cfg.op, depthWrite: false, fog: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, cfg.y, cfg.z);
    mesh.userData.drift = { speed: 0.04 + i * 0.015, offset: i * 12, range: 2.4 + i };
    scene.add(mesh);
    mistLayers.push(mesh);
  });

  /* ---------- Light motes ---------- */
  function moteTexture() {
    const c = document.createElement("canvas");
    c.width = 64; c.height = 64;
    const ctx = c.getContext("2d");
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "rgba(224,160,82,1)");
    g.addColorStop(0.4, "rgba(224,160,82,0.55)");
    g.addColorStop(1, "rgba(224,160,82,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return tex;
  }
  const moteCount = isNarrow ? 18 : 42;
  const moteGeo = new THREE.BufferGeometry();
  const moteData = new Float32Array(moteCount * 3);
  const motePhase = new Float32Array(moteCount);
  for (let i = 0; i < moteCount; i++) {
    moteData[i * 3] = (Math.random() - 0.5) * 26;
    moteData[i * 3 + 1] = Math.random() * 5 - 2;
    moteData[i * 3 + 2] = -2 - Math.random() * 20;
    motePhase[i] = Math.random() * Math.PI * 2;
  }
  moteGeo.setAttribute("position", new THREE.BufferAttribute(moteData, 3));
  const moteMat = new THREE.PointsMaterial({
    size: 0.16, map: moteTexture(), transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  motes = new THREE.Points(moteGeo, moteMat);
  scene.add(motes);

  /* ---------- Sizing ---------- */
  function resize() {
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
  }
  resize();
  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  /* ---------- Pointer parallax (fine pointers only) ---------- */
  const isFinePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (isFinePointer && !prefersReducedMotion) {
    mount.addEventListener("pointermove", (e) => {
      const rect = mount.getBoundingClientRect();
      target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    });
  }

  /* ---------- Scroll parallax ---------- */
  const heroEl = mount.closest(".hero");
  function onScroll() {
    if (!heroEl) return;
    const rect = heroEl.getBoundingClientRect();
    scrollFactor = Math.min(Math.max(-rect.top / (rect.height || 1), 0), 1);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Render loop ---------- */
  function renderStaticFrame() {
    resize();
    renderer.render(scene, camera);
  }

  function animate() {
    if (!running) return;
    raf = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    pointer.x += (target.x - pointer.x) * 0.045;
    pointer.y += (target.y - pointer.y) * 0.045;

    const idleX = Math.sin(t * 0.06) * 0.35;
    const idleY = Math.cos(t * 0.05) * 0.12;

    camera.position.x = pointer.x * 0.9 + idleX;
    camera.position.y = 0.4 + pointer.y * -0.4 + idleY - scrollFactor * 0.8;
    camera.lookAt(0, -0.6 - scrollFactor * 0.3, -20);

    mistLayers.forEach(m => {
      const d = m.userData.drift;
      m.position.x = Math.sin(t * d.speed + d.offset) * d.range;
    });

    const positions = moteGeo.attributes.position;
    for (let i = 0; i < moteCount; i++) {
      const idx = i * 3;
      positions.array[idx + 1] += 0.0026;
      positions.array[idx] += Math.sin(t * 0.4 + motePhase[i]) * 0.0012;
      if (positions.array[idx + 1] > 3.2) positions.array[idx + 1] = -2.4;
    }
    positions.needsUpdate = true;

    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    clock.start();
    animate();
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  if (prefersReducedMotion) {
    renderStaticFrame();
  } else if ("IntersectionObserver" in window && heroEl) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => (entry.isIntersecting ? start() : stop()));
    }, { threshold: 0.05 });
    io.observe(heroEl);
  } else {
    start();
  }

  mount.classList.remove("loading");
})();
