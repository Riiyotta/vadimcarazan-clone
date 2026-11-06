#!/usr/bin/env python3
"""Prove that verify_all.py's checks catch drift: for each case, copy the repo to a fresh OS temp directory,
inject one defect, run verify_all.py there and require exit 1 plus a FAIL line for the expected check.
The untouched copy must pass (control).

    python3 extraction/prove_drift.py [--scratch <empty dir>]

When the source evidence tree (src/, CLONE_SPEC.md, the saved snapshot, content/, index.html, ia/ next to
design-repo/) is present it is linked read-only into the temp project so the citation / source-tag / slug /
ia cases run; otherwise those cases are reported as SKIP (never as a pass).
"""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent
SCRATCH = None
if "--scratch" in sys.argv:
    SCRATCH = Path(sys.argv[sys.argv.index("--scratch") + 1]).resolve()
SOURCE_ENTRIES = ["src", "CLONE_SPEC.md", "Vadim Carazan, Creative Director.html", "content", "index.html", "ia"]
HAS_SOURCE = all((SRC / e).exists() for e in SOURCE_ENTRIES)


def jedit(rel, fn):
    def run(repo):
        p = repo / rel; d = json.loads(p.read_text()); fn(d); p.write_text(json.dumps(d, indent=1, ensure_ascii=False) + "\n")
    return run


def tedit(rel, old, new, count=1):
    def run(repo):
        p = repo / rel; t = p.read_text()
        assert old in t, f"{rel}: pattern not found: {old!r}"
        p.write_text(t.replace(old, new, count))
    return run


def edit_text(repo, rel, old, new):
    tedit(rel, old, new)(repo)


def both(*fns):
    def run(repo):
        for f in fns: f(repo)
    return run


def orphan(repo):
    shutil.copy(repo / "sections/about.studio-bio.json", repo / "sections/about.studio-bio-copy.json")


def first_result(repo, name):
    return str(next((repo / "extraction/evidence").glob("parity-*/" + name)).relative_to(repo))


def first_dump(repo):
    return str(sorted((repo / "extraction/evidence").glob("parity-*/run1/clone/1440-closed.n"))[0].relative_to(repo))


CASES = [
    # allowlist / manifest / counts
    ("phantom allowlist entry", jedit("tokens/llm/component-allowlist.json", lambda d: d["sections"].update({"hero.phantom": d["sections"]["hero.case-header"]})), "ALLOWLIST", False),
    ("orphan contract file", orphan, "ALLOWLIST", False),
    ("manifest count hand-bumped", jedit("registry.manifest.json", lambda d: d["counts"].update(sections=40)), "MANIFEST", False),
    ("allowlistVersion drift", jedit("registry.manifest.json", lambda d: d.update(allowlistVersion="9.9.9")), "MANIFEST", False),
    ("entry point outside the package", jedit("registry.manifest.json", lambda d: d["entryPoints"].update(spec="../CLONE_SPEC.md")), "MANIFEST", False),
    ("README count edited", tedit("README.md", "| sections | ", "| sections | 9"), "README_COUNTS", False),
    # citations / source tags (need the source tree)
    ("citation out of range", jedit("tokens/00-foundation/color.json", lambda d: d["tokens"]["color.bg"]["evidence"][0].update(cite="src/index.css:999999")), "CITATIONS", True),
    ("citation in range, wrong content", jedit("tokens/00-foundation/color.json", lambda d: d["tokens"]["color.bg"]["evidence"][0].update(needle="--bg: #123456")), "CITATIONS", True),
    ("source tag moved", jedit("sections/hero.portrait-intro.json", lambda d: d["source"].update(lines="1")), "SOURCE_TAGS", True),
    ("route slug not in data.js", jedit("templates/routes.json", lambda d: d["routes"][-1].update(path="/work/tesserae")), "TEMPLATES", True),
    ("ia section lost its contract", jedit("sections/utility.copy-toast.json", lambda d: d.update(iaSectionId=None)), "IA_SYNC", True),
    # R3 pins
    ("registry availability loosened", jedit("assets/asset-roles.json", lambda d: d["roles"]["brand.logo-mark"].update(availability="generation-safe")), "PINS", False),
    ("registry policy set to a different valid value", jedit("assets/asset-roles.json", lambda d: d["roles"]["portrait.subject-photo"].update(generationPolicy="user-supplied-only")), "PINS", False),
    ("pin removed from verify_all", tedit("extraction/verify_all.py", '"work.piece-video": "reference-only", ', ""), "PINS", False),
    ("pin removed from semantic_validate", tedit("schema/semantic_validate.py", '"work.piece-video": "reference-only", ', ""), "PINS", False),
    ("contract + allowlist availability flipped together", both(jedit("assets/asset-roles.json", lambda d: d["roles"]["work.piece-image"].update(availability="generation-safe")),
                                                               jedit("sections/media.case-image.json", lambda d: d["content"]["media"]["generatedAssetRoles"].append("work.piece-image"))), "PINS", False),
    # R8 retrieval
    ("contract + allowlist retrieval flipped together", both(jedit("sections/overlay.glass-box.json", lambda d: d.update(retrievalEligible=True)),
                                                            jedit("tokens/llm/component-allowlist.json", lambda d: d["sections"]["overlay.glass-box"].update(retrievalEligible=True))), "RETRIEVAL", False),
    ("content section marked ineligible", jedit("sections/about.studio-bio.json", lambda d: d.update(retrievalEligible=False, retrievalReason="an attempt to hide a real content section")), "RETRIEVAL", False),
    ("retrieval pin removed from semantic_validate", tedit("schema/semantic_validate.py", '"utility.copy-toast", ', ""), "RETRIEVAL", False),
    ("runtime-looking section left eligible", both(lambda r: shutil.copy(r / "sections/chrome.social.json", r / "sections/utility.cursor.json"),
                                                   jedit("sections/utility.cursor.json", lambda d: d.update(id="utility.cursor", semantic={"id": "utility.cursor", "category": "UTILITY"}, iaSectionId=None))), "RETRIEVAL", False),
    # R10 tokens / derived files
    ("token value edited in catalog only", jedit("tokens/llm/token-catalog.json", lambda d: d["tokens"]["color.ink"].update(value="#ffffff")), "DERIVED", False),
    ("token added to a token file only", jedit("tokens/00-foundation/color.json", lambda d: d["tokens"].update({"color.new": {"$type": "color", "$value": "#000001", "category": "color", "evidence": []}})), "DERIVED", False),
    ("policy category is a human label", jedit("tokens/llm/token-policy.json", lambda d: d["rawValueRestrictions"].update(typography={"rule": "x"})), "TOKENS", False),
    ("theme resolves to the wrong foundation token", jedit("tokens/themes/dark.json", lambda d: d["resolves"].update({"surface.page": "color.glass"})), "TOKENS", False),
    ("schema section enum drift", jedit("schema/pagespec.schema.json", lambda d: d["definitions"]["node"]["properties"]["section"]["enum"].remove("media.case-video")), "DERIVED", False),
    ("contract field added without re-deriving", jedit("sections/chrome.social.json", lambda d: d["content"].update(extra={"kind": "text", "maxWords": 2, "required": False})), "DERIVED", False),
    ("contract schema loosened by hand", jedit("schema/section-contract.schema.json", lambda d: d.update(additionalProperties=True)), "DERIVED", False),
    # graph / templates / examples / gate / hygiene
    ("graph rule severity drift", jedit("compatibility/graph.json", lambda d: d["rules"][0].update(severity="warn")), "GRAPH_SYNC", False),
    ("route removed", jedit("templates/routes.json", lambda d: d["routes"].pop()), "TEMPLATES", False),
    ("route mapped twice", jedit("templates/routes.json", lambda d: d["routes"].append(d["routes"][0])), "TEMPLATES", False),
    ("example drifts from its template", jedit("schema/examples/generated.cosmos-home.json", lambda d: d["nodes"].pop(3)), "EXAMPLES", False),
    ("generated example removed", lambda r: (r / "schema/examples/generated.case-study.json").unlink(), "EXAMPLES", False),
    ("measured heights removed", jedit("extraction/measured-values.json", lambda d: d.pop("sectionHeights")), "WRAPPER_GATE", False),
    ("gate thresholds loosened in JSON", jedit("extraction/measured-values.json", lambda d: d.update(thresholds={"heroWarnPx": 9000, "heroErrorPx": 9999, "shareWarn": 0.9, "shareError": 0.99})), "WRAPPER_GATE", False),
    ("gate threshold loosened in code", tedit("extraction/wrapper_gate.py", "HERO_ERROR_PX = 3000", "HERO_ERROR_PX = 30000"), "WRAPPER_GATE", False),
    ("absolute machine path", tedit("README.md", "# ", "# " + "/" + "Users/someone/project ", 1), "HYGIENE", False),
    ("junk file", lambda r: (r / "sections/.DS_Store").write_text("x"), "HYGIENE", False),
    # category / common-policy binding
    ("enforcing file edited without refreshing the hash", lambda r: edit_text(r, "compatibility/graph.json", " ", "  "), "DESIGN_POLICY", False),
    ("contentHash tampered", jedit("registry.manifest.json", lambda d: d["designPolicy"].update(contentHash="sha256:" + "0" * 64)), "DESIGN_POLICY", False),
    ("category changed to another value", jedit("registry.manifest.json", lambda d: d.update(category="marketplace")), "DESIGN_POLICY", False),
    ("category removed", jedit("registry.manifest.json", lambda d: d.pop("category")), "DESIGN_POLICY", False),
    ("common-policy binding removed", jedit("registry.manifest.json", lambda d: d.pop("designPolicy")), "DESIGN_POLICY", False),
    ("bound policy version drift", jedit("registry.manifest.json", lambda d: d["designPolicy"].update(policyVersion="0.2.0")), "DESIGN_POLICY", False),
    ("policy file missing", lambda r: os.remove(r / "policy/design-policy.json"), "DESIGN_POLICY", False),
    ("approval claimed as ratified without a recorded decision", jedit("policy/design-policy.json", lambda d: d["approval"].update(policyDecision="ratified")), "DESIGN_POLICY", False),
    ("policy hash script unregistered", jedit("registry.manifest.json", lambda d: d["entryPoints"].pop("policyHash")), "DESIGN_POLICY", False),
    # R12 parity evidence + clone classification
    ("parity reverted to not-measured", jedit("extraction/measured-values.json", lambda d: d["parity"].update(status="not-measured")), "PARITY", False),
    ("recorded geometry number hand-edited", jedit("extraction/measured-values.json", lambda d: d["parity"]["geometry"]["run1"]["summary"]["1440-closed"]["geometry"].update(rowWeighted=99.9)), "PARITY", False),
    ("recorded per-section number hand-edited", jedit("extraction/measured-values.json", lambda d: d["parity"]["geometry"]["run1"]["bySection"]["1440-closed"]["hero"].update(typography=100.0)), "PARITY", False),
    ("reproducibility figure hand-edited", jedit("extraction/measured-values.json", lambda d: d["parity"]["reproducibility"].update(maxRowWeightedDiffPct=5.0)), "PARITY", False),
    ("pinned result file edited", lambda r: edit_text(r, first_result(r, "geometry-result-run1.json"), '"tolerancePx"', '"tolerancePx" '), "PARITY", False),
    ("pinned pixel result file edited", lambda r: edit_text(r, first_result(r, "pixel-result-run1.json"), '"method"', '"method" '), "PARITY", False),
    ("pinned result file deleted", lambda r: os.remove(r / first_result(r, "geometry-result-run2.json")), "PARITY", False),
    ("tracked dump edited so the numbers move", lambda r: edit_text(r, first_dump(r), "\t", "\t9"), "PARITY", False),
    ("pixel parity claimed meaningful", jedit("extraction/measured-values.json", lambda d: d["parity"]["pixelParity"].update(meaningful=True)), "PARITY", False),
    ("capture state removed", jedit("extraction/measured-values.json", lambda d: d["parity"].pop("captureState")), "PARITY", False),
    ("classification record removed", jedit("registry.manifest.json", lambda d: d.pop("cloneClassification")), "PARITY", False),
    ("classification relabelled a faithful clone", jedit("registry.manifest.json", lambda d: d["cloneClassification"].update(value="faithful-reference-clone")), "PARITY", False),
    ("agent approves its own classification", jedit("registry.manifest.json", lambda d: d["cloneClassification"].update(approvedBy="Claude", status="approved", approvedOn="2026-11-06")), "PARITY", False),
    ("approved status without an approver", jedit("registry.manifest.json", lambda d: d["cloneClassification"].update(status="approved")), "PARITY", False),
    ("approver is a blank string", jedit("registry.manifest.json", lambda d: d["cloneClassification"].update(approvedBy=" ", status="approved", approvedOn="2026-11-06")), "PARITY", False),
    ("classification evidenceRef broken", jedit("registry.manifest.json", lambda d: d["cloneClassification"].update(evidenceRef="extraction/evidence/missing.json")), "PARITY", False),
    ("classification rationale drops the substitutions", jedit("registry.manifest.json", lambda d: d["cloneClassification"].update(rationale="n/a", substituted=[])), "PARITY", False),
    ("README first paragraph loses the classification", tedit("README.md", "not a faithful reference clone", "a reference clone"), "PARITY", False),
    ("CHANGELOG 1.1.1 first paragraph loses the classification", tedit("CHANGELOG.md", "not a faithful reference clone", "a reference clone"), "PARITY", False),
    ("generated-mode / leakage notice removed from the manifest", jedit("registry.manifest.json", lambda d: d.update(sourceNotice="placeholder content")), "PARITY", False),
]



def make_copy():
    tmp = Path(tempfile.mkdtemp(prefix="drift-", dir=str(SCRATCH) if SCRATCH else None))
    proj = tmp / "project"; proj.mkdir()
    shutil.copytree(ROOT, proj / "design-repo", ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    if HAS_SOURCE:
        for e in SOURCE_ENTRIES:
            os.symlink(SRC / e, proj / e)
    return tmp, proj / "design-repo"


def run_verify(repo):
    r = subprocess.run([sys.executable, "-B", str(repo / "extraction/verify_all.py")], cwd=repo, capture_output=True, text=True)
    return r.returncode, r.stdout + r.stderr


def main():
    tmp, repo = make_copy()
    code, out = run_verify(repo); shutil.rmtree(tmp)
    print(f"{'PASS' if code == 0 else 'FAIL'}  control: untouched copy passes verify_all (exit {code}); source tree {'linked' if HAS_SOURCE else 'absent'}")
    control_ok = code == 0; bad = 0 if control_ok else 1
    if code: print(out[-1500:])
    caught = skipped = 0
    for name, fn, check, needs_src in CASES:
        if needs_src and not HAS_SOURCE:
            print(f"SKIP  {name}: needs the source evidence tree"); skipped += 1; continue
        tmp, repo = make_copy()
        fn(repo)
        code, out = run_verify(repo); shutil.rmtree(tmp)
        hit = code == 1 and re.search(rf"^FAIL  {check}", out, re.M)
        caught += bool(hit)
        print(f"{'CAUGHT' if hit else 'MISSED'}  [{check}] {name}")
        if not hit:
            bad += 1; print(out[-800:])
    print(f"\nprove_drift: {caught}/{len(CASES) - skipped} drift cases caught, {skipped} skipped; control {'passed' if control_ok else 'FAILED'}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
