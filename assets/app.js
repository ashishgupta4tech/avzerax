/* ============================================================
   AVZERA — studio experience
   Front-end only. No backend, no storage, no tracking.
   ============================================================ */
(() => {
  "use strict";

  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search);
  const skipIntro = params.has("skipintro") || params.get("intro") === "0";
  const startChapter = clamp(Number.parseInt(params.get("chapter") || "0", 10) || 0, 0, 7);
  if (params.has("instant")) document.documentElement.classList.add("instant");

  /* ---------------------------------------------------------- chapters */
  const chapters = [
    {
      obj: "hero",
      rail: "THE SEARCH",
      section: "01 / THE SEARCH",
      kicker: "A STORY IN EIGHT ROOMS · 9:42 PM",
      title: "Someone is searching<br>for a business<br>like <em>yours.</em>",
      body: "Priya needs a salon. She searches 'salon near me' and picks who looks alive. 73%+ of local customers start on Google Maps. AVZERA makes your business the easiest choice in Raipur, Bhilai and Durg.",
      cta: "Start with a free audit",
      action: "lead",
      hint: "A COMPOSITE STORY · HOVER THE BRAIN"
    },
    {
      obj: "website",
      rail: "THE CLICK",
      section: "02 / THE CLICK",
      kicker: "THE WEBSITE · 9:43 PM",
      title: "She taps your site.<br>Six <em>seconds.</em>",
      body: "30 MB WordPress themes take 4–6s; 53% leave before seeing your number. AVZERA ships a 0.38s-class HTML5 site on an edge CDN — number above the fold, one-tap WhatsApp, vCard save. Page weight checked before launch.",
      cta: "Fix the first impression",
      action: "lead",
      hint: "SCROLL TO THE NEXT ROOM"
    },
    {
      obj: "google",
      rail: "THE MAP",
      section: "03 / THE MAP",
      kicker: "GOOGLE PROFILE · 9:46 PM",
      title: "Open. But not<br>exactly <em>alive.</em>",
      body: "Missing hours, old photos, unanswered reviews — your rival looks alive. AVZERA calibrates categories, writes a landmark bio, geotags photos, builds review flow. Zero Password Protocol: no password needed.",
      cta: "Get a free profile check",
      action: "lead",
      hint: "SCROLL TO THE NEXT ROOM"
    },
    {
      obj: "ai",
      rail: "2 AM MESSAGE",
      section: "04 / 2 AM MESSAGE",
      kicker: "WHATSAPP & AI · 10:47 PM",
      title: "She messages at 10:47.<br>Nobody <em>answers.</em>",
      body: "Priya messaged at 10:47; nobody answered; she booked elsewhere. AVZERA's 24/7 receptionist replies in seconds, answers Hindi/English calls, recovers missed calls, syncs leads to Sheets. No new SIM.",
      cta: "Automate your enquiries",
      action: "lead",
      hint: "SCROLL TO THE NEXT ROOM"
    },
    {
      obj: "work",
      rail: "THE FIX",
      section: "05 / THE FIX",
      kicker: "LIVE WORK · ONE WEEK LATER",
      title: "Found. Answered.<br><em>Booked.</em>",
      body: "Four live builds, each labelled. Vivanz (Bhilai): 200-pax banquet + direct WhatsApp. Liora: 0.38s booking, bypasses OTA cuts. SpeakMark: 60s voice coach. Mira: Hindi/English skin triage. No fake reviews.",
      cta: "Build this for my business",
      action: "lead",
      hint: "TAP A CARD TO OPEN THE LIVE SITE · SCROLL"
    },
    {
      obj: "process",
      rail: "THE WEEK",
      section: "06 / THE WEEK",
      kicker: "THE 40/60 SPRINT · DAY 1 TO LAUNCH",
      title: "One clear sprint.<br>No <em>surprises.</em>",
      body: "40% kickoff locks 3–4 monthly slots. Staging link in 24–48h. You test 7 days; 60% due only after satisfaction. Build in 5–7 days. We need 3 things: name+phone, 4–5 photos, 5 minutes to click. Packages ₹9,999 · ₹14,999 · ₹24,999.",
      cta: "Book a free audit",
      action: "lead",
      hint: "SCROLL TO THE NEXT ROOM"
    },
    {
      obj: "visit",
      rail: "THE FOUNDER",
      section: "07 / THE FOUNDER",
      kicker: "FOUNDER-LED · BHILAI, CHHATTISGARH",
      title: "The person who replies<br>is the one who <em>builds.</em>",
      body: "I'm Vikas Vivan, founder, Avantibai Chowk, Bhilai. 100% remote studio. No account manager, no password handover (Zero Password Protocol). WhatsApp +91 78983 32744 reaches the person who builds. 3–4 slots/month.",
      cta: "WhatsApp the founder",
      action: "whatsapp",
      hint: "SCROLL TO THE NEXT ROOM"
    },
    {
      obj: "contact",
      rail: "YOUR TURN",
      section: "08 / YOUR TURN",
      kicker: "FREE AUDIT · YOUR TURN",
      title: "Next Saturday,<br>let them find <em>you.</em>",
      body: "Free 15-min audit, written plan, fixed quote. 100% Remote Studio • 3–4 sprint slots/month — real capacity, not a countdown. No fake rankings, reviews, toasts or countdowns. WhatsApp or call +91 78983 32744, or hello@avzera.com.",
      cta: "Book a free audit",
      action: "lead",
      hint: "THE STORY ENDS · YOURS STARTS"
    }
  ];

  const WA_URL = "https://wa.me/917898332744";
  const WA_TEXT = encodeURIComponent("Hi AVZERA, I want a free audit for my business.");

  // open the lead sheet with the service the current story room is about
  const SERVICE_BY_OBJ = {
    hero: "All three",
    website: "Website",
    google: "Google profile",
    ai: "WhatsApp / AI",
    work: "All three",
    process: "All three",
    visit: "All three",
    contact: "All three"
  };

  /* ---------------------------------------------------------- refs */
  const body = document.body;
  const loader = $("#loader");
  const pctEl = $("#pct");
  const copyEl = $("#copy");
  const kickerEl = $("#kicker");
  const titleEl = $("#title");
  const bodyEl = $("#body");
  const ctaEl = $("#copy-cta");
  const waEl = $("#copy-wa");
  const sectionEl = $("#section");
  const railEl = $("#rail");
  const progressFill = $("#progress i");
  const progressEm = $("#progress em");
  const scrollCue = $("#scrollcue");
  const objStage = $("#objStage");
  const live = $("#live");
  const soundBtn = $("#sound");
  const lead = $("#lead");
  const leadForm = $("#lead-form");
  const leadName = $("#lead-name");
  const leadBiz = $("#lead-biz");
  const leadPhone = $("#lead-phone");
  const leadMsg = $("#lead-msg");
  const leadConsent = $("#lead-consent");
  const leadErr = $("#lead-err");

  let current = 0;
  let entered = false;
  let soundOn = localStorage.getItem("avzera-sound") !== "off";
  let audio = null;
  let copyTimer = 0;
  let lastFocus = null;

  /* ---------------------------------------------------------- brain texture */
  function mulberry32(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function drawBrain() {
    const sulci = $("#sulci");
    const cracks = $("#cracks");
    if (!sulci || !cracks) return;

    const rand = mulberry32(42024);
    const NS = "http://www.w3.org/2000/svg";
    const wrinkles = [];

    for (let i = 0; i < 46; i++) {
      const base = 82 + rand() * 392;
      const amp = 5 + rand() * 20;
      const amp2 = 2 + rand() * 8;
      const freq = 0.012 + rand() * 0.026;
      const phase = rand() * Math.PI * 2;
      const phase2 = rand() * Math.PI * 2;
      const step = 16 + rand() * 14;
      const pts = [];

      for (let x = -30; x <= 680; x += step) {
        const y =
          base +
          Math.sin(x * freq + phase) * amp +
          Math.sin(x * (freq * 2.35) + phase2) * amp2 +
          (rand() - 0.5) * 4;
        pts.push([x, y]);
      }

      let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
      for (let p = 1; p < pts.length - 1; p++) {
        const xc = (pts[p][0] + pts[p + 1][0]) / 2;
        const yc = (pts[p][1] + pts[p + 1][1]) / 2;
        d += `Q${pts[p][0].toFixed(1)} ${pts[p][1].toFixed(1)} ${xc.toFixed(1)} ${yc.toFixed(1)}`;
      }

      const width = 4.5 + rand() * 7;
      const dark = 30 + Math.floor(rand() * 22);
      const shade = `rgb(${dark + 6},${dark + 5},${dark + 2})`;
      const light = `rgba(108,104,96,${0.16 + rand() * 0.24})`;

      const trench = document.createElementNS(NS, "path");
      trench.setAttribute("d", d);
      trench.setAttribute("stroke", shade);
      trench.setAttribute("stroke-width", width.toFixed(1));
      trench.setAttribute("opacity", (0.62 + rand() * 0.3).toFixed(2));
      sulci.appendChild(trench);

      const edge = document.createElementNS(NS, "path");
      edge.setAttribute("d", d);
      edge.setAttribute("stroke", light);
      edge.setAttribute("stroke-width", (1 + rand() * 1.6).toFixed(1));
      edge.setAttribute("transform", `translate(0 ${(-width * 0.52).toFixed(1)})`);
      edge.setAttribute("opacity", "0.75");
      sulci.appendChild(edge);

      wrinkles.push({ d, base, pts });
    }

    // little forks, so it reads as folds rather than stripes
    for (let i = 0; i < 26; i++) {
      const w = wrinkles[Math.floor(rand() * wrinkles.length)];
      const p = w.pts[Math.floor(rand() * w.pts.length)];
      const dir = rand() > 0.5 ? 1 : -1;
      const len = 34 + rand() * 70;
      const d = `M${p[0].toFixed(1)} ${p[1].toFixed(1)}q${(dir * 16).toFixed(1)} ${(10 + rand() * 18).toFixed(1)} ${(dir * len * 0.5).toFixed(1)} ${(rand() * 22 - 4).toFixed(1)}`;
      const f = document.createElementNS(NS, "path");
      f.setAttribute("d", d);
      f.setAttribute("stroke", "rgb(38,38,35)");
      f.setAttribute("stroke-width", (3.4 + rand() * 4).toFixed(1));
      f.setAttribute("opacity", "0.72");
      sulci.appendChild(f);
    }

    // gold seams: sharp, a little electrical
    for (let i = 0; i < 11; i++) {
      const startX = 70 + rand() * 500;
      const startY = 64 + rand() * 250;
      const count = 4 + Math.floor(rand() * 5);
      let x = startX;
      let y = startY;
      let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
      for (let s = 0; s < count; s++) {
        x += (rand() - 0.38) * 58;
        y += 18 + rand() * 42;
        d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      const seam = document.createElementNS(NS, "path");
      seam.setAttribute("d", d);
      seam.setAttribute("stroke-width", (1 + rand() * 1.5).toFixed(1));
      seam.setAttribute("opacity", (0.4 + rand() * 0.5).toFixed(2));
      seam.style.animationDelay = `${(rand() * 5).toFixed(2)}s`;
      cracks.appendChild(seam);

      if (rand() > 0.35) {
        const branch = document.createElementNS(NS, "path");
        const bx = x;
        const by = y - 8;
        branch.setAttribute(
          "d",
          `M${bx.toFixed(1)} ${by.toFixed(1)}l${((rand() - 0.5) * 52).toFixed(1)} ${(18 + rand() * 36).toFixed(1)}`
        );
        branch.setAttribute("stroke-width", (0.7 + rand()).toFixed(1));
        branch.setAttribute("opacity", (0.3 + rand() * 0.4).toFixed(2));
        branch.style.animationDelay = `${(rand() * 5).toFixed(2)}s`;
        cracks.appendChild(branch);
      }
    }
  }

  /* ---------------------------------------------------------- gold dust */
  function startDust() {
    if (reduced) return;
    const canvas = $("#dust");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let particles = [];
    let raf = 0;

    function resize() {
      dpr = Math.min(1.25, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(clamp((w * h) / 42000, 10, 38));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.5 + Math.random() * 1.6,
        vy: -0.08 - Math.random() * 0.22,
        vx: (Math.random() - 0.5) * 0.12,
        a: 0.12 + Math.random() * 0.4,
        p: Math.random() * Math.PI * 2
      }));
    }

    function frame(t) {
      raf = requestAnimationFrame(frame);
      // the previous frame stays on screen; nothing needs to move mid-scroll
      if (body.classList.contains("is-scrolling") || document.hidden) return;
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(t * 0.00035 + p.p) * 0.05;
        if (p.y < -8) {
          p.y = h + 8;
          p.x = Math.random() * w;
        }
        if (p.x < -8) p.x = w + 8;
        if (p.x > w + 8) p.x = -8;
        const twinkle = 0.65 + Math.sin(t * 0.0012 + p.p) * 0.35;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(176, 126, 48, ${(p.a * twinkle).toFixed(3)})`;
        ctx.fill();
      }
    }

    resize();
    addEventListener("resize", resize, { passive: true });
    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        raf = requestAnimationFrame(frame);
      }
    });
  }

  /* ---------------------------------------------------------- audio */
  function buildAudio() {
    if (audio) return audio;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 720;
      filter.Q.value = 0.7;
      filter.connect(master);

      // a soft, warm pad (low roots + a gentle fifth)
      [110, 164.81, 220, 329.63].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = i === 2 ? "triangle" : "sine";
        osc.frequency.value = freq;
        osc.detune.value = (i - 1) * 4;
        const g = ctx.createGain();
        g.gain.value = i === 3 ? 0.04 : i === 2 ? 0.06 : 0.11;
        osc.connect(g);
        g.connect(filter);
        osc.start();
      });

      // slow breathing filter
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.06;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 180;
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);
      lfo.start();

      audio = { ctx, master };
      return audio;
    } catch (e) {
      return null;
    }
  }

  // one-shot cues, synthesised (no audio files) so the clone stays front-end only
  function playCue(name, opts = {}) {
    if (!soundOn) return;
    const a = audio || buildAudio();
    if (!a || !a.ctx) return;
    const ctx = a.ctx;
    if (ctx.state === "suspended") ctx.resume();
    const now = ctx.currentTime;
    const master = a.master;
    const gain = opts.gain ?? 0.5;

    const tone = (freq, dur, type = "sine", attack = 0.02, peak = gain, decay = 0.9, rate = 1) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      if (rate !== 1) osc.frequency.exponentialRampToValueAtTime(freq * rate, now + dur);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), now + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur + decay);
      osc.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + dur + decay + 0.05);
    };
    const noise = (dur, peak = gain) => {
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = "lowpass";
      filt.frequency.value = 1400;
      const g = ctx.createGain();
      g.gain.value = peak;
      src.connect(filt);
      filt.connect(g);
      g.connect(master);
      src.start(now);
      src.stop(now + dur + 0.05);
    };

    if (name === "dust") noise(1.6, 0.18);
    else if (name === "seams") { tone(300, 0.25, "sine", 0.04, 0.18); tone(450, 0.25, "sine", 0.04, 0.12); }
    else if (name === "form") { tone(80, 0.9, "sine", 0.08, 0.22); tone(120, 0.9, "triangle", 0.08, 0.14); tone(160, 0.9, "sine", 0.08, 0.1); }
    else if (name === "bloom") { tone(1200, 0.5, "sine", 0.02, 0.16); tone(1600, 0.5, "sine", 0.02, 0.1); }
    else if (name === "sweep") tone(220, 1.1, "sine", 0.05, 0.14, 0.6, 4.2);
    else if (name === "tick") tone(880, 0.06, "sine", 0.005, 0.12);
    else if (name === "arrive") { tone(660, 0.4, "sine", 0.03, 0.14); tone(990, 0.4, "sine", 0.03, 0.08); }
    else if (name === "crack") noise(0.25, 0.14);
    else if (name === "chime") { tone(1046.5, 0.6, "sine", 0.02, 0.12); tone(1318.5, 0.6, "sine", 0.02, 0.08); }
    else if (name === "toggle") tone(523.25, 0.12, "sine", 0.01, 0.14);
    else if (name === "lift") tone(440, 0.18, "sine", 0.02, 0.1, 0.14);
    else if (name === "mend" || name === "settle") { tone(523.25, 0.3, "sine", 0.03, 0.1); tone(659.25, 0.3, "sine", 0.03, 0.08); }
  }


  function updateSoundUI() {
    soundBtn.classList.toggle("on", soundOn);
    soundBtn.setAttribute("aria-pressed", String(soundOn));
    soundBtn.setAttribute("aria-label", soundOn ? "Sound is on" : "Sound is off");
    $("span", soundBtn).textContent = soundOn ? "SOUND ON" : "SOUND OFF";
    const note = $("#enter-note");
    if (note) note.textContent = soundOn ? "Sound on" : "Sound off";
  }

  function setSound(on, gesture = false) {
    soundOn = on;
    localStorage.setItem("avzera-sound", on ? "on" : "off");
    const a = on ? buildAudio() : audio;
    if (on && a) {
      if (a.ctx.state === "suspended") a.ctx.resume();
      a.master.gain.cancelScheduledValues(a.ctx.currentTime);
      a.master.gain.setValueAtTime(a.master.gain.value, a.ctx.currentTime);
      a.master.gain.linearRampToValueAtTime(0.026, a.ctx.currentTime + (gesture ? 1.6 : 0.8));
    } else if (a) {
      a.master.gain.cancelScheduledValues(a.ctx.currentTime);
      a.master.gain.setValueAtTime(a.master.gain.value, a.ctx.currentTime);
      a.master.gain.linearRampToValueAtTime(0, a.ctx.currentTime + 0.45);
    }
    updateSoundUI();
  }

  soundBtn.addEventListener("click", () => setSound(!soundOn, true));
  document.addEventListener("visibilitychange", () => {
    if (!audio) return;
    if (document.hidden) audio.ctx.suspend();
    else if (soundOn) audio.ctx.resume();
  });

  /* ---------------------------------------------------------- loader */
  function armLoader() {
    if (reduced) {
      pctEl.textContent = "100";
      loader.classList.add("gate");
      return;
    }
    const start = performance.now();
    const total = 1500;
    function frame(now) {
      const t = clamp((now - start) / total, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      pctEl.textContent = String(Math.round(eased * 100)).padStart(3, "0");
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        pctEl.textContent = "100";
        loader.classList.add("gate");
      }
    }
    requestAnimationFrame(frame);
  }

  function finishEnter() {
    if (body.classList.contains("ready")) return;
    loader.classList.add("gone");
    loader.classList.remove("building");
    body.classList.remove("locked");
    body.classList.add("ready");
    loader.setAttribute("aria-hidden", "true");
    live.textContent = "Welcome to AVZERA. Scroll to explore.";
    setTimeout(() => {
      loader.style.display = "none";
    }, 1300);
    onScroll(true);
    if (skipIntro && startChapter > 0) {
      if (params.has("noScroll")) {
        setChapter(startChapter, true);
      } else {
        const max = document.documentElement.scrollHeight - innerHeight;
        window.scrollTo(0, (startChapter / (chapters.length - 1)) * max);
        onScroll(true);
      }
    }
    /* Only the WebGL scene has timed cues; on the CSS fallback this rAF loop
       would otherwise spin forever doing nothing. */
    if (document.documentElement.classList.contains("gl-on")) watchIntro();
  }

  /* Cheap GPU probe before committing to a 1.3 MB 3D download. Weak desktop
     GPUs and software rasterisers go straight to the CSS room with no wait.
     ?gl=force still forces the WebGL attempt. The result is memoised: probing
     creates a throwaway WebGL context, so it must only happen once. */
  let gpuWeak;
  function weakGpu() {
    if (gpuWeak !== undefined) return gpuWeak;
    gpuWeak = (() => {
      try {
        const probe = document.createElement("canvas");
        const gl = probe.getContext("webgl2") || probe.getContext("webgl") || probe.getContext("experimental-webgl");
        if (!gl) return true;
        const ext = gl.getExtension("WEBGL_debug_renderer_info");
        const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : "";
        const lose = gl.getExtension("WEBGL_lose_context");
        if (lose) lose.loseContext();
        if (/swiftshader|llvmpipe|softpipe|software|basic render/i.test(name)) return true;
        const narrow = innerWidth < 820 || matchMedia("(pointer: coarse)").matches;
        return !narrow && /intel.*\b(hd|uhd) graphics/i.test(name);
      } catch (err) {
        return true;
      }
    })();
    return gpuWeak;
  }

  /* The 3D module can give up before the visitor clicks (hover preload on a
     GPU that only reveals itself at render time). Remember that decision so
     the entry screen does not wait out its safety timeout for a room that
     will never draw. */
  let sceneFellBack = false;
  document.addEventListener("avzera:scene-fallback", () => {
    sceneFellBack = true;
  });

  function enterSite() {
    if (entered) return;
    entered = true;
    // unlock audio on the actual gesture, before any waiting
    if (soundOn) setSound(true, true);

    if (params.has("nogl") || sceneFellBack) {
      finishEnter();
      return;
    }

    /* Keep the entry screen up until the 3D room draws its first frame, so the
       visitor never sees the temporary CSS room on the way in. The timeout is
       the safety net for a failed/blocked WebGL context. */
    loader.classList.add("building");
    const enterNote = $("#enter-note");
    if (enterNote) enterNote.textContent = "Preparing the room";
    let done = false;
    const root = document.documentElement;
    const finish = () => {
      if (done) return;
      done = true;
      observer.disconnect();
      document.removeEventListener("avzera:scene-fallback", finish);
      clearTimeout(safety);
      finishEnter();
    };
    const observer = new MutationObserver(() => {
      if (root.classList.contains("gl-on")) finish();
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("avzera:scene-fallback", finish);
    const safety = setTimeout(finish, 12000);

    // a hover/touch preload may have finished the room before the click
    if (root.classList.contains("gl-on")) {
      finish();
      return;
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      loadScene3D().then((loaded) => {
        if (!loaded) finish();
        else if (sceneFellBack || root.classList.contains("gl-on")) finish();
      });
    }));
  }

  /* The 3D room is deliberately loaded after the visitor enters. Importing
     Three.js and building the scene during first paint costs seconds of main
     thread on a phone. */
  const SCENE_URL = "assets/scene3d.js?v=20261119-4";
  let sceneLoad = null;
  function loadScene3D() {
    if (sceneLoad) return sceneLoad;
    if (params.has("nogl")) return Promise.resolve(false);
    sceneLoad = import(new URL(SCENE_URL, document.baseURI).href).then(() => true).catch(() => {
      sceneLoad = null;
      return false;
    });
    return sceneLoad;
  }

  /* A deliberate click is the real request. Starting the download on the way
     to the button (mouse hover, finger down) hides most of the wait without
     making anyone pay for a scene they never asked to see. */
  const enterBtn = $("#enter");
  const preloadScene = () => {
    if (params.has("nogl")) return;
    loadScene3D();
  };
  enterBtn.addEventListener("pointerenter", preloadScene, { once: true, passive: true });
  enterBtn.addEventListener("pointerdown", preloadScene, { once: true, passive: true });

  // one-shot cues for the brain's birth, timed to the intro progress
  function watchIntro() {
    const fired = { dust: false, seams: false, form: false, bloom: false, sweep: false };
    const tick = () => {
      if (!entered) return;
      const intro = (window.__sceneQA && typeof window.__sceneQA.intro === "number") ? window.__sceneQA.intro : 0;
      if (!fired.dust && intro >= 0.15 / 4.3) { fired.dust = true; playCue("dust", { gain: 0.18 }); }
      if (!fired.seams && intro >= 0.85 / 4.3) { fired.seams = true; playCue("seams", { gain: 0.16 }); }
      if (!fired.form && intro >= 2.45 / 4.3) { fired.form = true; playCue("form", { gain: 0.18 }); }
      if (!fired.bloom && intro >= 2.55 / 4.3) { fired.bloom = true; playCue("bloom", { gain: 0.16 }); }
      if (!fired.sweep && intro >= 3.9 / 4.3) { fired.sweep = true; playCue("sweep", { gain: 0.14 }); }
      if (intro < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  $("#enter").addEventListener("click", enterSite);
  loader.addEventListener("click", (e) => {
    if (loader.classList.contains("gate")) enterSite();
  });
  addEventListener(
    "keydown",
    (e) => {
      if (!entered && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        enterSite();
      }
    },
    true
  );

  /* ---------------------------------------------------------- copy */
  function applyCopy(i) {
    const c = chapters[i];
    kickerEl.textContent = c.kicker;
    titleEl.innerHTML = c.title;
    bodyEl.textContent = c.body;
    ctaEl.textContent = c.cta;
    sectionEl.textContent = c.section;
    scrollCue.textContent = c.hint;
    // one primary action at a time, as in the reference layout
    waEl.hidden = true;
    ctaEl.dataset.action = c.action;
  }

  function setChapter(i, immediate = false) {
    i = clamp(i, 0, chapters.length - 1);
    if (i === current && !immediate) return;

    current = i;
    const c = chapters[i];

    $$(".obj", objStage).forEach((el) => {
      el.classList.toggle("active", el.dataset.obj === c.obj);
    });

    $$("#rail button").forEach((b, bi) => {
      b.classList.toggle("on", bi === i);
      b.classList.toggle("done", bi < i);
      b.setAttribute("aria-current", bi === i ? "true" : "false");
    });

    body.classList.toggle("closing", i === chapters.length - 1);
    body.dataset.chapter = c.obj;

    if (immediate) {
      applyCopy(i);
      copyEl.classList.remove("out");
      return;
    }

    clearTimeout(copyTimer);
    copyEl.classList.add("out");
    copyTimer = setTimeout(() => {
      applyCopy(i);
      copyEl.classList.remove("out");
    }, 240);
  }

  /* ---------------------------------------------------------- rail */
  chapters.forEach((c, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<span>${c.rail}</span><i aria-hidden="true"></i>`;
    b.setAttribute("aria-label", `Go to ${c.rail}`);
    b.addEventListener("click", () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const top = (i / (chapters.length - 1)) * max;
      window.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
    });
    railEl.appendChild(b);
  });

  /* ---------------------------------------------------------- scroll */
  let lastPct = -1;
  let lastIndex = -1;
  let scrollIdle = 0;
  let scrollRaf = 0;
  let latestScrollY = 0;
  const supportsScrollTimeline = (typeof CSS !== "undefined" && CSS.supports && CSS.supports("animation-timeline", "scroll()"));

  function renderScroll() {
    scrollRaf = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    const y = latestScrollY;
    const p = max > 0 ? clamp(y / max, 0, 1) : 0;
    const i = Math.round(p * (chapters.length - 1));
    const pct = p * 100;

    if (!supportsScrollTimeline && (lastPct < 0 || Math.abs(pct - lastPct) > 0.5)) {
      lastPct = pct;
      progressFill.style.transform = `scaleX(${p.toFixed(5)})`;
    }
    if (i !== lastIndex) {
      lastIndex = i;
      progressEm.style.left = `${pct.toFixed(2)}%`;
      progressEm.textContent = String(i + 1).padStart(2, "0");
    }

    const scrolled = y > 32;
    if (body.classList.contains("scrolled") !== scrolled) {
      body.classList.toggle("scrolled", scrolled);
    }

    if (!body.classList.contains("is-scrolling")) body.classList.add("is-scrolling");
    clearTimeout(scrollIdle);
    scrollIdle = setTimeout(() => body.classList.remove("is-scrolling"), 150);

    setChapter(i);
  }

  function onScroll(immediate = false) {
    latestScrollY = window.scrollY || window.pageYOffset || 0;
    if (immediate) {
      if (scrollRaf) {
        cancelAnimationFrame(scrollRaf);
        scrollRaf = 0;
      }
      renderScroll();
      return;
    }
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(renderScroll);
  }

  addEventListener(
    "scroll",
    () => {
      latestScrollY = window.scrollY || window.pageYOffset || 0;
      if (scrollRaf) return;
      scrollRaf = requestAnimationFrame(renderScroll);
    },
    { passive: true }
  );

  addEventListener("resize", () => {
    onScroll(true);
  });

  /* ---------------------------------------------------------- pointer parallax */
  if (!reduced && matchMedia("(hover: hover)").matches) {
    let px = 0;
    let py = 0;
    let pRaf = 0;
    addEventListener(
      "pointermove",
      (e) => {
        px = (e.clientX / innerWidth - 0.5) * 2;
        py = (e.clientY / innerHeight - 0.5) * 2;
        if (pRaf) return;
        pRaf = requestAnimationFrame(() => {
          pRaf = 0;
          objStage.style.setProperty("--mx", px.toFixed(3));
          objStage.style.setProperty("--my", py.toFixed(3));
        });
      },
      { passive: true }
    );
  }

  /* ---------------------------------------------------------- lead sheet */
  function selectService(service) {
    $$(".chip", leadForm).forEach((c) => {
      c.setAttribute("aria-checked", String(c.dataset.service === service));
    });
  }

  function openLead(from, service) {
    lastFocus = from || document.activeElement;
    if (service) selectService(service);
    lead.classList.add("open");
    lead.setAttribute("aria-hidden", "false");
    body.classList.add("lead-open");
    document.documentElement.style.overflow = "hidden";
    setTimeout(() => leadName.focus(), 260);
  }

  function closeLead() {
    lead.classList.remove("open");
    lead.setAttribute("aria-hidden", "true");
    body.classList.remove("lead-open");
    document.documentElement.style.overflow = "";
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  $$("[data-open-lead]").forEach((b) => {
    b.addEventListener("click", () => openLead(b, "All three"));
  });

  ctaEl.addEventListener("click", (e) => {
    if (ctaEl.dataset.action === "whatsapp") {
      window.open(`${WA_URL}?text=${WA_TEXT}`, "_blank", "noopener");
    } else {
      openLead(e.currentTarget, SERVICE_BY_OBJ[chapters[current].obj]);
    }
  });

  $$("[data-close-lead]").forEach((b) => b.addEventListener("click", closeLead));

  $$(".chip", leadForm).forEach((chip) => {
    chip.addEventListener("click", () => {
      $$(".chip", leadForm).forEach((c) => c.setAttribute("aria-checked", String(c === chip)));
    });
  });

  leadPhone.addEventListener("input", () => {
    leadPhone.value = leadPhone.value.replace(/\D/g, "").slice(0, 10);
  });

  [leadName, leadPhone].forEach((input) => {
    input.addEventListener("input", () => {
      input.closest(".field").classList.remove("bad");
      leadErr.hidden = true;
    });
  });

  if (leadConsent) {
    leadConsent.addEventListener("change", () => {
      leadConsent.closest(".consent").classList.remove("bad");
      leadErr.hidden = true;
    });
  }

  leadForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = leadName.value.trim();
    const biz = leadBiz.value.trim();
    const phone = leadPhone.value.replace(/\D/g, "");
    const extra = leadMsg.value.trim();
    const service = ($(".chip[aria-checked='true']", leadForm) || {}).dataset?.service || "Website";
    const consent = !leadConsent || leadConsent.checked;

    let bad = false;
    if (name.length < 2) {
      leadName.closest(".field").classList.add("bad");
      bad = true;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      leadPhone.closest(".field").classList.add("bad");
      bad = true;
    }
    if (!consent) {
      leadConsent.closest(".consent").classList.add("bad");
      bad = true;
    }
    leadErr.textContent = bad ? "Please check the fields marked above." : "";
    leadErr.hidden = !bad;
    if (bad) {
      if (!consent) leadConsent.focus();
      else (name.length < 2 ? leadName : leadPhone).focus();
      return;
    }

    const message = [
      `Hi AVZERA! I'm ${name}${biz ? ` from ${biz}` : ""}.`,
      `I need help with: ${service}.`,
      `My WhatsApp: +91 ${phone}.`,
      extra ? `A bit more: ${extra}` : "",
      "I'd like the free audit first.",
      "I agree to be contacted on WhatsApp about this enquiry."
    ]
      .filter(Boolean)
      .join(" ");

    live.textContent = "Opening WhatsApp with your message.";
    window.open(`${WA_URL}?text=${encodeURIComponent(message)}`, "_blank", "noopener");
    closeLead();
  });

  document.addEventListener("keydown", (e) => {
    if (!lead.classList.contains("open")) return;
    if (e.key === "Escape") {
      closeLead();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = $$(
      "button, [href], input, textarea, select, [tabindex]:not([tabindex='-1'])",
      lead
    ).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  /* ---------------------------------------------------------- nav shortcuts */
  $$("[data-goto]").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      const i = Number(a.dataset.goto);
      const max = document.documentElement.scrollHeight - innerHeight;
      window.scrollTo({
        top: (i / (chapters.length - 1)) * max,
        behavior: reduced ? "auto" : "smooth"
      });
    });
  });

  $(".nav-dev").setAttribute("href", "#work");

  /* ---------------------------------------------------------- boot */
  drawBrain();
  startDust();
  updateSoundUI();
  applyCopy(0);
  setChapter(0, true);
  onScroll(true);

  if (skipIntro) {
    // QA / preview link: ?skipintro=1&chapter=3
    soundOn = false;
    updateSoundUI();
    pctEl.textContent = "100";
    loader.classList.add("gate");
    setTimeout(() => {
      enterSite();
    }, 60);
  } else if (reduced) {
    // no long intro for reduced-motion visitors; still one intentional click
    pctEl.textContent = "100";
    loader.classList.add("gate");
  } else {
    armLoader();
  }
})();
