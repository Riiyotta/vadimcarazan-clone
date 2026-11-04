# Sensitivity and licensing

## What the source is

The reference build (the clone next to this folder) reconstructs **https://vadimcarazan.com**, the real,
live personal portfolio of the designer Vadim Carazan. The clone deliberately ships placeholder content:

| Part | Original | Clone (reference build) |
|---|---|---|
| Work images (1,067 from 730 projects) | the owner's client work | procedural art drawn from seeds (`src/engine/art.js`), 200 images / 100 projects |
| Portrait | the owner's photo baked into `data/cosmos.json` | a user-supplied photo (`content/portrait.png` -> `public/data/portrait.json`) |
| Name lettering, signature, logo mark | the owner's lettering, handwriting and logo | the clone's own serif setting, generated pen line and two-stroke mark |
| Display face | PP Editorial Old Italic (commercial) | Instrument Serif Italic (OFL), sized x1.12 |
| Copy | the owner's | placeholder name "Morgan Ellsworth", studio "Fernway", `hello@example.com`, and **much UI copy verbatim from the original** |

## Rules

1. **Never reproduce the original's work images, portrait, signature, lettering, logo or copy**, in any
   mode. The reference build already avoids the files; reference mode may cite them only as evidence.
2. **Generated pages contain nothing that identifies the source or the reference build.** The registry of
   protected terms is `schema/protected-content.json` (`sourceBrand.patterns`), grepped from the saved
   snapshot of the original, `CLONE_SPEC.md` and the clone's own content. It covers both identities:
   Vadim Carazan / vadimcarazan.com / WeGrow / NineDays / BRRRANDING / hi@vadimcarazan.com / Cluj-Napoca /
   the original's clients, **and** Morgan Ellsworth / Fernway / hello@example.com / Leiria-Fátima / the
   clone's 15 case names.
3. **Copy**: the clone's placeholder copy reuses many of the original's sentences ("Let's make the next one
   yours.", "Tell me what you're building.", "A few to start with.", the needs and budget chips ...), so it is
   treated as source copy. Generated mode rejects any listed phrase and any 6-word window shared with the
   source corpus (hashes only; the text is not stored).
4. **People**: no real person's name or likeness. The portrait slot takes `user.portrait-photo` (supplied by
   the page owner, of themselves, with consent) or `generated.portrait-silhouette`.
5. **URLs**: generated pages use reserved domains only (`.example`, `.invalid`, `example.com/.org/.net`),
   relative paths, query strings or anchors.
6. **Fonts**: generated pages use Instrument Serif / Inter Tight (OFL). PP Editorial Old Italic is a
   reference-only asset role, never a token.
7. Availability is pinned in code (`PINNED_AVAILABILITY` in `extraction/verify_all.py` and
   `schema/semantic_validate.py`); editing `assets/asset-roles.json` alone cannot loosen it.

## What the source does not have

The snapshot contains no ratings, reviews, testimonials, avatars, store badges or store links (grep). The
`GENERATED_MODE_STORE` and the generic half of `GENERATED_MODE_RATING` are therefore generic guards, labelled
`genericGuards` in `schema/protected-content.json`, not source patterns. The real "metric" claims of the
source ("1,067 works", "730 projects", "fourteen years") are source patterns.

Do not publish this repository.
