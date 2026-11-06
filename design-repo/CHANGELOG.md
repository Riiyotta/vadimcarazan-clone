# Changelog

## 1.1.2 (2026-11-06) - reviewed by the repository owner

This repo is a design-language reconstruction, not a faithful reference clone, approved as such by the repository owner on 2026-11-06 (unchanged). The repository owner has also reviewed the repo on 2026-11-06 and instructed that the pending human-review label be removed.

- `registry.manifest.json`: `status` and `designReviewStatus` are `design-reviewed`, with `designReview { by, date, note }`
  (Riya Ghosh, repository owner, 2026-11-06). `productionApproved` stays false: the repo is not production-approved.
  The design-policy approval block is unchanged (no separate architecture decision has been made).
- The 11 parity exceptions in `extraction/measured-values.json` are now `status: recorded exception` with `reviewedBy` and
  `reviewedOn`; every measured number and cause is unchanged, and the pinned result files and their sha256 are unchanged.
- `verify_all.py` (`PARITY`) enforces the new state: design-reviewed status with a named human reviewer and a date,
  `productionApproved` false, a named human reviewer on every exception. `prove_drift.py`: 10 new drift cases (record missing,
  agent as reviewer, missing date, pending status without a record, status mismatch, production approval claimed, exception
  reviewer missing / agent / reverted to pending, exception cause removed).
- The technical limits stated elsewhere are unchanged (string-based detection, paraphrase, no pixel parity).
- No contract, schema, token or example changed; `pageSpecVersion` and `allowlistVersion` stay 1.0.0. No IR touched.

## 1.1.1 (2026-11-06) - design-language reconstruction classification and measured parity

This repo is a design-language reconstruction, not a faithful reference clone; the classification is recorded in
`registry.manifest.json -> cloneClassification` and was approved by the repository owner on 2026-11-06 (status `approved`; the 11 parity cells below were recorded as exceptions awaiting the owner's review, which was done in 1.1.2).

- Measured, instead of "not-measured": text-free geometry / typography / token comparison of the live site and the built
  clone at 1440x900 and 390x844 in four home states, two full runs (`extraction/geometry_capture.mjs`,
  `geometry_parity.py`, `pixel_parity.py`, tracked dumps and result files under
  `extraction/evidence/parity-2026-11-06/`, no live screenshots). Row-weighted headline: 1440 position 86.5%,
  typography 89.4%, tokens 94.3%; 390 position 74.9%, typography 81.3%, tokens 88.6%; runs agree on every metric.
- Pixel parity is recorded but declared not meaningful (substituted work images, portrait, lettering, signature,
  copy and a random WebGL tile field); only `/` has a live counterpart, the 15 `/work/<slug>` routes return 404 live.
- 11 cells under 80% are recorded as exceptions (at the time `pending human approval`, `approvedBy: null`; reviewed by the owner in 1.1.2) with causes; one is a real
  divergence (signature layer hidden when a box view is open, finding `SIGNATURE_HIDDEN_WHEN_BOXED`, not fixed:
  `src/` is out of scope).
- `verify_all.py`: new `PARITY` check (result files pinned by sha256, numbers re-derived from the dumps, classification
  present with a named human `approvedBy`, README / CHANGELOG first paragraph, generated-mode notice kept).
  `prove_drift.py`: 20 new drift cases and a `--scratch <dir>` option.
- No contract, schema, token or example changed. No IR touched; `pageSpecVersion` and `allowlistVersion` stay 1.0.0.

## 1.1.0 (2026-11-04) - category and common-policy binding

- `registry.manifest.json`: `category: "portfolio"` and a `designPolicy` block binding
  `n0-design-constraints-common` 0.1.0 (Common IR 0.5, `hard-and-soft`, domain `portfolio`) with
  a `contentHash` over the four enforcing files.
- New `extraction/policy_hash.py` (check / `--write`) and `policy/design-policy.json` (`portfolio-site-web` 1.0.0:
  classification, not-bound reason, generation rules, enforcedBy, approval). Both registered as entry points.
- `verify_all.py`: new `DESIGN_POLICY` check. `prove_drift.py`: 9 new cases (hash drift, tampered hash, category
  changed / removed, binding removed, version drift, policy file missing, overstated approval, hash script
  unregistered). Drift cases 37 -> 46.
- Status at the time: the policy is **defined, pending architecture review**; no architecture decision is recorded.
  The binding and classification are agent-derived on the owner's instruction (the owner reviewed the repo in 1.1.2).
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
- Parity: not measured at the time (superseded in 1.1.1). No IR generated (R13).
