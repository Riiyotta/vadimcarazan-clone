#!/usr/bin/env python3
"""R9 whole-page-wrapper quality gate, run by extraction/verify_all.py (and standalone).

    python3 extraction/wrapper_gate.py          # exit 1 on any error

Heights come from extraction/measured-values.json -> sectionHeights (measured in a headless browser at
1440x900 on every route by extraction/measure_sections.mjs). Thresholds are pinned HERE in code; a
thresholds block in JSON that disagrees is itself an error.

  HERO > 1800px: warn.  HERO > 3000px: error unless whitelisted. Applied to every HERO measurement,
  in flow or not (a fixed hero is still a rendered composition; on '/' it is 318.6px).
  One in-flow section > 50% of its page: warn; > 60%: error unless whitelisted. Pages with < 3 in-flow
  sections are skipped (this is '/': every layer is position:fixed, 0 in-flow sections, document height =
  viewport); SHELL/UTILITY are excluded; fixed/sticky and display:none elements take no page height.
  Missing measurement (a route, or a template node with no measured instance) or a wrong viewport: error.
  Whitelist entries (extraction/wrapper-whitelist.json) need reviewedBy, a 30+ char justification and a
  maxHeightPx above the measured height; stale or over-cap entries fail; a whitelisted hit still warns.
"""
import json, sys
from pathlib import Path

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parent.parent
HERO_WARN_PX = 1800
HERO_ERROR_PX = 3000
SHARE_WARN = 0.50
SHARE_ERROR = 0.60
MIN_INFLOW_SECTIONS = 3
REQUIRED_VIEWPORT = "1440x900"
EXCLUDED_CATEGORIES = {"SHELL", "UTILITY"}
AGENT_PHRASE = "agent attestation, not a human sign-off"


def _j(p):
    return json.loads(Path(p).read_text())


def check(root=ROOT, measured=None, whitelist=None, routes=None, contracts=None):
    root = Path(root)
    measured = measured if measured is not None else _j(root / "extraction/measured-values.json")
    whitelist = whitelist if whitelist is not None else _j(root / "extraction/wrapper-whitelist.json")
    routes = routes if routes is not None else _j(root / "templates/routes.json")["routes"]
    contracts = contracts if contracts is not None else {p.stem: _j(p) for p in (root / "sections").glob("*.json")}
    templates = _j(root / "templates/templates.json")["templates"]
    errs, warns = [], []
    th = measured.get("thresholds")
    if th is not None and th != {"heroWarnPx": HERO_WARN_PX, "heroErrorPx": HERO_ERROR_PX, "shareWarn": SHARE_WARN, "shareError": SHARE_ERROR}:
        errs.append(("GATE_THRESHOLD_DRIFT", f"JSON thresholds {th} differ from the pinned constants"))
    sh = measured.get("sectionHeights")
    if not isinstance(sh, dict) or not isinstance(sh.get("routes"), dict):
        return errs + [("GATE_MISSING_MEASUREMENT", "extraction/measured-values.json has no sectionHeights.routes")], warns
    if sh.get("viewport") != REQUIRED_VIEWPORT:
        errs.append(("GATE_WRONG_VIEWPORT", f"sectionHeights measured at {sh.get('viewport')!r}, gate requires {REQUIRED_VIEWPORT}"))
    wl = {}
    for e in whitelist.get("entries", []):
        key = (e.get("route"), e.get("section"))
        rb = str(e.get("reviewedBy", "")).strip()
        if not rb:
            errs.append(("GATE_WHITELIST_INVALID", f"{key}: reviewedBy missing"))
        elif "agent" in rb.lower() and AGENT_PHRASE not in rb.lower():
            errs.append(("GATE_WHITELIST_INVALID", f"{key}: an agent reviewer must state '{AGENT_PHRASE}'"))
        if len(str(e.get("justification", ""))) < 30:
            errs.append(("GATE_WHITELIST_INVALID", f"{key}: justification must be >= 30 chars"))
        if not isinstance(e.get("maxHeightPx"), (int, float)):
            errs.append(("GATE_WHITELIST_INVALID", f"{key}: maxHeightPx missing"))
        wl[key] = e
    used = set()
    seen_sections = set()
    for r in routes:
        m = sh["routes"].get(r["path"])
        if not m:
            errs.append(("GATE_MISSING_MEASUREMENT", f"{r['path']}: no section heights"))
            continue
        page_h = m.get("pageHeight") or 0
        flow, heroes = [], []
        for s in m.get("sections", []):
            c = contracts.get(s["id"])
            if c is None:
                errs.append(("GATE_UNKNOWN_SECTION", f"{r['path']}: measured section {s['id']} has no contract"))
                continue
            seen_sections.add(s["id"])
            if c["semantic"]["category"] == "HERO":
                heroes.append(s)
            if s.get("inFlow") and c["semantic"]["category"] not in EXCLUDED_CATEGORIES:
                flow.append(s)
        if not heroes:
            errs.append(("GATE_MISSING_MEASUREMENT", f"{r['path']}: no HERO measured"))

        def hit(key, h):
            e = wl.get(key)
            if e is not None and isinstance(e.get("maxHeightPx"), (int, float)) and h > e["maxHeightPx"]:
                errs.append(("GATE_WHITELIST_OVER_CAP", f"{key}: measured {h}px exceeds whitelisted maxHeightPx {e['maxHeightPx']}"))
                return None
            return e
        for s in heroes:
            key, h = (r["path"], s["id"]), s["h"]; e = hit(key, h)
            if h > HERO_ERROR_PX:
                (warns if e else errs).append(("GATE_HERO_TOO_TALL", f"{key}: HERO {h}px > {HERO_ERROR_PX}px" + (" (whitelisted)" if e else "")))
                if e: used.add(key)
            elif h > HERO_WARN_PX:
                warns.append(("GATE_HERO_TALL", f"{key}: HERO {h}px > {HERO_WARN_PX}px"))
                if e: used.add(key)
        if len(flow) >= MIN_INFLOW_SECTIONS and page_h:
            for s in flow:
                key, h = (r["path"], s["id"]), s["h"]; e = hit(key, h)
                share = h / page_h
                if share > SHARE_ERROR:
                    (warns if e else errs).append(("GATE_MAJORITY_SECTION", f"{key}: {share:.0%} of a {page_h}px page" + (" (whitelisted)" if e else "")))
                    if e: used.add(key)
                elif share > SHARE_WARN:
                    warns.append(("GATE_LARGE_SECTION", f"{key}: {share:.0%} of the page"))
                    if e: used.add(key)
    # every section a template places must have been measured somewhere (video blocks excepted: no served route renders one)
    for t, tpl in templates.items():
        for n in tpl["nodes"]:
            for sid in ([n["section"]] if "section" in n else n["allowed"]):
                if sid not in seen_sections and contracts.get(sid, {}).get("measured", {}).get("inFlowAt1440", "x") is not None:
                    errs.append(("GATE_MISSING_MEASUREMENT", f"template {t}: {sid} has no measured instance"))
    for key in wl:
        if key not in used:
            errs.append(("GATE_WHITELIST_STALE", f"{key}: whitelist entry no longer matches any gated hit"))
    return errs, warns


def summary(root=ROOT):
    m = _j(Path(root) / "extraction/measured-values.json")["sectionHeights"]
    heroes = [(p, s["h"]) for p, r in m["routes"].items() for s in r["sections"] if s["id"].startswith("hero.")]
    share, skipped = [], []
    for p, r in m["routes"].items():
        fl = [s for s in r["sections"] if s.get("inFlow") and not s["id"].startswith(("shell.", "utility.", "chrome.", "overlay."))]
        if len(fl) >= MIN_INFLOW_SECTIONS:
            top = max(fl, key=lambda s: s["h"]); share.append((top["h"] / r["pageHeight"], p, top["id"]))
        else:
            skipped.append(p)
    return max(heroes, key=lambda x: x[1]), max(share), skipped


if __name__ == "__main__":
    e, w = check()
    for c, m in e: print("ERROR", c, m)
    for c, m in w: print("warn ", c, m)
    (hp, hmax), (smax, sp, sid), skipped = summary()
    print(f"wrapper gate: {len(e)} errors, {len(w)} warnings; tallest HERO {hmax}px on {hp} (warn>{HERO_WARN_PX}, error>{HERO_ERROR_PX}); "
          f"largest in-flow share {smax:.1%} ({sid} on {sp}; warn>{SHARE_WARN:.0%}, error>{SHARE_ERROR:.0%}); share rule skipped (<{MIN_INFLOW_SECTIONS} in-flow sections): {skipped}")
    sys.exit(1 if e else 0)
