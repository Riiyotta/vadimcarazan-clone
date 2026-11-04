import { Rewind } from './Icons.jsx'

const fmt = (n) => n.toLocaleString('en-US')

export default function Flybar({ now, seen, total, onNow, onBack }) {
  return (
    <div className="flybar">
      <button className="now" type="button" aria-live="polite" onClick={onNow}>
        <span className="now-i">{String(now.index).padStart(3, '0')}</span>
        <span className="now-txt">
          <span className="now-t">{now.title}</span>
          <span className="now-s">{now.kind}</span>
        </span>
      </button>
      <div className="flyright">
        <span className="seen">{seen >= total ? `All ${fmt(total)} works seen` : `${fmt(seen)} of ${fmt(total)} works`}</span>
        <button className="back" type="button" onClick={onBack}>
          <Rewind />
          <span className="long">Back to home</span>
          <span className="short">Back</span>
        </button>
      </div>
    </div>
  )
}
