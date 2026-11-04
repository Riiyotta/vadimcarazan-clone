// Everything the cosmos needs, generated once from seeds:
//  - projects: placeholder works (15 case studies first, then single shots, newest to oldest)
//  - images:   one entry per piece; each owns an atlas tile and a mean colour
//  - seq:      the time order the lane plays them in
//  - cells:    the portrait halftone (110 x 157), each cell on a camera ray at its own depth
import { mulberry32, clamp, smoothstep } from './rng.js'

export const COLS = 110
export const ROWS = 157
export const CELL_W = 0.84926
export const CELL_H = 0.63694
export const D0 = 160
export const ASPECT = 0.93418
export const PERIOD = 1384
export const N_IMAGES = 200
export const N_PROJECTS = 100

const SYL = ['nor', 'va', 'ke', 'stra', 'lu', 'men', 'hal', 'cy', 'on', 'mer', 'id', 'ian', 'quar', 'ry', 'fen', 'tal', 'o', 'ra', 'vel', 'ix', 'sol', 'ent', 'ar', 'bo', 'tic', 'nu', 'ma', 'zen', 'pi', 'lot', 'ae', 'ther', 'mo', 'dal', 'kin', 'eth']
const KINDS = ['Logo', 'Logo', 'Branding', 'Branding', 'Stationery', 'Signage', 'Device', 'Website', 'App', 'Poster', 'Type', 'Pattern']
const KIND_LABEL = {
  Stationery: ['Brand identity', 'Stationery', 'Identity system'],
  Signage: ['Poster', 'Campaign', 'Out of home'],
  Device: ['Website', 'Product design', 'Web design'],
  Logo: ['Logo', 'Logo and branding', 'Logo, unused direction', 'Symbol'],
  Branding: ['Brand identity', 'Visual identity', 'Identity system'],
  Website: ['Website', 'Landing page', 'Web design'],
  App: ['Product design', 'App design', 'Mobile app'],
  Poster: ['Poster', 'Campaign', 'Key visual'],
  Type: ['Lettering', 'Type study', 'Wordmark'],
  Pattern: ['Illustration', 'Pattern system', 'Brand graphics'],
}
const DESCS = [
  'A placeholder for a real piece. Swap in your own image, title and a line about the idea behind it.',
  'Placeholder work. One sentence about the brief, one about the idea, and you are done.',
  'A generated stand-in. The mark, the colours and the layout are all drawn from a seed.',
  'Replace this with the story of the work: who it was for and what it had to do.',
  'Placeholder description. Keep it short, the work should do most of the talking.',
]
export const SELECTED = [
  ['Northwind', 'Brand, web and motion'],
  ['Halcyon', 'Visual identity'],
  ['Meridian', 'Brand identity and website'],
  ['Fieldnote', 'Identity and digital'],
  ['Quarry Law', 'Brand identity'],
  ['Lumen Labs', 'Website'],
  ['Parallel', 'Brand and product'],
  ['Atlas.ai', 'Rebrand and website'],
]
const EXTRA_CASES = ['Kestrel', 'Omnifield', 'Brightline', 'Solace', 'Vantage', 'Corvid', 'Tessera']

export const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_.]+/g, '-')

// a case-study page in the shape a real one would take: intro text, cover, pairs, full-bleed boards, outcome
function placeholderSections(p) {
  const m = p.media
  const out = [
    { type: 'text', title: 'The brief', body: 'Placeholder. What the company does, who it is for, and what had to change. Two or three sentences are plenty.' },
    { type: 'image', id: m[1] ?? m[0] },
  ]
  if (m.length > 3) out.push({ type: 'pair', ids: [m[2], m[3]] })
  out.push({ type: 'text', title: 'The idea', body: 'Placeholder. The one thought the identity is built on, and how it shows up in the mark, the type and the colour.' })
  for (let i = 4; i < m.length; i++) out.push({ type: 'image', id: m[i] })
  out.push({ type: 'text', title: 'Outcome', body: 'Placeholder. What launched, what it changed for the client, and a number if you have one.' })
  return out
}

function name(rnd) {
  const n = 2 + Math.floor(rnd() * 2)
  let s = ''
  for (let i = 0; i < n; i++) s += SYL[Math.floor(rnd() * SYL.length)]
  return s[0].toUpperCase() + s.slice(1)
}

// box-view aspect mix of the original (4:3 dominant, then 16:9, a few portrait and wide)
function aspectFor(rnd) {
  const r = rnd() * 1068
  if (r < 711) return 4 / 3
  if (r < 937) return 16 / 9
  if (r < 975) return 1.5
  if (r < 997) return 2
  if (r < 1050) return 0.8
  if (r < 1059) return 1
  return 1.2
}

function buildWorks() {
  const rnd = mulberry32(20261104)
  const projects = []
  const images = []
  const cases = [...SELECTED, ...EXTRA_CASES.map((t) => [t, 'Brand identity and website'])]
  // 15 case studies, 4 to 9 pieces each, 16:9 boards
  cases.forEach(([t, k], ci) => {
    const kind = ci % 3 === 1 ? 'Branding' : 'Website'
    const p = { t, k, d: `${DESCS[ci % DESCS.length]}`, s: 'Case study · Studio', case: true, media: [], slug: slugify(t), client: t, year: String(2025 - (ci % 6)), services: k.split(/,| and /).map((x) => x.trim()).filter(Boolean) }
    const n = ci < 8 ? 6 + (ci % 4) : 4 + (ci % 3)
    for (let i = 0; i < n; i++) {
      const seed = 100000 + ci * 50 + i
      const id = images.length
      images.push({ id, project: projects.length, seed, kind: ['Device', 'Signage', 'Stationery', 'Branding', kind][i % 5], aspect: 16 / 9 })
      p.media.push(id)
    }
    p.sections = placeholderSections(p)
    projects.push(p)
  })
  // single shots and small sets until 730 projects / 1067 images
  let extra = N_IMAGES - images.length - (N_PROJECTS - projects.length)
  while (projects.length < N_PROJECTS) {
    const kind = KINDS[Math.floor(rnd() * KINDS.length)]
    const labels = KIND_LABEL[kind]
    const p = { t: name(rnd), k: labels[Math.floor(rnd() * labels.length)], d: DESCS[Math.floor(rnd() * DESCS.length)], s: 'Shot · Studio', case: false, media: [] }
    const left = N_PROJECTS - projects.length
    let n = 1
    if (extra > 0 && (rnd() < 0.3 || extra >= left)) { n = 1 + Math.min(extra, 1 + Math.floor(rnd() * 2)); extra -= n - 1 }
    for (let i = 0; i < n; i++) {
      const id = images.length
      images.push({ id, project: projects.length, seed: 1 + id * 31, kind, aspect: aspectFor(rnd) })
      p.media.push(id)
    }
    projects.push(p)
  }
  return { projects, images }
}

// ---------- the portrait ----------
// A neutral, generated head-and-shoulders: soft light from the upper left, darker hair cap, eye
// sockets, a nose shadow and a collar. Luminance sets each tile's size; the silhouette's soft edge is the halo.
function drawPortrait(S) {
  const W = COLS * S, H = ROWS * S
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const g = c.getContext('2d')
  g.fillStyle = '#000'; g.fillRect(0, 0, W, H)
  const X = (x) => x * W, Y = (y) => y * H

  // shoulders and chest
  let gr = g.createRadialGradient(X(0.38), Y(0.7), 0, X(0.5), Y(0.85), X(0.62))
  gr.addColorStop(0, '#9a9a9a'); gr.addColorStop(0.55, '#5d5d5d'); gr.addColorStop(1, '#262626')
  g.fillStyle = gr
  g.beginPath()
  g.moveTo(X(-0.05), Y(1.02))
  g.bezierCurveTo(X(-0.02), Y(0.8), X(0.12), Y(0.72), X(0.34), Y(0.68))
  g.lineTo(X(0.66), Y(0.68))
  g.bezierCurveTo(X(0.88), Y(0.72), X(1.02), Y(0.8), X(1.05), Y(1.02))
  g.closePath(); g.fill()
  // collar (open shirt V)
  g.fillStyle = '#1c1c1c'
  g.beginPath(); g.moveTo(X(0.4), Y(0.68)); g.lineTo(X(0.5), Y(0.84)); g.lineTo(X(0.6), Y(0.68)); g.closePath(); g.fill()
  // neck
  gr = g.createLinearGradient(X(0.4), 0, X(0.6), 0)
  gr.addColorStop(0, '#a8a8a8'); gr.addColorStop(1, '#5a5a5a')
  g.fillStyle = gr
  g.beginPath(); g.moveTo(X(0.41), Y(0.56)); g.lineTo(X(0.59), Y(0.56)); g.lineTo(X(0.58), Y(0.7)); g.lineTo(X(0.5), Y(0.8)); g.lineTo(X(0.42), Y(0.7)); g.closePath(); g.fill()
  // chin shadow on neck
  g.fillStyle = 'rgba(0,0,0,.35)'
  g.beginPath(); g.ellipse(X(0.5), Y(0.585), X(0.11), Y(0.03), 0, 0, Math.PI * 2); g.fill()
  // head
  gr = g.createRadialGradient(X(0.42), Y(0.3), X(0.02), X(0.5), Y(0.36), X(0.3))
  gr.addColorStop(0, '#f2f2f2'); gr.addColorStop(0.55, '#c4c4c4'); gr.addColorStop(1, '#5c5c5c')
  g.fillStyle = gr
  g.beginPath(); g.ellipse(X(0.5), Y(0.36), X(0.205), Y(0.235), 0, 0, Math.PI * 2); g.fill()
  // ears
  g.fillStyle = '#7a7a7a'
  g.beginPath(); g.ellipse(X(0.295), Y(0.38), X(0.03), Y(0.05), 0, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.ellipse(X(0.705), Y(0.38), X(0.03), Y(0.05), 0, 0, Math.PI * 2); g.fill()
  // hair cap
  gr = g.createLinearGradient(0, Y(0.1), 0, Y(0.28))
  gr.addColorStop(0, '#3a3a3a'); gr.addColorStop(1, '#1a1a1a')
  g.fillStyle = gr
  g.beginPath()
  g.ellipse(X(0.5), Y(0.27), X(0.225), Y(0.17), 0, Math.PI, Math.PI * 2)
  g.bezierCurveTo(X(0.72), Y(0.3), X(0.66), Y(0.2), X(0.5), Y(0.2))
  g.bezierCurveTo(X(0.36), Y(0.2), X(0.3), Y(0.26), X(0.275), Y(0.32))
  g.closePath(); g.fill()
  // brows, eye sockets, nose shadow, mouth
  g.fillStyle = 'rgba(0,0,0,.55)'
  ;[0.415, 0.585].forEach((x) => { g.beginPath(); g.ellipse(X(x), Y(0.345), X(0.05), Y(0.022), 0, 0, Math.PI * 2); g.fill() })
  g.fillStyle = 'rgba(0,0,0,.7)'
  ;[0.415, 0.585].forEach((x) => { g.beginPath(); g.ellipse(X(x), Y(0.318), X(0.055), Y(0.008), x < 0.5 ? 0.05 : -0.05, 0, Math.PI * 2); g.fill() })
  g.fillStyle = 'rgba(0,0,0,.4)'
  g.beginPath(); g.moveTo(X(0.5), Y(0.36)); g.lineTo(X(0.535), Y(0.445)); g.lineTo(X(0.49), Y(0.45)); g.closePath(); g.fill()
  g.fillStyle = 'rgba(0,0,0,.55)'
  g.beginPath(); g.ellipse(X(0.5), Y(0.505), X(0.06), Y(0.009), 0, 0, Math.PI * 2); g.fill()
  // cheek shadow on the far side
  gr = g.createLinearGradient(X(0.5), 0, X(0.72), 0)
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)')
  g.fillStyle = gr
  g.beginPath(); g.ellipse(X(0.5), Y(0.37), X(0.205), Y(0.235), 0, -Math.PI / 2, Math.PI / 2); g.fill()

  // downsample to one luminance value per cell, plus a blurred silhouette mask for the halo
  const small = document.createElement('canvas')
  small.width = COLS; small.height = ROWS
  const sg = small.getContext('2d', { willReadFrequently: true })
  sg.drawImage(c, 0, 0, COLS, ROWS)
  const lum = sg.getImageData(0, 0, COLS, ROWS).data
  sg.filter = 'blur(3px)'
  sg.fillStyle = '#000'; sg.fillRect(0, 0, COLS, ROWS)
  sg.drawImage(c, 0, 0, COLS, ROWS)
  const soft = sg.getImageData(0, 0, COLS, ROWS).data
  return { lum, soft }
}

function buildCells(images, portrait) {
  const rnd = mulberry32(7832)
  const { lum, soft, stride } = portrait || { ...drawPortrait(4), stride: 4 }
  const cells = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = (r * COLS + c) * stride
      const l = lum[i] / 255
      const s = soft[i] / 255
      let dim = 1, hs
      if (l > 0.06) hs = clamp(0.056 + Math.pow(l, 1.15) * 0.944, 0.056, 1)
      else if (s > 0.035 && rnd() < 0.55) { hs = 0.06 + s * 0.5; dim = clamp(0.15 + s * 2.2, 0.15, 0.95) }
      else continue
      if (l > 0.06 && l < 0.16 && s < 0.4) dim = clamp(0.4 + l * 3, 0.4, 0.98)
      cells.push({ col: c + (rnd() - 0.5) * 0.1, row: r + (rnd() - 0.5) * 0.1, hs, dim, d: 56 + rnd() * 1384, filler: true, img: 0, lum: l })
    }
  // 1,067 cells carry a work each (bright, full-dim ones); the rest are portrait-only fillers
  const order = cells.map((_, i) => i).filter((i) => cells[i].dim === 1).map((i) => [i, rnd()]).sort((a, b) => a[1] - b[1]).map(([i]) => i)
  for (let k = 0; k < images.length && k < order.length; k++) {
    const cell = cells[order[k]]
    cell.filler = false
    cell.img = images[k].id
  }
  for (const cell of cells) if (cell.filler) cell.img = Math.floor(rnd() * images.length)
  return cells
}

let cached = null
export function buildData(portrait = null) {
  if (cached) return cached
  const { projects, images } = buildWorks()
  const seq = images.map((im) => im.id) // case studies first, then shots in made order (newest first)
  const cells = buildCells(images, portrait)
  cached = { projects, images, seq, cells, real: false }
  return cached
}

// works.json from scripts/import.mjs: real images, an atlas and (optionally) a photo portrait
function fromImport(j, photo) {
  const images = j.images.map((im) => ({
    ...im,
    real: true,
    hi: `/works/hi/${im.id}.webp`,
    full: `/works/full/${im.id}.webp`,
    thumb: `/works/thumb/${im.id}.webp`,
  }))
  const projects = j.projects.map((p) => ({ ...p, slug: p.slug || slugify(p.t) }))
  const portrait = j.portrait ? { lum: j.portrait.lum, soft: j.portrait.soft, stride: 1 } : photo
  return { projects, images, seq: j.seq, cells: buildCells(images, portrait), atlas: j.atlas, real: true }
}

const getJSON = async (url) => {
  try {
    const r = await fetch(url, { cache: 'no-cache' })
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) return await r.json()
  } catch {}
  return null
}

// imported works (scripts/import.mjs) and/or a portrait photo (scripts/portrait.mjs); placeholders otherwise
export async function loadData() {
  if (cached) return cached
  const [works, p] = await Promise.all([getJSON('/data/works.json'), getJSON('/data/portrait.json')])
  const photo = p ? { lum: p.lum, soft: p.soft, stride: 1 } : null
  if (works) return (cached = fromImport(works, photo))
  return buildData(photo)
}

// image sources for the DOM (box gallery, selected list, case pages); placeholders are drawn on demand
export function imageSrc(data, id, size) {
  const im = data.images[id]
  if (im.real) return size === 'thumb' ? im.thumb : im.full
  return null
}

export function kindOfImage(im) {
  return im.kind === 'Pattern' ? 'Pattern' : im.kind
}

export { smoothstep }
