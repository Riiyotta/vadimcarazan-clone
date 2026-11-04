import Mark from './Mark.jsx'

const ioc = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const seg = (p, a, b) => ioc(Math.min(1, Math.max(0, (p - a) / (b - a))))

// full-screen loader: the mark draws itself as two strokes (0-0.58, then 0.44-1) while the field is built
export default function Loader({ progress, done }) {
  return (
    <div className={`loader${done ? ' done' : ''}`} aria-label="Loading">
      <Mark className="ld-mark" p1={seg(progress, 0, 0.58)} p2={seg(progress, 0.44, 1)} />
    </div>
  )
}
