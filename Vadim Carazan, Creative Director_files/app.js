// Portrait cosmos. Thousands of project images float in 3D space. At the start every image sits on the line from the
// camera through one cell of a halftone of the portrait, at its own depth and scaled by that depth, so the field projects
// into one flat portrait; any movement pulls it apart. Scrolling flies the camera forward, without end.
// The middle of the screen is a lane: the work comes toward you there one piece after another, in time order (website
// case studies first, then Dribbble newest to oldest, then round again). Everything around the lane is atmosphere
// taken from the work coming up next, so what floats at the edges now reaches the middle later.
// Images close enough can be clicked and open their project over a blurred background.
// Data: data/cosmos.json (tools/build.py): projects, images (atlas layer + slot, hi-res file, mean colour), cells of the
// portrait (image, cell colour, distance).
import * as THREE from "three"
THREE.ColorManagement.enabled = false   // colours and textures are used exactly as authored (sRGB in, sRGB out)

const $ = (s) => document.querySelector(s)
const params = new URLSearchParams(location.search)
const TRK = (n, p) => { try { window.vcTrack && window.vcTrack(n, p) } catch {} }
const SHIFT = +(params.get("shift") ?? 0)            // images keep their own colours (the face comes from their sizes)
const BG = [10 / 255, 10 / 255, 11 / 255]             // near black
const MIN_CLICK_PX = 34                               // an image is clickable once it is this tall on screen
const SEEN_PX = 80                                    // ... and counts as seen once it has been this tall on screen
const HI_PX = 170                                     // above this it swaps to its high-resolution version
const HI_MAX = 22
const STREAM_R = 150                                  // radius of the tunnel the atmosphere flies through
const LANE = { step: 55, h: 7.5, x: 12, y: 7, z0: 270, n: 52, rx: 30, ry: 22 }   // the middle lane: spacing, size, spread, keep-out
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches
const DPR = Math.min(devicePixelRatio || 1, 2)
const SAFARI = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(navigator.userAgent) || params.get("safari") === "1"   // ?safari=1 tests the Safari path
// phones get half-size image sheets (a quarter of the bytes): at that screen size the difference is invisible, and the
// close-ups swap to the sharp copies anyway
const SMALL = (Math.min(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2) < 1200 || params.get("sm") === "1") && params.get("sm") !== "0"
const sheetSrc = (a) => (SMALL ? a.src.replace(/\.webp$/, "-sm.webp") : a.src)
let PXB = 5.5e6   // drawing-buffer pixel budget; lowered automatically if frames run slow
const raf = params.get("timer") ? (f) => setTimeout(() => f(performance.now()), 33) : requestAnimationFrame.bind(window)   // ?timer=1: keep running in a background tab (testing)

const canvas = $("#c")
const renderer = new THREE.WebGLRenderer({ canvas, antialias: DPR < 1.5, alpha: true, powerPreference: "high-performance" })
renderer.setClearColor(0x000000, 0)   // transparent: the signature layer shows through behind the portrait
renderer.setPixelRatio(DPR)
renderer.outputColorSpace = THREE.LinearSRGBColorSpace
const scene = new THREE.Scene()
scene.background = null
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 8000)
const field = new THREE.Group()
scene.add(field)
const loaderEl = $("#loader")
// ---------- loading: the V mark is drawn exactly as fast as the site loads ----------
// Progress comes from the bytes of the image sheets as they arrive (85%), then building the scene (15%). The drawing
// follows that progress smoothly (never faster than a natural hand, about 1.6s), and the site appears the moment the
// second stroke closes.
const ldPens = [...document.querySelectorAll(".ld-pen")]
const LD = { target: 0, shown: 0, t0: performance.now(), last: performance.now(), done: false, resolve: null, raf: 0 }
const setLoad = (p) => { LD.target = Math.max(LD.target, Math.min(1, p)) }
const ldEase = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
function ldFrame(now) {
  const dt = Math.min(0.25, (now - LD.last) / 1000); LD.last = now
  const pace = Math.min(1, (now - LD.t0) / 1600)                 // a hand needs at least this long
  const goal = Math.min(LD.target, pace)
  LD.shown += (goal - LD.shown) * (1 - Math.exp(-dt * 7))
  if (LD.target >= 1 && pace >= 1 && LD.shown > 0.996) LD.shown = 1
  const p = LD.shown
  if (params.get("timer")) (LD.log = LD.log || []).push([Math.round(now), +LD.target.toFixed(2), +p.toFixed(2)])
  const s1 = ldEase(p / 0.58), s2 = ldEase((p - 0.44) / 0.56)   // the curve starts just before the first stroke ends
  if (ldPens[0]) ldPens[0].style.strokeDashoffset = (1 - s1).toFixed(4)
  if (ldPens[1]) ldPens[1].style.strokeDashoffset = (1 - s2).toFixed(4)
  if (p >= 1) loaderEl.classList.add("drawn")
  if (p >= 1 && LD.resolve) { const r = LD.resolve; LD.resolve = null; r(); return }
  raf(ldFrame)
}
raf(ldFrame)
window.__LD = LD
const loaderDrawn = () => new Promise((r) => { LD.resolve = r; if (LD.shown >= 1) r() })
// fetch with byte progress (falls back to the normal loader when the browser cannot stream)
async function loadTextureProgress(url, onBytes) {
  try {
    const res = await fetch(url)
    const total = +res.headers.get("Content-Length") || 0
    if (!res.body || !total) { const b = await res.blob(); onBytes(1, 1); return loadTexture(URL.createObjectURL(b)) }
    const reader = res.body.getReader(), chunks = []; let got = 0
    for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); got += value.length; onBytes(got, total) }
    return loadTexture(URL.createObjectURL(new Blob(chunks)))
  } catch { onBytes(1, 1); return loadTexture(url) }
}

// ---------- shaders ----------
const MAXL = 12
const common = /* glsl */ `varying vec2 vUv; varying vec2 vLocal; varying vec3 vColor; varying vec3 vMean; varying float vFade; varying float vDepth; varying float vHover; varying float vLayer; varying float vBias; varying float vDim; varying float vFill; varying float vCase;`
const tileVert = /* glsl */ `
  attribute vec2 aSlot; attribute vec3 aColor; attribute vec3 aMean; attribute float aLayer; attribute float aDim; attribute float aFill; attribute float aHero; attribute float aCase;
  uniform vec2 uGrid; uniform float uHover; uniform float uBlur; uniform vec2 uTilePx; uniform float uFogV; uniform float uSoft;
  ${common}
  void main() {
    vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
    float s = length(instanceMatrix[1].xyz);
    float d = -mv.z;
    vFade = smoothstep(s * 1.1, s * 2.6, d);            // dissolve just before it would fill the screen
    vDepth = d; vLocal = uv;
    // depth of field: images further away are drawn from smaller mip levels (soft), and sharpen as you come closer
    vBias = uBlur * pow(smoothstep(45.0, 1150.0, d), 0.75) * 5.0 + uSoft * 0.6;   // progressive: very far very soft, close sharp; a touch softer while a card is open (the real blur is a screen pass)
    vec2 pad = 0.5 * exp2(vBias) / uTilePx + 0.002;      // keep blurred samples inside their own tile of the atlas
    vec2 inset = mix(pad, 1.0 - pad, uv);
    vUv = vec2((aSlot.x + inset.x) / uGrid.x, 1.0 - (aSlot.y + 1.0 - inset.y) / uGrid.y);
    vColor = aColor; vMean = aMean; vLayer = aLayer; vDim = aDim; vFill = aFill; vCase = aCase;
    vFade *= aHero > 0.5 ? smoothstep(0.25, 0.9, uFogV) : 1.0;   // lane images appear once you leave the portrait
    vHover = abs(float(gl_InstanceID) - uHover) < 0.5 ? 1.0 : 0.0;
    gl_Position = projectionMatrix * mv;
  }`
const hiVert = /* glsl */ `
  uniform vec3 uColor; uniform vec3 uMean; uniform float uSoft; uniform float uCase;
  ${common}
  void main() {
    vec4 mv = viewMatrix * modelMatrix * vec4(position, 1.0);
    float s = length(modelMatrix[1].xyz);
    float d = -mv.z;
    vFade = smoothstep(s * 1.1, s * 2.6, d);
    vDepth = d; vLocal = uv; vUv = uv; vColor = uColor; vMean = uMean; vHover = 0.0; vLayer = -1.0; vBias = uSoft * 0.6; vDim = 1.0; vFill = 0.0; vCase = uCase;
    gl_Position = projectionMatrix * mv;
  }`
const samplers = Array.from({ length: MAXL }, (_, i) => `uniform sampler2D uA${i};`).join(" ")
const pickTex = Array.from({ length: MAXL }, (_, i) => `${i ? "else " : ""}if (vLayer < ${i}.5) c = texture2D(uA${i}, vUv, vBias).rgb;`).join(" ")
const pickRT = Array.from({ length: MAXL }, (_, i) => `${i ? "else " : ""}if (vLayer < ${i}.5) rt = uRT[${i}];`).join(" ")
const frag = (hi) => /* glsl */ `
  uniform sampler2D uMap; uniform float uShift; uniform float uFog; uniform float uIn; uniform vec3 uBg; uniform float uSoft; uniform float uT; uniform float uHi;
  ${hi ? "" : samplers + ` uniform float uRT[${MAXL}]; uniform float uTime; uniform vec2 uGrid;`}
  ${common}
  float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
  void main() {
    float a = vFade * uIn * (1.0 - vFill * smoothstep(0.0, 0.6, uFog));   // portrait-only fillers dissolve as you fly in
    if (a < 0.999 && ign(gl_FragCoord.xy) > a) discard;   // order-free dissolve
    // slightly rounded corners (4:3 tile, radius 6% of its height)
    vec2 q = abs((vLocal - 0.5) * vec2(1.3333, 1.0)) - vec2(0.6667, 0.5) + 0.06;
    if (length(max(q, 0.0)) > 0.06) discard;
    vec3 c = vec3(0.0);
    ${hi ? "c = texture2D(uMap, vUv, vBias).rgb;" : pickTex + `
    // progressive load: until its image sheet has arrived a piece is its own average colour; then it develops into the image
    float rt = 1e6; ${pickRT}
    vec2 sl = floor(vUv * uGrid); float hs = fract(sin(dot(sl + vLayer * 17.0, vec2(12.9898, 78.233))) * 43758.5453);
    c = mix(vMean, c, smoothstep(0.0, 1.0, clamp((uTime - rt - hs * 0.9) / 0.6, 0.0, 1.0)));`}
    c = clamp(c + (vColor - vMean) * uShift, 0.0, 1.0);
    c = mix(uBg, c, mix(vDim, 1.0, uFog));                // the halo around the portrait is fainter, until you fly in
    float edge = min(min(vLocal.x, 1.0 - vLocal.x), min(vLocal.y, 1.0 - vLocal.y));
    if (vHover > 0.5) { c = mix(c, vec3(1.0), 0.06); if (edge < 0.014) c = vec3(1.0); }
    if (vCase > 0.0 && uHi > 0.5) {
      // a case-study piece: a glint sweeps across it now and then (like light catching a found card), and a faint light breathes inside its edge
      float t = fract(uT * 0.14 + vCase * 7.0);
      float p = vLocal.x * 0.75 + (1.0 - vLocal.y) * 0.5, pos = t * 2.0 - 0.4;
      float band = exp(-pow((p - pos) / 0.06, 2.0)) * 0.55 + exp(-pow((p - pos) / 0.2, 2.0)) * 0.16;
      float inner = smoothstep(0.1, 0.0, edge) * (0.14 + 0.07 * sin(uT * 1.6 + vCase * 30.0));
      c += vec3(1.0, 0.98, 0.95) * (band + inner) * uFog * (1.0 - smoothstep(110.0, 190.0, vDepth));   // only once the piece is close enough to read
    }
    c = mix(c, uBg, smoothstep(520.0, 1300.0, vDepth) * uFog);   // far images sink into the background
    c = mix(c, uBg, uSoft * 0.35);                                 // the field steps back while a card is open
    gl_FragColor = vec4(c, 1.0);
  }`

// ---------- state ----------
let D, mesh, N = 0, T = 0, CAP = 0, P = 1384
const MOTES = 260                 // small images drifting in from the dark to join the portrait
const uniforms = { uShift: { value: SHIFT }, uFog: { value: 0 }, uFogV: { value: 0 }, uBlur: { value: 0 }, uBg: { value: new THREE.Vector3(...BG) }, uSoft: { value: 0 }, uT: { value: 0 }, uHi: { value: params.has("glow") ? 1 : 0 } }   // uSoft: the field steps back (softer, dimmer) while a card is open
let STRIDE = 2, streamCount = 1, streamRank
const world = []                 // per tile: { pos, h, m: Matrix4 }
let tileImg, tileGen, live, seen, lastSeen, unseen, unseenAt, seenCount = 0
const memo = new Map()           // `${tile}:${gen}` -> image, so flying back shows the same work in the same place
let W = 0, H = 0, focal = 1

function resize() {
  // measure the canvas as it is actually shown (iOS Safari: innerHeight and 100dvh can disagree while the toolbars
  // move, which stretched the portrait); the drawing then always has the true aspect of the screen area
  const cr = canvas.getBoundingClientRect()
  W = Math.round(cr.width) || innerWidth; H = Math.round(cr.height) || innerHeight
  // very big windows: keep the drawing buffer inside what the GPU allows (else the browser shrinks it and the portrait
  // renders cropped and magnified) and under ~16M pixels, so huge screens stay smooth
  const gl = renderer.getContext(), vp = gl.getParameter(gl.MAX_VIEWPORT_DIMS), mx = Math.min(vp[0], vp[1], gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))
  renderer.setPixelRatio(Math.max(0.5, Math.min(DPR, mx / W, mx / H, Math.sqrt(PXB / (W * H)))))
  renderer.setSize(W, H, false)
  camera.aspect = W / H
  stage()
}
// the portrait is framed in the free space: from under the top row to the bottom of the window (the big name sits over
// the bust), and beside the glass box when a project is open. The projection centre moves there (setViewOffset), so the
// illusion still lines up exactly from the camera. The frame glides from one layout to the next.
const boxEl = $("#box"), nameEl = $("#bigname"), topEl = document.querySelector(".topbar")
const fr = { cx: 0, cy: 0, w: 0, h: 0, ready: false }
function stage(dt = 1) {
  if (!D) return
  const wide = W > 860, open = boxEl.dataset.view === "project" || boxEl.dataset.view === "about" || boxEl.dataset.view === "contact" || boxEl.dataset.view === "selected"
  const top = Math.max(topEl.getBoundingClientRect().bottom + 10, H * 0.085)   // never under the top row, whatever the zoom
  const bottom = H * 1.07                          // the portrait fills the height (a little high), the big name sits over it
  let x0 = 0, x1 = W, y0 = top, y1 = Math.max(top + 200, bottom)
  if (open) { const r = boxEl.getBoundingClientRect(); if (wide) x0 = r.right; else y1 = Math.max(top + 160, H - r.height - 30) }
  const t = { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 - (open ? 0 : H * 0.08),   // a little higher than the middle
              w: x1 - x0, h: y1 - y0 }
  if (!wide && !open) { t.h = H * 0.7; t.cy = H * 0.475; t.cx = W * 0.47 }   // phones: a big bust, lower, behind the name; nudged left so the face (lit from the right) reads centred
  const k = fr.ready ? 1 - Math.exp(-dt * 5) : 1
  for (const key of ["cx", "cy", "w", "h"]) fr[key] += (t[key] - fr[key]) * k
  fr.ready = true
  const fitH = 2 * Math.atan(100 / 1.03 / 2 / D.D0 * (H / fr.h)) * 180 / Math.PI
  const fitW = 2 * Math.atan((100 * D.aspect) / 0.96 / 2 / D.D0 / camera.aspect * (W / fr.w)) * 180 / Math.PI
  camera.fov = wide || open ? Math.max(fitH, fitW) : fitH   // phones: fill the height, the sides may run off screen
  camera.setViewOffset(W, H, W / 2 - fr.cx, H / 2 - fr.cy, W, H)
  camera.updateProjectionMatrix()
  focal = H / (2 * Math.tan((camera.fov * Math.PI) / 360))
}
// the name runs the full width of the window, whatever the screen
// the name is an SVG lettering that spans the full width by CSS; nothing to measure
function fitName() {}
fitName(); if (document.fonts) document.fonts.ready.then(() => { fitName(); fr.ready = false })
addEventListener("resize", fitName)
async function loadTexture(url) {
  // decode off the main thread (createImageBitmap), so sharp images arriving mid-flight don't stall the scroll
  let tex
  if (window.createImageBitmap && !SAFARI) {
    try {
      const blob = await (await fetch(url)).blob()
      const bmp = await createImageBitmap(blob, { imageOrientation: "flipY" })
      tex = new THREE.Texture(bmp); tex.flipY = false; tex.needsUpdate = true
    } catch { tex = null }
  }
  if (!tex) tex = await new THREE.TextureLoader().loadAsync(url)
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  tex.minFilter = THREE.LinearMipmapLinearFilter
  return tex
}
// deterministic random per tile and generation (the same place every time you pass it)
function rng(a, b) { let t = (a * 374761393 + b * 668265263) >>> 0; return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296 } }

// ---------- placement ----------
const m4 = new THREE.Matrix4(), qI = new THREE.Quaternion(), vS = new THREE.Vector3(), vP = new THREE.Vector3()
function place(i, gen) {
  const c = D.cells[i], d = c[4], w = world[i]
  if (gen === 0) {
    const col = c[5], row = c[6], k = d / D.D0
    w.h0 = D.cell[1] * k * 0.94; w.hs = c[7] ?? 1   // full size, and the halftone share of it at the portrait
    w.h = w.h0 * (w.hs + (1 - w.hs) * (c[9] ? 0 : grow))   // portrait-only fillers always keep their halftone size
    w.pos.set((col + 0.5 - D.cols / 2) * D.cell[0] * k, (D.rows / 2 - row - 0.5) * D.cell[1] * k, -d)
  } else if (i % STRIDE) {
    w.h = 0; w.near = false                 // only every STRIDE-th tile flies in the stream (fewer images, no repeats)
  } else {
    const r = rng(i + 1, gen)
    const ang = r() * Math.PI * 2, rad = LANE.rx + (STREAM_R - LANE.rx) * Math.pow(r(), 0.8)
    w.h = 1.4 + Math.pow(r(), 2.2) * 7
    w.pos.set(Math.cos(ang) * rad, Math.sin(ang) * rad * 0.8, -(d + gen * P))
    w.near = rad < STREAM_R * 0.55       // will pass in front of the viewer
  }
  if (gen === 0) w.base = w.pos.clone()
  if (attr.dim) attr.dim.array[i] = gen === 0 ? (c[8] ?? 1) : 1
  if (gen === 0) w.hideFly = !!c[9] || (Math.abs(w.pos.x) < LANE.rx && Math.abs(w.pos.y) < LANE.ry)   // fillers, and anything in the lane
  else w.hideFly = false
  if (attr.fill) attr.fill.array[i] = w.hideFly ? 1 : 0
  vS.set(w.h, w.h, 1)
  mesh.setMatrixAt(i, m4.compose(w.pos, qI, vS))
}
// at the portrait each image is drawn at its halftone size; flying in, they all grow to full size
let grow = 0
function setGrow(g) {
  if (Math.abs(g - grow) < 0.002) return
  grow = g
  for (let i = 0; i < N; i++) {
    if (tileGen[i] !== 0 || D.cells[i][9]) continue
    const w = world[i]
    w.h = w.h0 * (w.hs + (1 - w.hs) * grow)
    if (!w.float) { vS.set(w.h, w.h, 1); mesh.setMatrixAt(i, m4.compose(w.pos, qI, vS)) }
  }
  dirty = true
}
// halo pieces around the portrait drift slowly, each on its own small loop
const floaters = []
// the edge of the portrait is never still: halo pieces keep flowing in from the dark toward their place on the
// silhouette, on curving paths through a slow flow field, fade as they arrive, and set off again from further out
function flow(x, y, t) {   // a soft, divergence-light swirl (sum of a few rotating sine waves)
  return [Math.sin(y * 0.045 + t * 0.35) + 0.6 * Math.sin((x + y) * 0.03 - t * 0.27), Math.cos(x * 0.045 - t * 0.31) + 0.6 * Math.cos((x - y) * 0.03 + t * 0.23)]
}
const HS = { x: 0, y: 0, z: 0, dim: 1, s: 1 }
function haloState(i, now) {   // where a halo piece is on its endless trip toward the silhouette
  const w = world[i], f = w.float, c = D.cells[i], k = c[4] / D.D0, t = now / 1000
  const u = (t * f[0] + f[2]) % 1                       // 0: far out in the dark, 1: home on the silhouette
  const out = Math.pow(1 - u, 1.6)
  const bx = w.base.x / k, by = w.base.y / k - 10, len = Math.hypot(bx, by) || 1
  const sw = flow(bx, by, t + f[3])
  const R0 = f[4]
  HS.x = w.base.x + (bx / len) * out * R0 * k + sw[0] * out * R0 * 0.35 * k
  HS.y = w.base.y + (by / len) * out * R0 * k + sw[1] * out * R0 * 0.35 * k
  HS.z = w.base.z
  HS.dim = (c[8] ?? 1) * Math.min(1, u / 0.3) * (1 - Math.max(0, (u - 0.82) / 0.18) * 0.85)
  HS.s = 0.6 + 0.4 * u
  return HS
}
function floatHalo(now) {
  if (dist > P * 1.05 || introStart >= 0) return
  for (const i of floaters) {
    if (tileGen[i] !== 0) continue
    const w = world[i], h = haloState(i, now)
    w.pos.set(h.x, h.y, h.z)
    attr.dim.array[i] = h.dim
    vS.set(w.h * h.s, w.h * h.s, 1)
    mesh.setMatrixAt(i, m4.compose(w.pos, qI, vS))
  }
  if (floaters.length) { mesh.instanceMatrix.needsUpdate = true; attr.dim.needsUpdate = true }
}
function markSeen(j) {
  if (seen[j]) { lastSeen[j] = performance.now(); return }
  seen[j] = 1; lastSeen[j] = performance.now(); seenCount++
  const k = unseenAt[j], last = unseen.pop()                 // swap-remove from the unseen list
  if (last !== j) { unseen[k] = last; unseenAt[last] = k }
  counter()
}
function chooseImage(near) {
  // places that will pass in front of you go to work you have not seen yet; the rest reuse what you saw longest ago
  if (near && unseen.length) {
    for (let t = 0; t < 24; t++) { const j = unseen[(Math.random() * unseen.length) | 0]; if (!live[j]) return j }
    return unseen[(Math.random() * unseen.length) | 0]
  }
  // otherwise the next card of a shuffled deck of all the work, skipping anything already on screen
  for (let t = 0; t < deck.length; t++) {
    if (deckAt >= deck.length) { shuffle(deck); deckAt = 0 }
    const j = deck[deckAt++]
    if (!live[j]) return j
  }
  return deck[(Math.random() * deck.length) | 0]
}
let deck = [], deckAt = 0
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const k = (Math.random() * (i + 1)) | 0; [a[i], a[k]] = [a[k], a[i]] } return a }
const attr = {}
function setImage(i, j) {
  const old = tileImg[i]
  if (old === j) return
  if (old >= 0) live[old]--
  tileImg[i] = j
  if (j < 0) return
  live[j]++
  const img = D.images[j], at = D.atlases[img[2]]
  attr.layer.array[i] = img[2]
  attr.slot.array[i * 2] = img[3] % at.cols; attr.slot.array[i * 2 + 1] = Math.floor(img[3] / at.cols)
  attr.mean.array[i * 3] = img[5] / 255; attr.mean.array[i * 3 + 1] = img[6] / 255; attr.mean.array[i * 3 + 2] = img[7] / 255
  dirty = true
}
let dirty = false
function setGen(i, gen) {
  if (tileGen[i] === gen) return
  tileGen[i] = gen
  place(i, gen)
  let j
  if (gen === 0) j = D.cells[i][0]
  else if (!world[i].h) j = -1
  else {
    // the stream walks through the work in time: website first, then Dribbble newest to oldest, then round again
    const key = gen * N + i
    j = memo.get(key)
    if (j === undefined) {
      // atmosphere: random pieces from the stretch of work that reaches the lane over the next few hundred steps
      const M = D.seq.length, r = rng(i + 3, gen), ahead = laneIndexAt(-world[i].pos.z)
      let k = (ahead + 20 + Math.floor(r() * 500)) % M
      j = D.seq[k]
      for (let t = 0; t < 60 && live[j]; t++) { k = (k + 7) % M; j = D.seq[k] }
      memo.set(key, j)
    }
  }
  setImage(i, j)
  dropHi(i)
  dirty = true
}

// ---------- the lane: the work in time order, straight ahead ----------
const laneK = new Int32Array(LANE.n)
// a soft light behind every lane piece that belongs to a case study, so they read as the stars of the field while you scroll
let glow = null
const glowU = { uTime: { value: 0 }, uFogV: uniforms.uFogV, uSoft: uniforms.uSoft, uIn: { value: 1 } }
// two looks, picked with ?glow=halo|ring while deciding: a soft light behind the piece, or a thin line of light running round it
// highlighting of case-study pieces is parked for now (nothing is drawn unless ?glow=line|halo|ring is in the address)
const GLOW_ON = params.has("glow"), GLOW_MODE = params.get("glow") === "ring" ? 1 : 0, HALO = params.get("glow") === "halo" ? 1 : 0
function makeGlow() {
  if (!GLOW_ON) return
  const geo = new THREE.PlaneGeometry(1, 1)
  const seed = new THREE.InstancedBufferAttribute(new Float32Array(LANE.n), 1)
  const tint = new THREE.InstancedBufferAttribute(new Float32Array(LANE.n * 3), 3)
  seed.setUsage(THREE.DynamicDrawUsage); tint.setUsage(THREE.DynamicDrawUsage)
  geo.setAttribute("aSeed", seed); geo.setAttribute("aTint", tint)
  const mat = new THREE.ShaderMaterial({
    // light is added to whatever is behind, and the canvas stays transparent there (the page background shows through, as everywhere else)
    uniforms: { ...glowU, uMode: { value: GLOW_MODE }, uHalo: { value: HALO } }, extensions: { derivatives: true }, transparent: true, depthWrite: false, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    vertexShader: /* glsl */ `
      attribute float aSeed; attribute vec3 aTint; uniform float uFogV; uniform float uMode;
      varying vec2 vUv; varying float vA; varying vec3 vTint; varying vec2 vQ; varying float vH; varying float vSeed; varying float vLine;
      void main() {
        vec4 mv = viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
        vec2 sc = vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
        float s = sc.y, d = -mv.z;
        vH = uMode > 0.5 ? sc.y / 1.5 : sc.y / 4.0;      // the piece's own height
        float near = uMode > 0.5 ? smoothstep(s * 1.1, s * 2.4, d) : smoothstep(vH * 1.1, vH * 2.6, d);   // the halo stays until the piece itself dissolves (same curve as the tile)
        vA = near * smoothstep(0.25, 0.9, uFogV) * (1.0 - smoothstep(110.0, 190.0, d));   // gone at the portrait, and before the piece is close enough to read
        vLine = smoothstep(vH * 1.1, vH * 2.6, d) * smoothstep(0.25, 0.9, uFogV) * (1.0 - smoothstep(110.0, 190.0, d));   // the line lives as long as the piece is near
        vUv = uv; vTint = aTint; vSeed = aSeed;
        vQ = (uv - 0.5) * sc;                            // position in world units
        vA *= 0.82 + 0.18 * sin(aSeed * 6.2831);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uSoft; uniform float uIn; uniform float uMode; uniform float uHalo;
      varying vec2 vUv; varying float vA; varying vec3 vTint; varying vec2 vQ; varying float vH; varying float vSeed; varying float vLine;
      void main() {
        vec3 c;
        if (uMode > 0.5) {
          // a thin line of light just outside the piece's rounded edge, with a brighter spot travelling round it
          vec2 b = vec2(vH * 0.6667, vH * 0.5); float rr = vH * 0.06;
          vec2 e = abs(vQ) - b + rr; float sd = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - rr;   // signed distance to the piece's outline
          float off = vH * 0.05, wd = vH * 0.016;
          float line = exp(-pow(max(0.0, abs(sd - off)) / wd, 2.0));                 // the line, soft-edged
          float halo = exp(-max(0.0, sd - off) / (vH * 0.16)) * 0.32;               // a faint spill outwards
          float ang = atan(vQ.y, vQ.x);
          float run = 0.35 + 0.65 * pow(0.5 + 0.5 * cos(ang - uTime * 1.4 - vSeed * 6.2831), 6.0);   // one bright spot going round, ~4.5 s per lap
          float second = 0.5 * pow(0.5 + 0.5 * cos(ang + 3.1416 - uTime * 1.4 - vSeed * 6.2831), 6.0);
          float g = (line * 1.6 + halo) * (run + second) * step(0.0, sd);
          c = mix(vec3(1.0, 0.97, 0.9), vTint, 0.2) * g * vA * uIn * (1.0 - uSoft * 0.5);
        } else {
          vec2 q = (vUv - 0.5) * vec2(1.0, 1.2);
          float r = length(q) * 2.0;
          float g = exp(-r * r * 4.8) * (1.0 - smoothstep(0.7, 1.0, r));   // a wide, diffuse light, brightest right behind the piece, gone before the plane's edge
          float pulse = 0.86 + 0.14 * sin(uTime * 1.1 + vTint.r * 40.0);
          c = mix(vec3(1.0, 0.97, 0.92), vTint, 0.4) * g * 1.15 * pulse * vA * (1.0 - uSoft * 0.5) * uHalo;
          // a hair-thin white line on the piece's own contour (same rounded corners as the tile), with a glare travelling round it
          vec2 b = vec2(vH * 0.6667, vH * 0.5); float rr = vH * 0.06;
          vec2 e = abs(vQ) - b + rr; float sd = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0) - rr;
          float wd = max(vH * 0.02, fwidth(sd) * 1.4);                  // never thinner than a pixel and a half, so it doesn't sparkle far away
          float line = exp(-pow(max(0.0, sd - wd * 0.6) / wd, 2.0)) * step(-wd * 0.5, sd);
          float ang = atan(vQ.y, vQ.x);
          float glare = pow(0.5 + 0.5 * cos(ang - uTime * 0.9 - vSeed * 6.2831), 18.0);   // one bright glint going round, ~7 s per lap
          c += vec3(1.0) * line * (0.28 + 1.0 * glare) * vLine;   // the line is always on, open card or not
          c *= uIn;
        }
        gl_FragColor = vec4(c, 0.0);
      }`,
  })
  glow = new THREE.InstancedMesh(geo, mat, LANE.n)
  glow.frustumCulled = false; glow.renderOrder = -1
  for (let s = 0; s < LANE.n; s++) glow.setMatrixAt(s, m4.compose(vP.set(0, 0, 1e6), qI, vS.set(0, 0, 1)))
  field.add(glow)
}
const laneIndexAt = (z) => Math.max(0, Math.floor((z - LANE.z0) / LANE.step))
function updateLane() {
  const first = Math.max(0, laneIndexAt(dist) - 1), M = D.seq.length
  for (let k = first; k < first + LANE.n; k++) {
    const s = k % LANE.n, i = N + s
    if (laneK[s] === k) continue
    laneK[s] = k
    const r = rng(k + 11, 99), w = world[i]
    // a loose cluster around the centre, two or three images wide, never two in a row on the same spot
    const a = r() * Math.PI * 2, rr = Math.sqrt(r())
    w.h = LANE.h * (0.85 + r() * 0.3)
    w.pos.set(Math.cos(a) * rr * LANE.x, Math.sin(a) * rr * LANE.y, -(LANE.z0 + k * LANE.step))
    vS.set(w.h, w.h, 1)
    mesh.setMatrixAt(i, m4.compose(w.pos, qI, vS))
    const j = D.seq[k % M]
    setImage(i, j)
    if (glow) {
      const im = D.images[j], cs = caseOf[im[0]] >= 0
      attr.case.array[i] = cs ? 0.05 + r() * 0.9 : 0
      if (GLOW_MODE) { vP.set(w.pos.x, w.pos.y, w.pos.z - 0.3); vS.set(cs ? w.h * 2 : 0, cs ? w.h * 1.5 : 0, 1) }   // ring: 4:3 plane, half a piece of room around it
      else { vP.set(w.pos.x, w.pos.y, w.pos.z - 0.08); vS.set(cs ? w.h * 4.8 : 0, cs ? w.h * 4.0 : 0, 1) }
      glow.setMatrixAt(s, m4.compose(vP, qI, vS))
      const ga = glow.geometry.attributes
      ga.aSeed.array[s] = r(); ga.aTint.array[s * 3] = attr.mean.array[i * 3]; ga.aTint.array[s * 3 + 1] = attr.mean.array[i * 3 + 1]; ga.aTint.array[s * 3 + 2] = attr.mean.array[i * 3 + 2]
      ga.aSeed.needsUpdate = ga.aTint.needsUpdate = glow.instanceMatrix.needsUpdate = true
    }
    dropHi(i)
    dirty = true
  }
}

async function init() {
  D = await (await fetch("data/cosmos.json")).json()
  N = D.cells.length; T = N + LANE.n; CAP = T + MOTES; P = D.period || P
  STRIDE = Math.max(1, Math.ceil(N / (D.images.length * 0.8)))
  const st = []; for (let i = 0; i < N; i += STRIDE) st.push(i)
  st.sort((a, b) => D.cells[a][4] - D.cells[b][4]); streamCount = st.length
  streamRank = new Int32Array(N); st.forEach((i, r) => { streamRank[i] = r })
  D.seq = D.seq || Array.from({ length: D.images.length }, (_, j) => j)
  $("#count").textContent = `${D.images.length.toLocaleString("en")} images from ${D.projects.length.toLocaleString("en")} projects`
  resize()
  const sigBakeP = (async () => { try { await Promise.race([document.fonts ? document.fonts.ready : null, new Promise((r) => setTimeout(r, 1500))]) } catch {} ; await bakeSignature() })()
  // progressive load: the portrait starts from the data alone (every piece in its own colour) and each image sheet
  // develops its pieces as it arrives; sheets are fetched most-used-by-the-portrait first, two at a time, and go to the
  // GPU one per frame. The loader only waits for the first sheet (or ~1.4 s, whichever comes first).
  const use = D.atlases.map(() => 0); for (const c of D.cells) use[D.images[c[0]][2]]++
  const order = D.atlases.map((_, k) => k).sort((a, b) => use[b] - use[a])
  const blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1); blank.needsUpdate = true
  const texes = D.atlases.map(() => blank)
  // (the portrait waits for every sheet, as it did at launch: everything heavy happens behind the loader, so the
  // portrait forms in one continuous motion)
  const prog = D.atlases.map(() => [0, 0])
  const report = () => { let g = 0, t = 0, known = 0; for (const [a, b] of prog) if (b) { g += a; t += b; known++ }; const avg = known ? t / known : 1; t += (prog.length - known) * avg; setLoad(0.05 + 0.65 * (t ? g / t : 0)) }
  setLoad(0.05)
  const allSheets = (async () => {
    let next = 0
    const worker = async () => { while (next < order.length) { const k = order[next++]
      const url = sheetSrc(D.atlases[k]) + "?v=" + D.v, onP = (g, t) => { prog[k] = [g, t]; report() }
      // download, decode and build every mip level in a worker: nothing heavy ever runs on the thread drawing the frames
      const wr = await sheetInWorker(new URL(url, location.href).href, onP)
      atlasQueue.push([k, wr || await loadTextureProgress(url, onP)]) } }
    await Promise.all([worker(), worker()])
  })()
  await allSheets
  setLoad(0.72)
  const geo = new THREE.PlaneGeometry(D.cell[0] / D.cell[1], 1)
  const u = { ...uniforms, uGrid: { value: new THREE.Vector2(D.atlases[0].cols, D.atlases[0].rows) }, uTilePx: { value: new THREE.Vector2(SMALL ? 128 : 256, SMALL ? 96 : 192) }, uHover: { value: -1 }, uIn: { value: 1 },
    uRT: { value: new Array(MAXL).fill(1e6) }, uTime: { value: 0 } }
  for (let l = 0; l < MAXL; l++) u["uA" + l] = { value: texes[Math.min(l, texes.length - 1)] }
  const mat = new THREE.ShaderMaterial({ vertexShader: tileVert, fragmentShader: frag(false), uniforms: u })
  mesh = new THREE.InstancedMesh(geo, mat, CAP)
  mesh.frustumCulled = false
  attr.slot = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 2), 2)
  attr.layer = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1)
  attr.mean = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3)
  attr.color = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 3), 3)
  attr.dim = new THREE.InstancedBufferAttribute(new Float32Array(CAP).fill(1), 1)
  attr.fill = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1)
  attr.hero = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1)
  attr.case = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1)
  for (const [k, a] of Object.entries(attr)) { a.setUsage(THREE.DynamicDrawUsage); geo.setAttribute("a" + k[0].toUpperCase() + k.slice(1), a) }
  const M = D.images.length
  tileImg = new Int32Array(CAP).fill(-1); tileGen = new Int32Array(CAP).fill(-1)
  live = new Int32Array(M); seen = new Uint8Array(M); lastSeen = new Float64Array(M)
  unseen = Array.from({ length: M }, (_, j) => j); unseenAt = Int32Array.from(unseen)
  deck = shuffle(Array.from({ length: M }, (_, j) => j))
  for (let i = 0; i < N; i++) {
    const c = D.cells[i]
    world[i] = { pos: new THREE.Vector3(), h: 1, near: true }
    if ((c[8] ?? 1) < 1) {
      const r = rng(i + 7, 1), k = c[4] / D.D0
      world[i].float = [0.05 + r() * 0.07, 0, r(), r() * 40, 20 + r() * 40 + (1 - c[8]) * 40]   // speed, -, phase, swirl seed, how far out it starts
      floaters.push(i)
    }
    attr.color.array[i * 3] = c[1] / 255; attr.color.array[i * 3 + 1] = c[2] / 255; attr.color.array[i * 3 + 2] = c[3] / 255
    setGen(i, 0)
  }
  for (let i = N; i < T; i++) { world[i] = { pos: new THREE.Vector3(0, 0, 1e6), h: 0, hideFly: false }; attr.hero.array[i] = 1; laneK[i - N] = -1 }
  for (let i = T; i < CAP; i++) { world[i] = { pos: new THREE.Vector3(0, 0, 1e6), h: 0, hideFly: true }; attr.dim.array[i] = 0; mesh.setMatrixAt(i, m4.compose(world[i].pos, qI, vS.set(0, 0, 1))) }
  introStart = -1
  linkCases()
  makeGlow()
  updateLane()
  flush()
  field.add(mesh)
  counter(); buildSelected()
  try { renderer.compile(scene, camera) } catch {}   // compile shaders now, so the first frame of the portrait doesn't stall
  // send every sheet to the GPU while the loader is still up, ~10 ms of uploads per frame
  await new Promise((res) => { const f = () => { const t0 = performance.now()
    while (performance.now() - t0 < 10 && (atlasQueue.length || jobsA.length || jobsB.length)) drainAtlas(performance.now())
    if (atlasQueue.length || jobsA.length || jobsB.length) { setLoad(0.72 + 0.26 * (1 - (jobsA.length + jobsB.length + atlasQueue.length) / (2 * D.atlases.length))); raf(f) } else res() }; raf(f) })
  // warm the GPU: draw the scene once into a tiny target and wait for it, so the driver moves every sheet into video
  // memory now (behind the loader) instead of on the first frames of the portrait (that was the ~0.1 s pause)
  try {
    const rt = new THREE.WebGLRenderTarget(64, 64), px = new Uint8Array(4)
    for (let i = 0; i < N; i++) { const w = world[i]; vS.set(w.h || 1, w.h || 1, 1); mesh.setMatrixAt(i, m4.compose(w.pos, qI, vS)) }
    mesh.instanceMatrix.needsUpdate = true
    renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.readRenderTargetPixels(rt, 0, 0, 1, 1, px); renderer.setRenderTarget(null); rt.dispose()
    alog("warmed")
  } catch {}
  await sigBakeP
  setLoad(1)
  await loaderDrawn()
  loaderEl.classList.add("done")
  introStart = performance.now(); alog('intro')
  // arriving from the 404 page's flight: carry straight on into the work
  if (params.get("fly")) { TRK("not_found_flight"); target = 460; try { const u = new URL(location.href); u.searchParams.delete("fly"); history.replaceState(null, "", u) } catch {} }
  // opened from a shared link: fly in a little and open that work once the portrait has formed
  // ?open=about / ?open=contact (links from the 404 page's top bar): open that page once the portrait has formed
  const openV = params.get("open")
  if (openV === "about" || openV === "contact" || openV === "selected") { try { const u = new URL(location.href); u.searchParams.delete("open"); history.replaceState(null, "", u) } catch {}; setTimeout(() => { openFrom = "nav"; openAbout(openV) }, 1800) }
  const shared = params.get("work")
  if (shared) {
    const j = D.images.findIndex((im) => im[4].split("/").pop().replace(/\.\w+$/, "") === shared)
    if (j >= 0) { TRK("shared_link_open", { work: shared }); setTimeout(() => { target = Math.max(target, 260); setTimeout(() => { openSrc = "shared_link"; openProject(D.images[j][0], D.images[j][1]) }, 1400) }, 2600) }
  }
  addEventListener("resize", resize)
  if (window.ResizeObserver) new ResizeObserver(() => resize()).observe(canvas)
  if (window.visualViewport) visualViewport.addEventListener("resize", resize)
  raf(tick)
}
// ---------- image sheet worker ----------
const SHEET_WORKER = `self.onmessage = async (e) => { const { id, url, strip } = e.data
  try {
    const res = await fetch(url), total = +res.headers.get("Content-Length") || 0, rd = res.body && res.body.getReader(), parts = []; let got = 0
    if (rd) for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); got += value.length; if (total) self.postMessage({ id, p: [got, total] }) }
    const blob = rd ? new Blob(parts) : await res.blob()
    const bmp = await createImageBitmap(blob, { imageOrientation: "flipY", premultiplyAlpha: "none", colorSpaceConversion: "none" })
    const W = bmp.width, H = bmp.height, n = Math.floor(Math.log2(Math.max(W, H))), levels = [], tr = []
    let lvl = bmp
    for (let l = 0; l <= n; l++) {
      if (l) lvl = await createImageBitmap(lvl, { resizeWidth: Math.max(1, W >> l), resizeHeight: Math.max(1, H >> l), resizeQuality: "medium" })
      const w = lvl.width, h = lvl.height, rows = Math.max(1, Math.floor(strip / (w * 4))), parts = []
      for (let y = 0; y < h; y += rows) { const s = await createImageBitmap(lvl, 0, y, w, Math.min(rows, h - y)); parts.push([y, s]); tr.push(s) }
      levels.push(parts)
    }
    self.postMessage({ id, W, H, levels }, tr)
  } catch (err) { self.postMessage({ id, err: String(err) }) } }`
let sheetW = null, sheetId = 0; const sheetCb = new Map()
function sheetInWorker(url, onP) {
  if (SAFARI || typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || !renderer.capabilities.isWebGL2) return Promise.resolve(null)
  try {
    if (!sheetW) { sheetW = new Worker(URL.createObjectURL(new Blob([SHEET_WORKER], { type: "text/javascript" }))); sheetW.onmessage = (e) => { const c = sheetCb.get(e.data.id); if (!c) return
      if (e.data.p) return c.onP(...e.data.p)
      sheetCb.delete(e.data.id); c.res(e.data.err ? null : e.data) } }
    const id = ++sheetId; return new Promise((res) => { sheetCb.set(id, { res, onP }); sheetW.postMessage({ id, url, strip: 1 << 20 }) })
  } catch { return Promise.resolve(null) }
}
// ---------- streaming sheets to the GPU ----------
// The worker hands over every mip level pre-cut into ~1 MB strips. One strip goes to the GPU per frame, smallest levels
// first: once everything but the full-size level is in, the sheet is shown (sampling from level 1, which is all the
// portrait and the far field need) and its pieces develop; the full-size level follows later, in the background, and
// the texture switches to it when complete. No frame ever carries more than one small upload.
const atlasQueue = []
const alog = (s) => { if (window.__alog) window.__alog.push([Math.round(performance.now()), s]) }
const jobsA = [], jobsB = []          // A: small levels (shows the sheet), B: the full-size level
function startSheet(k, s) {
  const gl = renderer.getContext(), st = renderer.state, n = s.levels.length
  const glTex = gl.createTexture()
  st.bindTexture(gl.TEXTURE_2D, glTex)
  gl.texStorage2D(gl.TEXTURE_2D, n, gl.RGBA8, s.W, s.H)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 1); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, n - 1)
  const an = gl.getExtension("EXT_texture_filter_anisotropic"); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, renderer.capabilities.getMaxAnisotropy())
  st.unbindTexture()
  const tex = new THREE.Texture(); tex.image = { width: s.W, height: s.H }; tex.flipY = false
  const props = renderer.properties.get(tex); props.__webglTexture = glTex; props.__webglInit = true
  const strips = (l) => s.levels[l].map(([y, b]) => [l, y, b])
  const a = []; for (let l = n - 1; l >= 1; l--) a.push(...strips(l))
  jobsA.push({ k, glTex, tex, list: a, done: "show" })
  jobsB.push({ k, glTex, tex, list: strips(0), done: "full" })
}
function uploadOne(job) {
  const gl = renderer.getContext(), st = renderer.state, [l, y, b] = job.list.shift()
  st.bindTexture(gl.TEXTURE_2D, job.glTex)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.texSubImage2D(gl.TEXTURE_2D, l, 0, y, b.width, b.height, gl.RGBA, gl.UNSIGNED_BYTE, b)
  try { b.close() } catch {}
  if (!job.list.length && job.done === "full") gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_BASE_LEVEL, 0)
  st.unbindTexture()
  return !job.list.length
}
function drainAtlas(now) {
  if (!mesh) return
  const U = mesh.material.uniforms; U.uTime.value = now / 1000; glowU.uTime.value = now / 1000; uniforms.uT.value = now / 1000
  const q = atlasQueue.shift()
  if (q) {
    const [k, item] = q
    if (item.levels) { startSheet(k, item); alog("queued " + k) }
    else { try { renderer.initTexture(item) } catch {} U["uA" + k].value = item; U.uRT.value[k] = now / 1000 + 0.05; alog("one-go " + k) }
    return
  }
  const job = jobsA[0] || jobsB[0]; if (!job) return
  if (uploadOne(job)) {
    (job === jobsA[0] ? jobsA : jobsB).shift()
    if (job.done === "show") { U["uA" + job.k].value = job.tex; U.uRT.value[job.k] = now / 1000 + 0.05; alog("shown " + job.k) } else alog("full " + job.k)
  }
}
function flush() {
  if (!dirty) return
  mesh.instanceMatrix.needsUpdate = true
  attr.slot.needsUpdate = attr.layer.needsUpdate = attr.mean.needsUpdate = attr.dim.needsUpdate = attr.fill.needsUpdate = attr.hero.needsUpdate = attr.case.needsUpdate = true
  mesh.boundingSphere = null
  dirty = false
}

// ---------- endless flight ----------
let target = 0, dist = 0, vel = 0, mx = 0, my = 0, smx = 0, smy = 0, last = performance.now()
const SPEED = 0.55
// scrolling the field (not the box) while a project or the about page is open means "keep going": a deliberate
// scroll closes the box and the flight carries on; a small nudge is ignored so it never closes by accident
let closeAcc = 0
const push = (dy) => {
  if (panelOpen || aboutOpen) {
    closeAcc += Math.abs(dy)
    if (closeAcc < 120) return
    closeProject(); closeAbout()
  }
  closeAcc = 0
  if (rewind) { rewind = null; target = dist } target = Math.max(0, target + dy)
}
addEventListener("wheel", (e) => { if (e.target.closest && e.target.closest(".box")) return; e.preventDefault(); push(e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? innerHeight : 1) * SPEED) }, { passive: false })
let ty = null, tt = 0
addEventListener("touchstart", (e) => { ty = e.target.closest && e.target.closest(".box") ? null : e.touches[0].clientY; tt = performance.now(); vel = 0 }, { passive: true })
addEventListener("touchmove", (e) => {
  if (ty === null) return
  e.preventDefault()
  const y = e.touches[0].clientY, now = performance.now(), dy = (ty - y) * 1.6
  push(dy); vel = dy / Math.max(8, now - tt) * 16; ty = y; tt = now
}, { passive: false })
addEventListener("touchend", () => { ty = null })
addEventListener("keydown", (e) => {
  if (document.activeElement && document.activeElement.closest && document.activeElement.closest(".p-scroll, input, textarea, select")) return
  const step = { ArrowDown: 160, PageDown: 600, " ": 600, ArrowUp: -160, PageUp: -600 }[e.key]
  if (step) { e.preventDefault(); push(step) }
  if (e.key === "Home") backToPortrait()
})
const pointer = { x: 0, y: 0, in: false, down: null }
addEventListener("pointermove", (e) => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.in = e.target === canvas; mx = (e.clientX / innerWidth) * 2 - 1; my = (e.clientY / innerHeight) * 2 - 1 }, { passive: true })
addEventListener("pointerleave", () => { pointer.in = false })
let rewind = null
function backToPortrait() { if (dist > 1) TRK("back_to_portrait", { works_seen: laneMax + 1 }); closeProject(); closeAbout(); if (dist < 1) return; rewind = { from: dist, t0: performance.now(), dur: reduced ? 1 : Math.min(2600, 1200 + Math.sqrt(dist) * 14) }; vel = 0 }
$("#back").addEventListener("click", backToPortrait)

function recycle() {
  // a tile belongs to the first generation that is still ahead of the camera
  for (let i = 0; i < N; i++) {
    const d = D.cells[i][4]
    const g = dist > d ? Math.ceil((dist - d) / P) : 0
    if (g !== tileGen[i]) setGen(i, g)
  }
}

// ---------- picking ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), tmp = new THREE.Vector3()
let hoverTile = -1
const hud = $("#hud"), hudLabel = $("#hud-label")
function pxHeight(i) {
  const w = world[i]
  tmp.copy(w.pos).applyMatrix4(field.matrixWorld).applyMatrix4(camera.matrixWorldInverse)
  const d = -tmp.z
  if (d <= w.h * 1.7) return 0                  // behind, or already mostly dissolved (it fades between 1.1 and 2.6 heights)
  return (w.h / d) * focal
}
function onScreen(i) { tmp.copy(world[i].pos).applyMatrix4(field.matrixWorld).project(camera); return Math.abs(tmp.x) < 1 && Math.abs(tmp.y) < 1 && tmp.z < 1 }
function pick() {
  if (!pointer.in || !mesh) return -1
  ndc.set((pointer.x / W) * 2 - 1, -(pointer.y / H) * 2 + 1)
  ray.setFromCamera(ndc, camera)
  const flying = uniforms.uFog.value > 0.3
  for (const h of ray.intersectObject(mesh, false)) {
    if (h.instanceId >= T || (flying ? world[h.instanceId].hideFly : h.instanceId >= N)) continue   // portrait-only tiles once flying, lane tiles before
    const px = pxHeight(h.instanceId)
    if (px === 0) continue                       // dissolving right in front of the camera: look through it
    return px >= MIN_CLICK_PX ? h.instanceId : -1
  }
  return -1
}
function setHover(i) {
  if (i === hoverTile) return
  hoverTile = i
  mesh.material.uniforms.uHover.value = i
  canvas.classList.toggle("hot", i >= 0)
  if (i >= 0) { hudLabel.textContent = D.projects[D.images[tileImg[i]][0]].t; hud.hidden = false } else hud.hidden = true
}
addEventListener("pointerdown", (e) => { pointer.down = { x: e.clientX, y: e.clientY, t: performance.now() } })
addEventListener("pointerup", (e) => {
  const d = pointer.down; pointer.down = null
  if (!d || e.target !== canvas) return
  if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 600) return
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.in = true
  const p = pick(), i = hoverTile >= 0 && p !== hoverTile ? hoverTile : p   // open what the label shows, even if the camera moved a hair
  if (i >= 0) { const img = D.images[tileImg[i]]; markSeen(tileImg[i]); openProject(img[0], img[1]) }   // the clicked piece stays still (no drift toward the viewer)
})

// ---------- what you have seen ----------
let seenFrame = 0
function trackSeen() {
  if (++seenFrame % 8) return
  for (let i = 0; i < T; i++) {
    const w = world[i], z = w.pos.z - camera.position.z
    if (z > -w.h * 2.6) continue
    if ((w.h / -z) * focal < SEEN_PX) continue
    if (world[i].hideFly && grow > 0.3) continue
    if (onScreen(i)) markSeen(tileImg[i])
  }
}
const counterEl = $("#seen")
// progress along the lane (the work in time order): how far you have travelled, then a full round once you've passed it all
let laneMax = -1
function counter() {
  if (!counterEl || !D || !D.seq) return
  const L = D.seq.length
  counterEl.textContent = laneMax + 1 >= L ? `All ${L.toLocaleString("en")} works seen` : `${Math.max(0, laneMax + 1).toLocaleString("en")} of ${L.toLocaleString("en")} works`
}

// ---------- high-resolution swaps for images close to the camera ----------
const hiGeo = new THREE.PlaneGeometry(1, 1)
const hiActive = new Map()   // tile -> { mesh, img, born }
const texCache = new Map()
function hiTexture(url) {
  if (!texCache.has(url)) {
    texCache.set(url, loadTexture(url).catch(() => null))
    if (texCache.size > 60) { const [k, old] = texCache.entries().next().value; texCache.delete(k); old.then((t) => t && t.dispose()) }
  }
  return texCache.get(url)
}
function dropHi(i) { const h = hiActive.get(i); if (!h) return; field.remove(h.mesh); h.mesh.material.dispose(); hiActive.delete(i) }
let hiFrame = 0
// sharp images go to the GPU one per frame at most, so a burst of arrivals never causes a hitch
const hiQueue = []
function drainHi() { const f = hiQueue.shift(); if (f) f() }
function updateHi(now) {
  const laneOn = uniforms.uFogV.value > 0.9   // lane pieces stay hidden at the portrait (their sharp copies too)
  for (const [i, h] of hiActive) {
    if (h.born) h.mesh.material.uniforms.uIn.value = Math.min(1, (now - h.born) / 350)
    if (i >= N && i < T) h.mesh.visible = laneOn
  }
  if (++hiFrame % 6) return
  const cand = []
  for (let i = 0; i < T; i++) {
    const w = world[i], z = w.pos.z - camera.position.z
    if (z > -w.h * 1.1) continue
    const px = (w.h / -z) * focal
    if (px < HI_PX || (world[i].hideFly && grow > 0.3) || (i >= N && !laneOn) || !onScreen(i)) continue
    cand.push([px, i])
  }
  cand.sort((a, b) => b[0] - a[0])
  const want = new Set(cand.slice(0, HI_MAX).map((c) => c[1]))
  for (const [i] of hiActive) if (!want.has(i)) dropHi(i)
  for (const i of want) {
    if (hiActive.has(i)) continue
    const j = tileImg[i], img = D.images[j], c = D.cells[i] || [0, 0, 0, 0]
    const mat = new THREE.ShaderMaterial({ vertexShader: hiVert, fragmentShader: frag(true), polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
      uniforms: { ...uniforms, uMap: { value: null }, uColor: { value: new THREE.Vector3(c[1] / 255, c[2] / 255, c[3] / 255) }, uMean: { value: new THREE.Vector3(img[5] / 255, img[6] / 255, img[7] / 255) }, uIn: { value: 0 }, uCase: { value: attr.case.array[i] } } })
    const m = new THREE.Mesh(hiGeo, mat)
    const w = world[i]
    m.position.copy(w.pos); m.scale.set(w.h * D.cell[0] / D.cell[1], w.h, 1)
    const h = { mesh: m, img: j, born: 0 }
    hiActive.set(i, h)
    hiTexture(img[4] + "?v=" + D.v).then((t) => { if (t) hiQueue.push(() => { if (hiActive.get(i) !== h) return; if (!t.__up) { renderer.initTexture(t); t.__up = 1 } mat.uniforms.uMap.value = t; h.born = performance.now(); field.add(m) }) })
  }
}

// ---------- the opened piece drifts slowly toward you while its project is open ----------
// It slides along the line from the camera, so it stays in place on screen and just grows (about 40% over ~10 s,
// easing in and out), and settles back into the field when the box closes.
const FOCUS = { i: -1, img: -1, t0: 0, f: 0, closing: false }
const FOCUS_DUR = 10000, FOCUS_NEAR = 0.3
const fPos = new THREE.Vector3()
function setFocus(i) {
  if (FOCUS.i >= 0 && FOCUS.i !== i) releaseFocus(true)
  if (reduced || world[i].float) return
  FOCUS.i = i; FOCUS.img = tileImg[i]; FOCUS.t0 = performance.now(); FOCUS.f = 0; FOCUS.closing = false
}
function releaseFocus(restore) {
  const i = FOCUS.i; FOCUS.i = -1
  if (i < 0 || !restore) return
  const w = world[i]
  vS.set(w.h, w.h, 1); mesh.setMatrixAt(i, m4.compose(w.pos, qI, vS)); mesh.instanceMatrix.needsUpdate = true
  const h = hiActive.get(i); if (h) h.mesh.position.copy(w.pos)
}
function focusPiece(now, dt) {
  const i = FOCUS.i
  if (i < 0) return
  if (tileImg[i] !== FOCUS.img) { releaseFocus(false); return }   // the tile moved on to other work while flying
  if (FOCUS.closing) {
    FOCUS.f *= Math.exp(-dt * 3.2)
    if (FOCUS.f < 0.002) { releaseFocus(true); return }
  } else {
    const p = Math.min(1, (now - FOCUS.t0) / FOCUS_DUR)
    FOCUS.f = 0.5 - 0.5 * Math.cos(Math.PI * p)   // starts and ends softly
  }
  const w = world[i], k = 1 - FOCUS_NEAR * FOCUS.f
  fPos.copy(w.pos).sub(camera.position).multiplyScalar(k).add(camera.position)
  vS.set(w.h, w.h, 1); mesh.setMatrixAt(i, m4.compose(fPos, qI, vS)); mesh.instanceMatrix.needsUpdate = true
  const h = hiActive.get(i); if (h) h.mesh.position.copy(fPos)
}

// ---------- frame ----------
// adaptive resolution never runs while the portrait forms or sheets stream in (a resize there is itself a visible pause)
const perf = [], TIMER = !!params.get("timer")
function tick(now) {
  // adaptive quality: if frames keep running slow on this device, draw fewer pixels (sharpness drops a little, smoothness returns)
  if (!TIMER && !document.hidden && now - last < 250 && introStart < 0 && !jobsA.length && !jobsB.length) { perf.push(now - last); if (perf.length >= 90) { perf.sort((a, b) => a - b); if (perf[45] > 21 && PXB > 1.4e6) { PXB *= 0.7; resize() } perf.length = 0 } }
  const dt = Math.min(0.05, (now - last) / 1000); last = now
  if (ty === null && Math.abs(vel) > 0.1) { push(vel); vel *= Math.exp(-dt * 3.5) }   // touch fling
  if (rewind) {
    // back to the portrait: a fast reverse flight, everything streams back into place
    const t = Math.min(1, (now - rewind.t0) / rewind.dur), e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    dist = target = rewind.from * (1 - e)
    if (t >= 1) { rewind = null; dist = target = 0 }
  } else {
    dist += (target - dist) * (reduced ? 1 : 1 - Math.exp(-dt * 4))
    if (Math.abs(target - dist) < 0.01) dist = target
  }
  smx += (mx - smx) * (1 - Math.exp(-dt * 1.5)); smy += (my - smy) * (1 - Math.exp(-dt * 1.5))
  const away = Math.min(1, dist / 120), ease = away * away * (3 - 2 * away)   // 0 at the portrait, 1 a little way in
  uniforms.uShift.value = SHIFT * (1 - ease)
  uniforms.uFog.value = ease; uniforms.uFogV.value = ease
  uniforms.uBlur.value = ease
  const softT = panelOpen || aboutOpen ? 1 : 0; uniforms.uSoft.value += (softT - uniforms.uSoft.value) * (1 - Math.exp(-dt * 6))
  document.body.classList.toggle("away", dist > 8)
  document.body.classList.toggle("far", dist > 60 && !rewind)
  if (!panelOpen && !aboutOpen) setView("closed")
  if (pendingOpen && (Math.abs(dist - pendingOpen.at) < 4 || performance.now() - pendingOpen.t0 > 9000)) { const o = pendingOpen; pendingOpen = null; openSrc = "selected"; openProject(o.pi, o.mi) }
  const drift = reduced ? 0 : 0.5 + ease * 2.5
  if (aim.on && !pendingOpen && (!panelOpen || Math.abs(dist - aim.at) > 12)) aim.on = false
  const ak = 1 - Math.exp(-dt * (aim.on ? 3 : 2))
  aim.x += ((aim.on ? aim.tx : 0) - aim.x) * ak; aim.y += ((aim.on ? aim.ty : 0) - aim.y) * ak
  camera.position.set(smx * drift + aim.x, -smy * drift + aim.y, -dist)
  camera.lookAt(smx * drift * 0.6 + aim.x, -smy * drift * 0.6 + aim.y, -dist - 200)
  field.rotation.z = 0                                   // images never tilt
  stage(dt)
  field.updateMatrixWorld(); camera.updateMatrixWorld()
  if (mesh) {
    setGrow(ease); recycle(); updateLane(); flush(); floatHalo(now); updateNow()
    setHover(pick())
    if (hoverTile >= 0) { hud.style.left = pointer.x + "px"; hud.style.top = pointer.y + "px" }
    intro(now); motes(now, ease); signature(now)
    trackSeen()
    updateHi(now); drainHi(); drainAtlas(now)
    focusPiece(now, dt)
  }
  drawSoft()
  raf(tick)
}

// ---------- the field behind an open card: a real gaussian blur at half resolution (two passes), not mip levels ----------
// the scene is drawn into a half-size target, blurred sideways then down, and put on screen; everything stays premultiplied
// (pieces are opaque, the background clear, the glow is light with no alpha), so the page background shows through as before
const soft = { rtA: null, rtB: null, w: 0, h: 0 }
const softQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
  uniforms: { uMap: { value: null }, uDir: { value: new THREE.Vector2(1, 0) }, uRadius: { value: 0 }, uTexel: { value: new THREE.Vector2(1, 1) } },
  depthTest: false, depthWrite: false, transparent: false, blending: THREE.NoBlending,
  vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D uMap; uniform vec2 uDir; uniform float uRadius; uniform vec2 uTexel; varying vec2 vUv;
    void main() {
      // 13 taps along one axis, gaussian weights, spread by uRadius (in texels of the half-size target)
      float w[7]; w[0] = 0.1964; w[1] = 0.1760; w[2] = 0.1255; w[3] = 0.0713; w[4] = 0.0323; w[5] = 0.0117; w[6] = 0.0034;
      vec2 st = uDir * uTexel * uRadius / 6.0;
      vec4 c = texture2D(uMap, vUv) * w[0];
      for (int i = 1; i < 7; i++) { vec2 o = st * float(i); c += (texture2D(uMap, vUv + o) + texture2D(uMap, vUv - o)) * w[i]; }
      gl_FragColor = c;
    }`,
}))
const softScene = new THREE.Scene(); softScene.add(softQuad)
const softCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
function drawSoft() {
  const k = uniforms.uSoft.value
  if (k < 0.03 || reduced) { renderer.render(scene, camera); return }
  const sz = renderer.getDrawingBufferSize(new THREE.Vector2()), w = Math.max(2, Math.round(sz.x / 2)), h = Math.max(2, Math.round(sz.y / 2))
  if (!soft.rtA || soft.w !== w || soft.h !== h) {
    if (soft.rtA) { soft.rtA.dispose(); soft.rtB.dispose() }
    const o = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false }
    soft.rtA = new THREE.WebGLRenderTarget(w, h, o); soft.rtB = new THREE.WebGLRenderTarget(w, h, { ...o, depthBuffer: false }); soft.w = w; soft.h = h
  }
  const u = softQuad.material.uniforms
  u.uTexel.value.set(1 / w, 1 / h); u.uRadius.value = k * k * 3.5   // about 7 screen px at the end of the ease: out of focus, still readable
  renderer.setRenderTarget(soft.rtA); renderer.clear(); renderer.render(scene, camera)
  u.uMap.value = soft.rtA.texture; u.uDir.value.set(1, 0); renderer.setRenderTarget(soft.rtB); renderer.render(softScene, softCam)
  u.uMap.value = soft.rtB.texture; u.uDir.value.set(0, 1); renderer.setRenderTarget(null); renderer.clear(); renderer.render(softScene, softCam)
}

// ---------- the box: intro, now passing, a project, about ----------
let panelOpen = false, aboutOpen = false
const gallery = $("#p-gallery"), stageEl = $("#p-stage"), scrollEl = $("#p-scroll")
// the box keeps its height; its width follows the piece, so a tall image makes a slim box and nothing ever scrolls
let curAspect = 0
function fitBox() {
  if (!panelOpen) { boxEl.style.width = ""; boxEl.style.height = ""; return }
  if (W <= 860) {
    // phones: the box is a sheet along the bottom; it gets as tall as the piece needs, never taller than the screen
    boxEl.style.width = ""; boxEl.style.height = ""
    if (!curAspect || scrollEl.classList.contains("multi")) return   // a whole case study: the sheet keeps its full height and scrolls
    const s = stageEl.getBoundingClientRect(), need = Math.min(s.height, s.width / curAspect)
    boxEl.style.height = Math.round(boxEl.getBoundingClientRect().height - (s.height - need)) + "px"
    return
  }
  boxEl.style.height = ""; boxEl.style.width = ""   // the card is always the same width (--box-open); every piece fits inside it
  if (scrollEl.classList.contains("multi")) scrollEl.style.setProperty("--sh", Math.round(freeStage()) + "px")
}
// how tall the first piece can be in a scrolling card: the card's height minus everything else in it
function freeStage() {
  const cs = getComputedStyle(scrollEl), gap = parseFloat(cs.rowGap) || 0
  let h = scrollEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
  for (const c of scrollEl.children) if (c !== stageEl) h -= c.getBoundingClientRect().height + gap
  return Math.max(160, h)
}
addEventListener("resize", fitBox)
function setView(v) { if (boxEl.dataset.view !== v) boxEl.dataset.view = v; document.body.classList.toggle("boxed", v === "project" || v === "about" || v === "contact" || v === "selected"); document.body.classList.toggle("side", v === "about" || v === "contact") }
function baseView() { return "closed" }
// every work has a stable link: ?work=<id> (the id is its image file name)
const workId = (pi, mi) => { const j = D.images.findIndex((im) => im[0] === pi && im[1] === mi); return j < 0 ? "" : D.images[j][4].split("/").pop().replace(/\.\w+$/, "") }
let openId = ""
const BASE_TITLE = document.title
function setUrl(id) { try { const u = new URL(location.href); if (id) u.searchParams.set("work", id); else u.searchParams.delete("work"); history.replaceState(null, "", u) } catch {} }
let openSrc = "field"
// work that doesn't change what you see waits until the click has been painted (keeps taps feeling instant)
const afterPaint = (fn) => requestAnimationFrame(() => setTimeout(fn, 0))
function openProject(pi, mi) {
  const p = D.projects[pi], src = openSrc; openSrc = "field"
  openId = workId(pi, mi)
  afterPaint(() => { TRK("project_open", { project: p.t, kind: p.k || "", case_study: p.u ? "yes" : caseOf && caseOf[pi] >= 0 ? "related" : "no", source: src }); setUrl(openId); document.title = `${p.t} · Vadim Carazan` })
  const cb = $("#p-copy"); cb.classList.remove("done"); cb.lastElementChild.textContent = "Copy link"
  panelOpen = true; aboutOpen = false; closeAcc = 0
  $("#p-src").textContent = p.k || ""
  $("#p-title").textContent = p.t
  $("#p-desc").textContent = p.d || ""
  $("#p-tags").innerHTML = (p.g || []).map((t) => `<li>${t.replace(/</g, "&lt;")}</li>`).join("")
  const link = $("#p-link"), study = caseOf && caseOf[pi] >= 0 ? D.projects[caseOf[pi]] : null
  if (study) { link.href = study.u; link.hidden = false } else link.hidden = true
  const m = p.m[mi] || p.m[0]
  // a case study opens whole: the piece you clicked first, then every other image of the study under it (the box scrolls);
  // a Dribbble shot of that client opens the same way, with the study's images under it
  const all = study ? [m, ...(study === p ? p.m : [...p.m, ...study.m]).filter((x) => x !== m)] : [m]
  // anything taller than the usual 4:3 frame (square, portrait) sits in that frame, cropped; wider pieces (16:9) keep their shape
  const isCrop = (x) => { const nat = x.w && x.h ? x.w / x.h : 0; return nat > 0 && nat < 1.3 }
  const aspectOf = (x) => { const nat = x.w && x.h ? x.w / x.h : 0; return isCrop(x) ? 4 / 3 : nat }
  curAspect = aspectOf(m)
  scrollEl.classList.toggle("multi", all.length > 1)
  scrollEl.style.setProperty("--ar", String(curAspect || 4 / 3))   // the first piece's frame in a scrolling card
  gallery.innerHTML = all.map((x, n) => {
    const cls = isCrop(x) ? ' class="crop"' : "", lazy = n ? ' loading="lazy"' : ""
    return x.v
      ? `<figure${cls}><video src="${x.v}" poster="${x.s}" autoplay muted loop playsinline${n ? ' preload="none"' : ""}></video></figure>`
      : `<figure${cls}><img src="${x.s}" alt="" decoding="async"${lazy} onload="this.classList.add('in')"></figure>`
  }).join("")
  $("#p-count").textContent = all.length > 1 ? `${all.length} pieces` : ""
  const el = gallery.querySelector("img, video")
  if (!curAspect) el.addEventListener(m.v ? "loadedmetadata" : "load", () => {
    const w = el.naturalWidth || el.videoWidth, h = el.naturalHeight || el.videoHeight
    if (w && h) { if (w / h < 1.3) { el.parentElement.classList.add("crop"); curAspect = 4 / 3 } else curAspect = w / h; scrollEl.style.setProperty("--ar", String(curAspect)); fitBox() }
  }, { once: true })
  $("#p-scroll").scrollTop = 0
  setView("project")
  afterPaint(fitBox)   // measuring the box forces layout several times; do it right after the box has appeared
}
function closeProject() {
  if (!panelOpen) return
  panelOpen = false
  afterPaint(() => { setUrl(""); document.title = BASE_TITLE })
  FOCUS.closing = true
  setView(baseView())
  gallery.querySelectorAll("video").forEach((v) => v.pause())
  setTimeout(() => { if (!panelOpen) gallery.innerHTML = "" }, 700)
}
// the about page and the brief form share the "side page" slot of the box
let sideView = "about"
let openFrom = "nav"
function openAbout(v = "about") {
  boxEl.style.height = ""
  if (panelOpen) { panelOpen = false; gallery.querySelectorAll("video").forEach((x) => x.pause()) }
  const from = openFrom; afterPaint(() => TRK(v === "contact" ? "contact_open" : v === "selected" ? "selected_open" : "about_open", { source: from })); openFrom = "nav"
  aboutOpen = true; sideView = v; closeAcc = 0; boxEl.style.width = ""; FOCUS.closing = true; setView(v)
  if (v === "contact") { resetForm(); setTimeout(() => { if (W > 860) cform.elements.name.focus({ preventScroll: true }) }, 450) }
}
function closeAbout() { if (!aboutOpen) return; aboutOpen = false; setView(baseView()) }
boxEl.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) closeProject()
  if (e.target.closest("[data-about-close]")) closeAbout()
})
addEventListener("keydown", (e) => { if (e.key === "Escape") { closeProject(); closeAbout() } })
$("#about-open").addEventListener("click", () => (aboutOpen && sideView === "about" ? closeAbout() : openAbout("about")))
$("#selected-open").addEventListener("click", () => (aboutOpen && sideView === "selected" ? closeAbout() : openAbout("selected")))
// ---------- selected work: fly to a case study and open it ----------
// Dribbble shots of a case-study client (same name, no case-study link of their own) belong to that case study:
// they get the light, and opening one shows the whole study
let caseOf = null
function linkCases() {
  const norm = (t) => t.toLowerCase().replace(/[^a-z0-9]/g, "")
  const byName = new Map(); D.projects.forEach((p, i) => { if (p.u) byName.set(norm(p.t), i) })
  caseOf = D.projects.map((p, i) => (p.u ? i : byName.has(norm(p.t)) ? byName.get(norm(p.t)) : -1))
}
const SELECTED = ["Mark OS", "Euroteam", "Noxtua", "TWIN", "Outset Law", "ADV Imagine", "Needle", "913.ai"]
let pendingOpen = null
function caseStudyOf(title) { return D.projects.findIndex((p) => p.t === title && p.u) }
// where lane piece k sits (the same numbers updateLane uses, so the flight can aim at it before it is placed)
function lanePos(k) {
  const r = rng(k + 11, 99), a = r() * Math.PI * 2, rr = Math.sqrt(r()), h = LANE.h * (0.85 + r() * 0.3)
  return { x: Math.cos(a) * rr * LANE.x, y: Math.sin(a) * rr * LANE.y, z: LANE.z0 + k * LANE.step, h }
}
// the camera slides sideways so the piece we flew to sits in the free part of the screen (beside the card), then eases back
const aim = { x: 0, y: 0, tx: 0, ty: 0, on: false, at: 0 }
function goToWork(title, from) {
  const pi = caseStudyOf(title); if (pi < 0) return
  const j = D.images.findIndex((im) => im[0] === pi), k = D.seq.indexOf(j); if (j < 0 || k < 0) return
  TRK("selected_work", { project: title, source: from || "selected" })
  closeAbout(); closeProject(); setMenu(false)
  const q = lanePos(k)
  const depth = Math.min(60, Math.max(40, q.h * 5.7))   // close enough to read (about a quarter of the screen tall), far enough to stay sharp and whole
  const at = q.z - depth
  // the projection centre already sits in the free part of the screen (beside the card, see stage()), so the camera
  // only has to slide in front of the piece; a touch higher than the frame's middle, which is set low for the portrait
  const lift = W > 860 ? (H * 0.075 * depth) / focal : 0
  aim.tx = q.x; aim.ty = q.y - lift; aim.on = true; aim.at = at
  target = at; pendingOpen = { pi, mi: D.images[j][1], at, t0: performance.now() }
}
function buildSelected() {
  const el = $("#sel-list"); if (!el) return
  el.innerHTML = SELECTED.map((t, n) => { const pi = caseStudyOf(t); if (pi < 0) return ""; const p = D.projects[pi], m = p.m[0]
    return `<li><button type="button" class="sel-item" data-work="${t.replace(/"/g, "&quot;")}"><img src="${m.s}" alt="" loading="lazy" decoding="async"><span><span class="t">${p.t}</span><span class="k">${(p.k || "").replace(/</g, "&lt;")}</span></span><span class="n">${String(n + 1).padStart(2, "0")}</span></button></li>` }).join("")
}
document.addEventListener("click", (e) => { const b = e.target.closest("[data-work]"); if (b && D) goToWork(b.dataset.work, b.classList.contains("go-work") ? "about" : "selected") })
$("#sel-all").addEventListener("click", () => { TRK("explore_click", { source: "selected" }); closeAbout(); if (dist < 200) target = 420 })
$("#contact-open").addEventListener("click", () => (aboutOpen && sideView === "contact" ? closeAbout() : openAbout("contact")))
document.addEventListener("click", (e) => { const t = e.target.closest("[data-contact]"); if (t) { e.preventDefault(); openFrom = t.closest(".v-about") ? "about_cta" : "project_cta"; openAbout("contact") } })

// ---------- the brief form ----------
// With FORM_ENDPOINT set, the brief is POSTed there as JSON; without it, the visitor's email app opens with the
// brief filled in, addressed to hi@wegrow.design (works on any static host, no server needed).
const FORM_ENDPOINT = "/api/contact"   // Pages Function -> the wegrow.design mailer
const cform = $("#cform"), cdone = $("#c-done"), cerr = $("#c-err")
function resetForm() { if (!cdone.hidden) { cform.reset(); cform.classList.remove("tried") } cform.hidden = false; cdone.hidden = true; cerr.textContent = "" }
let formStarted = false
cform.addEventListener("input", () => { if (!formStarted) { formStarted = true; TRK("form_start", { form: "start_project" }) } if (cerr.textContent && cform.checkValidity()) cerr.textContent = "" })
cform.addEventListener("submit", async (e) => {
  e.preventDefault()
  cform.classList.add("tried")
  if (!cform.checkValidity()) { cerr.textContent = "Please add your name, a valid email and a few lines about the project."; const bad = cform.querySelector(":invalid"); if (bad) bad.focus(); return }
  cerr.textContent = ""
  const f = new FormData(cform)
  const data = { name: f.get("name").trim(), email: f.get("email").trim(), company: (f.get("company") || "").trim(), need: f.getAll("need"), budget: f.get("budget") || "", message: f.get("message").trim(), source: location.href }
  const btn = cform.querySelector(".c-send")
  let sent = false
  if (FORM_ENDPOINT) {
    btn.disabled = true
    try { const r = await fetch(FORM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); sent = r.ok } catch {}
    btn.disabled = false
  }
  if (!sent) {
    const lines = [`Name: ${data.name}`, `Email: ${data.email}`]
    if (data.company) lines.push(`Company: ${data.company}`)
    if (data.need.length) lines.push(`Needs: ${data.need.join(", ")}`)
    if (data.budget) lines.push(`Budget: ${data.budget}`)
    lines.push("", data.message)
    location.href = `mailto:hi@vadimcarazan.com?subject=${encodeURIComponent("New project" + (data.company ? ": " + data.company : ""))}&body=${encodeURIComponent(lines.join("\n"))}`
  }
  $("#c-name").textContent = data.name ? ", " + data.name.split(/\s+/)[0] : ""
  $("#c-done-txt").textContent = sent ? "Your brief is on its way. I'll read it today and reply within a day." : "Your email app should open with the brief filled in, just press send. I'll reply within a day."
  if (sent) { TRK("generate_lead", { method: "start_project_form", need: data.need.join(", "), budget: data.budget, currency: "EUR", value: 1 }); try { window.clarity && window.clarity("upgrade", "lead") } catch {} }
  else TRK("form_mailto_fallback", { form: "start_project" })
  cform.hidden = true; cdone.hidden = false
})
$("#work-open").addEventListener("click", () => { closeAbout(); closeProject(); if (dist < 200) target = 420 })
$("#start").addEventListener("click", () => { TRK("explore_click", { source: "intro" }); closeAbout(); closeProject(); target = Math.max(target, 420) })
// copy the open work's link: a synchronous copy inside the tap (works in Safari/iOS and older browsers), then the async
// Clipboard API as a second try; a small toast confirms it
const toast = document.createElement("div"); toast.className = "copy-toast"; document.body.appendChild(toast)
function showToast(t) { toast.textContent = t; toast.classList.add("on"); clearTimeout(showToast.k); showToast.k = setTimeout(() => toast.classList.remove("on"), 1800) }
function copySync(text) {
  const t = document.createElement("textarea")
  t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px"
  document.body.appendChild(t)
  const r = document.createRange(); r.selectNodeContents(t); const s = getSelection(); s.removeAllRanges(); s.addRange(r)
  t.setSelectionRange(0, text.length)
  let ok = false; try { ok = document.execCommand("copy") } catch {}
  t.remove(); s.removeAllRanges()
  return ok
}
$("#p-copy").addEventListener("click", (e) => {
  e.preventDefault(); e.stopPropagation()
  const b = $("#p-copy"), url = location.origin + location.pathname + "?work=" + openId
  TRK("copy_link", { project: ($("#p-title") || {}).textContent || "", work: openId })
  const done = () => { b.classList.add("done"); b.lastElementChild.textContent = "Link copied"; showToast("Link copied"); setTimeout(() => { b.classList.remove("done"); b.lastElementChild.textContent = "Copy link" }, 2000) }
  if (copySync(url)) { done(); return }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, () => { if (navigator.share) navigator.share({ url, title: document.title }).catch(() => {}); else prompt("Copy this link", url) })
  else if (navigator.share) navigator.share({ url, title: document.title }).catch(() => {})
  else prompt("Copy this link", url)
})
$("#home").addEventListener("click", (e) => { e.preventDefault(); closeProject(); closeAbout(); backToPortrait() })
const tick60 = () => { try { const t = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Bucharest" }).format(new Date()); document.querySelectorAll("time.clock").forEach((el) => { el.textContent = t }) } catch {} }
// phones: the menu (intro, facts and navigation)
const menuBtn = $("#menu-btn"), mnav = $("#mnav")
function setMenu(open) { menuBtn.setAttribute("aria-expanded", open ? "true" : "false"); menuBtn.firstElementChild.textContent = open ? "Close" : "Menu"; mnav.classList.toggle("open", open); mnav.hidden = false }
menuBtn.addEventListener("click", () => { if (menuBtn.getAttribute("aria-expanded") !== "true") TRK("menu_open"); }); menuBtn.addEventListener("click", () => setMenu(menuBtn.getAttribute("aria-expanded") !== "true"))
mnav.addEventListener("click", (e) => {
  const b = e.target.closest("[data-go]"); if (!b) return
  setMenu(false)
  const go = b.dataset.go
  if (go === "work") $("#work-open").click(); else if (go === "about") openAbout("about"); else if (go === "selected") openAbout("selected"); else openAbout("contact")
})
addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false) })
// the "Currently" and "Based in" lines in the top bar get clicked as if they were links (seen in recordings): they open About
document.querySelectorAll(".topbar .col-go").forEach((el) => el.addEventListener("click", (e) => { if (e.target.closest("a")) return; openFrom = "topbar"; aboutOpen && sideView === "about" ? closeAbout() : openAbout("about") }))
tick60(); setInterval(tick60, 15000)
let nowK = -1
const nowEl = $("#now")
function updateNow() {
  if (!D) return
  const k = Math.max(0, Math.ceil((dist + 28 - LANE.z0) / LANE.step))   // the next piece still ahead of you in the lane
  if (k === nowK) return
  nowK = k
  const L = D.seq.length, p = D.projects[D.images[D.seq[k % L]][0]]
  $("#now-i").textContent = String((k % L) + 1).padStart(3, "0")
  $("#now-t").textContent = p.t
  const round = Math.floor(k / L) + 1
  $("#now-s").textContent = [p.k, round > 1 ? `Round ${round}` : ""].filter(Boolean).join("  ·  ")   // the count lives on the right
  if (k > laneMax) { laneMax = k; counter(); const m = [1, 10, 25, 50, 100, 250, 500, 1000].find((x) => x === k + 1); if (m) TRK("works_seen", { count: m }); if (k + 1 === D.seq.length) TRK("all_works_seen") }
}
nowEl.addEventListener("click", () => { if (!D || nowK < 0) return; const img = D.images[D.seq[nowK % D.seq.length]]; openSrc = "caption"; openProject(img[0], img[1]) })

// ---------- the signature: signed by hand as the portrait settles, again each time you come back ----------
// The pen does not move at one speed: it travels fast on the long straight strokes, slows into loops and tight turns,
// starts from rest and lifts off gently at the end. That speed profile is worked out once from the path's curvature.
const sigEl = $("#sig"), sigPen = $("#sig-stroke"), sigSoft = $("#sig-stroke-soft"), sigTip = $("#sig-tip"), sigGlow = $("#sig-glow"), hv = new THREE.Vector3()
// Safari renders SVG filters on the CPU, and the liquid-ink signature spans the whole screen behind the live 3D view,
// which made the first view stutter there. Safari gets the same signature drawn as a clean line, without the filters.
if (SAFARI) {
  sigPen.removeAttribute("filter"); sigPen.removeAttribute("mask")
  sigSoft.closest("g[mask]") && sigSoft.closest("g[mask]").remove()
  sigTip.style.display = "none"
  sigEl.classList.add("lite")
}
const SIG_DUR = 2900
const SIG = (() => {
  const L = sigPen.getTotalLength(), n = 900, ds = L / n, pts = []
  for (let i = 0; i <= n; i++) { const q = sigPen.getPointAtLength(i * ds); pts.push([q.x, q.y]) }
  const curv = new Float32Array(n + 1)
  for (let i = 1; i < n; i++) {
    const a1 = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]), a2 = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0])
    let d = Math.abs(a2 - a1); if (d > Math.PI) d = 2 * Math.PI - d
    curv[i] = d / ds
  }
  const sm = new Float32Array(n + 1)   // smooth the curvature so the speed changes like a hand, not a machine
  for (let i = 0; i <= n; i++) { let s = 0, w = 0; for (let k = -14; k <= 14; k++) { const j = i + k; if (j < 0 || j > n) continue; const g = Math.exp(-(k * k) / 60); s += curv[j] * g; w += g } sm[i] = s / w }
  const t = new Float32Array(n + 1)
  for (let i = 1; i <= n; i++) {
    const u = i / n, ramp = Math.min(1, u / 0.06) * Math.min(1, (1 - u) / 0.08 + 0.15)   // start from rest, ease off at the end
    const v = (0.25 + 0.75 * ramp) / (1 + 38 * sm[i])
    t[i] = t[i - 1] + ds / v
  }
  for (let i = 0; i <= n; i++) t[i] /= t[n]
  for (const el of [sigPen, sigSoft]) { el.style.strokeDasharray = `${L} ${L}`; el.style.strokeDashoffset = `${L}` }
  sigTip.setAttribute("d", sigPen.getAttribute("d")); sigTip.style.opacity = "0"; sigGlow.style.opacity = "0"
  // Safari draws dashed strokes unreliably (the whole line appeared at once), so there the line is grown point by point instead
  const full = sigPen.getAttribute("d")
  if (SAFARI) { sigPen.style.strokeDasharray = "none"; sigPen.style.strokeDashoffset = "0"; sigPen.setAttribute("d", "M0 0") }
  return { L, n, ds, t, pts, full }
})()
let sigD = ""
function sigGrow(len) {   // Safari: set the visible part of the line as its own path
  let d
  if (len >= SIG.L - 0.5) d = SIG.full
  else if (len <= 0) d = "M0 0"
  else {
    const P = SIG.pts, k = Math.min(SIG.n - 1, Math.floor(len / SIG.ds)), f = len / SIG.ds - k
    const parts = ["M" + P[0][0].toFixed(1) + " " + P[0][1].toFixed(1)]
    for (let i = 1; i <= k; i++) parts.push("L" + P[i][0].toFixed(1) + " " + P[i][1].toFixed(1))
    parts.push("L" + (P[k][0] + (P[k + 1][0] - P[k][0]) * f).toFixed(1) + " " + (P[k][1] + (P[k + 1][1] - P[k][1]) * f).toFixed(1))
    d = parts.join("")
  }
  if (d !== sigD) { sigD = d; (sigBaked ? sigRevealPath : sigPen).setAttribute("d", d) }
}
// ---------- the signature, baked ----------
// Browsers rasterise SVG filters on the CPU. The liquid-ink signature (turbulence, displacement, blur, over most of the
// screen) was re-rendered on every frame while it was being written, and its very first render landed in the middle of
// the portrait forming: a visible hitch, in every browser. Now the finished ink is rendered ONCE, behind the loader, into
// a bitmap, and the writing is a plain unfiltered stroke used as a mask that reveals it. Nothing filtered is drawn per frame.
let sigBaked = false, sigRevealPath = null, sigImage = null, sigBaking = false, sigBakeTimer = 0
const SIG_VB = [-60, -40, 1830, 840]   // the signature's box plus room for the ink to bleed
function sigCTM() { const g = $("#sig-rot"); return (g || sigPen).getScreenCTM() }
function sigZones() {   // the intro text and the big name, in the signature's units (the ink goes soft behind them)
  const ctm = sigCTM(); if (!ctm) return null
  const inv = ctm.inverse(), boxes = [document.querySelector(".lead"), nameEl], out = []
  for (const el of boxes) {
    const b = el.getBoundingClientRect(), pad = 6
    const p1 = new DOMPoint(b.left - pad, b.top - pad).matrixTransform(inv), p2 = new DOMPoint(b.right + pad, b.bottom + pad).matrixTransform(inv)
    out.push([p1.x, p1.y, p2.x - p1.x, p2.y - p1.y].map((n) => +n.toFixed(1)))
  }
  return out
}
async function bakeSignature() {
  if (sigBaking) return; sigBaking = true
  try {
    const zones = sigZones(); if (!zones) throw new Error("no layout")
    const r = sigEl.getBoundingClientRect(), scale = r.width / 1707.93, dpr = Math.min(devicePixelRatio || 1, 2)
    const pw = Math.min(8192, Math.round(SIG_VB[2] * scale * dpr)), ph = Math.min(8192, Math.round(SIG_VB[3] * scale * dpr))
    const defs = sigEl.querySelector("defs").cloneNode(true)
    defs.querySelectorAll(".sig-zone").forEach((el, k) => { const v = zones[k % 2]; el.setAttribute("x", v[0]); el.setAttribute("y", v[1]); el.setAttribute("width", v[2]); el.setAttribute("height", v[3]) })
    defs.querySelectorAll("mask").forEach((m) => { if (m.id === "sig-reveal") m.remove() })
    const d = SIG.full, S = 'fill="none" stroke="#f2f2f2" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"'
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${pw}" height="${ph}" viewBox="${SIG_VB.join(" ")}">${new XMLSerializer().serializeToString(defs)}` +
      `<g mask="url(#sig-blur)"><path d="${d}" ${S} filter="url(#sig-soft)" opacity="0.32"/></g><path d="${d}" ${S} mask="url(#sig-sharp)" filter="url(#sig-ink)"/></svg>`
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error("svg")); img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg) })
    const cv = document.createElement("canvas"); cv.width = pw; cv.height = ph
    const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0, pw, ph)
    const th = document.createElement("canvas"); th.width = 64; th.height = 32; const tc = th.getContext("2d"); tc.drawImage(cv, 0, 0, 64, 32)
    const px = tc.getImageData(0, 0, 64, 32).data; let on = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 6) on++
    if (on < 12) throw new Error("blank")                                   // the browser could not render the filters: keep the live version
    const blob = await new Promise((res) => cv.toBlob(res, "image/png")); if (!blob) throw new Error("blob")
    const url = URL.createObjectURL(blob)
    const NS = "http://www.w3.org/2000/svg", XL = "http://www.w3.org/1999/xlink"
    if (!sigImage) {
      const m = document.createElementNS(NS, "mask"); m.setAttribute("id", "sig-reveal"); m.setAttribute("maskUnits", "userSpaceOnUse")
      m.setAttribute("x", "-500"); m.setAttribute("y", "-500"); m.setAttribute("width", "3000"); m.setAttribute("height", "2000")
      sigRevealPath = document.createElementNS(NS, "path")
      for (const [k, v] of Object.entries({ d, fill: "none", stroke: "#fff", "stroke-width": "11", "stroke-linecap": "round", "stroke-linejoin": "round" })) sigRevealPath.setAttribute(k, v)
      m.appendChild(sigRevealPath); sigEl.querySelector("defs").appendChild(m)
      sigImage = document.createElementNS(NS, "image")
      for (const [k, v] of Object.entries({ x: SIG_VB[0], y: SIG_VB[1], width: SIG_VB[2], height: SIG_VB[3], preserveAspectRatio: "none", mask: "url(#sig-reveal)" })) sigImage.setAttribute(k, v)
      sigPen.parentNode.insertBefore(sigImage, sigPen)
    }
    const old = sigImage.getAttribute("href")
    sigImage.setAttribute("href", url); sigImage.setAttributeNS(XL, "xlink:href", url)
    if (old && old.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(old), 2000)
    if (!sigBaked) {
      // hand over: the live filtered strokes are no longer drawn, the reveal mask carries the current progress
      const len = sigLast.off !== undefined ? SIG.L - parseFloat(sigLast.off) : 0
      if (SAFARI) { sigRevealPath.style.strokeDasharray = ""; sigD = ""; sigBaked = true; sigGrow(len) }
      else { sigRevealPath.style.strokeDasharray = `${SIG.L} ${SIG.L}`; sigRevealPath.style.strokeDashoffset = (SIG.L - len).toFixed(1); sigBaked = true }
      sigPen.style.display = "none"; const sg = sigSoft.closest("g[mask]"); if (sg) sg.style.display = "none"
      sigTip.removeAttribute("filter")   // the bright pen head stays, without the blur (that filter spanned the whole signature)
      if (SAFARI) { sigTip.style.display = ""; sigEl.classList.remove("lite") }   // Safari gets the real ink too, now that it costs nothing per frame
    }
  } catch (e) { /* the live, filtered signature stays */ } finally { sigBaking = false }
}
addEventListener("resize", () => { if (!sigBaked) return; clearTimeout(sigBakeTimer); sigBakeTimer = setTimeout(bakeSignature, 350) })
function sigApply(len) {   // show the first `len` units of the signature
  const off = (SIG.L - len).toFixed(1)
  if (SAFARI) sigGrow(len)
  else if (sigBaked) sigRevealPath.style.strokeDashoffset = off
  else { sigPen.style.strokeDashoffset = off; sigSoft.style.strokeDashoffset = off }
}
function sigLengthAt(p) {   // time (0..1) -> how much of the line is drawn
  const t = SIG.t; let lo = 0, hi = SIG.n
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] < p) lo = mid; else hi = mid }
  const f = (p - t[lo]) / Math.max(1e-6, t[hi] - t[lo])
  return (lo + Math.min(1, Math.max(0, f))) * SIG.ds
}
let sigStart = -1, sigWasAway = false
const sigLast = {}
function signature(now) {
  if (dist > 8) {
    // away from the portrait: wipe the signature (it is hidden by then), so coming back starts from a blank page
    if (!sigWasAway) { sigWasAway = true; sigLast.off = String(SIG.L); sigApply(0) }
    return
  }
  if (sigWasAway) { sigWasAway = false; sigStart = now + 350 }   // back at the portrait: sign again, as the portrait settles
  if (sigStart < 0 && introStart >= 0 && introEnd > 0) sigStart = introStart + introEnd * 0.22    // a beat after the arrival begins
  if (sigStart < 0) sigStart = now
  const p = Math.min(1, Math.max(0, (now - sigStart) / SIG_DUR))
  const off = (SIG.L - sigLengthAt(p)).toFixed(1)
  if (sigLast.off !== off) { sigLast.off = off; sigApply(sigLengthAt(p)) }
  // the pen tip: the last stretch of the line drawn bright, with a soft glow at the nib; fades once the signature is done
  const drawn = sigLengthAt(p), TIP = 60
  if (p > 0 && p < 1) {
  sigTip.style.strokeDasharray = `${Math.min(TIP, drawn)} ${SIG.L * 2}`
  sigTip.style.strokeDashoffset = (-Math.max(0, drawn - TIP)).toFixed(2)
  }
  if (drawn > 0.5 && p < 1) { const q = sigPen.getPointAtLength(drawn); sigGlow.setAttribute("cx", q.x); sigGlow.setAttribute("cy", q.y) }
  const live = p > 0 && p < 1
  const tipO = live ? "0.5" : "0", glowO = live ? "1" : "0"
  if (sigTip.style.opacity !== tipO) { sigTip.style.opacity = tipO; sigGlow.style.opacity = glowO }
  // the soft zones follow the intro text and the big name (screen boxes converted into the signature's units)
  if (!sigBaked) { const zs = sigZones(); if (zs) sigEl.querySelectorAll(".sig-zone").forEach((z, k) => {
    const v = zs[k % 2], key = v.join(",")
    if (z.__k !== key) { z.__k = key; z.setAttribute("x", v[0]); z.setAttribute("y", v[1]); z.setAttribute("width", v[2]); z.setAttribute("height", v[3]) }
  }) }
  // a soft hole in the signature around the head
  const r = sigEl.getBoundingClientRect(), pt = (fx, fy) => { hv.set((fx - 0.5) * D.cols * D.cell[0], (0.5 - fy) * D.rows * D.cell[1], -D.D0).project(camera); return [(hv.x + 1) / 2 * W - r.left, (1 - hv.y) / 2 * H - r.top] }
  const c = pt(0.5, 0.34), ex = pt(0.5 + 0.24, 0.34), ey = pt(0.5, 0.34 + 0.3)
  const hk = [c[0], c[1], Math.abs(ex[0] - c[0]), Math.abs(ey[1] - c[1])].map((n) => n.toFixed(1))
  if (sigLast.h !== hk.join()) { sigLast.h = hk.join(); sigEl.style.setProperty("--hx", hk[0] + "px"); sigEl.style.setProperty("--hy", hk[1] + "px"); sigEl.style.setProperty("--hrx", hk[2] + "px"); sigEl.style.setProperty("--hry", hk[3] + "px") }
}

// ---------- arrival: the portrait gathers out of the dark ----------
let introStart = -1, introEnd = 0
const INTRO = 3200
function intro(now) {
  if (introStart < 0) return
  const t = now - introStart
  if (introEnd > 0 && t > introEnd) { introStart = -1; floatHalo(now); return }   // every piece has landed: hand over in the same frame
  const v = new THREE.Vector3(), tg = new THREE.Vector3()
  let last = 0
  for (let i = 0; i < N; i++) {
    if (tileGen[i] !== 0) continue
    const w = world[i], c = D.cells[i]
    if (!w.from) {
      // each image starts somewhere out in the dark, further back and off to the side, and arrives on its own time
      const r = rng(i + 101, 7), k = c[4] / D.D0, a = r() * Math.PI * 2, rad = (60 + r() * 120) * k
      w.from = new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad, -(c[4] * (1.4 + r() * 1.2)))
      w.delay = r() * 1500 + Math.hypot(c[5] - D.cols / 2, c[6] - D.rows * 0.4) * 9   // the centre settles first
      w.dur = 1300 + r() * 900
    }
    last = Math.max(last, w.delay + w.dur)
    let p = Math.min(1, Math.max(0, (t - w.delay) / w.dur))
    p = 1 - Math.pow(1 - p, 3)
    // the destination is where the piece will be once settled (halo pieces are already on their drifting trip)
    let dim = c[8] ?? 1, sc = 1
    if (w.float) { const h = haloState(i, now); tg.set(h.x, h.y, h.z); dim = h.dim; sc = h.s } else tg.copy(w.pos)
    v.lerpVectors(w.from, tg, p)
    attr.dim.array[i] = dim * Math.min(1, p * 1.6)
    const s = w.h * sc * (0.35 + 0.65 * p)
    vS.set(s, s, 1)
    mesh.setMatrixAt(i, m4.compose(v, qI, vS))
  }
  introEnd = last + 50
  dirty = true
}

// ---------- motes: small images keep drifting in from the dark and settle into the face ----------
const moteState = []
function motes(now, ease) {
  if (!D) return
  const ramp = introStart < 0 ? 1 : Math.min(1, Math.max(0, ((now - introStart) / (introEnd || INTRO) - 0.35) / 0.65))
  const show = (1 - ease) * ramp * ramp
  const v = new THREE.Vector3()
  for (let m = 0; m < MOTES; m++) {
    const i = T + m
    let st = moteState[m]
    if (!st || now > st.t0 + st.dur) {
      // a new trip: from a random point far out in the dark to a random place on the portrait
      let tgt = 0
      for (let t = 0; t < 20; t++) { tgt = (Math.random() * N) | 0; if (!D.cells[tgt][9] && (D.cells[tgt][8] ?? 1) >= 1) break }
      const k = D.cells[tgt][4] / D.D0, a = Math.random() * Math.PI * 2, rad = (110 + Math.random() * 140) * k
      const tw = world[tgt]
      st = moteState[m] = { t0: now + (st ? Math.random() * 1500 : Math.random() * 6000), dur: 5000 + Math.random() * 4000, tgt,
        from: new THREE.Vector3(Math.cos(a) * rad, Math.sin(a) * rad * 0.8, tw.pos.z * (1.3 + Math.random() * 0.6)), h: tw.h0 * (0.4 + Math.random() * 0.5) }
      setImage(i, (Math.random() * D.images.length) | 0)
    }
    const w = world[i], tw = world[st.tgt]
    let p = (now - st.t0) / st.dur
    if (p < 0 || show <= 0.01) { attr.dim.array[i] = 0; vS.set(0, 0, 1); mesh.setMatrixAt(i, m4.compose(w.pos, qI, vS)); continue }
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    v.lerpVectors(st.from, tw.pos, e)
    const kz = -v.z / D.D0, sw = flow(v.x / kz, v.y / kz, now / 1000 + m)
    v.x += sw[0] * (1 - e) * 12 * kz; v.y += sw[1] * (1 - e) * 12 * kz      // carried by the same slow currents
    w.pos.copy(v); w.h = st.h * (1 - 0.3 * e)
    attr.dim.array[i] = show * Math.min(1, p / 0.3) * Math.min(1, (1 - p) / 0.15) * 0.9
    vS.set(w.h, w.h, 1)
    mesh.setMatrixAt(i, m4.compose(v, qI, vS))
  }
  dirty = true
}

window.__cosmos = { aim, lanePos, get laneK() { return laneK }, get N() { return N }, screen: (i) => { const v = world[i].pos.clone().applyMatrix4(field.matrixWorld).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z] }, pick, openProject, pointer, pxHeight, get hover() { return hoverTile }, get world() { return world }, get dist() { return dist }, set target(v) { target = v }, get seen() { return seenCount }, get mesh() { return mesh }, camera, projectOf: (i) => D.projects[D.images[tileImg[i]][0]].t }
Object.defineProperty(window, "__cosmosD", { get: () => D })
init().catch((e) => { console.error(e); loaderEl.setAttribute("aria-label", "Could not load the work") })
