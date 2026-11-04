import Mark from './Mark.jsx'
import { content } from '../content.js'

export default function Topbar({ clock, onHome, onNav, menuOpen, onMenu }) {
  const NAV = [['selected', 'Selected'], ['work', 'Work'], ['about', 'About'], ['contact', 'Contact']]
  return (
    <header className="topbar">
      <a className="mark" href="#" aria-label={`${content.name}, home`} onClick={(e) => { e.preventDefault(); onHome() }}>
        <Mark className="logo" />
      </a>
      <div className="col col-go" title="About" onClick={(e) => e.target.tagName !== 'A' && onNav('about')}>
        <span className="k">Currently:</span>
        <span className="v">{content.role}, <a href={content.studio.url} target="_blank" rel="noopener">{content.studio.name}</a></span>
      </div>
      <div className="col col-place col-go" title="About" onClick={() => onNav('about')}>
        <span className="k">Based in:</span>
        <span className="v">{content.city} (<time className="clock">{clock}</time>)</span>
      </div>
      <div className="col col-nav">
        <span className="k">Navigation:</span>
        <span className="v">
          {NAV.map(([id, label], i) => (
            <span key={id}>
              <button type="button" className="uline" onClick={() => onNav(id)}>{label}</button>
              {i < NAV.length - 1 ? ', ' : ''}
            </span>
          ))}
        </span>
      </div>
      <button type="button" className="menu-btn uline" aria-expanded={menuOpen} aria-controls="mnav" onClick={onMenu}>
        <span>{menuOpen ? 'Close' : 'Menu'}</span>
      </button>
    </header>
  )
}
