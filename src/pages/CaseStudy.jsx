import { useEffect, useRef, useState } from 'react'
import Topbar from '../components/Topbar.jsx'
import { artURL } from '../engine/art.js'
import { content } from '../content.js'
import '../case.css'

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: content.timeZone })

// one image of the project: the imported file, or the placeholder drawn at its own aspect
function Pic({ data, id, className = '', eager }) {
  const im = data.images[id]
  const [ld, setLd] = useState(false)
  if (!im) return null
  const src = im.real ? im.full : artURL(im.seed, im.kind, 1600, Math.round(1600 / im.aspect))
  return (
    <img
      className={`cs-img ${ld ? 'ld' : ''} ${className}`}
      src={src}
      alt=""
      decoding="async"
      loading={eager ? 'eager' : 'lazy'}
      style={{ aspectRatio: String(im.aspect) }}
      onLoad={() => setLd(true)}
    />
  )
}

function Media({ data, project, id, eager }) {
  const video = project.videos && project.videos[id]
  if (video) {
    const im = data.images[id]
    return <video className="cs-img ld" src={video} poster={im.real ? im.full : undefined} autoPlay muted loop playsInline style={{ aspectRatio: String(im.aspect) }} />
  }
  return <Pic data={data} id={id} eager={eager} />
}

// fade + rise as each block enters, the same 0.6 s / 0.9 s pair the hero uses
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.rv')
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  })
}

export default function CaseStudy({ data, slug }) {
  const cases = data.projects.filter((p) => p.case)
  const idx = cases.findIndex((p) => p.slug === slug)
  const p = cases[idx]
  const next = cases[(idx + 1) % cases.length]
  const [clock, setClock] = useState(() => timeFmt.format(new Date()))
  const top = useRef(null)

  useEffect(() => {
    document.documentElement.classList.add('page')
    document.title = p ? `${p.t} · ${content.name}` : `Not found · ${content.name}`
    window.scrollTo(0, 0)
    const id = setInterval(() => setClock(timeFmt.format(new Date())), 15000)
    return () => clearInterval(id)
  }, [p])
  useReveal()

  const go = (url) => { window.location.href = url }
  const onNav = (v) => go(v === 'work' ? '/?fly=1' : `/?open=${v}`)

  if (!p) {
    return (
      <>
        <Topbar clock={clock} onHome={() => go('/')} onNav={onNav} menuOpen={false} onMenu={() => go('/')} />
        <main className="cs cs-missing">
          <h1 className="cs-title">Not found.</h1>
          <a className="p-cta-btn" href="/">Back to the work</a>
        </main>
      </>
    )
  }

  const [cover, ...rest] = p.media
  const sections = p.sections && p.sections.length ? p.sections : rest.map((id) => ({ type: 'image', id }))
  const facts = [
    ['Client', p.client || p.t],
    ['Year', p.year],
    ['Services', (p.services || []).join(', ') || p.k],
    ['Scope', `${p.media.length} pieces`],
  ].filter(([, v]) => v)

  return (
    <>
      <Topbar clock={clock} onHome={() => go('/')} onNav={onNav} menuOpen={false} onMenu={() => go('/')} />
      <main className="cs" ref={top}>
        <header className="cs-head">
          <p className="cs-kicker rv">
            <a className="cs-crumb" href={`/?work=${cover}`}>Work</a>
            <span> / Case study · {p.k}</span>
          </p>
          <h1 className="cs-title rv">{p.t}</h1>
          <div className="cs-introrow">
            <p className="cs-intro rv">{p.d}</p>
            {p.url && <a className="pill-white rv" href={p.url} target="_blank" rel="noopener">Visit the live site</a>}
          </div>
          <dl className="cs-facts rv">
            {facts.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </header>

        <figure className="cs-cover rv"><Media data={data} project={p} id={cover} eager /></figure>

        {sections.map((s, i) => {
          if (s.type === 'text')
            return (
              <section className="cs-text rv" key={i}>
                <h2>{s.title}</h2>
                <p>{s.body}</p>
              </section>
            )
          if (s.type === 'pair')
            return (
              <div className="cs-pair" key={i}>
                {s.ids.map((id, j) => <figure className="rv" style={{ transitionDelay: `${j * 80}ms` }} key={id}><Media data={data} project={p} id={id} /></figure>)}
              </div>
            )
          if (s.type === 'video')
            return <figure className="cs-full rv" key={i}><video className="cs-img ld" src={s.src} autoPlay muted loop playsInline /></figure>
          return <figure className="cs-full rv" key={i}><Media data={data} project={p} id={s.id} /></figure>
        })}

        <aside className="p-cta cs-cta rv" aria-label="Start a project">
          <div className="p-cta-txt">
            <p className="p-cta-k">{content.cta.kicker}</p>
            <h3 className="p-cta-t">{content.cta.title}</h3>
          </div>
          <div className="p-cta-row">
            <a className="p-cta-btn" href="/?open=contact">{content.cta.button}</a>
            <a className="p-cta-alt" href={`/?work=${cover}`}>Find it in the flight</a>
          </div>
        </aside>

        {next && next !== p && (
          <a className="cs-next rv" href={`/work/${next.slug}`}>
            <span className="k">Next case study</span>
            <span className="cs-next-row">
              <span className="cs-next-t">{next.t}</span>
              <Pic data={data} id={next.media[0]} className="cs-next-img" />
            </span>
            <span className="cs-next-k">{next.k}</span>
          </a>
        )}

        <footer className="cs-foot">
          <span>© {new Date().getFullYear()} {content.name}</span>
          <span>
            {content.social.map((s, i) => (
              <span key={s.label}><a className="uline" href={s.url} target="_blank" rel="noopener">{s.label}</a>{i < content.social.length - 1 ? ', ' : ''}</span>
            ))}
          </span>
          <a className="uline" href={`mailto:${content.email}`}>{content.email}</a>
        </footer>
      </main>
    </>
  )
}
