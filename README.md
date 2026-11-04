# vadimcarazan.com: experience rebuild

A rebuild of the portrait-cosmos experience at https://vadimcarazan.com. It reproduces the same layout, type scale, camera behaviour and motion, measured from the live site (see `CLONE_SPEC.md`). All the content is placeholder.

```bash
npm install
npm run dev      # http://localhost:5192
npm run build    # static site in dist/
```

## What is original vs placeholder

| Part | In this build |
|---|---|
| Engine (three.js r169) | Our own code, `src/engine/cosmos.js`, written against the measured numbers. The original `app.js` is not reused. |
| Work images (200 across 100 projects) | Drawn procedurally from seeds in `src/engine/art.js`: logos, identity boards, framed posters on lit walls, device and stationery mockups, type, patterns, all with a photographic finish. Replace with your own via `npm run import`. |
| Portrait | `content/portrait.png` halftoned by `npm run portrait` into `public/data/portrait.json`. Without that file a generated silhouette is used. |
| Name lettering, logo mark, signature | Our own placeholders: an Instrument Serif setting, a two-stroke mark and a generated pen line. |
| Copy | `src/content.js`. Same structure and length as the original, placeholder text. |
| Fonts | Inter Tight (same as the original). Instrument Serif Italic stands in for the commercial PP Editorial Old Italic and is sized 1.12x to match its cap height. |

## Case-study pages

Each case study (`case: true`) gets a page at `/work/<slug>`, opened from **Read the case study** in the box. The page has a title, intro, facts row, cover, then text, image, pair and video sections, a CTA and a next-case link. See `content/projects.example.json` for the section format.

## Using your own work

- **Copy:** edit `src/content.js`.
- **Images:** follow `content/README.md`, then run `npm run import`.
- **Portrait:** put a head-and-shoulders photo on a plain backdrop at `content/portrait.png`, then run `npm run portrait`.

## Behaviour (from the spec)

- **Travel:** wheel ×0.55, arrow keys ±160, PageDown/PageUp ±600, touch ×1.6 with fling. The ease has a 250 ms time constant and the flight never ends.
- **Field:** loops every 1,384 units. The lane releases one piece every 55 units.
- **Opening a work:** clicking a work at least 34 px tall opens it in the glass box. The background gets a WebGL blur and the portrait reframes beside the box.
- **URL params:** `?work=<id>`, `?open=about|contact|selected`, `?fly=1`.
- **Keys:** Home returns to the portrait; Escape closes.
- **Phones:** the menu panel, a stacked name and the bottom-sheet box, at 860 px and below.
