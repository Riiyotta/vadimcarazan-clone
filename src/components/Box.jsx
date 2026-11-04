import { useEffect, useRef, useState } from 'react'
import { Chevron, Cross, LinkIcon } from './Icons.jsx'
import { artURL } from '../engine/art.js'
import { content } from '../content.js'

function Cta({ className = '', onContact }) {
  return (
    <aside className={`p-cta ${className}`} aria-label="Start a project">
      <div className="p-cta-txt">
        <p className="p-cta-k">{content.cta.kicker}</p>
        <h3 className="p-cta-t">{content.cta.title}</h3>
      </div>
      <div className="p-cta-row">
        <a className="p-cta-btn" href="?open=contact" onClick={(e) => { e.preventDefault(); onContact() }}>{content.cta.button}</a>
        <a className="p-cta-alt" href={content.studio.url} target="_blank" rel="noopener">{content.cta.alt}</a>
      </div>
    </aside>
  )
}

function CloseBtn({ onClose, icon }) {
  return (
    <button type="button" className="back-link" aria-label="Close" onClick={onClose}>
      <Chevron />
      {icon && <Cross />}
      <span>Close</span>
    </button>
  )
}

function GalleryImage({ im, first }) {
  const [ld, setLd] = useState(false)
  const W = 1200
  const H = Math.round(W / im.aspect)
  const tall = im.aspect < 1.3
  return (
    <img
      className={`${ld ? 'ld' : ''} ${tall ? 'crop' : ''}`}
      src={im.real ? im.full : artURL(im.seed, im.kind, W, H)}
      alt=""
      decoding="async"
      loading={first ? 'eager' : 'lazy'}
      onLoad={() => setLd(true)}
    />
  )
}

function ProjectView({ data, imageId, round, onClose, onContact, onCopy }) {
  const [copied, setCopied] = useState(false)
  if (imageId == null) return null
  const im = data.images[imageId]
  const p = data.projects[im.project]
  const media = p.media.map((id) => data.images[id])
  const copy = () => {
    onCopy()
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <>
      <div className="v-head">
        <CloseBtn onClose={onClose} icon />
        <div className="v-acts">
          <button type="button" className={`back-link copy-link${copied ? ' copied' : ''}`} aria-label="Copy a link to this work" onClick={copy}>
            <LinkIcon />
            <span>{copied ? 'Link copied' : 'Copy link'}</span>
          </button>
          {p.case && <a className="pill-white" href={`/work/${p.slug}`}>Read the case study</a>}
        </div>
      </div>
      <div className="p-scroll p-fit" key={imageId}>
        <p className="p-kind">
          <span>{p.k}{round > 0 ? ` · Round ${round + 1}` : ''}</span>
          {media.length > 1 && <span className="p-count"> · {media.length} pieces</span>}
        </p>
        <h2 id="p-title">{p.t}</h2>
        <p className="desc">{p.d}</p>
        <div className="stage">
          <div className="gallery">
            {[im, ...media.filter((m) => m.id !== im.id)].map((m, i) =>
              p.videos?.[m.id]
                ? <video key={m.id} className="ld" src={p.videos[m.id]} poster={m.full} autoPlay muted loop playsInline />
                : <GalleryImage key={m.id} im={m} first={i === 0} />,
            )}
          </div>
        </div>
        <Cta onContact={onContact} />
      </div>
    </>
  )
}

function SelectedView({ data, onClose, onWork, onAll }) {
  const cases = data.projects.filter((p) => p.case).slice(0, 8)
  return (
    <>
      <div className="v-head">
        <CloseBtn onClose={onClose} />
        <p className="src">Selected work</p>
      </div>
      <div className="p-scroll">
        <h2>{content.selected.title}</h2>
        <p className="body">{content.selected.body}</p>
        <ol className="sel-list">
          {cases.map((p, i) => {
            const im = data.images[p.media[0]]
            return (
              <li key={p.t}>
                <button type="button" className="sel-item" onClick={() => onWork(p.media[0])}>
                  <img src={im.real ? im.thumb : artURL(im.seed, im.kind, 168, 126)} alt="" loading="lazy" decoding="async" />
                  <span><span className="t">{p.t}</span><span className="k">{p.k}</span></span>
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>
                </button>
              </li>
            )
          })}
        </ol>
        <p className="sel-foot">
          Or <button type="button" className="sel-all" onClick={onAll}>fly through everything</button>, {data.seq.length.toLocaleString('en-US')} works in the order they were made.
        </p>
      </div>
    </>
  )
}

function AboutView({ data, onClose, onWork, onContact }) {
  const byName = (t) => data.projects.find((p) => p.t === t)
  return (
    <>
      <div className="v-head">
        <CloseBtn onClose={onClose} />
        <p className="src">About</p>
      </div>
      <div className="p-scroll">
        <h2 id="about-title">{content.about.title}</h2>
        {content.about.body.map((b, i) => <p className="body" key={i}>{b}</p>)}
        <div className="facts">
          <div>
            <p className="label">Selected clients</p>
            <p>
              {content.about.clients.map((c) => (
                <span key={c}>
                  <button type="button" className="go-work" onClick={() => { const p = byName(c); if (p) onWork(p.media[0]) }}>{c}</button>,{' '}
                </span>
              ))}
              {content.about.clientsTail}
            </p>
          </div>
          <div>
            <p className="label">On this page</p>
            <p>{data.images.length.toLocaleString('en-US')} images from {data.projects.length} projects</p>
          </div>
          <div>
            <p className="label">Elsewhere</p>
            <p>
              {content.social.map((s, i) => (
                <span key={s.label}><a href={s.url} target="_blank" rel="noopener">{s.label}</a>{i < content.social.length - 1 ? ', ' : ''}</span>
              ))}
            </p>
          </div>
          <div>
            <p className="label">Contact</p>
            <p><button type="button" className="go-work" onClick={onContact}>Send me a message</button></p>
          </div>
        </div>
        <Cta className="about-cta" onContact={onContact} />
      </div>
    </>
  )
}

function ContactView({ active, onClose }) {
  const nameRef = useRef(null)
  const [tried, setTried] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(null)
  useEffect(() => {
    if (!active || innerWidth <= 860) return
    const t = setTimeout(() => nameRef.current?.focus({ preventScroll: true }), 450)
    return () => clearTimeout(t)
  }, [active])
  const submit = (e) => {
    e.preventDefault()
    setTried(true)
    const f = e.currentTarget
    if (!f.checkValidity()) { setErr('Please fill in your name, a valid email and a few words about the project.'); return }
    setErr('')
    const fd = new FormData(f)
    // no backend in the replica: hand the brief to the mail client
    const body = [...fd.entries()].map(([k, v]) => `${k}: ${v}`).join('\n')
    window.location.href = `mailto:${content.email}?subject=${encodeURIComponent('New project brief')}&body=${encodeURIComponent(body)}`
    setDone(String(fd.get('name') || '').split(' ')[0])
  }
  return (
    <>
      <div className="v-head">
        <CloseBtn onClose={onClose} />
        <p className="src">Start a project</p>
      </div>
      <div className="p-scroll c-scroll">
        {done == null ? (
          <form className={`cform${tried ? ' tried' : ''}`} noValidate onSubmit={submit}>
            <h2 id="c-title">{content.contact.title}</h2>
            <p className="c-sub">{content.contact.sub}</p>
            <div className="c-row">
              <label className="field"><span>Name</span><input ref={nameRef} name="name" autoComplete="name" required /></label>
              <label className="field"><span>Email</span><input name="email" type="email" autoComplete="email" required /></label>
            </div>
            <label className="field"><span>Company or website</span><input name="company" autoComplete="organization" /></label>
            <fieldset className="field">
              <legend>What do you need?</legend>
              <div className="chips">
                {content.contact.needs.map((n) => <label className="chip" key={n}><input type="checkbox" name="need" value={n} /><span>{n}</span></label>)}
              </div>
            </fieldset>
            <fieldset className="field">
              <legend>Budget</legend>
              <div className="chips">
                {content.contact.budgets.map((n) => <label className="chip" key={n}><input type="radio" name="budget" value={n} /><span>{n}</span></label>)}
              </div>
            </fieldset>
            <label className="field"><span>About the project</span><textarea name="message" rows="3" required placeholder="What the company does, what you need and when." /></label>
            <div className="c-foot">
              <button type="submit" className="p-cta-btn c-send">Send the brief</button>
              <p className="c-note">Or write to <a href={`mailto:${content.email}`}>{content.email}</a></p>
            </div>
            <p className="c-err" role="alert">{err}</p>
          </form>
        ) : (
          <div className="c-done">
            <h2>Thank you{done ? `, ${done}` : ''}.</h2>
            <p className="c-sub">{content.contact.done}</p>
            <button type="button" className="p-cta-alt" onClick={onClose}>Back to the work</button>
          </div>
        )}
      </div>
    </>
  )
}

export default function Box({ view, data, imageId, round, boxRef, onClose, onContact, onWork, onAll, onCopy }) {
  return (
    <aside className={`box${view !== 'closed' ? ' open' : ''}`} id="box" data-view={view} ref={boxRef}>
      <section className={`view v-project${view === 'project' ? ' on' : ''}`} aria-labelledby="p-title">
        <ProjectView data={data} imageId={imageId} round={round} onClose={onClose} onContact={onContact} onCopy={onCopy} />
      </section>
      <section className={`view v-selected${view === 'selected' ? ' on' : ''}`}>
        <SelectedView data={data} onClose={onClose} onWork={onWork} onAll={onAll} />
      </section>
      <section className={`view v-about${view === 'about' ? ' on' : ''}`}>
        <AboutView data={data} onClose={onClose} onWork={onWork} onContact={onContact} />
      </section>
      <section className={`view v-contact${view === 'contact' ? ' on' : ''}`}>
        <ContactView active={view === 'contact'} onClose={onClose} />
      </section>
    </aside>
  )
}
