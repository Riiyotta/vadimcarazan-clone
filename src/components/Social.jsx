import { content } from '../content.js'

export default function Social() {
  return (
    <div className="social">
      <span className="k">Elsewhere:</span>
      <span className="v">
        {content.social.map((s, i) => (
          <span key={s.label}>
            <a className="uline" href={s.url} target="_blank" rel="noopener">{s.label}</a>
            {i < content.social.length - 1 ? ', ' : ''}
          </span>
        ))}
      </span>
    </div>
  )
}
