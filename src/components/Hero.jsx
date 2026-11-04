import { useLayoutEffect, useRef, useState } from 'react'
import { ArrowDown } from './Icons.jsx'
import { content } from '../content.js'

// The name, set full-bleed in the serif. The viewBox is fitted to the real ink once the font has loaded:
// edge to edge across the content width, cap/ascender line at the top, and a fixed box aspect taken from the
// original lettering (so the block keeps the original's height and position). Descenders hang into the pad.
const SIZE = 1000
const STEP = 0.86
function FitText({ lines, className, aspect }) {
  const ref = useRef(null)
  const [vb, setVb] = useState(null)
  useLayoutEffect(() => {
    let alive = true
    const fit = () => {
      const g = ref.current
      if (!alive || !g) return
      const t = g.querySelector('text')
      const cs = getComputedStyle(t)
      const cx = document.createElement('canvas').getContext('2d')
      cx.font = `${cs.fontStyle} ${cs.fontWeight} ${SIZE}px ${cs.fontFamily}`
      if ('letterSpacing' in cx) cx.letterSpacing = `${-0.02 * SIZE}px`
      let left = 0, right = 0, top = 0
      lines.forEach((l, i) => {
        const m = cx.measureText(l)
        left = Math.max(left, m.actualBoundingBoxLeft)
        right = Math.max(right, m.actualBoundingBoxRight)
        if (i === 0) top = m.actualBoundingBoxAscent
      })
      if (!('letterSpacing' in cx)) { const bb = g.getBBox(); if (!bb.width) return; left = -bb.x; right = bb.x + bb.width }
      const w = left + right
      if (w > 0) setVb(`${-left} ${-top} ${w} ${w / aspect}`)
    }
    fit()
    document.fonts?.ready.then(fit)
    return () => { alive = false }
  }, [lines, aspect])
  return (
    <svg className={className} viewBox={vb || `0 -800 ${SIZE * 5} ${(SIZE * 5) / aspect}`} aria-hidden="true">
      <g ref={ref}>
        {lines.map((l, i) => (
          <text key={i} x="0" y={i * SIZE * STEP} fontSize={SIZE} letterSpacing="-0.02em">{l}</text>
        ))}
      </g>
    </svg>
  )
}

const WIDE = [content.name]

export default function Hero({ onStart }) {
  return (
    <section className="hero" id="intro">
      <div className="hero-row">
        <p className="lead">
          {content.lead} <a href={content.studio.url} target="_blank" rel="noopener">{content.studio.name}</a>{content.leadTail}
        </p>
        <button type="button" className="start" onClick={onStart}>
          <span>Explore the work</span>
          <i aria-hidden="true"><ArrowDown /></i>
        </button>
      </div>
      <h1 className="bigname" aria-label={content.name}>
        <FitText className="wide" lines={WIDE} aspect={4609.52 / 633.15} />
        <FitText className="stack" lines={content.nameLines} aspect={2545 / 1288} />
      </h1>
    </section>
  )
}
