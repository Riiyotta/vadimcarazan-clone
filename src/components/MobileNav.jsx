import { content } from '../content.js'

export default function MobileNav({ open, clock, onNav }) {
  return (
    <div className={`mnav${open ? ' open' : ''}`} id="mnav">
      <nav className="mnav-links">
        <button type="button" onClick={() => onNav('selected')}>Selected work</button>
        <button type="button" onClick={() => onNav('work')}>Work</button>
        <button type="button" onClick={() => onNav('about')}>About</button>
        <button type="button" onClick={() => onNav('contact')}>Contact</button>
      </nav>
      <p className="mnav-lead">
        {content.lead} <a href={content.studio.url} target="_blank" rel="noopener">{content.studio.name}</a>{content.leadTail}
      </p>
      <div className="mnav-facts">
        <div><span className="k">Currently:</span><span className="v">{content.role}, {content.studio.name}</span></div>
        <div><span className="k">Based in:</span><span className="v">{content.city} (<time className="clock">{clock}</time>)</span></div>
      </div>
    </div>
  )
}
