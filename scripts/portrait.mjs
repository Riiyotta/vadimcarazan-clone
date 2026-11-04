// Portrait photo -> halftone source for the cosmos (110 x 157 cells).
//
//   node scripts/portrait.mjs [photo] [--threshold 48] [--preview out.png]
//
// Writes public/data/portrait.json ({ lum, soft }, 0-255 per cell). Used by the placeholder build and by
// scripts/import.mjs. The figure is cut out by colour distance from the backdrop (median of the side and top
// borders), so a grey jacket on a warm wall still separates even when their brightness is the same.
import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

export const COLS = 110
export const ROWS = 157

export async function halftone(file, threshold = 48) {
  const { data } = await sharp(file).rotate().removeAlpha()
    .resize(COLS, ROWS, { fit: 'cover', position: 'top' })
    .raw().toBuffer({ resolveWithObject: true })
  const px = (x, y) => (y * COLS + x) * 3

  // backdrop colour: median of the top row and both sides (the bottom is usually the subject)
  const border = []
  for (let x = 0; x < COLS; x++) border.push(px(x, 0))
  for (let y = 0; y < ROWS * 0.6; y++) border.push(px(0, y), px(COLS - 1, y))
  const med = (c) => border.map((i) => data[i + c]).sort((a, b) => a - b)[border.length >> 1]
  const bg = [med(0), med(1), med(2)]

  // raw mask, then close small holes (blur + re-threshold) so hair strands and lapels don't speckle
  const raw = Buffer.alloc(COLS * ROWS)
  for (let i = 0; i < COLS * ROWS; i++) {
    const d = Math.hypot(data[i * 3] - bg[0], data[i * 3 + 1] - bg[1], data[i * 3 + 2] - bg[2])
    raw[i] = d > threshold ? 255 : 0
  }
  const closed = await sharp(raw, { raw: { width: COLS, height: ROWS, channels: 1 } }).blur(1.2).extractChannel(0).raw().toBuffer()
  const mask = new Uint8Array(COLS * ROWS)
  for (let i = 0; i < mask.length; i++) mask[i] = closed[i] > 110 ? 255 : 0
  // fill holes: backdrop is only what floods in from the top and sides; skin that happens to match the wall
  // (lips, shadowed cheeks) is enclosed by the figure and stays foreground
  const reach = new Uint8Array(COLS * ROWS)
  const stack = []
  const seed = (x, y) => { const i = y * COLS + x; if (!mask[i] && !reach[i]) { reach[i] = 1; stack.push(i) } }
  for (let x = 0; x < COLS; x++) seed(x, 0)
  for (let y = 0; y < ROWS; y++) { seed(0, y); seed(COLS - 1, y) }
  while (stack.length) {
    const i = stack.pop(), x = i % COLS, y = (i / COLS) | 0
    if (x > 0) seed(x - 1, y)
    if (x < COLS - 1) seed(x + 1, y)
    if (y > 0) seed(x, y - 1)
    if (y < ROWS - 1) seed(x, y + 1)
  }
  for (let i = 0; i < mask.length; i++) mask[i] = reach[i] ? 0 : 255

  // luminance of the figure, stretched to its own 3rd..98th percentile so the face uses the full range
  const Y = new Float32Array(COLS * ROWS)
  for (let i = 0; i < Y.length; i++) Y[i] = 0.2126 * data[i * 3] + 0.7152 * data[i * 3 + 1] + 0.0722 * data[i * 3 + 2]
  const fg = [...Y].filter((_, i) => mask[i]).sort((a, b) => a - b)
  const lo = fg[Math.floor(fg.length * 0.03)] ?? 0
  const hi = fg[Math.floor(fg.length * 0.98)] ?? 255
  // a gamma above 1 keeps skin at full tile size and pushes hair and clothing down, so the face carries the image
  const gamma = 1.7
  const lum = [...Y].map((v, i) => (mask[i] ? Math.round(Math.max(0.08, Math.pow(Math.min(1, Math.max(0, (v - lo) / Math.max(1, hi - lo))), gamma)) * 255) : 0))
  const soft = await sharp(Buffer.from(mask), { raw: { width: COLS, height: ROWS, channels: 1 } }).blur(1.6).extractChannel(0).raw().toBuffer()
  return { lum, soft: [...soft], bg, coverage: fg.length / (COLS * ROWS) }
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
  const args = process.argv.slice(2)
  const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args.splice(i, 2)[1] : d }
  const threshold = +opt('--threshold', 48)
  const preview = opt('--preview', null)
  const file = path.resolve(args[0] || path.join(ROOT, 'content', 'portrait.png'))
  const p = await halftone(file, threshold)
  await fs.mkdir(path.join(ROOT, 'public', 'data'), { recursive: true })
  await fs.writeFile(path.join(ROOT, 'public', 'data', 'portrait.json'), JSON.stringify({ lum: p.lum, soft: p.soft }))
  console.log(`  portrait: backdrop rgb(${p.bg.join(',')}), figure covers ${(p.coverage * 100).toFixed(0)}% of the grid -> public/data/portrait.json`)
  if (preview) {
    // halftone preview: each cell a dot sized by luminance, like the field at the start camera
    const S = 6
    const dots = p.lum.map((l, i) => {
      if (!l) return ''
      const x = (i % COLS) * S, y = Math.floor(i / COLS) * S, r = (S / 2) * Math.sqrt(l / 255)
      return `<rect x="${x + S / 2 - r}" y="${y + S / 2 - r}" width="${2 * r}" height="${2 * r}" fill="#ddd"/>`
    }).join('')
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${COLS * S}" height="${ROWS * S}"><rect width="100%" height="100%" fill="#0a0a0b"/>${dots}</svg>`
    await sharp(Buffer.from(svg)).png().toFile(preview)
    console.log(`  preview: ${preview}`)
  }
}
