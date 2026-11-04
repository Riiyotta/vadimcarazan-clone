const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round' }

export const ArrowDown = () => (
  <svg viewBox="0 0 14 14" {...s}><path d="M7 2v10M3 8l4 4 4-4" /></svg>
)
export const Chevron = () => (
  <svg className="chev" viewBox="0 0 14 14" {...s}><path d="M8.5 3.5 5 7l3.5 3.5" /></svg>
)
export const Cross = () => (
  <svg className="ix" viewBox="0 0 14 14" {...s}><path d="M3.5 3.5l7 7M10.5 3.5l-7 7" /></svg>
)
export const Rewind = () => (
  <svg viewBox="0 0 14 14" {...s}><path d="M2.5 7a4.5 4.5 0 1 0 1.4-3.3" /><path d="M2.6 1.8v2.4h2.4" /></svg>
)
export const LinkIcon = () => (
  <svg viewBox="0 0 14 14" {...s}><path d="M6 8a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.9.9" /><path d="M8 6a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.9-.9" /></svg>
)
