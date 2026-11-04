# Local rebuild of https://vadimcarazan.com (React + Vite + three.js, placeholder content), served by `npm run dev`

Source: Local rebuild of https://vadimcarazan.com (React + Vite + three.js, placeholder content), served by `npm run dev`
Status: **measured-from-codebase** · production approved: **false**
16 routes · 2 templates · 25 unique sections

> Generated from `ia.json` by `build.mjs`. Edit the JSON, not this file.

## Shape of the site

The largest 2 templates (Case-study page (scrolling), Cosmos home (fixed layers, no native scroll)) account for 16 of 16 routes (100%). The remaining 0 routes span 0 templates.

| template | routes | share |
|---|---:|---:|
| Case-study page (scrolling) | 15 | 94% |
| Cosmos home (fixed layers, no native scroll) | 1 | 6% |

## Page chrome

**1 routes carry chrome = `fixed-layers`** — Cosmos home (fixed layers, no native scroll).

**15 routes carry chrome = `topbar-and-footer`** — Case-study page (scrolling).

## Sections by reuse

How widely a section is shared determines whether it belongs in a shared
component library or stays local to its page.

| section | category | templates | routes | implementation | scope |
|---|---|---:|---:|---|---|
| `shell.topbar` | SHELL | 2 | 16 | `src/components/Topbar.jsx` | Every route: the cosmos home and all case-study pages. |
| `conversion.cta-card` | CONVERSION | 2 | 16 | `src/components/Box.jsx > Cta; duplicated inline in src/pages/CaseStudy.jsx` | The cosmos home route (inside the project and about views) and every case-study page (after the body). |
| `shell.page-top-fade` | SHELL | 1 | 15 | `src/case.css > html.page body::before` | Every case-study page. |
| `hero.case-header` | HERO | 1 | 15 | `src/pages/CaseStudy.jsx > .cs-head` | Every case-study page. |
| `content.case-cover` | CONTENT | 1 | 15 | `src/pages/CaseStudy.jsx > .cs-cover` | Every case-study page. |
| `content.case-text` | CONTENT | 1 | 15 | `src/pages/CaseStudy.jsx > .cs-text` | Every case-study page, repeated per text section in the project's sections list. |
| `content.case-image` | CONTENT | 1 | 15 | `src/pages/CaseStudy.jsx > .cs-full` | Every case-study page, repeated per image section. |
| `content.case-pair` | CONTENT | 1 | 15 | `src/pages/CaseStudy.jsx > .cs-pair` | Case-study pages whose project has at least four pieces (all placeholder case studies do). |
| `content.case-video` | CONTENT | 1 | 15 | `src/pages/CaseStudy.jsx > .cs-full video` | Case-study pages whose imported project declares a video section; none of the placeholder case studies do. |
| `nav.next-case` | NAV | 1 | 15 | `src/pages/CaseStudy.jsx > .cs-next` | Every case-study page (the last wraps to the first). |
| `footer.case-footer` | FOOTER | 1 | 15 | `src/pages/CaseStudy.jsx > .cs-foot` | Every case-study page. |
| `stage.signature` | STAGE | 1 | 1 | `src/components/Signature.jsx` | Only the cosmos home route. |
| `stage.cosmos` | STAGE | 1 | 1 | `src/engine/cosmos.js (+ shaders.js, data.js, art.js)` | Only the cosmos home route. |
| `shell.fly-fades` | SHELL | 1 | 1 | `src/index.css > body::before / body::after` | Only the cosmos home route, and only in the flying state. |
| `shell.mobile-menu` | SHELL | 1 | 1 | `src/components/MobileNav.jsx` | Only the cosmos home route, at 860 px and below. |
| `hero.cosmos-intro` | HERO | 1 | 1 | `src/components/Hero.jsx` | Only the cosmos home route. |
| `shell.social` | SHELL | 1 | 1 | `src/components/Social.jsx` | Only the cosmos home route, desktop only. |
| `nav.flybar` | NAV | 1 | 1 | `src/components/Flybar.jsx` | Only the cosmos home route, in the flying state. |
| `panel.project` | PANEL | 1 | 1 | `src/components/Box.jsx > ProjectView` | Only the cosmos home route, when a work is opened (click, fly bar, or ?work=). |
| `panel.selected` | PANEL | 1 | 1 | `src/components/Box.jsx > SelectedView` | Only the cosmos home route (nav 'Selected' or ?open=selected). |
| `panel.about` | PANEL | 1 | 1 | `src/components/Box.jsx > AboutView` | Only the cosmos home route (nav 'About', fact columns, or ?open=about). |
| `conversion.contact-brief` | CONVERSION | 1 | 1 | `src/components/Box.jsx > ContactView` | Only the cosmos home route (nav 'Contact', any 'Start a project', or ?open=contact). |
| `shell.hover-hud` | SHELL | 1 | 1 | `src/App.jsx > .hud (positioned by the engine's hover hook)` | Only the cosmos home route. |
| `shell.loader` | SHELL | 1 | 1 | `src/components/Loader.jsx` | Only the cosmos home route, on first load. |
| `shell.copy-toast` | SHELL | 1 | 1 | `src/App.jsx > .copy-toast` | Only the cosmos home route. |

**2 shared sections** appear in more than one template and belong in a component library.

**23 single-use sections** appear in exactly one template. Building these
as "reusable" components up front would be speculative — keep them page-local
until a second caller actually appears.

## Templates

### Cosmos home (fixed layers, no native scroll) — `template.cosmos`

1 route · `/` · chrome: **fixed-layers**

| # | category | section | |
|---:|---|---|---|
| 1 | STAGE | `stage.signature` | page-local |
| 2 | STAGE | `stage.cosmos` | page-local |
| 3 | SHELL | `shell.fly-fades` | page-local |
| 4 | SHELL | `shell.topbar` | shared ×2 |
| 5 | SHELL | `shell.mobile-menu` | page-local |
| 6 | HERO | `hero.cosmos-intro` | page-local |
| 7 | SHELL | `shell.social` | page-local |
| 8 | NAV | `nav.flybar` | page-local |
| 9 | PANEL | `panel.project` | page-local |
| 10 | PANEL | `panel.selected` | page-local |
| 11 | PANEL | `panel.about` | page-local |
| 12 | CONVERSION | `conversion.contact-brief` | page-local |
| 13 | CONVERSION | `conversion.cta-card` | shared ×2 |
| 14 | SHELL | `shell.hover-hud` | page-local |
| 15 | SHELL | `shell.loader` | page-local |
| 16 | SHELL | `shell.copy-toast` | page-local |

### Case-study page (scrolling) — `template.case-study`

15 routes · `/work/{slug}` · chrome: **topbar-and-footer**

| # | category | section | |
|---:|---|---|---|
| 1 | SHELL | `shell.page-top-fade` | page-local |
| 2 | SHELL | `shell.topbar` | shared ×2 |
| 3 | HERO | `hero.case-header` | page-local |
| 4 | CONTENT | `content.case-cover` | page-local |
| 5 | CONTENT | `content.case-text` | page-local |
| 6 | CONTENT | `content.case-image` | page-local |
| 7 | CONTENT | `content.case-pair` | page-local |
| 8 | CONTENT | `content.case-video` | page-local |
| 9 | CONVERSION | `conversion.cta-card` | shared ×2 |
| 10 | NAV | `nav.next-case` | page-local |
| 11 | FOOTER | `footer.case-footer` | page-local |

## Section reference

### SHELL

_Fixed chrome and runtime utility layers: top bar, loader, menus, hover label, toast, fades._

**`shell.fly-fades`** — Top and bottom dark gradient bands over the stage that fade in once the camera is flying, so the top bar and fly bar stay legible.

· Only the cosmos home route, and only in the flying state. · appears on 1 routes · implemented by `src/index.css > body::before / body::after`

**`shell.topbar`** — Fixed top row: logo mark (home), 'Currently' and 'Based in' fact columns with a live clock, and the Selected / Work / About / Contact navigation; collapses to a 'Menu' word at 860 px and below.

· Every route: the cosmos home and all case-study pages. · appears on 16 routes · implemented by `src/components/Topbar.jsx`

**`shell.mobile-menu`** — Phone-only glass panel opened by the 'Menu' word: four large serif links, the intro lead and the two fact columns.

· Only the cosmos home route, at 860 px and below. · appears on 1 routes · implemented by `src/components/MobileNav.jsx`

**`shell.social`** — Bottom-right 'Elsewhere' link list, visible only while the About or Contact view is open; lifts above the fly bar when flying.

· Only the cosmos home route, desktop only. · appears on 1 routes · implemented by `src/components/Social.jsx`

**`shell.hover-hud`** — Small dark pill with the hovered work's title, following the pointer 14 px above it; desktop pointer only.

· Only the cosmos home route. · appears on 1 routes · implemented by `src/App.jsx > .hud (positioned by the engine's hover hook)`

**`shell.loader`** — Full-screen loader whose two-stroke mark draws itself with real load progress, then fades out to start the intro.

· Only the cosmos home route, on first load. · appears on 1 routes · implemented by `src/components/Loader.jsx`

**`shell.copy-toast`** — White 'Link copied' pill that rises at the bottom centre for 1.8 s after Copy link.

· Only the cosmos home route. · appears on 1 routes · implemented by `src/App.jsx > .copy-toast`

**`shell.page-top-fade`** — Permanent dark gradient under the fixed top bar so scrolling content passes beneath it legibly (the same pseudo-element as the fly fade, but always on and top only).

· Every case-study page. · appears on 15 routes · implemented by `src/case.css > html.page body::before`

### STAGE

_The full-viewport visual stage behind the UI: the WebGL portrait cosmos and the signature drawn behind it._

**`stage.signature`** — Hand-drawn pen line behind the canvas, drawn in 2.9 s after the intro with a nib glow, masked with an elliptical hole around the portrait's head; hidden while flying or while the glass box is open.

· Only the cosmos home route. · appears on 1 routes · implemented by `src/components/Signature.jsx`

**`stage.cosmos`** — Full-viewport WebGL field of work tiles: forms the halftone portrait at rest, flies the camera forward on scroll/keys/touch through an endless stream with a central lane of works, hover-picks and click-opens a work, blurs and reframes beside the glass box.

· Only the cosmos home route. · appears on 1 routes · implemented by `src/engine/cosmos.js (+ shaders.js, data.js, art.js)`

### HERO

_The page-opening composition._

**`hero.cosmos-intro`** — Bottom-anchored intro over the portrait: a three-line lead, the 'Explore the work' pill with a bobbing arrow, and the full-bleed serif name; slides away once you fly in or a box opens.

· Only the cosmos home route. · appears on 1 routes · implemented by `src/components/Hero.jsx`

**`hero.case-header`** — Case-study opening: 'Work / Case study · kind' crumb, very large serif title, intro paragraph with an optional live-site pill, and a four-column facts row (client, year, services, scope).

· Every case-study page. · appears on 15 routes · implemented by `src/pages/CaseStudy.jsx > .cs-head`

### NAV

_In-page wayfinding that moves you through the work: the fly-through caption bar, the next-case link._

**`nav.flybar`** — Bottom bar while flying: the zero-padded number, title and kind of the next lane piece (click opens it), an 'N of M works' seen counter, and the 'Back to home' pill that rewinds to the portrait.

· Only the cosmos home route, in the flying state. · appears on 1 routes · implemented by `src/components/Flybar.jsx`

**`nav.next-case`** — Large serif link to the next case study in order, with its kind and a 4:3 thumbnail that scales on hover.

· Every case-study page (the last wraps to the first). · appears on 15 routes · implemented by `src/pages/CaseStudy.jsx > .cs-next`

### PANEL

_Views inside the glass box that opens over the cosmos (project, selected work, about)._

**`panel.project`** — Glass-box view for one work: Close / Copy link / 'Read the case study' header, kind line, serif title, description, the piece and the rest of its set in a vertical gallery, then the CTA card.

· Only the cosmos home route, when a work is opened (click, fly bar, or ?work=). · appears on 1 routes · implemented by `src/components/Box.jsx > ProjectView`

**`panel.selected`** — Glass-box view listing the first eight case studies as numbered rows with a thumbnail; a row flies the camera to that work and opens it.

· Only the cosmos home route (nav 'Selected' or ?open=selected). · appears on 1 routes · implemented by `src/components/Box.jsx > SelectedView`

**`panel.about`** — Glass-box about view: serif statement, two body paragraphs, a two-column facts grid (selected clients as fly-to buttons, counts, elsewhere, contact) and the CTA card pinned to the bottom.

· Only the cosmos home route (nav 'About', fact columns, or ?open=about). · appears on 1 routes · implemented by `src/components/Box.jsx > AboutView`

### CONTENT

_Body blocks of a case-study page: cover, prose, images, pairs, video._

**`content.case-cover`** — Full-width cover image (or video) of the project's first piece at its own aspect, 22 px radius.

· Every case-study page. · appears on 15 routes · implemented by `src/pages/CaseStudy.jsx > .cs-cover`

**`content.case-text`** — Two-column prose block: serif heading on the left, one paragraph on the right (brief, idea, outcome).

· Every case-study page, repeated per text section in the project's sections list. · appears on 15 routes · implemented by `src/pages/CaseStudy.jsx > .cs-text`

**`content.case-image`** — One full-width image at its own aspect.

· Every case-study page, repeated per image section. · appears on 15 routes · implemented by `src/pages/CaseStudy.jsx > .cs-full`

**`content.case-pair`** — Two images side by side, cropped to 4:3, stacking on phones.

· Case-study pages whose project has at least four pieces (all placeholder case studies do). · appears on 15 routes · implemented by `src/pages/CaseStudy.jsx > .cs-pair`

**`content.case-video`** — Full-width muted looping video.

· Case-study pages whose imported project declares a video section; none of the placeholder case studies do. · appears on 15 routes · implemented by `src/pages/CaseStudy.jsx > .cs-full video`

### CONVERSION

_Blocks whose job is to start a project: the CTA card and the contact brief._

**`conversion.contact-brief`** — Glass-box project brief form: name, email, company, 'What do you need?' checkbox chips, budget radio chips, message, submit pill and a mailto note; swaps to a thank-you block on send.

· Only the cosmos home route (nav 'Contact', any 'Start a project', or ?open=contact). · appears on 1 routes · implemented by `src/components/Box.jsx > ContactView`

**`conversion.cta-card`** — Gradient-lit card: 'Have something in mind?' kicker, serif line, a white 'Start a project' pill and one underlined secondary link.

· The cosmos home route (inside the project and about views) and every case-study page (after the body). · appears on 16 routes · implemented by `src/components/Box.jsx > Cta; duplicated inline in src/pages/CaseStudy.jsx`

### FOOTER

_Closing page furniture._

**`footer.case-footer`** — Thin rule with copyright, social links and the email address.

· Every case-study page. · appears on 15 routes · implemented by `src/pages/CaseStudy.jsx > .cs-foot`
