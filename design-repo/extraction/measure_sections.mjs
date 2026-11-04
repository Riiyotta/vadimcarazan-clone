// Re-measure semantic section geometry of the running clone.
//
//   CHROME_PATH=<path to a Chromium / Chrome binary> \
//   PLAYWRIGHT_MODULE=<path to playwright(-core)'s index.mjs, or "playwright" if resolvable> \
//   BASE_URL=http://localhost:5192 \
//   VIEWPORT=1440x900 \
//   MODE=sections            # sections | states | styles
//   node extraction/measure_sections.mjs > out.json
//
// No absolute path is stored in this repo: the browser binary and the playwright module both come
// from environment variables. Routes come from templates/routes.json.
//
// MODE=sections  every route: each semantic section's rect, whether it is in normal flow (an element
//                or ancestor with position fixed/sticky, or display:none, takes no page height), and the
//                document height. On "/" every layer is position:fixed and html/body are overflow:hidden,
//                so the page has 0 in-flow sections; that is recorded, not hidden.
// MODE=states    "/" only: the glass box and its four views opened through the real query params
//                (?open=about|contact|selected), the fly state (?fly=1),
//                and the project view opened from the flybar caption.
// MODE=styles    computed-style samples for the token ledger, on "/" (box views opened) and one case page.
//
// Case-study blocks use a reveal (.rv: translateY(30px) until intersecting); the script neutralises the
// transform before measuring so tops are layout positions, not mid-animation positions.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = process.env.BASE_URL || 'http://localhost:5192';
const [VW, VH] = (process.env.VIEWPORT || '1440x900').split('x').map(Number);
const MODE = process.env.MODE || 'sections';
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = pw.chromium || pw.default.chromium;
const routes = JSON.parse(readFileSync(join(ROOT, 'templates/routes.json'), 'utf8')).routes;

// DOM selector -> semantic section id (the same selectors the contracts cite in source.needle).
const HOME_LIST = [
  ['.loader', 'shell.loader'],
  ['.topbar', 'chrome.topbar'],
  ['#mnav', 'shell.phone-menu'],
  ['.hero', 'hero.portrait-intro'],
  ['#sig', 'media.signature'],
  ['canvas#c', 'showcase.work-cosmos'],
  ['.flybar', 'utility.flybar'],
  ['.social', 'chrome.social'],
  ['#box', 'overlay.glass-box'],
  ['.v-project', 'detail.project-view'],
  ['.v-selected', 'index.selected-list'],
  ['.v-about', 'about.studio-bio'],
  ['.v-contact', 'conversion.brief-form'],
  ['.hud', 'utility.hover-hud'],
  ['.copy-toast', 'utility.copy-toast'],
];
const CASE_LIST = [
  ['.topbar', 'chrome.topbar'],
  ['.cs-head', 'hero.case-header'],
  ['.cs-cover', 'media.case-cover'],
  ['.cs-text', 'editorial.case-text'],
  ['figure.cs-full:not(:has(> video:not([poster])))', 'media.case-image'],
  ['figure.cs-full:has(> video:not([poster]))', 'media.case-video'],
  ['.cs-pair', 'gallery.case-pair'],
  ['.cs-cta', 'cta.start-project'],
  ['.cs-next', 'index.next-case'],
  ['.cs-foot', 'chrome.case-footer'],
];

const HOME = { list: HOME_LIST, fadeIds: { '::before': 'utility.fly-fades', '::after': 'utility.fly-fades' } };
const CASE = { list: CASE_LIST, fadeIds: { '::before': 'utility.page-top-fade', '::after': 'utility.page-top-fade' } };

const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

async function open(path) {
  await page.goto(BASE + path, { waitUntil: 'load' });
  if (path.startsWith('/work/')) await page.waitForSelector('.cs-foot, .cs-missing', { timeout: 20000 });
  else await page.waitForSelector('.loader.done', { timeout: 30000 });
  await page.addStyleTag({ content: '.rv{transform:none!important;transition:none!important;opacity:1!important}' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(800);
}

async function measure(map) {
  return page.evaluate((map) => {
    const pos = (el) => { for (let n = el; n && n !== document.documentElement; n = n.parentElement) { const p = getComputedStyle(n).position; if (p === 'fixed' || p === 'sticky') return p; } return 'static'; };
    const hits = [];
    for (const [sel, id] of map.list) {
      for (const el of document.querySelectorAll(sel)) {
        const b = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        const position = pos(el);
        const hidden = cs.display === 'none';
        hits.push({ id, sel, top: Math.round((b.top + scrollY) * 10) / 10, left: Math.round(b.left * 10) / 10, w: Math.round(b.width * 10) / 10, h: Math.round(b.height * 10) / 10,
          position, inFlow: !hidden && position === 'static', ...(hidden ? { hidden: true } : {}), ...(cs.visibility === 'hidden' ? { visibility: 'hidden' } : {}), ...(cs.opacity !== '1' ? { opacity: +cs.opacity } : {}) });
      }
    }
    // the fade layers are body pseudo-elements (fixed): measured through computed style
    for (const [pseudo, id] of [['::before', 'fade'], ['::after', 'fade']]) {
      const cs = getComputedStyle(document.body, pseudo);
      if (cs.content === 'none' || cs.display === 'none') continue;
      hits.push({ id: map.fadeIds[pseudo], sel: 'body' + pseudo, top: cs.top === 'auto' ? Math.round((innerHeight - parseFloat(cs.height)) * 10) / 10 : parseFloat(cs.top), left: 0, w: innerWidth,
        h: Math.round(parseFloat(cs.height) * 10) / 10, position: cs.position, inFlow: false, pseudo, opacity: +cs.opacity });
    }
    const de = document.documentElement;
    return { pageHeight: de.scrollHeight, viewportHeight: innerHeight, docOverflowY: getComputedStyle(de).overflowY, hits };
  }, map);
}

const out = { viewport: `${VW}x${VH}`, baseUrl: BASE, measuredAt: new Date().toISOString(), mode: MODE };

if (MODE === 'sections') {
  out.routes = {};
  for (const r of routes) {
    await open(r.path);
    const res = await measure(r.template === 'cosmos-home' ? HOME : CASE);
    const sections = res.hits.sort((a, b) => a.top - b.top || a.left - b.left).map(({ sel, ...s }) => s);
    out.routes[r.path] = { template: r.template, pageHeight: res.pageHeight, docOverflowY: res.docOverflowY, inFlowSections: sections.filter((s) => s.inFlow).length, sections };
    process.stderr.write(`${r.path} page ${res.pageHeight} sections ${sections.length} inFlow ${out.routes[r.path].inFlowSections}\n`);
  }
} else if (MODE === 'states') {
  out.states = {};
  const STATES = [['default', '/', 0], ['fly', '/?fly=1', 2500], ['about', '/?open=about', 3200], ['contact', '/?open=contact', 3200], ['selected', '/?open=selected', 3200], ['project', '/?fly=1', 2500, '.now']];
  // project: opened by clicking the flybar caption (onNow). The ?work=<id> deep link is not used because the
  // clone strips the param on mount before it is read (see extraction/measured-values.json -> findings).
  for (const [name, path, wait, click] of STATES) {
    await open(path);
    await page.waitForTimeout(wait);
    if (click) { await page.click(click); await page.waitForTimeout(1500); }
    out.states[name] = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 10) / 10); };
      const on = document.querySelector('#box .view.on');
      return { bodyClass: document.body.className, boxView: document.querySelector('#box')?.dataset.view, box: r('#box'), activeView: on ? on.className : null,
        activeScrollHeight: on ? Math.round(on.querySelector('.p-scroll')?.scrollHeight || 0) : null, hero: r('.hero'), flybar: r('.flybar'), topbar: r('.topbar'), social: r('.social'), mnav: r('#mnav'), url: location.search };
    });
    process.stderr.write(`${name} ${JSON.stringify(out.states[name].box)}\n`);
  }
} else if (MODE === 'styles') {
  const PROPS = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'color', 'backgroundColor', 'borderRadius', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'backdropFilter', 'boxShadow'];
  const grab = (sels) => page.evaluate(([sels, PROPS]) => Object.fromEntries(sels.map((s) => { const e = document.querySelector(s); if (!e) return [s, null]; const cs = getComputedStyle(e); const b = e.getBoundingClientRect(); return [s, { ...Object.fromEntries(PROPS.map((p) => [p, cs[p]])), rect: [b.left, b.top, b.width, b.height].map((v) => Math.round(v * 10) / 10) }]; })), [sels, PROPS]);
  out.samples = {};
  await open('/');
  out.samples['/'] = await grab(['html', '.topbar', '.col-go .k', '.logo', '.lead', '.start', '.start i', '.bigname svg.wide', '.flybar', '.now-i', '.now-t', '.back', '.hud']);
  await open('/?open=about'); await page.waitForTimeout(3200);
  out.samples['/?open=about'] = await grab(['#box', '.v-about h2', '.v-about .body', '.facts .label', '.p-cta', '.p-cta-t', '.p-cta-btn', '.back-link', '.social']);
  await open('/?open=contact'); await page.waitForTimeout(3200);
  out.samples['/?open=contact'] = await grab(['.v-contact h2', '.c-sub', '.field input', '.chip span', '.c-send', '.c-note']);
  const first = routes.find((r) => r.template === 'case-study');
  await open(first.path);
  out.samples[first.path] = await grab(['.cs', '.cs-kicker', '.cs-title', '.cs-intro', '.cs-facts dt', '.cs-facts dd', '.cs-cover .cs-img', '.cs-text h2', '.cs-text p', '.cs-pair', '.cs-next-t', '.cs-foot']);
}

await browser.close();
console.log(JSON.stringify(out, null, 1));
