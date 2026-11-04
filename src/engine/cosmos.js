// Portrait cosmos (rebuilt from the measured behaviour in CLONE_SPEC.md).
// Every tile sits on the ray from the camera through one halftone cell, at its own depth and scaled by it,
// so from the start camera the field reads as one flat portrait; any movement pulls it apart.
// Scrolling flies the camera down -Z without end. The middle is a lane where the work arrives one piece
// after another in time order; the stream around it previews what is coming.
import * as THREE from 'three'
import { COLS, ROWS, CELL_W, CELL_H, D0, ASPECT, PERIOD } from './data.js'
import { drawArt, artCanvas } from './art.js'
import { hash3, clamp, smoothstep, easeOutCubic, easeInOutCubic, easeInOutQuad } from './rng.js'
import { FIELD_VERT, FIELD_FRAG, HI_VERT, HI_FRAG, QUAD_VERT, BLUR_FRAG, COMPOSITE_FRAG } from './shaders.js'

THREE.ColorManagement.enabled = false

const BG = new THREE.Vector3(10 / 255, 10 / 255, 11 / 255)
const LANE_SLOTS = 52
const LANE_START = 270
const LANE_STEP = 55
const MOTES = 260
const STRIDE = 10
const MIN_CLICK_PX = 34
const HI_PX = 170
const HI_MAX = 22
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export class Cosmos {
  constructor(canvas, data, hooks) {
    this.canvas = canvas
    this.data = data
    this.hooks = hooks
    this.N = data.images.length
    this.S = data.seq.length
    this.t = 0
    this.dist = 0
    this.target = 0
    this.fog = 0
    this.fling = 0
    this.par = { x: 0, y: 0, tx: 0, ty: 0 }
    this.aim = { x: 0, y: 0, tx: 0, ty: 0 }
    this.stage = null
    this.soft = 0
    this.boxed = false
    this.introStart = -1
    this.introEnd = 0
    this.rewind = null
    this.flyTo = null
    this.focus = null
    this.pointer = { x: -1, y: -1, inside: false, down: null }
    this.hovered = null
    this.seen = new Set()
    this.streamMemo = new Map()
    this.closeAcc = 0
    this.frame = 0
    this.devT0 = 1e9
    this.meanColor = new Float32Array(data.images.length * 3).fill(0.1)

    this.initRenderer()
    this.initField()
    this.initHi()
    this.initPost()
    this.bind()
    this.resize()
  }

  // ---------- setup ----------
  initRenderer() {
    const dpr = window.devicePixelRatio || 1
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: dpr < 1.5, powerPreference: 'high-performance' })
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 8000)
    this.raycaster = new THREE.Raycaster()
    this.budget = 5.5e6
  }

  initField() {
    const { cells } = this.data
    this.nCells = cells.length
    this.laneBase = this.nCells
    this.moteBase = this.nCells + LANE_SLOTS
    const M = (this.M = this.nCells + LANE_SLOTS + MOTES)
    const base = new THREE.PlaneGeometry(1, 1)
    const g = new THREE.InstancedBufferGeometry()
    g.index = base.index
    g.setAttribute('position', base.getAttribute('position'))
    g.setAttribute('uv', base.getAttribute('uv'))
    const mk = (n) => new THREE.InstancedBufferAttribute(new Float32Array(M * n), n).setUsage(THREE.DynamicDrawUsage)
    this.a = { iPos: mk(3), iSize: mk(1), iTile: mk(1), iAlpha: mk(1), iDim: mk(1), iHover: mk(1), iColor: mk(3), iSeed: mk(1), iLum: mk(1) }
    for (const [k, v] of Object.entries(this.a)) g.setAttribute(k, v)
    g.instanceCount = M

    // per-cell constants
    const rnd = (i, s) => hash3(i, s, 991)
    this.cellK = new Float32Array(this.nCells)
    this.cellHome = new Float32Array(this.nCells * 3)
    this.cellH0 = new Float32Array(this.nCells)
    this.intro = new Float32Array(this.nCells * 6) // delay, dur, angle, radius, depthMul, -
    this.halo = new Float32Array(this.nCells * 4) // speed, phase, R0, -
    cells.forEach((c, i) => {
      const k = c.d / D0
      this.cellK[i] = k
      this.cellHome[i * 3] = (c.col + 0.5 - COLS / 2) * CELL_W * k
      this.cellHome[i * 3 + 1] = (ROWS / 2 - c.row - 0.5) * CELL_H * k
      this.cellHome[i * 3 + 2] = -c.d
      this.cellH0[i] = CELL_H * k * 0.94
      const gd = Math.hypot(c.col - COLS / 2, c.row - ROWS * 0.4)
      this.intro[i * 6] = rnd(i, 1) * 1500 + 9 * gd
      this.intro[i * 6 + 1] = 1300 + rnd(i, 2) * 900
      this.intro[i * 6 + 2] = rnd(i, 3) * Math.PI * 2
      this.intro[i * 6 + 3] = (60 + rnd(i, 4) * 120) * k
      this.intro[i * 6 + 4] = 1.4 + rnd(i, 5) * 1.2
      this.halo[i * 4] = 0.05 + rnd(i, 6) * 0.07
      this.halo[i * 4 + 1] = rnd(i, 7)
      this.halo[i * 4 + 2] = (20 + rnd(i, 8) * 40 + (1 - c.dim) * 40) * k
      this.a.iSeed.array[i] = rnd(i, 9)
      this.a.iLum.array[i] = 0.25 + 0.75 * c.lum
    })
    for (let i = this.nCells; i < M; i++) { this.a.iSeed.array[i] = hash3(i, 9, 991); this.a.iLum.array[i] = 0.85 }
    this.motes = Array.from({ length: MOTES }, (_, m) => ({ t0: -hash3(m, 1) * 8, dur: 5 + hash3(m, 2) * 4, trip: -1 }))
    this.fullCells = cells.map((c, i) => i).filter((i) => !cells[i].filler)

    this.uniforms = {
      uAtlas: { value: null },
      uGrid: { value: new THREE.Vector2(1, 1) },
      uTile: { value: new THREE.Vector2(1, 1) },
      uInset: { value: new THREE.Vector2(0, 0) },
      uBg: { value: BG },
      uFog: { value: 0 },
      uBias: { value: 0 },
      uDev: { value: 0 },
      uShift: { value: 0 },
    }
    this.fieldMat = new THREE.ShaderMaterial({ vertexShader: FIELD_VERT, fragmentShader: FIELD_FRAG, uniforms: this.uniforms })
    this.field = new THREE.Mesh(g, this.fieldMat)
    this.field.frustumCulled = false
    this.scene.add(this.field)
  }

  initHi() {
    this.hiCache = new Map() // image id -> texture
    this.hiPool = []
    const geo = new THREE.PlaneGeometry(4 / 3, 1)
    for (let i = 0; i < HI_MAX; i++) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: HI_VERT,
        fragmentShader: HI_FRAG,
        uniforms: {
          uMap: { value: null }, uAlpha: { value: 0 }, uDim: { value: 1 }, uHover: { value: 0 }, uSize: { value: 1 },
          uBg: this.uniforms.uBg, uFog: this.uniforms.uFog, uBias: this.uniforms.uBias,
        },
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      mesh.frustumCulled = false
      mesh.renderOrder = 1
      this.scene.add(mesh)
      this.hiPool.push({ mesh, inst: -1, img: -1, t0: 0 })
    }
  }

  initPost() {
    const rt = () => new THREE.WebGLRenderTarget(1, 1, { type: THREE.UnsignedByteType, depthBuffer: true })
    this.rtA = rt()
    this.rtB = rt()
    this.rtB.depthBuffer = false
    const quad = new THREE.PlaneGeometry(2, 2)
    this.blurMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: BLUR_FRAG, uniforms: { uTex: { value: null }, uDir: { value: new THREE.Vector2() } }, depthTest: false, depthWrite: false })
    this.compMat = new THREE.ShaderMaterial({ vertexShader: QUAD_VERT, fragmentShader: COMPOSITE_FRAG, uniforms: { uTex: { value: null }, uBg: { value: BG }, uSoft: { value: 0 } }, depthTest: false, depthWrite: false, transparent: false })
    this.postScene = new THREE.Scene()
    this.postQuad = new THREE.Mesh(quad, this.blurMat)
    this.postQuad.frustumCulled = false
    this.postScene.add(this.postQuad)
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  }

  // ---------- atlas (generated in slices so the loader can show real progress) ----------
  async buildAtlas(onProgress) {
    if (this.data.atlas) return this.loadAtlas(onProgress)
    const { images } = this.data
    const small = Math.min(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2) < 1200
    const tw = small ? 64 : 128
    const th = small ? 48 : 96
    const cols = Math.floor(4096 / tw)
    const rows = Math.ceil(images.length / cols)
    const c = document.createElement('canvas')
    c.width = cols * tw
    c.height = rows * th
    const g = c.getContext('2d', { willReadFrequently: true })
    if (document.fonts) await document.fonts.ready.catch(() => {})
    const mean = new Float32Array(images.length * 3)
    const slice = 40
    for (let i = 0; i < images.length; i += slice) {
      for (let j = i; j < Math.min(images.length, i + slice); j++) {
        const im = images[j]
        const x = (j % cols) * tw
        const y = Math.floor(j / cols) * th
        g.save()
        g.beginPath(); g.rect(x, y, tw, th); g.clip()
        g.translate(x, y)
        drawArt(g, tw, th, im.seed, im.kind)
        g.restore()
        const px = g.getImageData(x + tw / 4, y + th / 4, tw / 2, th / 2).data
        let r = 0, gg = 0, b = 0
        for (let p = 0; p < px.length; p += 16) { r += px[p]; gg += px[p + 1]; b += px[p + 2] }
        const n = px.length / 16
        mean[j * 3] = r / n / 255
        mean[j * 3 + 1] = gg / n / 255
        mean[j * 3 + 2] = b / n / 255
      }
      onProgress(Math.min(i + slice, images.length) / images.length)
      await new Promise((r) => requestAnimationFrame(r))
    }
    this.meanColor = mean
    const tex = new THREE.CanvasTexture(c)
    tex.flipY = false
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.anisotropy = 4
    tex.colorSpace = THREE.NoColorSpace
    this.uniforms.uAtlas.value = tex
    this.uniforms.uGrid.value.set(cols, rows)
    this.uniforms.uTile.value.set(tw / c.width, th / c.height)
    this.uniforms.uInset.value.set(1.5 / c.width, 1.5 / c.height)
    this.renderer.initTexture(tex)
    this.devT0 = this.t
  }

  // imported works: one pre-built atlas sheet (half size on phones), streamed so the loader shows real bytes
  async loadAtlas(onProgress) {
    const a = this.data.atlas
    const small = Math.min(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 2) < 1200
    const res = await fetch(small ? a.sm : a.src)
    const total = +res.headers.get('content-length') || 0
    const chunks = []
    let got = 0
    const reader = res.body.getReader()
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      got += value.length
      if (total) onProgress(Math.min(1, got / total))
    }
    const bmp = await createImageBitmap(new Blob(chunks, { type: 'image/webp' }))
    const mean = new Float32Array(this.N * 3)
    this.data.images.forEach((im, i) => { mean[i * 3] = im.mean[0]; mean[i * 3 + 1] = im.mean[1]; mean[i * 3 + 2] = im.mean[2] })
    this.meanColor = mean
    const tex = new THREE.Texture(bmp)
    tex.flipY = false
    tex.generateMipmaps = true
    tex.minFilter = THREE.LinearMipmapLinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.anisotropy = 4
    tex.colorSpace = THREE.NoColorSpace
    tex.needsUpdate = true
    this.uniforms.uAtlas.value = tex
    this.uniforms.uGrid.value.set(a.cols, a.rows)
    this.uniforms.uTile.value.set(1 / a.cols, 1 / a.rows)
    this.uniforms.uInset.value.set(1.5 / bmp.width, 1.5 / bmp.height)
    this.renderer.initTexture(tex)
    onProgress(1)
    this.devT0 = this.t
  }

  // hi-res close-up texture: real file for imported works, drawn for placeholders
  hiTexture(img) {
    const im = this.data.images[img]
    if (!im.real) {
      const tex = new THREE.CanvasTexture(artCanvas(im.seed, im.kind, 512, 384))
      return tex
    }
    if (!this.hiLoading) this.hiLoading = new Set()
    if (this.hiLoading.has(img)) return null
    this.hiLoading.add(img)
    fetch(im.hi).then((r) => r.blob()).then(createImageBitmap).then((bmp) => {
      const tex = new THREE.Texture(bmp)
      tex.needsUpdate = true
      this.hiReady = this.hiReady || new Map()
      this.hiReady.set(img, tex)
    }).catch(() => {}).finally(() => this.hiLoading.delete(img))
    return null
  }

  start() {
    this.introStart = this.t
    let end = 0
    for (let i = 0; i < this.nCells; i++) end = Math.max(end, this.intro[i * 6] + this.intro[i * 6 + 1])
    this.introEnd = this.t + (end + 50) / 1000
    this.running = true
  }

  // ---------- input ----------
  bind() {
    const inUI = (e) => e.target && e.target.closest && e.target.closest('.box, .mnav')
    this.onWheel = (e) => {
      if (inUI(e)) return
      e.preventDefault()
      let dy = e.deltaY
      if (e.deltaMode === 1) dy *= 32
      else if (e.deltaMode === 2) dy *= innerHeight
      this.push(dy * 0.55, true)
    }
    this.onKey = (e) => {
      const el = document.activeElement
      if (el && (el.closest('.p-scroll') || /INPUT|TEXTAREA|SELECT/.test(el.tagName))) {
        if (e.key === 'Escape') this.hooks.onEscape()
        return
      }
      const map = { ArrowDown: 160, ArrowUp: -160, PageDown: 600, ' ': 600, PageUp: -600 }
      if (e.key in map) { e.preventDefault(); this.push(map[e.key]) }
      else if (e.key === 'Home') { e.preventDefault(); this.back() }
      else if (e.key === 'Escape') this.hooks.onEscape()
    }
    let lastY = 0, lastT = 0
    this.onTouchStart = (e) => {
      if (inUI(e)) return
      lastY = e.touches[0].clientY; lastT = performance.now(); this.fling = 0; this.flingV = 0
    }
    this.onTouchMove = (e) => {
      if (inUI(e)) return
      e.preventDefault()
      const y = e.touches[0].clientY
      const now = performance.now()
      const dy = (lastY - y) * 1.6
      this.push(dy, true)
      this.flingV = (dy / Math.max(8, now - lastT)) * 16
      lastY = y; lastT = now
    }
    this.onTouchEnd = () => { if (!this.boxed && performance.now() - lastT < 80) this.fling = this.flingV || 0; this.flingV = 0 }
    this.onPointerMove = (e) => {
      this.par.tx = (e.clientX / innerWidth) * 2 - 1
      this.par.ty = -((e.clientY / innerHeight) * 2 - 1)
      this.pointer.x = e.clientX
      this.pointer.y = e.clientY
      this.pointer.inside = e.target === this.canvas
      this.pointer.touch = e.pointerType === 'touch'
    }
    this.onPointerDown = (e) => { this.pointer.down = { x: e.clientX, y: e.clientY, t: performance.now() }; this.onPointerMove(e) }
    this.onPointerUp = (e) => {
      const d = this.pointer.down
      this.pointer.down = null
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8 || performance.now() - d.t > 600) return
      if (e.pointerType === 'touch') { this.pointer.x = e.clientX; this.pointer.y = e.clientY; this.pointer.inside = true; this.pick() }
      if (this.hovered) this.open(this.hovered)
    }
    this.onLeave = () => { this.pointer.inside = false }
    this.onResize = () => this.resize()
    addEventListener('wheel', this.onWheel, { passive: false })
    addEventListener('keydown', this.onKey)
    addEventListener('touchstart', this.onTouchStart, { passive: true })
    addEventListener('touchmove', this.onTouchMove, { passive: false })
    addEventListener('touchend', this.onTouchEnd, { passive: true })
    addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('pointerleave', this.onLeave)
    addEventListener('resize', this.onResize)
  }

  push(d, scroll = false) {
    if (!this.running) return
    if (this.boxed && scroll) {
      // with a box open a wheel/touch scroll doesn't move the camera; enough of it closes the box
      this.fling = 0
      this.closeAcc += Math.abs(d)
      if (this.closeAcc >= 120) { this.closeAcc = 0; this.hooks.onScrollClose() }
      return
    }
    this.rewind = null
    this.flyTo = null
    this.target = Math.max(0, this.target + d)
  }

  // ---------- public controls ----------
  flyIn(min = 420) { this.rewind = null; this.target = Math.max(this.target, min) }
  back() {
    this.flyTo = null
    this.fling = 0
    this.aim.tx = this.aim.ty = 0
    if (reduced) { this.dist = this.target = 0; return }
    this.rewind = { from: this.dist, t0: this.t, dur: Math.min(2600, 1200 + Math.sqrt(this.dist) * 14) / 1000 }
  }
  setBoxed(b) {
    if (this.boxed && !b) this.snapFov = true
    this.boxed = b
    this.closeAcc = 0
    if (!b && this.focus) this.focus.closing = true
  }
  goToWork(imageId) {
    // fly to the lane slot showing this image (first one ahead), then open it on arrival
    const pos = this.data.seq.indexOf(imageId)
    if (pos < 0) return
    const kNow = Math.max(0, Math.ceil((this.dist - LANE_START) / LANE_STEP))
    let k = pos + Math.floor(Math.max(0, kNow - pos) / this.S) * this.S
    if (k < kNow - 1) k += this.S
    const s = this.laneSlot(k)
    this.rewind = null
    this.target = Math.max(0, LANE_START + LANE_STEP * k - s.h * 5.7)
    this.flyTo = { k, t0: this.t, x: s.x, y: s.y }
  }

  // ---------- geometry helpers ----------
  laneSlot(k) {
    const r = Math.sqrt(hash3(k, 1, 77))
    const a = hash3(k, 2, 77) * Math.PI * 2
    return { x: Math.cos(a) * r * 12, y: Math.sin(a) * r * 7, z: -(LANE_START + LANE_STEP * k), h: 7.5 * (0.85 + hash3(k, 3, 77) * 0.3), img: this.data.seq[k % this.S] }
  }

  streamImage(i, g, z) {
    const key = i * 4096 + g
    let img = this.streamMemo.get(key)
    if (img !== undefined) return img
    const kz = Math.floor((-z - LANE_START) / LANE_STEP)
    const near = this._streamR < 82.5
    for (let tries = 0; tries < (near ? 6 : 1); tries++) {
      const off = 20 + Math.floor(hash3(i, g, 300 + tries) * 500)
      img = this.data.seq[(((kz + off) % this.S) + this.S) % this.S]
      if (!near || !this.seen.has(img)) break
    }
    this.streamMemo.set(key, img)
    if (this.streamMemo.size > 20000) this.streamMemo.clear()
    return img
  }

  resize() {
    const W = innerWidth, H = innerHeight
    const pr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(this.budget / (W * H)))
    this.renderer.setPixelRatio(pr)
    this.renderer.setSize(W, H, false)
    this.canvas.style.width = W + 'px'
    this.canvas.style.height = H + 'px'
    this.camera.aspect = W / H
    const hw = Math.max(1, Math.round((W * pr) / 2)), hh = Math.max(1, Math.round((H * pr) / 2))
    this.rtA.setSize(hw, hh)
    this.rtB.setSize(hw, hh)
    this.stage = null
  }

  // the "stage": FOV and projection centre that fit the 100-unit portrait into the free frame
  stageTarget() {
    const W = innerWidth, H = innerHeight
    const f = this.hooks.getFrame()
    const phone = W <= 860
    let top = Math.max(f.topbarBottom + 10, 0.085 * H)
    let bottom = Math.max(1.07 * H, top + 200)
    let left = 0
    const right = W
    if (f.box && !phone) left = f.box.right
    if (f.box && phone) bottom = Math.max(top + 160, H - f.box.height - 30)
    let cx = (left + right) / 2
    let cy = (top + bottom) / 2 - (f.box ? 0 : 0.08 * H)
    let fh = bottom - top
    if (phone && !f.box) { fh = 0.7 * H; cy = 0.475 * H; cx = 0.47 * W }
    const fw = right - left
    const fitH = 2 * Math.atan(((100 / 1.03) / 2 / D0) * (H / fh))
    const fitW = 2 * Math.atan(((100 * ASPECT) / 0.96 / 2 / D0 / (W / H)) * (W / fw))
    const fov = (phone && !f.box ? fitH : Math.max(fitH, fitW)) * (180 / Math.PI)
    return { fov, ox: W / 2 - cx, oy: H / 2 - cy }
  }

  // ---------- per-frame ----------
  update(dt) {
    const t = this.t
    const W = innerWidth, H = innerHeight

    // travel
    if (this.rewind) {
      const p = clamp((t - this.rewind.t0) / this.rewind.dur, 0, 1)
      this.dist = this.target = this.rewind.from * (1 - easeInOutCubic(p))
      if (p >= 1) this.rewind = null
    } else {
      if (this.boxed) this.fling = 0
      if (Math.abs(this.fling) > 0.01) { this.target = Math.max(0, this.target + this.fling * dt * 60); this.fling *= Math.exp(-3.5 * dt) }
      if (reduced) this.dist = this.target
      else this.dist += (this.target - this.dist) * (1 - Math.exp(-4 * dt))
      if (Math.abs(this.target - this.dist) < 0.01) this.dist = this.target
    }
    const fog = (this.fog = smoothstep(0, 1, clamp(this.dist / 120, 0, 1)))
    const grow = fog

    // fly-to (selected work): slide sideways onto the piece, open it on arrival
    if (this.flyTo) {
      const ft = this.flyTo
      this.aim.tx = ft.x
      this.aim.ty = ft.y
      if (Math.abs(this.target - this.dist) < 4 || t - ft.t0 > 9) {
        this.flyTo = null
        this.open({ kind: 'lane', k: ft.k, img: this.laneSlot(ft.k).img, inst: this.laneBase + (ft.k % LANE_SLOTS) })
      }
    } else if (this.dist < 60) { this.aim.tx = 0; this.aim.ty = 0 }
    const ka = 1 - Math.exp(-3 * dt)
    this.aim.x += (this.aim.tx - this.aim.x) * ka
    this.aim.y += (this.aim.ty - this.aim.y) * ka

    // pointer parallax
    const kp = reduced ? 0 : 1 - Math.exp(-1.5 * dt)
    this.par.x += (this.par.tx - this.par.x) * kp
    this.par.y += (this.par.ty - this.par.y) * kp
    const drift = reduced ? 0 : 0.5 + 2.5 * fog
    const cam = this.camera
    cam.position.set(this.par.x * drift + this.aim.x, this.par.y * drift + this.aim.y, -this.dist)
    cam.lookAt(this.par.x * drift * 0.6 + this.aim.x, this.par.y * drift * 0.6 + this.aim.y, -this.dist - 200)

    // stage framing (rate 5)
    const st = this.stageTarget()
    if (!this.stage) this.stage = { ...st }
    const ks = 1 - Math.exp(-5 * dt)
    if (this.snapFov) { this.stage.fov = st.fov; this.snapFov = false }
    else this.stage.fov += (st.fov - this.stage.fov) * ks
    this.stage.ox += (st.ox - this.stage.ox) * ks
    this.stage.oy += (st.oy - this.stage.oy) * ks
    cam.fov = this.stage.fov
    cam.setViewOffset(W, H, this.stage.ox, this.stage.oy, W, H)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld()

    // background blur when a box is open
    this.soft += ((this.boxed && !reduced ? 1 : 0) - this.soft) * (1 - Math.exp(-6 * dt))
    this.uniforms.uFog.value = fog
    this.uniforms.uBias.value = this.soft * 0.6
    this.uniforms.uDev.value = t - this.devT0
    this.uniforms.uShift.value = 0.35 * (1 - fog)

    this.updateField(dt, fog, grow)
    if (this.frame % 6 === 0) this.updateHi()
    this.tickHi()
    if (this.pointer.inside && !this.pointer.touch) this.pick()
    else this.setHover(null)
    if (this.frame % 8 === 0) this.trackSeen()
    this.report()
  }

  updateField(dt, fog, grow) {
    const { cells } = this.data
    const A = this.a
    const pos = A.iPos.array, size = A.iSize.array, tile = A.iTile.array, alpha = A.iAlpha.array, dimA = A.iDim.array, col = A.iColor.array
    const mc = this.meanColor
    const t = this.t
    const introMs = this.introStart < 0 ? -1 : (t - this.introStart) * 1000
    const introP = this.introStart < 0 ? 0 : clamp((t - this.introStart) / Math.max(0.001, this.introEnd - this.introStart), 0, 1)
    const atPortrait = 1 - fog
    const dist = this.dist
    const hoverInst = this.hovered ? this.hovered.inst : -1

    for (let i = 0; i < this.nCells; i++) {
      const c = cells[i]
      const k = this.cellK[i]
      let x = this.cellHome[i * 3], y = this.cellHome[i * 3 + 1], z = this.cellHome[i * 3 + 2]
      let h = this.cellH0[i] * (c.filler ? c.hs : c.hs + (1 - c.hs) * grow)
      let a = 1
      let img = c.img
      let dim = c.dim + (1 - c.dim) * fog
      const stream = i % STRIDE === 0
      const gen = stream && dist > c.d ? Math.ceil((dist - c.d) / PERIOD) : 0

      if (gen > 0) {
        // recycled into the tunnel around the lane
        const r = 30 + 120 * Math.pow(hash3(i, gen, 11), 0.8)
        const ang = hash3(i, gen, 12) * Math.PI * 2
        x = Math.cos(ang) * r
        y = Math.sin(ang) * r * 0.8
        z = -(c.d + gen * PERIOD)
        h = 1.4 + Math.pow(hash3(i, gen, 13), 2.2) * 7
        this._streamR = r
        img = this.streamImage(i, gen, z)
        dim = 1
      } else {
        // halo pieces loop in from the dark onto the silhouette
        if (c.dim < 1 && atPortrait > 0.001) {
          const sp = this.halo[i * 4], ph = this.halo[i * 4 + 1], R0 = this.halo[i * 4 + 2]
          const u = (t * sp + ph) % 1
          const out = R0 * Math.pow(1 - u, 1.6)
          let dx = x, dy = y + 10 * k
          const dl = Math.hypot(dx, dy) || 1
          dx /= dl; dy /= dl
          const sw = 0.35 * R0 * (1 - u)
          const fx = Math.sin(x * 0.045 + t * 0.23) + Math.sin(y * 0.03 - t * 0.31)
          const fy = Math.cos(y * 0.045 + t * 0.35) + Math.sin(x * 0.03 + t * 0.27)
          x += (dx * out + fx * sw * 0.5) * atPortrait
          y += (dy * out + fy * sw * 0.5) * atPortrait
          h *= 0.6 + 0.4 * u
          a *= smoothstep(0, 0.3, u) * (1 - 0.85 * smoothstep(0.82, 1, u))
        }
        // portrait-only fillers dissolve as you fly in; the middle stays clear for the lane
        if (c.filler) a *= 1 - smoothstep(0.2, 0.85, fog)
        if (Math.abs(x) < 30 && Math.abs(y) < 22) a *= 1 - fog
        // intro arrival
        if (introMs < 0) a = 0
        else if (introMs < this.intro[i * 6] + this.intro[i * 6 + 1]) {
          const p = easeOutCubic(clamp((introMs - this.intro[i * 6]) / this.intro[i * 6 + 1], 0, 1))
          const ang = this.intro[i * 6 + 2], R = this.intro[i * 6 + 3], dm = this.intro[i * 6 + 4]
          const sx = x + Math.cos(ang) * R, sy = y + Math.sin(ang) * R, sz = z * dm
          x = sx + (x - sx) * p
          y = sy + (y - sy) * p
          z = sz + (z - sz) * p
          h *= 0.35 + 0.65 * p
          a *= Math.min(1, 1.6 * p)
        }
      }
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z
      size[i] = h
      alpha[i] = a
      dimA[i] = dim
      tile[i] = img
      col[i * 3] = mc[img * 3]; col[i * 3 + 1] = mc[img * 3 + 1]; col[i * 3 + 2] = mc[img * 3 + 2]
    }

    // the lane: 52 live slots rolled forward
    const laneA = smoothstep(0.25, 0.9, fog)
    const k0 = Math.max(0, Math.floor((dist - LANE_START) / LANE_STEP) - 1)
    for (let k = k0; k < k0 + LANE_SLOTS; k++) {
      const s = this.laneSlot(k)
      const j = this.laneBase + (k % LANE_SLOTS)
      pos[j * 3] = s.x; pos[j * 3 + 1] = s.y; pos[j * 3 + 2] = s.z
      size[j] = s.h
      alpha[j] = laneA
      dimA[j] = 1
      tile[j] = s.img
      col[j * 3] = mc[s.img * 3]; col[j * 3 + 1] = mc[s.img * 3 + 1]; col[j * 3 + 2] = mc[s.img * 3 + 2]
      this.laneK = this.laneK || new Int32Array(LANE_SLOTS)
      this.laneK[k % LANE_SLOTS] = k
    }

    // motes drifting into the face (portrait only)
    const moteOn = smoothstep(0.35, 0.6, introP) * atPortrait
    for (let m = 0; m < MOTES; m++) {
      const j = this.moteBase + m
      const mo = this.motes[m]
      let u = (t - mo.t0) / mo.dur
      if (u >= 1 || mo.trip < 0) {
        mo.trip++
        mo.t0 = t - (mo.trip === 0 ? hash3(m, 5) * mo.dur * 0.9 : 0)
        mo.dur = 5 + hash3(m, mo.trip, 2) * 4
        const ci = this.fullCells[Math.floor(hash3(m, mo.trip, 3) * this.fullCells.length)]
        const kk = this.cellK[ci]
        const ang = hash3(m, mo.trip, 4) * Math.PI * 2
        const R = (110 + hash3(m, mo.trip, 5) * 140) * kk
        mo.ci = ci
        mo.sx = this.cellHome[ci * 3] + Math.cos(ang) * R
        mo.sy = this.cellHome[ci * 3 + 1] + Math.sin(ang) * R
        mo.sz = this.cellHome[ci * 3 + 2] * (1.3 + hash3(m, mo.trip, 6) * 0.6)
        mo.s = 0.4 + hash3(m, mo.trip, 7) * 0.5
        mo.img = Math.floor(hash3(m, mo.trip, 8) * this.N)
        u = (t - mo.t0) / mo.dur
      }
      const e = easeInOutQuad(clamp(u, 0, 1))
      const ci = mo.ci
      const kk = this.cellK[ci]
      const sw = 12 * kk * (1 - e)
      const tx = this.cellHome[ci * 3], ty = this.cellHome[ci * 3 + 1], tz = this.cellHome[ci * 3 + 2]
      pos[j * 3] = mo.sx + (tx - mo.sx) * e + Math.sin(t * 0.3 + m) * sw
      pos[j * 3 + 1] = mo.sy + (ty - mo.sy) * e + Math.cos(t * 0.25 + m * 1.7) * sw
      pos[j * 3 + 2] = mo.sz + (tz - mo.sz) * e
      size[j] = this.cellH0[ci] * mo.s * (1 - 0.3 * e)
      alpha[j] = 0.9 * smoothstep(0, 0.15, u) * (1 - smoothstep(0.85, 1, u)) * moteOn
      dimA[j] = 1
      tile[j] = mo.img
      col[j * 3] = mc[mo.img * 3]; col[j * 3 + 1] = mc[mo.img * 3 + 1]; col[j * 3 + 2] = mc[mo.img * 3 + 2]
    }

    // focus drift: the opened piece slides 30% closer along its ray over 10 s
    if (this.focus) {
      const f = this.focus
      if (f.closing) f.e *= Math.exp(-3.2 * dt)
      else f.e = reduced ? 0 : 0.3 * (1 - Math.cos(Math.PI * clamp((t - f.t0) / 10, 0, 1))) / 2
      const j = f.inst
      if (f.closing && f.e < 0.001) this.focus = null
      else {
        const cp = this.camera.position
        const s = 1 - f.e
        pos[j * 3] = cp.x + (pos[j * 3] - cp.x) * s
        pos[j * 3 + 1] = cp.y + (pos[j * 3 + 1] - cp.y) * s
        pos[j * 3 + 2] = cp.z + (pos[j * 3 + 2] - cp.z) * s
        size[j] *= s
      }
    }

    const hv = A.iHover.array
    hv.fill(0)
    if (hoverInst >= 0) hv[hoverInst] = 1
    for (const v of Object.values(A)) if (v !== A.iSeed && v !== A.iLum) v.needsUpdate = true
  }

  // screen height in px of a tile at world position
  pxHeight(j) {
    const p = this.a.iPos.array
    const depth = this.camera.position.z - p[j * 3 + 2]
    if (depth <= 0.1) return 0
    return (this.a.iSize.array[j] / (2 * Math.tan((this.camera.fov * Math.PI) / 360) * depth)) * innerHeight
  }

  // ---------- hi-res close-ups ----------
  updateHi() {
    if (!this.uniforms.uAtlas.value) return
    const cand = []
    const p = this.a.iPos.array, al = this.a.iAlpha.array
    const cz = this.camera.position.z
    const check = (j) => {
      if (al[j] < 0.05 || cz - p[j * 3 + 2] < 0.5) return
      const px = this.pxHeight(j)
      if (px > HI_PX) cand.push([j, px])
    }
    for (let j = this.laneBase; j < this.moteBase; j++) check(j)
    for (let i = 0; i < this.nCells; i += 1) if (al[i] > 0.05 && this.data.cells[i].hs > 0.2 || i % STRIDE === 0) check(i)
    cand.sort((a, b) => b[1] - a[1])
    const want = new Map(cand.slice(0, HI_MAX).map(([j]) => [j, this.a.iTile.array[j]]))
    // release slots no longer wanted
    for (const s of this.hiPool) if (s.inst >= 0 && want.get(s.inst) !== s.img) { s.inst = -1; s.mesh.visible = false }
    let uploads = 0
    for (const [j, img] of want) {
      if (this.hiPool.some((s) => s.inst === j)) continue
      const slot = this.hiPool.find((s) => s.inst < 0)
      if (!slot) break
      let tex = this.hiCache.get(img)
      if (!tex) {
        // at most one GPU upload per pass; real files arrive asynchronously through hiReady
        if (uploads >= 1) continue
        tex = this.hiReady?.get(img) || this.hiTexture(img)
        if (!tex) continue
        this.hiReady?.delete(img)
        uploads++
        tex.colorSpace = THREE.NoColorSpace
        tex.minFilter = THREE.LinearMipmapLinearFilter
        tex.anisotropy = 4
        this.renderer.initTexture(tex)
        this.hiCache.set(img, tex)
        if (this.hiCache.size > 80) {
          const [k0, t0] = this.hiCache.entries().next().value
          if (!this.hiPool.some((s) => s.img === k0)) { t0.dispose(); this.hiCache.delete(k0) }
        }
      }
      slot.inst = j
      slot.img = img
      slot.t0 = this.t
      slot.mesh.material.uniforms.uMap.value = tex
      slot.mesh.visible = true
    }
  }

  tickHi() {
    const p = this.a.iPos.array, s = this.a.iSize.array
    for (const slot of this.hiPool) {
      if (slot.inst < 0) continue
      const j = slot.inst
      const m = slot.mesh
      m.position.set(p[j * 3], p[j * 3 + 1], p[j * 3 + 2])
      m.scale.set(s[j], s[j], 1)
      const u = m.material.uniforms
      u.uSize.value = s[j]
      u.uAlpha.value = this.a.iAlpha.array[j] * clamp((this.t - slot.t0) / 0.35, 0, 1)
      u.uDim.value = this.a.iDim.array[j]
      u.uHover.value = this.a.iHover.array[j]
    }
  }

  // ---------- picking ----------
  pick() {
    const W = innerWidth, H = innerHeight
    const ndc = new THREE.Vector2((this.pointer.x / W) * 2 - 1, -(this.pointer.y / H) * 2 + 1)
    this.raycaster.setFromCamera(ndc, this.camera)
    const o = this.raycaster.ray.origin, d = this.raycaster.ray.direction
    const p = this.a.iPos.array, s = this.a.iSize.array, al = this.a.iAlpha.array
    const cells = this.data.cells
    let best = -1, bestT = Infinity
    const flying = this.fog >= 0.3
    for (let j = 0; j < this.M; j++) {
      if (al[j] < 0.2) continue
      if (j < this.nCells && flying) {
        const stream = j % STRIDE === 0 && this.dist > cells[j].d
        if (!stream && (cells[j].filler || (Math.abs(p[j * 3]) < 30 && Math.abs(p[j * 3 + 1]) < 22))) continue
      }
      if (j >= this.moteBase) continue
      const tt = (p[j * 3 + 2] - o.z) / d.z
      if (tt <= 0 || tt >= bestT) continue
      const hx = o.x + d.x * tt - p[j * 3], hy = o.y + d.y * tt - p[j * 3 + 1]
      const h = s[j]
      if (Math.abs(hx) > h * 0.6667 || Math.abs(hy) > h * 0.5) continue
      if (tt * Math.hypot(d.x, d.y, d.z) <= 1.7 * h) continue
      best = j
      bestT = tt
    }
    if (best < 0 || this.pxHeight(best) < MIN_CLICK_PX) return this.setHover(null)
    const img = this.a.iTile.array[best]
    const laneK = best >= this.laneBase && best < this.moteBase ? this.laneK[best - this.laneBase] : -1
    this.setHover({ inst: best, img, kind: laneK >= 0 ? 'lane' : 'field', k: laneK })
  }

  setHover(h) {
    const prev = this.hovered
    this.hovered = h
    if ((prev && prev.inst) !== (h && h.inst)) this.canvas.classList.toggle('hot', !!h)
    this.hooks.onHover(h, this.pointer.x, this.pointer.y)
  }

  open(h) {
    this.focus = { inst: h.inst, t0: this.t, e: 0, closing: false }
    this.hooks.onOpen(h.img, h)
  }

  trackSeen() {
    const p = this.a.iPos.array, al = this.a.iAlpha.array
    const before = this.seen.size
    const v = new THREE.Vector3()
    const test = (j) => {
      if (al[j] < 0.5 || this.pxHeight(j) < 80) return
      v.set(p[j * 3], p[j * 3 + 1], p[j * 3 + 2]).project(this.camera)
      if (Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1) this.seen.add(this.a.iTile.array[j])
    }
    if (this.fog > 0.5) {
      for (let j = this.laneBase; j < this.moteBase; j++) test(j)
      for (let i = 0; i < this.nCells; i += STRIDE) test(i)
    }
    if (this.seen.size !== before) this.hooks.onSeen(this.seen.size)
  }

  report() {
    const k = Math.max(0, Math.ceil((this.dist + 28 - LANE_START) / LANE_STEP))
    // where the head sits on screen (for the signature's mask)
    const v = new THREE.Vector3(0, (0.5 - 0.34) * 100, -D0).project(this.camera)
    const sx = ((v.x + 1) / 2) * innerWidth, sy = ((1 - v.y) / 2) * innerHeight
    const scale = innerHeight / (2 * Math.tan((this.camera.fov * Math.PI) / 360) * D0)
    this.hooks.onFrame({
      dist: this.dist, fog: this.fog, laneK: k, img: this.data.seq[k % this.S], round: Math.floor(k / this.S),
      head: { x: sx, y: sy, rx: 0.24 * 100 * ASPECT * scale, ry: 0.3 * 100 * scale },
    })
  }

  render() {
    const r = this.renderer
    if (this.soft < 0.004) {
      r.setRenderTarget(null)
      r.render(this.scene, this.camera)
      return
    }
    // scene -> half-res A, blur H into B, blur V into A, composite to screen with the dim
    r.setRenderTarget(this.rtA)
    r.clear()
    r.render(this.scene, this.camera)
    const rad = this.soft * this.soft * 3.5
    this.postQuad.material = this.blurMat
    this.blurMat.uniforms.uTex.value = this.rtA.texture
    this.blurMat.uniforms.uDir.value.set(rad / this.rtA.width / 6, 0)
    r.setRenderTarget(this.rtB); r.render(this.postScene, this.postCam)
    this.blurMat.uniforms.uTex.value = this.rtB.texture
    this.blurMat.uniforms.uDir.value.set(0, rad / this.rtA.height / 6)
    r.setRenderTarget(this.rtA); r.render(this.postScene, this.postCam)
    this.postQuad.material = this.compMat
    this.compMat.uniforms.uTex.value = this.rtA.texture
    this.compMat.uniforms.uSoft.value = this.soft
    r.setRenderTarget(null)
    r.clear()
    r.render(this.postScene, this.postCam)
  }

  loop = (now) => {
    this.raf = requestAnimationFrame(this.loop)
    const tn = now / 1000
    const dt = Math.min(0.05, this.last ? tn - this.last : 0.016)
    this.last = tn
    this.t += dt
    this.frame++
    this.update(dt)
    this.render()
    this.adapt(dt)
  }

  adapt(dt) {
    if (!this.running || this.t < this.introEnd) return
    if (!this.ft) this.ft = []
    if (this.ft === 'done') return
    this.ft.push(dt * 1000)
    if (this.ft.length >= 90) {
      const m = [...this.ft].sort((a, b) => a - b)[45]
      if (m > 21 && this.budget > 1.4e6) { this.budget *= 0.7; this.resize(); this.ft = [] }
      else this.ft = 'done'
    }
  }

  run() { this.raf = requestAnimationFrame(this.loop) }

  dispose() {
    cancelAnimationFrame(this.raf)
    removeEventListener('wheel', this.onWheel)
    removeEventListener('keydown', this.onKey)
    removeEventListener('touchstart', this.onTouchStart)
    removeEventListener('touchmove', this.onTouchMove)
    removeEventListener('touchend', this.onTouchEnd)
    removeEventListener('pointermove', this.onPointerMove)
    removeEventListener('resize', this.onResize)
    this.renderer.dispose()
  }
}
