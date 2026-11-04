// Import real work into the cosmos.
//
//   node scripts/import.mjs [contentDir]        (default: ./content)
//
// Reads  <contentDir>/projects.json and the files it names under <contentDir>/works/ (+ an optional portrait photo)
// Writes public/works/  atlas.webp, atlas-sm.webp, hi/<id>.webp, full/<id>.webp, thumb/<id>.webp (+ copied videos)
//        public/data/works.json  (projects, images, time order, atlas layout, portrait halftone)
// The app loads works.json when it exists and falls back to the generated placeholders when it doesn't.
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'
import { halftone } from './portrait.mjs'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const SRC = path.resolve(process.argv[2] || path.join(ROOT, 'content'))
const OUT = path.join(ROOT, 'public', 'works')
const DATA = path.join(ROOT, 'public', 'data')
const COLS = 110
const ROWS = 157
const TILE = { w: 128, h: 96 }
const ATLAS_COLS = 32 // 4096 px wide
const VIDEO = /\.(mp4|webm|mov)$/i

const manifest = JSON.parse(await fs.readFile(path.join(SRC, 'projects.json'), 'utf8'))
const projectsIn = manifest.projects || []
if (!projectsIn.length) throw new Error('projects.json has no projects')

await fs.rm(OUT, { recursive: true, force: true })
for (const d of ['hi', 'full', 'thumb', 'media']) await fs.mkdir(path.join(OUT, d), { recursive: true })
await fs.mkdir(DATA, { recursive: true })

const slugify = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-')
const work = (rel) => path.join(SRC, 'works', rel)

// ---------- images ----------
// Each still becomes one image entry. Videos are copied as gallery media and use their poster (if given) as the still.
const images = []
const projects = []
const tiles = []
const seen = new Map()

async function addImage(rel, project) {
  if (seen.has(rel)) return seen.get(rel)
  const id = images.length
  const file = work(rel)
  const img = sharp(file, { failOn: 'none' }).rotate()
  const meta = await img.metadata()
  const w = meta.width, h = meta.height
  const base = sharp(file, { failOn: 'none' }).rotate()
  await base.clone().resize(1024, 768, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 82 }).toFile(path.join(OUT, 'hi', `${id}.webp`))
  await base.clone().resize({ width: Math.min(2000, w), withoutEnlargement: true }).webp({ quality: 84 }).toFile(path.join(OUT, 'full', `${id}.webp`))
  await base.clone().resize(168, 126, { fit: 'cover', position: sharp.strategy.attention }).webp({ quality: 80 }).toFile(path.join(OUT, 'thumb', `${id}.webp`))
  const tile = await base.clone().resize(TILE.w, TILE.h, { fit: 'cover', position: sharp.strategy.attention }).removeAlpha().raw().toBuffer()
  let r = 0, g = 0, b = 0
  for (let i = 0; i < tile.length; i += 3) { r += tile[i]; g += tile[i + 1]; b += tile[i + 2] }
  const n = tile.length / 3
  tiles.push(tile)
  images.push({ id, project, w, h, aspect: +(w / h).toFixed(4), mean: [+(r / n / 255).toFixed(3), +(g / n / 255).toFixed(3), +(b / n / 255).toFixed(3)] })
  seen.set(rel, id)
  return id
}

async function copyMedia(rel) {
  const name = `${String(images.length).padStart(4, '0')}-${path.basename(rel)}`
  await fs.copyFile(work(rel), path.join(OUT, 'media', name))
  return `/works/media/${name}`
}

for (const [pi, p] of projectsIn.entries()) {
  const out = {
    t: p.title,
    slug: p.slug || slugify(p.title),
    k: p.kind || '',
    d: p.description || '',
    s: p.source || (p.case ? 'Case study' : ''),
    case: !!p.case,
    url: p.url || '',
    client: p.client || p.title,
    year: p.year || '',
    services: p.services || [],
    media: [],
    videos: {},
    sections: [],
  }
  for (const m of p.images || []) {
    if (VIDEO.test(typeof m === 'string' ? m : m.src)) {
      const v = typeof m === 'string' ? { src: m } : m
      if (!v.poster) { console.warn(`  skip video without poster in the field: ${v.src}`); continue }
      const id = await addImage(v.poster, pi)
      out.videos[id] = await copyMedia(v.src)
      out.media.push(id)
    } else out.media.push(await addImage(m, pi))
  }
  // case-study page sections: image paths become image ids, videos are copied
  for (const s of p.sections || []) {
    const sec = { ...s }
    if (s.type === 'image') sec.id = await addImage(s.src, pi)
    if (s.type === 'pair') { sec.ids = []; for (const x of s.src) sec.ids.push(await addImage(x, pi)) } // sequential: ids come from images.length
    if (s.type === 'video') { sec.src = await copyMedia(s.src); if (s.poster) sec.poster = await addImage(s.poster, pi) }
    out.sections.push(sec)
  }
  if (!out.media.length) { console.warn(`  "${p.title}" has no images, skipped`); continue }
  projects.push(out)
  if (projects.length % 25 === 0) console.log(`  ${projects.length}/${projectsIn.length} projects, ${images.length} images`)
}

// ---------- atlas ----------
const rows = Math.ceil(images.length / ATLAS_COLS)
if (rows * TILE.h > 16384) throw new Error(`too many images for one atlas (${images.length}); max ${ATLAS_COLS * Math.floor(16384 / TILE.h)}`)
const W = ATLAS_COLS * TILE.w, H = rows * TILE.h
const atlas = Buffer.alloc(W * H * 3, 10)
tiles.forEach((t, i) => {
  const x0 = (i % ATLAS_COLS) * TILE.w, y0 = Math.floor(i / ATLAS_COLS) * TILE.h
  for (let y = 0; y < TILE.h; y++) t.copy(atlas, ((y0 + y) * W + x0) * 3, y * TILE.w * 3, (y + 1) * TILE.w * 3)
})
await sharp(atlas, { raw: { width: W, height: H, channels: 3 } }).webp({ quality: 86 }).toFile(path.join(OUT, 'atlas.webp'))
await sharp(atlas, { raw: { width: W, height: H, channels: 3 } }).resize(W / 2, H / 2).webp({ quality: 86 }).toFile(path.join(OUT, 'atlas-sm.webp'))

// ---------- portrait ----------
let portrait = null
if (manifest.portrait) {
  const h = await halftone(path.join(SRC, manifest.portrait), manifest.portraitThreshold ?? 48)
  portrait = { lum: h.lum, soft: h.soft }
}

const json = {
  v: Date.now(),
  atlas: { src: '/works/atlas.webp', sm: '/works/atlas-sm.webp', w: TILE.w, h: TILE.h, cols: ATLAS_COLS, rows },
  projects,
  images,
  // lane order: case studies first, then everything else in the order given
  seq: [...projects.filter((p) => p.case), ...projects.filter((p) => !p.case)].flatMap((p) => p.media),
  portrait,
}
await fs.writeFile(path.join(DATA, 'works.json'), JSON.stringify(json))
console.log(`  wrote public/data/works.json: ${projects.length} projects, ${images.length} images, atlas ${W}x${H}${portrait ? ', portrait' : ''}`)
