// Text-free geometry capture for the live-vs-clone design-language comparison (see geometry_parity.py).
//
//   PLAYWRIGHT_MODULE=<playwright index.mjs or "playwright"> \
//   SIDE=live|clone  BASE=https://vadimcarazan.com | http://localhost:5783 \
//   OUT=<dump dir>  [SHOTS=<scratch dir for screenshots, never committed>] \
//   node extraction/geometry_capture.mjs
//
// For each viewport (1440x900 desktop, 390x844 touch phone) and each home state (closed, ?open=about,
// ?open=contact, ?open=selected) it loads the page, waits for fonts + images + the intro, then FREEZES:
// transitions/animations off, the consent banner (#vc-consent) hidden identically on both sides (never
// clicked), and writes one text-free dump <vp>-<state>.n: a '## <section>' block per semantic section,
// one row per rendered element:
//     tag.class  x,y,w,h  | style  | L<n>:<line tops>
// (box in CSS px, computed font/colour/spacing style, and for text-bearing elements the number of
// rendered text lines and their top offsets; NO text content is written). Live capture adds ?internal=1
// (tracking off) so the owner's analytics are not touched. With SHOTS set it also writes two screenshots
// per state: with the WebGL canvas and with the canvas hidden (DOM layer only), for the local pixel
// diff. Screenshots are scratch evidence only and are not committed.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SIDE = process.env.SIDE, BASE = process.env.BASE, OUT = process.env.OUT, SHOTS = process.env.SHOTS;
if (!SIDE || !BASE || !OUT) { console.error('SIDE, BASE, OUT required'); process.exit(2); }
const pw = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const chromium = pw.chromium || pw.default.chromium;
mkdirSync(OUT, { recursive: true }); if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const SECTIONS = [
  ['topbar', '.topbar'], ['hero', '.hero'], ['signature', '#sig'], ['canvas', 'canvas#c'], ['flybar', '.flybar'],
  ['social', '.social'], ['box', '#box, aside.box'], ['mnav', '#mnav'], ['loader', '.loader'], ['hud', '.hud'],
];
const VIEWPORTS = [
  { name: '1440', w: 1440, h: 900, mobile: false },
  { name: '390', w: 390, h: 844, mobile: true },
];
const STATES = [['closed', ''], ['about', 'open=about'], ['contact', 'open=contact'], ['selected', 'open=selected']];

const collect = (sections) => {
  const out = {};
  const num = (v) => Math.round(v * 10) / 10;
  const lines = (el) => {
    const r = document.createRange(); const tops = new Set(); let has = false;
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) { has = true; r.selectNodeContents(n); for (const q of r.getClientRects()) if (q.width > 0) tops.add(num(q.top)); }
    return has ? [...tops].sort((a, b) => a - b) : null;
  };
  for (const [name, sel] of sections) {
    const root = document.querySelector(sel);
    if (!root) { out[name] = ['MISSING']; continue; }
    const rows = [];
    const els = [root, ...root.querySelectorAll('*')];
    for (const el of els) {
      const cs = getComputedStyle(el); const b = el.getBoundingClientRect();
      if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE' || b.width <= 0 || b.height <= 0 || cs.display === 'none' || cs.visibility === 'hidden') continue;
      let op = 1; for (let a = el; a && a.nodeType === 1; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
      if (op < 0.02) continue; // faded-out views (the glass box keeps every view mounted and toggles opacity)
      const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).join('.') : '';
      const L = lines(el);
      const style = [cs.fontFamily.split(',')[0].replace(/["']/g, ''), cs.fontSize, cs.fontWeight, cs.lineHeight, cs.letterSpacing, cs.textTransform, cs.color, cs.backgroundColor, cs.borderRadius, cs.opacity].join(' ');
      rows.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}\t${num(b.x)},${num(b.y)},${num(b.width)},${num(b.height)}\t${style}\t${L ? 'L' + L.length + ':' + L.join('/') : '-'}`);
    }
    out[name] = rows;
  }
  return out;
};

const log = {};
const browser = await chromium.launch();
async function captureState(ctx, vp, sname, q) {
    const page = await ctx.newPage();
    const url = BASE + '/?' + [SIDE === 'live' ? 'internal=1' : '', q].filter(Boolean).join('&');
    await page.goto(url, { waitUntil: 'load', timeout: 300000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 60000 }).catch(() => {});
    // loader gone (opacity 0 or removed), then the delayed ?open= view really open (body.boxed), then settle.
    // Conditions, not fixed sleeps: the intro length depends on machine load.
    await page.waitForFunction(() => { const l = document.querySelector('.loader'); return !l || getComputedStyle(l).opacity === '0' || getComputedStyle(l).display === 'none'; }, null, { timeout: 300000 });
    if (q) await page.waitForFunction(() => document.body.classList.contains('boxed'), null, { timeout: 300000 });
    await page.waitForTimeout(24000); // the WebGL intro (tiles flying in) runs ~4.5 s of its own clock; under load that clock lags, so settle long
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}#vc-consent{display:none!important}' });
    await page.waitForTimeout(600);
    const rows = await page.evaluate(collect, SECTIONS);
    const docH = await page.evaluate(() => [document.documentElement.scrollHeight, document.documentElement.scrollWidth, innerWidth, innerHeight]);
    let txt = `# ${SIDE} ${vp.name} ${sname}  doc ${docH.join('x')}\n`;
    for (const [k, v] of Object.entries(rows)) txt += `## ${k}\n${v.join('\n')}\n`;
    writeFileSync(join(OUT, `${vp.name}-${sname}.n`), txt);
    if (SHOTS) {
      await page.screenshot({ path: join(SHOTS, `${vp.name}-${sname}-full.png`) });
      await page.addStyleTag({ content: 'canvas#c{visibility:hidden!important}' });
      await page.waitForTimeout(200);
      await page.screenshot({ path: join(SHOTS, `${vp.name}-${sname}-dom.png`) });
    }
    log[`${vp.name}-${sname}`] = { rowCounts: Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, v.length])), doc: docH };
}


const ONLY = (process.env.VIEWPORTS || '').split(',').filter(Boolean); // e.g. VIEWPORTS=390 to resume a run
for (const vp of VIEWPORTS) {
  if (ONLY.length && !ONLY.includes(vp.name)) continue;
  for (const [sname, q] of STATES) {
    if (process.env.RESUME && existsSync(join(OUT, `${vp.name}-${sname}.n`))) continue;
    for (let attempt = 1; attempt <= 4; attempt++) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 1, isMobile: vp.mobile, hasTouch: vp.mobile, reducedMotion: 'no-preference' });
      try {
        await captureState(ctx, vp, sname, q);
        break;
      } catch (e) {
        console.error(`retry ${vp.name}-${sname} attempt ${attempt}: ${String(e.message).split('\n')[0]}`);
        if (attempt === 4) throw e;
      } finally { await ctx.close().catch(() => {}); }
    }
  }
}
await browser.close();
console.log(JSON.stringify(log));
