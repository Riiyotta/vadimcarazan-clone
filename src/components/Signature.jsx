import { useEffect, useMemo, useRef } from 'react'

// A placeholder signature: one continuous pen line (a tall entry stroke, a run of loops, a long underline
// flourish). Drawn behind the canvas in 2.9 s; the pen is fast on straight runs and slow in the loops.
function buildPath() {
  // Laid out around the figure, not over it: the entry stroke and first loops sit left of the portrait,
  // a single low sweep passes behind the name, and the last loops and the rising tail sit on the right.
  const pts = []
  pts.push([210, 650], [228, 380], [250, 130], [272, 400], [300, 590])
  for (let t = 0.4; t <= Math.PI * 4.3; t += 0.2) {
    const amp = 95 * (0.6 + 0.4 * Math.sin(t * 0.5 + 0.6))
    pts.push([320 + 22 * t - 60 * Math.sin(t), 450 - amp * Math.cos(t) - t * 4])
  }
  pts.push([560, 600], [700, 705], [900, 730], [1100, 700], [1200, 600])
  for (let t = 0.6; t <= Math.PI * 4.1; t += 0.2) {
    const amp = 80 * (0.6 + 0.4 * Math.cos(t * 0.45))
    pts.push([1190 + 20 * t - 55 * Math.sin(t), 470 - amp * Math.cos(t) - t * 9])
  }
  pts.push([1520, 300], [1600, 210], [1670, 110])
  // Catmull-Rom -> cubic beziers
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d
}

const DRAW = 2.9
// smooth, soft-edged ink like a felt pen: a hair of blur instead of the jittery displacement

export default function Signature({ play, away }) {
  const d = useMemo(buildPath, [])
  const ink = useRef(null)
  const tip = useRef(null)
  const nib = useRef(null)
  const timeline = useRef(null)

  // time -> length map: segments cost more time where the line turns
  useEffect(() => {
    const p = ink.current
    const L = p.getTotalLength()
    const n = 500
    const pts = Array.from({ length: n + 1 }, (_, i) => p.getPointAtLength((L * i) / n))
    const cost = [0]
    for (let i = 1; i <= n; i++) {
      const a = pts[Math.max(0, i - 2)], b = pts[i - 1], c = pts[i]
      const a1 = Math.atan2(b.y - a.y, b.x - a.x), a2 = Math.atan2(c.y - b.y, c.x - b.x)
      let turn = Math.abs(a2 - a1)
      if (turn > Math.PI) turn = 2 * Math.PI - turn
      cost.push(cost[i - 1] + 1 + turn * 14)
    }
    timeline.current = { L, n, cost, total: cost[n], pts }
    p.style.strokeDasharray = `${L} ${L}`
    p.style.strokeDashoffset = `${L}`
    tip.current.style.strokeDasharray = `60 ${L}`
    tip.current.style.strokeDashoffset = `60`
  }, [d])

  useEffect(() => {
    const tl = timeline.current
    if (!tl) return
    const p = ink.current
    if (!play || away) {
      if (away) { p.style.strokeDashoffset = `${tl.L}`; tip.current.style.opacity = 0; nib.current.style.opacity = 0 }
      return
    }
    let raf, t0
    const start = setTimeout(() => {
      const step = (now) => {
        if (t0 === undefined) t0 = now
        let u = Math.min(1, (now - t0) / 1000 / DRAW)
        // start from rest (6%) and ease off at the end (8%)
        const a = 0.06, b = 0.08
        const s = u < a ? (u * u) / (2 * a) : u < 1 - b ? a / 2 + (u - a) : 1 - a / 2 - b - ((1 - u) * (1 - u)) / (2 * b) + b / 2
        const target = Math.min(1, s / (1 - a / 2 - b / 2)) * tl.total
        let lo = 0, hi = tl.n
        while (lo < hi) { const m = (lo + hi) >> 1; if (tl.cost[m] < target) lo = m + 1; else hi = m }
        const len = (lo / tl.n) * tl.L
        p.style.strokeDashoffset = `${tl.L - len}`
        tip.current.style.strokeDashoffset = `${60 - len}`
        tip.current.style.opacity = u < 1 ? 0.5 : 0
        const pt = tl.pts[lo]
        nib.current.setAttribute('cx', pt.x)
        nib.current.setAttribute('cy', pt.y)
        nib.current.style.opacity = u < 1 ? 1 : 0
        if (u < 1) raf = requestAnimationFrame(step)
      }
      raf = requestAnimationFrame(step)
    }, 0)
    return () => { clearTimeout(start); cancelAnimationFrame(raf) }
  }, [play, away])

  return (
    <svg className="sig" id="sig" viewBox="0 0 1707.93 752.83" aria-hidden="true">
      <defs>
        <radialGradient id="nibglow">
          <stop offset="0" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id="inkf" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation="0.55" />
        </filter>
      </defs>
      <g transform="rotate(-13 854 376)">
        <path ref={ink} d={d} fill="none" stroke="rgba(242,242,242,0.5)" style={{ strokeWidth: 'var(--sig-w, 2.6px)' }} strokeLinecap="round" strokeLinejoin="round" filter="url(#inkf)" />
        <path ref={tip} d={d} fill="none" stroke="#fff" style={{ strokeWidth: 'var(--sig-w, 2.6px)' }} strokeLinecap="round" opacity="0" />
        <circle ref={nib} r="18" fill="url(#nibglow)" opacity="0" />
      </g>
    </svg>
  )
}
