#!/usr/bin/env python3
"""One-shot verification of this design-repo. Exit 1 on any failure.

    python3 extraction/verify_all.py                 # verify
    python3 extraction/verify_all.py --write-counts  # recompute manifest counts + README count block, then verify

Checks (each named in the output):
  JSON            every *.json parses
  MANIFEST        entryPoints exist and stay inside design-repo; required entry points registered; counts
                  recomputed from disk; allowlistVersion == tokens/llm/component-allowlist.json version
  README_COUNTS   README count block equals the recomputed counts (never hand-typed)
  DERIVED         schema/pagespec.schema.json, schema/section-contract.schema.json, token-catalog and
                  component-allowlist equal what extraction/build_derived.py derives from the source files
  ALLOWLIST       parity both ways: allowlist ids <-> contract / primitive / component files
  CONTRACTS       every section contract validates against the closed schema/section-contract.schema.json;
                  contract-level reference/generated asset roles == the union of its field roles
  SOURCE_SEMANTIC R7: semantic.id == id == file stem, source.id != id
  RETRIEVAL       R8: RETRIEVAL_INELIGIBLE pin (here == semantic_validate.py) == contracts == allowlist ==
                  templates; runtime-looking ids must be pinned; only SHELL/UTILITY may be ineligible
  PINS            R3: PINNED_AVAILABILITY here == semantic_validate.py == assets/asset-roles.json; pinned
                  generation policies; substitutes generation-safe; generatedAssetRoles generation-safe
  TOKENS          R10: policy keys / pairs / referenceable list / theme resolve to real catalog entries;
                  contract token lists exist in the catalog
  MOTION          every contract motion pattern exists with a fallback from the closed fallback enum
  TEMPLATES       node sections exist; routes 1:1 (16), template route lists in sync; with the source tree:
                  case slugs == src/engine/data.js SELECTED + EXTRA_CASES through slugify
  IA_SYNC         with ia/ia.json present: every ia section maps to exactly one contract (iaSectionId) and the
                  ia route list == routes.json
  GRAPH_SYNC      compatibility/graph.json rule ids == semantic_validate.RULES (same severities)
  CITATIONS       every {cite, needle}: file exists, range inside the file, needle inside the range
  SOURCE_TAGS     R7: each contract's source.file has <tag (or the CSS rule) at source.lines with the needle
  EXAMPLES        every example passes schema + semantic validation; a generated AND a reference example
                  per template family
  WRAPPER_GATE    R9: extraction/wrapper_gate.py
  DESIGN_POLICY   category == portfolio; designPolicy bound to n0-design-constraints-common 0.1.0 (Common IR 0.5,
                  hard-and-soft); policy file and enforcedBy files present and consistent;
                  contentHash recomputed over the enforcing files (extraction/policy_hash.py) matches; approval
                  honestly pending
  PARITY          R12: measured-values parity has real structure (not 'not-measured'), pixelParity.meaningful false with
                  reason, captureState; every result file under extraction/evidence is pinned by sha256; the recorded
                  geometry/typography/token numbers equal what extraction/geometry_parity.py re-derives from the tracked
                  text-free dumps (run1 and run2, reproducibility figure re-derived); manifest cloneClassification is
                  design-language-reconstruction with approvedBy null (pending-human-approval) or a named human;
                  README and CHANGELOG 1.1.1 first paragraph state the classification; generated-mode notice remains
  HYGIENE         no absolute machine paths, no __pycache__/.DS_Store/__MACOSX/Thumbs.db
Citations, source tags, slugs and the ia cross-check resolve against the project root (the folder containing
design-repo/); when that source tree is absent they are reported as warnings, never as passes or failures.
"""
import importlib.util, json, re, sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent
EXPECTED_ROUTES = 16

PINNED_AVAILABILITY = {
    "brand.logo-mark": "blocked-for-generation", "brand.name-lettering": "blocked-for-generation",
    "brand.signature-trace": "blocked-for-generation", "portrait.subject-photo": "blocked-for-generation",
    "work.piece-image": "reference-only", "work.piece-video": "reference-only", "font.display-original": "reference-only",
    "social.share-image-original": "reference-only",
    "generated.brand-mark": "generation-safe", "placeholder.brand-mark": "generation-safe", "generated.name-lettering": "generation-safe",
    "generated.signature": "generation-safe", "user.portrait-photo": "generation-safe", "generated.portrait-silhouette": "generation-safe",
    "generated.work-visual": "generation-safe", "user.work-media": "generation-safe", "placeholder.work-video": "generation-safe",
    "licensed-or-fallback.font": "generation-safe", "icon.ui": "generation-safe", "placeholder.url": "generation-safe",
    "original.copy": "generation-safe", "fictional.person": "generation-safe", "placeholder.metric": "generation-safe",
}
RETRIEVAL_INELIGIBLE = {"shell.loader", "shell.phone-menu", "utility.fly-fades", "utility.flybar", "overlay.glass-box", "utility.hover-hud",
                        "utility.copy-toast", "utility.page-top-fade"}
RUNTIME_ID = re.compile(r"(^shell\.|^utility\.|^overlay\.|overlay|modal|dialog|drawer|menu|loader|preloader|toast|hud|cookie|consent|cursor|lightbox|fade|flybar)")
REQUIRED_ENTRYPOINTS = ("token-catalog", "token-policy", "component-allowlist", "motion-patterns", "asset-roles", "pagespec.schema", "section-contract.schema",
                        "semantic_validate", "adversarial_test", "verify_all", "wrapper_gate", "prove_drift", "measured-values", "measure_sections", "build_derived", "protected-content", "design-policy", "policy_hash")

FAILS, WARNS, PASSES = [], [], []


def fail(check, msg): FAILS.append((check, msg))
def warn(check, msg): WARNS.append((check, msg))
def j(rel): return json.loads((ROOT / rel).read_text())


def load_module(name, rel):
    spec = importlib.util.spec_from_file_location(name, ROOT / rel)
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); return mod


def compute_counts():
    secs = sorted((ROOT / "sections").glob("*.json"))
    cat = j("tokens/llm/token-catalog.json")["tokens"]
    tpl = j("templates/templates.json")["templates"]
    ex = [ROOT / "schema/example.pagespec.json"] + sorted((ROOT / "schema/examples").glob("*.json"))
    exm = [json.loads(p.read_text())["mode"] for p in ex]
    roles = j("assets/asset-roles.json")["roles"]
    adv = load_module("adv_count", "schema/tests/adversarial_test.py")
    drift = load_module("drift_count", "extraction/prove_drift.py")
    return {
        "tokens": len(cat),
        "pageSpecReferenceableTokens": sum(1 for t in cat.values() if t.get("pageSpecReferenceable")),
        "primitives": len(list((ROOT / "primitives").glob("*.json"))),
        "components": len(list((ROOT / "components").glob("*.json"))),
        "sections": len(secs),
        "retrievalIneligibleSections": sum(1 for p in secs if json.loads(p.read_text()).get("retrievalEligible") is False),
        "templates": len(tpl),
        "routes": len(j("templates/routes.json")["routes"]),
        "assetRoles": len(roles),
        "generationSafeAssetRoles": sum(1 for r in roles.values() if r["availability"] == "generation-safe"),
        "motionPatterns": len(j("tokens/00-foundation/motion-patterns.json")["patterns"]),
        "graphRules": len(j("compatibility/graph.json")["rules"]),
        "examples": len(ex), "referenceExamples": exm.count("reference"), "generatedExamples": exm.count("generated"),
        "adversarialMutations": len(adv.MUTATIONS) + len(adv.REPO_MUTATIONS) + len(adv.GATE_MUTATIONS),
        "adversarialControls": len(ex) + 1,
        "driftCases": len(drift.CASES),
    }


def readme_block(c):
    rows = "\n".join(f"| {k} | {v} |" for k, v in c.items())
    return f"<!-- counts:start (written by extraction/verify_all.py --write-counts) -->\n| item | count |\n|---|---|\n{rows}\n<!-- counts:end -->"


def check_citation(obj, where):
    """obj = {cite: 'path:a[-b]', needle}. Returns False when the cited file is absent (self-contained copy)."""
    m = re.match(r"^(.+):(\d+)(?:-(\d+))?$", obj["cite"])
    if not m:
        fail("CITATIONS", f"{where}: malformed cite {obj['cite']!r}"); return True
    path, a, b = m.group(1), int(m.group(2)), int(m.group(3) or m.group(2))
    f = (ROOT / path) if path.startswith(("extraction/", "schema/", "tokens/", "sections/", "templates/")) else (SRC / path)
    if not f.exists():
        return False
    lines = f.read_text(errors="ignore").split("\n")
    if a < 1 or b > len(lines) or a > b:
        fail("CITATIONS", f"{where}: {obj['cite']} outside {path} (1-{len(lines)})"); return True
    if obj.get("needle") and not any(obj["needle"] in l for l in lines[a - 1:b]):
        fail("CITATIONS", f"{where}: needle {obj['needle'][:50]!r} not at {obj['cite']}")
    return True


def walk_cites(o, where, out):
    if isinstance(o, dict):
        if isinstance(o.get("cite"), str) and "needle" in o:
            out.append((o, where))
        for v in o.values():
            walk_cites(v, where, out)
    elif isinstance(o, list):
        for v in o:
            walk_cites(v, where, out)


def field_roles(fields, key):
    out = set()
    for f in fields.values():
        out |= set(f.get(key, []))
        if f["kind"] in ("items", "group"):
            out |= field_roles(f["fields"], key)
    return out


def slugify(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", s.lower())
    s = re.sub(r"[^\w\s-]", "", s).strip()
    return re.sub(r"[\s_.]+", "-", s)


BOUND_POLICY = {"policyId": "n0-design-constraints-common", "policyVersion": "0.1.0", "commonIrVersion": "0.5",
                "enforcementMode": "hard-and-soft", "category": "portfolio", "domain": "portfolio"}
LOCAL_EXTENSION = {"ref": "policy/design-policy.json", "policyId": "portfolio-site-web", "policyVersion": "1.0.0"}


def check_design_policy(man):
    errs = []
    ph = load_module("policy_hash", "extraction/policy_hash.py")
    dp = man.get("designPolicy") or {}
    if man.get("category") != "portfolio":
        errs.append(f"manifest category is {man.get('category')!r}, expected 'portfolio'")
    for k, v in BOUND_POLICY.items():
        if dp.get(k) != v:
            errs.append(f"designPolicy.{k} is {dp.get(k)!r}, expected {v!r}")
    ext = dp.get("localExtension") or {}
    for k, v in LOCAL_EXTENSION.items():
        if ext.get(k) != v:
            errs.append(f"designPolicy.localExtension.{k} is {ext.get(k)!r}, expected {v!r}")
    pol = {}
    if not (ROOT / LOCAL_EXTENSION["ref"]).is_file():
        errs.append("policy/design-policy.json is missing")
    else:
        pol = j(LOCAL_EXTENSION["ref"])
        if pol.get("policyId") != LOCAL_EXTENSION["policyId"] or pol.get("policyVersion") != LOCAL_EXTENSION["policyVersion"]:
            errs.append("policy/design-policy.json id/version disagree with designPolicy.localExtension")
        ex = pol.get("extends") or {}
        if ex.get("policyId") != BOUND_POLICY["policyId"] or ex.get("policyVersion") != BOUND_POLICY["policyVersion"] or pol.get("commonIrVersion") != "0.5":
            errs.append("policy/design-policy.json must extend n0-design-constraints-common 0.1.0 on Common IR 0.5")
        cls = pol.get("classification") or {}
        if cls.get("productCategory") != "portfolio":
            errs.append("policy classification productCategory must be 'portfolio'")
        ap = pol.get("approval") or {}
        if ap.get("policyDecision") != "defined-pending-architecture-review" or ap.get("architectureDecisionRecorded") is not False:
            errs.append("policy approval must stay defined-pending-architecture-review / architectureDecisionRecorded false until a real decision is recorded")
        if (dp.get("decision") or {}).get("policyDecision") != ap.get("policyDecision"):
            errs.append("designPolicy.decision disagrees with policy approval")
        for rel in pol.get("enforcedBy", []):
            if not (ROOT / rel).exists():
                errs.append(f"policy enforcedBy {rel} does not exist")
    if dp.get("contentHashFiles") != ph.POLICY_FILES:
        errs.append("designPolicy.contentHashFiles != extraction/policy_hash.py POLICY_FILES")
    want = ph.compute(str(ROOT))
    if dp.get("contentHash") != want:
        errs.append(f"designPolicy.contentHash {dp.get('contentHash')!r} != recomputed {want!r} (run extraction/policy_hash.py --write after a deliberate change to an enforcing file)")
    eps = man.get("entryPoints", {})
    if eps.get("designPolicy") != LOCAL_EXTENSION["ref"] or eps.get("policyHash") != "extraction/policy_hash.py":
        errs.append("designPolicy / policyHash entry points not registered")
    for e in errs:
        fail("DESIGN_POLICY", e)
    PASSES.append("DESIGN_POLICY")


CLASSIFICATION = "design-language-reconstruction"
PARITY_STATUS = "geometry-measured-pixel-not-meaningful"
HUMAN_BLOCKLIST = re.compile(r"claude|anthropic|\bai\b|agent|bot|assistant|automat|gpt|llm|model", re.I)
SUBSTITUTED_REQUIRED = ("work images", "portrait", "lettering", "signature", "case-study")


def sha256_file(path):
    import hashlib
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def first_paragraph(path):
    """First prose paragraph after the title (heading lines skipped), joined and lower-cased."""
    paras, cur = [], []
    for line in (ROOT / path).read_text().splitlines():
        if line.startswith("#"):
            if cur: break
            continue
        if line.strip():
            cur.append(line.strip())
        elif cur:
            break
    return " ".join(cur).lower()


def changelog_first_paragraph(path, version):
    lines = (ROOT / path).read_text().splitlines()
    out, on = [], False
    for line in lines:
        if line.startswith("## "):
            if on: break
            on = line.startswith(f"## {version} ")
            continue
        if on:
            if line.strip(): out.append(line.strip())
            elif out: break
    return " ".join(out).lower()


def check_parity(man):
    """R12: parity is measured and honest. The recorded numbers are pinned to tracked result files (sha256) and
    re-derived from the tracked text-free dumps; the clone classification is recorded and never self-approved."""
    errs = []
    mv = j("extraction/measured-values.json")
    par = mv.get("parity") or {}
    if par.get("status") == "not-measured" or par.get("status") != PARITY_STATUS:
        errs.append(f"measured-values parity.status is {par.get('status')!r}, expected {PARITY_STATUS!r} (real structure, not 'not-measured')")
    px = par.get("pixelParity") or {}
    if px.get("meaningful") is not False or not px.get("reason"):
        errs.append("parity.pixelParity must state meaningful:false with the reason (substituted content / WebGL imagery)")
    for k in ("captureState", "exceptions", "sectionGate", "perSection"):
        if k not in par:
            errs.append(f"parity.{k} missing")
    cs = par.get("captureState") or {}
    for k in ("viewports", "states", "consentBanner", "webgl", "fonts"):
        if not cs.get(k):
            errs.append(f"parity.captureState.{k} missing")
    # result files pinned by sha256
    for entry in par.get("resultFiles", []):
        f = ROOT / entry.get("path", "")
        if not f.is_file():
            errs.append(f"parity result file {entry.get('path')} missing")
        elif sha256_file(f) != entry.get("sha256"):
            errs.append(f"parity result file {entry.get('path')} sha256 {sha256_file(f)[:12]} != pinned {str(entry.get('sha256'))[:12]}")
    if not par.get("resultFiles"):
        errs.append("parity.resultFiles empty: recorded numbers must be pinned to tracked result files")
    # re-derive geometry from the tracked dumps and compare with the recorded numbers and the result files
    gp = load_module("geometry_parity", "extraction/geometry_parity.py")
    ev = ROOT / "extraction/evidence"
    folders = sorted(ev.glob("parity-*")) if ev.is_dir() else []
    if not folders:
        errs.append("extraction/evidence/parity-* dump folder missing")
    else:
        base = folders[-1]
        for run in ("run1", "run2"):
            d = base / run
            if not d.is_dir():
                errs.append(f"{base.name}/{run} dump folder missing"); continue
            res = gp.run(d); agg = gp.summarise(res)
            rec = (par.get("geometry") or {}).get(run) or {}
            if rec.get("summary") != agg:
                errs.append(f"parity.geometry.{run}.summary differs from the value re-derived from the tracked dumps")
            if rec.get("bySection") != {k: {s: n["pct"] for s, n in v["sections"].items()} for k, v in res.items()}:
                errs.append(f"parity.geometry.{run}.bySection differs from the value re-derived from the tracked dumps")
            rf = ROOT / rec.get("resultFile", "missing")
            if rf.is_file():
                doc = json.loads(rf.read_text())
                if doc.get("byState") != res or doc.get("summary") != agg:
                    errs.append(f"{rec.get('resultFile')} differs from the value re-derived from the tracked dumps")
            else:
                errs.append(f"parity.geometry.{run}.resultFile missing")
        r1, r2 = (par.get("reproducibility") or {}), None
        if (base / "run1").is_dir() and (base / "run2").is_dir():
            a, b = gp.summarise(gp.run(base / "run1")), gp.summarise(gp.run(base / "run2"))
            worst = 0.0
            for k in a:
                for m in gp.METRICS:
                    x, y = a[k][m]["rowWeighted"], b[k][m]["rowWeighted"]
                    if x is not None and y is not None: worst = max(worst, abs(x - y))
            if r1.get("maxRowWeightedDiffPct") != round(worst, 1):
                errs.append(f"parity.reproducibility.maxRowWeightedDiffPct {r1.get('maxRowWeightedDiffPct')!r} != re-derived {round(worst, 1)!r}")
    # headline = mean over the four states of the row-weighted percentage, per viewport
    if folders and (folders[-1] / "run1").is_dir():
        agg = gp.summarise(gp.run(folders[-1] / "run1"))
        want = {}
        for vp in gp.VIEWPORTS:
            ks = [k for k in agg if k.startswith(vp + "-")]
            want[vp] = {m: round(sum(agg[k][m]["rowWeighted"] for k in ks) / len(ks), 1) for m in gp.METRICS} if ks else {}
        if (par.get("headline") or {}).get("run1") != want:
            errs.append("parity.headline.run1 differs from the value re-derived from the tracked dumps")
    # pixel numbers equal their pinned result files
    for run in ("run1", "run2"):
        rec = (px.get(run) or {})
        rf = ROOT / rec.get("resultFile", "missing")
        if not rf.is_file():
            errs.append(f"parity.pixelParity.{run}.resultFile missing"); continue
        if json.loads(rf.read_text()).get("byState") != rec.get("byState"):
            errs.append(f"parity.pixelParity.{run}.byState differs from {rec.get('resultFile')}")
    # classification record
    cc = man.get("cloneClassification") or {}
    if cc.get("value") != CLASSIFICATION:
        errs.append(f"manifest cloneClassification.value is {cc.get('value')!r}, expected {CLASSIFICATION!r}")
    ab, st = cc.get("approvedBy"), cc.get("status")
    if ab is None:
        if st != "pending-human-approval":
            errs.append("cloneClassification.approvedBy is null: status must be 'pending-human-approval'")
    else:
        if not isinstance(ab, str) or not ab.strip() or HUMAN_BLOCKLIST.search(ab) or st != "approved":
            errs.append("cloneClassification.approvedBy must be null or a named human approver (status 'approved'); an agent never approves")
        if not cc.get("approvedOn"):
            errs.append("cloneClassification approved without approvedOn")
    rat = json.dumps(cc.get("rationale", "")).lower() + json.dumps(cc.get("substituted", "")).lower()
    for w in SUBSTITUTED_REQUIRED:
        if w not in rat:
            errs.append(f"cloneClassification rationale/substituted does not mention {w!r}")
    er = cc.get("evidenceRef")
    if not er or not (ROOT / er.split("#")[0]).exists():
        errs.append(f"cloneClassification.evidenceRef {er!r} does not resolve to a tracked file")
    if (man.get("entryPoints") or {}).get("geometryParity") != "extraction/geometry_parity.py":
        errs.append("geometryParity entry point not registered")
    # the classification is stated first in README and CHANGELOG
    for path, text in (("README.md", first_paragraph("README.md")), ("CHANGELOG.md", changelog_first_paragraph("CHANGELOG.md", "1.1.1"))):
        status_word = "approved" if ab is not None else "pending"
        if CLASSIFICATION.replace("-", " ") not in text.replace("-", " ") or "not a faithful reference clone" not in text or status_word not in text:
            errs.append(f"{path}: the first paragraph must state 'design-language reconstruction', 'not a faithful reference clone' and that approval is {status_word}")
    if man.get("repositoryVersion") != "1.1.1":
        errs.append(f"repositoryVersion is {man.get('repositoryVersion')!r}, expected '1.1.1'")
    # generated-mode / leakage notes remain
    sn = man.get("sourceNotice", "")
    if "Never reproduce the original" not in sn or "Do not publish" not in sn or "generated" not in man.get("modes", []):
        errs.append("generated-mode / source-leakage notice missing from the manifest")
    for e in errs:
        fail("PARITY", e)
    PASSES.append("PARITY")


def main(write_counts=False):
    docs = {}
    for p in sorted(ROOT.rglob("*.json")):
        try:
            docs[str(p.relative_to(ROOT))] = json.loads(p.read_text())
        except Exception as e:
            fail("JSON", f"{p.relative_to(ROOT)}: {e}")
    PASSES.append("JSON")
    man = j("registry.manifest.json")
    counts = compute_counts()
    if write_counts:
        man["counts"] = counts
        (ROOT / "registry.manifest.json").write_text(json.dumps(man, indent=1, ensure_ascii=False) + "\n")
        rd = (ROOT / "README.md").read_text()
        rd = re.sub(r"<!-- counts:start.*?<!-- counts:end -->", readme_block(counts), rd, flags=re.S)
        (ROOT / "README.md").write_text(rd)
    # MANIFEST
    eps = man.get("entryPoints", {})
    for name, ep in eps.items():
        if ep.startswith("..") or ep.startswith("/") or not (ROOT / ep).exists():
            fail("MANIFEST", f"entryPoint {name} -> {ep} missing or outside design-repo")
    for need in REQUIRED_ENTRYPOINTS:
        if not any(need in ep for ep in eps.values()):
            fail("MANIFEST", f"{need} not registered in entryPoints")
    if man.get("counts") != counts:
        diff = {k: (man.get("counts", {}).get(k), v) for k, v in counts.items() if man.get("counts", {}).get(k) != v}
        fail("MANIFEST", f"counts drift (manifest, disk): {diff}")
    al = j("tokens/llm/component-allowlist.json")
    if man.get("allowlistVersion") != al.get("version"):
        fail("MANIFEST", f"allowlistVersion {man.get('allowlistVersion')} != allowlist {al.get('version')}")
    PASSES.append("MANIFEST")
    rd = (ROOT / "README.md").read_text()
    if readme_block(counts) not in rd:
        fail("README_COUNTS", "README count block is stale; run verify_all.py --write-counts")
    PASSES.append("README_COUNTS")
    # DERIVED
    bd = load_module("bd", "extraction/build_derived.py")
    for rel, fn in (("schema/pagespec.schema.json", bd.build_schema), ("schema/section-contract.schema.json", bd.build_contract_schema),
                    ("tokens/llm/token-catalog.json", bd.build_catalog), ("tokens/llm/component-allowlist.json", bd.build_allowlist)):
        want, have = fn(), j(rel)
        if want != have:
            if rel.endswith("token-catalog.json"):
                wt, ht = want["tokens"], have["tokens"]
                for t in sorted(set(wt) - set(ht)): fail("DERIVED", f"{rel}: {t} in token files but missing from catalog")
                for t in sorted(set(ht) - set(wt)): fail("DERIVED", f"{rel}: {t} in catalog but not in any token file")
                for t in sorted(set(wt) & set(ht)):
                    if wt[t] != ht[t]: fail("DERIVED", f"{rel}: {t} catalog {ht[t]} != token files {wt[t]}")
                if want["counts"] != have["counts"]: fail("DERIVED", f"{rel}: counts {have['counts']} != {want['counts']}")
            else:
                fail("DERIVED", f"{rel} differs from what extraction/build_derived.py derives (hand-edited or stale)")
    PASSES.append("DERIVED")
    # ALLOWLIST
    contracts = {p.stem: json.loads(p.read_text()) for p in sorted((ROOT / "sections").glob("*.json"))}
    prims = {json.loads(p.read_text())["id"] for p in (ROOT / "primitives").glob("*.json")}
    comps = {json.loads(p.read_text())["id"] for p in (ROOT / "components").glob("*.json")}
    for kind, have, listed in (("sections", set(contracts), set(al["sections"])), ("primitives", prims, set(al["primitives"])), ("components", comps, set(al["components"]))):
        for x in sorted(listed - have): fail("ALLOWLIST", f"phantom {kind} entry {x} (no contract file)")
        for x in sorted(have - listed): fail("ALLOWLIST", f"orphan {kind} contract {x} (not in allowlist)")
    for sid, c in contracts.items():
        a = al["sections"].get(sid)
        if a and (sorted(c["content"]) != a["contentFields"] or c["variants"] != a["variants"] or c["motion"]["allowed"] != a["motion"]):
            fail("ALLOWLIST", f"{sid}: allowlist settable properties out of sync with the contract")
    for comp in (ROOT / "components").glob("*.json"):
        for u in json.loads(comp.read_text()).get("uses", []):
            if u not in prims and u not in comps: fail("ALLOWLIST", f"component {comp.stem} uses unknown {u}")
    sch = j("schema/pagespec.schema.json")
    if set(al["nodeProperties"]) != set(sch["definitions"]["node"]["properties"]):
        fail("ALLOWLIST", f"allowlist nodeProperties {al['nodeProperties']} != schema node properties")
    PASSES.append("ALLOWLIST")
    # CONTRACTS
    from jsonschema import Draft7Validator
    cs = Draft7Validator(j("schema/section-contract.schema.json"))
    for sid, c in contracts.items():
        for e in cs.iter_errors(c):
            fail("CONTRACTS", f"{sid}: {'/'.join(map(str, e.absolute_path))} {e.message[:120]}")
        if set(c.get("referenceAssetRoles", [])) != field_roles(c["content"], "assetRoles"):
            fail("CONTRACTS", f"{sid}: referenceAssetRoles != union of its media fields' assetRoles")
        if not field_roles(c["content"], "generatedAssetRoles") <= set(c.get("generatedAssetRoles", [])):
            fail("CONTRACTS", f"{sid}: generatedAssetRoles misses a field-level generated role")
    PASSES.append("CONTRACTS")
    # SOURCE_SEMANTIC
    for sid, c in contracts.items():
        if not (c["id"] == sid == c["semantic"]["id"]):
            fail("SOURCE_SEMANTIC", f"{sid}: id/semantic.id/file stem disagree")
        if c["source"]["id"] == c["id"]:
            fail("SOURCE_SEMANTIC", f"{sid}: source.id must not equal the semantic id")
    PASSES.append("SOURCE_SEMANTIC")
    # RETRIEVAL
    sv = load_module("sv", "schema/semantic_validate.py")
    if sv.RETRIEVAL_INELIGIBLE != RETRIEVAL_INELIGIBLE:
        fail("RETRIEVAL", "RETRIEVAL_INELIGIBLE differs between verify_all.py and semantic_validate.py")
    false_set = {s for s, c in contracts.items() if c.get("retrievalEligible") is False}
    if false_set != RETRIEVAL_INELIGIBLE:
        fail("RETRIEVAL", f"contracts false {sorted(false_set)} != pin {sorted(RETRIEVAL_INELIGIBLE)}")
    for sid, c in contracts.items():
        if RUNTIME_ID.search(sid) and sid not in RETRIEVAL_INELIGIBLE:
            fail("RETRIEVAL", f"{sid} looks like runtime UI but is not pinned ineligible")
        if al["sections"].get(sid, {}).get("retrievalEligible") != (sid not in RETRIEVAL_INELIGIBLE):
            fail("RETRIEVAL", f"allowlist {sid}.retrievalEligible disagrees with the pin")
        if c.get("retrievalEligible") is False and len(c.get("retrievalReason", "")) < 30:
            fail("RETRIEVAL", f"{sid}: reason < 30 chars")
        if c.get("retrievalEligible") is False and c["semantic"]["category"] not in ("SHELL", "UTILITY"):
            fail("RETRIEVAL", f"{sid}: content category {c['semantic']['category']} marked ineligible")
    for t, tpl in j("templates/templates.json")["templates"].items():
        for n in tpl["nodes"]:
            if "section" in n and n.get("retrievalEligible") != (n["section"] not in RETRIEVAL_INELIGIBLE):
                fail("RETRIEVAL", f"template {t}: node {n['section']} retrievalEligible disagrees with the pin")
    PASSES.append("RETRIEVAL")
    # PINS
    roles = j("assets/asset-roles.json")["roles"]
    if sv.PINNED_AVAILABILITY != PINNED_AVAILABILITY:
        fail("PINS", "PINNED_AVAILABILITY differs between verify_all.py and semantic_validate.py")
    if set(roles) != set(PINNED_AVAILABILITY):
        fail("PINS", f"roles not pinned / pins without role: {sorted(set(roles) ^ set(PINNED_AVAILABILITY))}")
    for r, av in PINNED_AVAILABILITY.items():
        if r in roles and roles[r]["availability"] != av:
            fail("PINS", f"{r}: registry {roles[r]['availability']!r} != pinned {av!r}")
    for r, pol in sv.PINNED_GENERATION_POLICY.items():
        if roles.get(r, {}).get("generationPolicy") != pol:
            fail("PINS", f"{r}: generationPolicy pinned to {pol!r}")
    for r, d in roles.items():
        if d["availability"] != "generation-safe" and not all(PINNED_AVAILABILITY.get(s) == "generation-safe" for s in d.get("generationSafeSubstitutes", [None])):
            fail("PINS", f"{r}: substitutes must be generation-safe roles")
        if d["availability"] != "generation-safe" and d.get("generationPolicy") in ("may-generate-new", "may-reuse-licensed"):
            fail("PINS", f"{r}: a {d['availability']} role cannot be reusable in generated mode")
    for sid, c in contracts.items():
        for r in c["generatedAssetRoles"] + sorted(field_roles(c["content"], "generatedAssetRoles")):
            if PINNED_AVAILABILITY.get(r) != "generation-safe":
                fail("PINS", f"{sid}: generatedAssetRoles lists non-generation-safe {r}")
    PASSES.append("PINS")
    # TOKENS
    cat = j("tokens/llm/token-catalog.json")["tokens"]
    pol = j("tokens/llm/token-policy.json")
    real_cats = {t["category"] for t in cat.values()}
    for k in pol["rawValueRestrictions"]:
        if k not in real_cats: fail("TOKENS", f"policy rawValueRestrictions key {k!r} is not a catalog category")
    for k, v in pol["pageSpecTokenFields"].items():
        if v["category"] not in real_cats: fail("TOKENS", f"policy field {k} -> unknown category {v['category']}")
    for x in pol["pageSpecReferenceable"] + pol["fontFamilyAllowed"]:
        if x not in cat: fail("TOKENS", f"policy token {x} not in catalog")
    for s, ts in pol["surfaceTextPairs"].items():
        for x in [s] + ts:
            if x not in cat: fail("TOKENS", f"policy pair token {x} not in catalog")
    dark = j("tokens/themes/dark.json")["resolves"]
    sem = j("tokens/10-semantic/semantic.json")["tokens"]
    for s in pol["themes"]["dark"]:
        if s not in dark: fail("TOKENS", f"theme dark does not resolve {s}")
    for s, ref in dark.items():
        if ref not in cat or s not in sem or sem[s]["$value"] != cat[ref]["value"] or sem[s]["$ref"] != ref:
            fail("TOKENS", f"theme dark: {s} -> {ref} does not resolve to the same foundation value")
    for sid, c in contracts.items():
        for x in c["tokens"]["surfaces"] + c["tokens"]["text"]:
            if x not in cat: fail("TOKENS", f"{sid}: token {x} not in catalog")
    PASSES.append("TOKENS")
    # MOTION
    mpj = j("tokens/00-foundation/motion-patterns.json"); mp = mpj["patterns"]
    for k, v in mp.items():
        if v.get("reducedMotionFallback") not in mpj["fallbackEnum"]: fail("MOTION", f"pattern {k}: fallback {v.get('reducedMotionFallback')!r} not in the closed enum")
    for sid, c in contracts.items():
        for p in c["motion"]["allowed"]:
            if p not in mp: fail("MOTION", f"{sid}: pattern {p} unknown")
        if c["motion"]["default"] not in c["motion"]["allowed"]: fail("MOTION", f"{sid}: default not in allowed")
    PASSES.append("MOTION")
    # TEMPLATES
    tpls = j("templates/templates.json")["templates"]
    routes = j("templates/routes.json")["routes"]
    for t, tpl in tpls.items():
        for n in tpl["nodes"]:
            for s in ([n["section"]] if "section" in n else n["allowed"]):
                if s not in contracts: fail("TEMPLATES", f"{t}: unknown section {s}")
    paths = [r["path"] for r in routes]
    if len(paths) != len(set(paths)): fail("TEMPLATES", "a route is mapped more than once")
    if len(paths) != EXPECTED_ROUTES: fail("TEMPLATES", f"{len(paths)} routes, expected {EXPECTED_ROUTES}")
    for r in routes:
        if r["template"] not in tpls: fail("TEMPLATES", f"{r['path']}: unknown template {r['template']}")
        elif not re.match(tpls[r["template"]]["routePattern"], r["path"]): fail("TEMPLATES", f"{r['path']}: does not match {r['template']} routePattern")
    for t, tpl in tpls.items():
        if sorted(tpl["routes"]) != sorted(r["path"] for r in routes if r["template"] == t): fail("TEMPLATES", f"{t}: routes list out of sync with routes.json")
    data_js = SRC / "src/engine/data.js"
    if data_js.exists():
        t = data_js.read_text()
        sel = re.search(r"export const SELECTED = \[(.*?)\n\]", t, re.S).group(1)
        names = re.findall(r"\['([^']+)',", sel) + re.findall(r"'([^']+)'", re.search(r"const EXTRA_CASES = \[(.*?)\]", t).group(1))
        want = ["/"] + [f"/work/{slugify(n)}" for n in names]
        if sorted(want) != sorted(paths): fail("TEMPLATES", f"routes.json != routes derived from src/engine/data.js: {sorted(set(want) ^ set(paths))}")
    else:
        warn("TEMPLATES", "source tree not present (self-contained copy): 1:1 checked against routes.json only")
    PASSES.append("TEMPLATES")
    # IA_SYNC
    ia_p = SRC / "ia/ia.json"
    if ia_p.exists():
        ia = json.loads(ia_p.read_text())
        ia_ids = set(ia["sections"]) if isinstance(ia["sections"], dict) else {s["id"] for s in ia["sections"]}
        mapped = [c.get("iaSectionId") for c in contracts.values() if c.get("iaSectionId")]
        for x in sorted(ia_ids - set(mapped)): fail("IA_SYNC", f"ia section {x} has no contract")
        for x in sorted(set(mapped) - ia_ids): fail("IA_SYNC", f"iaSectionId {x} not in ia/ia.json")
        for x in sorted({m for m in mapped if mapped.count(m) > 1}): fail("IA_SYNC", f"ia section {x} mapped by more than one contract")
        ia_routes = sorted(r for t in ia["templates"] for r in t["routes"])
        if ia_routes != sorted(paths): fail("IA_SYNC", f"ia routes != routes.json: {sorted(set(ia_routes) ^ set(paths))}")
        PASSES.append(f"IA_SYNC ({len(ia_ids)} ia sections, {len(ia_routes)} ia routes)")
    else:
        warn("IA_SYNC", "ia/ia.json not present (self-contained copy): skipped")
        PASSES.append("IA_SYNC (skipped)")
    # GRAPH_SYNC
    g = {r["id"]: r["severity"] for r in j("compatibility/graph.json")["rules"]}
    if g != sv.RULES: fail("GRAPH_SYNC", f"graph rules/severities differ from semantic_validate.RULES: {sorted(set(g.items()) ^ set(sv.RULES.items()))}")
    PASSES.append("GRAPH_SYNC")
    # CITATIONS + SOURCE_TAGS
    cites = []
    for rel, doc in docs.items():
        walk_cites(doc, rel, cites)
    resolved = sum(1 for o, w in cites if check_citation(o, w))
    if resolved < len(cites):
        warn("CITATIONS", f"{len(cites) - resolved}/{len(cites)} citations not checkable (source tree absent)")
    PASSES.append(f"CITATIONS ({resolved}/{len(cites)} resolved)")
    tag_ok = 0
    for sid, c in contracts.items():
        s = c["source"]; f = SRC / s["file"]
        if not f.exists():
            continue
        lines = f.read_text(errors="ignore").split("\n")
        a, _, b = s["lines"].partition("-"); a = int(a); b = int(b or a)
        if b > len(lines): fail("SOURCE_TAGS", f"{sid}: {s['file']}:{s['lines']} out of range"); continue
        seg = "\n".join(lines[a - 1:b])
        tag_here = (s["tag"] == "css-pseudo" and "::" in seg and "{" in seg) or f"<{s['tag']}" in seg
        if not tag_here or s["needle"] not in seg:
            fail("SOURCE_TAGS", f"{sid}: <{s['tag']} with {s['needle'][:40]!r} not at {s['file']}:{s['lines']}")
        else:
            tag_ok += 1
    if tag_ok < len(contracts) and not (SRC / "src").exists():
        warn("SOURCE_TAGS", "source tree absent: source tags not checkable")
    PASSES.append(f"SOURCE_TAGS ({tag_ok}/{len(contracts)} verified)")
    # EXAMPLES
    repo = sv.load_repo(ROOT)
    fams = {}
    for p in sv.example_paths(ROOT):
        spec = json.loads(p.read_text())
        e, w = sv.validate(spec, repo)
        for code, msg in e: fail("EXAMPLES", f"{p.relative_to(ROOT)}: {code} {msg}")
        fams.setdefault(spec["template"], set()).add(spec["mode"])
    for t in tpls:
        for m in ("generated", "reference"):
            if m not in fams.get(t, set()): fail("EXAMPLES", f"no {m} example for template {t}")
    PASSES.append("EXAMPLES")
    # WRAPPER_GATE
    wg = load_module("wg", "extraction/wrapper_gate.py")
    e, w = wg.check(ROOT)
    for code, msg in e: fail("WRAPPER_GATE", f"{code} {msg}")
    for code, msg in w: warn("WRAPPER_GATE", f"{code} {msg}")
    PASSES.append("WRAPPER_GATE")
    check_design_policy(man)
    check_parity(man)
    # HYGIENE (character classes keep this file free of the literal patterns it searches for)
    absre = re.compile(r"/U[s]ers/[A-Za-z0-9._-]+/|/h[o]me/[A-Za-z0-9._-]+/|/p[r]ivate/(tmp|var)/|C:\\\\U[s]ers\\\\")
    for p in ROOT.rglob("*"):
        if p.is_dir() and p.name in ("__pycache__", "__MACOSX"): fail("HYGIENE", f"junk dir {p.relative_to(ROOT)}")
        if p.is_file():
            if p.name in (".DS_Store", "Thumbs.db", "desktop.ini"): fail("HYGIENE", f"junk file {p.relative_to(ROOT)}")
            elif p.suffix in (".json", ".md", ".py", ".mjs", ".txt") and absre.search(p.read_text(errors="ignore")): fail("HYGIENE", f"absolute path in {p.relative_to(ROOT)}")
    PASSES.append("HYGIENE")

    for c in PASSES:
        name = c.split(" ")[0]
        print(f"{'FAIL' if any(f[0] == name for f in FAILS) else 'PASS'}  {c}")
    for c, m in WARNS: print(f"warn  {c}: {m}")
    for c, m in FAILS: print(f"FAIL  {c}: {m}")
    print(f"\nverify_all: {len(FAILS)} failures, {len(WARNS)} warnings; counts {json.dumps(counts)}")
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main("--write-counts" in sys.argv))
