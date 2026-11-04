// Analytics for vadimcarazan.com: GA4 (G-WF97ED0R0W) + Microsoft Clarity (ywzmdkawk4), same setup as wegrow.design.
// - Consent Mode v2 defaults are set in <head> (denied in the EEA, UK and Switzerland until the visitor accepts,
//   granted elsewhere). Visitors there get a small banner; Clarity only records after they accept.
// - Internal traffic is not tracked: ?internal=1 (or ?wg_internal=1) once in a browser turns tracking off there,
//   ?internal=0 turns it back on. Preview hosts (*.pages.dev, localhost) are never tracked.
// - window.vcTrack(name, params) sends an event to GA4 and Clarity; app.js calls it for every meaningful action.
(function () {
  "use strict"
  const ls = { get: (k) => { try { return localStorage.getItem(k) } catch { return null } }, set: (k, v) => { try { localStorage.setItem(k, v) } catch {} } }
  const queue = []
  // events are sent when the browser is idle, never inside a click, so taps stay instant
  const idle = window.requestIdleCallback ? (f) => requestIdleCallback(f, { timeout: 1500 }) : (f) => setTimeout(f, 0)
  function track(name, params) { if (window.__VC_NOTRACK) return; const p = params; idle(() => send(name, p)) }
  function send(name, params) {
    if (window.__VC_NOTRACK) return
    const p = Object.assign({ page_path: location.pathname }, params || {})
    // "source" is a reserved name in GA4 (it rewrites the session's traffic source, which split sessions into "field", "nav", "intro"); send it as cta_section
    if ("source" in p) { p.cta_section = p.source; delete p.source }
    try { window.gtag && window.gtag("event", name, p) } catch {}
    try { if (typeof window.clarity === "function") { window.clarity("event", name); if (p.project) window.clarity("set", "last_project", String(p.project)) } else queue.push(name) } catch {}
  }
  window.vcTrack = track

  // ---------- links anywhere on the page ----------
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("a[href]")
    if (!a) return
    const href = a.getAttribute("href") || ""
    const where = a.closest(".box") ? (a.closest(".v-about") ? "about" : a.closest(".v-contact") ? "contact" : "project") : a.closest(".mnav") ? "menu" : a.closest(".topbar") ? "top" : a.closest(".hero") ? "intro" : "page"
    if (a.hasAttribute("data-contact")) return   // counted as contact_open by app.js
    if (href.startsWith("mailto:")) return track("email_click", { cta_section: where })
    if (a.id === "p-link") return track("case_study_click", { cta_section: where, link_url: a.href, project: (document.getElementById("p-title") || {}).textContent || "" })
    if (/^https?:/.test(href) && a.host !== location.host) {
      const host = a.hostname.replace(/^www\./, "")
      return track(/dribbble|behance|linkedin|instagram|x\.com|twitter/.test(host) ? "social_click" : "outbound_click", { cta_section: where, link_domain: host, link_url: a.href })
    }
  }, true)

  // ---------- engagement ----------
  let active = 0, last = Date.now()
  const marks = [30, 90, 180]
  setInterval(() => {
    const now = Date.now()
    if (document.visibilityState === "visible" && now - last < 1500) active += (now - last) / 1000
    last = now
    while (marks.length && active >= marks[0]) track("engaged_" + marks.shift() + "s")
  }, 1000)

  // ---------- consent banner (EEA / UK / CH only) + Clarity ----------
  const REG = window.__VC_CONSENT_REGIONS || []
  function loadClarity() {
    const id = window.__VC_CLARITY
    if (!id || window.clarity || window.__VC_NOTRACK) return
    ;(function (c, l, a, r, i) { c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) }; const t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i; const y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y) })(window, document, "clarity", "script", id)
    window.clarity("consent")
    while (queue.length) window.clarity("event", queue.shift())
  }
  const G = { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted", analytics_storage: "granted" }
  const Dn = { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied" }
  function grant() { ls.set("vc_consent", "granted"); try { window.gtag && window.gtag("consent", "update", G) } catch {}; loadClarity(); track("consent", { choice: "granted" }) }
  function deny() { ls.set("vc_consent", "denied"); try { window.gtag && window.gtag("consent", "update", Dn) } catch {}; track("consent", { choice: "denied" }) }
  function banner() {
    if (document.getElementById("vc-consent") || window.__VC_NOTRACK) return
    const el = document.createElement("div")
    el.id = "vc-consent"; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Cookie consent")
    el.innerHTML = '<p>I use cookies to see how people move through the site, so I can make it better. No ads, and your data is never sold. <a href="https://www.wegrow.design/privacy-policy" target="_blank" rel="noopener">Privacy policy</a></p><div class="vc-consent-btns"><button type="button" data-c="deny">Decline</button><button type="button" data-c="grant">Accept</button></div>'
    el.addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; b.dataset.c === "grant" ? grant() : deny(); el.classList.add("out"); setTimeout(() => el.remove(), 400) })
    document.body.appendChild(el)
    setTimeout(() => el.classList.add("in"), 30)
  }
  const st = document.createElement("style")
  st.textContent = '#vc-consent{position:fixed;z-index:9000;right:20px;bottom:20px;max-width:360px;padding:16px 16px 14px;border-radius:18px;background:rgba(22,22,24,.72);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);color:#f2f2f2;font:13.5px/1.5 "Inter Tight",Inter,-apple-system,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.45);opacity:0;transform:translateY(14px);transition:opacity .35s ease,transform .45s cubic-bezier(.22,1,.36,1)}#vc-consent.in{opacity:1;transform:none}#vc-consent.out{opacity:0;transform:translateY(14px)}#vc-consent p{margin:0 0 12px;color:rgba(242,242,242,.82)}#vc-consent a{color:#f2f2f2;text-underline-offset:3px}.vc-consent-btns{display:flex;gap:8px;justify-content:flex-end}#vc-consent button{cursor:pointer;border-radius:999px;padding:8px 16px;font:inherit;border:1px solid rgba(255,255,255,.3);background:transparent;color:#f2f2f2}#vc-consent button[data-c=grant]{background:#fff;color:#000;border-color:#fff}@media (max-width:600px){#vc-consent{left:12px;right:12px;bottom:12px;max-width:none}}'
  document.head.appendChild(st)
  if (window.__VC_NOTRACK) return
  const stored = ls.get("vc_consent")
  if (stored === "granted") loadClarity()
  else if (stored !== "denied") {
    const decide = (country) => { if (country && REG.indexOf(country) === -1) loadClarity(); else setTimeout(banner, 4000) }
    let tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "" } catch {}
    fetch("/cdn-cgi/trace", { cache: "no-store" }).then((r) => (r.ok ? r.text() : "")).then((t) => { const m = t.match(/^loc=([A-Z]{2})$/m); decide(m ? m[1] : /^Europe\//.test(tz) ? "" : "US") }).catch(() => decide(/^Europe\//.test(tz) ? "" : "US"))
  }
})()
