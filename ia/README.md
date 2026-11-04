# Information architecture

**Edit `ia.json` only.** `IA.md` and `matrix.csv` are generated from it and will be overwritten.

```bash
cd ia
node validate.mjs   # hard invariants (route/template totals, every section defined once and used)
node build.mjs      # regenerates IA.md and matrix.csv
```

Routes come from `src/main.jsx` (two route shapes) and the 15 case-study projects in `src/engine/data.js`, slugged with the app's own `slugify`. Every section names the file that renders it (`implementedBy`).

## What the data shows

- **16 routes, 2 templates.** 15 of the 16 routes (94%) are case-study pages from one scrolling template (11 sections). The build effort is in the other route: the cosmos home carries 16 of the 25 sections plus the WebGL engine, and its states are query parameters on `/`, not separate routes.
- **Only 2 sections are shared across templates:** `shell.topbar` and `conversion.cta-card`. The other 23 are single-template and should stay page-local. The CTA card is the one real refactor candidate: it is implemented twice, as `Cta` in `src/components/Box.jsx` and as an inline copy in `src/pages/CaseStudy.jsx`. The two can drift.
- **`content.case-video` is conditional.** The validator counts it on 15 routes because it belongs to the case-study template, but none of the placeholder case studies render it. It only appears for imported projects that declare a video section. Don't "correct" its scope to 15.
- **The validator's one note is a false positive.** The "860" in `shell.mobile-menu`'s scope is the phone breakpoint in px, not a route count.

Not modelled as routes:
- **States on `/`:** `?work=`, `?open=about|contact|selected` and `?fly=1` select states on the same route.
- **Unknown slugs:** `/work/<unknown-slug>` renders a not-found state inside the case-study page component.
