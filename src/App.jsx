import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buildData } from './engine/data.js'
import { Cosmos } from './engine/cosmos.js'
import { content } from './content.js'
import Signature from './components/Signature.jsx'
import Loader from './components/Loader.jsx'
import Topbar from './components/Topbar.jsx'
import MobileNav from './components/MobileNav.jsx'
import Hero from './components/Hero.jsx'
import Flybar from './components/Flybar.jsx'
import Social from './components/Social.jsx'
import Box from './components/Box.jsx'

const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: content.timeZone })
const clockNow = () => timeFmt.format(new Date())

// large windows scale the UI with --z (applied as zoom on the main layers)
function setZoom() {
  const z = Math.max(1, Math.min(innerWidth / 1600, innerHeight / 900))
  document.documentElement.style.setProperty('--z', z.toFixed(3))
}

export default function App({ data: preloaded }) {
  const data = useMemo(() => preloaded || buildData(), [preloaded])
  const canvasRef = useRef(null)
  const boxRef = useRef(null)
  const hudRef = useRef(null)
  const engine = useRef(null)
  const viewRef = useRef('closed')

  const [progress, setProgress] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [sigPlay, setSigPlay] = useState(false)
  const wasAway = useRef(false)
  const [away, setAway] = useState(false)
  const [view, setView] = useState('closed')
  const [imageId, setImageId] = useState(null)
  const [round, setRound] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const [clock, setClock] = useState(clockNow)
  const [seen, setSeen] = useState(0)
  const [toast, setToast] = useState(false)
  const [now, setNow] = useState({ index: 1, title: '', kind: '', img: 0 })

  viewRef.current = view

  // ---------- view control ----------
  const openView = useCallback((v) => {
    setMenuOpen(false)
    setView((cur) => (cur === v ? 'closed' : v))
  }, [])
  const close = useCallback(() => setView('closed'), [])

  useEffect(() => {
    const b = document.body
    b.classList.toggle('boxed', view !== 'closed')
    b.classList.toggle('side', view === 'about' || view === 'contact')
    engine.current?.setBoxed(view !== 'closed')
    // only a project being closed clears ?work= (on first render it must survive for the deep link)
    const leavingProject = viewRef.prev === 'project' && view !== 'project'
    viewRef.prev = view
    if (leavingProject) {
      const u = new URL(location.href)
      if (u.searchParams.has('work')) { u.searchParams.delete('work'); history.replaceState(null, '', u) }
      document.title = content.title
    }
  }, [view])

  const openImage = useCallback((img, info) => {
    const im = data.images[img]
    setImageId(img)
    setRound(info && info.kind === 'lane' && info.k >= 0 ? Math.floor(info.k / data.seq.length) : 0)
    setView('project')
    setMenuOpen(false)
    const u = new URL(location.href)
    u.searchParams.set('work', String(img))
    history.replaceState(null, '', u)
    document.title = `${data.projects[im.project].t} · ${content.name}`
  }, [data])

  // ---------- engine ----------
  useEffect(() => {
    setZoom()
    const hud = hudRef.current
    let lastK = -1
    let flags = { away: false, far: false }
    const e = new Cosmos(canvasRef.current, data, {
      getFrame: () => {
        const z = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--z')) || 1
        const pad = Math.min(32, Math.max(16, innerWidth * 0.02))
        const f = { topbarBottom: pad + (innerWidth <= 860 ? 32.7 : 41.3) * z, box: null }
        if (viewRef.current !== 'closed' && boxRef.current) {
          const el = boxRef.current
          f.box = { right: (el.offsetLeft + el.offsetWidth) * z, height: el.offsetHeight * z }
        }
        return f
      },
      onFrame: (s) => {
        const a = s.dist > 8
        const far = s.dist > 60 && !e.rewind
        if (a !== flags.away) { document.body.classList.toggle('away', a); setAway(a); flags.away = a }
        if (far !== flags.far) { document.body.classList.toggle('far', far); flags.far = far }
        if (s.laneK !== lastK) {
          lastK = s.laneK
          const im = data.images[s.img]
          const p = data.projects[im.project]
          setNow({ index: (s.laneK % data.seq.length) + 1, title: p.t, kind: p.k + (s.round > 0 ? ` · Round ${s.round + 1}` : ''), img: s.img, k: s.laneK })
        }
        const sig = document.getElementById('sig')
        if (sig && innerWidth > 860) {
          const r = sig.getBoundingClientRect()
          const m = `radial-gradient(ellipse ${s.head.rx.toFixed(1)}px ${s.head.ry.toFixed(1)}px at ${(s.head.x - r.left).toFixed(1)}px ${(s.head.y - r.top).toFixed(1)}px, transparent 55%, #000 100%)`
          sig.style.webkitMaskImage = m
          sig.style.maskImage = m
        }
      },
      onHover: (h, x, y) => {
        if (!h) { if (!hud.hidden) hud.hidden = true; return }
        const im = data.images[h.img]
        const t = data.projects[im.project].t
        if (hud.textContent !== t) hud.textContent = t
        hud.style.left = x + 'px'
        hud.style.top = y + 'px'
        hud.hidden = false
      },
      onOpen: openImage,
      onSeen: setSeen,
      onScrollClose: () => setView('closed'),
      onEscape: () => { setView('closed'); setMenuOpen(false) },
    })
    engine.current = e
    if (!import.meta.env.PROD) window.__cosmos = e
    e.run()

    // loader: displayed progress chases the real one (rate 7/s) but never faster than a 1.6 s hand pace
    let real = 0.05, shown = 0, t0 = performance.now(), last = t0, raf
    const tick = (tn) => {
      const dt = Math.min(0.05, (tn - last) / 1000)
      last = tn
      shown += (real - shown) * (1 - Math.exp(-7 * dt))
      shown = Math.min(shown, (tn - t0) / 1600)
      if (real >= 1 && shown > 0.995) shown = 1
      setProgress(shown)
      if (shown < 1) raf = requestAnimationFrame(tick)
      else {
        setLoaded(true)
        e.start()
        setTimeout(() => setSigPlay(true), 1000)
        handleParams(e)
      }
    }
    raf = requestAnimationFrame(tick)
    e.buildAtlas((p) => { real = 0.05 + 0.65 * p }).then(() => { real = 0.98; setTimeout(() => { real = 1 }, 120) })

    const onResize = () => setZoom()
    addEventListener('resize', onResize)
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', onResize); e.dispose() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ?work=<id>, ?open=about|contact|selected, ?fly=1
  const handleParams = (e) => {
    const u = new URL(location.href)
    const work = u.searchParams.get('work')
    const open = u.searchParams.get('open')
    const fly = u.searchParams.get('fly')
    if (work != null && data.images[+work]) {
      setTimeout(() => {
        e.flyIn(260)
        setTimeout(() => openImage(+work, null), 1400)
      }, 2600)
    }
    if (open && ['about', 'contact', 'selected'].includes(open)) {
      setTimeout(() => setView(open), 2500)
      u.searchParams.delete('open')
    }
    if (fly) { e.flyIn(460); u.searchParams.delete('fly') }
    history.replaceState(null, '', u)
  }

  // clock every 15 s
  useEffect(() => {
    const id = setInterval(() => setClock(clockNow()), 15000)
    return () => clearInterval(id)
  }, [])

  // the signature redraws 350 ms after returning to the portrait
  useEffect(() => {
    if (!loaded) return
    if (away) { wasAway.current = true; setSigPlay(false) }
    else if (wasAway.current) { const t = setTimeout(() => setSigPlay('again'), 350); return () => clearTimeout(t) }
  }, [away, loaded])

  // ---------- actions ----------
  const onNav = (id) => {
    const e = engine.current
    if (id === 'work') {
      setMenuOpen(false)
      setView('closed')
      if (e && e.dist < 200) e.flyIn(420)
      return
    }
    openView(id)
  }
  const onHome = () => { setView('closed'); setMenuOpen(false); engine.current?.back() }
  const onStart = () => engine.current?.flyIn(420)
  const onWork = (img) => { setView('closed'); engine.current?.goToWork(img) }
  const onAll = () => { setView('closed'); engine.current?.flyIn(420) }
  const onCopy = () => {
    const u = `${location.origin}${location.pathname}?work=${imageId}`
    navigator.clipboard?.writeText(u).catch(() => {})
    setToast(true)
    setTimeout(() => setToast(false), 1800)
  }
  const onNow = () => openImage(now.img, { kind: 'lane', k: now.k })

  return (
    <>
      <Signature play={loaded && sigPlay} away={away} />
      <canvas id="c" ref={canvasRef} aria-hidden="true" />
      <Topbar clock={clock} onHome={onHome} onNav={onNav} menuOpen={menuOpen} onMenu={() => setMenuOpen((m) => !m)} />
      <MobileNav open={menuOpen} clock={clock} onNav={onNav} />
      <Hero onStart={onStart} />
      <Social />
      <Flybar now={now} seen={seen} total={data.seq.length} onNow={onNow} onBack={onHome} />
      <Box view={view} data={data} imageId={imageId} round={round} boxRef={boxRef} onClose={close} onContact={() => openView('contact')} onWork={onWork} onAll={onAll} onCopy={onCopy} />
      <div className="hud" ref={hudRef} hidden />
      <Loader progress={progress} done={loaded} />
      <div className={`copy-toast${toast ? ' on' : ''}`}>Link copied</div>
    </>
  )
}
