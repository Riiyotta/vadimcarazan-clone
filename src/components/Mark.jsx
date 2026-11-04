// Placeholder logo: two strokes (a diagonal and a sweep), drawn by the loader one after the other.
export const MARK_STROKES = [
  'M150 560 L360 90',
  'M360 90 C 520 70, 650 140, 640 260 C 630 380, 520 420, 440 380',
]

export default function Mark({ className, p1 = 1, p2 = 1 }) {
  return (
    <svg className={className} viewBox="0 0 744 640" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="118" strokeLinecap="butt" strokeLinejoin="round">
        <path d={MARK_STROKES[0]} pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - p1} />
        <path d={MARK_STROKES[1]} pathLength="1" strokeDasharray="1 1" strokeDashoffset={1 - p2} />
      </g>
    </svg>
  )
}
