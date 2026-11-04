# vadimcarazan portrait-cosmos design-repo

A machine-validated PageSpec system extracted from the clone next to this folder (a rebuild of
vadimcarazan.com with placeholder content). An AI can compose new pages in the same design language
(`mode: "generated"`) without inventing colours, copy or structure, and without reusing anything that
identifies the source. Status: **design-review-pending**, not production-approved. Read
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
| `extraction/` | `measured-values.json`, `measure_sections.mjs`, `wrapper_gate.py`, `verify_all.py`, `prove_drift.py`, `build_derived.py` |

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

## Parity (R12)

**Not measured.** No live-vs-clone pixel parity harness was run, and no parity percentage is claimed: the
clone deliberately renders different work, portrait, lettering and copy inside a randomly placed WebGL
field, and the case-study pages have no counterpart on the original. The available evidence is an
element-geometry audit (see `extraction/measured-values.json -> cloneVsOriginalElementAudit`).

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
| driftCases | 37 |
<!-- counts:end -->
