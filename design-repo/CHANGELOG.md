# Changelog

## 1.1.0 (2026-11-04) - category and common-policy binding

- `registry.manifest.json`: `category: "portfolio"` and a `designPolicy` block binding
  `n0-design-constraints-common` 0.1.0 (Common IR 0.5, `hard-and-soft`, domain `portfolio`) with
  a `contentHash` over the four enforcing files.
- New `extraction/policy_hash.py` (check / `--write`) and `policy/design-policy.json` (`portfolio-site-web` 1.0.0:
  classification, not-bound reason, generation rules, enforcedBy, approval). Both registered as entry points.
- `verify_all.py`: new `DESIGN_POLICY` check. `prove_drift.py`: 9 new cases (hash drift, tampered hash, category
  changed / removed, binding removed, version drift, policy file missing, overstated approval, hash script
  unregistered). Drift cases 37 -> 46.
- Honest status: the policy is **defined, pending architecture review**; no architecture decision is recorded.
  The binding and classification are agent-derived on the owner's instruction, not human-reviewed.
- No contract, schema, token or example changed; `pageSpecVersion` and `allowlistVersion` stay 1.0.0.

## 1.0.1 (2026-11-04) - clone fix reconciled

- The clone now honours `?work=<id>` deep links: `src/App.jsx` clears the param only when a project view is
  closed. Finding `WORK_PARAM_STRIPPED` in `extraction/measured-values.json` is now `severity: fixed`, with new
  evidence citations.
- The three lines added to `src/App.jsx` moved later lines down by 3. Every `src/App.jsx` citation at or after
  line 59 was updated, and `verify_all.py` re-resolved them against the current file.
- No contract, schema, token or example changed; `pageSpecVersion` and `allowlistVersion` stay 1.0.0.

## 1.0.0 (2026-11-04) - initial build

- Built from scratch against the current clone (after the 2026-11-04 motion fixes in `src/App.jsx` and
  `src/engine/cosmos.js`); every citation is resolved by needle against the current files and re-checked by
  `verify_all.py`.
- 2 template families (`cosmos-home`, `case-study`), 16 routes (each once), 26 section contracts mapped 1:1
  onto `ia/ia.json` (25 ia sections + `overlay.glass-box`, the box container).
- PageSpec `mode: reference | generated` (R1) with generated-mode rules BRAND, PERSON, CLIENT, CONTACT, CTA,
  COPY (phrases + 6-word shingle hashes), URL, STORE, RATING, MEDIA, ASSET (R2) from
  `schema/protected-content.json`.
- Three-way asset availability pinned in code, with substitutes and pinned generation policies (R3).
- Reference + generated example per template family (R4); adversarial suite and `prove_drift.py` (R5).
- Closed section-contract schema with `source` / `semantic` split (R7) and `retrievalEligible` (8 runtime
  layers ineligible, each with a reason) (R8).
- Measured section heights at 1440x900 and 390x844 on every route; wrapper gate (R9).
- `tokens/llm` catalog (derived) + policy (R10).
- Motion contracts use the motion-QA values from the original where they differ from CLONE_SPEC
  (signature start 1.00 s / draw 2.88 s, `?open` 2.5 s, wheel holds the camera with a box open, FOV snap on close).
- Findings recorded (the clone source is read-only here; `?work=<id>` was later fixed in the clone, see 1.0.1): `?work=<id>` deep links were stripped
  before they are read; three motions lack a reduced-motion branch.
- Parity: not measured (stated, no number claimed). No IR generated (R13).
