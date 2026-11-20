/* ============================================================
   AVZERA — 3D studio scene
   Original procedural geometry, built to mirror the reference
   choreography: white room, plinth, physical props, gold dust,
   a cracked brain, and a scroll-driven camera.
   ============================================================ */

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

(() => {
  "use strict";

  const Q = new URLSearchParams(location.search);
  if (Q.has("nogl") || Q.get("gl") === "0" || Q.get("gl") === "off") return;
  const forceGL = Q.get("gl") !== "0" && Q.get("gl") !== "off" && !Q.has("nogl");
  const isNarrow = () => innerWidth < 820 || matchMedia("(pointer: coarse)").matches;

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const instant = Q.has("instant") || Q.has("skipintro");
  const forcedChapter =
    Q.has("noScroll") || Q.has("chapter")
      ? Math.max(0, Math.min(7, Number.parseInt(Q.get("chapter") || "0", 10) || 0))
      : null;

  const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = (t) => t * t * (3 - 2 * t);
  const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  const TAU = Math.PI * 2;

  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const rand = mulberry32(24042026);
  const brainState = {};

  function signalFallback() {
    try {
      document.documentElement.dispatchEvent(new CustomEvent("avzera:scene-fallback", { bubbles: true }));
    } catch (err) {
      /* the entry screen also has a timeout as a safety net */
    }
  }

  /* ---------------------------------------------------------- renderer */
  const canvas = document.getElementById("gl");
  if (!canvas) {
    signalFallback();
    return;
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance"
    });
  } catch (err) {
    signalFallback();
    return;
  }
  /* Pixel budget: never render more than ~2.9MP, and never above 1.35x. The
     ratio is fixed for the whole session — changing it mid-scroll reallocates
     every post-processing buffer and freezes the page for seconds. */
  const MAX_PIXELS = 2_900_000;
  let qualityScale = 1;
  function currentPixelRatio() {
    const area = Math.max(1, innerWidth * innerHeight);
    return clamp(Math.min(devicePixelRatio || 1, 1.35, Math.sqrt(MAX_PIXELS / area)), 0.7, 1.35) * qualityScale;
  }
  renderer.setPixelRatio(currentPixelRatio());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.82;
  renderer.info.autoReset = false;

  /* Decide the room once, from the real GPU, before anything is built.
     No-GPU/software rasterisers fall back everywhere (WebGL there is a
     slideshow). Weak integrated desktop GPUs (Intel HD/UHD) also get the DOM
     room. Phones are never judged by this list: a phone reporting Mali or
     Adreno can still carry the scene, and mobile emulation on a laptop would
     otherwise report the laptop's Intel GPU and lose the 3D preview.
     ?gl=force keeps WebGL on for testing on any device. */
  function gpuCannotCarryScene() {
    try {
      const ctx = renderer.getContext();
      const ext = ctx.getExtension("WEBGL_debug_renderer_info");
      const name = ext ? String(ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
      if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)) return true;
      return !isNarrow() && /intel.*\b(hd|uhd) graphics/i.test(name);
    } catch (err) {
      return false;
    }
  }
  if (!forceGL && gpuCannotCarryScene()) {
    renderer.dispose();
    canvas.style.display = "none";
    signalFallback();
    return;
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd7dade);
  scene.fog = new THREE.FogExp2(0xd7dade, 0.004);
  scene.environmentIntensity = 0.5;

  /* everything that dissolves when the camera pulls back for the overview */
  const shell = new THREE.Group();
  scene.add(shell);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.08, 160);
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  } catch (err) {
    /* the room still reads without an environment map */
  }

  scene.add(new THREE.HemisphereLight(0xffffff, 0xc9cdd2, 1.0));
  const keyLight = new THREE.DirectionalLight(0xfff4e4, 1.2);
  keyLight.position.set(6, 10, 8);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xe9f0ff, 0.65);
  fillLight.position.set(-7, 5, 5);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
  rimLight.position.set(0, 4, -10);
  scene.add(rimLight);

  const goldLight = new THREE.PointLight(0xffc46c, 1.2, 4.6, 2);
  goldLight.position.set(0.55, 1.45, 0);
  scene.add(goldLight);

  /* ---------------------------------------------------------- materials */
  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xdeddd9,
    roughness: 0.48,
    metalness: 0.02,
    clearcoat: 0.28,
    clearcoatRoughness: 0.38,
    envMapIntensity: 0.5
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0xbfc5cb,
    roughness: 0.96,
    metalness: 0.0
  });
  const darkMat = new THREE.MeshStandardMaterial({
    color: 0x2b2e32,
    roughness: 0.46,
    metalness: 0.34,
    envMapIntensity: 0.9
  });
  const blackMat = new THREE.MeshStandardMaterial({
    color: 0x101112,
    roughness: 0.34,
    metalness: 0.25
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd6a656,
    roughness: 0.23,
    metalness: 1,
    emissive: 0x5a3a10,
    emissiveIntensity: 0.42,
    envMapIntensity: 1.35
  });
  const roseMat = new THREE.MeshPhysicalMaterial({
    color: 0xc49a89,
    roughness: 0.33,
    metalness: 0.55,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2
  });
  const maroonMat = new THREE.MeshPhysicalMaterial({
    color: 0x3d1a21,
    roughness: 0.3,
    metalness: 0.55,
    clearcoat: 0.8,
    clearcoatRoughness: 0.18
  });
  const creamMat = new THREE.MeshPhysicalMaterial({
    color: 0xf7f1e4,
    roughness: 0.58,
    metalness: 0.02,
    clearcoat: 0.25
  });
  const goldGlowMat = new THREE.MeshBasicMaterial({
    color: 0xd0a45e,
    toneMapped: true
  });
  const lightStripMat = new THREE.MeshBasicMaterial({
    color: 0xf6f4ef,
    toneMapped: true
  });
  const goldLineMat = new THREE.MeshBasicMaterial({
    color: 0xffc978,
    transparent: true,
    opacity: 0.72,
    toneMapped: false,
    depthWrite: false
  });

  /* ---------------------------------------------------------- helpers */
  function canvasTexture(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    draw(ctx, w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return t;
  }

  function rr(c, x, y, w, h, r) {
    const q = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + q, y);
    c.arcTo(x + w, y, x + w, y + h, q);
    c.arcTo(x + w, y + h, x, y + h, q);
    c.arcTo(x, y + h, x, y, q);
    c.arcTo(x, y, x + w, y, q);
    c.closePath();
  }

  function glowTexture(inner = "rgba(255,222,164,0.95)", outer = "rgba(255,200,110,0)") {
    return canvasTexture(256, 256, (c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
      g.addColorStop(0, inner);
      g.addColorStop(0.34, "rgba(255,213,140,0.34)");
      g.addColorStop(1, outer);
      c.fillStyle = g;
      c.fillRect(0, 0, w, h);
    });
  }

  const softGlowMap = glowTexture();
  const shadowMap = canvasTexture(256, 256, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
    g.addColorStop(0, "rgba(0,0,0,0.78)");
    g.addColorStop(0.42, "rgba(0,0,0,0.34)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });

  function glowSprite(color = 0xffc978, opacity = 0.45, scale = 2.5) {
    const mat = new THREE.SpriteMaterial({
      map: softGlowMap,
      color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false
    });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(scale);
    return s;
  }

  function floorShadow(width, depth, opacity = 0.24) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(width, depth),
      new THREE.MeshBasicMaterial({
        map: shadowMap,
        transparent: true,
        opacity,
        depthWrite: false
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.006;
    return m;
  }

  /* ---------------------------------------------------------- display panels */
  function pinPath(c, x, y, s) {
    c.beginPath();
    c.moveTo(x, y + s * 1.05);
    c.bezierCurveTo(x - s * 0.46, y + s * 0.42, x - s * 0.62, y + s * 0.08, x - s * 0.62, y - s * 0.2);
    c.bezierCurveTo(x - s * 0.62, y - s * 0.66, x - s * 0.31, y - s * 0.92, x, y - s * 0.92);
    c.bezierCurveTo(x + s * 0.31, y - s * 0.92, x + s * 0.62, y - s * 0.66, x + s * 0.62, y - s * 0.2);
    c.bezierCurveTo(x + s * 0.62, y + s * 0.08, x + s * 0.46, y + s * 0.42, x, y + s * 1.05);
    c.closePath();
  }

  function makePanelTexture(index, label) {
    return canvasTexture(1024, 620, (c, w, h) => {
      const bg = c.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "#3a3e43");
      bg.addColorStop(0.48, "#2b2f33");
      bg.addColorStop(1, "#22262a");
      c.fillStyle = bg;
      c.fillRect(0, 0, w, h);

      const vig = c.createRadialGradient(w * 0.58, h * 0.45, 40, w * 0.5, h * 0.5, w * 0.72);
      vig.addColorStop(0, "rgba(255,255,255,.055)");
      vig.addColorStop(1, "rgba(0,0,0,.22)");
      c.fillStyle = vig;
      c.fillRect(0, 0, w, h);

      c.strokeStyle = "rgba(236,231,220,.045)";
      c.lineWidth = 1;
      for (let x = 64; x < w; x += 64) {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, h);
        c.stroke();
      }
      for (let y = 62; y < h; y += 62) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }

      c.fillStyle = "#d8be86";
      c.font = '600 16px "IBM Plex Mono", "Courier New", monospace';
      c.textAlign = "left";
      c.fillText(`0${index + 1} / ${label}`, 46, 60);
      c.textAlign = "right";
      c.fillStyle = "rgba(236,231,220,.52)";
      c.font = '500 13px "IBM Plex Mono", "Courier New", monospace';
      c.fillText("AVZERA / STUDIO", w - 46, 60);

      c.save();
      c.translate(w / 2, h / 2 + 20);
      c.strokeStyle = "rgba(224,178,99,.82)";
      c.fillStyle = "rgba(224,178,99,.82)";
      c.lineWidth = 2;
      c.shadowColor = "rgba(214,166,86,.65)";
      c.shadowBlur = 14;

      if (index === 0) {
        c.beginPath();
        c.ellipse(0, 0, 214, 168, 0, 0, TAU);
        c.stroke();
        c.beginPath();
        c.moveTo(0, -164);
        c.lineTo(0, 164);
        c.stroke();
        for (let i = 0; i < 9; i++) {
          const sx = -190 + i * 47;
          c.beginPath();
          c.moveTo(sx, -80);
          c.bezierCurveTo(sx + 38, -40, sx - 38, 24, sx + 18, 82);
          c.stroke();
        }
      } else if (index === 1) {
        c.strokeRect(-282, -164, 564, 328);
        c.beginPath();
        c.moveTo(-282, -118);
        c.lineTo(282, -118);
        c.stroke();
        c.fillStyle = "rgba(224,178,99,.9)";
        c.font = '500 17px "IBM Plex Mono", monospace';
        c.textAlign = "left";
        c.fillText("SMILE CRAFT", -250, -136);
        c.strokeStyle = "rgba(224,178,99,.6)";
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(-238, -34);
        c.lineTo(-56, -34);
        c.moveTo(-238, 6);
        c.lineTo(-104, 6);
        c.moveTo(-238, 46);
        c.lineTo(-150, 46);
        c.stroke();
        c.strokeRect(-238, 82, 138, 46);
        c.beginPath();
        c.arc(148, 18, 88, 0, TAU);
        c.stroke();
        for (let i = 0; i < 7; i++) {
          const a = -1.2 + i * 0.42;
          c.beginPath();
          c.moveTo(148 + Math.cos(a) * 87, 18 + Math.sin(a) * 87);
          c.lineTo(148 + Math.cos(a + 0.38) * 45, 18 + Math.sin(a + 0.38) * 45);
          c.stroke();
        }
      } else if (index === 2) {
        for (let x = -300; x <= 300; x += 60) {
          c.beginPath();
          c.moveTo(x, -180);
          c.lineTo(x, 180);
          c.stroke();
        }
        for (let y = -150; y <= 150; y += 60) {
          c.beginPath();
          c.moveTo(-320, y);
          c.lineTo(320, y);
          c.stroke();
        }
        pinPath(c, 0, -8, 150);
        c.stroke();
        c.beginPath();
        c.arc(0, -40, 42, 0, TAU);
        c.stroke();
        c.lineWidth = 1.5;
        for (let i = 1; i <= 3; i++) {
          c.beginPath();
          c.arc(0, -8, 110 + i * 68, 0.2, Math.PI * 1.15);
          c.stroke();
        }
      } else if (index === 3) {
        c.strokeRect(-60, -60, 120, 120);
        c.strokeRect(-24, -24, 48, 48);
        const ends = [
          [-290, -110], [-250, 132], [280, -120], [254, 122], [-300, 12], [300, 8]
        ];
        ends.forEach(([ex, ey], i) => {
          c.beginPath();
          c.moveTo(i < 2 ? -60 : 60, ey * 0.34);
          c.lineTo(ex * 0.68, ey * 0.62);
          c.lineTo(ex, ey);
          c.stroke();
          c.beginPath();
          c.arc(ex, ey, 7, 0, TAU);
          c.fill();
        });
        c.fillStyle = "rgba(224,178,99,.9)";
        c.font = '500 13px "IBM Plex Mono", monospace';
        c.textAlign = "center";
        c.fillText("NIGHT SHIFT", 0, 112);
      } else if (index === 4) {
        for (let i = 0; i < 3; i++) {
          const x = -210 + i * 42;
          const y = -100 + i * 24;
          c.strokeRect(x, y, 300, 210);
          c.beginPath();
          c.moveTo(x, y + 30);
          c.lineTo(x + 300, y + 30);
          c.stroke();
          c.beginPath();
          c.arc(x + 18, y + 15, 4, 0, TAU);
          c.fill();
        }
      } else if (index === 5) {
        for (let i = 0; i < 5; i++) {
          const x = -260 + i * 130;
          const bh = 54 + i * 34;
          c.strokeRect(x - 42, 150 - bh, 84, bh);
          c.beginPath();
          c.arc(x, 128 - bh, 5, 0, TAU);
          c.fill();
          if (i < 4) {
            c.beginPath();
            c.moveTo(x + 42, 138 - bh);
            c.lineTo(x + 88, 108 - (i + 1) * 34);
            c.stroke();
          }
        }
        c.beginPath();
        c.moveTo(-302, 154);
        c.lineTo(302, 154);
        c.stroke();
      } else if (index === 6) {
        pinPath(c, -8, -4, 150);
        c.stroke();
        c.beginPath();
        c.arc(-8, -32, 38, 0, TAU);
        c.stroke();
        for (let i = 1; i <= 3; i++) {
          c.beginPath();
          c.arc(-8, -4, 96 + i * 62, 0.15, Math.PI * 1.2);
          c.stroke();
        }
        c.beginPath();
        c.moveTo(-212, 156);
        c.bezierCurveTo(-110, 72, 86, 176, 242, 54);
        c.stroke();
        c.beginPath();
        c.arc(242, 54, 8, 0, TAU);
        c.fill();
      } else {
        for (let i = 1; i <= 4; i++) {
          c.beginPath();
          c.arc(0, 0, 52 + i * 58, 0, TAU);
          c.stroke();
        }
        c.beginPath();
        c.moveTo(-74, 64);
        c.lineTo(78, -64);
        c.lineTo(38, 78);
        c.lineTo(10, 16);
        c.closePath();
        c.stroke();
      }
      c.restore();

      c.strokeStyle = "rgba(236,231,220,.12)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(46, h - 48);
      c.lineTo(w - 46, h - 48);
      c.stroke();
      c.fillStyle = "rgba(236,231,220,.33)";
      c.font = '500 12px "IBM Plex Mono", "Courier New", monospace';
      c.textAlign = "left";
      c.fillText("AVZERA DIGITAL SOLUTIONS", 46, h - 24);
      c.textAlign = "right";
      c.fillText("BUILT BEFORE DAWN", w - 46, h - 24);
    });
  }

  /* ---------------------------------------------------------- plinth + panel */
  function addPlinth(parent, radius = 1.02) {
    const g = new THREE.Group();

    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.035, 0.82, 72), whiteMat);
    body.position.y = 0.41;
    g.add(body);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.005, radius * 1.005, 0.018, 72), whiteMat);
    cap.position.y = 0.828;
    g.add(cap);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.0, 0.009, 10, 120), goldGlowMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.842;
    g.add(ring);

    const ringGlow = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 1.0, 0.04, 10, 100),
      new THREE.MeshBasicMaterial({
        color: 0xffcd85,
        transparent: true,
        opacity: 0.035,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: true
      })
    );
    ringGlow.rotation.x = Math.PI / 2;
    ringGlow.position.y = 0.842;
    g.add(ringGlow);

    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.15, 0.006, 8, 120), goldLineMat);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.008;
    g.add(baseRing);

    const shadow = floorShadow(radius * 4.6, radius * 3.4, 0.22);
    g.add(shadow);
    parent.add(g);
    return g;
  }

  function addPanel(parent, tex) {
    const g = new THREE.Group();
    g.position.set(-2.5, 0, -1.62);
    g.rotation.y = 0.3;

    const frame = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.95, 0.09, 3, 0.028), darkMat.clone());
    frame.position.y = 1.68;
    g.add(frame);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(1.48, 0.84),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    screen.position.set(0, 1.68, 0.051);
    g.add(screen);

    const standMat = new THREE.MeshStandardMaterial({
      color: 0xd7d9dc,
      roughness: 0.38,
      metalness: 0.55
    });
    const legGeo = new THREE.BoxGeometry(0.04, 1.02, 0.04);
    [-0.65, 0.65].forEach((x) => {
      const leg = new THREE.Mesh(legGeo, standMat);
      leg.position.set(x, 0.51, -0.03);
      g.add(leg);
    });
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.04, 0.055), standMat);
    foot.position.set(0, 0.028, -0.03);
    g.add(foot);
    const shelf = new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.055, 0.4, 3, 0.018), whiteMat.clone());
    shelf.position.set(0, 1.02, 0.02);
    g.add(shelf);

    const shadow = floorShadow(2.5, 1.0, 0.12);
    shadow.position.z = -0.2;
    g.add(shadow);

    parent.add(g);
    return g;
  }

  /* ---------------------------------------------------------- the room */
  const WALL_X = 8.55;
  const BAY = 7.4;
  const BAYS = 18;

  function buildRoom() {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(340, 340),
      new THREE.MeshPhysicalMaterial({
        color: 0xb8bcc2,
        roughness: 0.42,
        metalness: 0.06,
        envMapIntensity: 0.4,
        clearcoat: 0.14,
        clearcoatRoughness: 0.34
      })
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const grid = new THREE.GridHelper(320, 128, 0x9fa4aa, 0xbdc1c6);
    grid.position.y = 0.012;
    grid.material.transparent = true;
    grid.material.opacity = 0.2;
    grid.material.depthWrite = false;
    scene.add(grid);

    const seamMat = new THREE.MeshBasicMaterial({
      color: 0x868d95,
      transparent: true,
      opacity: 0.72
    });

    for (let b = 0; b < BAYS; b++) {
      const z = 12 - b * BAY;
      for (const side of [-1, 1]) {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8, BAY - 0.06), wallMat);
        wall.position.set(side * (WALL_X + 0.15), 4, z - BAY / 2);
        shell.add(wall);

        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.065, 5.3), lightStripMat);
        strip.position.set(side * (WALL_X - 0.015), 6.15, z - BAY / 2);
        shell.add(strip);

        const stripHalo = new THREE.Mesh(
          new THREE.PlaneGeometry(5.3, 0.44),
          new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.2,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false
          })
        );
        stripHalo.position.set(side * (WALL_X - 0.045), 6.15, z - BAY / 2);
        stripHalo.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        shell.add(stripHalo);

        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 7.9, 0.09), seamMat);
        seam.position.set(side * (WALL_X - 0.03), 4, z);
        shell.add(seam);

        const base = new THREE.Mesh(
          new THREE.BoxGeometry(0.42, 0.16, BAY - 0.08),
          new THREE.MeshStandardMaterial({ color: 0x8f969e, roughness: 0.62, metalness: 0.18 })
        );
        base.position.set(side * (WALL_X - 0.02), 0.08, z - BAY / 2);
        shell.add(base);
      }
    }

    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(20, BAYS * BAY + 8),
      new THREE.MeshStandardMaterial({ color: 0xf0f1f3, roughness: 1, metalness: 0 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 8.02, 12 - (BAYS * BAY) / 2);
    shell.add(ceiling);

    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    for (let b = 0; b < BAYS; b++) {
      const z = 12 - b * BAY - BAY / 2;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, BAY - 1.2), stripMat);
      strip.position.set(0, 7.96, z);
      shell.add(strip);
    }
  }

  /* ---------------------------------------------------------- bays */
  function buildBays() {
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0xa8adb2,
      roughness: 0.98,
      metalness: 0
    });
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0xbfc4c9,
      roughness: 0.7,
      metalness: 0.15
    });

    for (let i = 0; i <= 7; i++) {
      const z = -STATION_GAP * i - STATION_GAP / 2;
      const div = new THREE.Group();

      const wall = new THREE.Mesh(new THREE.BoxGeometry(12.5, 6.6, 0.2), wallMat);
      wall.position.set(2.25, 3.3, z);
      div.add(wall);

      const inset = new THREE.Mesh(new THREE.PlaneGeometry(7.1, 3.5), panelMat);
      inset.position.set(2.55, 3.25, z + 0.105);
      div.add(inset);

      const strip = new THREE.Mesh(new THREE.BoxGeometry(9.4, 0.06, 0.035), lightStripMat);
      strip.position.set(2.3, 5.85, z + 0.12);
      div.add(strip);

      const halo = new THREE.Mesh(
        new THREE.PlaneGeometry(9.4, 0.5),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.13,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: true
        })
      );
      halo.position.set(2.3, 5.85, z + 0.12);
      div.add(halo);

      const base = new THREE.Mesh(new THREE.BoxGeometry(12.5, 0.13, 0.3), baseMat);
      base.position.set(2.25, 0.065, z + 0.03);
      div.add(base);

      // each divider owns its materials so it can dissolve while the camera
      // travels through it, then return as the backdrop of its own station
      div.traverse((o) => {
        if (!o.isMesh) return;
        o.material = o.material.clone();
        o.userData.bayDivider = true;
        o.userData.baseOpacity = o.material.opacity;
        o.userData.baseDepthWrite = o.material.depthWrite;
        o.userData.baseTransparent = o.material.transparent;
      });
      bayDividers.push(div);
      shell.add(div);
    }
  }

  /* ---------------------------------------------------------- ambient dust */
  const dustUniforms = {
    uTime: { value: 0 },
    uScale: { value: 900 }
  };
  let corridorDust = null;

  function buildDust() {
    const N = 3200;
    const pos = new Float32Array(N * 3);
    const size = new Float32Array(N);
    const phase = new Float32Array(N);
    const drift = new Float32Array(N * 3);

    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rand() - 0.5) * 15;
      pos[i * 3 + 1] = 0.25 + rand() * 6.2;
      pos[i * 3 + 2] = 13 - rand() * 140;
      size[i] = 0.007 + Math.pow(rand(), 2.2) * 0.062;
      phase[i] = rand() * TAU;
      drift[i * 3] = 0.12 + rand() * 0.7;
      drift[i * 3 + 1] = 0.08 + rand() * 0.45;
      drift[i * 3 + 2] = 0.12 + rand() * 0.7;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    geo.setAttribute("aDrift", new THREE.BufferAttribute(drift, 3));

    const mat = new THREE.ShaderMaterial({
      uniforms: dustUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        attribute float aSize;
        attribute float aPhase;
        attribute vec3 aDrift;
        uniform float uTime;
        uniform float uScale;
        varying float vAlpha;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.17 + aPhase * 1.7) * aDrift.x;
          p.y += sin(uTime * 0.13 + aPhase * 2.1) * aDrift.y;
          p.z += cos(uTime * 0.15 + aPhase) * aDrift.z;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp(aSize * uScale / max(0.4, -mv.z), 1.0, 52.0);
          vAlpha = 0.32 + 0.38 * (0.5 + 0.5 * sin(uTime * 0.6 + aPhase * 3.1));
        }
      `,
      fragmentShader: `
        varying float vAlpha;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          float a = smoothstep(1.0, 0.0, d);
          a *= a;
          gl_FragColor = vec4(0.94, 0.74, 0.42, a * vAlpha * 0.62);
        }
      `
    });

    corridorDust = new THREE.Points(geo, mat);
    corridorDust.frustumCulled = false;
    scene.add(corridorDust);
  }

  /* foreground bokeh: large, soft, barely-there gold discs */
  function buildBokeh() {
    const N = 240;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rand() - 0.5) * 16;
      pos[i * 3 + 1] = 0.3 + rand() * 5.8;
      pos[i * 3 + 2] = 10 - rand() * 135;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffc978,
      map: softGlowMap,
      size: 0.14,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: true
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
  }

  /* ---------------------------------------------------------- screen artwork */
  function makeLaptopScreen() {
    return canvasTexture(1400, 820, (c, w, h) => {
      c.fillStyle = "#f8f2e5";
      c.fillRect(0, 0, w, h);
      const warm = c.createRadialGradient(1120, 140, 20, 1120, 300, 620);
      warm.addColorStop(0, "rgba(255,255,255,.82)");
      warm.addColorStop(1, "rgba(255,255,255,0)");
      c.fillStyle = warm;
      c.fillRect(0, 0, w, h);

      c.fillStyle = "#d6a656";
      rr(c, 70, 56, 42, 42, 10);
      c.fill();
      c.fillStyle = "#fff8ea";
      c.font = '600 26px "IBM Plex Mono", monospace';
      c.textAlign = "center";
      c.fillText("Y", 91, 86);

      c.fillStyle = "#1a1814";
      c.textAlign = "left";
      c.font = '500 25px "IBM Plex Mono", monospace';
      c.fillText("YOUR", 126, 85);
      c.fillStyle = "#b4863b";
      c.fillText("BRAND", 208, 85);

      c.fillStyle = "#625f58";
      c.font = '500 15px "IBM Plex Mono", monospace';
      c.fillText("SERVICES", 655, 80);
      c.fillText("ABOUT", 810, 80);
      c.fillText("CONTACT", 912, 80);

      c.strokeStyle = "#c99b4d";
      c.lineWidth = 1.4;
      rr(c, 1030, 55, 158, 44, 22);
      c.stroke();
      c.fillStyle = "#94641e";
      c.font = '500 14px "IBM Plex Mono", monospace';
      c.textAlign = "center";
      c.fillText("BOOK NOW", 1109, 82);

      c.fillStyle = "#9a7839";
      c.textAlign = "left";
      c.font = '500 15px "IBM Plex Mono", monospace';
      c.fillText("SAMPLE SITE  ·  BUILT BY AVZERA", 72, 210);

      c.fillStyle = "#171511";
      c.font = '400 78px "Fraunces", Georgia, serif';
      c.fillText("Found first.", 66, 300);
      c.fillStyle = "#a87324";
      c.font = 'italic 400 72px "Fraunces", Georgia, serif';
      c.fillText("Booked in 30 seconds.", 66, 382);

      c.fillStyle = "#5e5a52";
      c.font = '400 23px "IBM Plex Mono", monospace';
      c.fillText("Mobile-first layout, one-tap WhatsApp,", 70, 448);
      c.fillText("and prices people can actually find.", 70, 482);

      const btn = c.createLinearGradient(68, 518, 340, 574);
      btn.addColorStop(0, "#f3d28c");
      btn.addColorStop(1, "#d1a14f");
      c.fillStyle = btn;
      rr(c, 68, 520, 286, 54, 27);
      c.fill();
      c.fillStyle = "#241a08";
      c.font = '600 16px "IBM Plex Mono", monospace';
      c.fillText("BOOK AN APPOINTMENT  →", 92, 553);

      c.fillStyle = "#6c675e";
      c.font = '400 15px "IBM Plex Mono", monospace';
      c.fillText("SAMPLE LAYOUT  ·  NO INVENTED REVIEWS", 70, 636);

      const orb = c.createRadialGradient(1090, 320, 8, 1110, 365, 245);
      orb.addColorStop(0, "#4b4640");
      orb.addColorStop(0.45, "#211f1c");
      orb.addColorStop(1, "#070707");
      c.fillStyle = orb;
      c.beginPath();
      c.arc(1110, 360, 208, 0, TAU);
      c.fill();

      c.strokeStyle = "#d6a656";
      c.lineWidth = 2.4;
      c.shadowColor = "rgba(214,166,86,.7)";
      c.shadowBlur = 12;
      for (let i = 0; i < 8; i++) {
        const a = i * 0.79;
        c.beginPath();
        c.moveTo(1110 + Math.cos(a) * 195, 360 + Math.sin(a) * 195);
        c.lineTo(1110 + Math.cos(a + 0.5) * 95, 360 + Math.sin(a + 0.5) * 95);
        c.lineTo(1110 + Math.cos(a + 0.2) * 28, 360 + Math.sin(a + 0.2) * 28);
        c.stroke();
      }
      c.shadowBlur = 0;

      c.fillStyle = "rgba(28,24,18,.14)";
      c.beginPath();
      c.ellipse(1110, 592, 138, 20, 0, 0, TAU);
      c.fill();

      c.fillStyle = "#fbf6eb";
      c.strokeStyle = "rgba(76,58,26,.16)";
      c.lineWidth = 1;
      rr(c, 882, 620, 456, 128, 18);
      c.fill();
      c.stroke();
      c.fillStyle = "#a4772e";
      c.font = '600 13px "IBM Plex Mono", monospace';
      c.fillText("NEXT AVAILABLE", 908, 654);
      c.fillStyle = "#171511";
      c.font = '400 30px Georgia, serif';
      c.fillText("Today · 6:30 PM", 908, 692);
      c.fillStyle = "#6c675e";
      c.font = '400 14px "IBM Plex Mono", monospace';
      c.fillText("Sample slot · your services here", 908, 722);
    });
  }

  function makePhoneScreen() {
    return canvasTexture(620, 1320, (c, w, h) => {
      c.fillStyle = "#ece4d5";
      c.fillRect(0, 0, w, h);

      c.fillStyle = "#142c22";
      c.fillRect(0, 0, w, 64);
      c.fillStyle = "#f8f2e5";
      c.font = '600 22px "IBM Plex Mono", monospace';
      c.textAlign = "left";
      c.fillText("9:41", 34, 42);
      c.textAlign = "right";
      c.fillText("▮▮▮", 586, 42);

      c.fillStyle = "#1f4a39";
      c.fillRect(0, 64, w, 146);
      c.fillStyle = "#d6a656";
      c.beginPath();
      c.arc(58, 137, 29, 0, TAU);
      c.fill();
      c.fillStyle = "#142c22";
      c.font = '600 28px Georgia, serif';
      c.textAlign = "center";
      c.fillText("A", 58, 147);
      c.textAlign = "left";
      c.fillStyle = "#f8f2e5";
      c.font = '600 25px Georgia, serif';
      c.fillText("AVZERA · AI reception", 102, 126);
      c.fillStyle = "rgba(248,242,229,.66)";
      c.font = '400 14px "IBM Plex Mono", monospace';
      c.fillText("online · replies in seconds", 102, 154);

      c.fillStyle = "rgba(248,242,229,.16)";
      rr(c, 428, 100, 156, 38, 19);
      c.fill();
      c.fillStyle = "#f0cf8c";
      c.font = '600 12px "IBM Plex Mono", monospace';
      c.textAlign = "center";
      c.fillText("SAMPLE FLOW", 506, 124);

      c.fillStyle = "rgba(31,74,57,.1)";
      rr(c, 228, 234, 164, 34, 17);
      c.fill();
      c.fillStyle = "#6f6a61";
      c.font = '500 13px "IBM Plex Mono", monospace';
      c.textAlign = "center";
      c.fillText("TODAY", 310, 256);

      c.fillStyle = "#fffdf8";
      rr(c, 34, 294, 402, 104, 22);
      c.fill();
      c.fillStyle = "#1c1915";
      c.font = '400 22px "IBM Plex Mono", monospace';
      c.textAlign = "left";
      c.fillText("Hi! Do you have a slot", 58, 334);
      c.fillText("tomorrow?", 58, 364);
      c.fillStyle = "#8c867c";
      c.font = '400 12px "IBM Plex Mono", monospace';
      c.textAlign = "right";
      c.fillText("10:42 PM", 412, 384);

      c.fillStyle = "#e8cf9a";
      rr(c, 184, 424, 402, 136, 22);
      c.fill();
      c.fillStyle = "#241c0d";
      c.font = '400 22px "IBM Plex Mono", monospace';
      c.textAlign = "left";
      c.fillText("Yes — 11:30 AM or 4 PM.", 208, 466);
      c.fillText("Which works for you?", 208, 496);
      c.fillStyle = "rgba(36,28,13,.62)";
      c.font = '400 12px "IBM Plex Mono", monospace';
      c.textAlign = "right";
      c.fillText("10:42 PM", 562, 536);

      c.fillStyle = "#fffdf8";
      rr(c, 34, 586, 240, 80, 22);
      c.fill();
      c.fillStyle = "#1c1915";
      c.font = '400 22px "IBM Plex Mono", monospace';
      c.textAlign = "left";
      c.fillText("4 PM please.", 58, 634);

      c.fillStyle = "#e8cf9a";
      rr(c, 100, 692, 486, 164, 22);
      c.fill();
      c.fillStyle = "#241c0d";
      c.font = '400 21px "IBM Plex Mono", monospace';
      c.textAlign = "left";
      c.fillText("Booked. I've sent the address", 124, 734);
      c.fillText("and price list. Vikas will", 124, 764);
      c.fillText("confirm shortly.", 124, 794);

      c.fillStyle = "#fffdf8";
      rr(c, 34, 892, 552, 132, 22);
      c.fill();
      c.fillStyle = "#a4772e";
      c.font = '600 13px "IBM Plex Mono", monospace';
      c.textAlign = "left";
      c.fillText("NEW ENQUIRY · WHATSAPP", 60, 934);
      c.fillStyle = "#1c1915";
      c.font = '400 24px Georgia, serif';
      c.fillText("Answered, qualified and handed", 60, 974);
      c.fillText("to the founder with context.", 60, 1006);

      c.fillStyle = "#fffdf8";
      rr(c, 34, 1170, 552, 74, 24);
      c.fill();
      c.fillStyle = "#8c867c";
      c.font = '400 18px "IBM Plex Mono", monospace';
      c.textAlign = "left";
      c.fillText("Message", 64, 1214);
      c.fillStyle = "#1f4a39";
      c.beginPath();
      c.arc(536, 1207, 23, 0, TAU);
      c.fill();
      c.fillStyle = "#f8f2e5";
      c.font = '600 20px "IBM Plex Mono", monospace';
      c.textAlign = "center";
      c.fillText("→", 536, 1215);

      c.fillStyle = "#111";
      rr(c, 224, 1296, 172, 8, 4);
      c.fill();
    });
  }

  function makeProfileCard() {
    return canvasTexture(900, 640, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.shadowColor = "rgba(34,28,18,.22)";
      c.shadowBlur = 34;
      c.shadowOffsetY = 14;
      c.fillStyle = "#fbf6ea";
      rr(c, 12, 12, w - 24, h - 24, 30);
      c.fill();
      c.shadowColor = "transparent";

      c.save();
      rr(c, 12, 12, 322, h - 24, 30);
      c.clip();
      c.fillStyle = "#e9e2d2";
      c.fillRect(12, 12, 322, h - 24);
      c.strokeStyle = "rgba(154,120,60,.2)";
      c.lineWidth = 1;
      for (let x = 12; x < 340; x += 34) {
        c.beginPath();
        c.moveTo(x, 12);
        c.lineTo(x, h - 12);
        c.stroke();
      }
      for (let y = 12; y < h - 12; y += 34) {
        c.beginPath();
        c.moveTo(12, y);
        c.lineTo(334, y);
        c.stroke();
      }
      c.strokeStyle = "rgba(154,120,60,.3)";
      c.lineWidth = 8;
      c.beginPath();
      c.moveTo(-10, 480);
      c.bezierCurveTo(90, 380, 178, 540, 340, 360);
      c.stroke();
      c.restore();

      c.fillStyle = "#ce9e4c";
      c.beginPath();
      c.arc(168, 278, 70, 0, TAU);
      c.fill();
      c.fillStyle = "#fff8ea";
      c.beginPath();
      c.arc(168, 278, 30, 0, TAU);
      c.fill();
      c.fillStyle = "#b47c29";
      c.beginPath();
      c.arc(168, 278, 14, 0, TAU);
      c.fill();
      c.fillStyle = "rgba(44,32,12,.18)";
      c.beginPath();
      c.ellipse(168, 372, 54, 12, 0, 0, TAU);
      c.fill();

      c.textAlign = "left";
      c.fillStyle = "#a4772e";
      c.font = '600 14px "IBM Plex Mono", monospace';
      c.fillText("GOOGLE BUSINESS PROFILE  ·  PREVIEW", 376, 82);

      c.fillStyle = "#161310";
      c.font = '400 48px Georgia, serif';
      c.fillText("Your Business", 374, 142);

      c.fillStyle = "#a4772e";
      c.font = '600 14px "IBM Plex Mono", monospace';
      c.fillText("PROFILE PREVIEW", 376, 186);
      c.fillStyle = "#4f4a42";
      c.font = '500 16px "IBM Plex Mono", monospace';
      c.fillText("sample, not a listing", 536, 184);

      c.fillStyle = "#2e7d4f";
      c.beginPath();
      c.arc(386, 230, 5, 0, TAU);
      c.fill();
      c.fillStyle = "#3f3a32";
      c.font = '400 16px "IBM Plex Mono", monospace';
      c.fillText("Hours complete  ·  photos fresh", 402, 236);
      c.fillStyle = "#7a746a";
      c.fillText("Category  ·  Services  ·  Reviews answered", 376, 270);

      c.strokeStyle = "rgba(142,104,44,.18)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(376, 300);
      c.lineTo(854, 300);
      c.stroke();

      const actions = ["Call", "Directions", "Website"];
      actions.forEach((label, i) => {
        const x = 376 + i * 160;
        c.strokeStyle = "#c69a52";
        c.lineWidth = 1.5;
        rr(c, x, 326, 146, 50, 25);
        c.stroke();
        c.fillStyle = "#8a5d18";
        c.font = '600 13px "IBM Plex Mono", monospace';
        c.textAlign = "center";
        c.fillText(label.toUpperCase(), x + 73, 357);
      });

      c.fillStyle = "#a4772e";
      c.font = '600 13px "IBM Plex Mono", monospace';
      c.textAlign = "left";
      c.fillText("PROFILE CHECK  →", 376, 438);
      c.fillStyle = "#7a746a";
      c.font = '400 13px "IBM Plex Mono", monospace';
      c.fillText("Categories · hours · photos · review replies", 376, 470);

      c.fillStyle = "rgba(28,24,18,.1)";
      c.beginPath();
      c.ellipse(168, 575, 104, 14, 0, 0, TAU);
      c.fill();

      c.fillStyle = "#221f1a";
      c.font = '500 11px "IBM Plex Mono", monospace';
      c.textAlign = "right";
      c.fillText("AVZERA / PROFILE SNAPSHOT", 854, 596);
    });
  }

  function makeAgentCard(kicker, lines, footer) {
    return canvasTexture(780, 360, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.shadowColor = "rgba(38,30,18,.2)";
      c.shadowBlur = 24;
      c.shadowOffsetY = 10;
      c.fillStyle = "rgba(252,247,237,.95)";
      rr(c, 22, 22, w - 44, h - 44, 24);
      c.fill();
      c.shadowColor = "transparent";

      c.fillStyle = "#d6a656";
      c.beginPath();
      c.arc(62, 66, 7, 0, TAU);
      c.fill();
      c.fillStyle = "#a4772e";
      c.font = '600 14px "IBM Plex Mono", monospace';
      c.textAlign = "left";
      c.fillText(kicker, 84, 72);

      c.fillStyle = "#191612";
      c.font = '400 31px Georgia, serif';
      lines.forEach((line, i) => c.fillText(line, 58, 132 + i * 40));

      c.fillStyle = "#7b7468";
      c.font = '400 14px "IBM Plex Mono", monospace';
      c.fillText(footer, 58, h - 48);
    });
  }

  function makeProcessCard(number, title, body) {
    return canvasTexture(500, 960, (c, w, h) => {
      c.fillStyle = "#f8f2e5";
      rr(c, 0, 0, w, h, 26);
      c.fill();
      c.fillStyle = "#eed9ae";
      c.font = '400 150px Georgia, serif';
      c.textAlign = "left";
      c.fillText(number, 42, 176);
      c.strokeStyle = "#c99b4d";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(42, 220);
      c.lineTo(458, 220);
      c.stroke();
      c.fillStyle = "#171511";
      c.font = '400 54px Georgia, serif';
      c.fillText(title, 42, 306);
      c.fillStyle = "#6f6a61";
      c.font = '400 22px "IBM Plex Mono", monospace';
      const words = body.split(" ");
      let line = "";
      let yy = 366;
      words.forEach((word) => {
        const test = line ? line + " " + word : word;
        if (c.measureText(test).width > 402) {
          c.fillText(line, 42, yy);
          yy += 34;
          line = word;
        } else {
          line = test;
        }
      });
      c.fillText(line, 42, yy);
      c.fillStyle = "#a4772e";
      c.font = '600 14px "IBM Plex Mono", monospace';
      c.fillText("AVZERA", 42, h - 54);
    });
  }

  function makeVisitCard() {
    return canvasTexture(920, 640, (c, w, h) => {
      c.clearRect(0, 0, w, h);
      c.shadowColor = "rgba(34,28,18,.22)";
      c.shadowBlur = 30;
      c.shadowOffsetY = 12;
      c.fillStyle = "#fbf6ea";
      rr(c, 10, 10, w - 20, h - 20, 30);
      c.fill();
      c.shadowColor = "transparent";
      c.fillStyle = "#a4772e";
      c.font = '600 14px "IBM Plex Mono", monospace';
      c.textAlign = "left";
      c.fillText("FOUNDER-LED  ·  PAN-INDIA", 58, 74);
      c.fillStyle = "#161310";
      c.font = '400 56px Georgia, serif';
      c.fillText("Built in India.", 54, 154);
      c.fillStyle = "#a87324";
      c.font = 'italic 400 56px Georgia, serif';
      c.fillText("Always reachable.", 54, 218);
      c.strokeStyle = "rgba(142,104,44,.2)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(58, 262);
      c.lineTo(860, 262);
      c.stroke();

      const rows = [
        ["WA", "WhatsApp +91 78983 32744"],
        ["EN", "English  ·  हिन्दी"],
        ["24", "Reply within 24 hours"]
      ];
      rows.forEach((row, i) => {
        const y = 316 + i * 78;
        c.fillStyle = "#f0dfbd";
        rr(c, 58, y - 24, 44, 44, 13);
        c.fill();
        c.fillStyle = "#8a5d18";
        c.font = '600 14px "IBM Plex Mono", monospace';
        c.textAlign = "center";
        c.fillText(row[0], 80, y + 4);
        c.fillStyle = "#2a2620";
        c.font = '500 20px "IBM Plex Mono", monospace';
        c.textAlign = "left";
        c.fillText(row[1], 124, y + 4);
      });

      c.fillStyle = "#171511";
      rr(c, 58, 552, 300, 54, 27);
      c.fill();
      c.fillStyle = "#f8e9c6";
      c.font = '600 14px "IBM Plex Mono", monospace';
      c.textAlign = "center";
      c.fillText("MESSAGE THE FOUNDER  →", 208, 585);

      c.fillStyle = "rgba(28,24,18,.12)";
      c.beginPath();
      c.arc(758, 486, 82, 0, TAU);
      c.fill();
      c.fillStyle = "#25d366";
      c.beginPath();
      c.arc(758, 486, 72, 0, TAU);
      c.fill();
      c.strokeStyle = "#fff";
      c.lineWidth = 6;
      c.beginPath();
      c.arc(758, 486, 38, 0, TAU);
      c.stroke();
      c.fillStyle = "#fff";
      c.font = '600 34px "IBM Plex Mono", monospace';
      c.textAlign = "center";
      c.fillText("WA", 758, 498);
    });
  }

  function makeWorkTexture(title, url, src, tag = "LIVE WORK") {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 720;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    function draw(image) {
      const c = canvas.getContext("2d");
      c.clearRect(0, 0, 1000, 720);
      c.fillStyle = "#f8f2e5";
      c.fillRect(0, 0, 1000, 720);

      c.fillStyle = "#282b2e";
      c.fillRect(0, 0, 1000, 70);
      ["#d76f63", "#d8b05d", "#79b37a"].forEach((col, i) => {
        c.fillStyle = col;
        c.beginPath();
        c.arc(34 + i * 24, 35, 7, 0, TAU);
        c.fill();
      });
      c.fillStyle = "#d9d2c4";
      c.font = '500 15px "IBM Plex Mono", monospace';
      c.textAlign = "left";
      c.fillText(url, 120, 41);
      c.strokeStyle = "rgba(236,231,220,.28)";
      c.lineWidth = 1;
      rr(c, 900, 20, 72, 30, 8);
      c.stroke();

      if (image) {
        const ratio = Math.max(1000 / image.width, 590 / image.height);
        const iw = image.width * ratio;
        const ih = image.height * ratio;
        c.drawImage(image, (1000 - iw) / 2, 70 + (590 - ih) / 2, iw, ih);
      } else {
        const g = c.createLinearGradient(0, 70, 1000, 660);
        g.addColorStop(0, "#f3ecdd");
        g.addColorStop(1, "#e4dbc8");
        c.fillStyle = g;
        c.fillRect(0, 70, 1000, 590);
        c.strokeStyle = "rgba(177,129,48,.45)";
        c.lineWidth = 2;
        for (let i = 0; i < 6; i++) {
          c.strokeRect(84 + i * 22, 154 + i * 18, 832 - i * 44, 420 - i * 36);
        }
        c.fillStyle = "#b18130";
        c.font = '500 17px "IBM Plex Mono", monospace';
        c.textAlign = "center";
        c.fillText(tag, 500, 400);
      }

      c.fillStyle = "#fbf6ea";
      c.fillRect(0, 660, 1000, 60);
      c.fillStyle = "#171511";
      c.font = '400 27px Georgia, serif';
      c.textAlign = "left";
      c.fillText(title, 28, 699);
      c.fillStyle = "#a4772e";
      c.font = '600 13px "IBM Plex Mono", monospace';
      c.textAlign = "right";
      c.fillText(tag + "  →", 972, 698);
      tex.needsUpdate = true;
    }

    draw();

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => draw(image);
    image.src = src;
    return tex;
  }

  function makeKeyboardTexture() {
    return canvasTexture(1200, 620, (c, w, h) => {
      c.fillStyle = "#18191b";
      c.fillRect(0, 0, w, h);
      const cols = 14;
      const rows = 5;
      const gap = 9;
      const kw = (w - 80 - gap * (cols - 1)) / cols;
      const kh = (h - 80 - gap * (rows - 1)) / rows;
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const x = 40 + col * (kw + gap);
          const y = 38 + r * (kh + gap);
          c.fillStyle = "#232528";
          rr(c, x, y, kw, kh, 7);
          c.fill();
          c.strokeStyle = "rgba(255,255,255,.06)";
          c.lineWidth = 1.5;
          rr(c, x + 1, y + 1, kw - 2, kh - 2, 6);
          c.stroke();
        }
      }
      c.fillStyle = "#232528";
      rr(c, 330, h - 64, 540, 40, 8);
      c.fill();
    });
  }

  /* ---------------------------------------------------------- brain */
  function makeBrainSkin() {
    const W = 1024;
    const H = 512;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const c = canvas.getContext("2d");

    c.fillStyle = "#212227";
    c.fillRect(0, 0, W, H);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.globalAlpha = 0.9;

    for (let i = 0; i < 320; i++) {
      const x = rand() * W;
      const y = rand() * H;
      const len = 26 + rand() * 120;
      const amp = 8 + rand() * 28;
      const dark = rand() < 0.6;
      c.strokeStyle = dark ? "#040405" : "#4c4e57";
      c.lineWidth = 5 + rand() * 14;
      c.beginPath();
      c.moveTo(x, y);
      for (let k = 1; k <= 8; k++) {
        const t = k / 8;
        c.lineTo(
          x + len * t,
          y + Math.sin(t * Math.PI * (1.4 + rand() * 0.5) + i * 1.7) * amp + (rand() - 0.5) * 10
        );
      }
      c.stroke();
      if (x + len > W) {
        c.beginPath();
        c.moveTo(x - W, y);
        for (let k = 1; k <= 8; k++) {
          const t = k / 8;
          c.lineTo(
            x - W + len * t,
            y + Math.sin(t * Math.PI * 1.7 + i * 1.7) * amp + (rand() - 0.5) * 10
          );
        }
        c.stroke();
      }
    }
    c.globalAlpha = 1;

    /* subtle vertical shading so the underside sits in shadow */
    const grad = c.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, "rgba(255,255,255,.05)");
    grad.addColorStop(0.55, "rgba(0,0,0,0)");
    grad.addColorStop(1, "rgba(0,0,0,.25)");
    c.fillStyle = grad;
    c.fillRect(0, 0, W, H);

    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    /* derive a tangent-space normal map from the same fold pattern */
    const src = c.getImageData(0, 0, W, H).data;
    const nCanvas = document.createElement("canvas");
    nCanvas.width = W;
    nCanvas.height = H;
    const nCtx = nCanvas.getContext("2d");
    const nImg = nCtx.createImageData(W, H);
    const luma = (x, y) => {
      const i = ((y + H) % H * W + ((x + W) % W)) * 4;
      return (src[i] * 0.299 + src[i + 1] * 0.587 + src[i + 2] * 0.114) / 255;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const dx = (luma(x + 1, y) - luma(x - 1, y)) * 3.2;
        const dy = (luma(x, y + 1) - luma(x, y - 1)) * 3.2;
        const len = Math.sqrt(dx * dx + dy * dy + 1);
        const i = (y * W + x) * 4;
        nImg.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
        nImg.data[i + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
        nImg.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
        nImg.data[i + 3] = 255;
      }
    }
    nCtx.putImageData(nImg, 0, 0);
    const normalMap = new THREE.CanvasTexture(nCanvas);
    normalMap.colorSpace = THREE.NoColorSpace;
    normalMap.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    return { map, normalMap };
  }

  const BRAIN_SHARDS = [
    { name: "Website", chapter: 1, theta: 1.12, phi: 1.02, arc: 0.155 },
    { name: "Google profile", chapter: 2, theta: 1.86, phi: 1.14, arc: 0.145 },
    { name: "AI agents", chapter: 3, theta: 1.55, phi: 0.7, arc: 0.14 },
    { name: "The work", chapter: 4, theta: 1.26, phi: 1.76, arc: 0.15 },
    { name: "The process", chapter: 5, theta: 1.98, phi: 1.78, arc: 0.14 },
    { name: "Visit us", chapter: 6, theta: 1.5, phi: 1.44, arc: 0.125 }
  ];

  // Engaging FAQs that "fill" the brain: hovering any point on the surface
  // surfaces the nearest one, so every corner/edge shows something useful.
  const BRAIN_FAQS = [
    { q: "Website kab tak ban jayega?", a: "5–7 working days me, content milne ke baad.", ch: 1, t: 0.0, p: 0.7 },
    { q: "Kya mobile-friendly hoga?", a: "100% responsive — har screen par clean.", ch: 1, t: 0.78, p: 0.7 },
    { q: "Hosting kaun sambhalega?", a: "Main setup karta hu, phir aap manage karte ho.", ch: 1, t: 1.57, p: 0.7 },
    { q: "Website slow hai kya karun?", a: "Redesign + performance fix — free audit me bataunga.", ch: 1, t: 2.36, p: 0.7 },
    { q: "Kya main khud edit kar sakta hu?", a: "Haan — simple CMS + handover training.", ch: 1, t: 3.14, p: 0.7 },
    { q: "Kya aap redesign karte ho?", a: "Rebuild vs upgrade — audit me recommend karunga.", ch: 1, t: 3.93, p: 0.7 },
    { q: "Kya website pe booking laga sakte ho?", a: "Calendly / WhatsApp booking / custom form.", ch: 1, t: 4.71, p: 0.7 },
    { q: "Kya aap analytics setup karte ho?", a: "GA, Search Console, GBP insights — aapke naam par.", ch: 1, t: 5.5, p: 0.7 },
    { q: "Google Maps top-3 guarantee?", a: "Nahi guarantee, but optimization + monthly snapshot.", ch: 2, t: 0.4, p: 1.35 },
    { q: "Reviews kaise badhenge?", a: "Review request flow + WhatsApp follow-up.", ch: 2, t: 1.2, p: 1.35 },
    { q: "GBP suspended ho gaya?", a: "Recovery + re-verification guide.", ch: 2, t: 2.0, p: 1.35 },
    { q: "SEO kitna time lagta hai?", a: "30–90 days local, 4–6 months national.", ch: 2, t: 2.8, p: 1.35 },
    { q: "Kya aap meri city mein kaam karte ho?", a: "100% remote — India ke kisi bhi city me.", ch: 6, t: 3.6, p: 1.35 },
    { q: "AI agent kitna smart hai?", a: "WhatsApp + website chat, 24/7, instant replies.", ch: 3, t: 4.4, p: 1.35 },
    { q: "WhatsApp Business API chahiye?", a: "Setup + templates + automation.", ch: 3, t: 5.2, p: 1.35 },
    { q: "AI agent call receive kar sakta hai?", a: "Advanced add-on — pehle fit check.", ch: 3, t: 6.0, p: 1.35 },
    { q: "Real client kaam dekho?", a: "Live client work, concepts and products — labelled.", ch: 4, t: 0.6, p: 2.05 },
    { q: "Live work dekh sakte hain?", a: "Haan — room 05 me, card par tap karein.", ch: 4, t: 1.5, p: 2.05 },
    { q: "Process kaise hota hai?", a: "Audit → quote → build → review → handover.", ch: 5, t: 2.4, p: 2.05 },
    { q: "Maintenance charges?", a: "Optional monthly care, clearly quoted.", ch: 5, t: 3.3, p: 2.05 },
    { q: "Free audit kaise milega?", a: "WhatsApp +91 78983 32744.", ch: 7, t: 4.2, p: 2.05 },
    { q: "Payment kitna aur kab?", a: "40% kickoff, 60% review.", ch: 7, t: 5.1, p: 2.05 },
    { q: "Kya domain mera naam par hoga?", a: "Haan — aapke ownership me.", ch: 7, t: 6.0, p: 2.05 },
    { q: "Refund policy kya hai?", a: "7-day review, eligible portion refund.", ch: 7, t: 0.9, p: 2.5 }
  ];

  function nearestFaq(theta, phi) {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < BRAIN_FAQS.length; i++) {
      const f = BRAIN_FAQS[i];
      const s = Math.sin(phi) * Math.sin(f.p) * Math.cos(theta - f.t) + Math.cos(phi) * Math.cos(f.p);
      const d = Math.acos(clamp(s, -1, 1));
      if (d < bestD) { bestD = d; best = i; }
    }
    return BRAIN_FAQS[best];
  }

  function angleBetween(t1, p1, t2, p2) {
    const s =
      Math.sin(p1) * Math.sin(p2) * Math.cos(t1 - t2) + Math.cos(p1) * Math.cos(p2);
    return Math.acos(clamp(s, -1, 1));
  }

  function brainSurface(theta, phi, out = new THREE.Vector3(), dented = false) {
    const st = Math.sin(phi);
    const ct = Math.cos(phi);
    let x = 0.98 * st * Math.cos(theta);
    let y = 0.8 * ct;
    let z = 1.06 * st * Math.sin(theta);

    /* soft, wormy gyri: low-frequency waves over the whole surface */
    const fold =
      Math.sin(4.3 * theta + 1.3 + 2.1 * Math.sin(phi * 2.6)) * 0.5 +
      Math.sin(6.2 * phi + 0.6 + 1.6 * Math.cos(theta * 1.9)) * 0.32 +
      Math.sin(8.4 * (x * 0.8 + y * 0.7 + z * 0.4) + 2.2) * 0.18;
    const bump = fold * 0.045;

    /* two hemisphere lobes plus a deep longitudinal fissure */
    const hemi =
      Math.exp(-Math.pow((Math.abs(x) - 0.46) / 0.28, 2)) * (0.42 + 0.58 * st) * 0.07;
    const fissure = Math.exp(-Math.pow(x / 0.06, 2)) * (0.55 + 0.45 * st);
    let k = 1 + bump + hemi - 0.11 * fissure;

    let px = x * k;
    let py = (y + 0.018 * Math.sin(phi * 2.2)) * k;
    let pz = z * k;

    /* temporal lobe: a gentle widening low on each side */
    const temporal =
      Math.exp(-Math.pow((y + 0.34) / 0.26, 2)) *
      Math.exp(-Math.pow((Math.abs(x) - 0.5) / 0.34, 2)) *
      0.06;
    px += Math.sign(x) * temporal;
    py -= temporal * 0.25;

    /* Sylvian fissure: a shallow groove where the temporal lobe meets the parietal lobe */
    const sylvian =
      Math.exp(-Math.pow((y + 0.12) / 0.16, 2)) *
      Math.exp(-Math.pow((Math.abs(x) - 0.52) / 0.22, 2)) *
      0.04;
    px += Math.sign(x) * sylvian * 0.35;
    py -= sylvian * 0.4;

    /* flatten the underside a little, the way a brain rests */
    py *= 1 - 0.16 * smooth(clamp(-py / 0.8));

    if (dented) {
      let dent = 0;
      for (let i = 0; i < BRAIN_SHARDS.length; i++) {
        const s = BRAIN_SHARDS[i];
        const d = angleBetween(theta, phi, s.theta, s.phi);
        if (d < s.arc) {
          const q = clamp(1 - d / s.arc);
          const f = q * q * (3 - 2 * q);
          dent = Math.max(dent, f);
        }
      }
      const scale = 1 - dent * 0.014;
      px *= scale;
      py *= scale;
      pz *= scale;
    }

    return out.set(px, py, pz);
  }

  function buildBrain() {
    const group = new THREE.Group();
    group.position.set(0, 2.0, 0);           // the brain floats above the plinth cap with the same air gap as the reference
    const root = new THREE.Group();
    group.add(root);

    const brainSkin = makeBrainSkin();
    const brainMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: brainSkin.map,
      normalMap: brainSkin.normalMap,
      normalScale: new THREE.Vector2(1.5, 1.5),
      roughness: 0.46,
      metalness: 0.16,
      clearcoat: 0.42,
      clearcoatRoughness: 0.22,
      envMapIntensity: 0.55,
      emissive: new THREE.Color(0x7a4a12),
      emissiveIntensity: 0.0,
      transparent: true,
      opacity: 1
    });
    const shardMat = brainMat.clone();
    shardMat.color.set(0x1d1d20);
    shardMat.roughness = 0.42;
    shardMat.metalness = 0.28;
    shardMat.emissive = new THREE.Color(0x1a1105);
    shardMat.emissiveIntensity = 0.12;
    const crackMat = new THREE.MeshStandardMaterial({
      color: 0xe0ad5f,
      roughness: 0.32,
      metalness: 0.9,
      emissive: 0x4d2f09,
      emissiveIntensity: 0.62,
      transparent: true,
      opacity: 1
    });
    const crackGlowMat = new THREE.MeshBasicMaterial({
      color: 0xffb44f,
      transparent: true,
      opacity: 0.09,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: true
    });
    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xf4c983,
      transparent: true,
      opacity: 0.6,
      toneMapped: true
    });

    const geo = new THREE.SphereGeometry(1, 120, 84);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).normalize();
      const theta = Math.atan2(v.z, v.x);
      const phi = Math.acos(clamp(v.y, -1, 1));
      brainSurface(theta, phi, v, true);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();

    const brainMesh = new THREE.Mesh(geo, brainMat);
    root.add(brainMesh);

    const cereGeo = new THREE.SphereGeometry(1, 36, 24);
    const cere = new THREE.Mesh(cereGeo, brainMat);
    cere.scale.set(0.5, 0.28, 0.38);
    cere.position.set(0, -0.48, -0.48);
    root.add(cere);

    /* inner walls: catch the light when a piece lifts (gold kintsugi) */
    const insideMat = new THREE.MeshPhysicalMaterial({
      color: 0x1a1a1d,
      roughness: 0.32,
      metalness: 0.4,
      clearcoat: 0.6,
      clearcoatRoughness: 0.2,
      envMapIntensity: 0.6,
      transparent: true,
      opacity: 0.92
    });
    const inside = new THREE.Mesh(new THREE.SphereGeometry(0.72, 48, 36), insideMat);
    inside.visible = false;
    root.add(inside);

    /* inner bulb light: flares as pieces lift / brain breaks */
    const bulbLight = new THREE.PointLight(0xffc46c, 0, 2.4, 2);
    bulbLight.position.set(0, 0, 0);
    root.add(bulbLight);

    /* sweep light: one band of light runs up the brain */
    const sweepLight = new THREE.PointLight(0xffe0a0, 0, 2.0, 2);
    sweepLight.position.set(0, -0.9, 0.3);
    root.add(sweepLight);

    /* turning edges: glass handles on the brain's sides (hero only) */
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.05,
      metalness: 0,
      transmission: 0.85,
      thickness: 0.4,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.2,
      transparent: true,
      opacity: 0.7
    });
    const turnL = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), glassMat);
    turnL.position.set(-0.98, 0.05, 0.05);
    const turnR = new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), glassMat);
    turnR.position.set(0.98, 0.05, 0.05);
    turnL.visible = false;
    turnR.visible = false;
    root.add(turnL);
    root.add(turnR);

    function addCrack(points, radius) {
      if (points.length < 3) return;
      const curve = new THREE.CatmullRomCurve3(points);
      const core = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, radius, 5, false), crackMat);
      root.add(core);
      const glow = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, radius * 2.7, 5, false), crackGlowMat);
      root.add(glow);
    }

    function nearShard(theta, phi, pad) {
      for (let i = 0; i < BRAIN_SHARDS.length; i++) {
        const s = BRAIN_SHARDS[i];
        if (angleBetween(theta, phi, s.theta, s.phi) < s.arc + pad) return true;
      }
      return false;
    }

    function crackPoint(theta, phi) {
      return brainSurface(theta, phi, new THREE.Vector3(), false).multiplyScalar(1.004);
    }

    function crackWalk(theta, phi, dTheta, dPhi, steps) {
      const pts = [];
      const angles = [];
      for (let k = 0; k < steps; k++) {
        if (nearShard(theta, phi, 0.055)) return null;
        pts.push(crackPoint(theta, phi));
        angles.push([theta, phi]);
        dTheta += (rand() - 0.5) * 0.1;
        dPhi += (rand() - 0.5) * 0.055;
        theta += dTheta;
        phi = clamp(phi + dPhi, 0.3, 2.84);
      }
      return { pts, angles };
    }

    let cracks = 0;
    let attempts = 0;
    while (cracks < 9 && attempts < 90) {
      attempts++;
      const theta = 0.45 + rand() * 2.5;
      const phi = 0.4 + rand() * 2.1;
      const main = crackWalk(
        theta,
        phi,
        (rand() - 0.5) * 0.17,
        (rand() - 0.5) * 0.2,
        9 + Math.floor(rand() * 6)
      );
      if (!main) continue;
      addCrack(main.pts, 0.0026 + rand() * 0.0018);
      cracks++;

      if (rand() < 0.9) {
        const at = 2 + Math.floor(rand() * Math.max(1, main.angles.length - 4));
        const [bt, bp] = main.angles[at];
        const branch = crackWalk(
          bt,
          bp,
          (rand() - 0.5) * 0.17 + (rand() < 0.5 ? 0.09 : -0.09),
          (rand() - 0.5) * 0.16,
          3 + Math.floor(rand() * 4)
        );
        if (branch) addCrack(branch.pts, 0.0019 + rand() * 0.0013);
      }
    }

    const seamPts = [];
    for (let i = 0; i <= 22; i++) {
      seamPts.push(
        brainSurface(Math.PI / 2, 0.22 + (i / 22) * 2.7, new THREE.Vector3(), false).multiplyScalar(1.004)
      );
    }
    const seamCurve = new THREE.CatmullRomCurve3(seamPts);
    const seamGroove = new THREE.Mesh(
      new THREE.TubeGeometry(seamCurve, 40, 0.011, 5, false),
      new THREE.MeshBasicMaterial({ color: 0x070707 })
    );
    root.add(seamGroove);
    const seam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 40, 0.0024, 5, false), crackMat);
    root.add(seam);
    const seamGlow = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 40, 0.014, 5, false), crackGlowMat);
    root.add(seamGlow);

    /* the six liftable pieces, each a doorway into a chapter */
    const shards = [];

    BRAIN_SHARDS.forEach((spec, si) => {
      const cap = Math.sin(spec.arc) * 1.01;
      const shape = new THREE.Shape();
      const count = 14 + (si % 3);
      const twist = rand() * TAU;
      for (let i = 0; i < count; i++) {
        const a = twist + (i / count) * TAU + (rand() - 0.5) * 0.08;
        const r = cap * (0.68 + rand() * 0.34) * (i % 2 ? 0.94 : 1.05);
        const x = Math.cos(a) * r;
        const yy = Math.sin(a) * r;
        if (i === 0) shape.moveTo(x, yy);
        else shape.lineTo(x, yy);
      }
      shape.closePath();
      const sGeo = new THREE.ExtrudeGeometry(shape, {
        depth: 0.02,
        bevelEnabled: true,
        bevelSize: 0.004,
        bevelThickness: 0.004,
        bevelSegments: 1,
        curveSegments: 2
      });
      sGeo.center();
      const mesh = new THREE.Mesh(sGeo, shardMat);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(sGeo), edgeMat);
      mesh.add(edge);

      const basePos = brainSurface(spec.theta, spec.phi, new THREE.Vector3(), true);
      const normal = brainSurface(spec.theta, spec.phi, new THREE.Vector3(), false).normalize();
      basePos.addScaledVector(normal, 0.008);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
      mesh.position.copy(basePos);
      mesh.userData = {
        ...spec,
        basePos,
        normal,
        hover: 0,
        lift: 0,
        startPos: normal.clone().multiplyScalar(2.3 + rand() * 1.6).add(
          new THREE.Vector3((rand() - 0.5) * 1.9, (rand() - 0.5) * 1.9, (rand() - 0.5) * 1.9)
        ),
        startQuat: new THREE.Quaternion().setFromEuler(
          new THREE.Euler(rand() * TAU, rand() * TAU, rand() * TAU)
        )
      };
      root.add(mesh);
      shards.push(mesh);
    });

    /* dust orbiting the brain, gathering during the intro */
    const N = 820;
    const dPos = new Float32Array(N * 3);
    const dSize = new Float32Array(N);
    const parts = [];
    for (let i = 0; i < N; i++) {
      parts.push({
        a: rand() * TAU,
        r: 1.35 + rand() * 1.9,
        y: -1.3 + rand() * 2.7,
        s: 0.3 + rand() * 1.2,
        p: rand() * TAU
      });
      dSize[i] = 0.018 + rand() * 0.035;
    }
    const dGeo = new THREE.BufferGeometry();
    dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
    const dMat = new THREE.PointsMaterial({
      color: 0xffc978,
      map: softGlowMap,
      size: 0.055,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      toneMapped: true
    });
    const dust = new THREE.Points(dGeo, dMat);
    dust.frustumCulled = false;
    group.add(dust);

    const halo = glowSprite(0xffc978, 0.16, 4.6);
    halo.position.set(0, 0, -0.35);
    group.add(halo);

    const underLight = glowSprite(0xffbf66, 0.12, 2.2);
    underLight.position.set(0, -1.25, 0.2);
    group.add(underLight);

    /* "doubt" markers: one glowing dot per FAQ, sitting on the surface where
       that question lives. They pulse while unanswered and dissolve the moment
       the visitor hovers them — the brain literally clears as you explore. */
    const faqMarkers = [];
    BRAIN_FAQS.forEach((faq, fi) => {
      const pos = brainSurface(faq.t, faq.p, new THREE.Vector3(), false).multiplyScalar(1.012);
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.032, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0xffd9a0,
          transparent: true,
          opacity: 0.9,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false
        })
      );
      dot.position.copy(pos);
      dot.userData.faqIndex = fi;
      root.add(dot);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.05, 0.006, 6, 24),
        new THREE.MeshBasicMaterial({
          color: 0xffc978,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          toneMapped: false
        })
      );
      ring.position.copy(pos);
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), pos.clone().normalize());
      root.add(ring);
      faqMarkers.push({ dot, ring, faq, cleared: false });
    });

    /* one sweep of light runs up the brain: a gold band that hugs the
       surface (its radius follows the skull's profile) and travels bottom to top */
    const sweepRing = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.016, 8, 128),
      new THREE.MeshBasicMaterial({
        color: 0xffd79a,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false
      })
    );
    sweepRing.rotation.x = Math.PI / 2;
    sweepRing.visible = false;
    root.add(sweepRing);

    /* the flash as the body closes over the gold seams */
    const birthFlash = glowSprite(0xffd9a0, 0.0, 3.4);
    birthFlash.position.set(0, 0, 0.1);
    root.add(birthFlash);

    let yaw = -0.55;

    function update(time, dt, intro, fade) {
      const e = easeOut(clamp((intro - 0.08) / 0.74));
      const alive = 1 - fade;
      group.visible = alive > 0.002;
      const w0 = clamp(prog * 7);
      const burst = Math.pow(THREE.MathUtils.smoothstep(w0, 0.015, 0.2), 2);

      /* intro timeline: dust gathers, seams grow (gold), body grows out of
         gold, pulse flashes, sweep runs up, env fades in */
      const T = intro * 4.3;
      function kf(start, dur, ease) {
        const x = (T - start) / dur;
        if (x <= 0) return 0;
        if (x >= 1) return 1;
        if (ease === "inout1") return x < 0.5 ? 2 * x * x : -1 + (4 - 2 * x) * x;
        if (ease === "inout2") return x < 0.5 ? 2 * x * x : 1 - 2 * (1 - x) * (1 - x);
        if (ease === "out3") return 1 - (1 - x) * (1 - x) * (1 - x);
        if (ease === "inout3") {
          return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
        }
        return x;
      }
      const Sgather = kf(0.15, 2.1, "inout1");
      const Sseams = kf(0.85, 1.9, "inout2");
      const SpulseIn = kf(2.55, 0.25, "out2");
      const SpulseOut = kf(2.8, 1.4, "out3");
      const Spulse = Math.max(0, SpulseIn - SpulseOut * SpulseIn);
      const Sbody = kf(2.5, 1.7, "inout2");
      const Ssweep = kf(3.9, 1.1, "inout2");
      const Senv = kf(2.9, 2.2, "out2");
      const Scam = kf(0.1, 4.6, "inout3");

      brainMat.opacity = clamp((intro - 0.1) / 0.45) * alive * (1 - THREE.MathUtils.smoothstep(w0, 0.05, 0.16)) * (0.15 + 0.85 * Sbody);
      shardMat.opacity = clamp((intro - 0.2) / 0.45) * alive * (1 - THREE.MathUtils.smoothstep(w0, 0.1, 0.2)) * (0.2 + 0.8 * Sbody);
      crackMat.opacity = clamp((intro - 0.3) / 0.55) * alive * (1 - THREE.MathUtils.smoothstep(w0, 0.1, 0.2)) * (0.1 + 0.9 * Sseams) * (1 + Spulse * 2.2);
      crackGlowMat.opacity = (0.05 + 0.04 * (0.5 + 0.5 * Math.sin(time * 1.7))) * clamp((intro - 0.35) / 0.5) * alive * (1 - THREE.MathUtils.smoothstep(w0, 0.1, 0.2)) * (0.1 + 0.9 * Sseams) * (1 + Spulse * 3);
      edgeMat.opacity = 0.6 * clamp((intro - 0.2) / 0.45) * alive * (1 - THREE.MathUtils.smoothstep(w0, 0.1, 0.2)) * Sseams;
      dMat.opacity = 0.55 * clamp((intro - 0.1) / 0.6) * alive
        * (1 - THREE.MathUtils.smoothstep(w0, 0.35, 1.0)) * (0.6 + 0.75 * (1 - e));
      group.visible = alive > 0.002 && w0 < 0.25;
      halo.material.opacity = 0.16 * (0.75 + 0.25 * Math.sin(time * 0.8)) * alive * Senv;
      underLight.material.opacity = 0.12 * alive * Senv;

      /* doubt markers: pulse while unanswered, dissolve on hover */
      if (brainState.faqCleared) {
        faqMarkers.forEach((m, i) => {
          if (brainState.faqCleared.has(i) && !m.cleared) {
            m.cleared = true;
            m.dot.material.opacity = 0;
            m.ring.material.opacity = 0;
            m.dot.visible = false;
            m.ring.visible = false;
          }
        });
      }
      faqMarkers.forEach((m, i) => {
        if (m.cleared) return;
        const pulse = 0.7 + 0.3 * Math.sin(time * 2.4 + i * 0.7);
        m.dot.material.opacity = 0.85 * pulse * alive * (0.5 + 0.5 * Sbody);
        m.ring.material.opacity = 0.45 * pulse * alive * (0.5 + 0.5 * Sbody);
        const s = 0.9 + 0.18 * Math.sin(time * 3.1 + i * 1.1);
        m.dot.scale.setScalar(s);
        m.ring.scale.setScalar(s);
        m.ring.rotation.z = time * 0.6 + i;
      });

      root.scale.setScalar((0.74 + 0.26 * e) * (1 + 0.014 * Math.sin(time * 0.78)));

      if (!brainState.dragging && !reduced) yaw += dt * 0.055;
      const spin = yaw + (reduced ? 0 : Math.sin(time * 0.17) * 0.07);
      root.rotation.y = spin;
      root.rotation.x = Math.sin(time * 0.21) * 0.02;
      root.position.y = (reduced ? 0 : Math.sin(time * 0.58) * 0.045) + (1 - intro) * (1 - intro) * 0.12;

      /* sweep light runs up the brain */
      sweepLight.position.y = -0.9 + 1.8 * Ssweep;
      sweepLight.intensity = Ssweep * (1 - Ssweep) * 4 * alive * (0.3 + 0.7 * Sbody);
      sweepLight.visible = sweepLight.intensity > 0.01;

      /* the visible band: radius follows the skull profile so it hugs the folds */
      const sweepY = -0.92 + 1.84 * Ssweep;
      sweepRing.position.y = sweepY;
      const prof = Math.max(0, 1 - Math.pow(sweepY / 0.86, 2));
      const ringR = 1.03 * Math.sqrt(prof) + 0.02;
      sweepRing.scale.set(ringR, ringR, 1);
      sweepRing.material.opacity = 0.9 * Math.sin(Math.PI * Ssweep) * alive * (0.3 + 0.7 * Sbody);
      sweepRing.visible = sweepRing.material.opacity > 0.01;

      /* the body flashes gold as it closes over the seams */
      const flash = Math.max(0, Spulse) * alive * (0.35 + 0.65 * Sbody);
      brainMat.emissiveIntensity = flash * 0.9 + Ssweep * (1 - Ssweep) * 0.5;
      birthFlash.material.opacity = flash * 0.8;
      birthFlash.visible = flash > 0.01;

      let maxLift = 0;
      shards.forEach((s, i) => {
        const d = s.userData;
        const ap = easeOut(clamp((intro - 0.24 - i * 0.035) / 0.52));
        s.position.lerpVectors(d.startPos, d.basePos, ap);
        const fly = burst * burst * (1.4 + ((i * 0.37) % 1) * 1.6);
        const flyDir = d.startPos.clone().normalize();
        s.position.addScaledVector(flyDir, fly * 0.14);
        s.position.addScaledVector(d.normal, d.lift * 0.085);
        const baseQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normal);
        const tiltAxis = new THREE.Vector3().crossVectors(d.normal, new THREE.Vector3(0, 1, 0)).normalize();
        if (tiltAxis.lengthSq() < 0.001) tiltAxis.set(1, 0, 0);
        const tiltAngle = 0.22 * d.lift + burst * (0.6 + (i % 3) * 0.4);
        const tiltQuat = new THREE.Quaternion().setFromAxisAngle(tiltAxis, tiltAngle);
        s.quaternion.copy(d.startQuat).slerp(baseQuat, ap);
        s.quaternion.multiply(tiltQuat);
        d.lift += (d.hover - d.lift) * Math.min(1, dt * 9);
        if (d.lift > maxLift) maxLift = d.lift;
        s.scale.setScalar(1 + d.lift * 0.08);
      });

      /* inner walls catch the light when a piece lifts or the brain breaks */
      inside.visible = maxLift > 0.01 || burst > 0.002;
      const bulbOut = THREE.MathUtils.smoothstep(w0, 0.06, 0.14);
      bulbLight.intensity = (1.5 + 34 * maxLift) * (1 - bulbOut) * alive;
      bulbLight.visible = bulbLight.intensity > 0.01;

      /* turning edges appear once the brain has formed (hero only) */
      const heroActive = prog * 7 < 0.55;
      turnL.visible = intro > 0.95 && heroActive && alive > 0.5;
      turnR.visible = turnL.visible;

      for (let i = 0; i < N; i++) {
        const p = parts[i];
        const gather = 1 + (1 - e) * 2.6;
        const r = p.r * gather;
        const a = p.a + time * (0.08 + p.s * 0.1) + (1 - e) * 1.9;
        dPos[i * 3] = Math.cos(a) * r;
        dPos[i * 3 + 1] = p.y * (0.5 + e * 0.5) + Math.sin(time * 0.7 + p.p) * 0.18;
        dPos[i * 3 + 2] = Math.sin(a) * r;
      }
      dGeo.attributes.position.needsUpdate = true;
    }

    brainState.group = group;
    brainState.root = root;
    brainState.shards = shards;
    brainState.faqMarkers = faqMarkers;
    brainState.faqCleared = new Set();
    brainState.update = update;
    brainState.brainMesh = brainMesh;
    brainState.yaw = () => yaw;
    brainState.turn = (dx) => {
      yaw += dx * 0.0075;
    };

    return { group, update, shards, brainMesh };
  }

  /* ---------------------------------------------------------- laptop */
  function buildLaptop() {
    const group = new THREE.Group();
    group.position.set(0, 1.0, 0);
    group.rotation.y = -0.28;

    const base = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.09, 1.55, 4, 0.05), roseMat);
    group.add(base);

    const kb = new THREE.Mesh(
      new THREE.PlaneGeometry(1.98, 0.94),
      new THREE.MeshStandardMaterial({ map: makeKeyboardTexture(), roughness: 0.6, metalness: 0.25 })
    );
    kb.rotation.x = -Math.PI / 2;
    kb.position.set(0, 0.048, -0.1);
    group.add(kb);

    const pad = new THREE.Mesh(
      new RoundedBoxGeometry(0.62, 0.008, 0.4, 3, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xae8274, roughness: 0.4, metalness: 0.45 })
    );
    pad.position.set(0, 0.05, 0.52);
    group.add(pad);

    const lid = new THREE.Group();
    lid.position.set(0, 0.045, -0.775);
    lid.rotation.x = -0.17;
    group.add(lid);

    const lidBody = new THREE.Mesh(new RoundedBoxGeometry(2.3, 1.44, 0.075, 4, 0.06), roseMat);
    lidBody.position.set(0, 0.72, 0);
    lid.add(lidBody);

    const bezel = new THREE.Mesh(new RoundedBoxGeometry(2.18, 1.33, 0.018, 3, 0.03), blackMat);
    bezel.position.set(0, 0.72, 0.043);
    lid.add(bezel);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(2.06, 1.2),
      new THREE.MeshBasicMaterial({ map: makeLaptopScreen() })
    );
    screen.position.set(0, 0.72, 0.055);
    lid.add(screen);

    const cam = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), blackMat);
    cam.position.set(0, 1.35, 0.061);
    lid.add(cam);

    const footGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.012, 10);
    [[-0.95, 0.62], [0.95, 0.62], [-0.95, -0.62], [0.95, -0.62]].forEach(([x, z]) => {
      const foot = new THREE.Mesh(footGeo, blackMat);
      foot.position.set(x, -0.05, z);
      group.add(foot);
    });

    const glow = glowSprite(0xffd59a, 0.16, 3.2);
    glow.position.set(0, 0.95, -0.3);
    group.add(glow);

    function update(time, dt, intro, fade) {
      const bob = reduced ? 0 : Math.sin(time * 0.66) * 0.032;
      group.position.y = 1.0 + bob;
      group.rotation.z = reduced ? 0 : Math.sin(time * 0.43) * 0.012;
      group.rotation.y = -0.28 + (reduced ? 0 : Math.sin(time * 0.31) * 0.022);
      lid.rotation.x = -0.17 + (reduced ? 0 : Math.sin(time * 0.5 + 1.2) * 0.009);
      glow.material.opacity = 0.16 * (1 - fade);
      group.visible = fade < 0.99;
    }

    return { group, update };
  }

  /* ---------------------------------------------------------- phone */
  function buildPhone() {
    const group = new THREE.Group();
    group.position.set(0, 1.98, 0);
    group.rotation.y = -0.13;

    const body = new THREE.Mesh(new RoundedBoxGeometry(0.84, 1.76, 0.1, 5, 0.1), maroonMat);
    group.add(body);

    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.74, 1.53),
      new THREE.MeshBasicMaterial({ map: makePhoneScreen() })
    );
    screen.position.set(0, 0, 0.055);
    group.add(screen);

    const island = new THREE.Mesh(new RoundedBoxGeometry(0.21, 0.05, 0.012, 3, 0.02), blackMat);
    island.position.set(0, 0.72, 0.062);
    group.add(island);

    const btnGeo = new THREE.BoxGeometry(0.012, 0.22, 0.02);
    const b1 = new THREE.Mesh(btnGeo, maroonMat);
    b1.position.set(-0.425, 0.36, 0);
    group.add(b1);
    const b2 = new THREE.Mesh(btnGeo, maroonMat);
    b2.position.set(-0.425, 0.06, 0);
    group.add(b2);

    const glow = glowSprite(0xffb75e, 0.16, 2.6);
    glow.position.set(0, 0, -0.15);
    group.add(glow);

    function update(time) {
      group.position.y = 1.98 + (reduced ? 0 : Math.sin(time * 0.62 + 0.7) * 0.035);
      group.rotation.z = reduced ? 0 : Math.sin(time * 0.42 + 0.4) * 0.018;
      group.rotation.y = -0.13 + (reduced ? 0 : Math.sin(time * 0.27) * 0.03);
      group.rotation.x = reduced ? 0 : Math.sin(time * 0.36) * 0.01;
    }

    return { group, update };
  }

  /* ---------------------------------------------------------- location pin */
  function buildPin() {
    const group = new THREE.Group();
    group.position.set(0, 1.18, 0);

    const pts = [
      new THREE.Vector2(0.001, 0),
      new THREE.Vector2(0.075, 0.02),
      new THREE.Vector2(0.19, 0.16),
      new THREE.Vector2(0.31, 0.4),
      new THREE.Vector2(0.36, 0.6),
      new THREE.Vector2(0.31, 0.8),
      new THREE.Vector2(0.19, 0.98),
      new THREE.Vector2(0.001, 1.08)
    ];
    const pin = new THREE.Mesh(new THREE.LatheGeometry(pts, 56), goldMat);
    pin.scale.setScalar(0.96);
    group.add(pin);

    const whiteDisc = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 48),
      new THREE.MeshStandardMaterial({ color: 0xfff5e2, roughness: 0.48, metalness: 0.05 })
    );
    whiteDisc.position.set(0, 0.64, 0.337);
    group.add(whiteDisc);

    const badge = new THREE.Mesh(new THREE.CircleGeometry(0.095, 40), goldMat);
    badge.position.set(0, 0.64, 0.342);
    group.add(badge);

    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.38, 0.012, 8, 72),
      goldGlowMat
    );
    halo.position.y = 0.78;
    halo.rotation.x = Math.PI / 2;
    group.add(halo);

    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(1.52, 1.08),
      new THREE.MeshBasicMaterial({ map: makeProfileCard(), transparent: true })
    );
    card.position.set(1.34, 0.54, 0.24);
    card.rotation.y = -0.3;
    card.rotation.z = -0.015;
    group.add(card);

    const card2 = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 0.62),
      new THREE.MeshBasicMaterial({ map: makeAgentCard("PROFILE CHECK", ["Hours, photos,", "reviews, posts."], "FIXED IN ONE WEEK"), transparent: true })
    );
    card2.position.set(-1.22, 1.05, -0.25);
    card2.rotation.y = 0.34;
    group.add(card2);

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.4, 0.7),
      new THREE.MeshBasicMaterial({ map: shadowMap, transparent: true, opacity: 0.22, depthWrite: false })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.844 - 1.18 + 0.02;
    group.add(shadow);

    const rings = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.55 + i * 0.28, 0.008, 8, 120),
        new THREE.MeshBasicMaterial({
          color: 0xffc978,
          transparent: true,
          opacity: 0.24 - i * 0.055,
          toneMapped: false,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.02 - 1.18;
      rings.add(ring);
    }
    group.add(rings);

    const glow = glowSprite(0xffc46c, 0.3, 2.8);
    glow.position.set(0, 0.55, 0);
    group.add(glow);

    function update(time, dt, intro, fade) {
      const bob = reduced ? 0 : Math.sin(time * 0.6 + 0.9) * 0.04;
      group.position.y = 1.18 + bob;
      group.rotation.z = reduced ? 0 : Math.sin(time * 0.35) * 0.02;
      group.rotation.y = reduced ? 0 : Math.sin(time * 0.24) * 0.035;
      halo.rotation.z = time * 0.3;
      card.position.y = 0.54 + (reduced ? 0 : Math.sin(time * 0.53 + 2) * 0.025);
      card2.position.y = 1.05 + (reduced ? 0 : Math.sin(time * 0.47 + 4) * 0.025);
      rings.children.forEach((ring, i) => {
        const p = (time * 0.16 + i * 0.33) % 1;
        ring.scale.setScalar(0.8 + p * 0.55);
        ring.material.opacity = (0.2 - i * 0.05) * (1 - p) * (1 - fade);
      });
      glow.material.opacity = 0.3 * (1 - fade);
      group.visible = fade < 0.99;
    }

    return { group, update };
  }

  /* ---------------------------------------------------------- AI core */
  function buildAI() {
    const group = new THREE.Group();
    group.position.set(0, 2.04, 0);

    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0x171310,
      roughness: 0.17,
      metalness: 0.38,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      emissive: 0x5e3808,
      emissiveIntensity: 0.55
    });
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 2), coreMat);
    group.add(core);

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.475, 1)),
      new THREE.LineBasicMaterial({
        color: 0xffc978,
        transparent: true,
        opacity: 0.55,
        toneMapped: false
      })
    );
    group.add(wire);

    const rings = [];
    const ringSizes = [0.62, 0.78, 0.92];
    ringSizes.forEach((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.008, 8, 96),
        new THREE.MeshBasicMaterial({
          color: 0xffc978,
          transparent: true,
          opacity: 0.44 - i * 0.08,
          toneMapped: false,
          depthWrite: false
        })
      );
      ring.rotation.x = 1.1 + i * 0.55;
      ring.rotation.y = i * 0.7;
      group.add(ring);
      rings.push(ring);
    });

    const orbit = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), goldGlowMat);
      dot.position.set(Math.cos(a) * 0.83, Math.sin(a) * 0.2, Math.sin(a) * 0.4);
      orbit.add(dot);
    }
    group.add(orbit);

    const cardData = [
      {
        kicker: "REPLIES IN SECONDS",
        lines: ["Hi! Do you have a slot", "tomorrow?"],
        footer: "ANSWERED · 10:42 PM",
        p: [-1.36, 0.18, 0.34],
        r: [0, 0.32, 0]
      },
      {
        kicker: "NEVER MISSES A LEAD",
        lines: ["Books the slot while", "you sleep"],
        footer: "CALENDAR + WHATSAPP UPDATED",
        p: [1.3, 0.5, 0.02],
        r: [0, -0.33, 0]
      },
      {
        kicker: "WORKS ALL NIGHT",
        lines: ["Sends prices", "+ directions"],
        footer: "HANDED OVER WITH CONTEXT",
        p: [1.1, -0.56, 0.32],
        r: [0, -0.24, 0]
      }
    ];
    const cards = [];
    cardData.forEach((data) => {
      const card = new THREE.Mesh(
        new THREE.PlaneGeometry(1.26, 0.58),
        new THREE.MeshBasicMaterial({
          map: makeAgentCard(data.kicker, data.lines, data.footer),
          transparent: true
        })
      );
      card.position.set(...data.p);
      card.rotation.set(...data.r);
      group.add(card);
      cards.push({ mesh: card, baseY: data.p[1] });
    });

    const glow = glowSprite(0xffc15e, 0.42, 3.6);
    glow.position.set(0, 0, -0.2);
    group.add(glow);

    function update(time, dt, intro, fade) {
      group.position.y = 2.04 + (reduced ? 0 : Math.sin(time * 0.62) * 0.04);
      if (!reduced) {
        core.rotation.y = time * 0.18;
        core.rotation.x = time * 0.11;
        wire.rotation.y = -time * 0.1;
        wire.rotation.z = time * 0.06;
        rings.forEach((ring, i) => {
          ring.rotation.z = time * (0.12 + i * 0.05);
          ring.rotation.y = i * 0.7 + time * 0.07;
        });
        orbit.rotation.y = time * 0.25;
        orbit.rotation.z = Math.sin(time * 0.2) * 0.2;
      }
      cards.forEach((c, i) => {
        c.mesh.position.y = c.baseY + (reduced ? 0 : Math.sin(time * 0.5 + i * 1.7) * 0.025);
      });
      glow.material.opacity = 0.42 * (1 - fade);
      group.visible = fade < 0.99;
    }

    return { group, update };
  }

  /* ---------------------------------------------------------- work cards */
  const workHits = [];
  function buildWork() {
    const group = new THREE.Group();
    group.position.set(0, 1.86, 0);

    const items = [
      {
        title: "SpeakMark",
        url: "https://speakmark.vercel.app/",
        src: "assets/work-speakmark.webp",
        tag: "LIVE PRODUCT",
        p: [-1.12, 0.02, 0.28],
        r: [0.02, 0.29, 0.03]
      },
      {
        title: "Liora House",
        url: "https://liora-hotel-portfolio-demo.pages.dev/",
        src: "assets/work-liora.webp",
        tag: "LIVE CONCEPT",
        p: [1.12, 0.16, 0.06],
        r: [-0.02, -0.32, -0.025]
      },
      {
        title: "Hotel Vivanz Palace",
        url: "https://vivanz-palace.vercel.app/",
        src: "assets/work-vivanz.webp",
        tag: "LIVE CLIENT",
        p: [-0.02, 0.64, -0.18],
        r: [0, 0.03, 0.015]
      }
    ];

    const cards = [];
    items.forEach((item, i) => {
      const g = new THREE.Group();
      g.position.set(...item.p);
      g.rotation.set(...item.r);

      const frame = new THREE.Mesh(new RoundedBoxGeometry(1.66, 1.26, 0.07, 4, 0.035), creamMat);
      g.add(frame);

      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(1.52, 1.1),
        new THREE.MeshBasicMaterial({ map: makeWorkTexture(item.title, item.url, item.src, item.tag) })
      );
      screen.position.z = 0.0405;
      screen.userData = { url: item.url, title: item.title };
      g.add(screen);
      workHits.push(screen);

      const edge = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.53, 1.11)),
        new THREE.LineBasicMaterial({ color: 0xd6a656, transparent: true, opacity: 0.55, toneMapped: false })
      );
      edge.position.z = 0.0415;
      g.add(edge);

      group.add(g);
      cards.push({ mesh: g, baseY: item.p[1], phase: i * 1.4 });
    });

    const glow = glowSprite(0xffc978, 0.22, 3.4);
    glow.position.set(0, 0.2, -0.4);
    group.add(glow);

    function update(time, dt, intro, fade) {
      cards.forEach((c) => {
        c.mesh.position.y = c.baseY + (reduced ? 0 : Math.sin(time * 0.55 + c.phase) * 0.035);
        c.mesh.rotation.z += (reduced ? 0 : Math.sin(time * 0.35 + c.phase) * 0.0004);
      });
      glow.material.opacity = 0.22 * (1 - fade);
      group.visible = fade < 0.99;
    }

    return { group, update };
  }

  /* ---------------------------------------------------------- process */
  function buildProcess() {
    const group = new THREE.Group();
    group.position.set(0, 1.8, 0);
    const data = [
      ["01", "Free audit", "Profile, site and WhatsApp, checked by hand."],
      ["02", "Clear scope", "What gets built, what it costs, when it ships."],
      ["03", "Build week", "5 to 7 working days after content and access."],
      ["04", "Review", "You test it on a real phone, we fix the gaps."],
      ["05", "Handover", "Accounts, files and ownership in your name."]
    ];
    const cards = [];
    data.forEach((row, i) => {
      const g = new THREE.Group();
      const x = -1.38 + i * 0.69;
      g.position.set(x, Math.cos(i * 0.72) * 0.11, -0.02 * i);
      g.rotation.y = 0.12 - i * 0.055;
      const frame = new THREE.Mesh(new RoundedBoxGeometry(0.64, 1.28, 0.055, 3, 0.03), creamMat);
      g.add(frame);
      const face = new THREE.Mesh(
        new THREE.PlaneGeometry(0.57, 1.16),
        new THREE.MeshBasicMaterial({ map: makeProcessCard(row[0], row[1], row[2]) })
      );
      face.position.z = 0.033;
      g.add(face);
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.018, 0.06), goldMat);
      top.position.y = 0.6;
      g.add(top);
      group.add(g);
      cards.push({ mesh: g, baseY: Math.cos(i * 0.72) * 0.11, phase: i * 0.7 });
    });

    const pts = cards.map((c, i) => new THREE.Vector3(-1.38 + i * 0.69, c.baseY + 0.72, -0.02 * i));
    const connector = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.006, 5, false),
      goldLineMat
    );
    group.add(connector);

    const glow = glowSprite(0xffc978, 0.18, 3);
    glow.position.set(0, 0.1, -0.4);
    group.add(glow);

    function update(time) {
      cards.forEach((c) => {
        c.mesh.position.y = c.baseY + (reduced ? 0 : Math.sin(time * 0.5 + c.phase) * 0.026);
      });
    }

    return { group, update };
  }

  /* ---------------------------------------------------------- visit */
  function buildVisit() {
    const group = new THREE.Group();
    group.position.set(0, 2.06, 0);

    const globe = new THREE.Group();
    group.add(globe);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.7, 40, 26),
      new THREE.MeshPhysicalMaterial({
        color: 0x141312,
        roughness: 0.26,
        metalness: 0.42,
        clearcoat: 0.9,
        clearcoatRoughness: 0.18,
        envMapIntensity: 1.1
      })
    );
    globe.add(core);

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(0.712, 18, 12)),
      new THREE.LineBasicMaterial({
        color: 0xffca7a,
        transparent: true,
        opacity: 0.48,
        toneMapped: false
      })
    );
    globe.add(wire);

    const axis = new THREE.Mesh(
      new THREE.TorusGeometry(0.72, 0.006, 6, 96),
      goldLineMat
    );
    axis.rotation.x = Math.PI / 2;
    globe.add(axis);

    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), goldGlowMat);
    marker.position.set(0.24, 0.28, 0.6);
    globe.add(marker);
    const markerRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.075, 0.006, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd99a, transparent: true, opacity: 0.8, toneMapped: false })
    );
    markerRing.position.copy(marker.position);
    markerRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), marker.position.clone().normalize());
    globe.add(markerRing);

    const rings = [];
    [1.02, 1.18, 1.38].forEach((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.0075, 8, 120),
        new THREE.MeshBasicMaterial({
          color: 0xffc978,
          transparent: true,
          opacity: 0.35 - i * 0.07,
          toneMapped: false,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2 + (i - 1) * 0.33;
      ring.rotation.z = i * 0.4;
      group.add(ring);
      rings.push(ring);
    });

    const card = new THREE.Mesh(
      new THREE.PlaneGeometry(1.48, 1.03),
      new THREE.MeshBasicMaterial({ map: makeVisitCard(), transparent: true })
    );
    card.position.set(1.36, 0.4, 0.32);
    card.rotation.y = -0.31;
    group.add(card);

    const glow = glowSprite(0xffbd5e, 0.34, 3.2);
    glow.position.set(0, 0, -0.2);
    group.add(glow);

    function update(time, dt, intro, fade) {
      group.position.y = 2.06 + (reduced ? 0 : Math.sin(time * 0.6 + 0.4) * 0.035);
      if (!reduced) {
        globe.rotation.y = time * 0.15;
        globe.rotation.x = Math.sin(time * 0.24) * 0.12;
        rings.forEach((ring, i) => {
          ring.rotation.z = i * 0.4 + time * (0.05 + i * 0.025);
        });
      }
      card.position.y = 0.4 + (reduced ? 0 : Math.sin(time * 0.46 + 2.1) * 0.025);
      glow.material.opacity = 0.34 * (1 - fade);
      group.visible = fade < 0.99;
    }

    return { group, update };
  }

  /* ---------------------------------------------------------- contact */
  function buildContact() {
    const group = new THREE.Group();
    group.position.set(0, 0, 0);

    const rings = [];
    [1.18, 1.48, 1.78].forEach((r, i) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.007, 8, 120),
        new THREE.MeshBasicMaterial({
          color: 0xffc978,
          transparent: true,
          opacity: 0.32 - i * 0.06,
          toneMapped: false,
          depthWrite: false
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.012;
      group.add(ring);
      rings.push(ring);
    });

    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 2), goldMat);
    orb.position.y = 1.62;
    group.add(orb);

    const orbWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(0.34, 1)),
      new THREE.LineBasicMaterial({ color: 0xffd99a, transparent: true, opacity: 0.4, toneMapped: false })
    );
    orbWire.position.y = 1.62;
    group.add(orbWire);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.82, 2.4, 32, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xffc978,
        transparent: true,
        opacity: 0.09,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false
      })
    );
    beam.position.y = 1.2;
    group.add(beam);

    const glow = glowSprite(0xffc46c, 0.4, 2.4);
    glow.position.set(0, 1.62, 0);
    group.add(glow);

    function update(time) {
      const p = (time * 0.2) % 1;
      rings.forEach((ring, i) => {
        ring.scale.setScalar(0.86 + ((p + i * 0.33) % 1) * 0.35);
        ring.material.opacity = (0.3 - i * 0.06) * (1 - ((p + i * 0.33) % 1));
      });
      orb.rotation.y = time * 0.3;
      orbWire.rotation.y = -time * 0.18;
      glow.material.opacity = 0.4 * (0.75 + 0.25 * Math.sin(time * 0.9));
    }

    return { group, update };
  }

  /* ---------------------------------------------------------- world */
  const STATION_DEFS = [
    { id: "hero", panel: "AVZERA", build: buildBrain, targetY: 0.22 },
    { id: "website", panel: "WEBSITE", build: buildLaptop, targetY: 0.0 },
    { id: "google", panel: "GOOGLE", build: buildPin, targetY: 0.0 },
    { id: "ai", panel: "AI AGENTS", build: buildAI, targetY: 0.0 },
    { id: "work", panel: "THE WORK", build: buildWork, targetY: 0.32 },
    { id: "process", panel: "PROCESS", build: buildProcess, targetY: 0.1 },
    { id: "visit", panel: "VISIT", build: buildVisit, targetY: -0.02 },
    { id: "contact", panel: "CONTACT", build: buildContact, targetY: 0.12, bounds: { y: 1.35, h: 1.2, w: 1.2 } }
  ];
  const STATIONS = [];
  const STATION_GAP = 16;
  const STATION_X = 0.55;
  const bayDividers = [];
  const shellMats = [];
  const panelMats = [];
  const panelGroups = [];

  function collectFadeMats(root, list) {
    const seen = new Set();
    root.traverse((o) => {
      if (!o.isMesh || !o.material) return;
      if (o.userData.bayDivider) return;      // dividers have their own travel fade
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((mat) => {
        if (seen.has(mat)) return;
        seen.add(mat);
        list.push({
          mat,
          base: mat.opacity,
          depthWrite: mat.depthWrite,
          transparent: mat.transparent
        });
      });
    });
  }

  function buildWorld() {
    buildRoom();
    buildBays();
    buildDust();
    buildBokeh();
    STATION_DEFS.forEach((def, i) => {
      const group = new THREE.Group();
      group.position.set(STATION_X, 0, -STATION_GAP * i);
      scene.add(group);
      addPlinth(group);
      panelGroups.push(addPanel(group, makePanelTexture(i, def.panel)));
      const prop = def.build();
      group.add(prop.group);
      STATIONS.push({ ...def, index: i, group, prop });
    });
    collectFadeMats(shell, shellMats);
    panelGroups.forEach((g) => collectFadeMats(g, panelMats));
  }

  /* ---------------------------------------------------------- camera */
  const OVERVIEW_POS = new THREE.Vector3(-9.0, 12.0, 13.5);
  const OVERVIEW_TARGET = new THREE.Vector3(0.4, 0.5, -44);
  const camPos = new THREE.Vector3();
  const camTarget = new THREE.Vector3();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const tmpC = new THREE.Vector3();
  let camFov = 36;
  let mouseX = 0;
  let mouseY = 0;
  let overviewFade = 0;
  let appliedOverviewFade = -1;

  function applyOverviewFade(fade) {
    if (Math.abs(fade - appliedOverviewFade) < 0.0008) return;
    appliedOverviewFade = fade;
    const visible = fade < 0.995;
    shell.visible = visible;
    panelGroups.forEach((g) => {
      g.visible = visible;
    });
    const all = shellMats.concat(panelMats);
    for (let i = 0; i < all.length; i++) {
      const item = all[i];
      const mat = item.mat;
      const transparent = item.transparent || fade > 0.002;
      if (mat.transparent !== transparent) {
        mat.transparent = transparent;
        mat.needsUpdate = true;
      }
      mat.opacity = item.base * (1 - fade);
      mat.depthWrite = fade > 0.002 ? false : item.depthWrite;
    }
  }

  /* camera: reference rest angles, screen-space framed on our props */
  // p/t/fov are the reference rest keys, so the view direction and lens match.
  // Each prop is projected to the screen, its distance is fitted to a target
  // share of the frame, and camera.setViewOffset puts it exactly where the reference puts
  // its subject (right of centre, mid-height). Unlike an aim shift this keeps
  // the reference view direction untouched.
  const CAM_REST = [
    { p: [-4.6, 1.05, 2.9], t: [0, 0.22, -0.15], fov: 36 },        // hero
    { p: [-3.4, 1.17, 3.1], t: [-0.02, 0.0, -0.12], fov: 21 },     // website
    { p: [-3.1, 0.62, 2.9], t: [-0.02, 0.05, -0.1], fov: 22 },     // google
    { p: [-3.4, 0.85, 2.5], t: [-0.02, 0.05, -0.1], fov: 22 },     // ai
    { p: [-3.0, 1.45, 3.0], t: [-0.02, 0.1, -0.1], fov: 23 },      // work
    { p: [-3.3, 1.3, 3.2], t: [-0.02, 0.32, -0.1], fov: 25 },      // process
    { p: [-3.4, 1.05, 3.1], t: [-0.02, -0.02, -0.1], fov: 27 },    // visit
    { p: [-3.3, 1.05, 3.2], t: [0, 0.2, 0], fov: 27 }              // contact
  ];
  // target share of the viewport (width, height) and its screen centre.
  // The hero and website numbers are the reference measured brain / laptop boxes.
  const CAM_FRAME = [
    { w: 0.315, h: 0.395, x: 0.502, y: 0.44 },
    { w: 0.52, h: 0.60, x: 0.627, y: 0.512 },
    { w: 0.54, h: 0.60, x: 0.62, y: 0.50 },
    { w: 0.54, h: 0.58, x: 0.62, y: 0.50 },
    { w: 0.54, h: 0.58, x: 0.62, y: 0.50 },
    { w: 0.54, h: 0.55, x: 0.62, y: 0.50 },
    { w: 0.54, h: 0.55, x: 0.62, y: 0.50 },
    { w: 0.42, h: 0.46, x: 0.62, y: 0.47 }
  ];
  const POSES = [];
  const fitCam = new THREE.PerspectiveCamera(36, 1.6, 0.1, 400);
  const WORLD_UP = new THREE.Vector3(0, 1, 0);
  const tmpN = new THREE.Vector3();
  const tmpP = new THREE.Vector3();

  // every visible mesh vertex that matters, so the fit sees the real silhouette
  // (a world AABB is much bigger than the prop and made everything look small)
  function collectPropPoints(root, out) {
    root.updateWorldMatrix(true, true);
    root.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry) return;
      const g = o.geometry;
      if (g.type === "TorusGeometry") return;                     // decoration rings
      if (!g.boundingBox) g.computeBoundingBox();
      if (g.type === "PlaneGeometry") {
        if (o.material && o.material.transparent && o.material.depthWrite === false) return; // beams
        tmpN.set(0, 0, 1).transformDirection(o.matrixWorld);
        if (Math.abs(tmpN.y) > 0.9) return;                       // floor shadows
      }
      const pos = g.attributes.position;
      if (!pos) return;
      // actual vertices, not the AABB corners: for a round brain the box
      // corners sit far outside the silhouette and made the fit pull back
      const step = Math.max(1, Math.floor(pos.count / 4000));
      for (let i = 0; i < pos.count; i += step) {
        out.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld));
      }
    });
    return out;
  }

  function boxPoints(center, size, out) {
    const h = size.clone().multiplyScalar(0.5);
    for (let i = 0; i < 8; i++) {
      out.push(new THREE.Vector3(
        center.x + (i & 1 ? h.x : -h.x),
        center.y + (i & 2 ? h.y : -h.y),
        center.z + (i & 4 ? h.z : -h.z)
      ));
    }
    return out;
  }

  function projectBounds(points, cam) {
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const p of points) {
      tmpP.copy(p).project(cam);
      if (tmpP.x < minx) minx = tmpP.x;
      if (tmpP.x > maxx) maxx = tmpP.x;
      if (tmpP.y < miny) miny = tmpP.y;
      if (tmpP.y > maxy) maxy = tmpP.y;
    }
    return { minx, maxx, miny, maxy };
  }

  function aimFitCamera(center, dir, dist, fov, aspect) {
    fitCam.fov = fov;
    fitCam.aspect = aspect;
    fitCam.position.copy(center).addScaledVector(dir, dist);
    fitCam.lookAt(center);
    fitCam.updateProjectionMatrix();
    fitCam.updateMatrixWorld(true);
  }

  // binary-search the distance: the projected span shrinks monotonically as the
  // camera pulls back, so bisect for the distance that lands the prop exactly on
  // its quota (2% safety margin). The old multiplicative walk stopped ~10% short.
  function fitDistance(points, center, dir, fov, aspect, wFrac, hFrac) {
    const size = new THREE.Box3().setFromPoints(points).getSize(new THREE.Vector3());
    const quota = (d) => {
      aimFitCamera(center, dir, d, fov, aspect);
      const b = projectBounds(points, fitCam);
      return Math.max(
        ((b.maxx - b.minx) / 2) / wFrac,
        ((b.maxy - b.miny) / 2) / hFrac
      );
    };
    let near = Math.max(0.25, size.length() * 0.12);
    let far = Math.max(near * 2.5, size.length() * 5);
    for (let k = 0; k < 26; k++) {
      const mid = (near + far) / 2;
      if (quota(mid) > 1.02) near = mid;     // still too big, back off
      else far = mid;
    }
    return (near + far) / 2;
  }

  function buildCameraPoses() {
    POSES.length = 0;
    const w = Math.max(1, innerWidth);
    const h = Math.max(1, innerHeight);
    const aspect = Math.max(0.4, w / h);
    // keep the horizontal field of view on narrower screens, opening the
    // vertical lens instead, so a tablet sees the same left-to-right framing
    const lensFov = (fov) => aspect >= 1.6
      ? fov
      : Math.min(78, THREE.MathUtils.radToDeg(
          2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(fov) / 2) * 1.6 / aspect)
        ));
    STATIONS.forEach((st, i) => {
      const rest = CAM_REST[i];
      const frame = CAM_FRAME[i];
      const points = [];
      let center;
      if (i === 0 && brainState.brainMesh) {
        collectPropPoints(brainState.brainMesh, points);
      } else if (st.bounds) {
        center = new THREE.Vector3(st.group.position.x, st.bounds.y, st.group.position.z);
        boxPoints(center, new THREE.Vector3(st.bounds.w, st.bounds.h, st.bounds.w), points);
      } else {
        collectPropPoints(st.prop.group, points);
      }
      if (!points.length) {
        center = new THREE.Vector3(st.group.position.x, 1.4, st.group.position.z);
        boxPoints(center, new THREE.Vector3(2, 2, 2), points);
      }
      if (!center) center = new THREE.Box3().setFromPoints(points).getCenter(new THREE.Vector3());

      const dir = new THREE.Vector3(
        rest.p[0] - rest.t[0],
        rest.p[1] - rest.t[1],
        rest.p[2] - rest.t[2]
      ).normalize();
      const fov = lensFov(rest.fov);
      const dist = fitDistance(points, center, dir, fov, aspect, frame.w, frame.h);
      const pos = center.clone().addScaledVector(dir, dist);

      // where the prop actually lands now, then shift the view window so its
      // centre sits at the reference screen position (same framing trick)
      aimFitCamera(center, dir, dist, fov, aspect);
      const b = projectBounds(points, fitCam);
      const cx = ((b.minx + b.maxx) / 2 * 0.5 + 0.5) * w;
      const cy = (-(b.miny + b.maxy) / 2 * 0.5 + 0.5) * h;
      POSES.push({
        pos,
        aim: center.clone(),
        fov,
        viewX: Math.round(cx - frame.x * w),
        viewY: Math.round(cy - frame.y * h)
      });
    });
    camera.clearViewOffset();
  }

  // The divider between two stations is hidden completely while the camera
  // crosses it — no translucent sheet, so the view stays crisp. It is back in
  // place well before the next stop (by then it is behind the camera).
  function fadeDividers(seg, t) {
    for (let k = 0; k < bayDividers.length; k++) {
      const hidden = k === seg && t > 0.22 && t < 0.78;
      bayDividers[k].visible = !hidden;
    }
  }

  function cameraPose(s, time, intro) {
    const swayX = mouseX * 0.1;
    const swayY = -mouseY * 0.05;
    let viewX = 0;
    let viewY = 0;
    overviewFade = 0;

    if (s <= 0.0001) {
      camPos.copy(POSES[0].pos);
      camTarget.copy(POSES[0].aim);
      camFov = POSES[0].fov;
      viewX = POSES[0].viewX;
      viewY = POSES[0].viewY;
      fadeDividers(-1, 0);
    } else if (s >= 7) {
      camPos.copy(POSES[7].pos);
      camTarget.copy(POSES[7].aim);
      camFov = POSES[7].fov;
      viewX = POSES[7].viewX;
      viewY = POSES[7].viewY;
      fadeDividers(-1, 0);
    } else {
      const i = Math.floor(s);
      const u = clamp(s - i);
      // keep the next subject in view while the camera travels: the gaze
      // swings across early, the body follows, so the corridor never feels
      // empty between pedestals.
      const tAim = smooth(clamp((u - 0.18) / 0.22));
      const tPos = smooth(clamp((u - 0.14) / 0.68));
      camPos.lerpVectors(POSES[i].pos, POSES[i + 1].pos, tPos);
      camTarget.lerpVectors(POSES[i].aim, POSES[i + 1].aim, tAim);
      camFov = lerp(POSES[i].fov, POSES[i + 1].fov, tPos) + Math.sin(Math.PI * tPos) * 5.5;
      viewX = lerp(POSES[i].viewX, POSES[i + 1].viewX, tAim);
      viewY = lerp(POSES[i].viewY, POSES[i + 1].viewY, tAim);
      const arc = Math.sin(Math.PI * tPos);
      camPos.y += arc * 0.28;
      camTarget.y += arc * 0.05;
      fadeDividers(i, tPos);
    }

    if (intro < 1 && s < 0.4) {
      const e = easeOut(intro);
      const k = 1 - e;
      const cT = POSES[0].aim;
      const dir = camPos.clone().sub(cT);
      dir.applyAxisAngle(WORLD_UP, -0.55 * k);
      dir.multiplyScalar(1 - 0.22 * k);
      camPos.copy(cT).add(dir);
      camPos.y += 0.35 * k;
      camFov += 5.5 * k;
    }

    camPos.x += swayX;
    camPos.y += swayY;
    camTarget.x += mouseX * 0.05;
    camTarget.y += swayY * 0.4;

    camera.position.copy(camPos);
    camera.lookAt(camTarget);
    camera.fov = camFov;
    camera.setViewOffset(innerWidth, innerHeight, viewX, viewY, innerWidth, innerHeight);
  }

  /* ---------------------------------------------------------- boot + loop */
  let prog = 0;
  let qaSnap = null;
  let intro = instant || reduced ? 1 : 0;
  let introStart = 0;
  let introStarted = false;
  let glReady = false;
  let composer = null;
  let bloomPassRef = null;
  let last = performance.now();
  let elapsed = 0;
  let rafId = 0;
  let fellBack = false;
  let warmMs = 0;

  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2(-2, -2);
  let hoveredShard = null;
  let dragMoved = 0;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragShard = null;
  let dragFaq = null;
  let lastPointer = { x: 0, y: 0 };
  /* Hover raycasts and drag-to-turn are mouse affordances. On touch they would
     run on every finger move during a scroll and, worse, a finger that lands on
     the brain would have its scroll cancelled. Touch keeps native scrolling. */
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

  const tip = document.createElement("div");
  tip.id = "brain-tip";
  tip.setAttribute("aria-hidden", "true");
  document.body.appendChild(tip);

  const faqHud = document.createElement("div");
  faqHud.id = "faq-hud";
  faqHud.setAttribute("aria-hidden", "true");
  faqHud.innerHTML = `<span class="faq-hud-label">Doubts cleared</span><span class="faq-hud-count">0 / ${BRAIN_FAQS.length}</span><div class="faq-hud-bar"><i></i></div>`;
  document.body.appendChild(faqHud);

  function updateFaqProgress() {
    if (!brainState.faqCleared) return;
    const n = brainState.faqCleared.size;
    const total = BRAIN_FAQS.length;
    const countEl = faqHud.querySelector(".faq-hud-count");
    const bar = faqHud.querySelector(".faq-hud-bar i");
    if (countEl) countEl.textContent = `${n} / ${total}`;
    if (bar) bar.style.width = `${(n / total) * 100}%`;
    if (n >= total && !faqHud.classList.contains("done")) {
      faqHud.classList.add("done");
      tip.innerHTML = `<b>Mind cleared.</b><span>Every doubt answered — ready to build? Click to start a project.</span>`;
      tip.classList.add("on");
      if (brainState.brainMesh) brainState.brainMesh.material.emissiveIntensity = 0.35;
    }
  }

  function isUI(target) {
    return !!(target && target.closest && target.closest("a, button, input, textarea, select, #lead, #footer, #rail, #nav"));
  }

  function heroActive() {
    return prog * 7 < 0.55 && document.body.classList.contains("ready") && !document.body.classList.contains("lead-open");
  }

  function setHovered(shard) {
    hoveredShard = shard || null;
    if (brainState.shards) {
      brainState.shards.forEach((s) => {
        s.userData.hover = s === hoveredShard ? 1 : 0;
      });
    }
    if (hoveredShard) {
      tip.innerHTML = `<b>${hoveredShard.userData.name}</b><span>Click to explore · drag to turn</span>`;
      tip.classList.add("on");
    } else if (!hoveredFaq) {
      tip.classList.remove("on");
    }
  }

  let hoveredFaq = null;

  function setHoveredFaq(faq) {
    hoveredFaq = faq || null;
    if (faq) {
      tip.innerHTML = `<b>${faq.q}</b><span>${faq.a} · click to explore · drag to turn</span>`;
      tip.classList.add("on");
      if (brainState.brainMesh) brainState.brainMesh.material.emissiveIntensity = 0.18;
      if (brainState.faqCleared && faq) {
        const idx = BRAIN_FAQS.indexOf(faq);
        if (idx >= 0) brainState.faqCleared.add(idx);
        updateFaqProgress();
      }
    } else if (!hoveredShard) {
      tip.classList.remove("on");
      if (brainState.brainMesh) brainState.brainMesh.material.emissiveIntensity = 0;
    }
  }

  function updateHover(clientX, clientY) {
    lastPointer.x = clientX;
    lastPointer.y = clientY;
    if (!heroActive() || !STATIONS.length || brainState.dragging) {
      if (!brainState.dragging) { setHovered(null); setHoveredFaq(null); }
      return;
    }
    ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const shardHits = raycaster.intersectObjects(brainState.shards || [], false);
    if (shardHits.length) {
      setHovered(shardHits[0].object);
      setHoveredFaq(null);
    } else {
      setHovered(null);
      const brainHits = raycaster.intersectObject(brainState.brainMesh, false);
      if (brainHits.length) {
        const local = brainHits[0].point.clone();
        brainState.brainMesh.worldToLocal(local);
        const r = Math.sqrt(local.x * local.x + local.y * local.y + local.z * local.z) || 1;
        const theta = Math.atan2(local.z, local.x);
        const phi = Math.acos(clamp(local.y / r, -1, 1));
        setHoveredFaq(nearestFaq(theta, phi));
      } else {
        setHoveredFaq(null);
      }
    }
    const active = hoveredShard || hoveredFaq;
    if (active) {
      const x = Math.min(innerWidth - 260, clientX + 18);
      const y = Math.min(innerHeight - 90, clientY + 18);
      tip.style.left = `${x}px`;
      tip.style.top = `${y}px`;
    }
  }

  function onPointerDown(e) {
    if (!finePointer) return;
    if (e.button !== 0 || isUI(e.target) || !heroActive()) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(
      [brainState.brainMesh, ...(brainState.shards || [])],
      false
    );
    if (!hits.length) return;
    brainState.dragging = true;
    dragMoved = 0;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragShard = hoveredShard;
    dragFaq = hoveredFaq;
    setHovered(null);
    setHoveredFaq(null);
    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!finePointer) return;
    mouseX = (e.clientX / innerWidth - 0.5) * 2;
    mouseY = (e.clientY / innerHeight - 0.5) * 2;
    if (brainState.dragging) {
      const dx = e.clientX - dragStartX;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragMoved += Math.abs(dx) + Math.abs(e.movementY || 0);
      brainState.turn(dx);
      return;
    }
    updateHover(e.clientX, e.clientY);
  }

  function onPointerUp(e) {
    if (!brainState.dragging) return;
    brainState.dragging = false;
    if (dragMoved < 8 && dragShard && dragShard.userData.chapter) {
      const index = dragShard.userData.chapter;
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo({ top: (index / 7) * max, behavior: reduced ? "auto" : "smooth" });
    } else if (dragMoved < 8 && dragFaq && dragFaq.ch) {
      const index = dragFaq.ch;
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo({ top: (index / 7) * max, behavior: reduced ? "auto" : "smooth" });
    } else if (dragMoved < 8 && heroActive() && brainState.faqCleared && brainState.faqCleared.size >= BRAIN_FAQS.length) {
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo({ top: (7 / 7) * max, behavior: reduced ? "auto" : "smooth" });
    }
    dragShard = null;
    dragFaq = null;
    updateHover(e.clientX, e.clientY);
  }

  function onWindowClick(e) {
    if (fellBack || isUI(e.target)) return;
    const s = prog * 7;
    if (s < 3.4 || s > 4.6 || !workHits.length) return;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(workHits, false);
    if (hits.length) {
      const hit = hits[0].object;
      if (hit.userData.url) window.open(hit.userData.url, "_blank", "noopener");
    }
  }

  function readProgress() {
    if (qaSnap !== null) return qaSnap;
    if (forcedChapter !== null) return forcedChapter / 7;
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? clamp(window.scrollY / max) : 0;
  }

  function resize() {
    if (fellBack) return;
    const w = Math.max(1, innerWidth);
    const h = Math.max(1, innerHeight);
    renderer.setPixelRatio(currentPixelRatio());
    renderer.setSize(w, h, true);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    buildCameraPoses();
    if (composer) {
      composer.setPixelRatio(renderer.getPixelRatio());
      composer.setSize(w, h);
    }
  }

  /* Bloom is five blur passes and is invisible while the page is moving.
     Skipping it costs nothing visually and is the whole scroll budget.
     Nothing here touches the render targets, so no allocation can hitch.
     On phones the pass is skipped by default (the gold glow sprites still
     carry the look); ?bloom=1 turns it on, ?bloom=0 turns it off anywhere. */
  const bloomQuery = Q.get("bloom");
  let bloomAllowed = bloomQuery === "1" ? true : bloomQuery === "0" ? false : !isNarrow();
  let appliedScrolling = null;
  function syncScrollCost() {
    const scrolling = document.body.classList.contains("is-scrolling");
    if (scrolling === appliedScrolling) return;
    appliedScrolling = scrolling;
    if (bloomPassRef) bloomPassRef.enabled = bloomAllowed && !scrolling;
  }

  function useDomScene() {
    if (fellBack) return;
    fellBack = true;
    signalFallback();
    document.documentElement.classList.remove("gl-on");
    canvas.style.display = "none";
    if (tip.parentNode) tip.remove();
    if (faqHud.parentNode) faqHud.remove();
    if (rafId) cancelAnimationFrame(rafId);
    try {
      renderer.dispose();
    } catch (err) {
      /* already gone */
    }
  }

  function frame(now) {
    if (fellBack) return;
    rafId = requestAnimationFrame(frame);
    const rawDt = Math.max(0.001, (now - last) / 1000);
    const dt = Math.min(0.05, rawDt);
    last = now;
    elapsed += dt;

    syncScrollCost();
    renderer.info.reset();

    if (!introStarted && document.body.classList.contains("ready")) {
      introStarted = true;
      introStart = now;
      if (instant || reduced) intro = 1;
    }
    if (introStarted && intro < 1 && !instant && !reduced) {
      intro = clamp((now - introStart) / 4300);
      if (intro > 0.995) intro = 1;
    }

    const wanted = readProgress();
    if (forcedChapter !== null || reduced) {
      prog = wanted;
    } else {
      prog += (wanted - prog) * (1 - Math.exp(-dt * (intro < 1 ? 2.6 : 7.5)));
      if (Math.abs(wanted - prog) < 0.00004) prog = wanted;
    }

    const s = prog * 7;
    const time = elapsed;
    const fade = 0;

    const heroOn = heroActive();
    if (faqHud && faqHud.classList.contains("show") !== heroOn) {
      faqHud.classList.toggle("show", heroOn);
    }

    cameraPose(s, time, intro);
    applyOverviewFade(overviewFade);

    goldLight.position.lerp(
      tmpC.set(STATION_X, 1.55, -STATION_GAP * clamp(Math.round(s), 0, 7)),
      Math.min(1, dt * 4)
    );

    STATIONS.forEach((st, i) => {
      if (st.prop && st.prop.update && Math.abs(i - s) < 1.75) {
        st.prop.update(time, dt, intro, i === 0 ? fade : 0);
      }
    });

    dustUniforms.uTime.value = time;
    dustUniforms.uScale.value = innerHeight / (2 * Math.tan((camera.fov * Math.PI) / 360));

    if (composer) composer.render();
    else renderer.render(scene, camera);
    glReady = true;
    if (!document.documentElement.classList.contains("gl-on")) {
      document.documentElement.classList.add("gl-on");
    }
  }

  function warmUp() {
    const started = performance.now();
    const culled = [];
    scene.traverse((o) => {
      if (o.isMesh && o.frustumCulled) {
        culled.push(o);
        o.frustumCulled = false;
      }
    });
    const px = camera.position.clone();
    const pq = camera.quaternion.clone();
    const pf = camera.fov;
    camera.position.set(STATION_X, 1.7, STATION_GAP * 0.5);
    camera.fov = 50;
    camera.updateProjectionMatrix();
    camera.lookAt(STATION_X, 1.2, -STATION_GAP * 3);
    camera.updateMatrixWorld(true);
    renderer.setRenderTarget(null);
    renderer.render(scene, camera);
    camera.position.copy(px);
    camera.quaternion.copy(pq);
    camera.fov = pf;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    culled.forEach((o) => {
      o.frustumCulled = true;
    });
    warmMs = Math.round(performance.now() - started);
  }

  function init() {
    buildWorld();
    resize();

    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(Math.max(1, innerWidth), Math.max(1, innerHeight)),
      0.14,
      0.2,
      0.95
    );
    bloomPassRef = bloomPass;
    bloomPass.enabled = bloomAllowed;
    composer.addPass(bloomPass);

    composer.addPass(new OutputPass());
    composer.setSize(innerWidth, innerHeight);

    warmUp();

    addEventListener("resize", resize, { passive: true });
    addEventListener("pointermove", onPointerMove, { passive: true });
    addEventListener("pointerdown", onPointerDown, { passive: false });
    addEventListener("pointerup", onPointerUp, { passive: true });
    addEventListener("pointercancel", onPointerUp, { passive: true });
    addEventListener("click", onWindowClick);

    prog = instant || reduced ? readProgress() : readProgress();
    last = performance.now();
    rafId = requestAnimationFrame(frame);

    window.__sceneQA = {
      get prog() {
        return prog;
      },
      get intro() {
        return intro;
      },
      get poses() {
        return POSES.map(p => ({ x: +p.pos.x.toFixed(2), y: +p.pos.y.toFixed(2), z: +p.pos.z.toFixed(2), fov: p.fov }));
      },
      get cam() {
        return { x: camera.position.x, y: camera.position.y, z: camera.position.z, fov: camera.fov };
      },


      get stations() {
        return STATIONS.map(s => ({ id: s.id, pos: { x: s.group.position.x, y: s.group.position.y, z: s.group.position.z } }));
      },



      snap(v) {
        qaSnap = clamp(v);
        prog = qaSnap;
      },
      unsnap() {
        qaSnap = null;
      },
      shard(i) {
        const shard = brainState.shards && brainState.shards[i];
        if (!shard) return null;
        return shard.userData.name;
      },
      dividers() {
        return bayDividers.map((div, i) => {
          let op = null;
          div.traverse((o) => {
            if (o.isMesh && op === null) op = o.material.opacity;
          });
          return { i, op };
        });
      },
      /* QA only: lock a fixed render scale. This reallocates the composer's
         buffers, so it must never be called during a live scroll gesture. */
      setQuality(v) {
        qualityScale = clamp(Number(v) || 1, 0.4, 1.5);
        resize();
        if (bloomPassRef) bloomPassRef.enabled = bloomAllowed;
      },
      bloom(on) {
        bloomAllowed = !!on;
        if (bloomPassRef) bloomPassRef.enabled = bloomAllowed && appliedScrolling !== true;
      },
      fallback: useDomScene,
      stats() {
        const r = renderer.info.render;
        return {
          calls: r.calls,
          triangles: r.triangles,
          points: r.points,
          lines: r.lines,
          dpr: +renderer.getPixelRatio().toFixed(3),
          buffer: [canvas.width, canvas.height],
          bloom: !!(bloomPassRef && bloomPassRef.enabled),
          warmMs
        };
      },
      probe(i = 0) {
        const st = STATIONS[i];
        const pts = [];
        if (i === 0) collectPropPoints(brainState.brainMesh, pts);
        else collectPropPoints(st.prop.group, pts);
        const box = new THREE.Box3().setFromPoints(pts);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const rest = CAM_REST[i];
        const dir = new THREE.Vector3(
          rest.p[0] - rest.t[0],
          rest.p[1] - rest.t[1],
          rest.p[2] - rest.t[2]
        ).normalize();
        const dist = POSES[i].pos.distanceTo(POSES[i].aim);
        aimFitCamera(center, dir, dist, rest.fov, camera.aspect);
        const pb = projectBounds(pts, fitCam);
        return {
          n: pts.length,
          center: { x: center.x, y: center.y, z: center.z },
          size: { x: size.x, y: size.y, z: size.z },
          dist,
          spanX: pb.maxx - pb.minx,
          spanY: pb.maxy - pb.miny,
          frameW: CAM_FRAME[i].w,
          frameH: CAM_FRAME[i].h,
          view: { x: POSES[i].viewX, y: POSES[i].viewY }
        };
      }
    };
  }

  init();
})();
