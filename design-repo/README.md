# vadimcarazan portrait-cosmos design-repo

This repo is a **design-language reconstruction, not a faithful reference clone**, **approved as such by the repository
owner on 2026-11-06** (`registry.manifest.json -> cloneClassification`: status `approved`, `approvedBy` a named human).
It is a machine-validated PageSpec system extracted from the clone next to this folder (a rebuild of
vadimcarazan.com whose work images, portrait, lettering, signature and copy are substituted, and whose 15
`/work/<slug>` case-study routes have no counterpart on the live site). An AI can compose new pages in the same
design language (`mode: "generated"`) without inventing colours, copy or structure, and without reusing anything
that identifies the source. Status: **design-review-pending**, not production-approved. Read
`docs/sensitivity-and-licensing.md` first.

## Layout

| path | what |
|---|---|
| `tokens/00-foundation` | colour, typography, radius, spacing, breakpoint, elevation (shadows, blurs, z-layers), motion + `motion-patterns.json` |
| `tokens/10-semantic`, `themes/dark.json` | surface / text / border roles resolving to foundation tokens (dark only) |
| `tokens/20-component`, `30-layout` | component paddings, box width, case-page grid |
| `tokens/llm` | `token-catalog.json` (derived), `token-policy.json`, `component-allowlist.json` (derived) |
| `primitives/`, `components/` | pills, links, chips, fields, glass panel, CTA card ... |
| `sections/` | one closed contract per semantic section (`source` provenance + `semantic` taxonomy, `retrievalEligible`, content budgets, motion, tokens, responsive, asset roles, measured geometry) |
| `templates/` | `templates.json` (2 families), `routes.json` (16 routes, each once) |
| `compatibility/graph.json` | rhythm / structure rules with severities (same ids as the validator) |
| `schema/` | `pagespec.schema.json` (derived, Draft-07), `section-contract.schema.json` (derived), `semantic_validate.py`, `protected-content.json`, examples, `tests/adversarial_test.py` |
| `assets/asset-roles.json` | three-way availability per role, substitutes, licensing |
| `policy/design-policy.json` | portfolio policy (`portfolio-site-web` 1.0.0), a local extension of the bound common policy |
| `extraction/` | `policy_hash.py`, `measured-values.json`, `measure_sections.mjs`, `geometry_capture.mjs`, `geometry_parity.py`, `pixel_parity.py`, `evidence/parity-2026-11-06/`, `wrapper_gate.py`, `verify_all.py`, `prove_drift.py`, `build_derived.py` |

## Templates and routes

- `cosmos-home` -> `/`. Every layer is `position:fixed` and html/body are `overflow:hidden`: the document
  is exactly one viewport tall with **0 in-flow sections**. States (loader, portrait, flying, box views,
  phone menu) and query params (`?work`, `?open`, `?fly`) are states of this one route, not routes.
- `case-study` -> `/work/<slug>` for the 15 case projects (northwind ... tessera), a normal scrolling page.

## How the wrapper gate treats the fixed-layer page

Section heights were measured at 1440x900 on all 16 routes. On `/` nothing is in flow, so the share rule
(one section > 50% / 60% of the page) is skipped by its own rule (fewer than 3 in-flow sections; fixed
elements take no page height). The HERO height rule is applied to every HERO measurement, fixed or not:
`hero.portrait-intro` is 318.6px. Tallest HERO overall: `hero.case-header` 352px; largest in-flow share
19.4% (`media.case-cover` on `/work/omnifield`).

## Run

```bash
pip install jsonschema                         # the only dependency
python3 extraction/verify_all.py               # everything, exit 1 on any failure
python3 schema/semantic_validate.py --examples
python3 schema/tests/adversarial_test.py
python3 extraction/prove_drift.py
python3 extraction/wrapper_gate.py
python3 extraction/build_derived.py            # after editing a contract / token / role / pattern
```

Re-measure (needs the clone's dev server and a Chromium; nothing machine-specific is stored):

```bash
CHROME_PATH=... PLAYWRIGHT_MODULE=... BASE_URL=http://localhost:5192 MODE=sections node extraction/measure_sections.mjs
```

## Category and design policy

This is a **portfolio** (`category: "portfolio"`). `registry.manifest.json -> designPolicy` binds
the common policy `n0-design-constraints-common` 0.1.0 (Common IR 0.5, `hard-and-soft`, domain `portfolio`).
`policy/design-policy.json` adds the portfolio rules (`portfolio-site-web` 1.0.0).
`designPolicy.contentHash` covers the enforcing files (`tokens/llm/token-policy.json`, `compatibility/graph.json`,
`schema/pagespec.schema.json`, `schema/semantic_validate.py`); after a deliberate edit to one of them run
`python3 extraction/policy_hash.py --write`. `verify_all.py` (check `DESIGN_POLICY`) recomputes it.

**Status: defined, pending architecture review.** No architecture decision is recorded
(`architectureDecisionRecorded: false`). The binding and the policy classification (surfaces, audiences, domain)
are agent-derived from the clone's evidence on the owner's instruction, not human-reviewed.

## Parity (R12)

**Classification: design-language reconstruction** (not a faithful reference clone), approval pending. A
live-vs-clone comparison that does not depend on the substituted pixels is recorded in
`extraction/measured-values.json -> parity` (status `geometry-measured-pixel-not-meaningful`), re-derivable from the
tracked text-free dumps in `extraction/evidence/parity-2026-11-06/` (`run1`, `run2`):

- Captured with `extraction/geometry_capture.mjs` (live and the built clone, 1440x900 and 390x844, four home states,
  consent banner hidden on both sides and never clicked), compared with `extraction/geometry_parity.py`
  (box, typography, colour-token and text-row metrics per semantic section) and `extraction/pixel_parity.py`.
- Row-weighted headline (mean over the four states): at 1440 position 86.5%, typography 89.4%, tokens 94.3%;
  at 390 position 74.9%, typography 81.3%, tokens 88.6%. Two full runs agree on every metric. Cells under 80% are
  listed as exceptions (`status: pending human approval`, `approvedBy: null`) with the measured cause: copy that
  wraps differently, shrink-wrapped text widths, markup differences, and one real divergence (the clone fades its
  signature layer when a glass-box view is open, the live site does not).
- **Pixel parity is not meaningful here and no pixel gate is claimed.** The work imagery, portrait, lettering,
  signature and copy inside the WebGL field are substituted and the tile field is random per load; the pixel
  result is recorded only to show that the frame differs where the substitutions are (hidden-canvas diff: glyphs
  only) and that the WebGL layer is not repeatable.
- Of the 16 routes only `/` exists on the live site (all 15 `/work/<slug>` return HTTP 404 there); they are
  not compared.
- `verify_all.py` (check `PARITY`) pins the result files by sha256, re-derives every recorded number from the dumps
  and checks the classification record. Live screenshots are not committed. Re-capture needs network access to the
  live site and a built clone (`npm ci`, `npx vite build --outDir <dir>`, `npx vite preview --outDir <dir> --port 5783`).

## Counts

<!-- counts:start (written by extraction/verify_all.py --write-counts) -->
| item | count |
|---|---|
| tokens | 163 |
| pageSpecReferenceableTokens | 18 |
| primitives | 11 |
| components | 7 |
| sections | 26 |
| retrievalIneligibleSections | 8 |
| templates | 2 |
| routes | 16 |
| assetRoles | 23 |
| generationSafeAssetRoles | 15 |
| motionPatterns | 27 |
| graphRules | 17 |
| examples | 4 |
| referenceExamples | 2 |
| generatedExamples | 2 |
| adversarialMutations | 122 |
| adversarialControls | 5 |
| driftCases | 67 |
<!-- counts:end -->
