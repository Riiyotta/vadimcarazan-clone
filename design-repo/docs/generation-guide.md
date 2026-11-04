# Generation guide

How to compose a new page from this design-repo (mode `generated`).

## 1. Pick a template family

| template | routePattern | shape |
|---|---|---|
| `cosmos-home` | `^/$` | one fixed-layer page, **no native scroll**: loader -> portrait (hero, signature) -> flying (flybar, fades) -> glass box with one of four views. Nodes are in reading order; z-order is in each contract's `layer`. |
| `case-study` | `^/work/[a-z0-9-]+$` | a normal scrolling page: top bar, page fade, header, cover, a body slot of text / image / pair / video blocks, CTA card, next case, footer. |

The node sequence must follow `templates/templates.json` exactly (required nodes, the `case-body` slot with
1-40 blocks). `semantic_validate.py` cross-references the declared template against its real node list.

## 2. Fill each node from its section contract

`sections/<id>.json -> content` lists every field, its kind and its `maxWords` budget. Media fields take a
`{assetRole, ref, alt}` object; in generated mode the role must be in the field's `generatedAssetRoles`
and the ref must start with `generated://`, `placeholder://` or `user://`.

Runtime/utility layers (`retrievalEligible: false`: loader, phone menu, fades, flybar, glass box, hover
label, toast, page fade) still appear as nodes because the page needs them, but they are not retrievable
content; never mark a content section ineligible.

## 3. Tokens

Optional `tokens` per node: `surface`, `text`, `spaceBlock`, `font`, from `tokens/llm/token-catalog.json`
entries with `pageSpecReferenceable: true` and pairs in `tokens/llm/token-policy.json`. The theme is
`dark` only. No raw colours, no raw/clamp spacing, fonts only `font.family.serif` / `font.family.sans`.

## 4. Motion

Each node has `{pattern, reducedMotionFallback}`; the pattern must be in the contract's `motion.allowed`
and the fallback must equal the one recorded in `tokens/00-foundation/motion-patterns.json`.

## 5. Validate

```bash
python3 schema/semantic_validate.py my-page.json
```

Use `schema/examples/generated.cosmos-home.json` and `schema/examples/generated.case-study.json`
(fictional studio "Lattice Room", owner "Wren Halloway", `latticeroom.example`) as starting points.
