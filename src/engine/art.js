// Placeholder artwork. Each "work" is drawn procedurally from its seed and kind: logo marks, identity
// boards, website and app mockups, posters, type specimens, patterns. Same seed, same picture, at any size,
// so the atlas tile, the hi-res close-up and the box image all match.
import { mulberry32 } from './rng.js'

const PALETTES = [
  ['#0e0b2a', '#7b5cff', '#e9e6ff'],
  ['#06122b', '#3d7bff', '#dfe8ff'],
  ['#120d1f', '#b18cff', '#f4f0ff'],
  ['#0b0b0f', '#5f5bff', '#ffffff'],
  ['#101418', '#2ee6a6', '#f2f2f2'],
  ['#1a1410', '#e7c27a', '#f5efe6'],
  ['#0f0f10', '#f2efe9', '#e8502e'],
  ['#14213d', '#fca311', '#e5e5e5'],
  ['#101820', '#f2aa4c', '#f7f7f2'],
  ['#1b1b1e', '#c6f432', '#f4f4f4'],
  ['#f4efe6', '#1d1d1f', '#3d5afe'],
  ['#ece8df', '#2b2b2b', '#c8553d'],
  ['#0b132b', '#5bc0be', '#f5f5f5'],
  ['#2d1e2f', '#f7b267', '#f4845f'],
  ['#e9edf2', '#111827', '#6d5dfc'],
  ['#1e3d2f', '#e9f5db', '#f2c14e'],
  ['#fafafa', '#0a0a0a', '#ff4f00'],
  ['#232946', '#eebbc3', '#fffffe'],
  ['#3a0ca3', '#f72585', '#f1f1f1'],
  ['#d8e2dc', '#283618', '#bc6c25'],
  ['#111111', '#8c8c8c', '#eeeeee'],
  ['#ffd23f', '#1a1a1a', '#ee4266'],
  ['#0d1b2a', '#e0e1dd', '#778da9'],
  ['#f6f1e9', '#4f6f52', '#1a4d2e'],
  ['#161616', '#ff5f5f', '#f8f8f8'],
  ['#e4dccf', '#576f72', '#121212'],
]

const GLYPHS = 'ABCDEFGHJKMNOPRSTUVWXYZ'

// lighten (k > 0) or darken (k < 0) a hex colour
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const ch = [n >> 16, (n >> 8) & 255, n & 255].map((c) => Math.round(k > 0 ? c + (255 - c) * k : c * (1 + k)))
  return `rgb(${ch.join(',')})`
}

// photographic finish: a soft key light, a vignette and fine grain, so tiles read as shots, not flat vectors
function finish(ctx, W, H, rnd) {
  const u = Math.min(W, H)
  const lx = W * (0.2 + rnd() * 0.6), ly = H * (0.1 + rnd() * 0.3)
  const key = ctx.createRadialGradient(lx, ly, 0, lx, ly, W * 0.8)
  key.addColorStop(0, 'rgba(255,255,255,0.10)'); key.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = key; ctx.fillRect(0, 0, W, H)
  const vig = ctx.createRadialGradient(W / 2, H / 2, u * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62)
  vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.38)')
  ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H)
  if (W >= 200) {
    const g = ctx.getImageData(0, 0, W, H), d = g.data
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 14; d[i] += n; d[i + 1] += n; d[i + 2] += n }
    ctx.putImageData(g, 0, 0)
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2))
}

function mark(ctx, cx, cy, s, rnd, col) {
  ctx.fillStyle = col
  ctx.strokeStyle = col
  const t = Math.floor(rnd() * 6)
  ctx.lineWidth = s * 0.14
  if (t === 0) {
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath(); ctx.arc(cx + s * 0.18, cy - s * 0.1, s * 0.28, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  } else if (t === 1) {
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.55); ctx.lineTo(cx + s * 0.5, cy + s * 0.4); ctx.lineTo(cx - s * 0.5, cy + s * 0.4); ctx.closePath(); ctx.fill()
  } else if (t === 2) {
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, s * (0.18 + i * 0.16), 0, Math.PI * 2); ctx.lineWidth = s * 0.07; ctx.stroke() }
  } else if (t === 3) {
    roundRect(ctx, cx - s * 0.45, cy - s * 0.45, s * 0.9, s * 0.9, s * 0.22); ctx.fill()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  } else if (t === 4) {
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.42, Math.PI * 0.15, Math.PI * 1.85); ctx.stroke()
    ctx.beginPath(); ctx.arc(cx + s * 0.32, cy, s * 0.1, 0, Math.PI * 2); ctx.fill()
  } else {
    ctx.font = `italic ${s * 1.05}px "Instrument Serif", Georgia, serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(GLYPHS[Math.floor(rnd() * GLYPHS.length)], cx, cy + s * 0.04)
  }
}

function bars(ctx, x, y, w, rows, lh, rnd, col) {
  ctx.fillStyle = col
  for (let i = 0; i < rows; i++) {
    const bw = w * (i === rows - 1 ? 0.35 + rnd() * 0.3 : 0.75 + rnd() * 0.25)
    roundRect(ctx, x, y + i * lh * 1.7, bw, lh, lh / 2); ctx.fill()
  }
}

export function drawArt(ctx, W, H, seed, kind, nested = false) {
  const rnd = mulberry32(seed * 7919 + 13)
  const pal = PALETTES[Math.floor(rnd() * PALETTES.length)]
  const swap = rnd() < 0.35
  const bg = swap ? pal[1] : pal[0]
  const fg = swap ? pal[0] : pal[1]
  const ac = pal[2]
  const u = Math.min(W, H)
  ctx.save()
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  if (kind === 'Logo') {
    mark(ctx, W / 2, H / 2, u * (0.32 + rnd() * 0.12), rnd, rnd() < 0.5 ? fg : ac)
  } else if (kind === 'Branding') {
    // identity board: big mark panel + colour swatches + business card
    ctx.fillStyle = ac; ctx.fillRect(0, 0, W * 0.55, H)
    mark(ctx, W * 0.275, H * 0.5, u * 0.3, rnd, bg)
    ctx.save(); ctx.translate(W * 0.77, H * 0.42); ctx.rotate(-0.12 + rnd() * 0.24)
    ctx.fillStyle = fg; roundRect(ctx, -W * 0.16, -H * 0.12, W * 0.32, H * 0.24, u * 0.02); ctx.fill()
    mark(ctx, -W * 0.09, 0, u * 0.1, rnd, ac); ctx.restore()
    ;[fg, ac, bg].forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(W * (0.62 + i * 0.11), H * 0.76, W * 0.09, H * 0.12) })
  } else if (kind === 'Website') {
    ctx.fillStyle = fg; ctx.globalAlpha = 0.08; ctx.fillRect(0, 0, W, H * 0.09); ctx.globalAlpha = 1
    mark(ctx, W * 0.07, H * 0.045, u * 0.05, rnd, fg)
    bars(ctx, W * 0.62, H * 0.035, W * 0.08, 1, H * 0.018, rnd, fg)
    bars(ctx, W * 0.74, H * 0.035, W * 0.08, 1, H * 0.018, rnd, fg)
    ctx.fillStyle = ac; roundRect(ctx, W * 0.86, H * 0.025, W * 0.1, H * 0.042, H * 0.021); ctx.fill()
    ctx.fillStyle = fg
    ctx.font = `${rnd() < 0.5 ? 'italic ' : ''}${H * 0.12}px "Instrument Serif", Georgia, serif`
    ctx.textBaseline = 'top'
    const words = ['Build', 'Grow', 'Make', 'Shape', 'Move', 'Launch', 'Design']
    ctx.fillText(`${words[Math.floor(rnd() * words.length)]} what`, W * 0.07, H * 0.19)
    ctx.fillText('comes next.', W * 0.07, H * 0.32)
    bars(ctx, W * 0.07, H * 0.5, W * 0.36, 3, H * 0.022, rnd, fg)
    ctx.fillStyle = ac; roundRect(ctx, W * 0.07, H * 0.68, W * 0.16, H * 0.07, H * 0.035); ctx.fill()
    const g = ctx.createLinearGradient(W * 0.5, H * 0.18, W, H)
    g.addColorStop(0, ac); g.addColorStop(1, fg)
    ctx.fillStyle = g; roundRect(ctx, W * 0.52, H * 0.18, W * 0.42, H * 0.6, u * 0.03); ctx.fill()
    mark(ctx, W * 0.73, H * 0.48, u * 0.2, rnd, bg)
  } else if (kind === 'App') {
    const n = 3
    for (let i = 0; i < n; i++) {
      const pw = W * 0.22, ph = H * 0.78, px = W * (0.13 + i * 0.27), py = H * (0.11 + (i === 1 ? -0.04 : 0.04))
      ctx.fillStyle = i === 1 ? ac : fg; roundRect(ctx, px, py, pw, ph, pw * 0.16); ctx.fill()
      ctx.fillStyle = bg; roundRect(ctx, px + pw * 0.08, py + ph * 0.06, pw * 0.84, ph * 0.3, pw * 0.08); ctx.fill()
      bars(ctx, px + pw * 0.08, py + ph * 0.44, pw * 0.8, 4, ph * 0.03, rnd, bg)
    }
  } else if (kind === 'Poster') {
    const g = ctx.createLinearGradient(0, 0, W * rnd(), H)
    g.addColorStop(0, bg); g.addColorStop(1, ac)
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = fg; ctx.globalAlpha = 0.9
    ctx.beginPath(); ctx.arc(W * (0.3 + rnd() * 0.4), H * (0.35 + rnd() * 0.3), u * (0.22 + rnd() * 0.18), 0, Math.PI * 2); ctx.fill()
    ctx.globalAlpha = 1
    bars(ctx, W * 0.06, H * 0.84, W * 0.3, 2, H * 0.025, rnd, fg)
  } else if (kind === 'Type') {
    ctx.fillStyle = fg
    ctx.font = `italic ${H * 0.62}px "Instrument Serif", Georgia, serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('Aa', W * 0.5, H * 0.46)
    ctx.fillStyle = ac
    ctx.font = `${H * 0.05}px "Inter Tight", Arial, sans-serif`
    ctx.fillText('ABCDEFGHIJKLMNOPQRSTUVWXYZ 0123456789', W * 0.5, H * 0.86)
  } else if (kind === 'Signage') {
    // a framed poster on a lit wall (wood or plaster), the kind of in-context shot most identities end on
    const wood = rnd() < 0.5
    const wall = ctx.createLinearGradient(0, 0, W, 0)
    wall.addColorStop(0, wood ? '#5a3a22' : '#cfc7bb'); wall.addColorStop(0.5, wood ? '#8a5c37' : '#e7e1d6'); wall.addColorStop(1, wood ? '#4a2f1c' : '#bfb6a8')
    ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H)
    if (wood) { ctx.globalAlpha = 0.18; ctx.fillStyle = '#000'; for (let x = W * 0.12; x < W; x += W * 0.21) ctx.fillRect(x, 0, Math.max(1, W * 0.003), H); ctx.globalAlpha = 1 }
    const fw = W * 0.3, fh = fw * 1.33, fx = W * (0.35 + rnd() * 0.1), fy = H * 0.12
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = u * 0.06; ctx.shadowOffsetY = u * 0.02
    ctx.fillStyle = '#2a2a2a'; ctx.fillRect(fx - fw * 0.04, fy - fw * 0.04, fw * 1.08, fh + fw * 0.08); ctx.restore()
    ctx.fillStyle = bg; ctx.fillRect(fx, fy, fw, fh)
    ctx.fillStyle = ac; ctx.fillRect(fx, fy, fw, fh * 0.12)
    mark(ctx, fx + fw / 2, fy + fh * 0.45, fw * 0.4, rnd, fg)
    bars(ctx, fx + fw * 0.1, fy + fh * 0.78, fw * 0.6, 2, fh * 0.03, rnd, fg)
    // a passer-by, motion-blurred
    ctx.save(); ctx.filter = `blur(${Math.max(1, u * 0.02)}px)`; ctx.fillStyle = 'rgba(15,12,10,.85)'
    const px = rnd() < 0.5 ? W * 0.12 : W * 0.82
    ctx.beginPath(); ctx.ellipse(px, H * 0.42, W * 0.035, H * 0.07, 0, 0, Math.PI * 2); ctx.fill()
    roundRect(ctx, px - W * 0.07, H * 0.5, W * 0.14, H * 0.55, W * 0.05); ctx.fill(); ctx.restore()
  } else if (kind === 'Device') {
    // a laptop on a soft studio sweep, showing a site
    const sweep = ctx.createRadialGradient(W * 0.5, H * 0.35, 0, W * 0.5, H * 0.5, W * 0.7)
    sweep.addColorStop(0, pal[0] === '#0b0b0f' ? '#26262e' : shade(bg, 0.25)); sweep.addColorStop(1, shade(bg, -0.35))
    ctx.fillStyle = sweep; ctx.fillRect(0, 0, W, H)
    const sw = W * 0.62, sh = sw * 0.62, sx = (W - sw) / 2, sy = H * 0.1
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = u * 0.08; ctx.shadowOffsetY = u * 0.03
    ctx.fillStyle = '#15151a'; roundRect(ctx, sx - sw * 0.02, sy - sw * 0.02, sw * 1.04, sh + sw * 0.04, u * 0.02); ctx.fill(); ctx.restore()
    ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip(); ctx.translate(sx, sy)
    drawArt(ctx, sw, sh, seed + 1, 'Website', true); ctx.restore()
    ctx.fillStyle = '#c9c9cf'; roundRect(ctx, sx - sw * 0.12, sy + sh + sw * 0.02, sw * 1.24, sh * 0.05, sh * 0.025); ctx.fill()
  } else if (kind === 'Stationery') {
    // business cards and a letterhead, top-down with hard light
    ctx.fillStyle = shade(bg, -0.15); ctx.fillRect(0, 0, W, H)
    const items = [[0.3, 0.45, 0.34, 0.46, -0.08, fg], [0.66, 0.4, 0.22, 0.13, 0.12, ac], [0.68, 0.62, 0.22, 0.13, -0.05, bg]]
    for (const [cx, cy, iw, ih, rot, col] of items) {
      ctx.save(); ctx.translate(W * cx, H * cy); ctx.rotate(rot)
      ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = u * 0.04; ctx.shadowOffsetX = u * 0.015; ctx.shadowOffsetY = u * 0.02
      ctx.fillStyle = col; ctx.fillRect(-W * iw / 2, -H * ih / 2, W * iw, H * ih); ctx.shadowColor = 'transparent'
      mark(ctx, -W * iw * 0.28, -H * ih * 0.25, Math.min(W * iw, H * ih) * 0.22, rnd, col === fg ? ac : fg)
      bars(ctx, -W * iw * 0.4, H * ih * 0.1, W * iw * 0.5, 2, H * ih * 0.04, rnd, col === fg ? bg : fg)
      ctx.restore()
    }
  } else {
    // pattern / illustration
    const n = 4 + Math.floor(rnd() * 5)
    const cw = W / n
    for (let i = 0; i < n; i++)
      for (let j = 0; j < Math.ceil(H / cw); j++) {
        ctx.fillStyle = (i + j) % 2 ? fg : ac
        const r = rnd()
        if (r < 0.4) { ctx.beginPath(); ctx.arc(i * cw + cw / 2, j * cw + cw / 2, cw * 0.38, 0, Math.PI * 2); ctx.fill() }
        else if (r < 0.7) { ctx.beginPath(); ctx.arc(i * cw, j * cw, cw, 0, Math.PI / 2); ctx.lineTo(i * cw, j * cw); ctx.fill() }
        else { ctx.fillRect(i * cw + cw * 0.15, j * cw + cw * 0.15, cw * 0.7, cw * 0.7) }
      }
  }
  ctx.restore()
  if (!nested) finish(ctx, W, H, rnd)
}

export function artCanvas(seed, kind, W, H) {
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  drawArt(c.getContext('2d'), W, H, seed, kind)
  return c
}

const urlCache = new Map()
export function artURL(seed, kind, W, H) {
  const key = `${seed}:${kind}:${W}x${H}`
  if (!urlCache.has(key)) urlCache.set(key, artCanvas(seed, kind, W, H).toDataURL('image/webp', 0.9))
  return urlCache.get(key)
}
