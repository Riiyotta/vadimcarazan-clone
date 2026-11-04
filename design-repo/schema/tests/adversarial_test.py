#!/usr/bin/env python3
"""Adversarial suite: every mutation must be REJECTED with its expected rule code; every control must pass.

    python3 schema/tests/adversarial_test.py        # exit 1 if any mutation slips through or a control fails

Three layers:
  MUTATIONS       PageSpec mutations (generated-mode leakage R2/R5, schema, structure, words, motion, tokens
                  R10, assets, retrieval R8), validated by schema/semantic_validate.py
  REPO_MUTATIONS  in-memory edits of the registry files (asset availability / policy, contract field roles,
                  retrieval flags in contract / allowlist / template) that the code pins must catch while
                  validating an untouched control
  GATE_MUTATIONS  wrapper-gate inputs (HERO 1900/3100 in flow and fixed, majority share, whitelist defects,
                  missing or wrong-viewport measurements, threshold drift) through extraction/wrapper_gate.py
Controls: every example in schema/ (2 reference + 2 generated, one of each per template family) and the
wrapper gate on the real measurements.
"""
import copy, importlib.util, json, sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[2]


def mod(name, rel):
    s = importlib.util.spec_from_file_location(name, ROOT / rel); m = importlib.util.module_from_spec(s); s.loader.exec_module(m); return m


sv = mod("sv", "schema/semantic_validate.py")
wg = mod("wg", "extraction/wrapper_gate.py")
EX = {p.stem.replace("example.pagespec", "reference.cosmos-home"): json.loads(p.read_text()) for p in sv.example_paths(ROOT)}
G, GC, R, RC = "generated.cosmos-home", "generated.case-study", "reference.cosmos-home", "reference.case-study.northwind"


def nd(spec, sid, k=0):
    return [n for n in spec["nodes"] if n["section"] == sid][k]


def C(spec, sid, k=0):
    return nd(spec, sid, k)["content"]


def swap(spec, a, b):
    ia = [i for i, n in enumerate(spec["nodes"]) if n["section"] == a][0]
    ib = [i for i, n in enumerate(spec["nodes"]) if n["section"] == b][0]
    spec["nodes"][ia], spec["nodes"][ib] = spec["nodes"][ib], spec["nodes"][ia]


def drop(spec, sid):
    spec["nodes"] = [n for n in spec["nodes"] if n["section"] != sid]


def seq(*fns):
    def f(s):
        for fn in fns: fn(s)
    return f


LONG = " ".join(["word"] * 70)
M = lambda role, ref: {"assetRole": role, "ref": ref, "alt": ""}

MUTATIONS = [
    # ---- R2/R5 generated-mode leakage: brand / logo
    ("source studio as brand", G, lambda s: s["brand"].update(studioName="WeGrow"), "GENERATED_MODE_BRAND"),
    ("source owner as brand", G, lambda s: s["brand"].update(ownerName="Vadim Carazan"), "GENERATED_MODE_BRAND"),
    ("reference build's placeholder name", G, lambda s: C(s, "hero.portrait-intro").update(name="Morgan Ellsworth"), "GENERATED_MODE_BRAND"),
    ("source sprint brand in copy", G, lambda s: C(s, "about.studio-bio")["paragraphs"].append("We also run NineDays for quick sprints."), "GENERATED_MODE_BRAND"),
    ("logo mark role reused", G, lambda s: C(s, "shell.loader").update(mark=M("brand.logo-mark", "generated://mark")), "GENERATED_MODE_ASSET"),
    ("original logo file under a safe role", G, lambda s: C(s, "chrome.topbar").update(homeMark=M("generated.brand-mark", "generated://logo.png")), "GENERATED_MODE_MEDIA"),
    ("name lettering reused", G, lambda s: C(s, "hero.portrait-intro").update(lettering=M("brand.name-lettering", "generated://x")), "GENERATED_MODE_ASSET"),
    ("signature reused", G, lambda s: C(s, "media.signature").update(trace=M("brand.signature-trace", "generated://sig")), "GENERATED_MODE_ASSET"),
    # ---- store marks / store URLs (generic guard: the source has none)
    ("store mark leak", G, lambda s: C(s, "chrome.social")["links"].append({"label": "App Store", "href": "https://shop.example/app"}), "GENERATED_MODE_STORE"),
    ("store URL leak", G, lambda s: C(s, "chrome.social")["links"].append({"label": "get it", "href": "https://play.google.com/store/apps/details?id=x"}), "GENERATED_MODE_STORE"),
    # ---- real ratings / metrics
    ("source metric claim", G, lambda s: C(s, "about.studio-bio").update(statsTemplate="1,067 images from 730 projects"), "GENERATED_MODE_RATING"),
    ("source tenure claim", G, lambda s: C(s, "about.studio-bio")["paragraphs"].append("Fourteen years in the trade."), "GENERATED_MODE_RATING"),
    ("rating claim", G, lambda s: C(s, "index.selected-list").update(body="Rated 5/5 by every maker we work with."), "GENERATED_MODE_RATING"),
    # ---- people
    ("person identity in bio", G, lambda s: C(s, "about.studio-bio")["paragraphs"].__setitem__(0, "I'm Vadim and I draw labels."), "GENERATED_MODE_PERSON"),
    ("source surname alone", G, lambda s: C(s, "chrome.topbar").update(homeLabel="Carazan home"), "GENERATED_MODE_BRAND"),
    ("portrait likeness reused", G, lambda s: C(s, "showcase.work-cosmos").update(portrait=M("portrait.subject-photo", "user://me")), "GENERATED_MODE_ASSET"),
    ("clone's user portrait under a safe role", G, lambda s: C(s, "showcase.work-cosmos").update(portrait=M("user.portrait-photo", "user://content/portrait.png")), "GENERATED_MODE_MEDIA"),
    # ---- clients
    ("original client name", G, lambda s: C(s, "showcase.work-cosmos")["works"][0].update(title="Noxtua"), "GENERATED_MODE_CLIENT"),
    ("reference build case name", G, lambda s: C(s, "showcase.work-cosmos")["works"][0].update(title="Northwind"), "GENERATED_MODE_CLIENT"),
    ("case-sensitive client name", G, lambda s: C(s, "index.selected-list")["items"][0].update(title="Needle"), "GENERATED_MODE_CLIENT"),
    ("client in about list", G, lambda s: C(s, "about.studio-bio")["clients"].append("Outset Law"), "GENERATED_MODE_CLIENT"),
    # ---- URLs / contact
    ("source social URL", G, lambda s: C(s, "chrome.social")["links"].append({"label": "Shots", "href": "https://dribbble.com/vadimcarazan"}), "GENERATED_MODE_URL"),
    ("source studio URL", G, lambda s: C(s, "hero.portrait-intro")["leadLink"].update(href="https://www.wegrow.design/"), "GENERATED_MODE_URL"),
    ("non-reserved URL", G, lambda s: C(s, "chrome.social")["links"].append({"label": "Site", "href": "https://latticeroom.com"}), "GENERATED_MODE_URL"),
    ("source domain as brand domain", G, lambda s: s["brand"].update(domain="vadimcarazan.com"), "GENERATED_MODE_URL"),
    ("protocol-relative source URL", GC, lambda s: C(s, "hero.case-header")["liveLink"].update(href="//vadimcarazan.com/x"), "GENERATED_MODE_URL"),
    ("source email", G, lambda s: C(s, "conversion.brief-form").update(email={"label": "hi@vadimcarazan.com", "href": "mailto:hi@vadimcarazan.com"}), "GENERATED_MODE_CONTACT"),
    ("reference build's email (reserved domain, still source)", G, lambda s: C(s, "conversion.brief-form").update(email={"label": "hello@example.com", "href": "mailto:hello@example.com"}), "GENERATED_MODE_CONTACT"),
    ("source city", G, lambda s: C(s, "chrome.topbar").update(city="Cluj-Napoca, Romania"), "GENERATED_MODE_CONTACT"),
    # ---- copy
    ("source statement", G, lambda s: C(s, "about.studio-bio").update(title="I make brands for founders who are building something new."), "GENERATED_MODE_COPY"),
    ("source 6-word window", G, lambda s: C(s, "conversion.brief-form").update(sub="A few lines are enough. I promise to answer."), "GENERATED_MODE_COPY"),
    ("reference build placeholder copy", G, lambda s: C(s, "showcase.work-cosmos")["works"][0].update(description="Placeholder work. One sentence about the brief, one about the idea, and you are done."), "GENERATED_MODE_COPY"),
    ("source CTA card line", GC, lambda s: C(s, "cta.start-project").update(title="Let's make the next one yours."), "GENERATED_MODE_COPY"),
    ("source lead split across fields", G, lambda s: C(s, "hero.portrait-intro").update(leadTail=". Scroll to fly through the work."), "GENERATED_MODE_COPY"),
    # ---- CTA
    ("source CTA label", G, lambda s: C(s, "hero.portrait-intro").update(startLabel="Explore the work"), "GENERATED_MODE_CTA"),
    ("source CTA on case page", GC, lambda s: C(s, "cta.start-project")["button"].update(label="Start a project"), "GENERATED_MODE_CTA"),
    ("brand CTA", G, lambda s: C(s, "detail.project-view")["cta"]["button"].update(label="Hire Vadim"), "GENERATED_MODE_CTA"),
    # ---- proprietary media
    ("atlas sheet ref", G, lambda s: C(s, "showcase.work-cosmos")["works"][0]["media"][0].update(ref="generated://atlas-3.webp"), "GENERATED_MODE_MEDIA"),
    ("snapshot image reused", GC, lambda s: C(s, "media.case-cover")["media"].update(ref="user://Vadim Carazan, Creative Director_files/wg-47fab7fd35d9.webp"), "GENERATED_MODE_MEDIA"),
    ("live original URL as media", GC, lambda s: C(s, "media.case-image")["media"].update(ref="https://vadimcarazan.com/atlas/atlas-0.webp"), "GENERATED_MODE_MEDIA"),
    ("clone art ref under a safe role", G, lambda s: C(s, "showcase.work-cosmos")["works"][1]["media"][0].update(ref="clone-art://100000/Device"), "GENERATED_MODE_MEDIA"),
    ("reference-only work role", G, lambda s: C(s, "showcase.work-cosmos")["works"][0]["media"][0].update(assetRole="work.piece-image"), "GENERATED_MODE_ASSET"),
    ("reference-only video role", GC, lambda s: C(s, "media.case-video").update(video=M("work.piece-video", "placeholder://v")), "GENERATED_MODE_ASSET"),
    ("reference home relabelled generated", R, lambda s: s.update(mode="generated"), "GENERATED_MODE_BRAND"),
    ("reference case relabelled generated", RC, lambda s: s.update(mode="generated"), "GENERATED_MODE_CLIENT"),
    # ---- schema layer
    ("mode missing", G, lambda s: s.pop("mode"), "SCHEMA"),
    ("mode not in enum", G, lambda s: s.update(mode="remix"), "SCHEMA"),
    ("theme not in enum", G, lambda s: s.update(theme="light"), "SCHEMA"),
    ("invented section", G, lambda s: s["nodes"].insert(4, {"section": "hero.invented", "content": {}, "motion": {"pattern": "none", "reducedMotionFallback": "none"}}), "SCHEMA"),
    ("invented content field", G, lambda s: C(s, "chrome.social").update(subtitle="x"), "SCHEMA"),
    ("missing reducedMotionFallback", G, lambda s: nd(s, "about.studio-bio")["motion"].pop("reducedMotionFallback"), "SCHEMA"),
    ("invented motion field", G, lambda s: nd(s, "about.studio-bio")["motion"].update(inventedAnimation="spin"), "SCHEMA"),
    ("invented asset role", G, lambda s: C(s, "showcase.work-cosmos")["works"][0]["media"][0].update(assetRole="image"), "SCHEMA"),
    ("pair with one image", GC, lambda s: C(s, "gallery.case-pair")["media"].pop(), "SCHEMA"),
    ("unknown nav action", G, lambda s: C(s, "chrome.topbar")["navItems"].append({"label": "Shop", "action": "shop"}), "SCHEMA"),
    # ---- structure
    ("template/node mismatch", G, lambda s: s.update(template="case-study"), "REQUIRED_SECTION_MISSING"),
    ("required section removed", G, lambda s: drop(s, "about.studio-bio"), "REQUIRED_SECTION_MISSING"),
    ("reordered sections", G, lambda s: swap(s, "hero.portrait-intro", "media.signature"), "TEMPLATE_SEQUENCE"),
    ("duplicate hero", G, lambda s: s["nodes"].insert(4, copy.deepcopy(nd(s, "hero.portrait-intro"))), "ONE_HERO"),
    ("content before hero", GC, lambda s: swap(s, "hero.case-header", "media.case-cover"), "HERO_FIRST_CONTENT"),
    ("loader not first", G, lambda s: swap(s, "shell.loader", "chrome.topbar"), "MUST_BE_FIRST"),
    ("footer not last", GC, lambda s: swap(s, "chrome.case-footer", "index.next-case"), "MUST_BE_LAST"),
    ("flybar without the cosmos", G, lambda s: drop(s, "showcase.work-cosmos"), "REQUIRES_SECTION"),
    ("home-only section on case page", GC, lambda s: s["nodes"].insert(5, copy.deepcopy(nd(EX[G], "about.studio-bio"))), "TEMPLATE_ONLY"),
    ("empty case body", GC, lambda s: s.update(nodes=[n for n in s["nodes"] if n["section"] not in ("editorial.case-text", "media.case-image", "gallery.case-pair", "media.case-video")]), "TEMPLATE_SEQUENCE"),
    ("route bound to another template", R, lambda s: s.update(route="/work/northwind"), "ROUTE_TEMPLATE_MISMATCH"),
    ("case route outside the pattern", GC, lambda s: s.update(route="/case/copperfin"), "ROUTE_PATTERN"),
    ("cosmos home on an unmapped route", R, lambda s: s.update(route="/about"), "HOME_ROUTE_ONLY"),
    ("box views disagree with the views present", G, lambda s: C(s, "overlay.glass-box").update(views=["project", "about", "contact"]), "BOX_VIEWS_MATCH"),
    ("nav to a view that is not there", G, seq(lambda s: drop(s, "index.selected-list"), lambda s: C(s, "overlay.glass-box").update(views=["project", "about", "contact"])), "NAV_TARGET_EXISTS"),
    ("next case links to itself", GC, lambda s: C(s, "index.next-case").update(href="/work/copperfin"), "NEXT_CASE_NOT_SELF"),
    # ---- words / motion / assets
    ("maxWords overflow (generated)", GC, lambda s: C(s, "editorial.case-text").update(body=LONG), "MAX_WORDS"),
    ("maxWords overflow (reference)", R, lambda s: C(s, "about.studio-bio").update(title="I make brands for founders who are building something new and very exciting today."), "MAX_WORDS"),
    ("maxWords overflow inside the CTA group", G, lambda s: C(s, "detail.project-view")["cta"].update(kicker="a kicker that is far too long"), "MAX_WORDS"),
    ("motion not allowed for section", G, lambda s: nd(s, "hero.portrait-intro").update(motion={"pattern": "box-slide", "reducedMotionFallback": "instant"}), "MOTION_PATTERN_NOT_ALLOWED"),
    ("motion fallback mismatch", G, lambda s: nd(s, "hero.portrait-intro").update(motion={"pattern": "hero-fade", "reducedMotionFallback": "unchanged"}), "MOTION_FALLBACK_MISMATCH"),
    ("asset role not allowed in field (reference)", R, lambda s: C(s, "shell.loader")["mark"].update(assetRole="work.piece-image"), "ASSET_ROLE_NOT_ALLOWED"),
    ("asset role not allowed in field (generated)", G, lambda s: C(s, "shell.loader").update(mark=M("generated.work-visual", "generated://x")), "ASSET_ROLE_NOT_ALLOWED"),
    # ---- retrieval eligibility (node level)
    ("node flips runtime UI to eligible", G, lambda s: nd(s, "shell.loader").update(retrievalEligible=True), "RETRIEVAL_INELIGIBLE_SHELL_ONLY"),
    ("node flips the glass box to eligible", G, lambda s: nd(s, "overlay.glass-box").update(retrievalEligible=True), "RETRIEVAL_INELIGIBLE_SHELL_ONLY"),
    ("node marks content ineligible", G, lambda s: nd(s, "about.studio-bio").update(retrievalEligible=False), "RETRIEVAL_INELIGIBLE_SHELL_ONLY"),
    # ---- tokens (R10)
    ("raw hex surface", G, lambda s: nd(s, "about.studio-bio")["tokens"].update(surface="#161618"), "TOKEN_RAW_COLOR"),
    ("raw rgba text", G, lambda s: nd(s, "about.studio-bio")["tokens"].update(text="rgba(242,242,242,.78)"), "TOKEN_RAW_COLOR"),
    ("unknown token", G, lambda s: nd(s, "about.studio-bio")["tokens"].update(surface="surface.neon"), "TOKEN_UNKNOWN"),
    ("arbitrary spacing", GC, lambda s: nd(s, "cta.start-project")["tokens"].update(spaceBlock="40px"), "TOKEN_ARBITRARY_SPACING"),
    ("arbitrary clamp spacing", GC, lambda s: nd(s, "cta.start-project")["tokens"].update(spaceBlock="clamp(10px, 5vh, 99px)"), "TOKEN_ARBITRARY_SPACING"),
    ("unsupported font", G, lambda s: nd(s, "hero.portrait-intro")["tokens"].update(font="Comic Sans MS"), "TOKEN_FONT_UNSUPPORTED"),
    ("original commercial font", G, lambda s: nd(s, "hero.portrait-intro")["tokens"].update(font="PP Editorial Old Italic"), "TOKEN_FONT_UNSUPPORTED"),
    ("invalid surface/text pair", G, lambda s: nd(s, "hero.portrait-intro")["tokens"].update(text="text.on-solid"), "TOKEN_THEME_COMBINATION"),
    ("surface not allowed for section", G, lambda s: nd(s, "hero.portrait-intro")["tokens"].update(surface="surface.glass", text="text.primary"), "TOKEN_SURFACE_NOT_ALLOWED"),
    ("token of wrong category", G, lambda s: nd(s, "about.studio-bio")["tokens"].update(surface="text.primary"), "TOKEN_CATEGORY"),
    ("non-referenceable token", G, lambda s: nd(s, "utility.hover-hud").update(tokens={"surface": "surface.hud"}), "TOKEN_NOT_REFERENCEABLE"),
    ("non-referenceable spacing token", GC, lambda s: nd(s, "cta.start-project")["tokens"].update(spaceBlock="space.gap-24"), "TOKEN_NOT_REFERENCEABLE"),
]


def repo_mut(fn):
    def run():
        repo = sv.load_repo(ROOT); fn(repo); return repo
    return run


def _flip(r, sid, v):
    r["contracts"][sid].update(retrievalEligible=v)


REPO_MUTATIONS = [
    ("registry loosens logo availability", repo_mut(lambda r: r["roles"]["brand.logo-mark"].update(availability="generation-safe")), "PIN_AVAILABILITY"),
    ("registry sets portrait policy to a different valid value", repo_mut(lambda r: r["roles"]["portrait.subject-photo"].update(generationPolicy="user-supplied-only")), "PIN_AVAILABILITY"),
    ("registry makes work images reusable", repo_mut(lambda r: r["roles"]["work.piece-image"].update(generationPolicy="may-reuse-licensed")), "PIN_AVAILABILITY"),
    ("registry tightens a safe role", repo_mut(lambda r: r["roles"]["generated.work-visual"].update(availability="reference-only")), "PIN_AVAILABILITY"),
    ("registry drops substitutes", repo_mut(lambda r: r["roles"]["brand.signature-trace"].pop("generationSafeSubstitutes")), "PIN_AVAILABILITY"),
    ("registry adds an unpinned role", repo_mut(lambda r: r["roles"].update({"brand.extra": {"availability": "generation-safe"}})), "PIN_AVAILABILITY"),
    ("contract field allows the real lettering in generated mode", repo_mut(lambda r: r["contracts"]["hero.portrait-intro"]["content"]["lettering"]["generatedAssetRoles"].append("brand.name-lettering")), "PIN_AVAILABILITY"),
    ("contract flips loader to eligible", repo_mut(lambda r: _flip(r, "shell.loader", True)), "PIN_RETRIEVAL"),
    ("allowlist flips toast to eligible", repo_mut(lambda r: r["allowlist"]["sections"]["utility.copy-toast"].update(retrievalEligible=True)), "PIN_RETRIEVAL"),
    ("contract+allowlist flip the box together", repo_mut(lambda r: (_flip(r, "overlay.glass-box", True), r["allowlist"]["sections"]["overlay.glass-box"].update(retrievalEligible=True))), "PIN_RETRIEVAL"),
    ("contract+allowlist+template flip the menu together", repo_mut(lambda r: (_flip(r, "shell.phone-menu", True), r["allowlist"]["sections"]["shell.phone-menu"].update(retrievalEligible=True), r["templates"]["cosmos-home"]["nodes"][2].update(retrievalEligible=True))), "PIN_RETRIEVAL"),
    ("contract marks content ineligible", repo_mut(lambda r: r["contracts"]["conversion.brief-form"].update(retrievalEligible=False, retrievalReason="x" * 40)), "PIN_RETRIEVAL"),
    ("template node flips eligibility", repo_mut(lambda r: r["templates"]["case-study"]["nodes"][1].update(retrievalEligible=True)), "PIN_RETRIEVAL"),
]


def gate_mut(fn):
    def run():
        m = json.loads((ROOT / "extraction/measured-values.json").read_text())
        w = json.loads((ROOT / "extraction/wrapper-whitelist.json").read_text())
        fn(m, w); return wg.check(ROOT, measured=m, whitelist=w)
    return run


def sec(m, route, sid):
    return [s for s in m["sectionHeights"]["routes"][route]["sections"] if s["id"] == sid][0]


CR = "/work/northwind"
PH = lambda m: m["sectionHeights"]["routes"][CR]["pageHeight"]
GOOD_WL = lambda h, route=CR, sid="hero.case-header": {"route": route, "section": sid, "reviewedBy": "design lead (human)", "justification": "Adversarial fixture: a deliberately tall hero used to prove the whitelist path.", "maxHeightPx": h}
GATE_MUTATIONS = [
    ("HERO 1900px warns", gate_mut(lambda m, w: sec(m, CR, "hero.case-header").update(h=1900)), "warn:GATE_HERO_TALL"),
    ("HERO 3100px fails", gate_mut(lambda m, w: sec(m, CR, "hero.case-header").update(h=3100)), "GATE_HERO_TOO_TALL"),
    ("fixed HERO 3100px on '/' fails too", gate_mut(lambda m, w: sec(m, "/", "hero.portrait-intro").update(h=3100)), "GATE_HERO_TOO_TALL"),
    ("HERO 3100px whitelisted still warns", gate_mut(lambda m, w: (sec(m, CR, "hero.case-header").update(h=3100), w["entries"].append(GOOD_WL(3200)))), "warn-only:GATE_HERO_TOO_TALL"),
    ("majority section fails", gate_mut(lambda m, w: sec(m, CR, "media.case-cover").update(h=0.7 * PH(m))), "GATE_MAJORITY_SECTION"),
    ("55% section warns", gate_mut(lambda m, w: sec(m, CR, "media.case-cover").update(h=0.55 * PH(m))), "warn:GATE_LARGE_SECTION"),
    ("whitelist without justification", gate_mut(lambda m, w: (sec(m, CR, "hero.case-header").update(h=3100), w["entries"].append({**GOOD_WL(3200), "justification": "short"}))), "GATE_WHITELIST_INVALID"),
    ("whitelist agent posing as human review", gate_mut(lambda m, w: (sec(m, CR, "hero.case-header").update(h=3100), w["entries"].append({**GOOD_WL(3200), "reviewedBy": "design-repo agent"}))), "GATE_WHITELIST_INVALID"),
    ("stale whitelist entry", gate_mut(lambda m, w: w["entries"].append(GOOD_WL(3200))), "GATE_WHITELIST_STALE"),
    ("whitelist over cap", gate_mut(lambda m, w: (sec(m, CR, "hero.case-header").update(h=3100), w["entries"].append(GOOD_WL(3050)))), "GATE_WHITELIST_OVER_CAP"),
    ("missing route measurement", gate_mut(lambda m, w: m["sectionHeights"]["routes"].pop("/work/tessera")), "GATE_MISSING_MEASUREMENT"),
    ("measured section without contract", gate_mut(lambda m, w: m["sectionHeights"]["routes"][CR]["sections"].append({"id": "hero.ghost", "top": 0, "h": 10, "inFlow": True, "position": "static"})), "GATE_UNKNOWN_SECTION"),
    ("template section never measured", gate_mut(lambda m, w: [r.update(sections=[s for s in r["sections"] if s["id"] != "gallery.case-pair"]) for r in m["sectionHeights"]["routes"].values()]), "GATE_MISSING_MEASUREMENT"),
    ("no sectionHeights at all", gate_mut(lambda m, w: m.pop("sectionHeights")), "GATE_MISSING_MEASUREMENT"),
    ("measured at the wrong viewport", gate_mut(lambda m, w: m["sectionHeights"].update(viewport="390x844")), "GATE_WRONG_VIEWPORT"),
    ("thresholds loosened in JSON only", gate_mut(lambda m, w: m.update(thresholds={"heroWarnPx": 5000, "heroErrorPx": 9000, "shareWarn": 0.9, "shareError": 0.95})), "GATE_THRESHOLD_DRIFT"),
]


def main():
    repo = sv.load_repo(ROOT); ok = 0; bad = []
    print("controls")
    for name, spec in EX.items():
        e, w = sv.validate(copy.deepcopy(spec), repo)
        print(f"  {'PASS' if not e else 'FAIL'}  control {name} ({spec['mode']}) errors={len(e)} warnings={len(w)}")
        if e: bad.append(f"control {name}: {e[:3]}")
    e, w = wg.check(ROOT)
    print(f"  {'PASS' if not e else 'FAIL'}  control wrapper gate on real measurements errors={len(e)} warnings={len(w)}")
    if e: bad.append(f"gate control: {e[:3]}")
    print("mutations")
    for name, base, fn, code in MUTATIONS:
        s = copy.deepcopy(EX[base]); fn(s)
        e, _ = sv.validate(s, repo)
        hit = code in [c for c, _ in e]
        ok += hit
        print(f"  {'REJECTED' if hit else 'MISSED  '}  [{code}] {name} ({base})")
        if not hit: bad.append(f"{name}: expected {code}, got {[c for c, _ in e][:4]}")
    for name, mk, code in REPO_MUTATIONS:
        e, _ = sv.validate(copy.deepcopy(EX[G]), mk())
        hit = code in [c for c, _ in e]; ok += hit
        print(f"  {'REJECTED' if hit else 'MISSED  '}  [{code}] {name} (repo)")
        if not hit: bad.append(f"{name}: expected {code}")
    for name, run, code in GATE_MUTATIONS:
        e, w = run(); ec, wc = [c for c, _ in e], [c for c, _ in w]
        if code.startswith("warn-only:"):
            c = code.split(":")[1]; hit = c in wc and not e
        elif code.startswith("warn:"):
            c = code.split(":")[1]; hit = c in wc
        else:
            hit = code in ec
        ok += hit
        print(f"  {'CAUGHT  ' if hit else 'MISSED  '}  [{code}] {name} (gate)")
        if not hit: bad.append(f"{name}: expected {code}, errors {ec[:3]} warnings {wc[:3]}")
    total = len(MUTATIONS) + len(REPO_MUTATIONS) + len(GATE_MUTATIONS)
    print(f"\nadversarial: {ok}/{total} mutations rejected; {len(EX) + 1} controls; failures: {len(bad)}")
    for b in bad: print("  FAIL", b)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
